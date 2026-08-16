from fastapi import APIRouter, HTTPException, Request
from sse_starlette.sse import EventSourceResponse
from backend.cluster.manager import cluster_manager
from kubernetes_asyncio.client import CoreV1Api
import asyncio

router = APIRouter()

@router.get("/logs/{context_name}/{namespace}/{pod_name}")
async def stream_logs(request: Request, context_name: str, namespace: str, pod_name: str, container: str = None, since_seconds: int = None, previous: bool = False):
    client = await cluster_manager.get_client(context_name)
    v1 = CoreV1Api(client)

    async def log_generator():
        try:
            selected_container = container
            if not selected_container:
                pod = await v1.read_namespaced_pod(pod_name, namespace)
                containers = [item.name for item in (pod.spec.containers or [])]
                if not containers:
                    raise RuntimeError("Pod has no containers")
                selected_container = containers[0]
            # Previous container instances are completed and cannot be followed.
            params = {
                "name": pod_name,
                "namespace": namespace,
                "follow": not previous,
                "previous": previous,
                "_preload_content": False
            }
            params["container"] = selected_container
            if since_seconds:
                params["since_seconds"] = since_seconds
            
            resp = await v1.read_namespaced_pod_log(**params)
            
            while True:
                if await request.is_disconnected():
                    resp.close()
                    break
                
                line = await resp.content.readline()
                if not line:
                    break
                
                yield line.decode('utf-8')
        except Exception as e:
            yield f"Error streaming logs: {e}\n"

    return EventSourceResponse(log_generator())
