# <img src="sprites/k8sune-wave.png" width="40" height="40" valign="middle"> k8sune

**k8sune** is a modern and integrated desktop controller for Kubernetes. Built with **Tauri**, **React**, and **Python**, it provides a high-performance experience for exploring clusters, monitoring logs, and managing resources with a sophisticated dark aesthetic.

<p align="center">
  <img src="sprites/k8sune-run.png" width="200">
</p>

## Features

- **Integrated Dashboard**: Unified cluster management within a single window.
- **Detailed Overview**: Real-time cluster vitals, resource capacity (CPU/Memory/Pods), and control plane health.
- **Multi-Tab Bottom Drawer**: Open multiple logs and YAML editors simultaneously in a resizable tabbed interface.
- **YAML Diff Engine**: Compare local changes against the cluster state before applying, powered by Monaco.
- **Custom Titlebar**: A frameless, edge-to-edge experience with integrated window controls.
- **CRD & Custom Resource Support**: Dynamic exploration and editing of any Custom Resource Definition.
- **Log Exporting**: Select timeframes and download logs to your machine using native system dialogs.
- **Mascot integration**: Interactive feedback through k8sune sprites.

## Tech Stack

- **Frontend**: [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [Fluent UI](https://react.fluentui.dev/)
- **Desktop Framework**: [Tauri v2](https://v2.tauri.app/) (Rust)
- **Backend API**: [FastAPI](https://fastapi.tiangolo.com/) (Python)
- **Editor**: [Monaco Editor](https://microsoft.github.io/monaco-editor/)

## Getting Started

### Prerequisites

- [Rust](https://www.rust-lang.org/tools/install)
- [Node.js](https://nodejs.org/)
- [Python 3](https://www.python.org/)
- `kubectl` configured with access to a cluster

### Development

Use the helper script to set up and launch the development environment:

```bash
./dev-up.sh
```

This script handles:
1. Mascot sprite synchronization.
2. Node.js dependency installation.
3. Python virtual environment and requirements setup.
4. Launching the Tauri development environment.

## Screenshots

*(Screenshots coming soon)*
<p align="center">
  <img src="sprites/k8sune-think.png" width="150">
</p>

## TODO

- [ ] **Multi-platform packaging**: Create distributables for Linux, macOS, and Windows.
- [ ] **Resource Creation**: Add forms and wizards for creating new Kubernetes resources.
- [ ] **Port Forwarding**: Integrated management of port-forwarding sessions.
- [ ] **Context Management**: Add/Edit/Delete kubeconfigs directly from the UI.
- [ ] **Search Enhancements**: Global command palette (Cmd/Ctrl + K) for quick navigation.
- [ ] **Metric Server Integration**: Show real-time container CPU/Memory usage metrics.

## License

[MPL-2.0](LICENSE)

---
<p align="center">
  Made with care and a lot of foxes.
  <br>
  <img src="sprites/k8sune-tired.png" width="100">
</p>
