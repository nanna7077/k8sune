from fastapi import APIRouter, HTTPException
from backend.cluster.manager import cluster_manager
from kubernetes_asyncio.client import CoreV1Api
import yaml

router = APIRouter()

@router.get("/contexts")
async def get_contexts():
    result = await cluster_manager.list_contexts()
    config_path = cluster_manager._resolve_kubeconfig_path()
    if not config_path:
        return {**result, "details": []}
    with open(config_path, "r") as file:
        config_data = yaml.safe_load(file) or {}
    clusters = {item.get("name"): item.get("cluster", {}) for item in config_data.get("clusters", [])}
    details = []
    for item in config_data.get("contexts", []):
        name, value = item.get("name"), item.get("context", {})
        details.append({"name": name, "cluster": value.get("cluster"), "server": clusters.get(value.get("cluster"), {}).get("server"), "namespace": value.get("namespace") or "default", "user": value.get("user"), "favorite": bool(cluster_manager.get_cluster_setting(name, "favorite", False))})
    return {**result, "details": details}

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

class ContextUpdate(BaseModel):
    namespace: str | None = None
    server: str | None = None

def _write_kubeconfig(data):
    path = cluster_manager._resolve_kubeconfig_path()
    if not path:
        raise HTTPException(status_code=400, detail="No kubeconfig file is configured")
    with open(path, "w") as file:
        yaml.safe_dump(data, file, sort_keys=False)
    cluster_manager._clients.clear()

@router.put("/contexts/{context_name}")
async def update_context(context_name: str, update: ContextUpdate):
    path = cluster_manager._resolve_kubeconfig_path()
    if not path:
        raise HTTPException(status_code=400, detail="No kubeconfig file is configured")
    with open(path, "r") as file:
        data = yaml.safe_load(file) or {}
    item = next((entry for entry in data.get("contexts", []) if entry.get("name") == context_name), None)
    if not item:
        raise HTTPException(status_code=404, detail="Context not found")
    if update.namespace is not None:
        item.setdefault("context", {})["namespace"] = update.namespace
    if update.server is not None:
        cluster_name = item.get("context", {}).get("cluster")
        cluster = next((entry for entry in data.get("clusters", []) if entry.get("name") == cluster_name), None)
        if cluster:
            cluster.setdefault("cluster", {})["server"] = update.server
    _write_kubeconfig(data)
    await cluster_manager.load_kubeconfig()
    return {"status": "ok"}

@router.delete("/contexts/{context_name}")
async def delete_context(context_name: str):
    path = cluster_manager._resolve_kubeconfig_path()
    if not path:
        raise HTTPException(status_code=400, detail="No kubeconfig file is configured")
    with open(path, "r") as file:
        data = yaml.safe_load(file) or {}
    original = data.get("contexts", [])
    data["contexts"] = [item for item in original if item.get("name") != context_name]
    if len(data["contexts"]) == len(original):
        raise HTTPException(status_code=404, detail="Context not found")
    if data.get("current-context") == context_name:
        data["current-context"] = data["contexts"][0].get("name") if data["contexts"] else ""
    _write_kubeconfig(data)
    await cluster_manager.load_kubeconfig()
    return {"status": "ok"}

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
