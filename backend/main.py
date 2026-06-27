from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn
import socket
import sys
from backend.api.context import router as context_router
from backend.api.resources import router as resources_router
from backend.api.logs import router as logs_router
from backend.api.yaml_editor import router as yaml_router
from backend.api.crds import router as crds_router
from backend.api.terminal import router as terminal_router
from backend.cluster.manager import cluster_manager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Attempt to load kubeconfig on startup
    await cluster_manager.load_kubeconfig()
    yield
    # Cleanup logic (if any) could go here

app = FastAPI(title="k8sune Backend", lifespan=lifespan)

# Add CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(context_router, prefix="/api")
app.include_router(resources_router, prefix="/api")
app.include_router(logs_router, prefix="/api")
app.include_router(yaml_router, prefix="/api")
app.include_router(crds_router, prefix="/api")
app.include_router(terminal_router, prefix="/api")

@app.get("/ping")
async def ping():
    return {"status": "pong"}

def get_free_port():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(('127.0.0.1', 0))
    port = s.getsockname()[1]
    s.close()
    return port

if __name__ == "__main__":
    port = get_free_port()
    # Print port to stdout so Tauri can capture it
    print(f"BACKEND_PORT={port}", flush=True)
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")
