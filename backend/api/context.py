from fastapi import APIRouter, HTTPException
from backend.cluster.manager import cluster_manager
from kubernetes_asyncio.client import CoreV1Api

router = APIRouter()

@router.get("/contexts")
async def get_contexts():
    return await cluster_manager.list_contexts()

@router.post("/contexts/verify/{context_name}")
async def verify_context(context_name: str):
    try:
        client = await cluster_manager.get_client(context_name)
        v1 = CoreV1Api(client)
        # Just check connectivity by listing namespaces
        # Limit to 1 result to keep it fast
        await v1.list_namespace(limit=1)
        return {"status": "ok", "message": f"Connected to {context_name}"}
    except Exception as e:
        print(f"Failed to verify context {context_name}: {e}")
        raise HTTPException(status_code=400, detail=str(e))

from pydantic import BaseModel

class ImportRequest(BaseModel):
    yaml_content: str

@router.post("/contexts/import")
async def import_kubeconfig(req: ImportRequest):
    try:
        await cluster_manager.merge_kubeconfig(req.yaml_content)
        return {"status": "ok", "message": "Kubeconfig imported successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/contexts/settings/{context_name}")
async def get_cluster_settings(context_name: str):
    return cluster_manager.cluster_settings.get(context_name, {})

class SettingsUpdate(BaseModel):
    settings: dict

@router.post("/contexts/settings/{context_name}")
async def update_cluster_settings(context_name: str, req: SettingsUpdate):
    for k, v in req.settings.items():
        cluster_manager.set_cluster_setting(context_name, k, v)
    return {"status": "ok"}

@router.get("/health")
async def health():
    return {"status": "ok"}
