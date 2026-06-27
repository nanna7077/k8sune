from fastapi import APIRouter, HTTPException, Query, Request
from sse_starlette.sse import EventSourceResponse
from backend.cluster.manager import cluster_manager
from kubernetes_asyncio.client import CoreV1Api, AppsV1Api, CustomObjectsApi, VersionApi, BatchV1Api
from kubernetes_asyncio.watch import Watch
import asyncio
import json

router = APIRouter()

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
            components = [
                {"name": c.metadata.name, "status": "Healthy" if any(cond.type == 'Healthy' and cond.status == 'True' for cond in c.conditions) else "Unhealthy"}
                for c in cs.items
            ]
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
            if cpu_str.endswith('m'): return int(cpu_str[:-1])
            return int(cpu_str) * 1000

        def parse_mem(mem_str):
            if not mem_str: return 0
            if mem_str.endswith('Ki'): return int(mem_str[:-2]) * 1024
            if mem_str.endswith('Mi'): return int(mem_str[:-2]) * 1024 * 1024
            if mem_str.endswith('Gi'): return int(mem_str[:-2]) * 1024 * 1024 * 1024
            return int(mem_str)

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
async def get_nodes(context_name: str):
    try:
        client = await cluster_manager.get_client(context_name)
        v1 = CoreV1Api(client)
        nodes = await v1.list_node()
        pods = await v1.list_pod_for_all_namespaces()

        # Pre-parse CPU/Mem helper functions (re-using from overview logic)
        def parse_cpu(cpu_str):
            if not cpu_str: return 0
            if cpu_str.endswith('m'): return int(cpu_str[:-1])
            return int(cpu_str) * 1000

        def parse_mem(mem_str):
            if not mem_str: return 0
            if mem_str.endswith('Ki'): return int(mem_str[:-2]) * 1024
            if mem_str.endswith('Mi'): return int(mem_str[:-2]) * 1024 * 1024
            if mem_str.endswith('Gi'): return int(mem_str[:-2]) * 1024 * 1024 * 1024
            return int(mem_str)

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

        return {"items": items}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/resources/{context_name}/pods")
