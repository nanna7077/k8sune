from fastapi import APIRouter, HTTPException, Query, Request
from sse_starlette.sse import EventSourceResponse
from backend.cluster.manager import cluster_manager
from kubernetes_asyncio.client import CoreV1Api, AppsV1Api, CustomObjectsApi, VersionApi, BatchV1Api, NetworkingV1Api
from kubernetes_asyncio.watch import Watch
import asyncio
import base64
import json
import re
import time
from typing import Optional

router = APIRouter()


def parse_memory_quantity(value) -> int:
    """Convert Kubernetes memory quantities to bytes, including decimal SI values like 400M."""
    if value is None:
        return 0
    text = str(value).strip()
    if not text:
        return 0

    match = re.fullmatch(r"([+-]?(?:\d+(?:\.\d*)?|\.\d+))(Ki|Mi|Gi|Ti|Pi|Ei|K|M|G|T|P|E|m)?", text)
    if not match:
        return 0

    amount = float(match.group(1))
    unit = match.group(2) or ""
    multipliers = {
        "": 1,
        "m": 0.001,
        "K": 1000,
        "M": 1000 ** 2,
        "G": 1000 ** 3,
        "T": 1000 ** 4,
        "P": 1000 ** 5,
        "E": 1000 ** 6,
        "Ki": 1024,
        "Mi": 1024 ** 2,
        "Gi": 1024 ** 3,
        "Ti": 1024 ** 4,
        "Pi": 1024 ** 5,
        "Ei": 1024 ** 6,
    }
    return int(amount * multipliers[unit])


def workload_restart_counts(workloads, pods):
    """Sum container restarts for Pods selected by each workload's label selector."""
    counts = {}
    for workload in workloads:
        selector = (workload.spec.selector.match_labels or {}) if workload.spec and workload.spec.selector else {}
        total = 0
        for pod in pods:
            if pod.metadata.namespace != workload.metadata.namespace:
                continue
            labels = pod.metadata.labels or {}
            if all(labels.get(key) == value for key, value in selector.items()):
                statuses = (pod.status.container_statuses or []) + (pod.status.init_container_statuses or []) if pod.status else []
                total += sum(status.restart_count or 0 for status in statuses)
        counts[(workload.metadata.namespace, workload.metadata.name)] = total
    return counts


async def paged_workload_restart_counts(v1, workloads):
    """Calculate restart counts one workload at a time without listing every Pod cluster-wide."""
    counts = {}
    for workload in workloads:
        selector = (workload.spec.selector.match_labels or {}) if workload.spec and workload.spec.selector else {}
        selector_text = ','.join(f'{key}={value}' for key, value in selector.items())
        total, token = 0, None
        while True:
            page = await v1.list_namespaced_pod(workload.metadata.namespace, label_selector=selector_text, limit=250, _continue=token)
            for pod in page.items:
                statuses = ((pod.status.container_statuses or []) + (pod.status.init_container_statuses or [])) if pod.status else []
                total += sum(status.restart_count or 0 for status in statuses)
            token = getattr(page.metadata, '_continue', None) or getattr(page.metadata, 'continue_', None)
            if not token:
                break
        counts[(workload.metadata.namespace, workload.metadata.name)] = total
    return counts


def page_result(response, mapper):
    """Serialize one Kubernetes continuation page without retaining the full list."""
    metadata = getattr(response, 'metadata', None)
    next_token = getattr(metadata, '_continue', None) or getattr(metadata, 'continue_', None) or None
    items = [mapper(item) for item in response.items]
    # The API may provide an exact number of items after this continuation
    # page. It lets the UI show progress without first fetching every object.
    remaining = getattr(metadata, 'remaining_item_count', None)
    total = len(items) + remaining if isinstance(remaining, int) else None
    return {"items": items, "continue": next_token, "total": total}


def page_metadata(response, item_count: int):
    """Continuation and optional total metadata for hand-serialized list APIs."""
    metadata = getattr(response, 'metadata', None)
    remaining = getattr(metadata, 'remaining_item_count', None)
    return {
        "continue": getattr(metadata, '_continue', None) or getattr(metadata, 'continue_', None) or None,
        "total": item_count + remaining if isinstance(remaining, int) else None,
    }


async def collect_all_pages(fetch_page):
    """Read every server-retained item through Kubernetes continuation tokens."""
    items, token = [], None
    while True:
        page = await fetch_page(token)
        page_items = page.get('items', []) if isinstance(page, dict) else page.items
        items.extend(page_items)
        metadata = page.get('metadata', {}) if isinstance(page, dict) else getattr(page, 'metadata', None)
        token = (metadata.get('continue') if isinstance(metadata, dict) else getattr(metadata, '_continue', None) or getattr(metadata, 'continue_', None))
        if not token:
            return items


