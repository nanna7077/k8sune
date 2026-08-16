from fastapi import APIRouter, HTTPException, Body
from backend.cluster.manager import cluster_manager
from kubernetes_asyncio import client, utils
import yaml
import json

router = APIRouter()


def normalized_type(resource_type: str) -> str:
    """Map dashboard aliases to the Kubernetes resource plural."""
    return {
        "other_services": "services",
        "other_ingresses": "ingresses",
        "other_replicasets": "replicasets",
        "other_jobs": "jobs",
        "pvcs": "persistentvolumeclaims",
    }.get(resource_type, resource_type)


async def read_resource(api_client, resource_type: str, namespace: str, name: str):
    resource_type = normalized_type(resource_type)
    core, apps, batch, networking, rbac = client.CoreV1Api(api_client), client.AppsV1Api(api_client), client.BatchV1Api(api_client), client.NetworkingV1Api(api_client), client.RbacAuthorizationV1Api(api_client)
    namespaced = {
        "pods": (core, "read_namespaced_pod"), "configmaps": (core, "read_namespaced_config_map"),
        "secrets": (core, "read_namespaced_secret"), "persistentvolumeclaims": (core, "read_namespaced_persistent_volume_claim"),
        "services": (core, "read_namespaced_service"), "deployments": (apps, "read_namespaced_deployment"),
        "serviceaccounts": (core, "read_namespaced_service_account"),
        "statefulsets": (apps, "read_namespaced_stateful_set"), "daemonsets": (apps, "read_namespaced_daemon_set"),
        "replicasets": (apps, "read_namespaced_replica_set"), "cronjobs": (batch, "read_namespaced_cron_job"),
        "jobs": (batch, "read_namespaced_job"), "ingresses": (networking, "read_namespaced_ingress"),
        "networkpolicies": (networking, "read_namespaced_network_policy"),
        "roles": (rbac, "read_namespaced_role"), "rolebindings": (rbac, "read_namespaced_role_binding"),
    }
    cluster_scoped = {
        "nodes": (core, "read_node"), "namespaces": (core, "read_namespace"),
        "persistentvolumes": (core, "read_persistent_volume"),
    }
    if resource_type.startswith("custom_"):
        _, group, version, plural = resource_type.split("_", 3)
        custom = client.CustomObjectsApi(api_client)
        return await custom.get_namespaced_custom_object(group, version, namespace, plural, name) if namespace not in ("", "none", "undefined") else await custom.get_cluster_custom_object(group, version, plural, name)
    if resource_type in namespaced:
        api, method = namespaced[resource_type]
        return await getattr(api, method)(name, namespace)
    if resource_type in cluster_scoped:
        api, method = cluster_scoped[resource_type]
        return await getattr(api, method)(name)
    raise HTTPException(status_code=400, detail=f"Unsupported resource type: {resource_type}")


async def patch_resource(api_client, resource_type: str, namespace: str, name: str, body: dict):
    resource_type = normalized_type(resource_type)
    core, apps, batch, networking, rbac = client.CoreV1Api(api_client), client.AppsV1Api(api_client), client.BatchV1Api(api_client), client.NetworkingV1Api(api_client), client.RbacAuthorizationV1Api(api_client)
    namespaced = {
        "pods": (core, "patch_namespaced_pod"), "configmaps": (core, "patch_namespaced_config_map"),
        "secrets": (core, "patch_namespaced_secret"), "persistentvolumeclaims": (core, "patch_namespaced_persistent_volume_claim"),
        "services": (core, "patch_namespaced_service"), "deployments": (apps, "patch_namespaced_deployment"),
        "serviceaccounts": (core, "patch_namespaced_service_account"),
        "statefulsets": (apps, "patch_namespaced_stateful_set"), "daemonsets": (apps, "patch_namespaced_daemon_set"),
        "replicasets": (apps, "patch_namespaced_replica_set"), "cronjobs": (batch, "patch_namespaced_cron_job"),
        "jobs": (batch, "patch_namespaced_job"), "ingresses": (networking, "patch_namespaced_ingress"),
        "networkpolicies": (networking, "patch_namespaced_network_policy"),
        "roles": (rbac, "patch_namespaced_role"), "rolebindings": (rbac, "patch_namespaced_role_binding"),
    }
    cluster_scoped = {"nodes": (core, "patch_node"), "namespaces": (core, "patch_namespace"), "persistentvolumes": (core, "patch_persistent_volume")}
    if resource_type.startswith("custom_"):
        _, group, version, plural = resource_type.split("_", 3)
        custom = client.CustomObjectsApi(api_client)
        if namespace not in ("", "none", "undefined"):
            return await custom.patch_namespaced_custom_object(group, version, namespace, plural, name, body)
        return await custom.patch_cluster_custom_object(group, version, plural, name, body)
    if resource_type in namespaced:
        api, method = namespaced[resource_type]
        return await getattr(api, method)(name, namespace, body)
    if resource_type in cluster_scoped:
        api, method = cluster_scoped[resource_type]
        return await getattr(api, method)(name, body)
    raise HTTPException(status_code=400, detail=f"Unsupported resource type: {resource_type}")

@router.get("/yaml/{context_name}/{resource_type}/{namespace}/{name}")
async def get_resource_yaml(context_name: str, resource_type: str, namespace: str, name: str):
    api_client = await cluster_manager.get_client(context_name)
    
    try:
        resp = await read_resource(api_client, resource_type, namespace, name)

        # Keep an editable manifest focused on desired state, not controller-managed status.
        obj = api_client.sanitize_for_serialization(resp)
        obj.pop("status", None)
        if isinstance(obj.get("metadata"), dict):
            for field in ("managedFields", "resourceVersion", "uid", "creationTimestamp", "generation", "selfLink"):
                obj["metadata"].pop(field, None)
        # Convert to YAML
        return {"yaml": yaml.dump(obj, sort_keys=False)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/yaml/{context_name}/{resource_type}/{namespace}/{name}")
async def apply_resource_yaml(context_name: str, resource_type: str, namespace: str, name: str, yaml_content: str = Body(..., embed=True)):
    api_client = await cluster_manager.get_client(context_name)
    
    try:
        new_obj = yaml.safe_load(yaml_content)
        if not isinstance(new_obj, dict):
            raise HTTPException(status_code=400, detail="The resource YAML must contain an object.")
        
        await patch_resource(api_client, resource_type, namespace, name, new_obj)
            
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/yaml/{context_name}/apply")
async def apply_generic_yaml(
    context_name: str,
    yaml_content: str = Body(..., embed=True),
    namespace: str = Body(default="", embed=True),
):
    """Create one or more Kubernetes resources from YAML.

    A selected namespace is passed as the default scope for namespaced
    resources. A manifest's own `metadata.namespace` remains authoritative.
    """
    api_client = await cluster_manager.get_client(context_name)

    try:
        documents = [document for document in yaml.safe_load_all(yaml_content) if document is not None]
        if not documents:
            raise HTTPException(status_code=400, detail="Add at least one YAML resource.")

        for document in documents:
            if not isinstance(document, dict) or not document.get("apiVersion") or not document.get("kind"):
                raise HTTPException(status_code=400, detail="Each YAML document must include apiVersion and kind.")
            if not isinstance(document.get("metadata"), dict):
                raise HTTPException(status_code=400, detail="Each YAML document must include metadata.")

        for document in documents:
            kwargs = {"namespace": namespace} if namespace else {}
            await utils.create_from_dict(api_client, document, **kwargs)

        return {"status": "ok", "created": len(documents)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
