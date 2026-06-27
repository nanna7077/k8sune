import { useEffect, useState, useRef, useMemo } from 'react';
import { 
  makeStyles, 
  shorthands, 
  Table, 
  TableHeader, 
  TableRow, 
  TableHeaderCell, 
  TableBody, 
  TableCell,
  Badge,
  Spinner,
  Subtitle1,
  Subtitle2,
  Title2,
  Title3,
  Button,
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
  Input,
  PresenceBadge,
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogTitle,
  DialogContent,
  DialogBody,
  DialogActions,
  Label,
  TabList,
  Tab,
  Accordion,
  AccordionItem,
  AccordionHeader,
  AccordionPanel,
  ProgressBar,
  Card,
  CardHeader,
  Dropdown,
  Option,
  Textarea
} from "@fluentui/react-components";
import { 
  MoreHorizontal20Regular, 
  Document20Regular, 
  TextBulletList20Regular, 
  Settings20Regular,
  Search20Regular,
  ArrowClockwise20Regular,
  Grid20Regular,
  Box20Regular,
  Database20Regular,
  Layer20Regular,
  Info20Regular,
  Dismiss16Regular,
  Apps20Regular,
  Link20Regular,
  ShieldLock20Regular,
  Storage20Regular,
  Cube20Regular,
  ArrowSortDown20Regular,
  ArrowSortUp20Regular,
  ChevronLeft20Regular,
  Warning20Regular,
  CheckmarkCircle20Regular,
  ArrowUpload20Regular,
  Add20Regular,
  WindowConsole20Regular
} from '@fluentui/react-icons';
import { apiFetch, getBackendPort } from '../utils/api';
import { openSectionWindow } from '../utils/windowManager';
import { useStore } from '../store/useStore';
import { Mascot } from './Mascot';
import { LogsViewer } from './LogsViewer';
import { YamlEditor } from './YamlEditor';
import { ShellTerminal } from './ShellTerminal';
import { open } from '@tauri-apps/plugin-dialog';
import { readTextFile } from '@tauri-apps/plugin-fs';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    height: '100%',
    width: '100%',
    backgroundColor: 'transparent',
    color: 'var(--colorNeutralForeground1)',
    overflow: 'hidden'
  },
  sidebar: {
    width: '260px',
    backgroundColor: 'var(--colorNeutralBackground2)',
    ...shorthands.borderRight('1px', 'solid', 'var(--colorNeutralStroke1)'),
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.padding('1.5rem', '1rem'),
    gap: '1.5rem',
    overflowY: 'auto'
  },
  mainContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100vh - 32px)',
    overflow: 'hidden'
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    backgroundColor: '#09090b',
  },
  drawer: {
    backgroundColor: 'var(--colorNeutralBackground2)',
    ...shorthands.borderTop('1px', 'solid', 'var(--colorNeutralStroke1)'),
    display: 'flex',
    flexDirection: 'column',
    zIndex: 10,
    position: 'relative'
  },
  resizer: {
    height: '4px',
    width: '100%',
    cursor: 'ns-resize',
    position: 'absolute',
    top: '-2px',
    left: 0,
    zIndex: 20,
    backgroundColor: 'transparent',
    transition: 'background-color 0.2s',
    '&:hover': {
      backgroundColor: 'var(--colorBrandForeground1)',
    }
  },
  drawerHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'var(--colorNeutralBackground3)',
    ...shorthands.borderBottom('1px', 'solid', 'var(--colorNeutralStroke1)'),
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...shorthands.padding('1.5rem', '2rem'),
    ...shorthands.borderBottom('1px', 'solid', 'var(--colorNeutralStroke1)'),
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    ...shorthands.padding('2rem'),
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
    backgroundColor: '#09090b',
  },
  tableCard: {
    backgroundColor: 'var(--colorNeutralBackground2)',
    ...shorthands.border('1px', 'solid', 'var(--colorNeutralStroke1)'),
    ...shorthands.borderRadius('8px'),
    overflow: 'hidden'
  },
  tabList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  sidebarItem: {
    justifyContent: 'flex-start',
    ...shorthands.padding('8px', '12px'),
    fontSize: '0.85rem',
    width: '100%',
    textAlign: 'left'
  },
  sidebarSubItem: {
    justifyContent: 'flex-start',
    ...shorthands.padding('6px', '24px'),
    fontSize: '0.8rem',
    width: '100%',
    textAlign: 'left',
    opacity: 0.8
  },
  contextDropdown: {
    width: '100%',
    backgroundColor: 'var(--colorNeutralBackground3)',
    ...shorthands.borderRadius('6px'),
    ...shorthands.padding('8px', '12px'),
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...shorthands.border('1px', 'solid', 'var(--colorNeutralStroke1)'),
    '&:hover': {
      backgroundColor: 'var(--colorNeutralBackground4)',
    }
  },
  closeTabButton: {
    marginLeft: '6px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    ...shorthands.borderRadius('2px'),
    '&:hover': {
      backgroundColor: 'rgba(255,255,255,0.1)'
    }
  },
  overviewGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '1.5rem',
  },
  metricCard: {
    backgroundColor: 'var(--colorNeutralBackground2)',
    ...shorthands.border('1px', 'solid', 'var(--colorNeutralStroke1)'),
    ...shorthands.borderRadius('8px'),
    ...shorthands.padding('1.5rem'),
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem'
  },
  infoItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...shorthands.padding('4px', '0'),
    ...shorthands.borderBottom('1px', 'solid', 'rgba(255,255,255,0.05)')
  },
  progressBarContainer: {
    width: '100px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  settingsContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
    ...shorthands.padding('1rem', '0'),
  },
  clickableName: {
    color: 'var(--colorBrandForeground1)',
    cursor: 'pointer',
    fontWeight: '600',
    '&:hover': {
      textDecorationLine: 'underline'
    }
  },
  detailView: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2rem'
  },
  detailSection: {
     display: 'flex',
     flexDirection: 'column',
     gap: '1rem'
  },
  kvTable: {
      display: 'grid',
      gridTemplateColumns: '150px 1fr',
      gap: '8px',
      fontSize: '0.85rem'
  },
  headerControls: {
    display: 'flex',
    gap: '1rem',
    alignItems: 'center'
  },
  namespaceDropdown: {
    minWidth: '180px',
  }
});

interface ResourceItem {
  name: string;
  namespace?: string;
  status?: string;
  creation_timestamp?: string;
  [key: string]: any;
}

interface CRD {
  name: string;
  group: string;
  version: string;
  kind: string;
  plural: string;
  scope: string;
}

interface PanelState {
  id: string;
  type: 'logs' | 'yaml' | 'shell';
  namespace: string;
  name: string;
  container?: string;
}

interface ResourceDetail {
    metadata: any;
    status: any;
    spec?: any;
    counts?: any;
    usage?: any;
    pods?: any[];
}

const NATIVE_OTHERS = [
  { label: 'Services', plural: 'services', group: 'core', version: 'v1' },
  { label: 'Ingresses', plural: 'ingresses', group: 'networking.k8s.io', version: 'v1' },
  { label: 'ReplicaSets', plural: 'replicasets', group: 'apps', version: 'v1' },
  { label: 'Jobs', plural: 'jobs', group: 'batch', version: 'v1' },
];