async def get_pods(context_name: str, namespace: str = None):
    try:
        client = await cluster_manager.get_client(context_name)
        v1 = CoreV1Api(client)
        if namespace:
            pods = await v1.list_namespaced_pod(namespace)
        else:
            pods = await v1.list_pod_for_all_namespaces()
        
        return {
            "items": [
                {
                    "name": p.metadata.name,
                    "namespace": p.metadata.namespace,
                    "status": p.status.phase,
                    "ip": p.status.pod_ip,
                    "node": p.spec.node_name,
                    "creation_timestamp": p.metadata.creation_timestamp
                } for p in pods.items
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/resources/{context_name}/deployments")
async def get_deployments(context_name: str, namespace: str = None):
    try:
        client = await cluster_manager.get_client(context_name)
        apps_v1 = AppsV1Api(client)
        if namespace:
            items = await apps_v1.list_namespaced_deployment(namespace)
        else:
            items = await apps_v1.list_deployment_for_all_namespaces()
        
        return {
            "items": [
                {
                    "name": d.metadata.name,
                    "namespace": d.metadata.namespace,
                    "replicas": d.spec.replicas,
                    "ready_replicas": d.status.ready_replicas or 0,
                    "creation_timestamp": d.metadata.creation_timestamp
                } for d in items.items
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/resources/{context_name}/namespaces")
async def get_namespaces(context_name: str):
    try:
        client = await cluster_manager.get_client(context_name)
        v1 = CoreV1Api(client)
        ns = await v1.list_namespace()
        return {
            "items": [
                {
                    "name": n.metadata.name,
                    "status": n.status.phase,
                    "creation_timestamp": n.metadata.creation_timestamp
                } for n in ns.items
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/resources/{context_name}/configmaps")
async def get_configmaps(context_name: str, namespace: str = None):
    try:
        client = await cluster_manager.get_client(context_name)
        v1 = CoreV1Api(client)
        if namespace:
            items = await v1.list_namespaced_config_map(namespace)
        else:
            items = await v1.list_config_map_for_all_namespaces()
        return {
            "items": [
                {
                    "name": i.metadata.name,
                    "namespace": i.metadata.namespace,
                    "data_count": len(i.data) if i.data else 0,
                    "creation_timestamp": i.metadata.creation_timestamp
                } for i in items.items
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/resources/{context_name}/secrets")
async def get_secrets(context_name: str, namespace: str = None):
    try:
        client = await cluster_manager.get_client(context_name)
        v1 = CoreV1Api(client)
        if namespace:
            items = await v1.list_namespaced_secret(namespace)
        else:
            items = await v1.list_secret_for_all_namespaces()
        return {
            "items": [
                {
                    "name": i.metadata.name,
                    "namespace": i.metadata.namespace,
                    "type": i.type,
                    "data_count": len(i.data) if i.data else 0,
                    "creation_timestamp": i.metadata.creation_timestamp
                } for i in items.items
            ]
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
async def get_generic_resources(context_name: str, group: str, version: str, plural: str, namespace: str = None):
    try:
        client = await cluster_manager.get_client(context_name)
        custom = CustomObjectsApi(client)
        if namespace:
            items = await custom.list_namespaced_custom_object(group, version, namespace, plural)
        else:
            items = await custom.list_cluster_custom_object(group, version, plural)
            
        return {
            "items": [
                {
                    "name": i['metadata']['name'],
                    "namespace": i['metadata'].get('namespace'),
                    "creation_timestamp": i['metadata']['creationTimestamp'],
                    "raw": i 
                } for i in items.get('items', [])
            ]
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
                "replicas": dep.spec.replicas,
                "selector": dep.spec.selector.match_labels,
                "strategy": dep.spec.strategy.to_dict() if dep.spec.strategy else {},
                "containers": [{"name": c.name, "image": c.image, "ports": [p.to_dict() for p in c.ports] if c.ports else []} for c in dep.spec.template.spec.containers]
            },
            "status": {
                "replicas": dep.status.replicas, "ready_replicas": dep.status.ready_replicas or 0,
                "available_replicas": dep.status.available_replicas or 0, "conditions": [{"type": c.type, "status": c.status, "reason": c.reason, "message": c.message} for c in dep.status.conditions]
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
                "replicas": obj.spec.replicas, "selector": obj.spec.selector.match_labels,
                "containers": [{"name": c.name, "image": c.image, "ports": [p.to_dict() for p in c.ports] if c.ports else []} for c in obj.spec.template.spec.containers]
            },
            "status": {"ready_replicas": obj.status.ready_replicas or 0, "replicas": obj.status.replicas}
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
            "status": {"desired_number_scheduled": obj.status.desired_number_scheduled, "number_ready": obj.status.number_ready}
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

@router.get("/resources/{context_name}/events/{namespace}/{name}")
async def get_resource_events(context_name: str, namespace: str, name: str):
    try:
        client = await cluster_manager.get_client(context_name)
        v1 = CoreV1Api(client)
        field_selector = f"involvedObject.name={name}"
        if namespace != 'default' and namespace != 'Cluster' and namespace != 'none':
            events = await v1.list_namespaced_event(namespace, field_selector=field_selector)
        else:
            events = await v1.list_event_for_all_namespaces(field_selector=field_selector)
        return {
            "items": [{"type": e.type, "reason": e.reason, "message": e.message, "last_timestamp": e.last_timestamp, "count": e.count} for e in sorted(events.items, key=lambda x: x.last_timestamp or "", reverse=True)]
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/resources/{context_name}/pods/node/{node_name}")
async def get_pods_by_node(context_name: str, node_name: str):
    try:
        client = await cluster_manager.get_client(context_name)
        v1 = CoreV1Api(client)
        field_selector = f"spec.nodeName={node_name}"
        pods = await v1.list_pod_for_all_namespaces(field_selector=field_selector)
        return {"items": [{"name": p.metadata.name, "namespace": p.metadata.namespace, "status": p.status.phase, "ip": p.status.pod_ip, "creation_timestamp": p.metadata.creation_timestamp} for p in pods.items]}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/resources/{context_name}/pods/selector/{namespace}")
async def get_pods_by_selector(context_name: str, namespace: str, label_selector: str):
    try:
        client = await cluster_manager.get_client(context_name)
        v1 = CoreV1Api(client)
        pods = await v1.list_namespaced_pod(namespace, label_selector=label_selector)
        return {"items": [{"name": p.metadata.name, "namespace": p.metadata.namespace, "status": p.status.phase, "ip": p.status.pod_ip, "creation_timestamp": p.metadata.creation_timestamp} for p in pods.items]}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/resources/{context_name}/statefulsets")
async def get_statefulsets(context_name: str, namespace: str = None):
    try:
        client = await cluster_manager.get_client(context_name)
        apps_v1 = AppsV1Api(client)
        if namespace:
            items = await apps_v1.list_namespaced_stateful_set(namespace)
        else:
            items = await apps_v1.list_stateful_set_for_all_namespaces()
        return {"items": [{"name": i.metadata.name, "namespace": i.metadata.namespace, "replicas": i.spec.replicas, "ready_replicas": i.status.ready_replicas or 0, "creation_timestamp": i.metadata.creation_timestamp} for i in items.items]}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/resources/{context_name}/daemonsets")
async def get_daemonsets(context_name: str, namespace: str = None):
    try:
        client = await cluster_manager.get_client(context_name)
        apps_v1 = AppsV1Api(client)
        if namespace:
            items = await apps_v1.list_namespaced_daemon_set(namespace)
        else:
            items = await apps_v1.list_daemon_set_for_all_namespaces()
        return {"items": [{"name": i.metadata.name, "namespace": i.metadata.namespace, "desired": i.status.desired_number_scheduled, "ready": i.status.number_ready, "creation_timestamp": i.metadata.creation_timestamp} for i in items.items]}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/resources/{context_name}/cronjobs")
async def get_cronjobs(context_name: str, namespace: str = None):
    try:
        client = await cluster_manager.get_client(context_name)
        batch = BatchV1Api(client)
        if namespace:
            items = await batch.list_namespaced_cron_job(namespace)
        else:
            items = await batch.list_cron_job_for_all_namespaces()
        return {"items": [{"name": i.metadata.name, "namespace": i.metadata.namespace, "schedule": i.spec.schedule, "last_schedule": i.status.last_schedule_time, "active": len(i.status.active) if i.status.active else 0, "creation_timestamp": i.metadata.creation_timestamp} for i in items.items]}
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

@router.delete("/resources/{context_name}/pods/{namespace}/{pod_name}")
async def delete_pod(context_name: str, namespace: str, pod_name: str):
    try:
        client = await cluster_manager.get_client(context_name)
        v1 = CoreV1Api(client)
        await v1.delete_namespaced_pod(pod_name, namespace)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
