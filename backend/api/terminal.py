from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from backend.cluster.manager import cluster_manager
from kubernetes_asyncio.client import CoreV1Api
from kubernetes_asyncio.stream import WsApiClient
import asyncio

router = APIRouter()

@router.websocket("/ws/exec/{context_name}/{namespace}/{pod_name}/{container_name}")
async def exec_terminal(websocket: WebSocket, context_name: str, namespace: str, pod_name: str, container_name: str):
    await websocket.accept()
    
    try:
        client = await cluster_manager.get_client(context_name)
        # We need WsApiClient for streaming
        async with WsApiClient(client.configuration) as ws_client:
            v1 = CoreV1Api(ws_client)
            
            exec_command = ["/bin/sh", "-c", "TERM=xterm-256color; export TERM; [ -x /bin/bash ] && ([ -x /usr/bin/python3 ] && /bin/bash || /bin/bash) || /bin/sh"]
            
            resp = await v1.connect_get_namespaced_pod_exec(
                pod_name,
                namespace,
                container=container_name,
                command=exec_command,
                stderr=True,
                stdin=True,
                stdout=True,
                tty=True,
                _preload_content=False
            )

            async def kubernetes_to_websocket():
                try:
                    while resp.is_open():
                        await resp.update(timeout=1)
                        if resp.peek_stdout():
                            await websocket.send_text(resp.read_stdout())
                        if resp.peek_stderr():
                            await websocket.send_text(resp.read_stderr())
                        await asyncio.sleep(0.01)
                except Exception as e:
                    print(f"K8s to WS error: {e}")

            async def websocket_to_kubernetes():
                try:
                    while resp.is_open():
                        data = await websocket.receive_text()
                        resp.write_stdin(data)
                except Exception as e:
                    print(f"WS to K8s error: {e}")

            # Run both as tasks
            await asyncio.gather(
                kubernetes_to_websocket(),
                websocket_to_kubernetes(),
                return_exceptions=True
            )
            
    except WebSocketDisconnect:
        print("Websocket disconnected")
    except Exception as e:
        print(f"Exec error: {e}")
        await websocket.send_text(f"\r\n[Error] Could not connect to container: {e}\r\n")
    finally:
        try:
            await websocket.close()
        except:
            pass
