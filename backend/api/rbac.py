from fastapi import APIRouter, HTTPException
from backend.cluster.manager import cluster_manager
from kubernetes_asyncio.client import CoreV1Api, RbacAuthorizationV1Api, AuthorizationV1Api
from pydantic import BaseModel

router = APIRouter()

class ServiceAccountCreate(BaseModel):
    name: str
    namespace: str = "default"

class BindingUpdate(BaseModel):
    role_kind: str
    role_name: str
    subjects: list[dict]


@router.get("/rbac/{context_name}")
async def inspect_rbac(context_name: str, namespace: str = "default"):
    client = await cluster_manager.get_client(context_name)
    rbac = RbacAuthorizationV1Api(client)
    errors = []

    async def read(label, request):
        try:
            return await request
        except Exception as exc:
            errors.append({"area": label, "message": str(exc)})
            return None

    service_accounts = await read("ServiceAccounts", CoreV1Api(client).list_service_account_for_all_namespaces())
    roles = await read("Roles", rbac.list_role_for_all_namespaces())
    cluster_roles = await read("ClusterRoles", rbac.list_cluster_role())
    bindings = await read("RoleBindings", rbac.list_role_binding_for_all_namespaces())
    cluster_bindings = await read("ClusterRoleBindings", rbac.list_cluster_role_binding())
    rules_review = await read("Effective access", AuthorizationV1Api(client).create_self_subject_rules_review({"spec": {"namespace": namespace}}))

    serialize_binding = lambda item: {"name": item.metadata.name, "namespace": item.metadata.namespace, "role": f"{item.role_ref.kind}/{item.role_ref.name}", "subjects": [f"{subject.kind}:{subject.name}" for subject in (item.subjects or [])]}
    return {
        "namespace": namespace,
        "effective_rules": [{"verbs": rule.verbs or [], "resources": rule.resources or [], "api_groups": rule.api_groups or []} for rule in ((rules_review.status.resource_rules or []) if rules_review and rules_review.status else [])],
        "service_accounts": [{"name": item.metadata.name, "namespace": item.metadata.namespace} for item in (service_accounts.items if service_accounts else [])],
        "roles": [{"name": item.metadata.name, "namespace": item.metadata.namespace, "rules": len(item.rules or [])} for item in (roles.items if roles else [])],
        "cluster_roles": [{"name": item.metadata.name, "rules": len(item.rules or [])} for item in (cluster_roles.items if cluster_roles else [])],
        "bindings": [serialize_binding(item) for item in (bindings.items if bindings else [])],
        "cluster_bindings": [serialize_binding(item) for item in (cluster_bindings.items if cluster_bindings else [])],
        "permission_errors": errors,
    }

@router.post("/rbac/{context_name}/serviceaccounts")
async def create_service_account(context_name: str, request: ServiceAccountCreate):
    try:
        client = await cluster_manager.get_client(context_name)
        await CoreV1Api(client).create_namespaced_service_account(request.namespace, {"metadata": {"name": request.name}})
        return {"status": "ok"}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

@router.delete("/rbac/{context_name}/bindings/{binding_type}/{namespace}/{name}")
async def delete_binding(context_name: str, binding_type: str, namespace: str, name: str):
    try:
        rbac = RbacAuthorizationV1Api(await cluster_manager.get_client(context_name))
        if binding_type == "cluster":
            await rbac.delete_cluster_role_binding(name)
        elif binding_type == "namespaced":
            await rbac.delete_namespaced_role_binding(name, namespace)
        else:
            raise HTTPException(status_code=400, detail="Unknown binding type")
        return {"status": "ok"}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

@router.put("/rbac/{context_name}/bindings/{binding_type}/{namespace}/{name}")
async def update_binding(context_name: str, binding_type: str, namespace: str, name: str, update: BindingUpdate):
    try:
        rbac = RbacAuthorizationV1Api(await cluster_manager.get_client(context_name))
        body = {"roleRef": {"apiGroup": "rbac.authorization.k8s.io", "kind": update.role_kind, "name": update.role_name}, "subjects": update.subjects}
        if binding_type == "cluster":
            await rbac.patch_cluster_role_binding(name, body)
        elif binding_type == "namespaced":
            await rbac.patch_namespaced_role_binding(name, namespace, body)
        else:
            raise HTTPException(status_code=400, detail="Unknown binding type")
        return {"status": "ok"}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

@router.get("/rbac/{context_name}/serviceaccounts/{namespace}/{name}")
async def service_account_access(context_name: str, namespace: str, name: str):
    client = await cluster_manager.get_client(context_name)
    rbac = RbacAuthorizationV1Api(client)
    bindings = await rbac.list_role_binding_for_all_namespaces()
    cluster_bindings = await rbac.list_cluster_role_binding()
    roles = await rbac.list_role_for_all_namespaces()
    cluster_roles = await rbac.list_cluster_role()
    role_map = {("Role", item.metadata.namespace, item.metadata.name): item.rules or [] for item in roles.items}
    role_map.update({("ClusterRole", None, item.metadata.name): item.rules or [] for item in cluster_roles.items})
    all_bindings = [(item, False) for item in bindings.items] + [(item, True) for item in cluster_bindings.items]
    matches = []
    for item, cluster_scoped in all_bindings:
        if not any(subject.kind == "ServiceAccount" and subject.name == name and (cluster_scoped or subject.namespace == namespace) for subject in (item.subjects or [])):
            continue
        ref = item.role_ref
        rules = role_map.get((ref.kind, None if ref.kind == "ClusterRole" else item.metadata.namespace, ref.name), [])
        matches.append({"binding": item.metadata.name, "namespace": item.metadata.namespace, "cluster_scoped": cluster_scoped, "role": f"{ref.kind}/{ref.name}", "rules": [{"verbs": rule.verbs or [], "resources": rule.resources or []} for rule in rules]})
    return {"service_account": f"{namespace}/{name}", "bindings": matches}
