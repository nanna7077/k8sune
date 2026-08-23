"""Portable namespace backup and restore endpoints.

Archives intentionally contain desired-state manifests only. Runtime state,
server-assigned metadata, and controller-owned objects are omitted.
"""
import base64
import io
import zipfile
from fastapi import APIRouter, Body, HTTPException
from kubernetes_asyncio import client, utils
import yaml
from typing import Optional
from backend.cluster.manager import cluster_manager
from backend.api.yaml_editor import patch_resource

router = APIRouter()

KIND_LOADERS = {
    "ConfigMap": ("core", "list_namespaced_config_map"),
    "Secret": ("core", "list_namespaced_secret"),
    "ServiceAccount": ("core", "list_namespaced_service_account"),
    "Service": ("core", "list_namespaced_service"),
    "PersistentVolumeClaim": ("core", "list_namespaced_persistent_volume_claim"),
    "Deployment": ("apps", "list_namespaced_deployment"),
    "StatefulSet": ("apps", "list_namespaced_stateful_set"),
    "DaemonSet": ("apps", "list_namespaced_daemon_set"),
    "ReplicaSet": ("apps", "list_namespaced_replica_set"),
    "Job": ("batch", "list_namespaced_job"),
    "CronJob": ("batch", "list_namespaced_cron_job"),
    "Ingress": ("networking", "list_namespaced_ingress"),
    "NetworkPolicy": ("networking", "list_namespaced_network_policy"),
    "Role": ("rbac", "list_namespaced_role"),
    "RoleBinding": ("rbac", "list_namespaced_role_binding"),
}


def prune_manifest(manifest: dict) -> dict:
    manifest.pop("status", None)
    metadata = manifest.get("metadata") or {}
    for key in ("managedFields", "resourceVersion", "uid", "generation", "creationTimestamp", "deletionTimestamp", "deletionGracePeriodSeconds", "selfLink", "ownerReferences"):
        metadata.pop(key, None)
    annotations = metadata.get("annotations") or {}
    annotations.pop("kubectl.kubernetes.io/last-applied-configuration", None)
    annotations.pop("deployment.kubernetes.io/revision", None)
    if annotations:
        metadata["annotations"] = annotations
    else:
        metadata.pop("annotations", None)
    manifest["metadata"] = metadata
    return manifest


async def namespace_manifests(context_name: str, namespace: str, selected: Optional[dict] = None):
    api_client = await cluster_manager.get_client(context_name)
    apis = {
        "core": client.CoreV1Api(api_client), "apps": client.AppsV1Api(api_client),
        "batch": client.BatchV1Api(api_client), "networking": client.NetworkingV1Api(api_client),
        "rbac": client.RbacAuthorizationV1Api(api_client),
    }
    manifests = []
    inventory = []
    for kind, (api_name, method) in KIND_LOADERS.items():
        response = await getattr(apis[api_name], method)(namespace)
        names = [item.metadata.name for item in response.items]
        inventory.append({"kind": kind, "resources": names})
        requested = None if selected is None else selected.get(kind)
        if requested == []:
            continue
        for item in response.items:
            if requested is not None and item.metadata.name not in requested:
                continue
            manifests.append(prune_manifest(api_client.sanitize_for_serialization(item)))
    return inventory, manifests


@router.get("/backup/{context_name}/{namespace}/inventory")
async def backup_inventory(context_name: str, namespace: str):
    try:
        inventory, _ = await namespace_manifests(context_name, namespace)
        return {"namespace": namespace, "kinds": inventory}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/backup/{context_name}/{namespace}/export")
async def export_namespace_backup(context_name: str, namespace: str, selected: dict = Body(default_factory=dict)):
    try:
        _, manifests = await namespace_manifests(context_name, namespace, selected)
        archive = io.BytesIO()
        with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as bundle:
            bundle.writestr("manifest.yaml", yaml.safe_dump_all(manifests, sort_keys=False))
            bundle.writestr("k8sune-backup.yaml", yaml.safe_dump({"apiVersion": "k8sune.dev/v1", "kind": "NamespaceBackup", "namespace": namespace, "resources": len(manifests)}, sort_keys=False))
        return {"filename": f"{namespace}-k8sune-backup.zip", "resources": len(manifests), "archive": base64.b64encode(archive.getvalue()).decode("ascii")}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/backup/{context_name}/{namespace}/restore")
async def restore_namespace_backup(context_name: str, namespace: str, archive: str = Body(..., embed=True)):
    try:
        raw = base64.b64decode(archive)
        with zipfile.ZipFile(io.BytesIO(raw)) as bundle:
            manifests = list(yaml.safe_load_all(bundle.read("manifest.yaml").decode("utf-8")))
        api_client = await cluster_manager.get_client(context_name)
        restored, failures = 0, []
        for manifest in manifests:
            if not isinstance(manifest, dict):
                continue
            manifest = prune_manifest(manifest)
            manifest.setdefault("metadata", {})["namespace"] = namespace
            try:
                await utils.create_from_dict(api_client, manifest, namespace=namespace)
                restored += 1
            except Exception as exc:
                type_by_kind = {"ConfigMap": "configmaps", "Secret": "secrets", "ServiceAccount": "serviceaccounts", "Service": "services", "PersistentVolumeClaim": "persistentvolumeclaims", "Deployment": "deployments", "StatefulSet": "statefulsets", "DaemonSet": "daemonsets", "ReplicaSet": "replicasets", "Job": "jobs", "CronJob": "cronjobs", "Ingress": "ingresses", "NetworkPolicy": "networkpolicies", "Role": "roles", "RoleBinding": "rolebindings"}
                resource_type = type_by_kind.get(manifest.get("kind"))
                try:
                    if not resource_type:
                        raise exc
                    await patch_resource(api_client, resource_type, namespace, manifest["metadata"]["name"], manifest)
                    restored += 1
                except Exception as patch_error:
                    failures.append({"kind": manifest.get("kind"), "name": manifest.get("metadata", {}).get("name"), "error": str(patch_error)})
        return {"restored": restored, "failures": failures}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
