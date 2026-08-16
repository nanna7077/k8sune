# <img src="sprites/k8sune-wave.png" width="40" height="40" valign="middle"> k8sune

**k8sune** is a native desktop Kubernetes workspace for investigating live clusters and making deliberate changes. It is built with Tauri, React, and Python, and works with the kubeconfig contexts you already manage.

<p align="center">
  <img src="sprites/k8sune-run.png" width="280" alt="k8sune mascot running">
</p>

## Features

- Browse cluster, namespace, workload, configuration, storage, network, RBAC, Helm, and Custom Resource state.
- Search navigation, actions, contexts, and loaded resources with the `Ctrl/Cmd + Shift + P` command palette.
- Inspect resource details, related Pods, restart counts, event timelines, ordered event history, current logs, and previous-container logs.
- Open interactive container shells when the cluster API server and your RBAC permissions allow exec access.
- Create Deployments, StatefulSets, DaemonSets, CronJobs, ConfigMaps, Secrets, and PVCs with resource-specific forms and generated YAML.
- Apply generic YAML manifests; edit resource YAML, compare a diff, and use CRD OpenAPI schema guidance when available.
- Protect deletions with impact warnings, server-side dry-runs, and typed confirmation.
- Import, edit, favorite, switch, and remove kubeconfig contexts.
- Inspect Services, Ingresses, NetworkPolicies, and Endpoints; run DNS and TCP tests from temporary in-cluster probe Pods, optionally pinned to a node.
- Inspect effective RBAC access and ServiceAccount bindings; create ServiceAccounts and manage RoleBindings and ClusterRoleBindings.
- Review PVC/PV health, StorageClasses, workload consumers, VolumeAttachments, VolumeSnapshots, topology, and storage warnings.
- Browse Helm releases, revision history, values diffs, manifests, and roll back releases.
- Manage port forwards: start, copy URL, reconnect, stop, and stop all active sessions.
- Run commands across selected nodes or a label selector with timeouts, per-node output, automatic cleanup, and CSV export.
- Open resources, list views, logs, YAML editors, and node execution in separate windows.

## Install

### macOS

```bash
brew install nanna7077/tap/k8sune
```

If macOS blocks a downloaded release because it is from an unidentified developer, first try opening the app, then choose **Open Anyway** in **System Settings → Privacy & Security**. Alternatively, remove the quarantine attribute from the installed app:

```bash
xattr -rd com.apple.quarantine "/Applications/k8sune.app"
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

## License

[MPL-2.0](LICENSE)
