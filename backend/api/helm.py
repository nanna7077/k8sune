import asyncio
import difflib
import os
import tempfile

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.cluster.manager import cluster_manager

router = APIRouter()


async def helm(context: str, *args: str) -> str:
    kubeconfig = cluster_manager._resolve_kubeconfig_path()
    command = ['helm', '--kube-context', context]
    if kubeconfig:
        command.extend(['--kubeconfig', kubeconfig])
    command.extend(args)
    try:
        process = await asyncio.create_subprocess_exec(*command, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
    except FileNotFoundError:
        raise HTTPException(status_code=503, detail='Helm CLI is not installed or not on PATH')
    stdout, stderr = await process.communicate()
    if process.returncode:
        raise HTTPException(status_code=400, detail=stderr.decode().strip() or stdout.decode().strip())
    return stdout.decode()


@router.get('/helm/{context_name}/releases')
async def releases(context_name: str):
    import json
    output = await helm(context_name, 'list', '--all-namespaces', '--output', 'json')
    return {'releases': json.loads(output or '[]')}


@router.get('/helm/{context_name}/releases/{namespace}/{name}/history')
async def history(context_name: str, namespace: str, name: str):
    import json
    output = await helm(context_name, 'history', name, '--namespace', namespace, '--output', 'json')
    return {'history': json.loads(output or '[]')}


@router.get('/helm/{context_name}/releases/{namespace}/{name}/values')
async def values(context_name: str, namespace: str, name: str, revision: int = 0):
    args = ['get', 'values', name, '--namespace', namespace, '--output', 'yaml']
    if revision: args.extend(['--revision', str(revision)])
    return {'values': await helm(context_name, *args)}


@router.get('/helm/{context_name}/releases/{namespace}/{name}/manifest')
async def manifest(context_name: str, namespace: str, name: str, revision: int = 0):
    args = ['get', 'manifest', name, '--namespace', namespace]
    if revision: args.extend(['--revision', str(revision)])
    return {'manifest': await helm(context_name, *args)}


@router.get('/helm/{context_name}/releases/{namespace}/{name}/values-diff')
async def values_diff(context_name: str, namespace: str, name: str, from_revision: int, to_revision: int):
    before = await helm(context_name, 'get', 'values', name, '--namespace', namespace, '--revision', str(from_revision), '--output', 'yaml')
    after = await helm(context_name, 'get', 'values', name, '--namespace', namespace, '--revision', str(to_revision), '--output', 'yaml')
    return {'diff': ''.join(difflib.unified_diff(before.splitlines(True), after.splitlines(True), fromfile=f'revision-{from_revision}', tofile=f'revision-{to_revision}'))}


class RollbackRequest(BaseModel):
    revision: int = Field(ge=1)

@router.post('/helm/{context_name}/releases/{namespace}/{name}/rollback')
async def rollback(context_name: str, namespace: str, name: str, request: RollbackRequest):
    output = await helm(context_name, 'rollback', name, str(request.revision), '--namespace', namespace, '--wait')
    return {'status': 'ok', 'output': output}


class UpgradePreview(BaseModel):
    chart: str = Field(min_length=1, max_length=512)
    values: str = ''
    version: str = ''

@router.post('/helm/{context_name}/releases/{namespace}/{name}/upgrade-preview')
async def upgrade_preview(context_name: str, namespace: str, name: str, request: UpgradePreview):
    temp_path = ''
    try:
        with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as temp:
            temp.write(request.values)
            temp_path = temp.name
        args = ['upgrade', name, request.chart, '--namespace', namespace, '--install', '--dry-run=server', '--values', temp_path]
        if request.version: args.extend(['--version', request.version])
        return {'preview': await helm(context_name, *args)}
    finally:
        if temp_path and os.path.exists(temp_path): os.unlink(temp_path)
