# k8sune contribution guide

## Feature implementation

- Give each substantial new feature a focused implementation under `frontend/src/features/<feature-name>/`. Keep `Dashboard.tsx` limited to composition, routing, and shared application state.
- Register user-facing navigation or actions in the Ctrl/Cmd + Shift + P command palette. Include a concise label, a searchable description, and an icon.
- Use the shared in-app feedback dialog for success, error, confirmation, and input flows. Do not add browser `alert`, `confirm`, or `prompt` calls.
- Add the corresponding backend endpoint and capability permission when a feature requires system or Kubernetes access. Keep resource operations scoped to the active context and namespace.
- Verify frontend changes with `npm run build --prefix frontend`; verify edited Python modules with `backend/venv/bin/python -m py_compile <file>`.
