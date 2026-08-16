from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from backend.cluster.manager import cluster_manager
from kubernetes_asyncio.client import CoreV1Api
import asyncio, uuid

router = APIRouter()

class NodeCommand(BaseModel):
    command: str
    namespace: str = "default"
    timeout_seconds: int = 45
    node_names: list[str] = []
    node_selector: str = ""

@router.post('/commands/{context_name}/nodes')
async def run_on_nodes(context_name: str, request: NodeCommand):
    if not request.command.strip(): raise HTTPException(status_code=400, detail='Command is required')
    request.timeout_seconds = min(300, max(5, request.timeout_seconds))
    client = await cluster_manager.get_client(context_name)
    v1 = CoreV1Api(client)
    nodes = await v1.list_node(label_selector=request.node_selector or None)
    if request.node_names:
        nodes.items = [node for node in nodes.items if node.metadata.name in request.node_names]
    if not nodes.items: raise HTTPException(status_code=400, detail='No nodes match the selected targets')
    run_id = uuid.uuid4().hex[:8]
    pods = []
    try:
        for index, node in enumerate(nodes.items):
            name = f'k8sune-node-command-{run_id}-{index}'
            body = {'metadata': {'name': name, 'labels': {'app.kubernetes.io/managed-by': 'k8sune', 'k8sune.io/node-command': run_id}}, 'spec': {'nodeName': node.metadata.name, 'restartPolicy': 'Never', 'tolerations': [{'operator': 'Exists'}], 'containers': [{'name': 'runner', 'image': 'alpine:3.20', 'imagePullPolicy': 'IfNotPresent', 'command': ['/bin/sh', '-c', request.command]}]}}
            await v1.create_namespaced_pod(request.namespace, body); pods.append((node.metadata.name, name))
        async def collect(node, name):
            for _ in range(max(1, request.timeout_seconds * 2)):
                pod = await v1.read_namespaced_pod(name, request.namespace)
                if pod.status.phase in ('Succeeded', 'Failed'):
                    try: output = await v1.read_namespaced_pod_log(name, request.namespace, container='runner')
                    except Exception as exc: output = str(exc)
                    return {'node': node, 'status': pod.status.phase, 'output': output}
                await asyncio.sleep(.5)
            return {'node': node, 'status': 'TimedOut', 'output': f'No completion after {request.timeout_seconds}s'}
        return {'results': await asyncio.gather(*(collect(node, name) for node, name in pods))}
    except Exception as exc: raise HTTPException(status_code=400, detail=str(exc))
    finally:
        await asyncio.gather(*(v1.delete_namespaced_pod(name, request.namespace, grace_period_seconds=0) for _, name in pods), return_exceptions=True)
