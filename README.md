# <img src="sprites/k8sune-wave.png" width="40" height="40" valign="middle"> k8sune

**k8sune** is a native desktop Kubernetes workspace for investigating live clusters and making deliberate changes. It is built with Tauri, React, and Python, and works with the kubeconfig contexts you already manage.

<p align="center">
  <img src="sprites/k8sune-run.png" width="280" alt="k8sune mascot running">
</p>

## What it does

### Cluster and resource workspace

- Browse cluster overview, nodes, namespaces, Pods, Deployments, StatefulSets, DaemonSets, CronJobs, ConfigMaps, Secrets, PersistentVolumes, and PersistentVolumeClaims.
- Browse Services, Ingresses, ReplicaSets, Jobs, and discovered Custom Resource Definitions.
- Open resource detail pages with metadata, status, related Pods, replica and restart information, and resource-specific controls.
- Open resources, list views, logs, and YAML editors in separate windows when a focused workspace is useful.
- Search navigation, available actions, contexts, and resources loaded in the current view through the command palette (`Ctrl/Cmd + Shift + P`).

### Workload investigation

- Follow related Kubernetes events through a visual timeline and ordered event-history table.
- Stream Pod logs with selectable time ranges; switch to previous-container logs and download captured output.
- Open an interactive container shell when the cluster API server and your RBAC permissions permit exec access.
- View and edit resource YAML with a Monaco editor, reload from the cluster, compare a diff, and apply the change.
- Use OpenAPI schema guidance while editing Custom Resources when the cluster exposes a schema.

### Create and update resources

- Create Deployments, StatefulSets, DaemonSets, CronJobs, ConfigMaps, Secrets, and PersistentVolumeClaims with resource-specific forms.
- Configure workload image, command, environment variables, replicas, schedule, service account, node selector, resource requests, and resource limits before generating YAML.
- Create Opaque, service-account-token, TLS, Docker registry, basic-auth, and SSH-auth Secrets.
- Review and edit generated YAML before applying it, or apply a generic YAML manifest with an optional namespace scope.

### Safer operations

- Review a resource-specific impact warning before deletion.
- Run a server-side delete dry-run to check Kubernetes authorization and admission without removing the resource.
- Require the exact resource name as typed confirmation before permanent deletion.
- Preview YAML changes in a diff editor before applying updates.

### Context and kubeconfig management

- Import kubeconfig content from any selected file or pasted YAML.
- Inspect configured contexts, cluster server details, default namespace, and user details.
- Switch contexts, edit context metadata, favorite frequently used contexts, and remove contexts while retaining shared kubeconfig entries when appropriate.

### Network diagnostics

- Inspect Services, Ingresses, NetworkPolicies, and Endpoints.
- Run DNS resolution through cluster DNS from a short-lived Alpine probe Pod.
- Run TCP connectivity tests from inside the cluster, optionally pinning the probe Pod to a selected node.
- Remove diagnostic probe Pods after the result is collected.

### Access, storage, and releases

- Inspect RBAC inventory, effective access for the active identity, elevated permissions, ServiceAccount access paths, Roles, ClusterRoles, RoleBindings, and ClusterRoleBindings.
- Create ServiceAccounts and edit or remove supported RoleBindings and ClusterRoleBindings.
- Review PVC/PV status, requested and provisioned capacity, StorageClasses, workload consumers, VolumeAttachments, VolumeSnapshots, topology, and storage risk callouts.
- Browse Helm releases, history, values, values diffs, manifests, and roll back to a previous revision.

### Operator utilities

- Start port forwards for supported resources; inspect active sessions, copy local URLs, reconnect, stop one session, or stop all sessions.
- Run a command in temporary Alpine runner Pods across selected nodes or a node-label selector.
- Set a 5–300 second node-command timeout, inspect per-node output and status, then copy or download results as CSV.
- Automatically clean up temporary node runner Pods after collection.

## Install

### macOS

```bash
brew install nanna7077/tap/k8sune
```

### Linux and Windows

Download the appropriate published package from [GitHub Releases](https://github.com/nanna7077/k8sune/releases). Release builds include Linux bundle artifacts when published; Windows installers are not currently part of the release workflow.

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl/Cmd + Shift + P` | Open the command palette |
| `↑` / `↓` | Move through command-palette results |
| `Enter` | Run the selected command |
| `Esc` | Close the command palette or an open dialog |

## Development

### Prerequisites

- [Rust](https://www.rust-lang.org/tools/install)
- [Node.js](https://nodejs.org/)
- [Python 3](https://www.python.org/)
- `kubectl` with access to a Kubernetes cluster

Run the development helper:

```bash
./dev-up.sh
```

It synchronizes mascot sprites, installs JavaScript and Python dependencies, and starts the Tauri application with Vite.

## Architecture

- **Desktop:** [Tauri v2](https://v2.tauri.app/) and Rust manage the application windows and start the local backend.
- **Frontend:** React, TypeScript, Fluent UI, and Monaco provide the cluster workspace.
- **Backend:** FastAPI with `kubernetes_asyncio` performs Kubernetes API operations against the selected context.
- **Landing page:** the static GitHub Pages site is in [`docs/`](docs/index.html) and deploys through [`.github/workflows/pages.yml`](.github/workflows/pages.yml).

## License

[MPL-2.0](LICENSE)
