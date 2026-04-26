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

@router.get("/health")
async def health():
    return {"status": "ok"}
