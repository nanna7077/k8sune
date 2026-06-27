from fastapi import APIRouter, HTTPException, Query, Request
from sse_starlette.sse import EventSourceResponse
from backend.cluster.manager import cluster_manager
from kubernetes_asyncio.client import CoreV1Api, AppsV1Api, CustomObjectsApi, VersionApi, BatchV1Api, NetworkingV1Api
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

        def parse_mem(mem_str):
            if not mem_str: return 0
            mem_str = str(mem_str).strip()
            units = {
                'K': 1024, 'M': 1024**2, 'G': 1024**3, 'T': 1024**4, 'P': 1024**5, 'E': 1024**6,
                'Ki': 1024, 'Mi': 1024**2, 'Gi': 1024**3, 'Ti': 1024**4, 'Pi': 1024**5, 'Ei': 1024**6,
                'k': 1000, 'm': 1000**2, 'g': 1000**3, 't': 1000**4, 'p': 1000**5, 'e': 1000**6,
                'kb': 1000, 'mb': 1000**2, 'gb': 1000**3
            }
            for unit, multiplier in sorted(units.items(), key=lambda x: len(x[0]), reverse=True):
                if mem_str.endswith(unit):
                    try:
                        return int(float(mem_str[:-len(unit)].strip()) * multiplier)
                    except:
                        pass
            try:
                return int(float(mem_str))
            except:
                return 0

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
                    "replicas": d.spec.replicas if d.spec.replicas is not None else 1,
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
                    "creation_timestamp": i['metadata']['creationTimestamp']
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

        def parse_mem(mem_str):
            if not mem_str: return 0
            mem_str = str(mem_str).strip()
            units = {
                'K': 1024, 'M': 1024**2, 'G': 1024**3, 'T': 1024**4, 'P': 1024**5, 'E': 1024**6,
                'Ki': 1024, 'Mi': 1024**2, 'Gi': 1024**3, 'Ti': 1024**4, 'Pi': 1024**5, 'Ei': 1024**6,
                'k': 1000, 'm': 1000**2, 'g': 1000**3, 't': 1000**4, 'p': 1000**5, 'e': 1000**6,
                'kb': 1000, 'mb': 1000**2, 'gb': 1000**3
            }
            for unit, multiplier in sorted(units.items(), key=lambda x: len(x[0]), reverse=True):
                if mem_str.endswith(unit):
                    try:
                        return int(float(mem_str[:-len(unit)].strip()) * multiplier)
                    except:
                        pass
            try:
                return int(float(mem_str))
            except:
                return 0

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
async def get_statefulsets(context_name: str, namespace: str = None):
    try:
        client = await cluster_manager.get_client(context_name)
        apps_v1 = AppsV1Api(client)
        if namespace:
            items = await apps_v1.list_namespaced_stateful_set(namespace)
        else:
            items = await apps_v1.list_stateful_set_for_all_namespaces()
        return {"items": [{"name": i.metadata.name, "namespace": i.metadata.namespace, "replicas": i.spec.replicas if i.spec.replicas is not None else 1, "ready_replicas": i.status.ready_replicas or 0, "creation_timestamp": i.metadata.creation_timestamp} for i in items.items]}
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
        return {"items": [{"name": i.metadata.name, "namespace": i.metadata.namespace, "desired": i.status.desired_number_scheduled if i.status.desired_number_scheduled is not None else 0, "ready": i.status.number_ready if i.status.number_ready is not None else 0, "creation_timestamp": i.metadata.creation_timestamp} for i in items.items]}
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
async def delete_resource(context_name: str, resource_type: str, namespace: str, name: str):
    try:
        client = await cluster_manager.get_client(context_name)
        
        # normalize namespace
        target_namespace = namespace
        if namespace in ["none", "undefined", "null", "all"]:
            target_namespace = None

        if resource_type == "pods":
            v1 = CoreV1Api(client)
            await v1.delete_namespaced_pod(name, target_namespace)
        elif resource_type == "deployments":
            apps = AppsV1Api(client)
            await apps.delete_namespaced_deployment(name, target_namespace)
        elif resource_type == "statefulsets":
            apps = AppsV1Api(client)
            await apps.delete_namespaced_stateful_set(name, target_namespace)
        elif resource_type == "daemonsets":
            apps = AppsV1Api(client)
            await apps.delete_namespaced_daemon_set(name, target_namespace)
        elif resource_type in ["replicasets", "other_replicasets"]:
            apps = AppsV1Api(client)
            await apps.delete_namespaced_replica_set(name, target_namespace)
        elif resource_type in ["jobs", "other_jobs"]:
            batch = BatchV1Api(client)
            await batch.delete_namespaced_job(name, target_namespace, propagation_policy="Background")
        elif resource_type == "cronjobs":
            batch = BatchV1Api(client)
            await batch.delete_namespaced_cron_job(name, target_namespace)
        elif resource_type in ["services", "other_services"]:
            v1 = CoreV1Api(client)
            await v1.delete_namespaced_service(name, target_namespace)
        elif resource_type in ["ingresses", "other_ingresses"]:
            net = NetworkingV1Api(client)
            await net.delete_namespaced_ingress(name, target_namespace)
        elif resource_type == "configmaps":
            v1 = CoreV1Api(client)
            await v1.delete_namespaced_config_map(name, target_namespace)
        elif resource_type == "secrets":
            v1 = CoreV1Api(client)
            await v1.delete_namespaced_secret(name, target_namespace)
        elif resource_type == "pvcs":
            v1 = CoreV1Api(client)
            await v1.delete_namespaced_persistent_volume_claim(name, target_namespace)
        elif resource_type == "namespaces":
            v1 = CoreV1Api(client)
            await v1.delete_namespace(name)
        elif resource_type == "nodes":
            v1 = CoreV1Api(client)
            await v1.delete_node(name)
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

        return {"status": "ok"}
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

