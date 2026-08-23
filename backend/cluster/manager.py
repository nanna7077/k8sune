import asyncio
import inspect
import json
import os
from pathlib import Path

from kubernetes_asyncio import config
from kubernetes_asyncio.client import ApiClient, CoreV1Api
import yaml


class ClusterManager:
    """Discovers usable kubeconfig contexts and owns their API clients."""

    _SKIPPED_KUBE_DIRECTORIES = {'cache', 'http-cache', 'discovery'}
    _KUBECONFIG_SUFFIXES = {'', '.config', '.yaml', '.yml'}
    _MAX_KUBECONFIG_SIZE = 5 * 1024 * 1024
    _VALIDATION_CONCURRENCY = 8
    _VALIDATION_TIMEOUT_SECONDS = 5

    def __init__(self):
        self.contexts = []
        self.active_context_name = None
        self._clients = {}
        self._context_sources = {}
        self._context_details = {}
        self._discovery_task = None
        self.discovering = False
        self.settings_path = os.path.expanduser('~/.k8sune_settings.json')
        self.cluster_settings = self._load_settings()

    def _load_settings(self):
        if os.path.exists(self.settings_path):
            try:
                with open(self.settings_path, 'r') as f:
                    return json.load(f)
            except Exception:
                return {}
        return {}

    def _save_settings(self):
        with open(self.settings_path, 'w') as f:
            json.dump(self.cluster_settings, f)

    def get_cluster_setting(self, context: str, key: str, default=None):
        return self.cluster_settings.get(context, {}).get(key, default)

    def set_cluster_setting(self, context: str, key: str, value):
        if context not in self.cluster_settings:
            self.cluster_settings[context] = {}
        self.cluster_settings[context][key] = value
        self._save_settings()

    def _configured_kubeconfig_paths(self):
        """Return likely kubeconfig files, ordered by explicit configuration."""
        paths = []
        kubeconfig_env = os.environ.get('KUBECONFIG')
        if kubeconfig_env:
            paths.extend(Path(path).expanduser() for path in kubeconfig_env.split(os.path.pathsep) if path)

        kube_dir = Path.home() / '.kube'
        paths.extend((kube_dir / 'config', kube_dir / 'kubeconfig.yaml'))
        if kube_dir.is_dir():
            for root, directories, filenames in os.walk(kube_dir):
                directories[:] = [directory for directory in directories if directory not in self._SKIPPED_KUBE_DIRECTORIES]
                for filename in filenames:
                    candidate = Path(root) / filename
                    if candidate.suffix.lower() in self._KUBECONFIG_SUFFIXES:
                        paths.append(candidate)

        unique_paths = []
        seen = set()
        for path in paths:
            try:
                resolved = path.resolve()
                if resolved in seen or not resolved.is_file() or resolved.stat().st_size > self._MAX_KUBECONFIG_SIZE:
                    continue
                seen.add(resolved)
                unique_paths.append(str(resolved))
            except OSError:
                continue
        return unique_paths

    def _resolve_kubeconfig_path(self):
        # Import operations continue to target the first explicit/standard
        # kubeconfig, while contexts discovered in other files keep their own
        # source path for API requests.
        paths = self._configured_kubeconfig_paths()
        return paths[0] if paths else None

    async def start_discovery(self):
        """Start one non-blocking discovery pass, returning immediately."""
        if self._discovery_task and not self._discovery_task.done():
            return
        self._discovery_task = asyncio.create_task(self._discover_kubeconfigs())

    async def load_kubeconfig(self):
        """Run a complete discovery pass (used after importing or editing)."""
        if self._discovery_task and not self._discovery_task.done():
            self._discovery_task.cancel()
            try:
                await self._discovery_task
            except asyncio.CancelledError:
                pass
        await self._discover_kubeconfigs()
        return True

    async def _contexts_from_file(self, config_file):
        try:
            return await asyncio.to_thread(config.list_kube_config_contexts, config_file=config_file)
        except Exception as error:
            # ~/.kube also contains tool-specific files. Non-kubeconfigs are
            # ignored rather than making startup fail.
            print(f'Skipping kubeconfig candidate {config_file}: {error}')
            return [], None

    async def _servers_from_file(self, config_file):
        try:
            def read_servers():
                with open(config_file, 'r') as source:
                    document = yaml.safe_load(source) or {}
                return {
                    item.get('name'): item.get('cluster', {}).get('server')
                    for item in document.get('clusters', [])
                    if item.get('name')
                }
            return await asyncio.to_thread(read_servers)
        except Exception:
            return {}

    @staticmethod
    def _context_detail(context_entry, config_file, server=None):
        value = context_entry.get('context', {})
        return {
            'name': context_entry.get('name'),
            'cluster': value.get('cluster'),
            'namespace': value.get('namespace') or 'default',
            'user': value.get('user'),
            'server': server,
            'source': config_file,
        }

    async def _validate_context(self, context_entry, config_file, server, semaphore):
        name = context_entry.get('name')
        if not name:
            return None
        async with semaphore:
            client = None
            try:
                client = await config.new_client_from_config(
                    config_file=config_file,
                    context=name,
                    persist_config=False,
                )
                await CoreV1Api(client).list_namespace(
                    limit=1,
                    _request_timeout=self._VALIDATION_TIMEOUT_SECONDS,
                )
                return context_entry, config_file, server
            except Exception as error:
                print(f'Skipping unreachable context {name}: {error}')
                return None
            finally:
                if client:
                    close = client.close()
                    if inspect.isawaitable(close):
                        await close

    async def _discover_kubeconfigs(self):
        self.discovering = True
        self.contexts = []
        self._context_sources = {}
        self._context_details = {}
        self._clients.clear()
        self.active_context_name = None

        candidates = []
        configured_active_context = None
        seen_context_names = set()
        for config_file in self._configured_kubeconfig_paths():
            contexts, active_context = await self._contexts_from_file(config_file)
            servers = await self._servers_from_file(config_file)
            if configured_active_context is None and active_context:
                configured_active_context = active_context.get('name')
            for context_entry in contexts:
                name = context_entry.get('name')
                # Context names are the app's public identifiers. If different
                # files duplicate a name, retain the highest-priority file.
                if name and name not in seen_context_names:
                    seen_context_names.add(name)
                    server = servers.get(context_entry.get('context', {}).get('cluster'))
                    candidates.append((context_entry, config_file, server))

        semaphore = asyncio.Semaphore(self._VALIDATION_CONCURRENCY)
        validations = [
            asyncio.create_task(self._validate_context(context_entry, config_file, server, semaphore))
            for context_entry, config_file, server in candidates
        ]
        try:
            # Publish each validated context immediately, rather than waiting
            # for slow or offline clusters in the rest of ~/.kube.
            for task in asyncio.as_completed(validations):
                result = await task
                if not result:
                    continue
                context_entry, config_file, server = result
                name = context_entry['name']
                self.contexts.append(context_entry)
                self._context_sources[name] = config_file
                self._context_details[name] = self._context_detail(context_entry, config_file, server)
                if self.active_context_name is None or name == configured_active_context:
                    self.active_context_name = name
        finally:
            self.discovering = False

    async def get_client(self, context_name: str = None) -> ApiClient:
        target_context = context_name or self.active_context_name
        # A pop-out window can request a context before the background pass has
        # reached it. Wait for that one discovery pass instead of falling back
        # to an unrelated kubeconfig file.
        if target_context and target_context not in self._context_sources and self._discovery_task and not self._discovery_task.done():
            await asyncio.shield(self._discovery_task)
        if not target_context:
            raise Exception('No reachable Kubernetes context is available')
        if target_context in self._clients:
            return self._clients[target_context]
        try:
            client = await config.new_client_from_config(
                config_file=self._context_sources.get(target_context) or self._resolve_kubeconfig_path(),
                context=target_context,
                persist_config=False,
            )
            self._clients[target_context] = client
            return client
        except Exception as error:
            print(f'Error creating client for context {target_context}: {error}')
            raise

    def get_context_source(self, context_name):
        return self._context_sources.get(context_name)

    async def list_contexts(self):
        if self._discovery_task is None:
            await self.start_discovery()
        details = []
        for context_entry in self.contexts:
            name = context_entry['name']
            detail = dict(self._context_details[name])
            detail['favorite'] = bool(self.get_cluster_setting(name, 'favorite', False))
            details.append(detail)
        return {
            'contexts': [entry['name'] for entry in self.contexts],
            'active_context': self.active_context_name,
            'details': details,
            'discovering': self.discovering,
        }

    async def merge_kubeconfig(self, yaml_content: str):
        try:
            import yaml
            new_config = yaml.safe_load(yaml_content)
            config_path = self._resolve_kubeconfig_path() or os.path.expanduser('~/.kube/config')
            os.makedirs(os.path.dirname(config_path), exist_ok=True)
            if os.path.exists(config_path):
                with open(config_path, 'r') as f:
                    current_config = yaml.safe_load(f)
            else:
                current_config = {'apiVersion': 'v1', 'clusters': [], 'contexts': [], 'users': [], 'kind': 'Config'}
            current_config['clusters'].extend(new_config.get('clusters', []))
            current_config['users'].extend(new_config.get('users', []))
            current_config['contexts'].extend(new_config.get('contexts', []))
            if os.path.exists(config_path):
                import shutil
                shutil.copy(config_path, f'{config_path}.bak')
            with open(config_path, 'w') as f:
                yaml.dump(current_config, f)
            await self.load_kubeconfig()
            return True
        except Exception as error:
            print(f'Error merging kubeconfig: {error}')
            raise


cluster_manager = ClusterManager()
