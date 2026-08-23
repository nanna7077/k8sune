import asyncio
import re
from typing import Optional

from fastapi import APIRouter
from kubernetes_asyncio.client import CoreV1Api, StorageV1Api, CustomObjectsApi

from backend.cluster.manager import cluster_manager

router = APIRouter()


def quantity_to_bytes(value: Optional[str]) -> int:
    """Best-effort conversion for Kubernetes storage quantities."""
    if not value:
        return 0
    match = re.fullmatch(r'([0-9.]+)(Ki|Mi|Gi|Ti|Pi|K|M|G|T|P)?', str(value))
    if not match:
        return 0
    amount, unit = float(match.group(1)), match.group(2) or ''
    factors = {'': 1, 'Ki': 1024, 'Mi': 1024**2, 'Gi': 1024**3, 'Ti': 1024**4, 'Pi': 1024**5, 'K': 1000, 'M': 1000**2, 'G': 1000**3, 'T': 1000**4, 'P': 1000**5}
    return int(amount * factors[unit])


@router.get('/storage/{context_name}')
async def storage_overview(context_name: str):
    client = await cluster_manager.get_client(context_name)
    core, storage, custom = CoreV1Api(client), StorageV1Api(client), CustomObjectsApi(client)
    pvs, pvcs, classes, attachments, pods = await asyncio.gather(
        core.list_persistent_volume(),
        core.list_persistent_volume_claim_for_all_namespaces(),
        storage.list_storage_class(),
        storage.list_volume_attachment(),
        core.list_pod_for_all_namespaces(),
    )
    claim_consumers = {}
    for pod in pods.items:
        for volume in pod.spec.volumes or []:
            claim = getattr(volume, 'persistent_volume_claim', None)
            if claim:
                claim_consumers.setdefault((pod.metadata.namespace, claim.claim_name), []).append({'pod': pod.metadata.name, 'node': pod.spec.node_name or 'Pending', 'phase': pod.status.phase or 'Unknown'})
    pv_rows = []
    for item in pvs.items:
        affinity = getattr(getattr(item.spec, 'node_affinity', None), 'required', None)
        terms = getattr(affinity, 'node_selector_terms', []) or []
        topology = sorted({value for term in terms for expression in (term.match_expressions or []) for value in (expression.values or [])})
        pv_rows.append({'name': item.metadata.name, 'status': item.status.phase or 'Unknown', 'capacity': (item.spec.capacity or {}).get('storage', '—'), 'storage_class': item.spec.storage_class_name or '—', 'claim': f'{item.spec.claim_ref.namespace}/{item.spec.claim_ref.name}' if item.spec.claim_ref else 'Unbound', 'access_modes': item.spec.access_modes or [], 'reclaim_policy': item.spec.persistent_volume_reclaim_policy or '—', 'topology': topology})
    pvc_rows = []
    for item in pvcs.items:
        conditions = [{'type': condition.type, 'status': condition.status, 'reason': condition.reason, 'message': condition.message} for condition in (getattr(item.status, 'conditions', None) or [])]
        consumers = claim_consumers.get((item.metadata.namespace, item.metadata.name), [])
        pvc_rows.append({'name': item.metadata.name, 'namespace': item.metadata.namespace, 'status': item.status.phase or 'Unknown', 'requested': (item.spec.resources.requests or {}).get('storage', '—'), 'capacity': (item.status.capacity or {}).get('storage', '—'), 'storage_class': item.spec.storage_class_name or '—', 'volume': item.spec.volume_name or 'Unbound', 'access_modes': item.spec.access_modes or [], 'conditions': conditions, 'consumers': consumers})
    class_rows = [{'name': item.metadata.name, 'provisioner': item.provisioner, 'default': (item.metadata.annotations or {}).get('storageclass.kubernetes.io/is-default-class') == 'true' or (item.metadata.annotations or {}).get('storageclass.beta.kubernetes.io/is-default-class') == 'true', 'reclaim_policy': item.reclaim_policy or 'Delete', 'binding_mode': item.volume_binding_mode or 'Immediate', 'allow_expansion': bool(item.allow_volume_expansion), 'mount_options': item.mount_options or [], 'parameters': item.parameters or {}, 'allowed_topologies': [term.match_label_expressions for term in (item.allowed_topologies or [])]} for item in classes.items]
    attachment_rows = [{'name': item.metadata.name, 'pv': item.spec.source.persistent_volume_name or '—', 'node': item.spec.node_name, 'attached': bool(item.status.attached), 'attach_error': item.status.attach_error.message if item.status.attach_error else None} for item in attachments.items]
    requested = sum(quantity_to_bytes(item['requested']) for item in pvc_rows)
    capacity = sum(quantity_to_bytes(item['capacity']) for item in pv_rows)
    risks = []
    for item in pvc_rows:
        if item['status'] != 'Bound': risks.append({'severity': 'warning', 'title': f"Unbound claim: {item['namespace']}/{item['name']}", 'detail': f"Status: {item['status']}. Review its StorageClass, selectors, and provisioning events."})
        if item['status'] == 'Bound' and not item['consumers']: risks.append({'severity': 'info', 'title': f"Unused claim: {item['namespace']}/{item['name']}", 'detail': 'No Pod currently mounts this claim.'})
        for condition in item['conditions']:
            if condition['status'] == 'True': risks.append({'severity': 'warning', 'title': f"{condition['type']}: {item['namespace']}/{item['name']}", 'detail': condition['message'] or condition['reason'] or 'PVC condition requires review.'})
    for item in pv_rows:
        if item['status'] in ('Released', 'Failed'): risks.append({'severity': 'warning', 'title': f"PV {item['status'].lower()}: {item['name']}", 'detail': f"Reclaim policy: {item['reclaim_policy']}"})
    for item in attachment_rows:
        if item['attach_error']: risks.append({'severity': 'danger', 'title': f"Attachment error: {item['pv']}", 'detail': item['attach_error']})
    try:
        snapshot_data = await custom.list_cluster_custom_object('snapshot.storage.k8s.io', 'v1', 'volumesnapshots')
        snapshots = [{'name': item['metadata']['name'], 'namespace': item['metadata'].get('namespace', 'default'), 'source_pvc': item.get('spec', {}).get('source', {}).get('persistentVolumeClaimName', '—'), 'ready': item.get('status', {}).get('readyToUse'), 'size': item.get('status', {}).get('restoreSize', '—'), 'created_at': item['metadata'].get('creationTimestamp')} for item in snapshot_data.get('items', [])]
    except Exception:
        snapshots = []
    return {'summary': {'pvc_count': len(pvc_rows), 'bound_pvc_count': sum(item['status'] == 'Bound' for item in pvc_rows), 'pv_count': len(pv_rows), 'attached_count': sum(item['attached'] for item in attachment_rows), 'requested_bytes': requested, 'capacity_bytes': capacity, 'risk_count': len(risks)}, 'risks': risks, 'pvcs': pvc_rows, 'pvs': pv_rows, 'storage_classes': class_rows, 'attachments': attachment_rows, 'snapshots': snapshots}
