import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

export const openSectionWindow = async (section: string, params: Record<string, string>) => {
  const query = new URLSearchParams(params).toString();
  const label = `window-${section}-${params.context}-${params.name || ''}-${Math.random().toString(36).substring(7)}`;
  
  const webview = new WebviewWindow(label, {
    url: `/?section=${section}&${query}`,
    title: `k8sune - ${section} [${params.name || params.context}]`,
    width: section === 'logs' || section === 'yaml' ? 1000 : 1200,
    height: 800,
    decorations: false,
  });

  webview.once('tauri://created', () => {
    console.log(`Window ${label} created`);
  });

  webview.once('tauri://error', (e) => {
    console.error(`Error creating window ${label}`, e);
  });
};
