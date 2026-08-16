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
                    # CRDs commonly retain older, no-longer-served versions.
                    # Use the storage version first (then any served version),
                    # so list/detail/YAML requests always target an API endpoint
                    # the cluster actually exposes.
                    "version": next((v.name for v in c.spec.versions if v.storage), next((v.name for v in c.spec.versions if v.served), c.spec.versions[0].name)),
                    "kind": c.spec.names.kind,
                    "plural": c.spec.names.plural,
                    "scope": c.spec.scope
                } for c in crds.items
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/crds/{context_name}/{plural}/schema")
async def get_crd_schema(context_name: str, plural: str, version: str = None):
    """Return the published OpenAPI v3 schema for a CRD version when present."""
    try:
        client = await cluster_manager.get_client(context_name)
        crds = await ApiextensionsV1Api(client).list_custom_resource_definition()
        crd = next((item for item in crds.items if item.spec.names.plural == plural), None)
        if not crd:
            raise HTTPException(status_code=404, detail="CRD not found")
        selected = next((item for item in crd.spec.versions if item.name == (version or crd.spec.versions[0].name)), None)
        schema = selected.schema.open_apiv3_schema if selected and selected.schema else None
        serialized = client.sanitize_for_serialization(schema) if schema else None
        return {"kind": crd.spec.names.kind, "version": selected.name if selected else version, "schema": serialized, "available": bool(serialized)}
    except HTTPException:
        raise
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