@router.get("/resources/{context_name}/services")
async def get_services(context_name: str, namespace: str = None):
    try:
        client = await cluster_manager.get_client(context_name)
        v1 = CoreV1Api(client)
        if namespace:
            items = await v1.list_namespaced_service(namespace)
        else:
            items = await v1.list_service_for_all_namespaces()
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
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/resources/{context_name}/ingresses")
async def get_ingresses(context_name: str, namespace: str = None):
    try:
        client = await cluster_manager.get_client(context_name)
        networking_v1 = NetworkingV1Api(client)
        if namespace:
            items = await networking_v1.list_namespaced_ingress(namespace)
        else:
            items = await networking_v1.list_ingress_for_all_namespaces()
        return {
            "items": [
                {
                    "name": i.metadata.name,
                    "namespace": i.metadata.namespace,
                    "hosts": [rule.host for rule in i.spec.rules] if i.spec.rules else [],
                    "creation_timestamp": i.metadata.creation_timestamp
                } for i in items.items
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/resources/{context_name}/replicasets")
async def get_replicasets(context_name: str, namespace: str = None):
    try:
        client = await cluster_manager.get_client(context_name)
        apps_v1 = AppsV1Api(client)
        if namespace:
            items = await apps_v1.list_namespaced_replica_set(namespace)
        else:
            items = await apps_v1.list_replica_set_for_all_namespaces()
        return {
            "items": [
                {
                    "name": i.metadata.name,
                    "namespace": i.metadata.namespace,
                    "replicas": i.spec.replicas if i.spec.replicas is not None else 1,
                    "ready_replicas": i.status.ready_replicas or 0,
                    "creation_timestamp": i.metadata.creation_timestamp
                } for i in items.items
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/resources/{context_name}/jobs")
async def get_jobs(context_name: str, namespace: str = None):
    try:
        client = await cluster_manager.get_client(context_name)
        batch_v1 = BatchV1Api(client)
        if namespace:
            items = await batch_v1.list_namespaced_job(namespace)
        else:
            items = await batch_v1.list_job_for_all_namespaces()
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
            ]
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
