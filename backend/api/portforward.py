from fastapi import APIRouter, HTTPException
import subprocess
import socket
import asyncio
from typing import Optional, List
from pydantic import BaseModel

router = APIRouter(tags=["portforward"])

# In-memory registry to track active port forwards
# Key: (context_name, namespace, service_name) -> dict info
active_portforwards = {}

class StartPortForwardRequest(BaseModel):
    context_name: str
    namespace: str
    service_name: str
    service_port: int
    local_port: Optional[int] = None

class PortForwardSession(BaseModel):
    context_name: str
    namespace: str
    service_name: str
    service_port: int
    local_port: int

def get_free_port() -> int:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(('127.0.0.1', 0))
    port = s.getsockname()[1]
    s.close()
    return port

@router.post("/portforward/start")
async def start_port_forward(req: StartPortForwardRequest):
    key = (req.context_name, req.namespace, req.service_name)
    
    # If already running, stop the existing session first
    if key in active_portforwards:
        await stop_port_forward(req.context_name, req.namespace, req.service_name)

    local_port = req.local_port or get_free_port()

    # Command: kubectl port-forward svc/<service> <local_port>:<service_port> --namespace <ns> --context <ctx>
    cmd = [
        "kubectl", "port-forward",
        f"svc/{req.service_name}",
        f"{local_port}:{req.service_port}",
        "--namespace", req.namespace,
        "--context", req.context_name
    ]

    try:
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        
        # Give the process a brief moment to start and check if it failed immediately
        await asyncio.sleep(1.0)
        if proc.poll() is not None:
            # Exited/failed immediately
            stderr_output = proc.stderr.read().decode().strip()
            raise HTTPException(
                status_code=400,
                detail=f"Failed to start port forward: {stderr_output or 'Subprocess exited immediately'}"
            )

        active_portforwards[key] = {
            "proc": proc,
            "local_port": local_port,
            "service_port": req.service_port
        }

        return {
            "success": True,
            "local_port": local_port,
            "service_port": req.service_port
        }
        
    except Exception as e:
        if not isinstance(e, HTTPException):
            raise HTTPException(status_code=500, detail=str(e))
        raise e

@router.post("/portforward/stop")
async def stop_port_forward_endpoint(context_name: str, namespace: str, service_name: str):
    success = await stop_port_forward(context_name, namespace, service_name)
    if not success:
        raise HTTPException(status_code=404, detail="No active port forward session found for this service")
    return {"success": True}

async def stop_port_forward(context_name: str, namespace: str, service_name: str) -> bool:
    key = (context_name, namespace, service_name)
    if key in active_portforwards:
        session = active_portforwards.pop(key)
        proc = session["proc"]
        try:
            proc.terminate()
            # Wait briefly to let it terminate
            for _ in range(10):
                if proc.poll() is not None:
                    break
                await asyncio.sleep(0.1)
            if proc.poll() is None:
                proc.kill()
        except Exception:
            pass
        return True
    return False

@router.get("/portforward/active", response_model=List[PortForwardSession])
async def get_active_port_forwards(context_name: Optional[str] = None):
    sessions = []
    # Verify which subprocesses are actually still running
    for key, val in list(active_portforwards.items()):
        proc = val["proc"]
        if proc.poll() is not None:
            # Subprocess died, remove it silently
            active_portforwards.pop(key, None)
            continue
            
        if not context_name or key[0] == context_name:
            sessions.append(PortForwardSession(
                context_name=key[0],
                namespace=key[1],
                service_name=key[2],
                service_port=val["service_port"],
                local_port=val["local_port"]
            ))
    return sessions

def cleanup_all_portforwards():
    for key, val in list(active_portforwards.items()):
        try:
            val["proc"].terminate()
        except Exception:
            pass
    active_portforwards.clear()
