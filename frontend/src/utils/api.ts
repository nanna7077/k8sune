import { invoke } from '@tauri-apps/api/core';

let backendPort: number | null = null;

export const getBackendPort = async (): Promise<number> => {
  if (backendPort !== null && backendPort !== 0) return backendPort;
  
  let attempts = 0;
  while (attempts < 150) {
    backendPort = await invoke<number>('get_backend_port');
    if (backendPort !== 0) return backendPort;
    await new Promise(resolve => setTimeout(resolve, 300));
    attempts++;
  }
  
  throw new Error("Backend port not initialized");
};

export const apiFetch = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const port = await getBackendPort();
  const response = await fetch(`http://127.0.0.1:${port}${path}`, options);
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }
  
  return response.json();
};
