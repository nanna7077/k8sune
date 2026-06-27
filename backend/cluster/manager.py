from kubernetes_asyncio import config
from kubernetes_asyncio.client import ApiClient, CoreV1Api
import os
import json

class ClusterManager:
    def __init__(self):
        self.contexts = []
        self.active_context_name = None
        self._clients = {} # Cache clients per context
        self.settings_path = os.path.expanduser('~/.k8sune_settings.json')
        self.cluster_settings = self._load_settings()

    def _load_settings(self):
        if os.path.exists(self.settings_path):
            try:
                with open(self.settings_path, 'r') as f:
                    return json.load(f)
            except:
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

    async def load_kubeconfig(self):
        try:
            # Load all contexts (synchronous function in kubernetes_asyncio.config)
            contexts, active_context = config.list_kube_config_contexts()
            self.contexts = contexts
            self.active_context_name = active_context.get('name') if active_context else None
            return True
        except Exception as e:
            print(f"Error loading kubeconfig: {e}")
            return False

    async def get_client(self, context_name: str = None) -> ApiClient:
        target_context = context_name or self.active_context_name
        
        if not target_context:
            raise Exception("No active context or context name provided")

        if target_context in self._clients:
            return self._clients[target_context]

        # Create new client for this context
        try:
            # We use a temporary config loading just for this client
            # kubernetes_asyncio doesn't easily support loading a specific context 
            # into a standalone ApiClient without global side effects in 'config.load_kube_config'
            # However, we can use 'new_client_from_config' equivalent if it exists or 
            # just re-load it.
            
            # For now, let's load it globally but we might need to be more surgical later
            await config.load_kube_config(context=target_context)
            client = ApiClient()
            self._clients[target_context] = client
            return client
        except Exception as e:
            print(f"Error creating client for context {target_context}: {e}")
            raise

    async def list_contexts(self):
        if not self.contexts:
            await self.load_kubeconfig()
        return {
            "contexts": [c['name'] for c in self.contexts],
            "active_context": self.active_context_name
        }

    async def merge_kubeconfig(self, yaml_content: str):
        try:
            import yaml
            new_config = yaml.safe_load(yaml_content)
            
            config_path = os.path.expanduser('~/.kube/config')
            os.makedirs(os.path.dirname(config_path), exist_ok=True)
            
            if os.path.exists(config_path):
                with open(config_path, 'r') as f:
                    current_config = yaml.safe_load(f)
            else:
                current_config = {"apiVersion": "v1", "clusters": [], "contexts": [], "users": [], "kind": "Config"}

            # Simple merge logic: append clusters, users, contexts
            # In a real scenario, we'd check for duplicates
            current_config['clusters'].extend(new_config.get('clusters', []))
            current_config['users'].extend(new_config.get('users', []))
            current_config['contexts'].extend(new_config.get('contexts', []))

            # Backup current config
            if os.path.exists(config_path):
                import shutil
                shutil.copy(config_path, f"{config_path}.bak")

            with open(config_path, 'w') as f:
                yaml.dump(current_config, f)
            
            # Reload contexts
            await self.load_kubeconfig()
            return True
        except Exception as e:
            print(f"Error merging kubeconfig: {e}")
            raise e

cluster_manager = ClusterManager()
