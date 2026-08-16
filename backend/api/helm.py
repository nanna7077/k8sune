import asyncio
import difflib
import os
import tempfile
from urllib.parse import quote
import yaml

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.cluster.manager import cluster_manager

router = APIRouter()


def _clean_manifest(value):
    """Remove server-managed fields so desired state can be compared meaningfully."""
    if not isinstance(value, dict):
        return value
    cleaned = {key: _clean_manifest(item) for key, item in value.items() if key != 'status'}
    metadata = cleaned.get('metadata')
    if isinstance(metadata, dict):
        metadata = dict(metadata)
        for field in ('managedFields', 'resourceVersion', 'uid', 'creationTimestamp', 'generation', 'selfLink'):
            metadata.pop(field, None)
        annotations = metadata.get('annotations')
        if isinstance(annotations, dict):
            annotations = dict(annotations)
            for field in ('kubectl.kubernetes.io/last-applied-configuration', 'deployment.kubernetes.io/revision'):
                annotations.pop(field, None)
            if annotations:
                metadata['annotations'] = annotations
            else:
                metadata.pop('annotations', None)
        cleaned['metadata'] = metadata
    return cleaned


def _manifest_objects(documents):
    """Flatten Helm's multi-document output, including List resources."""
    for document in documents:
        if not isinstance(document, dict):
            continue
        if document.get('kind', '').endswith('List') and isinstance(document.get('items'), list):
            yield from _manifest_objects(document['items'])
        elif document.get('apiVersion') and document.get('kind') and document.get('metadata', {}).get('name'):
            yield document


async def _live_resource(api_client, desired):
    api_version = desired['apiVersion']
    kind = desired['kind']
    metadata = desired['metadata']
    if '/' in api_version:
        group, version = api_version.split('/', 1)
        base_path = f'/apis/{quote(group, safe=".")}/{quote(version, safe="")}'
    else:
        base_path = f'/api/{quote(api_version, safe="")}'
    response_types_map = {'200': 'object'}
    discovery = await api_client.call_api(base_path, 'GET', response_types_map=response_types_map, _return_http_data_only=True)
    resources = discovery.get('resources', []) if isinstance(discovery, dict) else []
    resource = next((item for item in resources if item.get('kind') == kind and '/' not in item.get('name', '')), None)
    if not resource:
        raise ValueError(f'{api_version} {kind} is not discoverable on this cluster')
    namespace = metadata.get('namespace')
    name = metadata['name']
    if resource.get('namespaced'):
        if not namespace:
            raise ValueError(f'{kind}/{name} is namespaced but its manifest has no namespace')
        path = f"{base_path}/namespaces/{quote(namespace, safe='')}/{resource['name']}/{quote(name, safe='')}"
    else:
        path = f"{base_path}/{resource['name']}/{quote(name, safe='')}"
    return await api_client.call_api(path, 'GET', response_types_map=response_types_map, _return_http_data_only=True)


async def helm(context: str, *args: str) -> str:
    kubeconfig = cluster_manager._resolve_kubeconfig_path()
    sanitized_path = ''
    if kubeconfig:
        # Helm's Go loader rejects duplicate named entries, while the Python
        # client can still load this kubeconfig. Keep the user's file intact
        # and give Helm a temporary, de-duplicated equivalent.
        try:
            with open(kubeconfig, encoding='utf-8') as source:
                config_data = yaml.safe_load(source) or {}
            for key in ('clusters', 'contexts', 'users'):
                entries = config_data.get(key, []) or []
                deduped = {}
                for entry in entries:
                    if isinstance(entry, dict) and entry.get('name'):
                        deduped[entry['name']] = entry
                config_data[key] = list(deduped.values())
            # The temporary file is in /tmp, so preserve relative credential
            # references by resolving them relative to the source kubeconfig.
            source_dir = os.path.dirname(os.path.abspath(kubeconfig))
            for cluster in config_data.get('clusters', []):
                value = cluster.get('cluster', {}) if isinstance(cluster, dict) else {}
                if value.get('certificate-authority') and not os.path.isabs(value['certificate-authority']):
                    value['certificate-authority'] = os.path.join(source_dir, value['certificate-authority'])
            for user in config_data.get('users', []):
                value = user.get('user', {}) if isinstance(user, dict) else {}
                for key in ('client-certificate', 'client-key'):
                    if value.get(key) and not os.path.isabs(value[key]):
                        value[key] = os.path.join(source_dir, value[key])
            with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False, encoding='utf-8') as temp:
                yaml.safe_dump(config_data, temp, sort_keys=False)
                sanitized_path = temp.name
        except Exception:
            sanitized_path = ''
    command = ['helm', '--kube-context', context]
    if sanitized_path or kubeconfig:
        command.extend(['--kubeconfig', sanitized_path or kubeconfig])
    command.extend(args)
    try:
        process = await asyncio.create_subprocess_exec(*command, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
    except FileNotFoundError:
        raise HTTPException(status_code=503, detail='Helm CLI is not installed or not on PATH')
    try:
        stdout, stderr = await process.communicate()
        if process.returncode:
            raise HTTPException(status_code=400, detail=stderr.decode().strip() or stdout.decode().strip())
        return stdout.decode()
    finally:
        if sanitized_path and os.path.exists(sanitized_path):
            os.unlink(sanitized_path)


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


@router.get('/helm/{context_name}/releases/{namespace}/{name}/drift')
async def resource_drift(context_name: str, namespace: str, name: str, revision: int = 0):
    """Compare Helm's rendered release manifest with objects currently in the cluster."""
    args = ['get', 'manifest', name, '--namespace', namespace]
    if revision:
        args.extend(['--revision', str(revision)])
    rendered = await helm(context_name, *args)
    try:
        desired_objects = list(_manifest_objects(yaml.safe_load_all(rendered)))
    except yaml.YAMLError as error:
        raise HTTPException(status_code=400, detail=f'Helm returned invalid YAML: {error}')

    api_client = await cluster_manager.get_client(context_name)
    changes, missing, errors = [], [], []
    unchanged = 0
    seen = set()
    for desired in desired_objects:
        metadata = desired.get('metadata', {})
        resource_id = f"{desired['kind']}/{metadata.get('namespace', 'cluster')}/{metadata['name']}"
        if resource_id in seen:
            continue
        seen.add(resource_id)
        try:
            live = await _live_resource(api_client, desired)
        except Exception as error:
            message = str(error)
            if '404' in message or 'Not Found' in message:
                missing.append({'resource': resource_id, 'expected': yaml.safe_dump(_clean_manifest(desired), sort_keys=False)})
            else:
                errors.append({'resource': resource_id, 'error': message})
            continue
        expected_yaml = yaml.safe_dump(_clean_manifest(desired), sort_keys=False).splitlines(True)
        actual_yaml = yaml.safe_dump(_clean_manifest(live), sort_keys=False).splitlines(True)
        if expected_yaml != actual_yaml:
            changes.append({'resource': resource_id, 'expected': ''.join(expected_yaml), 'actual': ''.join(actual_yaml)})
        else:
            unchanged += 1
    return {'changes': changes, 'missing': missing, 'errors': errors, 'unchanged': unchanged, 'total': len(seen)}


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
