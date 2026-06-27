import { useEffect } from 'react';
import { 
  FluentProvider
} from "@fluentui/react-components";
import { k8suneTheme } from './themes/tokens';
import { useStore } from './store/useStore';
import { Dashboard } from './components/Dashboard';
import { LogsViewer } from './components/LogsViewer';
import { YamlEditor } from './components/YamlEditor';
import { TitleBar } from './components/TitleBar';
import { WindowResizer } from './components/WindowResizer';

function App() {
  const { 
    activeContext
  } = useStore();

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

  if (section === 'logs' && context && pod) {
    return (
      <FluentProvider theme={k8suneTheme} style={{ height: '100%' }}>
        <TitleBar title={`k8sune - Logs [${pod}]`} />
        <WindowResizer />
        <div style={{ paddingTop: '32px', height: '100%', width: '100%', boxSizing: 'border-box' }}>
          <LogsViewer context={context} namespace={namespace} pod={pod} />
        </div>
      </FluentProvider>
    );
  }

  if (section === 'yaml' && context && name && resourceType) {
    return (
      <FluentProvider theme={k8suneTheme} style={{ height: '100%' }}>
        <TitleBar title={`k8sune - YAML [${name}]`} />
        <WindowResizer />
        <div style={{ paddingTop: '32px', height: '100%', width: '100%', boxSizing: 'border-box' }}>
          <YamlEditor context={context} namespace={namespace} name={name} resourceType={resourceType} />
        </div>
      </FluentProvider>
    );
  }

  return (
    <FluentProvider theme={k8suneTheme} style={{ height: '100%' }}>
       <TitleBar />
       <WindowResizer />
       <div style={{ paddingTop: '32px', height: '100%', width: '100%', boxSizing: 'border-box' }}>
          <Dashboard context={context} />
       </div>
    </FluentProvider>
  );
}

export default App;
