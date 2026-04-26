from kubernetes_asyncio import config
from kubernetes_asyncio.client import ApiClient, CoreV1Api
import os

class ClusterManager:
    def __init__(self):
        self.contexts = []
        self.active_context_name = None
        self._clients = {} # Cache clients per context

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

cluster_manager = ClusterManager()