export const Dashboard = ({ context: initialContext }: { context: string }) => {
  const styles = useStyles();
  const { 
    contexts, 
    activeContext, 
    setContexts, 
    setActiveContext
  } = useStore();

  const [activeView, setActiveView] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [panels, setPanels] = useState<PanelState[]>([]);
  const [activePanelId, setActivePanelId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importTab, setImportTab] = useState('file');
  const [importYaml, setImportYaml] = useState('');
  const [drawerHeight, setDrawerHeight] = useState(400);
  const isResizing = useRef(false);
  
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [metrics, setMetrics] = useState<Record<string, any>>({});
  const [crds, setCrds] = useState<CRD[]>([]);
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [selectedNamespaces, setSelectedNamespaces] = useState<string[]>(['All Namespaces']);
  const [clusterSettings, setClusterSettings] = useState<any>({ metrics_source: 'standard' });
  const [overview, setOverview] = useState<any>(null);
  const [selectedResource, setSelectedResource] = useState<{ type: string, name: string, namespace?: string } | null>(null);
  const [resourceDetail, setResourceDetail] = useState<ResourceDetail | null>(null);
  const [detailTab, setDetailTab] = useState('overview');
  const [detailPods, setDetailPods] = useState<ResourceItem[]>([]);
  const [detailEvents, setDetailEvents] = useState<any[]>([]);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const [isReachable, setIsReachable] = useState<boolean>(true);

  // Sorting state
  const [sortState, setSortState] = useState<{ columnId: string, direction: 'ascending' | 'descending' }>({ 
    columnId: 'name', 
    direction: 'ascending' 
  });

  const context = activeContext || initialContext;

  const fetchContexts = async () => {
    try {
      const data = await apiFetch<{ contexts: string[], active_context: string }>('/api/contexts');
      setContexts(data.contexts);
      if (!activeContext) setActiveContext(data.active_context);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchNamespaces = async () => {
    if (!context) return;
    try {
      const data = await apiFetch<{ items: any[] }>(`/api/resources/${context}/namespaces`);
      setNamespaces(data.items.map(n => n.name));
    } catch (e) {
      console.error(e);
    }
  };

  const fetchClusterSettings = async () => {
      if (!context) return;
      try {
          const data = await apiFetch<any>(`/api/contexts/settings/${context}`);
          setClusterSettings(data || { metrics_source: 'standard' });
      } catch (e) {
          console.error(e);
      }
  }

  const saveClusterSettings = async (newSettings: any) => {
      if (!context) return;
      try {
          await apiFetch(`/api/contexts/settings/${context}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ settings: newSettings })
          });
          setClusterSettings(newSettings);
      } catch (e) {
          alert(`Failed to save settings: ${e}`);
      }
  }

  const loadData = async () => {
    if (!context) return;
    setLoading(true);
    try {
      if (activeView === 'overview') {
        const data = await apiFetch<any>(`/api/resources/${context}/overview`);
        setOverview(data);
      } else if (activeView === 'crds_list') {
         const data = await apiFetch<{ items: CRD[] }>(`/api/crds/${context}`);
         setCrds(data.items);
      } else if (activeView.startsWith('custom_')) {
         const plural = activeView.replace('custom_', '');
         const crd = crds.find(c => c.plural === plural);
         if (crd) {
            const data = await apiFetch<{ items: ResourceItem[] }>(
              `/api/resources/${context}/generic/${crd.group}/${crd.version}/${crd.plural}`
            );
            setResources(data.items);
         }
      } else if (activeView.startsWith('other_')) {
          const plural = activeView.replace('other_', '');
          const other = NATIVE_OTHERS.find(o => o.plural === plural);
          if (other) {
            const data = await apiFetch<{ items: ResourceItem[] }>(`/api/resources/${context}/${plural}`);
            setResources(data.items);
          }
      } else {
        const data = await apiFetch<{ items: ResourceItem[] }>(`/api/resources/${context}/${activeView}`);
        setResources(data.items);
      }
      
      if (activeView === 'pods') {
        setupWatch();
      } else {
        if (eventSourceRef.current) eventSourceRef.current.close();
      }
      setIsReachable(true);
    } catch (e) {
      console.error(e);
      setIsReachable(false);
    } finally {
      setLoading(false);
    }
  };

  const fetchMetrics = async () => {
    if (!context || (activeView !== 'pods' && activeView !== 'nodes' && activeView !== 'deployments' && !selectedResource)) return;
    try {
        const resourceType = selectedResource ? (selectedResource.type === 'nodes' ? 'nodes' : 'pods') : (activeView === 'nodes' ? 'nodes' : 'pods');
        const ns = selectedResource?.namespace || (selectedNamespaces.includes('All Namespaces') ? '' : selectedNamespaces[0]);
        
        let url = `/api/resources/${context}/metrics/${resourceType}`;
        if (ns) url += `?namespace=${ns}`;

        const data = await apiFetch<any>(url);
        if (data.items) {
            const newMetrics: Record<string, any> = {};
            data.items.forEach((item: any) => {
                const name = item.metadata.name;
                const ns = item.metadata.namespace;
                const key = ns ? `${ns}/${name}` : name;
                newMetrics[key] = item;
            });
            setMetrics(newMetrics);
        }
    } catch (e) {
        console.error("Metrics fetch failed", e);
    }
  };

  const loadResourceDetail = async () => {
      if (!selectedResource || !context) return;
      setLoading(true);
      setResourceDetail(null);
      try {
          const type = selectedResource.type;
          const name = selectedResource.name;
          const ns = selectedResource.namespace || 'default';
          
          let endpoint = "";
          if (type === 'nodes') endpoint = `/api/resources/${context}/nodes/${name}`;
          else if (type === 'pods') endpoint = `/api/resources/${context}/pods/${ns}/${name}`;
          else if (type === 'deployments') endpoint = `/api/resources/${context}/deployments/${ns}/${name}`;
          else if (type === 'statefulsets') endpoint = `/api/resources/${context}/statefulsets/${ns}/${name}`;
          else if (type === 'daemonsets') endpoint = `/api/resources/${context}/daemonsets/${ns}/${name}`;
          else if (type === 'cronjobs') endpoint = `/api/resources/${context}/cronjobs/${ns}/${name}`;
          else if (type === 'namespaces') endpoint = `/api/resources/${context}/namespaces/${name}`;
          else if (type === 'services' || type === 'other_services') endpoint = `/api/resources/${context}/services/${ns}/${name}`;
          else if (type === 'ingresses' || type === 'other_ingresses') endpoint = `/api/resources/${context}/ingresses/${ns}/${name}`;
          else if (type === 'replicasets' || type === 'other_replicasets') endpoint = `/api/resources/${context}/replicasets/${ns}/${name}`;
          else if (type === 'jobs' || type === 'other_jobs') endpoint = `/api/resources/${context}/jobs/${ns}/${name}`;
          else if (type.startsWith('custom_')) {
              const plural = type.replace('custom_', '');
              const crd = crds.find(c => c.plural === plural);
              if (crd) {
                  const itemNamespace = selectedResource.namespace;
                  if (itemNamespace && itemNamespace !== 'Cluster') {
                      endpoint = `/api/resources/${context}/custom/${crd.group}/${crd.version}/${crd.plural}/${itemNamespace}/${name}`;
                  } else {
                      endpoint = `/api/resources/${context}/custom/${crd.group}/${crd.version}/${crd.plural}/${name}`;
                  }
              }
          }
          
          if (endpoint) {
              try {
                  const data = await apiFetch<ResourceDetail>(endpoint);
                  setResourceDetail(data);

                  if ((type === 'deployments' || type === 'statefulsets' || type === 'daemonsets') && data.spec?.selector) {
                      const selector = Object.entries(data.spec.selector).map(([k, v]) => `${k}=${v}`).join(',');
                      const podsData = await apiFetch<{ items: ResourceItem[] }>(`/api/resources/${context}/pods/selector/${ns}?label_selector=${encodeURIComponent(selector)}`);
                      setDetailPods(podsData.items);
                  }
              } catch (err) {
                  console.error("Failed to load core resource details", err);
              }
          }

          if (type === 'nodes') {
              try {
                  const podsData = await apiFetch<{ items: ResourceItem[] }>(`/api/resources/${context}/pods/node/${name}`);
                  setDetailPods(podsData.items);
              } catch (err) {
                  console.error("Failed to load node pods", err);
              }
          }

          try {
              const eventsData = await apiFetch<{ items: any[] }>(`/api/resources/${context}/events/${ns}/${name}`);
              setDetailEvents(eventsData.items || []);
          } catch (err) {
              console.error("Failed to load resource events", err);
              setDetailEvents([]);
          }
      } catch (e) {
          console.error(e);
      } finally {
          setLoading(false);
      }
  }

  const handleImport = async () => {
      let content = importYaml;
      if (importTab === 'file') {
          try {
              const selected = await open({
                  filters: [{ name: 'Kubeconfig', extensions: ['yaml', 'yml', 'conf', 'config'] }]
              });
              if (selected && !Array.isArray(selected)) {
                  content = await readTextFile(selected);
              } else return;
          } catch (e) {
              alert(`Error reading file: ${e}`);
              return;
          }
      }

      if (!content) {
          alert('No kubeconfig content provided');
          return;
      }

      setLoading(true);
      try {
          await apiFetch('/api/contexts/import', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ yaml_content: content })
          });
          setIsImportOpen(false);
          setImportYaml('');
          await fetchContexts();
          alert('Kubeconfig imported and merged successfully');
      } catch (e) {
          alert(`Import failed: ${e}`);
      } finally {
          setLoading(false);
      }
  }

  const setupWatch = async () => {
    if (eventSourceRef.current) eventSourceRef.current.close();
    if (!context) return;
    
    try {
      const port = await getBackendPort();
      const es = new EventSource(`http://127.0.0.1:${port}/api/resources/${context}/pods/watch`);
      
      es.onmessage = (event) => {
        const update = JSON.parse(event.data);
        if (activeView === 'pods') {
            setResources(currentResources => {
              const pod = update.object;
              if (update.type === 'ADDED' || update.type === 'MODIFIED') {
                const index = currentResources.findIndex(p => p.name === pod.name && p.namespace === pod.namespace);
                if (index > -1) {
                  const newRes = [...currentResources];
                  newRes[index] = pod;
                  return newRes;
                } else {
                  return [...currentResources, pod];
                }
              } else if (update.type === 'DELETED') {
                return currentResources.filter(p => p.name !== pod.name || p.namespace !== pod.namespace);
              }
              return currentResources;
            });
        }
      };
      eventSourceRef.current = es;
    } catch (e) {
      console.error("Watch failed", e);
    }
  };

  const handleOpenLogs = (namespace: string, name: string) => {
    const id = `logs-${namespace}-${name}`;
    if (!panels.find(p => p.id === id)) {
      setPanels(prev => [...prev, { id, type: 'logs', namespace, name }]);
    }
    setActivePanelId(id);
  };

  const handleOpenYaml = (namespace: string, name: string) => {
    const id = `yaml-${namespace}-${name}`;
    if (!panels.find(p => p.id === id)) {
      setPanels(prev => [...prev, { id, type: 'yaml', namespace, name }]);
    }
    setActivePanelId(id);
  };

  const handleOpenShell = (namespace: string, pod: string, container: string) => {
    const id = `shell-${namespace}-${pod}-${container}`;
    if (!panels.find(p => p.id === id)) {
      setPanels(prev => [...prev, { id, type: 'shell', namespace, name: pod, container }]);
    }
    setActivePanelId(id);
  };

  const handleClosePanel = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setPanels(prev => {
      const newPanels = prev.filter(p => p.id !== id);
      if (activePanelId === id) {
        setActivePanelId(newPanels.length > 0 ? newPanels[newPanels.length - 1].id : null);
      }
      return newPanels;
    });
  };

  const handlePopOut = (panel: PanelState) => {
    if (!context) return;
    if (panel.type === 'logs') {
      openSectionWindow('logs', { context, namespace: panel.namespace, pod: panel.name });
    } else if (panel.type === 'yaml') {
      openSectionWindow('yaml', { context, namespace: panel.namespace, name: panel.name, resourceType: activeView === 'pods' ? 'pods' : 'deployments' });
    }
    handleClosePanel(panel.id);
  };

  const handleSelectCRD = (crd: CRD) => {
    setActiveView(`custom_${crd.plural}`);
    setSelectedResource(null);
  };

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopResizing);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing.current) return;
    const newHeight = window.innerHeight - e.clientY;
    if (newHeight > 100 && newHeight < window.innerHeight * 0.8) {
      setDrawerHeight(newHeight);
    }
  };

  const stopResizing = () => {
    isResizing.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', stopResizing);
  };

  useEffect(() => {
    fetchContexts();
  }, []);

  useEffect(() => {
    loadData();
    fetchNamespaces();
    fetchClusterSettings();
    if (crds.length === 0 && context) {
        apiFetch<{ items: CRD[] }>(`/api/crds/${context}`).then(data => setCrds(data.items));
    }

    const metricsInterval = setInterval(fetchMetrics, 30000);
    fetchMetrics();

    return () => {
      if (eventSourceRef.current) eventSourceRef.current.close();
      clearInterval(metricsInterval);
    };
  }, [activeView, context, selectedResource]);

  useEffect(() => {
      if (selectedResource) {
          setDetailTab('overview');
          loadResourceDetail();
      }
  }, [selectedResource]);

  const sortedAndFilteredResources = useMemo(() => {
    const isAllNamespaces = selectedNamespaces.includes('All Namespaces');
    const filtered = resources.filter(r => {
        const matchesNamespace = isAllNamespaces || (r.namespace && selectedNamespaces.includes(r.namespace)) || !r.namespace;
        if (!matchesNamespace) return false;

        const searchLower = search.toLowerCase();
        return (
            r.name.toLowerCase().includes(searchLower) ||
            (r.namespace && r.namespace.toLowerCase().includes(searchLower)) ||
            (r.internal_ip && r.internal_ip.includes(searchLower)) ||
            (r.external_ip && r.external_ip.includes(searchLower)) ||
            (r.os && r.os.toLowerCase().includes(searchLower))
        );
    });

    if (!sortState.columnId) return filtered;

    return [...filtered].sort((a, b) => {
        let valA: any = a[sortState.columnId];
        let valB: any = b[sortState.columnId];

        if (sortState.columnId.endsWith('_usage')) {
            const usageA = a[sortState.columnId];
            const usageB = b[sortState.columnId];
            if (usageA && usageB) {
                valA = (usageA.reserved || usageA.current) / usageA.total;
                valB = (usageB.reserved || usageB.current) / usageB.total;
            }
        }

        if (valA < valB) return sortState.direction === 'ascending' ? -1 : 1;
        if (valA > valB) return sortState.direction === 'ascending' ? 1 : -1;
        return 0;
    });
  }, [resources, search, sortState, selectedNamespaces]);

  const toggleSort = (columnId: string) => {
    setSortState(prev => ({
        columnId,
        direction: prev.columnId === columnId && prev.direction === 'ascending' ? 'descending' : 'ascending'
    }));
  };

  const renderSortIcon = (columnId: string) => {
    if (sortState.columnId !== columnId) return null;
    return sortState.direction === 'ascending' ? <ArrowSortUp20Regular /> : <ArrowSortDown20Regular />;
  };

  const renderTableHeaders = () => {
    const sortableHeader = (id: string, label: string) => (
        <TableHeaderCell key={id} onClick={() => toggleSort(id)} style={{ cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {label} {renderSortIcon(id)}
            </div>
        </TableHeaderCell>
    );

    const common = [
      sortableHeader('name', 'Name'),
      sortableHeader('namespace', 'Namespace')
    ];

    switch (activeView) {
      case 'nodes':
        return [
          sortableHeader('name', 'Name'),
          sortableHeader('status', 'Status'),
          sortableHeader('internal_ip', 'Internal IP'),
          sortableHeader('external_ip', 'External IP'),
          sortableHeader('os', 'OS / Arch'),
          sortableHeader('cpu_usage', 'CPU Util'),
          sortableHeader('mem_usage', 'Mem Util'),
          sortableHeader('pod_usage', 'Pods Util'),
          sortableHeader('creation_timestamp', 'Age'),
          <TableHeaderCell key="actions" style={{ width: '40px' }}></TableHeaderCell>
        ];
      case 'pods':
        return [
          ...common,
          sortableHeader('status', 'Status'),
          sortableHeader('cpu', 'CPU'),
          sortableHeader('mem', 'Memory'),
          sortableHeader('ip', 'IP Address'),
          <TableHeaderCell key="actions" style={{ width: '40px' }}></TableHeaderCell>
        ];
      case 'deployments':
      case 'statefulsets':
        return [
          ...common,
          sortableHeader('replicas', 'Replicas'),
          sortableHeader('ready_replicas', 'Ready'),
          <TableHeaderCell key="actions" style={{ width: '40px' }}></TableHeaderCell>
        ];
      case 'daemonsets':
        return [
          ...common,
          sortableHeader('desired', 'Desired'),
          sortableHeader('ready', 'Ready'),
          <TableHeaderCell key="actions" style={{ width: '40px' }}></TableHeaderCell>
        ];
      case 'cronjobs':
        return [
          ...common,
          sortableHeader('schedule', 'Schedule'),
          sortableHeader('active', 'Active'),
          sortableHeader('last_schedule', 'Last Run'),
          <TableHeaderCell key="actions" style={{ width: '40px' }}></TableHeaderCell>
        ];
      default:
        return [
          ...common,
          sortableHeader('creation_timestamp', 'Created'),
          <TableHeaderCell key="actions" style={{ width: '40px' }}></TableHeaderCell>
        ];
    }
  };

  const getMetricValues = (r: ResourceItem) => {
    const key = r.namespace ? `${r.namespace}/${r.name}` : r.name;
    const m = metrics[key];
    if (!m) return { cpu: '---', mem: '---' };

    let cpu = 0;
    let mem = 0;
    
    if (m.containers) {
        m.containers.forEach((c: any) => {
            const c_cpu = c.usage.cpu;
            if (c_cpu.endsWith('n')) cpu += parseInt(c_cpu) / 1000000;
            else if (c_cpu.endsWith('u')) cpu += parseInt(c_cpu) / 1000;
            else cpu += parseInt(c_cpu) * 1000;

            const c_mem = c.usage.memory;
            if (c_mem.endsWith('Ki')) mem += parseInt(c_mem) * 1024;
            else if (c_mem.endsWith('Mi')) mem += parseInt(c_mem) * 1024 * 1024;
            else if (c_mem.endsWith('Gi')) mem += parseInt(c_mem) * 1024 * 1024 * 1024;
            else mem += parseInt(c_mem);
        });
    } else if (m.usage) {
        const n_cpu = m.usage.cpu;
        if (n_cpu.endsWith('n')) cpu = parseInt(n_cpu) / 1000000;
        else if (n_cpu.endsWith('u')) cpu = parseInt(n_cpu) / 1000;
        else cpu = parseInt(n_cpu) * 1000;

        const n_mem = m.usage.memory;
        if (n_mem.endsWith('Ki')) mem = parseInt(n_mem) * 1024;
        else if (n_mem.endsWith('Mi')) mem = parseInt(n_mem) * 1024 * 1024;
        else if (n_mem.endsWith('Gi')) mem = parseInt(n_mem) * 1024 * 1024 * 1024;
        else mem = parseInt(n_mem);
    }

    return {
        cpu: `${cpu.toFixed(1)}m`,
        mem: `${(mem / (1024 * 1024)).toFixed(1)} MiB`
    };
  };

  const renderResourceRow = (r: ResourceItem) => {
    const commonCells = [
      <TableCell key="name"><span className={styles.clickableName} onClick={() => setSelectedResource({ type: activeView, name: r.name, namespace: r.namespace })}>{r.name}</span></TableCell>,
      <TableCell key="ns"><Badge appearance="tint" color="brand">{r.namespace || 'Cluster'}</Badge></TableCell>
    ];

    const actions = (
        <TableCell key="actions">
            <Menu>
                <MenuTrigger disableButtonEnhancement>
                    <Button appearance="subtle" icon={<MoreHorizontal20Regular />} size="small" />
                </MenuTrigger>
                <MenuPopover>
                    <MenuList>
                        {(activeView === 'pods' || r.type === 'pods') && (
                            <>
                            <MenuItem icon={<TextBulletList20Regular />} onClick={() => handleOpenLogs(r.namespace!, r.name)}>View Logs</MenuItem>
                            <MenuItem icon={<WindowConsole20Regular />} onClick={() => handleOpenShell(r.namespace!, r.name, r.raw?.spec?.containers[0]?.name || 'default')}>Execute Shell</MenuItem>
                            </>
                        )}
                        <MenuItem icon={<Document20Regular />} onClick={() => handleOpenYaml(r.namespace || 'default', r.name)}>Edit YAML</MenuItem>
                    </MenuList>
                </MenuPopover>
            </Menu>
        </TableCell>
    );

    const renderUtil = (usage: any, unit: string = '') => {
        if (!usage) return '---';
        const percent = (usage.reserved || usage.current) / usage.total;
        let displayVal = "";
        if (unit === 'Cores') displayVal = `${(usage.reserved/1000).toFixed(1)} / ${(usage.total/1000).toFixed(1)}`;
        else if (unit === 'GiB') displayVal = `${(usage.reserved/(1024**3)).toFixed(1)} / ${(usage.total/(1024**3)).toFixed(1)}`;
        else displayVal = `${usage.current} / ${usage.total}`;

        return (
            <div className={styles.progressBarContainer}>
                <span style={{ fontSize: '10px', opacity: 0.7 }}>{displayVal} {unit}</span>
                <ProgressBar value={usage.reserved || usage.current} max={usage.total} color={percent > 0.8 ? 'error' : 'brand'} thickness="medium" />
            </div>
        )
    }

    switch (activeView) {
        case 'nodes':
            return (
                <TableRow key={r.name}>
                    <TableCell><span className={styles.clickableName} onClick={() => setSelectedResource({ type: 'nodes', name: r.name })}>{r.name}</span></TableCell>
                    <TableCell><Badge color={r.status === 'Ready' ? 'success' : 'important'}>{r.status}</Badge></TableCell>
                    <TableCell><code style={{ fontSize: '0.75rem' }}>{r.internal_ip}</code></TableCell>
                    <TableCell><code style={{ fontSize: '0.75rem' }}>{r.external_ip}</code></TableCell>
                    <TableCell><span style={{ fontSize: '0.8rem', opacity: 0.8 }}>{r.os}</span></TableCell>
                    <TableCell>{renderUtil(r.cpu_usage, 'Cores')}</TableCell>
                    <TableCell>{renderUtil(r.mem_usage, 'GiB')}</TableCell>
                    <TableCell>{renderUtil(r.pod_usage)}</TableCell>
                    <TableCell><span style={{ fontSize: '0.8rem', opacity: 0.7 }}>{new Date(r.creation_timestamp!).toLocaleDateString()}</span></TableCell>
                    {actions}
                </TableRow>
            );
        case 'pods':
            const { cpu, mem } = getMetricValues(r);
            return (
                <TableRow key={`${r.namespace}-${r.name}`}>
                    {commonCells}
                    <TableCell>
                        <Badge color={r.status === 'Running' ? 'success' : 'important'} appearance="outline">
                            {r.status?.toLowerCase()}
                        </Badge>
                    </TableCell>
                    <TableCell><span style={{ fontSize: '0.8rem' }}>{cpu}</span></TableCell>
                    <TableCell><span style={{ fontSize: '0.8rem' }}>{mem}</span></TableCell>
                    <TableCell><code style={{ fontSize: '0.75rem', opacity: 0.7 }}>{r.ip || '---'}</code></TableCell>
                    {actions}
                </TableRow>
            );
        case 'deployments':
        case 'statefulsets':
            return (
                <TableRow key={`${r.namespace}-${r.name}`}>
                    {commonCells}
                    <TableCell>{r.replicas}</TableCell>
                    <TableCell><Badge color={r.ready_replicas === r.replicas ? 'success' : 'warning'}>{r.ready_replicas}</Badge></TableCell>
                    {actions}
                </TableRow>
            );
        case 'daemonsets':
             return (
                <TableRow key={`${r.namespace}-${r.name}`}>
                    {commonCells}
                    <TableCell>{r.desired}</TableCell>
                    <TableCell><Badge color={r.ready === r.desired ? 'success' : 'warning'}>{r.ready}</Badge></TableCell>
                    {actions}
                </TableRow>
            );
        case 'cronjobs':
            return (
                <TableRow key={`${r.namespace}-${r.name}`}>
                    {commonCells}
                    <TableCell><code>{r.schedule}</code></TableCell>
                    <TableCell><Badge appearance="outline">{r.active}</Badge></TableCell>
                    <TableCell><span style={{ fontSize: '0.8rem', opacity: 0.8 }}>{r.last_schedule ? new Date(r.last_schedule).toLocaleString() : 'Never'}</span></TableCell>
                    {actions}
                </TableRow>
            );
        default:
            return (
                <TableRow key={r.id || `${r.namespace || 'cls'}-${r.name}`}>
                    {commonCells}
                    <TableCell><span style={{ fontSize: '0.8rem', opacity: 0.7 }}>{new Date(r.creation_timestamp!).toLocaleString()}</span></TableCell>
                    {actions}
                </TableRow>
            );
    }
  };

  const getPageTitle = () => {
    if (activeView === 'overview') return 'Cluster Overview';
    if (activeView.startsWith('other_')) {
      const plural = activeView.replace('other_', '');
      return NATIVE_OTHERS.find(o => o.plural === plural)?.label || plural;
    }
    if (activeView.startsWith('custom_')) {
      const plural = activeView.replace('custom_', '');
      return crds.find(c => c.plural === plural)?.kind || plural;
    }
    return activeView.charAt(0).toUpperCase() + activeView.slice(1);
  };

  const handleNamespaceChange = (_e: any, data: any) => {
    const newValues = data.selectedOptions;
    if (newValues.includes('All Namespaces') && !selectedNamespaces.includes('All Namespaces')) {
        setSelectedNamespaces(['All Namespaces']);
    } else if (newValues.length > 1 && newValues.includes('All Namespaces')) {
        setSelectedNamespaces(newValues.filter((v: string) => v !== 'All Namespaces'));
    } else if (newValues.length === 0) {
        setSelectedNamespaces(['All Namespaces']);
    } else {
        setSelectedNamespaces(newValues);
    }
  };

  const activePanel = panels.find(p => p.id === activePanelId);

  return (
    <div className={styles.container}>
      <aside className={styles.sidebar}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
          <Title2 style={{ color: 'var(--colorBrandForeground1)', fontWeight: '800' }}>k8sune</Title2>
          <Menu>
            <MenuTrigger disableButtonEnhancement>
              <div className={styles.contextDropdown}>
                <span style={{ fontSize: '0.85rem', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>
                  {context || 'Select Context'}
                </span>
                <MoreHorizontal20Regular />
              </div>
            </MenuTrigger>
            <MenuPopover>
              <MenuList>
                {contexts.map(ctx => (
                  <MenuItem key={ctx} onClick={() => setActiveContext(ctx)} icon={ctx === context ? <PresenceBadge status="available" size="extra-small" /> : undefined}>
                    {ctx}
                  </MenuItem>
                ))}
                <MenuItem icon={<ArrowClockwise20Regular />} onClick={fetchContexts}>Refresh List</MenuItem>
                <MenuItem icon={<Add20Regular />} onClick={() => setIsImportOpen(true)}>Import Kubeconfig</MenuItem>
              </MenuList>
            </MenuPopover>
          </Menu>
        </div>

        <div className={styles.tabList}>
          <Button 
            appearance="subtle" 
            className={styles.sidebarItem}
            icon={<Apps20Regular />}
            style={activeView === 'overview' ? { backgroundColor: 'var(--colorNeutralBackground3)' } : {}}
            onClick={() => { setActiveView('overview'); setSelectedResource(null); }}
          >
            Cluster Overview
          </Button>
          <Button 
            appearance="subtle" 
            className={styles.sidebarItem}
            icon={<Cube20Regular />}
            style={activeView === 'nodes' ? { backgroundColor: 'var(--colorNeutralBackground3)' } : {}}
            onClick={() => { setActiveView('nodes'); setSelectedResource(null); }}
          >
            Nodes
          </Button>
          <Button 
            appearance="subtle" 
            className={styles.sidebarItem}
            icon={<Link20Regular />}
            style={activeView === 'namespaces' ? { backgroundColor: 'var(--colorNeutralBackground3)' } : {}}
            onClick={() => { setActiveView('namespaces'); setSelectedResource(null); }}
          >
            Namespaces
          </Button>
          
          <div style={{ height: '1rem' }} />
          <Label style={{ fontSize: '0.7rem', opacity: 0.5, paddingLeft: '8px', marginBottom: '4px' }}>WORKLOADS</Label>

          <Button 
            appearance="subtle" 
            className={styles.sidebarItem}
            icon={<Box20Regular />}
            style={activeView === 'pods' ? { backgroundColor: 'var(--colorNeutralBackground3)' } : {}}
            onClick={() => { setActiveView('pods'); setSelectedResource(null); }}
          >
            Pods
          </Button>
          <Button 
            appearance="subtle" 
            className={styles.sidebarItem}
            icon={<Layer20Regular />}
            style={activeView === 'deployments' ? { backgroundColor: 'var(--colorNeutralBackground3)' } : {}}
            onClick={() => { setActiveView('deployments'); setSelectedResource(null); }}
          >
            Deployments
          </Button>
          <Button 
            appearance="subtle" 
            className={styles.sidebarItem}
            icon={<Apps20Regular />}
            style={activeView === 'statefulsets' ? { backgroundColor: 'var(--colorNeutralBackground3)' } : {}}
            onClick={() => { setActiveView('statefulsets'); setSelectedResource(null); }}
          >
            StatefulSets
          </Button>
          <Button 
            appearance="subtle" 
            className={styles.sidebarItem}
            icon={<Apps20Regular />}
            style={activeView === 'daemonsets' ? { backgroundColor: 'var(--colorNeutralBackground3)' } : {}}
            onClick={() => { setActiveView('daemonsets'); setSelectedResource(null); }}
          >
            DaemonSets
          </Button>
          <Button 
            appearance="subtle" 
            className={styles.sidebarItem}
            icon={<ArrowClockwise20Regular />}
            style={activeView === 'cronjobs' ? { backgroundColor: 'var(--colorNeutralBackground3)' } : {}}
            onClick={() => { setActiveView('cronjobs'); setSelectedResource(null); }}
          >
            CronJobs
          </Button>

          <div style={{ height: '1rem' }} />
          <Label style={{ fontSize: '0.7rem', opacity: 0.5, paddingLeft: '8px', marginBottom: '4px' }}>CONFIGURATION</Label>

          <Button 
            appearance="subtle" 
            className={styles.sidebarItem}
            icon={<Database20Regular />}
            style={activeView === 'configmaps' ? { backgroundColor: 'var(--colorNeutralBackground3)' } : {}}
            onClick={() => { setActiveView('configmaps'); setSelectedResource(null); }}
          >
            ConfigMaps
          </Button>
          <Button 
            appearance="subtle" 
            className={styles.sidebarItem}
            icon={<ShieldLock20Regular />}
            style={activeView === 'secrets' ? { backgroundColor: 'var(--colorNeutralBackground3)' } : {}}
            onClick={() => { setActiveView('secrets'); setSelectedResource(null); }}
          >
            Secrets
          </Button>
          <Button 
            appearance="subtle" 
            className={styles.sidebarItem}
            icon={<Storage20Regular />}
            style={activeView === 'persistentvolumes' ? { backgroundColor: 'var(--colorNeutralBackground3)' } : {}}
            onClick={() => { setActiveView('persistentvolumes'); setSelectedResource(null); }}
          >
            PV / PVC
          </Button>

          <Accordion collapsible>
             <AccordionItem value="others">
                <AccordionHeader expandIconPosition="end" size="small">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Grid20Regular />
                        <span style={{ fontSize: '0.85rem' }}>Others</span>
                    </div>
                </AccordionHeader>
                <AccordionPanel>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {NATIVE_OTHERS.map(other => (
                            <Button 
                                key={other.plural} 
                                appearance="subtle" 
                                className={styles.sidebarSubItem}
                                onClick={() => { setActiveView(`other_${other.plural}`); setSelectedResource(null); }}
                                style={activeView === `other_${other.plural}` ? { backgroundColor: 'var(--colorNeutralBackground3)', opacity: 1 } : {}}
                            >
                                {other.label}
                            </Button>
                        ))}
                    </div>
                </AccordionPanel>
             </AccordionItem>

             <AccordionItem value="custom">
                <AccordionHeader expandIconPosition="end" size="small">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Database20Regular />
                        <span style={{ fontSize: '0.85rem' }}>Custom Resources</span>
                    </div>
                </AccordionHeader>
                <AccordionPanel>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {crds.map(crd => (
                            <Button 
                                key={crd.name} 
                                appearance="subtle" 
                                className={styles.sidebarSubItem}
                                onClick={() => handleSelectCRD(crd)}
                                style={activeView === `custom_${crd.plural}` ? { backgroundColor: 'var(--colorNeutralBackground3)', opacity: 1 } : {}}
                            >
                                {crd.kind}
                            </Button>
                        ))}
                    </div>
                </AccordionPanel>
             </AccordionItem>
          </Accordion>
        </div>

        <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
          <Dialog open={isImportOpen} onOpenChange={(_, data) => setIsImportOpen(data.open)}>
            <DialogSurface>
                <DialogBody>
                    <DialogTitle>Import Kubeconfig</DialogTitle>
                    <DialogContent>
                        <div className={styles.settingsContent}>
                            <TabList size="small" selectedValue={importTab} onTabSelect={(_, d) => setImportTab(d.value as string)}>
                                <Tab value="file">From File</Tab>
                                <Tab value="yaml">Paste YAML</Tab>
                            </TabList>
                            <div style={{ marginTop: '1rem' }}>
                                {importTab === 'file' ? (
                                    <div style={{ textAlign: 'center', padding: '2rem', border: '1px dashed var(--colorNeutralStroke1)', borderRadius: '8px' }}>
                                        <Button icon={<ArrowUpload20Regular />} onClick={handleImport}>Choose File</Button>
                                        <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', opacity: 0.6 }}>Select your .kube/config or other cluster YAML</div>
                                    </div>
                                ) : (
                                    <Textarea 
                                        placeholder="Paste your kubeconfig YAML here..." 
                                        style={{ width: '100%', minHeight: '200px' }}
                                        value={importYaml}
                                        onChange={(e) => setImportYaml(e.target.value)}
                                    />
                                )}
                            </div>
                        </div>
                    </DialogContent>
                    <DialogActions>
                        <Button appearance="subtle" onClick={() => setIsImportOpen(false)}>Cancel</Button>
                        {importTab === 'yaml' && <Button appearance="primary" onClick={handleImport} disabled={!importYaml}>Import</Button>}
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
          </Dialog>

          <Dialog open={isSettingsOpen} onOpenChange={(_, data) => setIsSettingsOpen(data.open)}>
            <DialogTrigger disableButtonEnhancement>
              <Button icon={<Settings20Regular />} appearance="subtle" className={styles.sidebarItem}>
                Settings
              </Button>
            </DialogTrigger>
            <DialogSurface>
              <DialogBody>
                <DialogTitle>Application Settings</DialogTitle>
                <DialogContent>
                  <div className={styles.settingsContent}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
                       <img src="/sprites/k8sune-wave.png" alt="wave" style={{ width: '180px', height: 'auto' }} />
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <Label weight="semibold">Metrics Source</Label>
                      <Dropdown 
                        value={clusterSettings.metrics_source || 'standard'} 
                        selectedOptions={[clusterSettings.metrics_source || 'standard']}
                        onOptionSelect={(_, data) => saveClusterSettings({ ...clusterSettings, metrics_source: data.optionValue })}
                      >
                        <Option value="standard">Metrics API (Standard)</Option>
                        <Option value="custom">Custom Metrics Server</Option>
                      </Dropdown>
                      {clusterSettings.metrics_source === 'custom' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                            <Input 
                                placeholder="Custom Endpoint URL" 
                                value={clusterSettings.custom_metrics_endpoint || ''}
                                onChange={(e) => setClusterSettings({ ...clusterSettings, custom_metrics_endpoint: e.target.value })}
                                onBlur={() => saveClusterSettings(clusterSettings)}
                            />
                             <Input 
                                placeholder="Cluster Label (e.g. cluster=prod)" 
                                value={clusterSettings.metrics_labels || ''}
                                onChange={(e) => setClusterSettings({ ...clusterSettings, metrics_labels: e.target.value })}
                                onBlur={() => saveClusterSettings(clusterSettings)}
                            />
                          </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <Label weight="semibold">About k8sune</Label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', opacity: 0.7 }}>
                        <Info20Regular style={{ fontSize: '16px' }} />
                        Version 0.1.0 (Developer Preview)
                      </div>
                    </div>
                  </div>
                </DialogContent>
                <DialogActions>
                  <Button appearance="primary" onClick={() => setIsSettingsOpen(false)}>Close</Button>
                </DialogActions>
              </DialogBody>
            </DialogSurface>
          </Dialog>
        </div>
      </aside>

      <div className={styles.mainContainer}>
        <main className={styles.main}>
          <header className={styles.header}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              {!selectedResource ? (
                  <>
                  <Title2 style={{ fontSize: '1.25rem' }}>
                    {getPageTitle()}
                  </Title2>
                  {loading && <Spinner size="tiny" />}
                  </>
              ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <Button appearance="subtle" icon={<ChevronLeft20Regular />} onClick={() => setSelectedResource(null)} />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <Title2 style={{ fontSize: '1.25rem' }}>{selectedResource.name}</Title2>
                          <Subtitle2 style={{ opacity: 0.6, fontSize: '0.75rem' }}>{getPageTitle()} Detail</Subtitle2>
                      </div>
                  </div>
              )}
            </div>
            <div className={styles.headerControls}>
              {context && !selectedResource && activeView !== 'overview' && activeView !== 'nodes' && activeView !== 'namespaces' && (
                  <Dropdown
                    multiselect
                    placeholder="Namespace"
                    className={styles.namespaceDropdown}
                    value={selectedNamespaces.join(', ')}
                    selectedOptions={selectedNamespaces}
                    onOptionSelect={handleNamespaceChange}
                  >
                    <Option key="all" value="All Namespaces">All Namespaces</Option>
                    {namespaces.map(ns => (
                      <Option key={ns} value={ns}>{ns}</Option>
                    ))}
                  </Dropdown>
              )}
              <Input 
                placeholder="Search..." 
                contentBefore={<Search20Regular />} 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                size="small"
              />
              <Button 
                icon={<ArrowClockwise20Regular />} 
                size="small" 
                onClick={selectedResource ? loadResourceDetail : loadData}
                disabled={loading}
              />
            </div>
          </header>

          <div className={styles.content}>
            {!context ? (
               <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.5, gap: '1rem' }}>
                  <Mascot />
                  <Subtitle1>Select a cluster context to begin</Subtitle1>
               </div>
            ) : !isReachable ? (
               <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', padding: '2rem' }}>
                  <img src="/sprites/k8sune-tired.png" alt="Cluster Not Reachable" style={{ width: '180px', height: '180px', objectFit: 'contain' }} />
                  <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: '400px' }}>
                      <Title3 style={{ color: 'var(--colorBrandForeground1)', fontWeight: '800' }}>Cluster Not Reachable</Title3>
                      <Subtitle1 style={{ opacity: 0.8 }}>
                          Could not connect to the cluster context "{context}".
                      </Subtitle1>
                      <span style={{ fontSize: '0.85rem', opacity: 0.6 }}>
                          Please verify your network connection, kubeconfig, and check if the API server is online.
                      </span>
                  </div>
                  <Button appearance="primary" icon={loading ? <Spinner size="tiny" /> : <ArrowClockwise20Regular />} onClick={loadData} disabled={loading}>
                      {loading ? 'Connecting...' : 'Try Again'}
                  </Button>
               </div>
            ) : selectedResource ? (
                loading && !resourceDetail ? (
                    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '4rem' }}>
                        <Spinner label="Loading details..." />
                    </div>
                ) : resourceDetail ? (
                    <div className={styles.detailView}>
                        <TabList size="small" selectedValue={detailTab} onTabSelect={(_, data) => setDetailTab(data.value as string)}>
                            <Tab value="overview">Overview</Tab>
                            {(selectedResource.type === 'nodes' || selectedResource.type === 'deployments' || selectedResource.type === 'statefulsets' || selectedResource.type === 'daemonsets') && <Tab value="pods">Pods ({detailPods.length})</Tab>}
                            <Tab value="events">Events ({detailEvents.length})</Tab>
                            {selectedResource.type === 'nodes' && <Tab value="images">Images</Tab>}
                        </TabList>

                        {detailTab === 'overview' && (
                            <div className={styles.detailSection}>
                                <Card style={{ backgroundColor: 'var(--colorNeutralBackground2)' }}>
                                    <CardHeader header={<Subtitle2>Metadata</Subtitle2>} />
                                    <div className={styles.kvTable} style={{ padding: '1rem' }}>
                                        <span>Name</span> <span>{resourceDetail.metadata.name}</span>
                                        {resourceDetail.metadata.namespace && <><span>Namespace</span> <span>{resourceDetail.metadata.namespace}</span></>}
                                        <span>Age</span> <span>{new Date(resourceDetail.metadata.creation_timestamp).toLocaleString()}</span>
                                        <span>Labels</span> 
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                            {Object.entries(resourceDetail.metadata.labels || {}).map(([k, v]) => (
                                                <Badge key={k} appearance="outline">{k}: {v as string}</Badge>
                                            ))}
                                        </div>
                                    </div>
                                </Card>

                                {selectedResource.type === 'nodes' && (
                                    <Card style={{ backgroundColor: 'var(--colorNeutralBackground2)' }}>
                                        <CardHeader header={<Subtitle2>Conditions</Subtitle2>} />
                                        <div className={styles.kvTable} style={{ padding: '1rem' }}>
                                            {resourceDetail.status.conditions?.map((c: any) => (
                                                <div key={c.type} style={{ display: 'contents' }}>
                                                    <span>{c.type}</span>
                                                    <Badge color={c.status === 'True' ? (c.type === 'Ready' ? 'success' : 'important') : (c.type === 'Ready' ? 'important' : 'success')}>
                                                        {c.status}
                                                    </Badge>
                                                </div>
                                            ))}
                                        </div>
                                    </Card>
                                )}

                                {(selectedResource.type === 'deployments' || selectedResource.type === 'statefulsets' || selectedResource.type === 'daemonsets') && resourceDetail.status && (
                                    <Card style={{ backgroundColor: 'var(--colorNeutralBackground2)' }}>
                                        <CardHeader header={<Subtitle2>Status</Subtitle2>} />
                                        <div className={styles.kvTable} style={{ padding: '1rem' }}>
                                            {selectedResource.type === 'daemonsets' ? (
                                                <>
                                                <span>Ready</span> <span>{resourceDetail.status.number_ready} / {resourceDetail.status.desired_number_scheduled}</span>
                                                </>
                                            ) : (
                                                <>
                                                <span>Replicas</span> <span>{resourceDetail.status.ready_replicas} Ready / {resourceDetail.status.replicas} Desired</span>
                                                </>
                                            )}
                                            {resourceDetail.status.conditions?.map((c: any) => (
                                                <div key={c.type} style={{ display: 'contents' }}>
                                                    <span>{c.type}</span>
                                                    <Badge color={c.status === 'True' ? 'success' : 'important'}>{c.status}</Badge>
                                                </div>
                                            ))}
                                        </div>
                                    </Card>
                                )}

                                {selectedResource.type === 'namespaces' && resourceDetail.status && (
                                    <>
                                    <Card style={{ backgroundColor: 'var(--colorNeutralBackground2)' }}>
                                        <CardHeader header={<Subtitle2>Status</Subtitle2>} />
                                        <div className={styles.kvTable} style={{ padding: '1rem' }}>
                                            <span>Phase</span> 
                                            <Badge color={resourceDetail.status.phase === 'Active' ? 'success' : 'important'}>
                                                {resourceDetail.status.phase}
                                            </Badge>
                                        </div>
                                    </Card>

                                    <Card style={{ backgroundColor: 'var(--colorNeutralBackground2)' }}>
                                        <CardHeader header={<Subtitle2>Resource Counts</Subtitle2>} />
                                        <div className={styles.kvTable} style={{ padding: '1rem' }}>
                                            <span>Deployments</span> <span>{resourceDetail.counts?.deployments ?? 0}</span>
                                            <span>StatefulSets</span> <span>{resourceDetail.counts?.statefulsets ?? 0}</span>
                                            <span>DaemonSets</span> <span>{resourceDetail.counts?.daemonsets ?? 0}</span>
                                            <span>CronJobs</span> <span>{resourceDetail.counts?.cronjobs ?? 0}</span>
                                            <span>Jobs</span> <span>{resourceDetail.counts?.jobs ?? 0}</span>
                                            <span>Pods</span> <span>{resourceDetail.counts?.pods ?? 0}</span>
                                            <span>Services</span> <span>{resourceDetail.counts?.services ?? 0}</span>
                                            <span>Ingresses</span> <span>{resourceDetail.counts?.ingresses ?? 0}</span>
                                            <span>ConfigMaps</span> <span>{resourceDetail.counts?.configmaps ?? 0}</span>
                                            <span>Secrets</span> <span>{resourceDetail.counts?.secrets ?? 0}</span>
                                            <span>PVCs</span> <span>{resourceDetail.counts?.pvcs ?? 0}</span>
                                        </div>
                                    </Card>

                                    <Card style={{ backgroundColor: 'var(--colorNeutralBackground2)' }}>
                                        <CardHeader header={<Subtitle2>Resource Usage (Requests)</Subtitle2>} />
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem' }}>
                                            <div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.8rem' }}>
                                                    <span>CPU Requests (Namespace / Cluster Allocatable)</span>
                                                    <span>
                                                        {resourceDetail.usage?.cpu ? (
                                                            `${(resourceDetail.usage.cpu.reserved / 1000).toFixed(1)} / ${(resourceDetail.usage.cpu.cluster_allocatable / 1000).toFixed(1)} Cores`
                                                        ) : '---'}
                                                    </span>
                                                </div>
                                                {resourceDetail.usage?.cpu && (
                                                    <ProgressBar 
                                                        value={resourceDetail.usage.cpu.reserved} 
                                                        max={resourceDetail.usage.cpu.cluster_allocatable || 1} 
                                                        color={resourceDetail.usage.cpu.reserved / resourceDetail.usage.cpu.cluster_allocatable > 0.8 ? 'error' : 'brand'}
                                                    />
                                                )}
                                            </div>
                                            <div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.8rem' }}>
                                                    <span>Memory Requests (Namespace / Cluster Allocatable)</span>
                                                    <span>
                                                        {resourceDetail.usage?.memory ? (
                                                            `${(resourceDetail.usage.memory.reserved / (1024**3)).toFixed(1)} / ${(resourceDetail.usage.memory.cluster_allocatable / (1024**3)).toFixed(1)} GiB`
                                                        ) : '---'}
                                                    </span>
                                                </div>
                                                {resourceDetail.usage?.memory && (
                                                    <ProgressBar 
                                                        value={resourceDetail.usage.memory.reserved} 
                                                        max={resourceDetail.usage.memory.cluster_allocatable || 1} 
                                                        color={resourceDetail.usage.memory.reserved / resourceDetail.usage.memory.cluster_allocatable > 0.8 ? 'error' : 'brand'}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    </Card>
                                    </>
                                )}

                                {(selectedResource.type === 'services' || selectedResource.type === 'other_services') && resourceDetail.spec && (
                                    <Card style={{ backgroundColor: 'var(--colorNeutralBackground2)' }}>
                                        <CardHeader header={<Subtitle2>Service Details</Subtitle2>} />
                                        <div className={styles.kvTable} style={{ padding: '1rem' }}>
                                            <span>Type</span> <span>{resourceDetail.spec.type}</span>
                                            <span>Cluster IP</span> <code>{resourceDetail.spec.cluster_ip}</code>
                                            <span>Ports</span> 
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                {resourceDetail.spec.ports?.map((p: any, idx: number) => (
                                                    <Badge key={idx} appearance="outline">{p.port}:{p.targetPort || p.target_port}/{p.protocol}</Badge>
                                                ))}
                                            </div>
                                            {resourceDetail.spec.selector && (
                                                <>
                                                <span>Selector</span>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                    {Object.entries(resourceDetail.spec.selector).map(([k, v]) => (
                                                        <Badge key={k} appearance="tint">{k}={v as string}</Badge>
                                                    ))}
                                                </div>
                                                </>
                                            )}
                                        </div>
                                    </Card>
                                )}

                                {(selectedResource.type === 'ingresses' || selectedResource.type === 'other_ingresses') && resourceDetail.spec && (
                                    <Card style={{ backgroundColor: 'var(--colorNeutralBackground2)' }}>
                                        <CardHeader header={<Subtitle2>Ingress Rules</Subtitle2>} />
                                        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {resourceDetail.spec.rules?.map((rule: any, idx: number) => (
                                                <div key={idx} style={{ borderBottom: '1px solid var(--colorNeutralStroke2)', paddingBottom: '8px' }}>
                                                    <div style={{ fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '4px' }}>Host: {rule.host || '*'}</div>
                                                    <div className={styles.kvTable}>
                                                        {rule.http?.paths?.map((path: any, pIdx: number) => (
                                                            <div key={pIdx} style={{ display: 'contents' }}>
                                                                <span>Path (<code>{path.path || '/'}</code>)</span>
                                                                <span>
                                                                    Service: <code>{path.backend?.service?.name || path.backend?.serviceName}</code> 
                                                                    (Port: {path.backend?.service?.port?.number || path.backend?.servicePort})
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </Card>
                                )}

                                {(selectedResource.type === 'services' || selectedResource.type === 'other_services' || selectedResource.type === 'ingresses' || selectedResource.type === 'other_ingresses') && (
                                     <Card style={{ backgroundColor: 'var(--colorNeutralBackground2)', marginTop: '0.5rem' }}>
                                        <CardHeader header={<Subtitle2>Selected Pods</Subtitle2>} />
                                        <div style={{ padding: '1rem' }}>
                                            {resourceDetail.pods && resourceDetail.pods.length > 0 ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    {resourceDetail.pods.map((p: any) => (
                                                        <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--colorNeutralStroke3)', paddingBottom: '4px' }}>
                                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                                <span 
                                                                    className={styles.clickableName} 
                                                                    onClick={() => setSelectedResource({ type: 'pods', name: p.name, namespace: p.namespace || selectedResource.namespace })}
                                                                >
                                                                    {p.name}
                                                                </span>
                                                                {p.service && <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>via Service: {p.service}</span>}
                                                            </div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                {p.ip && <code style={{ fontSize: '0.75rem' }}>{p.ip}</code>}
                                                                <Badge color={p.status === 'Running' ? 'success' : 'warning'}>{p.status}</Badge>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div style={{ opacity: 0.5, fontSize: '0.85rem' }}>No pods currently selected.</div>
                                            )}
                                        </div>
                                     </Card>
                                )}

                                {(selectedResource.type === 'replicasets' || selectedResource.type === 'other_replicasets') && resourceDetail.status && (
                                    <Card style={{ backgroundColor: 'var(--colorNeutralBackground2)' }}>
                                        <CardHeader header={<Subtitle2>ReplicaSet Status</Subtitle2>} />
                                        <div className={styles.kvTable} style={{ padding: '1rem' }}>
                                            <span>Desired Replicas</span> <span>{resourceDetail.spec?.replicas}</span>
                                            <span>Current Replicas</span> <span>{resourceDetail.status.replicas}</span>
                                            <span>Ready Replicas</span> <Badge color={resourceDetail.status.ready_replicas === resourceDetail.spec?.replicas ? 'success' : 'warning'}>{resourceDetail.status.ready_replicas}</Badge>
                                            <span>Available Replicas</span> <span>{resourceDetail.status.available_replicas}</span>
                                        </div>
                                    </Card>
                                )}

                                {(selectedResource.type === 'jobs' || selectedResource.type === 'other_jobs') && resourceDetail.status && (
                                    <Card style={{ backgroundColor: 'var(--colorNeutralBackground2)' }}>
                                        <CardHeader header={<Subtitle2>Job Status</Subtitle2>} />
                                        <div className={styles.kvTable} style={{ padding: '1rem' }}>
                                            <span>Completions</span> <span>{resourceDetail.spec?.completions}</span>
                                            <span>Parallelism</span> <span>{resourceDetail.spec?.parallelism}</span>
                                            <span>Active</span> <span>{resourceDetail.status.active}</span>
                                            <span>Succeeded</span> <Badge color="success">{resourceDetail.status.succeeded}</Badge>
                                            <span>Failed</span> <Badge color={resourceDetail.status.failed > 0 ? 'important' : 'subtle'}>{resourceDetail.status.failed}</Badge>
                                            {resourceDetail.status.start_time && <><span>Started</span> <span>{new Date(resourceDetail.status.start_time).toLocaleString()}</span></>}
                                            {resourceDetail.status.completion_time && <><span>Completed</span> <span>{new Date(resourceDetail.status.completion_time).toLocaleString()}</span></>}
                                        </div>
                                    </Card>
                                )}

                                {selectedResource.type.startsWith('custom_') && resourceDetail.spec && (
                                    <Card style={{ backgroundColor: 'var(--colorNeutralBackground2)' }}>
                                        <CardHeader header={<Subtitle2>Spec Summary</Subtitle2>} />
                                        <div className={styles.kvTable} style={{ padding: '1rem' }}>
                                            {Object.entries(resourceDetail.spec).map(([k, v]) => (
                                                <div key={k} style={{ display: 'contents' }}>
                                                    <span>{k}</span>
                                                    <span style={{ wordBreak: 'break-all', fontSize: '0.85rem' }}>
                                                        {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </Card>
                                )}

                                {selectedResource.type === 'cronjobs' && resourceDetail.spec && (
                                    <Card style={{ backgroundColor: 'var(--colorNeutralBackground2)' }}>
                                        <CardHeader header={<Subtitle2>CronJob Status</Subtitle2>} />
                                        <div className={styles.kvTable} style={{ padding: '1rem' }}>
                                            <span>Schedule</span> <code>{resourceDetail.spec.schedule}</code>
                                            <span>Suspend</span> <span>{resourceDetail.spec.suspend ? 'Yes' : 'No'}</span>
                                            <span>Last Run</span> <span>{resourceDetail.status.last_schedule_time ? new Date(resourceDetail.status.last_schedule_time).toLocaleString() : 'Never'}</span>
                                        </div>
                                    </Card>
                                )}

                                {(selectedResource.type === 'pods' || selectedResource.type === 'deployments' || selectedResource.type === 'statefulsets' || selectedResource.type === 'daemonsets' || selectedResource.type === 'cronjobs') && resourceDetail.spec && (
                                    <>
                                    {selectedResource.type === 'pods' && (
                                        <Card style={{ backgroundColor: 'var(--colorNeutralBackground2)' }}>
                                            <CardHeader header={<Subtitle2>Pod Status</Subtitle2>} />
                                            <div className={styles.kvTable} style={{ padding: '1rem' }}>
                                                <span>Phase</span> <Badge color={resourceDetail.status.phase === 'Running' ? 'success' : 'important'}>{resourceDetail.status.phase}</Badge>
                                                <span>Pod IP</span> <code>{resourceDetail.status.pod_ip}</code>
                                                <span>Host IP</span> <code>{resourceDetail.status.host_ip}</code>
                                                <span>Node</span> <span className={styles.clickableName} onClick={() => setSelectedResource({ type: 'nodes', name: resourceDetail.spec.node_name })}>{resourceDetail.spec.node_name}</span>
                                            </div>
                                        </Card>
                                    )}

                                    <Title3 style={{ fontSize: '1rem', marginTop: '1rem' }}>{selectedResource.type === 'pods' ? 'Containers' : 'Pod Template Containers'}</Title3>
                                    {resourceDetail.spec.containers.map((c: any) => {
                                        const status = selectedResource.type === 'pods' ? resourceDetail.status.container_statuses?.find((s: any) => s.name === c.name) : null;
                                        return (
                                            <Card key={c.name} style={{ backgroundColor: 'var(--colorNeutralBackground2)', marginBottom: '0.5rem' }}>
                                                <CardHeader header={
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <Subtitle1>{c.name}</Subtitle1>
                                                            {status && <Badge color={status.ready ? 'success' : 'important'}>{status.ready ? 'Ready' : 'Not Ready'}</Badge>}
                                                        </div>
                                                        <Badge appearance="tint" style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.image}</Badge>
                                                    </div>
                                                } 
                                                action={
                                                    selectedResource.type === 'pods' ? (
                                                        <Button 
                                                            size="small" 
                                                            icon={<WindowConsole20Regular />} 
                                                            onClick={() => handleOpenShell(resourceDetail.metadata.namespace, resourceDetail.metadata.name, c.name)}
                                                        >
                                                            Shell
                                                        </Button>
                                                    ) : undefined
                                                }
                                                />
                                                <div style={{ padding: '1rem' }}>
                                                    <div className={styles.kvTable}>
                                                        {status && (
                                                            <>
                                                            <span>Restarts</span> <span>{status?.restart_count || 0}</span>
                                                            <span>State</span> <span>{status?.state ? Object.keys(status.state)[0] : 'Unknown'}</span>
                                                            </>
                                                        )}
                                                        {c.ports?.length > 0 && (
                                                            <>
                                                            <span>Ports</span>
                                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                                {c.ports.map((p: any, idx: number) => (
                                                                    <Badge key={idx} appearance="outline">{p.container_port || p.containerPort}/{p.protocol}</Badge>
                                                                ))}
                                                            </div>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </Card>
                                        );
                                    })}
                                    </>
                                )}
                            </div>
                        )}

                        {detailTab === 'pods' && (
                            <div className={styles.tableCard}>
                                <Table>
                                    <TableHeader>
                                        <TableRow style={{ backgroundColor: 'var(--colorNeutralBackground3)' }}>
                                            <TableHeaderCell>Name</TableHeaderCell>
                                            <TableHeaderCell>Namespace</TableHeaderCell>
                                            <TableHeaderCell>Status</TableHeaderCell>
                                            <TableHeaderCell>CPU</TableHeaderCell>
                                            <TableHeaderCell>Memory</TableHeaderCell>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {detailPods.map(p => {
                                            const { cpu, mem } = getMetricValues(p);
                                            return (
                                                <TableRow key={p.name}>
                                                    <TableCell><span className={styles.clickableName} onClick={() => setSelectedResource({ type: 'pods', name: p.name, namespace: p.namespace })}>{p.name}</span></TableCell>
                                                    <TableCell><Badge appearance="tint">{p.namespace}</Badge></TableCell>
                                                    <TableCell><Badge color={p.status === 'Running' ? 'success' : 'important'}>{p.status}</Badge></TableCell>
                                                    <TableCell><span style={{ fontSize: '0.8rem' }}>{cpu}</span></TableCell>
                                                    <TableCell><span style={{ fontSize: '0.8rem' }}>{mem}</span></TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        )}

                        {detailTab === 'events' && (
                            <div className={styles.tableCard}>
                                <Table>
                                    <TableHeader>
                                        <TableRow style={{ backgroundColor: 'var(--colorNeutralBackground3)' }}>
                                            <TableHeaderCell style={{ width: '80px' }}>Type</TableHeaderCell>
                                            <TableHeaderCell style={{ width: '150px' }}>Reason</TableHeaderCell>
                                            <TableHeaderCell>Message</TableHeaderCell>
                                            <TableHeaderCell style={{ width: '150px' }}>Last Seen</TableHeaderCell>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {detailEvents.map((e, idx) => (
                                            <TableRow key={idx}>
                                                <TableCell>
                                                    {e.type === 'Normal' ? <CheckmarkCircle20Regular style={{ color: '#10b981' }} /> : <Warning20Regular style={{ color: '#ef4444' }} />}
                                                </TableCell>
                                                <TableCell><strong>{e.reason}</strong></TableCell>
                                                <TableCell><span style={{ fontSize: '0.85rem' }}>{e.message}</span></TableCell>
                                                <TableCell><span style={{ fontSize: '0.8rem', opacity: 0.7 }}>{new Date(e.last_timestamp).toLocaleString()}</span></TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}

                        {detailTab === 'images' && resourceDetail.status.images && (
                             <div className={styles.tableCard}>
                                <Table>
                                    <TableHeader>
                                        <TableRow style={{ backgroundColor: 'var(--colorNeutralBackground3)' }}>
                                            <TableHeaderCell>Image Name</TableHeaderCell>
                                            <TableHeaderCell style={{ width: '100px' }}>Size</TableHeaderCell>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {resourceDetail.status.images.map((img: any, idx: number) => (
                                            <TableRow key={idx}>
                                                <TableCell><code style={{ fontSize: '0.8rem' }}>{img.names[0] || '---'}</code></TableCell>
                                                <TableCell>{(img.size_bytes / (1024**2)).toFixed(1)} MB</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                             </div>
                        )}
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', opacity: 0.5, paddingTop: '4rem' }}>
                        Failed to load resource details.
                    </div>
                )
            ) : activeView === 'overview' ? (
                <div className={styles.overviewGrid}>
                    <div className={styles.metricCard}>
                        <Title3>Cluster Info</Title3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                            <div className={styles.infoItem}>
                                <span style={{ opacity: 0.6, fontSize: '0.85rem' }}>Provider</span>
                                <Badge appearance="tint" color="brand">{overview?.provider}</Badge>
                            </div>
                            <div className={styles.infoItem}>
                                <span style={{ opacity: 0.6, fontSize: '0.85rem' }}>Version</span>
                                <span style={{ fontSize: '0.85rem' }}>{overview?.version}</span>
                            </div>
                            <div className={styles.infoItem}>
                                <span style={{ opacity: 0.6, fontSize: '0.85rem' }}>Architecture</span>
                                <span style={{ fontSize: '0.85rem' }}>{overview?.architectures?.join(', ')}</span>
                            </div>
                            <div className={styles.infoItem}>
                                <span style={{ opacity: 0.6, fontSize: '0.85rem' }}>Age</span>
                                <span style={{ fontSize: '0.85rem' }}>{overview?.age ? new Date(overview.age).toLocaleDateString() : '---'}</span>
                            </div>
                        </div>
                    </div>

                    <div className={styles.metricCard}>
                        <Title3>Resource Capacity</Title3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.8rem' }}>
                                    <span>CPU (Reserved / Allocatable)</span>
                                    <span>{(overview?.capacity?.cpu?.reserved / 1000).toFixed(1)} / {(overview?.capacity?.cpu?.allocatable / 1000).toFixed(1)} Cores</span>
                                </div>
                                <ProgressBar 
                                    value={overview?.capacity?.cpu?.reserved} 
                                    max={overview?.capacity?.cpu?.allocatable} 
                                    color={overview?.capacity?.cpu?.reserved / overview?.capacity?.cpu?.allocatable > 0.8 ? 'error' : 'brand'}
                                />
                            </div>
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.8rem' }}>
                                    <span>Memory (Reserved / Allocatable)</span>
                                    <span>{(overview?.capacity?.memory?.reserved / (1024**3)).toFixed(1)} / {(overview?.capacity?.memory?.allocatable / (1024**3)).toFixed(1)} GiB</span>
                                </div>
                                <ProgressBar 
                                    value={overview?.capacity?.memory?.reserved} 
                                    max={overview?.capacity?.memory?.allocatable} 
                                    color={overview?.capacity?.memory?.reserved / overview?.capacity?.memory?.allocatable > 0.8 ? 'error' : 'brand'}
                                />
                            </div>
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.8rem' }}>
                                    <span>Pods (Used / Total)</span>
                                    <span>{overview?.capacity?.pods?.current} / {overview?.capacity?.pods?.total}</span>
                                </div>
                                <ProgressBar 
                                    value={overview?.capacity?.pods?.current} 
                                    max={overview?.capacity?.pods?.total} 
                                    color={overview?.capacity?.pods?.current / overview?.capacity?.pods?.total > 0.8 ? 'error' : 'brand'}
                                />
                            </div>
                        </div>
                    </div>

                    <div className={styles.metricCard}>
                        <Title3>Component Health</Title3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                            {overview?.components?.map((c: any) => (
                                <div key={c.name} className={styles.infoItem} style={{ borderBottom: 'none' }}>
                                    <span style={{ fontSize: '0.85rem' }}>{c.name}</span>
                                    <Badge color={c.status === 'Healthy' ? 'success' : 'important'} appearance="outline">
                                        {c.status}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className={styles.metricCard}>
                        <Title3>Quick Stats</Title3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
                            <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '6px' }}>
                                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{overview?.counts?.nodes}</div>
                                <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>Nodes</div>
                            </div>
                            <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '6px' }}>
                                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{overview?.counts?.namespaces}</div>
                                <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>Namespaces</div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
              <div className={styles.tableCard}>
                <Table>
                  <TableHeader>
                    <TableRow style={{ backgroundColor: 'var(--colorNeutralBackground3)' }}>
                      {renderTableHeaders()}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedAndFilteredResources.map(renderResourceRow)}
                  </TableBody>
                </Table>
                {sortedAndFilteredResources.length === 0 && !loading && (
                  <div style={{ textAlign: 'center', padding: '4rem', opacity: 0.5 }}>
                    No resources found.
                  </div>
                )}
              </div>
            )}
          </div>
        </main>

        {panels.length > 0 && context && (
          <div className={styles.drawer} style={{ height: `${drawerHeight}px` }}>
            <div className={styles.resizer} onMouseDown={startResizing} />
            <div className={styles.drawerHeader} style={{ padding: '0 0.5rem' }}>
              <TabList 
                selectedValue={activePanelId || ''} 
                onTabSelect={(_, data) => setActivePanelId(data.value as string)}
                size="small"
              >
                {panels.map(p => (
                  <Tab key={p.id} value={p.id}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                       <span style={{ fontSize: '0.8rem' }}>
                        {p.type === 'logs' ? 'Logs' : p.type === 'yaml' ? 'YAML' : 'Shell'}: {p.name}
                      </span>
                      <div className={styles.closeTabButton} onClick={(e) => handleClosePanel(p.id, e)}>
                         <Dismiss16Regular />
                      </div>
                    </div>
                  </Tab>
                ))}
              </TabList>
              
              <div style={{ display: 'flex', gap: '0.25rem', paddingRight: '0.5rem' }}>
                {activePanel && activePanel.type !== 'shell' && (
                  <Button 
                    size="small" 
                    appearance="subtle" 
                    icon={<MoreHorizontal20Regular />} 
                    onClick={() => handlePopOut(activePanel)}
                    title="Pop out to new window"
                  />
                )}
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              {panels.map(p => (
                <div key={p.id} style={{ display: p.id === activePanelId ? 'block' : 'none', height: '100%' }}>
                  {p.type === 'logs' ? (
                    <LogsViewer context={context} namespace={p.namespace} pod={p.name} />
                  ) : p.type === 'yaml' ? (
                    <YamlEditor 
                      context={context} 
                      namespace={p.namespace} 
                      name={p.name} 
                      resourceType={activeView === 'pods' ? 'pods' : 'deployments'} 
                    />
                  ) : (
                    <ShellTerminal
                        context={context}
                        namespace={p.namespace}
                        pod={p.name}
                        container={p.container || 'default'}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
