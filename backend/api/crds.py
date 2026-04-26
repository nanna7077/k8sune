from fastapi import APIRouter, HTTPException
from backend.cluster.manager import cluster_manager
from kubernetes_asyncio.client import CustomObjectsApi, ApiextensionsV1Api
import asyncio

router = APIRouter()

@router.get("/crds/{context_name}")
async def get_crds(context_name: str):
    try:
        client = await cluster_manager.get_client(context_name)
        api = ApiextensionsV1Api(client)
        crds = await api.list_custom_resource_definition()
        
        return {
            "items": [
                {
                    "name": c.metadata.name,
                    "group": c.spec.group,
                    "version": c.spec.versions[0].name,
                    "kind": c.spec.names.kind,
                    "plural": c.spec.names.plural,
                    "scope": c.spec.scope
                } for c in crds.items
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/custom_resources/{context_name}/{group}/{version}/{plural}")
async def get_custom_resources(context_name: str, group: str, version: str, plural: str, namespace: str = None):
    try:
        client = await cluster_manager.get_client(context_name)
        api = CustomObjectsApi(client)
        
        if namespace:
            resp = await api.list_namespaced_custom_object(group, version, namespace, plural)
        else:
            resp = await api.list_cluster_custom_object(group, version, plural)
            
        return {
            "items": [
                {
                    "name": item['metadata']['name'],
                    "namespace": item['metadata'].get('namespace', 'N/A'),
                    "creation_timestamp": item['metadata'].get('creationTimestamp', ''),
                    # We could also extract status or other fields here
                } for item in resp.get('items', [])
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
