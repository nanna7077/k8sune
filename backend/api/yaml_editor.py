from fastapi import APIRouter, HTTPException, Body
from backend.cluster.manager import cluster_manager
from kubernetes_asyncio import client, config, utils
import yaml
import json

router = APIRouter()

@router.get("/yaml/{context_name}/{resource_type}/{namespace}/{name}")
async def get_resource_yaml(context_name: str, resource_type: str, namespace: str, name: str):
    api_client = await cluster_manager.get_client(context_name)
    
    try:
        if resource_type == "pods":
            api = client.CoreV1Api(api_client)
            resp = await api.read_namespaced_pod(name, namespace)
        elif resource_type == "configmaps":
            api = client.CoreV1Api(api_client)
            resp = await api.read_namespaced_config_map(name, namespace)
        elif resource_type == "secrets":
            api = client.CoreV1Api(api_client)
            resp = await api.read_namespaced_secret(name, namespace)
        elif resource_type == "persistentvolumeclaims":
            api = client.CoreV1Api(api_client)
            resp = await api.read_namespaced_persistent_volume_claim(name, namespace)
        elif resource_type == "deployments":
            api = client.AppsV1Api(api_client)
            resp = await api.read_namespaced_deployment(name, namespace)
        elif resource_type == "statefulsets":
            api = client.AppsV1Api(api_client)
            resp = await api.read_namespaced_stateful_set(name, namespace)
        elif resource_type == "daemonsets":
            api = client.AppsV1Api(api_client)
            resp = await api.read_namespaced_daemon_set(name, namespace)
        elif resource_type == "cronjobs":
            api = client.BatchV1Api(api_client)
            resp = await api.read_namespaced_cron_job(name, namespace)
        elif resource_type.startswith("custom_"):
            _, group, version, plural = resource_type.split("_", 3)
            api = client.CustomObjectsApi(api_client)
            resp = await api.get_namespaced_custom_object(group, version, namespace, plural, name)
        else:
            raise HTTPException(status_code=400, detail="Unsupported resource type")

        # Keep an editable manifest focused on desired state, not controller-managed status.
        obj = api_client.sanitize_for_serialization(resp)
        obj.pop("status", None)
        if isinstance(obj.get("metadata"), dict):
            obj["metadata"].pop("managedFields", None)
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
        
        if resource_type == "pods":
            api = client.CoreV1Api(api_client)
            await api.patch_namespaced_pod(name, namespace, new_obj)
        elif resource_type == "configmaps":
            api = client.CoreV1Api(api_client)
            await api.patch_namespaced_config_map(name, namespace, new_obj)
        elif resource_type == "secrets":
            api = client.CoreV1Api(api_client)
            await api.patch_namespaced_secret(name, namespace, new_obj)
        elif resource_type == "persistentvolumeclaims":
            api = client.CoreV1Api(api_client)
            await api.patch_namespaced_persistent_volume_claim(name, namespace, new_obj)
        elif resource_type == "deployments":
            api = client.AppsV1Api(api_client)
            await api.patch_namespaced_deployment(name, namespace, new_obj)
        elif resource_type == "statefulsets":
            api = client.AppsV1Api(api_client)
            await api.patch_namespaced_stateful_set(name, namespace, new_obj)
        elif resource_type == "daemonsets":
            api = client.AppsV1Api(api_client)
            await api.patch_namespaced_daemon_set(name, namespace, new_obj)
        elif resource_type == "cronjobs":
            api = client.BatchV1Api(api_client)
            await api.patch_namespaced_cron_job(name, namespace, new_obj)
        elif resource_type.startswith("custom_"):
            _, group, version, plural = resource_type.split("_", 3)
            api = client.CustomObjectsApi(api_client)
            await api.patch_namespaced_custom_object(group, version, namespace, plural, name, new_obj)
        else:
            raise HTTPException(status_code=400, detail="Unsupported resource type")
            
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
