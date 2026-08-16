from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from backend.cluster.manager import cluster_manager
from kubernetes_asyncio.client import CoreV1Api, NetworkingV1Api
import asyncio
import re
import uuid

router = APIRouter()

@router.get('/network/{context_name}')
async def network_overview(context_name: str):
    client = await cluster_manager.get_client(context_name)
    v1, net = CoreV1Api(client), NetworkingV1Api(client)
    services, ingresses, policies, endpoints, nodes = await asyncio.gather(v1.list_service_for_all_namespaces(), net.list_ingress_for_all_namespaces(), net.list_network_policy_for_all_namespaces(), v1.list_endpoints_for_all_namespaces(), v1.list_node())
    endpoint_map = {(item.metadata.namespace, item.metadata.name): sum(len(subset.addresses or []) for subset in (item.subsets or [])) for item in endpoints.items}
    endpoint_rows = []
    for item in endpoints.items:
        addresses = [address.ip for subset in (item.subsets or []) for address in (subset.addresses or [])]
        not_ready = [address.ip for subset in (item.subsets or []) for address in (subset.not_ready_addresses or [])]
        ports = sorted({port.port for subset in (item.subsets or []) for port in (subset.ports or [])})
        endpoint_rows.append({'name': item.metadata.name, 'namespace': item.metadata.namespace, 'addresses': addresses, 'not_ready_addresses': not_ready, 'ports': ports})
    return {'services': [{'name': item.metadata.name, 'namespace': item.metadata.namespace, 'type': item.spec.type, 'cluster_ip': item.spec.cluster_ip, 'ports': [port.port for port in (item.spec.ports or [])], 'ready_endpoints': endpoint_map.get((item.metadata.namespace, item.metadata.name), 0)} for item in services.items], 'endpoints': endpoint_rows, 'nodes': [item.metadata.name for item in nodes.items], 'ingresses': [{'name': item.metadata.name, 'namespace': item.metadata.namespace, 'class': item.spec.ingress_class_name, 'hosts': [rule.host for rule in (item.spec.rules or [])]} for item in ingresses.items], 'policies': [{'name': item.metadata.name, 'namespace': item.metadata.namespace, 'pod_selector': item.spec.pod_selector.match_labels or {}, 'policy_types': item.spec.policy_types or [], 'ingress_rules': len(item.spec.ingress or []), 'egress_rules': len(item.spec.egress or [])} for item in policies.items]}

class ClusterProbe(BaseModel):
    host: str = Field(min_length=1, max_length=253)
    port: int | None = Field(default=None, ge=1, le=65535)
    timeout_seconds: float = Field(default=5, ge=1, le=30)
    namespace: str = Field(default='default', min_length=1, max_length=63)
    source_node: str | None = Field(default=None, max_length=253)

def _safe_host(value: str) -> str:
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9.:-]*', value):
        raise HTTPException(status_code=400, detail='Host must be a DNS name or IP address')
    return value

async def _run_cluster_probe(context_name: str, probe: ClusterProbe, command: str):
    """Run a bounded diagnostic in a temporary Pod, optionally pinned to a node."""
    client = await cluster_manager.get_client(context_name)
    v1 = CoreV1Api(client)
    name = f'k8sune-network-probe-{uuid.uuid4().hex[:8]}'
    body = {'metadata': {'name': name, 'labels': {'app.kubernetes.io/managed-by': 'k8sune', 'k8sune.io/network-probe': 'true'}}, 'spec': {'restartPolicy': 'Never', 'tolerations': [{'operator': 'Exists'}], 'containers': [{'name': 'probe', 'image': 'alpine:3.20', 'imagePullPolicy': 'IfNotPresent', 'command': ['/bin/sh', '-c', command]}]}}
    if probe.source_node:
        body['spec']['nodeName'] = probe.source_node
    started = asyncio.get_running_loop().time()
    try:
        await v1.create_namespaced_pod(probe.namespace, body)
        for _ in range(max(1, int(probe.timeout_seconds * 2) + 20)):
            pod = await v1.read_namespaced_pod(name, probe.namespace)
            if pod.status.phase in ('Succeeded', 'Failed'):
                try: output = await v1.read_namespaced_pod_log(name, probe.namespace, container='probe')
                except Exception as exc: output = str(exc)
                return {'reachable': pod.status.phase == 'Succeeded', 'node': pod.spec.node_name, 'output': output, 'latency_ms': round((asyncio.get_running_loop().time() - started) * 1000, 1)}
            await asyncio.sleep(.5)
        return {'reachable': False, 'error': f'Probe did not complete within {probe.timeout_seconds}s', 'latency_ms': round((asyncio.get_running_loop().time() - started) * 1000, 1)}
    except Exception as exc:
        return {'reachable': False, 'error': str(exc), 'latency_ms': round((asyncio.get_running_loop().time() - started) * 1000, 1)}
    finally:
        await asyncio.gather(v1.delete_namespaced_pod(name, probe.namespace, grace_period_seconds=0), return_exceptions=True)

@router.post('/network/{context_name}/dns')
async def dns_check(context_name: str, probe: ClusterProbe):
    host = _safe_host(probe.host)
    result = await _run_cluster_probe(context_name, probe, f'nslookup {host}')
    return {'host': host, **result}

@router.post('/network/{context_name}/connection-test')
async def connection_test(context_name: str, probe: ClusterProbe):
    if not probe.port: raise HTTPException(status_code=400, detail='Port is required')
    host = _safe_host(probe.host)
    result = await _run_cluster_probe(context_name, probe, f'nc -zvw {int(probe.timeout_seconds)} {host} {probe.port}')
    return {'host': host, 'port': probe.port, **result}
