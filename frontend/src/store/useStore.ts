import { create } from 'zustand';

interface AppState {
  status: 'idle' | 'loading' | 'success' | 'error' | 'connecting';
  error: string | null;
  contexts: string[];
  activeContext: string | null;
  setStatus: (status: AppState['status']) => void;
  setError: (error: string | null) => void;
  setContexts: (contexts: string[]) => void;
  setActiveContext: (context: string | null) => void;
}

export const useStore = create<AppState>((set) => ({
  status: 'idle',
  error: null,
  contexts: [],
  activeContext: null,
  setStatus: (status) => set({ status }),
  setError: (error) => set({ error }),
  setContexts: (contexts) => set({ contexts }),
  setActiveContext: (activeContext) => set({ activeContext }),
}));
