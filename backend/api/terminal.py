from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from backend.cluster.manager import cluster_manager
from kubernetes_asyncio.client import CoreV1Api
from kubernetes_asyncio.stream import WsApiClient
from aiohttp import WSMsgType
import asyncio

router = APIRouter()

# Kubernetes exec multiplexes data on the first byte: stdin=0, stdout=1,
# stderr=2, error/status=3, resize=4. WsApiClient exposes that raw protocol.
STDIN_CHANNEL = "\x00"
OUTPUT_CHANNELS = {1, 2, 3}


@router.websocket("/ws/exec/{context_name}/{namespace}/{pod_name}/{container_name}")
async def exec_terminal(websocket: WebSocket, context_name: str, namespace: str, pod_name: str, container_name: str):
    await websocket.accept()
    response = None
    try:
        client = await cluster_manager.get_client(context_name)
        async with WsApiClient(client.configuration) as ws_client:
            v1 = CoreV1Api(ws_client)
            # Hot-reloaded UI state can temporarily retain an old container
            # name. Resolve it from the live Pod before requesting exec.
            pod = await CoreV1Api(client).read_namespaced_pod(pod_name, namespace)
            available_containers = [item.name for item in (pod.spec.containers or [])]
            if container_name not in available_containers:
                if not available_containers:
                    raise RuntimeError("The Pod has no runnable containers")
                container_name = available_containers[0]
                await websocket.send_text(f"\r\n[Using container: {container_name}]\r\n")
            response_context = await v1.connect_get_namespaced_pod_exec(
                pod_name,
                namespace,
                container=container_name,
                command=["/bin/sh"],
                stderr=True,
                stdin=True,
                stdout=True,
                tty=True,
                _preload_content=False,
            )
            # The async Kubernetes client returns an aiohttp request-context
            # manager here; awaiting it yields the actual WebSocket response.
            response = await response_context

            async def kubernetes_to_browser():
                while True:
                    try:
                        message = await response.receive(timeout=1)
                    except asyncio.TimeoutError:
                        continue
                    if message.type in (WSMsgType.CLOSE, WSMsgType.CLOSED, WSMsgType.CLOSING):
                        break
                    if message.type == WSMsgType.ERROR:
                        raise response.exception() or RuntimeError("Kubernetes exec websocket failed")
                    if message.type not in (WSMsgType.TEXT, WSMsgType.BINARY):
                        continue
                    data = message.data.decode("utf-8", "replace") if isinstance(message.data, bytes) else message.data
                    if not data:
                        continue
                    channel, payload = ord(data[0]), data[1:]
                    if channel in OUTPUT_CHANNELS and payload:
                        await websocket.send_text(payload)

            async def browser_to_kubernetes():
                while True:
                    data = await websocket.receive_text()
                    await response.send_str(f"{STDIN_CHANNEL}{data}")

            k8s_task = asyncio.create_task(kubernetes_to_browser())
            browser_task = asyncio.create_task(browser_to_kubernetes())
            done, pending = await asyncio.wait({k8s_task, browser_task}, return_when=asyncio.FIRST_COMPLETED)
            for task in pending:
                task.cancel()
            await asyncio.gather(*pending, return_exceptions=True)
            for task in done:
                error = task.exception()
                if error and not isinstance(error, WebSocketDisconnect):
                    raise error
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        print(f"Exec error: {exc}")
        try:
            await websocket.send_text(f"\r\n[Error] Could not connect to container shell: {exc}\r\n")
        except Exception:
            pass
    finally:
        if response is not None and not response.closed:
            await response.close()
        try:
            await websocket.close()
        except Exception:
            pass