async def inspect_tls_certificate(encoded_certificate: str) -> dict:
    """Return public X.509 metadata only; never return secret or private-key material."""
    try:
        certificate = base64.b64decode(encoded_certificate)
        process = await asyncio.create_subprocess_exec(
            "openssl", "x509", "-noout", "-subject", "-issuer", "-serial", "-startdate", "-enddate", "-ext", "subjectAltName",
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await process.communicate(certificate)
        if process.returncode:
            return {"error": stderr.decode("utf-8", "replace").strip() or "Certificate could not be parsed"}
        fields = {}
        for line in stdout.decode("utf-8", "replace").splitlines():
            if "=" in line:
                key, value = line.split("=", 1)
                fields[key.strip().lower()] = value.strip()
        return {
            "subject": fields.get("subject", "—"),
            "issuer": fields.get("issuer", "—"),
            "serial": fields.get("serial", "—"),
            "not_before": fields.get("notbefore", "—"),
            "not_after": fields.get("notafter", "—"),
            "sans": fields.get("x509v3 subject alternative name", "—"),
        }
    except Exception as exc:
        return {"error": f"Certificate could not be parsed: {exc}"}


def secret_summary(secret) -> str:
    data = secret.data or {}
    kind = secret.type or "Opaque"
    if kind == "kubernetes.io/dockerconfigjson": return "Docker registry credentials"
    if kind == "kubernetes.io/basic-auth": return "Basic authentication credentials"
    if kind == "kubernetes.io/ssh-auth": return "SSH private key"
    if kind == "kubernetes.io/service-account-token": return "ServiceAccount token"
    if kind == "kubernetes.io/tls": return "TLS certificate and private key"
    return f"{len(data)} key{'' if len(data) == 1 else 's'}: {', '.join(list(data)[:3])}" if data else "No data keys"

@router.get("/resources/{context_name}/overview")
async def get_overview(context_name: str):
    try:
        client = await cluster_manager.get_client(context_name)
        v1 = CoreV1Api(client)
        v_api = VersionApi(client)
        
        # Basic Cluster Info
        version = await v_api.get_code()
        nodes = await v1.list_node()
        pods = await v1.list_pod_for_all_namespaces()
        namespaces = await v1.list_namespace()
        
        # Critical Components (Deprecated in some k8s, but we try)
        components = []
        try:
            cs = await v1.list_component_status()
            components = []
            for component in cs.items:
                conditions = component.conditions or []
                healthy = next((condition for condition in conditions if condition.type == 'Healthy' and condition.status == 'True'), None)
                reason = '; '.join(filter(None, [getattr(condition, 'message', None) or getattr(condition, 'error', None) for condition in conditions if condition.status != 'True']))
                components.append({"name": component.metadata.name, "status": "Healthy" if healthy else "Unhealthy", "reason": reason or "The API server did not report a healthy component condition."})
        except:
            # Fallback: check some pods in kube-system
            components = [{"name": "API Server", "status": "Healthy"}, {"name": "etcd", "status": "Healthy"}]

        # Nodes and Capacity
        total_cpu = 0
        total_mem = 0 # In bytes
        allocatable_cpu = 0
        allocatable_mem = 0
        architectures = set()
        provider = "Unknown"
        oldest_node = None

        def parse_cpu(cpu_str):
            if not cpu_str: return 0
            cpu_str = str(cpu_str).strip()
            if cpu_str.endswith('m'):
                try:
                    return int(cpu_str[:-1])
                except:
                    return 0
            try:
                return int(float(cpu_str) * 1000)
            except:
                return 0

        parse_mem = parse_memory_quantity

        for n in nodes.items:
            # Architecture
            architectures.add(n.status.node_info.architecture)
            
            # Provider
            if n.spec.provider_id:
                provider = n.spec.provider_id.split(':')[0]
            
            # Age
            if oldest_node is None or n.metadata.creation_timestamp < oldest_node:
                oldest_node = n.metadata.creation_timestamp

            # Capacity / Allocatable
            total_cpu += parse_cpu(n.status.capacity['cpu'])
            total_mem += parse_mem(n.status.capacity['memory'])
            allocatable_cpu += parse_cpu(n.status.allocatable['cpu'])
            allocatable_mem += parse_mem(n.status.allocatable['memory'])

        # Resource reserved (Requests)
        reserved_cpu = 0
        reserved_mem = 0
        for p in pods.items:
            if p.status.phase == "Running":
                for c in p.spec.containers:
                    if c.resources and c.resources.requests:
                        if 'cpu' in c.resources.requests:
                            reserved_cpu += parse_cpu(c.resources.requests['cpu'])
                        if 'memory' in c.resources.requests:
                            reserved_mem += parse_mem(c.resources.requests['memory'])

        return {
            "version": version.git_version,
            "provider": provider,
            "architectures": list(architectures),
            "age": oldest_node,
            "counts": {
                "nodes": len(nodes.items),
                "pods": len(pods.items),
                "namespaces": len(namespaces.items),
            },
            "capacity": {
                "cpu": {"total": total_cpu, "allocatable": allocatable_cpu, "reserved": reserved_cpu},
                "memory": {"total": total_mem, "allocatable": allocatable_mem, "reserved": reserved_mem},
                "pods": {"total": sum(int(n.status.capacity['pods']) for n in nodes.items), "current": len(pods.items)}
            },
            "components": components
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/resources/{context_name}/nodes")
async def get_nodes(context_name: str, limit: int = Query(20, ge=1, le=500), continue_token: Optional[str] = Query(None, alias="continue")):
    try:
        client = await cluster_manager.get_client(context_name)
        v1 = CoreV1Api(client)
        nodes = await v1.list_node(limit=limit, _continue=continue_token)
        pods = await v1.list_pod_for_all_namespaces()

        # Pre-parse CPU/Mem helper functions (re-using from overview logic)
        def parse_cpu(cpu_str):
            if not cpu_str: return 0
            if cpu_str.endswith('m'): return int(cpu_str[:-1])
            return int(cpu_str) * 1000

        parse_mem = parse_memory_quantity

        # Calculate reservations per node
        node_stats = {n.metadata.name: {"cpu": 0, "mem": 0, "pods": 0} for n in nodes.items}
        for p in pods.items:
            if p.spec.node_name in node_stats and p.status.phase == "Running":
                node_stats[p.spec.node_name]["pods"] += 1
                for c in p.spec.containers:
                    if c.resources and c.resources.requests:
                        node_stats[p.spec.node_name]["cpu"] += parse_cpu(c.resources.requests.get('cpu', '0'))
                        node_stats[p.spec.node_name]["mem"] += parse_mem(c.resources.requests.get('memory', '0'))

        items = []
        for n in nodes.items:
            name = n.metadata.name
            stats = node_stats.get(name, {"cpu": 0, "mem": 0, "pods": 0})
            
            internal_ip = next((addr.address for addr in n.status.addresses if addr.type == 'InternalIP'), '---')
            external_ip = next((addr.address for addr in n.status.addresses if addr.type == 'ExternalIP'), '---')
            
            capacity_cpu = parse_cpu(n.status.allocatable['cpu'])
            capacity_mem = parse_mem(n.status.allocatable['memory'])
            capacity_pods = int(n.status.allocatable['pods'])

            items.append({
                "name": name,
                "status": "Ready" if any(c.type == 'Ready' and c.status == 'True' for c in n.status.conditions) else "NotReady",
                "roles": [label.split('/')[-1] for label in n.metadata.labels if label.startswith('node-role.kubernetes.io/')],
                "version": n.status.node_info.kubelet_version,
                "os": f"{n.status.node_info.os_image} ({n.status.node_info.architecture})",
                "internal_ip": internal_ip,
                "external_ip": external_ip,
                "creation_timestamp": n.metadata.creation_timestamp.isoformat(),
                "cpu_usage": {"reserved": stats["cpu"], "total": capacity_cpu},
                "mem_usage": {"reserved": stats["mem"], "total": capacity_mem},
                "pod_usage": {"current": stats["pods"], "total": capacity_pods}
            })

        return {"items": items, **page_metadata(nodes, len(items))}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/resources/{context_name}/pods")
async def get_pods(context_name: str, namespace: str = None, limit: int = Query(100, ge=1, le=500), continue_token: Optional[str] = Query(None, alias="continue")):
    try:
        client = await cluster_manager.get_client(context_name)
        v1 = CoreV1Api(client)
        if namespace:
            pods = await v1.list_namespaced_pod(namespace, limit=limit, _continue=continue_token)
        else:
            pods = await v1.list_pod_for_all_namespaces(limit=limit, _continue=continue_token)
        return page_result(pods, lambda p: {
            "name": p.metadata.name, "namespace": p.metadata.namespace, "status": p.status.phase,
            "ip": p.status.pod_ip, "node": p.spec.node_name,
            "containers": [container.name for container in (p.spec.containers or [])],
            "creation_timestamp": p.metadata.creation_timestamp,
        })
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/resources/{context_name}/deployments")
async def get_deployments(context_name: str, namespace: str = None, limit: int = Query(100, ge=1, le=500), continue_token: Optional[str] = Query(None, alias="continue")):
    try:
        client = await cluster_manager.get_client(context_name)
        apps_v1 = AppsV1Api(client)
        pod_api = CoreV1Api(client)
        if namespace:
            items = await apps_v1.list_namespaced_deployment(namespace, limit=limit, _continue=continue_token)
        else:
            items = await apps_v1.list_deployment_for_all_namespaces(limit=limit, _continue=continue_token)
        restart_counts = await paged_workload_restart_counts(pod_api, items.items)
        
        return {
            "items": [{
                    "name": d.metadata.name,
                    "namespace": d.metadata.namespace,
                    "replicas": d.spec.replicas if d.spec.replicas is not None else 1,
                    "ready_replicas": d.status.ready_replicas or 0,
                    "restart_count": restart_counts.get((d.metadata.namespace, d.metadata.name), 0),
                    "creation_timestamp": d.metadata.creation_timestamp
                } for d in items.items],
            **page_metadata(items, len(items.items)),
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/resources/{context_name}/namespaces")
async def get_namespaces(context_name: str, limit: int = Query(100, ge=1, le=500), continue_token: Optional[str] = Query(None, alias="continue")):
    try:
        client = await cluster_manager.get_client(context_name)
        v1 = CoreV1Api(client)
        ns = await v1.list_namespace(limit=limit, _continue=continue_token)
        return page_result(ns, lambda n: {"name": n.metadata.name, "status": n.status.phase, "creation_timestamp": n.metadata.creation_timestamp})
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/resources/{context_name}/configmaps")
async def get_configmaps(context_name: str, namespace: str = None, limit: int = Query(100, ge=1, le=500), continue_token: Optional[str] = Query(None, alias="continue")):
    try:
        client = await cluster_manager.get_client(context_name)
        v1 = CoreV1Api(client)
        if namespace:
            items = await v1.list_namespaced_config_map(namespace, limit=limit, _continue=continue_token)
        else:
            items = await v1.list_config_map_for_all_namespaces(limit=limit, _continue=continue_token)
        return page_result(items, lambda i: {
            "name": i.metadata.name, "namespace": i.metadata.namespace,
            "data_count": len(i.data) if i.data else 0, "creation_timestamp": i.metadata.creation_timestamp,
        })
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/resources/{context_name}/secrets")
async def get_secrets(context_name: str, namespace: str = None, limit: int = Query(100, ge=1, le=500), continue_token: Optional[str] = Query(None, alias="continue")):
    try:
        client = await cluster_manager.get_client(context_name)
        v1 = CoreV1Api(client)
        if namespace:
            items = await v1.list_namespaced_secret(namespace, limit=limit, _continue=continue_token)
        else:
            items = await v1.list_secret_for_all_namespaces(limit=limit, _continue=continue_token)
        result = []
        for item in items.items:
            tls_info = None
            if item.type == "kubernetes.io/tls" and item.data and item.data.get("tls.crt"):
                tls_info = await inspect_tls_certificate(item.data["tls.crt"])
            result.append({
                "name": item.metadata.name,
                "namespace": item.metadata.namespace,
                "type": item.type,
                "data_count": len(item.data) if item.data else 0,
                "summary": secret_summary(item),
                "tls_info": tls_info,
                "creation_timestamp": item.metadata.creation_timestamp,
            })
        return {"items": result, **page_metadata(items, len(result))}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/resources/{context_name}/configmaps/{namespace}/{name}")
async def get_configmap_details(context_name: str, namespace: str, name: str):
    try:
        client = await cluster_manager.get_client(context_name)
        v1 = CoreV1Api(client)
        obj = await v1.read_namespaced_config_map(name, namespace)
        return {
            "metadata": {
                "name": obj.metadata.name,
                "namespace": obj.metadata.namespace,
                "labels": obj.metadata.labels or {},
                "creation_timestamp": obj.metadata.creation_timestamp,
            },
            "spec": {
                "data": obj.data or {},
                "binary_data_keys": list((obj.binary_data or {}).keys()),
                "immutable": obj.immutable,
            },
            "status": {},
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/resources/{context_name}/secrets/{namespace}/{name}")
async def get_secret_details(context_name: str, namespace: str, name: str):
    try:
        client = await cluster_manager.get_client(context_name)
        obj = await CoreV1Api(client).read_namespaced_secret(name, namespace)
        tls_info = None
        if obj.type == "kubernetes.io/tls" and obj.data and obj.data.get("tls.crt"):
            tls_info = await inspect_tls_certificate(obj.data["tls.crt"])
        return {
            "metadata": {"name": obj.metadata.name, "namespace": obj.metadata.namespace, "labels": obj.metadata.labels or {}, "creation_timestamp": obj.metadata.creation_timestamp},
            "spec": {"type": obj.type, "data_keys": list((obj.data or {}).keys()), "tls_info": tls_info},
            "status": {},
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/resources/{context_name}/persistentvolumes/{name}")
async def get_persistent_volume_details(context_name: str, name: str):
    try:
        client = await cluster_manager.get_client(context_name)
        obj = await CoreV1Api(client).read_persistent_volume(name)
        return {
            "metadata": {"name": obj.metadata.name, "labels": obj.metadata.labels or {}, "creation_timestamp": obj.metadata.creation_timestamp},
            "spec": {"capacity": obj.spec.capacity or {}, "access_modes": obj.spec.access_modes or [], "reclaim_policy": obj.spec.persistent_volume_reclaim_policy, "storage_class": obj.spec.storage_class_name},
            "status": {"phase": obj.status.phase if obj.status else None},
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/resources/{context_name}/persistentvolumeclaims/{namespace}/{name}")
async def get_persistent_volume_claim_details(context_name: str, namespace: str, name: str):
    try:
        client = await cluster_manager.get_client(context_name)
        obj = await CoreV1Api(client).read_namespaced_persistent_volume_claim(name, namespace)
        return {
            "metadata": {"name": obj.metadata.name, "namespace": obj.metadata.namespace, "labels": obj.metadata.labels or {}, "creation_timestamp": obj.metadata.creation_timestamp},
            "spec": {"access_modes": obj.spec.access_modes or [], "storage_class": obj.spec.storage_class_name, "volume_name": obj.spec.volume_name, "resources": obj.spec.resources.to_dict() if obj.spec.resources else {}},
            "status": {"phase": obj.status.phase if obj.status else None},
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/resources/{context_name}/persistentvolumes")
async def get_pv(context_name: str):
    try:
        client = await cluster_manager.get_client(context_name)
        v1 = CoreV1Api(client)
        items = await v1.list_persistent_volume()
        return {
            "items": [
                {
                    "name": i.metadata.name,
                    "capacity": i.spec.capacity.get('storage') if i.spec.capacity else 'N/A',
                    "access_modes": i.spec.access_modes,
                    "status": i.status.phase,
                    "claim": f"{i.spec.claim_ref.namespace}/{i.spec.claim_ref.name}" if i.spec.claim_ref else None,
                    "storage_class": i.spec.storage_class_name,
                    "creation_timestamp": i.metadata.creation_timestamp
                } for i in items.items
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/resources/{context_name}/persistentvolumeclaims")
async def get_pvc(context_name: str, namespace: str = None):
    try:
        client = await cluster_manager.get_client(context_name)
        v1 = CoreV1Api(client)
        if namespace:
            items = await v1.list_namespaced_persistent_volume_claim(namespace)
        else:
            items = await v1.list_persistent_volume_claim_for_all_namespaces()
        return {
            "items": [
                {
                    "name": i.metadata.name,
                    "namespace": i.metadata.namespace,
                    "status": i.status.phase,
                    "volume": i.spec.volume_name,
                    "capacity": i.status.capacity.get('storage') if i.status.capacity else 'N/A',
                    "storage_class": i.spec.storage_class_name,
                    "creation_timestamp": i.metadata.creation_timestamp
                } for i in items.items
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/resources/{context_name}/generic/{group}/{version}/{plural}")
async def get_generic_resources(context_name: str, group: str, version: str, plural: str, namespace: str = None, limit: int = Query(100, ge=1, le=500), continue_token: Optional[str] = Query(None, alias="continue")):
    try:
        client = await cluster_manager.get_client(context_name)
        custom = CustomObjectsApi(client)
        if namespace:
            items = await custom.list_namespaced_custom_object(group, version, namespace, plural, limit=limit, _continue=continue_token)
        else:
            items = await custom.list_cluster_custom_object(group, version, plural, limit=limit, _continue=continue_token)
            
        result = [
                {
                    "name": i['metadata']['name'],
                    "namespace": i['metadata'].get('namespace'),
                    "creation_timestamp": i['metadata']['creationTimestamp']
                } for i in items.get('items', [])
            ]
        metadata = items.get('metadata') or {}
        remaining = metadata.get('remainingItemCount')
        return {
            "items": result,
            "continue": metadata.get('continue'),
            "total": len(result) + remaining if isinstance(remaining, int) else None,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/resources/{context_name}/deployments/{namespace}/{name}")
async def get_deployment_details(context_name: str, namespace: str, name: str):
    try:
        client = await cluster_manager.get_client(context_name)
        apps_v1 = AppsV1Api(client)
        dep = await apps_v1.read_namespaced_deployment(name, namespace)
        return {
            "metadata": {
                "name": dep.metadata.name, "namespace": dep.metadata.namespace, 
                "labels": dep.metadata.labels, "creation_timestamp": dep.metadata.creation_timestamp
            },
            "spec": {
                "replicas": dep.spec.replicas if dep.spec.replicas is not None else 1,
                "selector": dep.spec.selector.match_labels,
                "strategy": dep.spec.strategy.to_dict() if dep.spec.strategy else {},
                "containers": [{"name": c.name, "image": c.image, "ports": [p.to_dict() for p in c.ports] if c.ports else []} for c in dep.spec.template.spec.containers]
            },
            "status": {
                "replicas": dep.status.replicas if dep.status.replicas is not None else 0,
                "ready_replicas": dep.status.ready_replicas if dep.status.ready_replicas is not None else 0,
                "available_replicas": dep.status.available_replicas if dep.status.available_replicas is not None else 0,
                "conditions": [{"type": c.type, "status": c.status, "reason": c.reason, "message": c.message} for c in dep.status.conditions]
            }
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/resources/{context_name}/statefulsets/{namespace}/{name}")
async def get_statefulset_details(context_name: str, namespace: str, name: str):
    try:
        client = await cluster_manager.get_client(context_name)
        apps_v1 = AppsV1Api(client)
        obj = await apps_v1.read_namespaced_stateful_set(name, namespace)
        return {
            "metadata": {"name": obj.metadata.name, "namespace": obj.metadata.namespace, "labels": obj.metadata.labels, "creation_timestamp": obj.metadata.creation_timestamp},
            "spec": {
                "replicas": obj.spec.replicas if obj.spec.replicas is not None else 1, "selector": obj.spec.selector.match_labels,
                "containers": [{"name": c.name, "image": c.image, "ports": [p.to_dict() for p in c.ports] if c.ports else []} for c in obj.spec.template.spec.containers]
            },
            "status": {
                "ready_replicas": obj.status.ready_replicas if obj.status.ready_replicas is not None else 0,
                "replicas": obj.status.replicas if obj.status.replicas is not None else 0
            }
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/resources/{context_name}/daemonsets/{namespace}/{name}")
async def get_daemonset_details(context_name: str, namespace: str, name: str):
    try:
        client = await cluster_manager.get_client(context_name)
        apps_v1 = AppsV1Api(client)
        obj = await apps_v1.read_namespaced_daemon_set(name, namespace)
        return {
            "metadata": {"name": obj.metadata.name, "namespace": obj.metadata.namespace, "labels": obj.metadata.labels, "creation_timestamp": obj.metadata.creation_timestamp},
            "spec": {
                "selector": obj.spec.selector.match_labels,
                "containers": [{"name": c.name, "image": c.image, "ports": [p.to_dict() for p in c.ports] if c.ports else []} for c in obj.spec.template.spec.containers]
            },
            "status": {
                "desired_number_scheduled": obj.status.desired_number_scheduled if obj.status.desired_number_scheduled is not None else 0,
                "number_ready": obj.status.number_ready if obj.status.number_ready is not None else 0
            }
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/resources/{context_name}/cronjobs/{namespace}/{name}")
async def get_cronjob_details(context_name: str, namespace: str, name: str):
    try:
        client = await cluster_manager.get_client(context_name)
        batch = BatchV1Api(client)
        obj = await batch.read_namespaced_cron_job(name, namespace)
        return {
            "metadata": {"name": obj.metadata.name, "namespace": obj.metadata.namespace, "labels": obj.metadata.labels, "creation_timestamp": obj.metadata.creation_timestamp},
            "spec": {
                "schedule": obj.spec.schedule, "suspend": obj.spec.suspend,
                "containers": [{"name": c.name, "image": c.image, "ports": [p.to_dict() for p in c.ports] if c.ports else []} for c in obj.spec.job_template.spec.template.spec.containers]
            },
            "status": {"last_schedule_time": obj.status.last_schedule_time}
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/resources/{context_name}/namespaces/{name}")
async def get_namespace_details(context_name: str, name: str):
    try:
        client = await cluster_manager.get_client(context_name)
        v1 = CoreV1Api(client)
        apps_v1 = AppsV1Api(client)
        batch_v1 = BatchV1Api(client)
        networking_v1 = NetworkingV1Api(client)
        
        # Gather all information in parallel to stay fast
        pods_task = v1.list_namespaced_pod(name)
        deployments_task = apps_v1.list_namespaced_deployment(name)
        statefulsets_task = apps_v1.list_namespaced_stateful_set(name)
        daemonsets_task = apps_v1.list_namespaced_daemon_set(name)
        cronjobs_task = batch_v1.list_namespaced_cron_job(name)
        jobs_task = batch_v1.list_namespaced_job(name)
        services_task = v1.list_namespaced_service(name)
        ingresses_task = networking_v1.list_namespaced_ingress(name)
        configmaps_task = v1.list_namespaced_config_map(name)
        secrets_task = v1.list_namespaced_secret(name)
        pvcs_task = v1.list_namespaced_persistent_volume_claim(name)
        nodes_task = v1.list_node()
        ns_task = v1.read_namespace(name)

        results = await asyncio.gather(
            pods_task, deployments_task, statefulsets_task, daemonsets_task, cronjobs_task, jobs_task,
            services_task, ingresses_task, configmaps_task, secrets_task, pvcs_task, nodes_task, ns_task,
            return_exceptions=True
        )

        def parse_cpu(cpu_str):
            if not cpu_str: return 0
            cpu_str = str(cpu_str).strip()
            if cpu_str.endswith('m'):
                try:
                    return int(cpu_str[:-1])
                except:
                    return 0
            try:
                return int(float(cpu_str) * 1000)
            except:
                return 0

        parse_mem = parse_memory_quantity

        def get_items_list(res):
            if isinstance(res, Exception):
                return []
            if hasattr(res, 'items') and res.items is not None:
                return res.items
            return []

        (
            pods_res, deployments_res, statefulsets_res, daemonsets_res, cronjobs_res, jobs_res,
            services_res, ingresses_res, configmaps_res, secrets_res, pvcs_res, nodes_res, ns_res
        ) = results

        if isinstance(ns_res, Exception):
            raise ns_res

        pods_items = get_items_list(pods_res)
        deployments_items = get_items_list(deployments_res)
        statefulsets_items = get_items_list(statefulsets_res)
        daemonsets_items = get_items_list(daemonsets_res)
        cronjobs_items = get_items_list(cronjobs_res)
        jobs_items = get_items_list(jobs_res)
        services_items = get_items_list(services_res)
        ingresses_items = get_items_list(ingresses_res)
        configmaps_items = get_items_list(configmaps_res)
        secrets_items = get_items_list(secrets_res)
        pvcs_items = get_items_list(pvcs_res)
        nodes_items = get_items_list(nodes_res)

        # Calculate cluster allocatable capacity
        cluster_allocatable_cpu = 0
        cluster_allocatable_mem = 0
        for n in nodes_items:
            cluster_allocatable_cpu += parse_cpu(n.status.allocatable.get('cpu', '0'))
            cluster_allocatable_mem += parse_mem(n.status.allocatable.get('memory', '0'))

        # Calculate namespace usage (sum of requests from running pods)
        ns_reserved_cpu = 0
        ns_reserved_mem = 0
        for p in pods_items:
            if p.status.phase == "Running":
                for c in p.spec.containers:
                    if c.resources and c.resources.requests:
                        if 'cpu' in c.resources.requests:
                            ns_reserved_cpu += parse_cpu(c.resources.requests['cpu'])
                        if 'memory' in c.resources.requests:
                            ns_reserved_mem += parse_mem(c.resources.requests['memory'])

        return {
            "metadata": {"name": ns_res.metadata.name, "labels": ns_res.metadata.labels, "creation_timestamp": ns_res.metadata.creation_timestamp},
            "status": {"phase": ns_res.status.phase},
            "counts": {
                "pods": len(pods_items),
                "deployments": len(deployments_items),
                "statefulsets": len(statefulsets_items),
                "daemonsets": len(daemonsets_items),
                "cronjobs": len(cronjobs_items),
                "jobs": len(jobs_items),
                "services": len(services_items),
                "ingresses": len(ingresses_items),
                "configmaps": len(configmaps_items),
                "secrets": len(secrets_items),
                "pvcs": len(pvcs_items)
            },
            "usage": {
                "cpu": {
                    "reserved": ns_reserved_cpu,
                    "cluster_allocatable": cluster_allocatable_cpu
                },
                "memory": {
                    "reserved": ns_reserved_mem,
                    "cluster_allocatable": cluster_allocatable_mem
                }
            }
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/resources/{context_name}/nodes/{node_name}")
async def get_node_details(context_name: str, node_name: str):
    try:
        client = await cluster_manager.get_client(context_name)
        v1 = CoreV1Api(client)
        node = await v1.read_node(node_name)
        return {
            "metadata": {"name": node.metadata.name, "labels": node.metadata.labels, "creation_timestamp": node.metadata.creation_timestamp},
            "status": {
                "conditions": [{"type": c.type, "status": c.status, "reason": c.reason, "message": c.message} for c in node.status.conditions],
                "addresses": [{"type": a.type, "address": a.address} for a in node.status.addresses],
                "images": [{"names": i.names, "size_bytes": i.size_bytes} for i in node.status.images[:20]]
            }
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/resources/{context_name}/events/{namespace}/{name}")
async def get_resource_events(context_name: str, namespace: str, name: str):
    try:
        client = await cluster_manager.get_client(context_name)
        v1 = CoreV1Api(client)
        custom = CustomObjectsApi(client)
        field_selector = f"involvedObject.name={name}"
        if namespace not in ('Cluster', 'none', 'undefined', 'null'):
            core_result, modern_result = await asyncio.gather(
                collect_all_pages(lambda token: v1.list_namespaced_event(namespace, field_selector=field_selector, limit=500, _continue=token)),
                collect_all_pages(lambda token: custom.list_namespaced_custom_object('events.k8s.io', 'v1', namespace, 'events', field_selector=f"regarding.name={name}", limit=500, _continue=token)),
                return_exceptions=True,
            )
        else:
            core_result, modern_result = await asyncio.gather(
                collect_all_pages(lambda token: v1.list_event_for_all_namespaces(field_selector=field_selector, limit=500, _continue=token)),
                collect_all_pages(lambda token: custom.list_cluster_custom_object('events.k8s.io', 'v1', 'events', field_selector=f"regarding.name={name}", limit=500, _continue=token)),
                return_exceptions=True,
            )
        deduplicated, errors = {}, []
        for result in (core_result, modern_result):
            if isinstance(result, Exception):
                errors.append(str(result))
                continue
            event_items = result
            for event in event_items:
                serialized = serialize_event(event)
                key = (serialized['namespace'], serialized['object_kind'], serialized['object_name'], serialized['type'], serialized['reason'], serialized['message'])
                existing = deduplicated.get(key)
                if not existing or str(serialized.get('last_timestamp') or '') > str(existing.get('last_timestamp') or ''):
                    if existing:
                        serialized['count'] = max(int(serialized.get('count') or 1), int(existing.get('count') or 1))
                    deduplicated[key] = serialized
        items = sorted(deduplicated.values(), key=lambda event: str(event.get('last_timestamp') or event.get('first_timestamp') or ''), reverse=True)
        return {"items": items, "warnings": errors}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

def serialize_event(event):
    if isinstance(event, dict):
        involved = event.get('regarding') or event.get('involvedObject') or {}
        series = event.get('series') or {}
        metadata = event.get('metadata') or {}
        return {
            "type": event.get('type') or "Normal",
            "reason": event.get('reason') or "Unknown",
            "message": event.get('note') or event.get('message') or "",
            "first_timestamp": event.get('eventTime') or metadata.get('creationTimestamp'),
            "last_timestamp": series.get('lastObservedTime') or event.get('eventTime') or metadata.get('creationTimestamp'),
            "count": series.get('count') or event.get('deprecatedCount') or 1,
            "object_name": involved.get('name'),
            "object_kind": involved.get('kind'),
            "namespace": involved.get('namespace') or metadata.get('namespace'),
        }
    involved = getattr(event, 'involved_object', None) or getattr(event, 'regarding', None)
    series = getattr(event, 'series', None)
    return {
        "type": event.type or "Normal",
        "reason": event.reason or "Unknown",
        "message": getattr(event, 'message', None) or getattr(event, 'note', None) or "",
        "first_timestamp": getattr(event, 'first_timestamp', None) or getattr(event, 'event_time', None) or getattr(event.metadata, 'creation_timestamp', None),
        "last_timestamp": getattr(event, 'last_timestamp', None) or getattr(event, 'event_time', None) or getattr(series, 'last_observed_time', None),
        "count": getattr(event, 'count', None) or getattr(series, 'count', None) or 1,
        "object_name": involved.name if involved else None,
        "object_kind": involved.kind if involved else None,
        "namespace": involved.namespace if involved else None,
    }

@router.get("/resources/{context_name}/events/namespace/{namespace}/all")
async def get_namespace_events(context_name: str, namespace: str):
    try:
        client = await cluster_manager.get_client(context_name)
        v1, custom = CoreV1Api(client), CustomObjectsApi(client)
        core_result, modern_result = await asyncio.gather(
            collect_all_pages(lambda token: v1.list_namespaced_event(namespace, limit=500, _continue=token)),
            collect_all_pages(lambda token: custom.list_namespaced_custom_object('events.k8s.io', 'v1', namespace, 'events', limit=500, _continue=token)),
            return_exceptions=True,
        )
        deduplicated = {}
        for result in (core_result, modern_result):
            if isinstance(result, Exception):
                continue
            for event in result:
                serialized = serialize_event(event)
                key = (serialized['namespace'], serialized['object_kind'], serialized['object_name'], serialized['type'], serialized['reason'], serialized['message'])
                previous = deduplicated.get(key)
                if not previous or str(serialized.get('last_timestamp') or '') > str(previous.get('last_timestamp') or ''):
                    deduplicated[key] = serialized
        return {"items": sorted(deduplicated.values(), key=lambda event: str(event.get('last_timestamp') or event.get('first_timestamp') or ''), reverse=True)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/resources/{context_name}/pods/node/{node_name}")
async def get_pods_by_node(context_name: str, node_name: str):
    try:
        client = await cluster_manager.get_client(context_name)
        v1 = CoreV1Api(client)
        field_selector = f"spec.nodeName={node_name}"
        pods = await v1.list_pod_for_all_namespaces(field_selector=field_selector)
        return {"items": [{"name": p.metadata.name, "namespace": p.metadata.namespace, "status": p.status.phase, "ip": p.status.pod_ip, "containers": [container.name for container in (p.spec.containers or [])], "creation_timestamp": p.metadata.creation_timestamp} for p in pods.items]}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/resources/{context_name}/pods/selector/{namespace}")
async def get_pods_by_selector(context_name: str, namespace: str, label_selector: str):
    try:
        client = await cluster_manager.get_client(context_name)
        v1 = CoreV1Api(client)
        pods = await v1.list_namespaced_pod(namespace, label_selector=label_selector)
        return {"items": [{"name": p.metadata.name, "namespace": p.metadata.namespace, "status": p.status.phase, "ip": p.status.pod_ip, "containers": [container.name for container in (p.spec.containers or [])], "creation_timestamp": p.metadata.creation_timestamp} for p in pods.items]}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/resources/{context_name}/pods/watch")
async def watch_pods(request: Request, context_name: str, namespace: str = None):
    client = await cluster_manager.get_client(context_name)
    v1 = CoreV1Api(client)
    async def event_generator():
        w = Watch()
        func = v1.list_namespaced_pod if namespace else v1.list_pod_for_all_namespaces
        args = [namespace] if namespace else []
        async for event in w.stream(func, *args):
            if await request.is_disconnected(): break
            p = event['object']
            data = {"type": event['type'], "object": {"name": p.metadata.name, "namespace": p.metadata.namespace, "status": p.status.phase, "ip": p.status.pod_ip, "node": p.spec.node_name}}
            yield json.dumps(data)
    return EventSourceResponse(event_generator())

@router.get("/resources/{context_name}/pods/{namespace}/{pod_name}")
async def get_pod_details(context_name: str, namespace: str, pod_name: str):
    try:
        client = await cluster_manager.get_client(context_name)
        v1 = CoreV1Api(client)
        pod = await v1.read_namespaced_pod(pod_name, namespace)
        return {
            "metadata": {"name": pod.metadata.name, "namespace": pod.metadata.namespace, "labels": pod.metadata.labels, "creation_timestamp": pod.metadata.creation_timestamp},
            "spec": {
                "node_name": pod.spec.node_name,
                "containers": [{"name": c.name, "image": c.image, "ports": [p.to_dict() for p in c.ports] if c.ports else []} for c in pod.spec.containers]
            },
            "status": {
                "phase": pod.status.phase, "pod_ip": pod.status.pod_ip, "host_ip": pod.status.host_ip,
                "container_statuses": [{"name": s.name, "ready": s.ready, "restart_count": s.restart_count, "state": s.state.to_dict(), "image": s.image} for s in pod.status.container_statuses] if pod.status.container_statuses else []
            }
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/resources/{context_name}/statefulsets")
async def get_statefulsets(context_name: str, namespace: str = None, limit: int = Query(100, ge=1, le=500), continue_token: Optional[str] = Query(None, alias="continue")):
    try:
        client = await cluster_manager.get_client(context_name)
        apps_v1 = AppsV1Api(client)
        if namespace:
            items = await apps_v1.list_namespaced_stateful_set(namespace, limit=limit, _continue=continue_token)
        else:
            items = await apps_v1.list_stateful_set_for_all_namespaces(limit=limit, _continue=continue_token)
        restart_counts = await paged_workload_restart_counts(CoreV1Api(client), items.items)
        return {"items": [{"name": i.metadata.name, "namespace": i.metadata.namespace, "replicas": i.spec.replicas if i.spec.replicas is not None else 1, "ready_replicas": i.status.ready_replicas or 0, "restart_count": restart_counts.get((i.metadata.namespace, i.metadata.name), 0), "creation_timestamp": i.metadata.creation_timestamp} for i in items.items], **page_metadata(items, len(items.items))}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/resources/{context_name}/daemonsets")
async def get_daemonsets(context_name: str, namespace: str = None, limit: int = Query(100, ge=1, le=500), continue_token: Optional[str] = Query(None, alias="continue")):
    try:
        client = await cluster_manager.get_client(context_name)
        apps_v1 = AppsV1Api(client)
        if namespace:
            items = await apps_v1.list_namespaced_daemon_set(namespace, limit=limit, _continue=continue_token)
        else:
            items = await apps_v1.list_daemon_set_for_all_namespaces(limit=limit, _continue=continue_token)
        return {"items": [{"name": i.metadata.name, "namespace": i.metadata.namespace, "desired": i.status.desired_number_scheduled if i.status.desired_number_scheduled is not None else 0, "ready": i.status.number_ready if i.status.number_ready is not None else 0, "creation_timestamp": i.metadata.creation_timestamp} for i in items.items], **page_metadata(items, len(items.items))}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/resources/{context_name}/cronjobs")
async def get_cronjobs(context_name: str, namespace: str = None, limit: int = Query(100, ge=1, le=500), continue_token: Optional[str] = Query(None, alias="continue")):
    try:
        client = await cluster_manager.get_client(context_name)
        batch = BatchV1Api(client)
        if namespace:
            items = await batch.list_namespaced_cron_job(namespace, limit=limit, _continue=continue_token)
        else:
            items = await batch.list_cron_job_for_all_namespaces(limit=limit, _continue=continue_token)
        return {"items": [{"name": i.metadata.name, "namespace": i.metadata.namespace, "schedule": i.spec.schedule, "last_schedule": i.status.last_schedule_time, "active": len(i.status.active) if i.status.active else 0, "creation_timestamp": i.metadata.creation_timestamp} for i in items.items], **page_metadata(items, len(items.items))}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/resources/{context_name}/cronjobs/{namespace}/{name}/run")
async def run_cronjob(context_name: str, namespace: str, name: str):
    try:
        client = await cluster_manager.get_client(context_name)
        batch = BatchV1Api(client)
        cronjob = await batch.read_namespaced_cron_job(name, namespace)
        template = client.sanitize_for_serialization(cronjob.spec.job_template)
        template.setdefault("metadata", {}).setdefault("labels", {})["cronjob.kubernetes.io/instantiate"] = "manual"
        job_name = f"{name[:45]}-manual-{int(time.time())}"
        job = {"apiVersion": "batch/v1", "kind": "Job", "metadata": {"name": job_name, "namespace": namespace, "ownerReferences": []}, "spec": template.get("spec", {})}
        created = await batch.create_namespaced_job(namespace, job)
        return {"status": "ok", "job": created.metadata.name}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/resources/{context_name}/metrics/{resource_type}")
async def get_metrics(context_name: str, resource_type: str, namespace: str = None, name: str = None):
    try:
        client = await cluster_manager.get_client(context_name)
        custom_api = CustomObjectsApi(client)
        
        # Check for custom metrics server settings
        metrics_source = cluster_manager.get_cluster_setting(context_name, "metrics_source", "standard")
        custom_endpoint = cluster_manager.get_cluster_setting(context_name, "custom_metrics_endpoint")
        extra_labels = cluster_manager.get_cluster_setting(context_name, "metrics_labels", {})

        # Standard K8s Metrics API
        if metrics_source == "standard" or not custom_endpoint:
            try:
                if resource_type == 'pods':
                    if namespace:
                        if name:
                            data = await custom_api.get_namespaced_custom_object("metrics.k8s.io", "v1beta1", namespace, "pods", name)
                            return {"items": [data]}
                        data = await custom_api.list_namespaced_custom_object("metrics.k8s.io", "v1beta1", namespace, "pods")
                    else:
                        data = await custom_api.list_cluster_custom_object("metrics.k8s.io", "v1beta1", "pods")
                    return data
                elif resource_type == 'nodes':
                    if name:
                        data = await custom_api.get_cluster_custom_object("metrics.k8s.io", "v1beta1", "nodes", name)
                        return {"items": [data]}
                    data = await custom_api.list_cluster_custom_object("metrics.k8s.io", "v1beta1", "nodes")
                    return data
            except Exception as e:
                return {"items": [], "error": f"Metrics API not available: {e}"}
        
        # Custom Metrics Server (Best effort mock implementation)
        # In a real scenario, this would query Prometheus or the custom endpoint
        return {"items": [], "warning": "Custom metrics server integration not fully implemented"}

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/resources/{context_name}/{resource_type}/{namespace}/{name}")
async def delete_resource(context_name: str, resource_type: str, namespace: str, name: str, dry_run: bool = False):
    try:
        client = await cluster_manager.get_client(context_name)
        
        # normalize namespace
        target_namespace = namespace
        if namespace in ["none", "undefined", "null", "all"]:
            target_namespace = None
        delete_options = {"dry_run": "All"} if dry_run else {}

        if resource_type == "pods":
            v1 = CoreV1Api(client)
            await v1.delete_namespaced_pod(name, target_namespace, **delete_options)
        elif resource_type == "deployments":
            apps = AppsV1Api(client)
            await apps.delete_namespaced_deployment(name, target_namespace, **delete_options)
        elif resource_type == "statefulsets":
            apps = AppsV1Api(client)
            await apps.delete_namespaced_stateful_set(name, target_namespace, **delete_options)
        elif resource_type == "daemonsets":
            apps = AppsV1Api(client)
            await apps.delete_namespaced_daemon_set(name, target_namespace, **delete_options)
        elif resource_type in ["replicasets", "other_replicasets"]:
            apps = AppsV1Api(client)
            await apps.delete_namespaced_replica_set(name, target_namespace, **delete_options)
        elif resource_type in ["jobs", "other_jobs"]:
            batch = BatchV1Api(client)
            await batch.delete_namespaced_job(name, target_namespace, propagation_policy="Background", **delete_options)
        elif resource_type == "cronjobs":
            batch = BatchV1Api(client)
            await batch.delete_namespaced_cron_job(name, target_namespace, **delete_options)
        elif resource_type in ["services", "other_services"]:
            v1 = CoreV1Api(client)
            await v1.delete_namespaced_service(name, target_namespace, **delete_options)
        elif resource_type in ["ingresses", "other_ingresses"]:
            net = NetworkingV1Api(client)
            await net.delete_namespaced_ingress(name, target_namespace, **delete_options)
        elif resource_type == "configmaps":
            v1 = CoreV1Api(client)
            await v1.delete_namespaced_config_map(name, target_namespace, **delete_options)
        elif resource_type == "secrets":
            v1 = CoreV1Api(client)
            await v1.delete_namespaced_secret(name, target_namespace, **delete_options)
        elif resource_type == "pvcs":
            v1 = CoreV1Api(client)
            await v1.delete_namespaced_persistent_volume_claim(name, target_namespace, **delete_options)
        elif resource_type == "persistentvolumes":
            v1 = CoreV1Api(client)
            await v1.delete_persistent_volume(name, **delete_options)
        elif resource_type == "namespaces":
            v1 = CoreV1Api(client)
            await v1.delete_namespace(name, **delete_options)
        elif resource_type == "nodes":
            v1 = CoreV1Api(client)
            await v1.delete_node(name, **delete_options)
        elif resource_type.startswith("custom_"):
            custom = CustomObjectsApi(client)
            parts = resource_type.split("_")
            if len(parts) >= 4:
                group = parts[1]
                version = parts[2]
                plural = "_".join(parts[3:])
                if target_namespace:
                    await custom.delete_namespaced_custom_object(group, version, target_namespace, plural, name)
                else:
                    await custom.delete_cluster_custom_object(group, version, plural, name)
            else:
                raise HTTPException(status_code=400, detail=f"Invalid custom resource type format: {resource_type}")
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported resource type for deletion: {resource_type}")

        return {"status": "dry-run-passed" if dry_run else "ok", "dry_run": dry_run}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

from datetime import datetime
@router.post("/resources/{context_name}/deployments/{namespace}/{name}/redeploy")
async def redeploy_deployment(context_name: str, namespace: str, name: str):
    try:
        client = await cluster_manager.get_client(context_name)
        apps = AppsV1Api(client)
        dep = await apps.read_namespaced_deployment(name, namespace)
        
        restarted_at = datetime.utcnow().isoformat() + "Z"
        patch_body = {
            "spec": {
                "template": {
                    "metadata": {
                        "annotations": {
                            "kubectl.kubernetes.io/restartedAt": restarted_at
                        }
                    }
                }
            }
        }
        await apps.patch_namespaced_deployment(name, namespace, patch_body)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/resources/{context_name}/deployments/{namespace}/{name}/scale")
async def scale_deployment(context_name: str, namespace: str, name: str, replicas: int):
    if replicas < 0:
        raise HTTPException(status_code=400, detail="Replica count cannot be negative")
    try:
        client = await cluster_manager.get_client(context_name)
        await AppsV1Api(client).patch_namespaced_deployment_scale(
            name,
            namespace,
            {"spec": {"replicas": replicas}},
        )
        return {"status": "ok", "replicas": replicas}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/resources/{context_name}/services")
async def get_services(context_name: str, namespace: str = None, limit: int = Query(100, ge=1, le=500), continue_token: Optional[str] = Query(None, alias="continue")):
    try:
        client = await cluster_manager.get_client(context_name)
        v1 = CoreV1Api(client)
        if namespace:
            items = await v1.list_namespaced_service(namespace, limit=limit, _continue=continue_token)
        else:
            items = await v1.list_service_for_all_namespaces(limit=limit, _continue=continue_token)
        return {
            "items": [
                {
                    "name": i.metadata.name,
                    "namespace": i.metadata.namespace,
                    "type": i.spec.type,
                    "cluster_ip": i.spec.cluster_ip,
                    "ports": [f"{p.port}:{p.target_port}/{p.protocol}" for p in i.spec.ports] if i.spec.ports else [],
                    "creation_timestamp": i.metadata.creation_timestamp
                } for i in items.items
            ], **page_metadata(items, len(items.items))
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/resources/{context_name}/ingresses")
async def get_ingresses(context_name: str, namespace: str = None, limit: int = Query(100, ge=1, le=500), continue_token: Optional[str] = Query(None, alias="continue")):
    try:
        client = await cluster_manager.get_client(context_name)
        networking_v1 = NetworkingV1Api(client)
        if namespace:
            items = await networking_v1.list_namespaced_ingress(namespace, limit=limit, _continue=continue_token)
        else:
            items = await networking_v1.list_ingress_for_all_namespaces(limit=limit, _continue=continue_token)
        return {
            "items": [
                {
                    "name": i.metadata.name,
                    "namespace": i.metadata.namespace,
                    "hosts": [rule.host for rule in i.spec.rules] if i.spec.rules else [],
                    "creation_timestamp": i.metadata.creation_timestamp
                } for i in items.items
            ], **page_metadata(items, len(items.items))
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/resources/{context_name}/replicasets")
async def get_replicasets(context_name: str, namespace: str = None, limit: int = Query(100, ge=1, le=500), continue_token: Optional[str] = Query(None, alias="continue")):
    try:
        client = await cluster_manager.get_client(context_name)
        apps_v1 = AppsV1Api(client)
        if namespace:
            items = await apps_v1.list_namespaced_replica_set(namespace, limit=limit, _continue=continue_token)
        else:
            items = await apps_v1.list_replica_set_for_all_namespaces(limit=limit, _continue=continue_token)
        return {
            "items": [
                {
                    "name": i.metadata.name,
                    "namespace": i.metadata.namespace,
                    "replicas": i.spec.replicas if i.spec.replicas is not None else 1,
                    "ready_replicas": i.status.ready_replicas or 0,
                    "creation_timestamp": i.metadata.creation_timestamp
                } for i in items.items
            ], **page_metadata(items, len(items.items))
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/resources/{context_name}/jobs")
async def get_jobs(context_name: str, namespace: str = None, limit: int = Query(100, ge=1, le=500), continue_token: Optional[str] = Query(None, alias="continue")):
    try:
        client = await cluster_manager.get_client(context_name)
        batch_v1 = BatchV1Api(client)
        if namespace:
            items = await batch_v1.list_namespaced_job(namespace, limit=limit, _continue=continue_token)
        else:
            items = await batch_v1.list_job_for_all_namespaces(limit=limit, _continue=continue_token)
        return {
            "items": [
                {
                    "name": i.metadata.name,
                    "namespace": i.metadata.namespace,
                    "completions": i.spec.completions if i.spec.completions is not None else 1,
                    "active": i.status.active or 0,
                    "succeeded": i.status.succeeded or 0,
                    "failed": i.status.failed or 0,
                    "creation_timestamp": i.metadata.creation_timestamp
                } for i in items.items
            ], **page_metadata(items, len(items.items))
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/resources/{context_name}/services/{namespace}/{name}")
async def get_service_details(context_name: str, namespace: str, name: str):
    try:
        client = await cluster_manager.get_client(context_name)
        v1 = CoreV1Api(client)
        obj = await v1.read_namespaced_service(name, namespace)
        
        # Resolve selecting pods
        pods_list = []
        if obj.spec.selector:
            selector_str = ",".join(f"{k}={v}" for k, v in obj.spec.selector.items())
            pods = await v1.list_namespaced_pod(namespace, label_selector=selector_str)
            pods_list = [
                {
                    "name": p.metadata.name,
                    "namespace": p.metadata.namespace,
                    "status": p.status.phase,
                    "ip": p.status.pod_ip
                } for p in pods.items
            ]
            
        return {
            "metadata": {"name": obj.metadata.name, "namespace": obj.metadata.namespace, "labels": obj.metadata.labels, "creation_timestamp": obj.metadata.creation_timestamp},
            "spec": {
                "type": obj.spec.type,
                "cluster_ip": obj.spec.cluster_ip,
                "ports": [p.to_dict() for p in obj.spec.ports] if obj.spec.ports else [],
                "selector": obj.spec.selector
            },
            "status": {
                "load_balancer": obj.status.load_balancer.to_dict() if obj.status.load_balancer else None
            },
            "pods": pods_list
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/resources/{context_name}/ingresses/{namespace}/{name}")
async def get_ingress_details(context_name: str, namespace: str, name: str):
    try:
        client = await cluster_manager.get_client(context_name)
        v1 = CoreV1Api(client)
        networking_v1 = NetworkingV1Api(client)
        obj = await networking_v1.read_namespaced_ingress(name, namespace)
        
        # Resolve backend services and their selecting pods
        service_names = set()
        if obj.spec.rules:
            for rule in obj.spec.rules:
                if rule.http and rule.http.paths:
                    for path in rule.http.paths:
                        svc = path.backend.service
                        if svc and svc.name:
                            service_names.add(svc.name)
        if obj.spec.default_backend and obj.spec.default_backend.service and obj.spec.default_backend.service.name:
            service_names.add(obj.spec.default_backend.service.name)
            
        pods_dict = {}
        for svc_name in service_names:
            try:
                svc = await v1.read_namespaced_service(svc_name, namespace)
                if svc.spec.selector:
                    selector_str = ",".join(f"{k}={v}" for k, v in svc.spec.selector.items())
                    pods = await v1.list_namespaced_pod(namespace, label_selector=selector_str)
                    for p in pods.items:
                        pods_dict[p.metadata.name] = {
                            "name": p.metadata.name,
                            "namespace": p.metadata.namespace,
                            "status": p.status.phase,
                            "ip": p.status.pod_ip,
                            "service": svc_name
                        }
            except Exception:
                pass
                
        return {
            "metadata": {"name": obj.metadata.name, "namespace": obj.metadata.namespace, "labels": obj.metadata.labels, "creation_timestamp": obj.metadata.creation_timestamp},
            "spec": {
                "rules": [{"host": r.host, "http": {"paths": [{"path": p.path, "path_type": p.path_type, "backend": p.backend.to_dict()} for p in r.http.paths]}} for r in obj.spec.rules] if obj.spec.rules else []
            },
            "status": {
                "load_balancer": obj.status.load_balancer.to_dict() if obj.status.load_balancer else None
            },
            "pods": list(pods_dict.values())
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/resources/{context_name}/replicasets/{namespace}/{name}")
async def get_replicaset_details(context_name: str, namespace: str, name: str):
    try:
        client = await cluster_manager.get_client(context_name)
        apps_v1 = AppsV1Api(client)
        obj = await apps_v1.read_namespaced_replica_set(name, namespace)
        return {
            "metadata": {"name": obj.metadata.name, "namespace": obj.metadata.namespace, "labels": obj.metadata.labels, "creation_timestamp": obj.metadata.creation_timestamp},
            "spec": {
                "replicas": obj.spec.replicas if obj.spec.replicas is not None else 1,
                "selector": obj.spec.selector.match_labels if obj.spec.selector else None
            },
            "status": {
                "replicas": obj.status.replicas,
                "ready_replicas": obj.status.ready_replicas or 0,
                "fully_labeled_replicas": obj.status.fully_labeled_replicas or 0,
                "available_replicas": obj.status.available_replicas or 0
            }
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/resources/{context_name}/jobs/{namespace}/{name}")
async def get_job_details(context_name: str, namespace: str, name: str):
    try:
        client = await cluster_manager.get_client(context_name)
        batch_v1 = BatchV1Api(client)
        obj = await batch_v1.read_namespaced_job(name, namespace)
        return {
            "metadata": {"name": obj.metadata.name, "namespace": obj.metadata.namespace, "labels": obj.metadata.labels, "creation_timestamp": obj.metadata.creation_timestamp},
            "spec": {
                "completions": obj.spec.completions,
                "parallelism": obj.spec.parallelism,
                "backoff_limit": obj.spec.backoff_limit,
                "selector": obj.spec.selector.match_labels if obj.spec.selector else None
            },
            "status": {
                "active": obj.status.active or 0,
                "succeeded": obj.status.succeeded or 0,
                "failed": obj.status.failed or 0,
                "start_time": obj.status.start_time,
                "completion_time": obj.status.completion_time
            }
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/resources/{context_name}/custom/{group}/{version}/{plural}/{name}")
async def get_custom_details_cluster(context_name: str, group: str, version: str, plural: str, name: str):
    try:
        client = await cluster_manager.get_client(context_name)
        custom = CustomObjectsApi(client)
        obj = await custom.get_cluster_custom_object(group, version, plural, name)
        return {
            "metadata": {"name": obj['metadata']['name'], "labels": obj['metadata'].get('labels', {}), "creation_timestamp": obj['metadata']['creationTimestamp']},
            "spec": obj.get('spec', {}),
            "status": obj.get('status', {})
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/resources/{context_name}/custom/{group}/{version}/{plural}/{namespace}/{name}")
async def get_custom_details_namespaced(context_name: str, group: str, version: str, plural: str, namespace: str, name: str):
    try:
        client = await cluster_manager.get_client(context_name)
        custom = CustomObjectsApi(client)
        obj = await custom.get_namespaced_custom_object(group, version, namespace, plural, name)
        return {
            "metadata": {"name": obj['metadata']['name'], "namespace": obj['metadata'].get('namespace'), "labels": obj['metadata'].get('labels', {}), "creation_timestamp": obj['metadata']['creationTimestamp']},
            "spec": obj.get('spec', {}),
            "status": obj.get('status', {})
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
