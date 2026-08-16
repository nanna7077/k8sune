import { create } from 'zustand';
import { DEFAULT_ACCENT, type AccentId } from '../themes/tokens';

const accentStorageKey = 'k8sune-accent';
const storedAccent = (): AccentId => {
  const value = localStorage.getItem(accentStorageKey);
  return value === 'violet' || value === 'rose' || value === 'amber' || value === 'mint' || value === 'indigo' ? value : DEFAULT_ACCENT;
};

interface AppState {
  status: 'idle' | 'loading' | 'success' | 'error' | 'connecting';
  error: string | null;
  contexts: string[];
  activeContext: string | null;
  accent: AccentId;
  setStatus: (status: AppState['status']) => void;
  setError: (error: string | null) => void;
  setContexts: (contexts: string[]) => void;
  setActiveContext: (context: string | null) => void;
  setAccent: (accent: AccentId) => void;
}

export const useStore = create<AppState>((set) => ({
  status: 'idle',
  error: null,
  contexts: [],
  activeContext: null,
  accent: storedAccent(),
  setStatus: (status) => set({ status }),
  setError: (error) => set({ error }),
  setContexts: (contexts) => set({ contexts }),
  setActiveContext: (activeContext) => set({ activeContext }),
  setAccent: (accent) => {
    localStorage.setItem(accentStorageKey, accent);
    set({ accent });
  },
}));
