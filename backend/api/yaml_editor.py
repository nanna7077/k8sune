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
        elif resource_type == "deployments":
            api = client.AppsV1Api(api_client)
            resp = await api.read_namespaced_deployment(name, namespace)
        else:
            raise HTTPException(status_code=400, detail="Unsupported resource type")

        # Sanitize object for YAML output (remove status and unnecessary metadata)
        obj = api_client.sanitize_for_serialization(resp)
        # Convert to YAML
        return {"yaml": yaml.dump(obj, sort_keys=False)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/yaml/{context_name}/{resource_type}/{namespace}/{name}")
async def apply_resource_yaml(context_name: str, resource_type: str, namespace: str, name: str, yaml_content: str = Body(..., embed=True)):
    api_client = await cluster_manager.get_client(context_name)
    
    try:
        new_obj = yaml.safe_load(yaml_content)
        
        if resource_type == "pods":
            api = client.CoreV1Api(api_client)
            await api.patch_namespaced_pod(name, namespace, new_obj)
        elif resource_type == "deployments":
            api = client.AppsV1Api(api_client)
            await api.patch_namespaced_deployment(name, namespace, new_obj)
        else:
            raise HTTPException(status_code=400, detail="Unsupported resource type")
            
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
