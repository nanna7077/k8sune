import { useEffect, useMemo } from 'react';
import { 
  FluentProvider
} from "@fluentui/react-components";
import { ACCENT_OPTIONS, getK8suneTheme } from './themes/tokens';
import { useStore } from './store/useStore';
import { Dashboard } from './components/Dashboard';
import { LogsViewer } from './components/LogsViewer';
import { YamlEditor } from './components/YamlEditor';
import { TitleBar } from './components/TitleBar';
import { WindowResizer } from './components/WindowResizer';
import { NodeCommandRunner } from './components/NodeCommandRunner';

function App() {
  const { 
    activeContext,
    accent,
  } = useStore();
  const theme = useMemo(() => getK8suneTheme(accent), [accent]);

  useEffect(() => {
    const color = ACCENT_OPTIONS.find(option => option.id === accent)?.color ?? ACCENT_OPTIONS[0].color;
    document.documentElement.style.setProperty('--accent', color);
    document.documentElement.style.setProperty('--accent-bg', `${color}1f`);
    document.documentElement.style.setProperty('--accent-border', `${color}52`);
  }, [accent]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const section = urlParams.get('section');
    const context = urlParams.get('context');
    
    // If we are a child window (logs/yaml), we stay in that mode
    if (section && context) {
       // Handled by return logic below
    } else {
      // Main window logic: if no context is selected, Dashboard will handle it
    }
  }, []);

  const urlParams = new URLSearchParams(window.location.search);
  const section = urlParams.get('section');
  const context = urlParams.get('context') || activeContext || '';
  const namespace = urlParams.get('namespace') || 'default';
  const name = urlParams.get('name') || '';
  const pod = urlParams.get('pod') || '';
  const resourceType = urlParams.get('resourceType') || '';
  const view = urlParams.get('view') || '';
  const resourceNamespace = urlParams.get('namespace') || undefined;

  if (section === 'logs' && context && pod) {
    return (
      <FluentProvider theme={theme} style={{ height: '100%' }}>
        <TitleBar title={`k8sune - Logs [${pod}]`} />
        <WindowResizer />
        <div style={{ paddingTop: '32px', height: '100%', minHeight: 0, width: '100%', boxSizing: 'border-box' }}>
          <LogsViewer context={context} namespace={namespace} pod={pod} />
        </div>
      </FluentProvider>
    );
  }

  if (section === 'yaml' && context && name && resourceType) {
    return (
      <FluentProvider theme={theme} style={{ height: '100%' }}>
        <TitleBar title={`k8sune - YAML [${name}]`} />
        <WindowResizer />
        <div style={{ paddingTop: '32px', height: '100%', minHeight: 0, width: '100%', boxSizing: 'border-box' }}>
          <YamlEditor context={context} namespace={namespace} name={name} resourceType={resourceType} />
        </div>
      </FluentProvider>
    );
  }

  if (section === 'resource' && context && name && resourceType) {
    return (
      <FluentProvider theme={theme} style={{ height: '100%' }}>
        <TitleBar title={`k8sune - ${name}`} />
        <WindowResizer />
        <div style={{ paddingTop: '32px', height: '100%', minHeight: 0, width: '100%', boxSizing: 'border-box' }}>
          <Dashboard context={context} initialResource={{ type: resourceType, name, namespace: resourceNamespace }} />
        </div>
      </FluentProvider>
    );
  }

  if (section === 'view' && context && view) {
    return (
      <FluentProvider theme={theme} style={{ height: '100%' }}>
        <TitleBar title={`k8sune - ${view}`} />
        <WindowResizer />
        <div style={{ paddingTop: '32px', height: '100%', minHeight: 0, width: '100%', boxSizing: 'border-box' }}>
          <Dashboard context={context} initialView={view} />
        </div>
      </FluentProvider>
    );
  }

  if (section === 'node-command' && context) {
    return <FluentProvider theme={theme} style={{ height: '100%' }}><TitleBar title="k8sune - Run on Nodes" /><WindowResizer /><NodeCommandRunner context={context} /></FluentProvider>;
  }

  return (
    <FluentProvider theme={theme} style={{ height: '100%' }}>
       <TitleBar />
       <WindowResizer />
       <div style={{ paddingTop: '32px', height: '100%', minHeight: 0, width: '100%', boxSizing: 'border-box' }}>
          <Dashboard context={context} />
       </div>
    </FluentProvider>
  );
}

export default App;
