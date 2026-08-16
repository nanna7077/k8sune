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
  Textarea,
  Checkbox,
  Tooltip
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
  ArrowUpload20Regular,
  Add20Regular,
  WindowConsole20Regular,
  Delete20Regular
} from '@fluentui/react-icons';
import { apiFetch, getBackendPort } from '../utils/api';
import { openSectionWindow } from '../utils/windowManager';
import { useStore } from '../store/useStore';
import { Mascot } from './Mascot';
import { ACCENT_OPTIONS } from '../themes/tokens';
import { LogsViewer } from './LogsViewer';
import { YamlEditor } from './YamlEditor';
import { ShellTerminal } from './ShellTerminal';
import { useFeedbackDialog } from './FeedbackDialog';
import { EventTimeline } from './EventTimeline';
import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, readFile, writeTextFile, writeFile } from '@tauri-apps/plugin-fs';
import { getVersion } from '@tauri-apps/api/app';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    height: '100%',
    width: '100%',
    backgroundColor: 'transparent',
    backgroundImage: 'var(--app-gradient)',
    backgroundAttachment: 'fixed',
    color: 'var(--colorNeutralForeground1)',
    overflow: 'hidden'
  },
  sidebar: {
    width: '248px',
    backgroundColor: 'rgba(15, 17, 24, 0.86)',
    backdropFilter: 'blur(20px)',
    ...shorthands.borderRight('1px', 'solid', 'rgba(171, 183, 220, 0.12)'),
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.padding('1.25rem', '0.75rem'),
    gap: '1.25rem',
    overflowY: 'auto'
  },
  mainContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: 0,
    minWidth: 0,
    overflow: 'hidden'
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    minHeight: 0,
    minWidth: 0,
    backgroundColor: 'transparent',
  },
  drawer: {
    backgroundColor: 'rgba(18, 20, 27, 0.95)',
    ...shorthands.borderTop('1px', 'solid', 'rgba(171, 183, 220, 0.14)'),
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
    backgroundColor: 'rgba(255,255,255,0.018)',
    ...shorthands.borderBottom('1px', 'solid', 'rgba(171, 183, 220, 0.1)'),
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: '78px',
    ...shorthands.padding('1.1rem', '1.75rem'),
    ...shorthands.borderBottom('1px', 'solid', 'rgba(171, 183, 220, 0.1)'),
    backgroundColor: 'rgba(11, 12, 16, 0.42)',
    backdropFilter: 'blur(16px)',
  },
  content: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    height: 0,
    overflowY: 'auto',
    overflowX: 'hidden',
    ...shorthands.padding('1.75rem'),
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
    backgroundColor: 'transparent',
    minHeight: 0,
    minWidth: 0,
  },
  tableCard: {
    backgroundColor: 'rgba(20, 22, 30, 0.72)',
    ...shorthands.border('1px', 'solid', 'rgba(171, 183, 220, 0.13)'),
    ...shorthands.borderRadius('14px'),
    overflow: 'hidden'
  },
  tabList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  sidebarItem: {
    justifyContent: 'flex-start',
    ...shorthands.padding('8px', '10px'),
    fontSize: '0.85rem',
    width: '100%',
    textAlign: 'left',
    borderRadius: '8px',
    color: 'var(--colorNeutralForeground2)',
    transitionDuration: '160ms',
    '&:hover': { backgroundColor: 'rgba(174, 189, 255, 0.08)', color: 'var(--colorNeutralForeground1)' }
  },
  sidebarSubItem: {
    justifyContent: 'flex-start',
    ...shorthands.padding('6px', '24px'),
    fontSize: '0.8rem',
    width: '100%',
    textAlign: 'left',
    opacity: 0.8,
    borderRadius: '8px'
  },
  contextDropdown: {
    width: '100%',
    backgroundColor: 'rgba(174, 189, 255, 0.06)',
    ...shorthands.borderRadius('10px'),
    ...shorthands.padding('10px', '12px'),
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...shorthands.border('1px', 'solid', 'rgba(174, 189, 255, 0.16)'),
    '&:hover': {
      backgroundColor: 'rgba(174, 189, 255, 0.12)',
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
    gap: '1rem',
  },
  metricCard: {
    backgroundColor: 'rgba(20, 22, 30, 0.72)',
    ...shorthands.border('1px', 'solid', 'rgba(171, 183, 220, 0.13)'),
    ...shorthands.borderRadius('14px'),
    ...shorthands.padding('1.25rem'),
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    boxShadow: '0 16px 38px -28px rgba(0, 0, 0, 0.9)',
    transitionDuration: '180ms'
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
  truncatedName: {
    display: 'block',
    maxWidth: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
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
    gap: '0.65rem',
    alignItems: 'center'
  },
  namespaceDropdown: {
    minWidth: '180px',
  },
  accentOptions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  accentButton: {
    minWidth: '38px',
    width: '38px',
    height: '38px',
    ...shorthands.padding(0),
    ...shorthands.borderRadius('50%'),
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
  resourceType?: string;
}

interface ResourceDetail {
    metadata: any;
    status: any;
    spec?: any;
    counts?: any;
    usage?: any;
    pods?: any[];
}

const ConfigMapEditorDetail = ({ context, resource }: { context: string; resource: ResourceDetail }) => (
  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: '1rem' }}>
    <Card style={{ backgroundColor: 'var(--colorNeutralBackground2)', flexShrink: 0 }}>
      <CardHeader header={<Subtitle2>Metadata</Subtitle2>} />
      <div style={{ padding: '0 1rem 1rem', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <strong style={{ marginRight: '4px' }}>{resource.metadata.name}</strong>
        {resource.metadata.namespace && <Badge appearance="tint" color="brand">Namespace: {resource.metadata.namespace}</Badge>}
        <Badge appearance="tint" color="subtle">Age: {new Date(resource.metadata.creation_timestamp).toLocaleString()}</Badge>
        {Object.entries(resource.metadata.labels || {}).map(([key, value]) => (
          <Badge key={key} appearance="outline">{key}: {String(value)}</Badge>
        ))}
      </div>
    </Card>
    <div style={{ flex: 1, minHeight: '420px', overflow: 'hidden' }}>
      <YamlEditor
        context={context}
        namespace={resource.metadata.namespace || 'default'}
        name={resource.metadata.name}
        resourceType="configmaps"
      />
    </div>
  </div>
);

const CustomResourceSummary = ({ kind, resource }: { kind?: string; resource: ResourceDetail }) => {
  const spec = resource.spec || {};
  const status = resource.status || {};
  const isVpa = kind === 'VerticalPodAutoscaler';
  const isVpaCheckpoint = kind === 'VerticalPodAutoscalerCheckpoint';
  if (!isVpa && !isVpaCheckpoint) return <>
    {Object.entries(spec).slice(0, 10).map(([key, value]) => <div key={key} style={{ fontSize: '0.75rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}><strong>{key}:</strong> {typeof value === 'object' ? JSON.stringify(value) : String(value)}</div>)}
    {Object.keys(spec).length > 10 && <div style={{ fontSize: '0.7rem', opacity: 0.5 }}>+ {Object.keys(spec).length - 10} more fields</div>}
  </>;

  const target = spec.targetRef || {};
  const recommendation = status.recommendation || spec.recommendation || {};
  const containers = recommendation.containerRecommendations || spec.containerRecommendations || [];
  return <div style={{ display: 'grid', gap: '10px', fontSize: '0.8rem' }}>
    {isVpa ? <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        <Badge appearance="tint" color="brand">Target: {target.kind || 'Workload'}/{target.name || '—'}</Badge>
        <Badge appearance="tint">Mode: {spec.updatePolicy?.updateMode || 'Auto'}</Badge>
      </div>
      {containers.length ? <div style={{ display: 'grid', gap: '5px' }}>{containers.map((container: any) => <div key={container.containerName || 'container'}><strong>{container.containerName || 'container'}</strong><span style={{ opacity: 0.7 }}> · target </span><code>{Object.entries(container.target || {}).map(([key, value]) => `${key}=${value}`).join(', ') || '—'}</code></div>)}</div> : <span style={{ opacity: 0.65 }}>No recommendation has been recorded yet.</span>}
    </> : <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        <Badge appearance="tint" color="brand">VPA: {spec.vpaObjectName || spec.vpaName || '—'}</Badge>
        <Badge appearance="tint">Container: {spec.containerName || '—'}</Badge>
      </div>
      <span style={{ opacity: 0.72 }}>Checkpoint data is controller-managed. Review the YAML before making changes.</span>
    </>}
  </div>;
};

const NATIVE_OTHERS = [
  { label: 'Services', plural: 'services', group: 'core', version: 'v1' },
  { label: 'Ingresses', plural: 'ingresses', group: 'networking.k8s.io', version: 'v1' },
  { label: 'ReplicaSets', plural: 'replicasets', group: 'apps', version: 'v1' },
  { label: 'Jobs', plural: 'jobs', group: 'batch', version: 'v1' },
];

const CREATE_KIND_BY_VIEW: Record<string, string> = {
  deployments: 'Deployment',
  statefulsets: 'StatefulSet',
  daemonsets: 'DaemonSet',
  cronjobs: 'CronJob',
  configmaps: 'ConfigMap',
  secrets: 'Secret',
  persistentvolumeclaims: 'PersistentVolumeClaim',
};

const yamlScalar = (value: unknown) => {
  if (value === null) return 'null';
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  const text = String(value);
  return text === '' || /^(true|false|null|~|yes|no|on|off)$/i.test(text) || /[:#{}\[\],&*!|>'"%@`]|^[-?]|\n|^\s|\s$/.test(text)
    ? JSON.stringify(text)
    : text;
};

/** A small YAML emitter for builder manifests. Keeping it local avoids a runtime dependency for one dialog. */
const toYaml = (value: unknown, indent = 0): string => {
  const padding = ' '.repeat(indent);
  if (Array.isArray(value)) {
    return value.map(item => {
      if (item && typeof item === 'object') {
        const nested = toYaml(item, indent + 2);
        const [first, ...rest] = nested.split('\n');
        return `${padding}- ${first.trimStart()}${rest.length ? `\n${rest.join('\n')}` : ''}`;
      }
      return `${padding}- ${yamlScalar(item)}`;
    }).join('\n');
  }
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).map(([key, item]) => {
      const renderedKey = /^[A-Za-z_][A-Za-z0-9_.-]*$/.test(key) ? key : JSON.stringify(key);
      if (item && typeof item === 'object') return `${padding}${renderedKey}:\n${toYaml(item, indent + 2)}`;
      return `${padding}${renderedKey}: ${yamlScalar(item)}`;
    }).join('\n');
  }
  return `${padding}${yamlScalar(value)}`;
};

export const Dashboard = ({ context: initialContext, initialResource, initialView, initialNodeCommand }: {
  context: string;
  initialResource?: { type: string; name: string; namespace?: string };
  initialView?: string;
  initialNodeCommand?: boolean;
}) => {
  const styles = useStyles();
  const feedback = useFeedbackDialog();
  const { 
    contexts, 
    activeContext, 
    setContexts, 
    setActiveContext,
    accent,
    setAccent
  } = useStore();

  const [activeView, setActiveView] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [contextFilter, setContextFilter] = useState('');
  const [namespaceFilter, setNamespaceFilter] = useState('');
  const [panels, setPanels] = useState<PanelState[]>([]);
  const [activePanelId, setActivePanelId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isContextManagerOpen, setIsContextManagerOpen] = useState(false);
  const [contextDetails, setContextDetails] = useState<any[]>([]);
  const [editingContext, setEditingContext] = useState<any | null>(null);
  const [isApplyYamlOpen, setIsApplyYamlOpen] = useState(false);
  const [isPortForwardManagerOpen, setIsPortForwardManagerOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isNodeCommandOpen, setIsNodeCommandOpen] = useState(false);
  const [nodeCommand, setNodeCommand] = useState('uname -a');
  const [nodeCommandTimeout, setNodeCommandTimeout] = useState('45');
  const [nodeCommandResult, setNodeCommandResult] = useState<any[]>([]);
  const [isRunningNodeCommand, setIsRunningNodeCommand] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [importTab, setImportTab] = useState('file');
  const [importYaml, setImportYaml] = useState('');
  const [yamlToApply, setYamlToApply] = useState('');
  const [createKind, setCreateKind] = useState('Deployment');
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createBuilderTab, setCreateBuilderTab] = useState('General');
  const [createImage, setCreateImage] = useState('nginx:latest');
  const [createReplicas, setCreateReplicas] = useState('1');
  const [createSchedule, setCreateSchedule] = useState('*/5 * * * *');
  const [createDataKey, setCreateDataKey] = useState('key');
  const [createDataValue, setCreateDataValue] = useState('value');
  const [createSecretType, setCreateSecretType] = useState('Opaque');
  const [createSecretSecondaryValue, setCreateSecretSecondaryValue] = useState('');
  const [createSecretServiceAccount, setCreateSecretServiceAccount] = useState('');
  const [createStorage, setCreateStorage] = useState('1Gi');
  const [createNodeSelector, setCreateNodeSelector] = useState('');
  const [createServiceAccount, setCreateServiceAccount] = useState('');
  const [createCommand, setCreateCommand] = useState('');
  const [createEnv, setCreateEnv] = useState('');
  const [createCpuRequest, setCreateCpuRequest] = useState('');
  const [createMemoryRequest, setCreateMemoryRequest] = useState('');
  const [createCpuLimit, setCreateCpuLimit] = useState('');
  const [createMemoryLimit, setCreateMemoryLimit] = useState('');
  const [applyNamespace, setApplyNamespace] = useState('');
  const [isApplyingYaml, setIsApplyingYaml] = useState(false);
  const [formEditTarget, setFormEditTarget] = useState<{ type: string; namespace: string; name: string } | null>(null);
  const [drawerHeight, setDrawerHeight] = useState(400);
  const isResizing = useRef(false);
  
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [visibleCount, setVisibleCount] = useState(100);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [metrics, setMetrics] = useState<Record<string, any>>({});
  const [crds, setCrds] = useState<CRD[]>([]);
  const [pinnedCustomKinds, setPinnedCustomKinds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('k8sune.pinnedCustomKinds') || '[]'); } catch { return []; }
  });
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [selectedNamespaces, setSelectedNamespaces] = useState<string[]>(['All Namespaces']);
  const [clusterSettings, setClusterSettings] = useState<any>({ metrics_source: 'standard' });
  const [overview, setOverview] = useState<any>(null);
  const [rbacData, setRbacData] = useState<any>(null);
  const [networkData, setNetworkData] = useState<any>(null);
  const [storageData, setStorageData] = useState<any>(null);
  const [helmData, setHelmData] = useState<any>(null);
  const [helmError, setHelmError] = useState<string | null>(null);
  const [viewError, setViewError] = useState<string | null>(null);
  const [helmRelease, setHelmRelease] = useState<any>(null);
  const [helmHistory, setHelmHistory] = useState<any[]>([]);
  const [helmValuesDiff, setHelmValuesDiff] = useState('');
  const [helmDrift, setHelmDrift] = useState<any | null>(null);
  const [helmDriftLoading, setHelmDriftLoading] = useState(false);
  const [storageSection, setStorageSection] = useState<'pvcs' | 'pvs' | 'classes' | 'attachments' | 'snapshots'>('pvcs');
  const [networkSection, setNetworkSection] = useState<'services' | 'ingresses' | 'policies' | 'endpoints' | 'diagnostics'>('services');
  const [dnsHost, setDnsHost] = useState('kubernetes.default.svc');
  const [dnsResult, setDnsResult] = useState<any>(null);
  const [connectionHost, setConnectionHost] = useState('');
  const [connectionPort, setConnectionPort] = useState('80');
  const [networkProbeNode, setNetworkProbeNode] = useState('');
  const [connectionResult, setConnectionResult] = useState<any>(null);
  const [isRunningDnsCheck, setIsRunningDnsCheck] = useState(false);
  const [isRunningConnectionCheck, setIsRunningConnectionCheck] = useState(false);
  const [rbacServiceAccountAccess, setRbacServiceAccountAccess] = useState<any | null>(null);
  const [rbacBindingEditor, setRbacBindingEditor] = useState<any | null>(null);
  const [rbacSubjectDraft, setRbacSubjectDraft] = useState({ kind: 'ServiceAccount', name: '', namespace: '' });
  const [selectedResource, setSelectedResource] = useState<{ type: string, name: string, namespace?: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ namespace?: string; name: string; type: string } | null>(null);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [deleteDryRunResult, setDeleteDryRunResult] = useState<string | null>(null);
  const [isCheckingDelete, setIsCheckingDelete] = useState(false);
  const [resourceDetail, setResourceDetail] = useState<ResourceDetail | null>(null);
  const [detailTab, setDetailTab] = useState('overview');
  const [detailPods, setDetailPods] = useState<ResourceItem[]>([]);
  const [detailEvents, setDetailEvents] = useState<any[]>([]);
  const [detailEventsWarnings, setDetailEventsWarnings] = useState<string[]>([]);
  const [activePortForwards, setActivePortForwards] = useState<any[]>([]);
  const [resourceContextMenu, setResourceContextMenu] = useState<{ resource: ResourceItem; x: number; y: number } | null>(null);
  const [shellContainerPicker, setShellContainerPicker] = useState<{ namespace: string; pod: string; containers: string[] } | null>(null);
  const [sidebarContextMenu, setSidebarContextMenu] = useState<{ x: number; y: number; view?: string; contextMenu?: boolean } | null>(null);
  const [backupNamespace, setBackupNamespace] = useState<string | null>(null);
  const [backupKinds, setBackupKinds] = useState<{ kind: string; resources: string[] }[]>([]);
  const [backupSelection, setBackupSelection] = useState<Record<string, string[]>>({});
  const [backupBusy, setBackupBusy] = useState(false);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const [isReachable, setIsReachable] = useState<boolean>(true);

  // Sorting state
  const [sortState, setSortState] = useState<{ columnId: string, direction: 'ascending' | 'descending' }>({ 
    columnId: 'name', 
    direction: 'ascending' 
  });

  const context = activeContext || initialContext;

  const runDnsCheck = async () => {
    if (!dnsHost.trim()) return;
    setIsRunningDnsCheck(true);
    try {
      setDnsResult(await apiFetch<any>(`/api/network/${encodeURIComponent(context || '')}/dns`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ host: dnsHost.trim(), source_node: networkProbeNode || undefined }) }));
    } catch (error: any) {
      setDnsResult({ error: error.message || String(error) });
    } finally { setIsRunningDnsCheck(false); }
  };

  const runConnectionTest = async () => {
    if (!connectionHost.trim() || !connectionPort) return;
    setIsRunningConnectionCheck(true);
    try {
      setConnectionResult(await apiFetch<any>(`/api/network/${encodeURIComponent(context || '')}/connection-test`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ host: connectionHost.trim(), port: Number(connectionPort), timeout_seconds: 5, source_node: networkProbeNode || undefined }) }));
    } catch (error: any) {
      setConnectionResult({ reachable: false, error: error.message || String(error) });
    } finally { setIsRunningConnectionCheck(false); }
  };

  const openHelmRelease = async (release: any) => {
    try {
      setHelmRelease(release);
      setHelmDrift(null);
      const history = await apiFetch<any>(`/api/helm/${context}/releases/${encodeURIComponent(release.namespace)}/${encodeURIComponent(release.name)}/history`);
      setHelmHistory(history.history || []);
      const revisions = history.history || [];
      if (revisions.length > 1) {
        const diff = await apiFetch<any>(`/api/helm/${context}/releases/${encodeURIComponent(release.namespace)}/${encodeURIComponent(release.name)}/values-diff?from_revision=${revisions[revisions.length - 2].revision}&to_revision=${revisions[revisions.length - 1].revision}`);
        setHelmValuesDiff(diff.diff || 'No values changes.');
      } else setHelmValuesDiff('No prior revision to compare.');
    } catch (error: any) { feedback.notice('Could not load Helm release', error.message || String(error), 'error'); }
  };

  const loadHelmDrift = async () => {
    if (!helmRelease || !context) return;
    setHelmDriftLoading(true);
    try {
      setHelmDrift(await apiFetch<any>(`/api/helm/${context}/releases/${encodeURIComponent(helmRelease.namespace)}/${encodeURIComponent(helmRelease.name)}/drift`));
    } catch (error: any) {
      feedback.notice('Could not compare release resources', error.message || String(error), 'error');
    } finally {
      setHelmDriftLoading(false);
    }
  };

  useEffect(() => { if (initialNodeCommand) setIsNodeCommandOpen(true); }, [initialNodeCommand]);

  const fetchContexts = async () => {
    try {
      const data = await apiFetch<{ contexts: string[], active_context: string, details?: any[] }>('/api/contexts');
      setContexts(data.contexts);
      setContextDetails(data.details || []);
      if (!activeContext) setActiveContext(data.active_context);
    } catch (e) {
      console.error(e);
    }
  };

  const saveContextDetails = async () => {
    if (!editingContext) return;
    try {
      await apiFetch(`/api/contexts/${encodeURIComponent(editingContext.name)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ namespace: editingContext.namespace, server: editingContext.server }) });
      setEditingContext(null);
      await fetchContexts();
      feedback.notice('Context updated', `${editingContext.name} was updated.`, 'success');
    } catch (error) { feedback.notice('Could not update context', String(error), 'error'); }
  };

  const removeContext = async (item: any) => {
    if (!await feedback.confirm('Remove context?', `Remove “${item.name}” from your kubeconfig? Shared credentials and cluster entries are kept.`, { confirmLabel: 'Remove', destructive: true })) return;
    try {
      await apiFetch(`/api/contexts/${encodeURIComponent(item.name)}`, { method: 'DELETE' });
      if (activeContext === item.name) setActiveContext(null);
      await fetchContexts();
    } catch (error) { feedback.notice('Could not remove context', String(error), 'error'); }
  };

  const toggleFavoriteContext = async (item: any) => {
    await apiFetch(`/api/contexts/settings/${encodeURIComponent(item.name)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings: { favorite: !item.favorite } }) });
    await fetchContexts();
  };

  const refreshRbac = async () => {
    if (!context) return;
    const namespace = selectedNamespaces.includes('All Namespaces') ? 'default' : selectedNamespaces[0] || 'default';
    setRbacData(await apiFetch<any>(`/api/rbac/${context}?namespace=${encodeURIComponent(namespace)}`));
  };

  const createRbacServiceAccount = async () => {
    const name = await feedback.prompt('Create ServiceAccount', 'Enter a ServiceAccount name.');
    if (!name?.trim()) return;
    const namespace = selectedNamespaces.includes('All Namespaces') ? 'default' : selectedNamespaces[0] || 'default';
    try {
      await apiFetch(`/api/rbac/${context}/serviceaccounts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim(), namespace }) });
      await refreshRbac();
      feedback.notice('ServiceAccount created', `${namespace}/${name.trim()} is ready.`, 'success');
    } catch (error) { feedback.notice('Could not create ServiceAccount', String(error), 'error'); }
  };

  const deleteRbacBinding = async (item: any, cluster: boolean) => {
    if (!await feedback.confirm('Remove role binding?', `Remove “${item.name}”? This immediately revokes the permissions granted by this binding.`, { confirmLabel: 'Remove binding', destructive: true })) return;
    try {
      await apiFetch(`/api/rbac/${context}/bindings/${cluster ? 'cluster' : 'namespaced'}/${encodeURIComponent(item.namespace || '_')}/${encodeURIComponent(item.name)}`, { method: 'DELETE' });
      await refreshRbac();
    } catch (error) { feedback.notice('Could not remove binding', String(error), 'error'); }
  };

  const showServiceAccountAccess = async (item: any) => {
    try { setRbacServiceAccountAccess(await apiFetch<any>(`/api/rbac/${context}/serviceaccounts/${encodeURIComponent(item.namespace)}/${encodeURIComponent(item.name)}`)); }
    catch (error) { feedback.notice('Could not load ServiceAccount access', String(error), 'error'); }
  };

  const saveRbacBinding = async () => {
    const item = rbacBindingEditor;
    if (!item) return;
    const subjects = item.subjects || [];
    try {
      await apiFetch(`/api/rbac/${context}/bindings/${item.cluster ? 'cluster' : 'namespaced'}/${encodeURIComponent(item.namespace || '_')}/${encodeURIComponent(item.name)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role_kind: item.roleKind, role_name: item.roleName, subjects }) });
      setRbacBindingEditor(null); await refreshRbac(); feedback.notice('Binding updated', `${item.name} was updated.`, 'success');
    } catch (error) { feedback.notice('Could not update binding', String(error), 'error'); }
  };

  const fetchNamespaces = async () => {
    if (!context) return;
    try {
      const names: string[] = [];
      let continuation: string | null = null;
      do {
        const query = new URLSearchParams({ limit: '200' });
        if (continuation) query.set('continue', continuation);
        const data = await apiFetch<{ items: any[]; continue?: string }>(`/api/resources/${context}/namespaces?${query}`);
        names.push(...data.items.map(n => n.name));
        continuation = data.continue || null;
      } while (continuation);
      setNamespaces(names);
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
          feedback.notice('Could not save settings', String(e), 'error');
      }
  }

  const loadActivePortForwards = async () => {
    if (!context) return;
    try {
      const data = await apiFetch<any[]>(`/api/portforward/active?context_name=${context}`);
      setActivePortForwards(data);
    } catch (e) {
      console.error("Failed to load active port forwards", e);
    }
  };

  const handleDeleteResource = async (ns: string | undefined, name: string, type: string) => {
    setPendingDelete({ namespace: ns, name, type });
    setDeleteConfirmationText('');
    setDeleteDryRunResult(null);
  };

  const executeDeleteResource = async (dryRun = false) => {
    if (!pendingDelete) return;
    const { namespace: ns, name, type } = pendingDelete;
    try {
      const resourceNamespace = ns || 'none';
      const targetType = type === 'other_replicasets' ? 'replicasets' : type === 'other_jobs' ? 'jobs' : type === 'other_services' ? 'services' : type === 'other_ingresses' ? 'ingresses' : type === 'persistentvolumeclaims' ? 'pvcs' : type;
      await apiFetch(`/api/resources/${context}/${targetType}/${resourceNamespace}/${name}${dryRun ? '?dry_run=true' : ''}`, {
          method: 'DELETE'
      });
      if (dryRun) {
        setDeleteDryRunResult('Server-side dry-run passed. Kubernetes accepted this delete request; no resource was removed.');
        return;
      }
      feedback.notice('Resource deleted', `Deleted ${name}.`, 'success');
      setPendingDelete(null);
      loadData();
      if (selectedResource && selectedResource.name === name && selectedResource.namespace === ns) {
          setSelectedResource(null);
          setResourceDetail(null);
      }
    } catch (e: any) {
      if (dryRun) setDeleteDryRunResult(`Dry-run failed: ${e.message || String(e)}`);
      else feedback.notice('Could not delete resource', e.message || String(e), 'error');
    }
  };

  const runDeleteDryRun = async () => {
    setIsCheckingDelete(true);
    await executeDeleteResource(true);
    setIsCheckingDelete(false);
  };

  const handleRedeploy = async (ns: string | undefined, name: string) => {
    if (!await feedback.confirm('Restart deployment?', `Trigger a rollout restart for “${name}”?`, { confirmLabel: 'Restart' })) return;
    try {
      await apiFetch(`/api/resources/${context}/deployments/${ns || 'default'}/${name}/redeploy`, {
          method: 'POST'
      });
      feedback.notice('Redeployment started', `A rollout restart was triggered for ${name}.`, 'success');
      loadData();
    } catch (e: any) {
      feedback.notice('Could not restart deployment', e.message || String(e), 'error');
    }
  };

  const handleRunCronJob = async (ns: string | undefined, name: string) => {
    try {
      const result = await apiFetch<{ job: string }>(`/api/resources/${encodeURIComponent(context || '')}/cronjobs/${encodeURIComponent(ns || 'default')}/${encodeURIComponent(name)}/run`, { method: 'POST' });
      feedback.notice('CronJob started', `Created Job ${result.job}.`, 'success');
      loadData();
    } catch (error: any) { feedback.notice('Could not start CronJob', error?.message || String(error), 'error'); }
  };

  const handleScaleDeployment = async (deployment: ResourceItem, replicas: number) => {
    if (replicas < 0) return;
    try {
      await apiFetch(`/api/resources/${context}/deployments/${deployment.namespace || 'default'}/${deployment.name}/scale?replicas=${replicas}`, { method: 'POST' });
      setResources(current => current.map(item => item.name === deployment.name && item.namespace === deployment.namespace ? { ...item, replicas } : item));
      feedback.notice('Deployment scaled', `${deployment.name} is now targeting ${replicas} replica${replicas === 1 ? '' : 's'}.`, 'success');
    } catch (error) {
      feedback.notice('Could not scale deployment', String(error), 'error');
    }
  };

  const runNodeCommand = async () => {
    if (!nodeCommand.trim()) return;
    setIsRunningNodeCommand(true); setNodeCommandResult([]);
    try {
      const result = await apiFetch<{ results: any[] }>(`/api/commands/${context}/nodes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ command: nodeCommand, namespace: selectedNamespaces.includes('All Namespaces') ? 'default' : selectedNamespaces[0] || 'default', timeout_seconds: Math.min(300, Math.max(5, Number(nodeCommandTimeout) || 45)) }) });
      setNodeCommandResult(result.results);
    } catch (error) { feedback.notice('Node command failed', String(error), 'error'); }
    finally { setIsRunningNodeCommand(false); }
  };

  const handleStartPortForward = async (ns: string | undefined, name: string, defaultPortStr: string | undefined) => {
    let servicePort = 80;
    if (defaultPortStr) {
      const cleanPort = defaultPortStr.split('/')[0];
      const parsed = parseInt(cleanPort.split(':')[0]);
      if (!isNaN(parsed)) servicePort = parsed;
    }

    const portPrompt = await feedback.prompt('Start port forward', `Enter a local port for service port ${servicePort}. Leave this empty to allocate a free port.`);
    if (portPrompt === null) return; // User cancelled

    const localPort = portPrompt.trim() ? parseInt(portPrompt.trim()) : null;
    if (localPort !== null && isNaN(localPort)) {
        feedback.notice('Invalid port', 'Enter a valid numeric local port.', 'warning');
        return;
    }

    try {
      const res: any = await apiFetch(`/api/portforward/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context_name: context,
          namespace: ns || 'default',
          service_name: name,
          service_port: servicePort,
          local_port: localPort
        })
      });
      if (res.success) {
        feedback.notice('Port forward started', `Local port ${res.local_port} now forwards to ${name}.`, 'success');
        loadActivePortForwards();
      }
    } catch (e: any) {
      feedback.notice('Could not start port forward', e.message || String(e), 'error');
    }
  };

  const handleStopPortForward = async (ns: string | undefined, name: string) => {
    try {
      await apiFetch(`/api/portforward/stop?context_name=${context}&namespace=${ns || 'default'}&service_name=${name}`, {
        method: 'POST'
      });
      feedback.notice('Port forward stopped', `Stopped forwarding for ${name}.`, 'success');
      loadActivePortForwards();
    } catch (e: any) {
      feedback.notice('Could not stop port forward', e.message || String(e), 'error');
    }
  };

  const handleReconnectPortForward = async (session: any) => {
    try {
      const result: any = await apiFetch('/api/portforward/reconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context_name: session.context_name,
          namespace: session.namespace,
          service_name: session.service_name,
          service_port: session.service_port,
          local_port: session.local_port,
        }),
      });
      await loadActivePortForwards();
      feedback.notice('Port forward reconnected', `${session.service_name} is listening on localhost:${result.local_port}.`, 'success');
    } catch (e: any) {
      feedback.notice('Could not reconnect port forward', e.message || String(e), 'error');
    }
  };

  const handleStopAllPortForwards = async () => {
    if (!await feedback.confirm('Stop all port forwards?', `Stop all active port forwards for ${context}?`, { confirmLabel: 'Stop all', destructive: true })) return;
    try {
      const result = await apiFetch<{ stopped: number }>(`/api/portforward/stop-all?context_name=${encodeURIComponent(context)}`, { method: 'POST' });
      await loadActivePortForwards();
      feedback.notice('Port forwards stopped', `Stopped ${result.stopped} active session${result.stopped === 1 ? '' : 's'}.`, 'success');
    } catch (e: any) {
      feedback.notice('Could not stop port forwards', e.message || String(e), 'error');
    }
  };

  const handleCopyPortForwardUrl = async (session: any) => {
    const url = `http://127.0.0.1:${session.local_port}`;
    try {
      await navigator.clipboard.writeText(url);
      feedback.notice('URL copied', url, 'success');
    } catch (e) {
      feedback.notice('Could not copy URL', url, 'warning');
    }
  };

  const handleOpenPortForwardUrl = (session: any) => {
    const url = `http://127.0.0.1:${session.local_port}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const loadData = async (append = false) => {
    if (!context) return;
    if (append && (!nextPageToken || isLoadingMore)) return;
    if (append) setIsLoadingMore(true);
    else setLoading(true);
    setViewError(null);
    try {
      const pageSize = Math.max(30, Math.min(150, Math.ceil(((contentRef.current?.clientHeight || window.innerHeight - 180) / 38)) + 12));
      const query = new URLSearchParams({ limit: String(pageSize) });
      if (append && nextPageToken) query.set('continue', nextPageToken);
      if (selectedNamespaces.length === 1 && selectedNamespaces[0] !== 'All Namespaces') query.set('namespace', selectedNamespaces[0]);
      const listUrl = (path: string) => `${path}?${query.toString()}`;
      const setListPage = (data: { items: ResourceItem[]; continue?: string | null }) => {
        setResources(current => append ? [...current, ...data.items] : data.items);
        setNextPageToken(data.continue || null);
        setVisibleCount(current => append ? current + pageSize : pageSize);
      };
      loadActivePortForwards();
      if (activeView === 'overview') {
        const data = await apiFetch<any>(`/api/resources/${context}/overview`);
        setOverview(data);
      } else if (activeView === 'rbac') {
        const namespace = selectedNamespaces.includes('All Namespaces') ? 'default' : selectedNamespaces[0] || 'default';
        setRbacData(await apiFetch<any>(`/api/rbac/${context}?namespace=${encodeURIComponent(namespace)}`));
      } else if (activeView === 'network') {
        setNetworkData(await apiFetch<any>(`/api/network/${context}`));
      } else if (activeView === 'persistentvolumes') {
        setStorageData(await apiFetch<any>(`/api/storage/${context}`));
      } else if (activeView === 'helm') {
        try {
          setHelmData(await apiFetch<any>(`/api/helm/${context}/releases`));
          setHelmError(null);
        } catch (error: any) {
          // Helm can be absent or return a CLI error while the Kubernetes API is healthy.
          setHelmData({ releases: [] });
          setHelmError(error?.message || String(error));
        }
      } else if (activeView === 'crds_list') {
         const data = await apiFetch<{ items: CRD[] }>(`/api/crds/${context}`);
         setCrds(data.items);
      } else if (activeView.startsWith('custom_')) {
         const plural = activeView.replace('custom_', '');
         const crd = crds.find(c => c.plural === plural);
         if (crd) {
            const data = await apiFetch<{ items: ResourceItem[], continue?: string }>(
              listUrl(`/api/resources/${context}/generic/${crd.group}/${crd.version}/${crd.plural}`)
            );
            setListPage(data);
         }
      } else if (activeView.startsWith('other_')) {
          const plural = activeView.replace('other_', '');
          const other = NATIVE_OTHERS.find(o => o.plural === plural);
          if (other) {
            const data = await apiFetch<{ items: ResourceItem[], continue?: string }>(listUrl(`/api/resources/${context}/${plural}`));
            setListPage(data);
          }
      } else {
        const data = await apiFetch<{ items: ResourceItem[], continue?: string }>(listUrl(`/api/resources/${context}/${activeView}`));
        setListPage(data);
      }
      
      if (activeView === 'pods') {
        setupWatch();
      } else {
        if (eventSourceRef.current) eventSourceRef.current.close();
      }
      setIsReachable(true);
    } catch (e) {
      console.error(e);
      const message = e instanceof Error ? e.message : String(e);
      // Resource/API validation errors do not mean the entire cluster is down.
      if (activeView.startsWith('custom_')) {
        setIsReachable(true);
        setViewError(message);
      } else {
        setIsReachable(false);
      }
    } finally {
      setLoading(false);
      setIsLoadingMore(false);
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
      setDetailPods([]);
      setDetailEvents([]);
      setDetailEventsWarnings([]);
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
          else if (type === 'configmaps') endpoint = `/api/resources/${context}/configmaps/${ns}/${name}`;
          else if (type === 'secrets') endpoint = `/api/resources/${context}/secrets/${ns}/${name}`;
          else if (type === 'persistentvolumes') endpoint = `/api/resources/${context}/persistentvolumes/${name}`;
          else if (type === 'persistentvolumeclaims') endpoint = `/api/resources/${context}/persistentvolumeclaims/${ns}/${name}`;
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

                  if ((type === 'deployments' || type === 'statefulsets' || type === 'daemonsets' || type === 'replicasets' || type === 'other_replicasets' || type === 'jobs' || type === 'other_jobs') && data.spec?.selector) {
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
              const eventsPath = type === 'namespaces'
                ? `/api/resources/${context}/events/namespace/${name}/all`
                : `/api/resources/${context}/events/${ns}/${name}`;
              const eventsData = await apiFetch<{ items: any[], warnings?: string[] }>(eventsPath);
              setDetailEvents(eventsData.items || []);
              setDetailEventsWarnings(eventsData.warnings || []);
          } catch (err) {
              console.error("Failed to load resource events", err);
              setDetailEvents([]);
              setDetailEventsWarnings([err instanceof Error ? err.message : String(err)]);
          }
      } catch (e) {
          console.error(e);
      } finally {
          setLoading(false);
      }
  }

  const handleApplyYaml = async () => {
      if (!context || !yamlToApply.trim()) return;
      setIsApplyingYaml(true);
      try {
          const result = formEditTarget
            ? await apiFetch<{ status: string }>(`/api/yaml/${context}/${resourceTypeForAction(formEditTarget.type)}/${formEditTarget.namespace}/${formEditTarget.name}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ yaml_content: yamlToApply }) })
            : await apiFetch<{ created: number }>(`/api/yaml/${context}/apply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ yaml_content: yamlToApply, namespace: applyNamespace }) });
          setIsApplyYamlOpen(false);
          setYamlToApply('');
          setApplyNamespace('');
          setFormEditTarget(null);
          await loadData();
          feedback.notice(formEditTarget ? 'Resource updated' : 'Resources created', formEditTarget ? `${formEditTarget.name} was updated.` : `Created ${(result as { created: number }).created} resource${(result as { created: number }).created === 1 ? '' : 's'}.`, 'success');
      } catch (error) {
          feedback.notice('Could not create resources', String(error), 'error');
      } finally {
          setIsApplyingYaml(false);
      }
  };

  const generateResourceManifest = () => {
    if (!createName.trim()) { feedback.notice('Resource name required', 'Enter a name before generating the manifest.', 'warning'); return; }
    const metadata = {
      name: createName.trim(),
      ...(applyNamespace ? { namespace: applyNamespace } : {}),
      ...((createDescription.trim() || (createKind === 'Secret' && createSecretType === 'kubernetes.io/service-account-token' && createSecretServiceAccount.trim())) ? {
        annotations: {
          ...(createDescription.trim() ? { 'k8sune.io/description': createDescription.trim() } : {}),
          ...(createKind === 'Secret' && createSecretType === 'kubernetes.io/service-account-token' && createSecretServiceAccount.trim() ? { 'kubernetes.io/service-account.name': createSecretServiceAccount.trim() } : {}),
        },
      } : {}),
    };
    const nodeSelector = Object.fromEntries(createNodeSelector.split(',').map(entry => entry.trim()).filter(Boolean).map(entry => {
      const separator = entry.indexOf('=');
      return separator === -1 ? [entry, 'true'] : [entry.slice(0, separator).trim(), entry.slice(separator + 1).trim()];
    }));
    const environment = createEnv.split(',').map(entry => entry.trim()).filter(Boolean).map(entry => {
      const separator = entry.indexOf('=');
      return { name: separator === -1 ? entry : entry.slice(0, separator).trim(), value: separator === -1 ? '' : entry.slice(separator + 1) };
    });
    const resourceRequests = Object.fromEntries([['cpu', createCpuRequest], ['memory', createMemoryRequest]].filter(([, value]) => Boolean(value)));
    const resourceLimits = Object.fromEntries([['cpu', createCpuLimit], ['memory', createMemoryLimit]].filter(([, value]) => Boolean(value)));
    const container = {
      name: createName.trim(),
      image: createImage || 'nginx:latest',
      ...(createCommand.trim() ? { command: createCommand.trim().split(/\s+/) } : {}),
      ...(environment.length ? { env: environment } : {}),
      ...(Object.keys(resourceRequests).length || Object.keys(resourceLimits).length ? { resources: { ...(Object.keys(resourceRequests).length ? { requests: resourceRequests } : {}), ...(Object.keys(resourceLimits).length ? { limits: resourceLimits } : {}) } } : {}),
    };
    const podSpec = {
      ...(createServiceAccount.trim() ? { serviceAccountName: createServiceAccount.trim() } : {}),
      ...(Object.keys(nodeSelector).length ? { nodeSelector } : {}),
      containers: [container],
    };
    const podTemplate = { metadata: { labels: { app: createName.trim() } }, spec: podSpec };
    const workload = createKind === 'Deployment' ? { apiVersion: 'apps/v1', kind: createKind, metadata, spec: { replicas: Number(createReplicas) || 1, selector: { matchLabels: { app: createName.trim() } }, template: podTemplate } }
      : createKind === 'StatefulSet' ? { apiVersion: 'apps/v1', kind: createKind, metadata, spec: { serviceName: createName.trim(), replicas: Number(createReplicas) || 1, selector: { matchLabels: { app: createName.trim() } }, template: podTemplate } }
      : createKind === 'DaemonSet' ? { apiVersion: 'apps/v1', kind: createKind, metadata, spec: { selector: { matchLabels: { app: createName.trim() } }, template: podTemplate } }
      : createKind === 'CronJob' ? { apiVersion: 'batch/v1', kind: createKind, metadata, spec: { schedule: createSchedule, jobTemplate: { spec: { template: { metadata: podTemplate.metadata, spec: { ...podSpec, restartPolicy: 'OnFailure' } } } } } }
      : createKind === 'ConfigMap' ? { apiVersion: 'v1', kind: createKind, metadata, data: { [createDataKey || 'key']: createDataValue } }
      : createKind === 'Secret' ? (() => {
        const type = createSecretType;
        const stringData = type === 'kubernetes.io/tls' ? { 'tls.crt': createDataValue, 'tls.key': createSecretSecondaryValue }
          : type === 'kubernetes.io/dockerconfigjson' ? { '.dockerconfigjson': createDataValue }
          : type === 'kubernetes.io/basic-auth' ? { username: createDataValue, password: createSecretSecondaryValue }
          : type === 'kubernetes.io/ssh-auth' ? { 'ssh-privatekey': createDataValue }
          : type === 'kubernetes.io/service-account-token' ? undefined
          : { [createDataKey || 'key']: createDataValue };
        return { apiVersion: 'v1', kind: createKind, metadata, type, ...(stringData ? { stringData } : {}) };
      })()
      : { apiVersion: 'v1', kind: 'PersistentVolumeClaim', metadata, spec: { accessModes: ['ReadWriteOnce'], resources: { requests: { storage: createStorage || '1Gi' } } } };
    setYamlToApply(`${toYaml(workload)}\n`);
  };

  const handleImport = async () => {
      let content = importYaml;
      if (importTab === 'file') {
          try {
              const selected = await open();
              if (selected && !Array.isArray(selected)) {
                  content = await readTextFile(selected);
              } else return;
          } catch (e) {
              feedback.notice('Could not read file', String(e), 'error');
              return;
          }
      }

      if (!content) {
          feedback.notice('No kubeconfig content', 'Choose a file or paste kubeconfig YAML before importing.', 'warning');
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
          feedback.notice('Kubeconfig imported', 'The kubeconfig was merged successfully.', 'success');
      } catch (e) {
          feedback.notice('Kubeconfig import failed', String(e), 'error');
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

  const handleOpenYaml = (namespace: string, name: string, resourceType: string) => {
    const id = `yaml-${resourceType}-${namespace}-${name}`;
    if (!panels.find(p => p.id === id)) {
      setPanels(prev => [...prev, { id, type: 'yaml', namespace, name, resourceType }]);
    }
    setActivePanelId(id);
  };

  const resourceTypeForAction = (type: string) => {
    if (type.startsWith('custom_')) {
      const crd = crds.find(item => item.plural === type.replace('custom_', ''));
      return crd ? `custom_${crd.group}_${crd.version}_${crd.plural}` : type;
    }
    return ({ other_services: 'services', other_ingresses: 'ingresses', other_replicasets: 'replicasets', other_jobs: 'jobs', pvcs: 'persistentvolumeclaims' } as Record<string, string>)[type] || type;
  };

  const togglePinnedCustomKind = (plural: string) => {
    setPinnedCustomKinds(current => {
      const next = current.includes(plural) ? current.filter(item => item !== plural) : [...current, plural];
      localStorage.setItem('k8sune.pinnedCustomKinds', JSON.stringify(next));
      return next;
    });
  };

  const handleSaveResourceYaml = async (resource: ResourceItem) => {
    if (!context) return;
    const resourceType = resourceTypeForAction(activeView);
    try {
      const result = await apiFetch<{ yaml: string }>(`/api/yaml/${encodeURIComponent(context)}/${encodeURIComponent(resourceType)}/${encodeURIComponent(resource.namespace || 'none')}/${encodeURIComponent(resource.name)}`);
      const path = await save({ defaultPath: `${resource.name}.yaml`, filters: [{ name: 'YAML', extensions: ['yaml', 'yml'] }] });
      if (!path) return;
      await writeTextFile(path, result.yaml);
      feedback.notice('YAML saved', `Saved ${resource.name}.yaml.`, 'success');
    } catch (error: any) {
      feedback.notice('Could not save YAML', error?.message || String(error), 'error');
    }
  };

  const handleOpenResourceWindow = (resource: ResourceItem) => {
    if (!context) return;
    openSectionWindow('resource', {
      context,
      name: resource.name,
      namespace: resource.namespace || '',
      resourceType: activeView,
    });
  };

  const openResourceFormEditor = () => {
    if (!selectedResource || !resourceDetail || !CREATE_KIND_BY_VIEW[selectedResource.type]) return;
    const spec = resourceDetail.spec || {};
    const container = spec.containers?.[0] || {};
    setCreateKind(CREATE_KIND_BY_VIEW[selectedResource.type]);
    setCreateName(selectedResource.name);
    setApplyNamespace(selectedResource.namespace || '');
    setCreateDescription(resourceDetail.metadata?.annotations?.['k8sune.io/description'] || '');
    setCreateImage(container.image || createImage);
    setCreateReplicas(String(spec.replicas ?? 1));
    setCreateSchedule(spec.schedule || createSchedule);
    setCreateDataKey(selectedResource.type === 'configmaps' ? Object.keys(spec.data || {})[0] || 'key' : createDataKey);
    setCreateDataValue(selectedResource.type === 'configmaps' ? Object.values(spec.data || {})[0] as string || '' : createDataValue);
    setCreateBuilderTab(selectedResource.type === 'configmaps' || selectedResource.type === 'secrets' ? 'Data' : 'General');
    setYamlToApply('');
    setFormEditTarget({ type: selectedResource.type, namespace: selectedResource.namespace || 'default', name: selectedResource.name });
    setIsApplyYamlOpen(true);
  };

  const openNamespaceBackup = async (namespace: string) => {
    if (!context) return;
    setBackupNamespace(namespace); setBackupBusy(true);
    try {
      const result = await apiFetch<{ kinds: { kind: string; resources: string[] }[] }>(`/api/backup/${encodeURIComponent(context)}/${encodeURIComponent(namespace)}/inventory`);
      setBackupKinds(result.kinds.filter(kind => kind.resources.length));
      setBackupSelection(Object.fromEntries(result.kinds.filter(kind => kind.resources.length).map(kind => [kind.kind, [...kind.resources]])));
    } catch (error: any) { feedback.notice('Could not inspect namespace', error?.message || String(error), 'error'); setBackupNamespace(null); }
    finally { setBackupBusy(false); }
  };

  const downloadNamespaceBackup = async () => {
    if (!context || !backupNamespace) return;
    setBackupBusy(true);
    try {
      const result = await apiFetch<{ filename: string; archive: string; resources: number }>(`/api/backup/${encodeURIComponent(context)}/${encodeURIComponent(backupNamespace)}/export`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ selected: backupSelection }) });
      const path = await save({ defaultPath: result.filename, filters: [{ name: 'k8sune namespace backup', extensions: ['zip'] }] });
      if (path) {
        const binary = Uint8Array.from(atob(result.archive), char => char.charCodeAt(0));
        await writeFile(path, binary);
        feedback.notice('Namespace backup saved', `${result.resources} resource${result.resources === 1 ? '' : 's'} exported.`, 'success');
      }
    } catch (error: any) { feedback.notice('Could not export namespace backup', error?.message || String(error), 'error'); }
    finally { setBackupBusy(false); }
  };

  const restoreNamespaceBackup = async (namespace: string) => {
    if (!context) return;
    const path = await open({ multiple: false, filters: [{ name: 'k8sune namespace backup', extensions: ['zip'] }] });
    if (!path || Array.isArray(path)) return;
    setBackupBusy(true);
    try {
      const binary = await readFile(path);
      let raw = ''; binary.forEach(byte => { raw += String.fromCharCode(byte); });
      const result = await apiFetch<{ restored: number; failures: any[] }>(`/api/backup/${encodeURIComponent(context)}/${encodeURIComponent(namespace)}/restore`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ archive: btoa(raw) }) });
      if (result.failures?.length) feedback.notice('Namespace restore completed with issues', `${result.restored} restored; ${result.failures.length} could not be applied.`, 'warning');
      else feedback.notice('Namespace restored', `${result.restored} resource${result.restored === 1 ? '' : 's'} applied.`, 'success');
      loadResourceDetail();
    } catch (error: any) { feedback.notice('Could not restore namespace backup', error?.message || String(error), 'error'); }
    finally { setBackupBusy(false); }
  };

  const handleOpenViewWindow = (view: string) => {
    if (!context) return;
    openSectionWindow('view', { context, view });
  };

  const openSidebarContextMenu = (event: React.MouseEvent, view?: string) => {
    event.preventDefault();
    event.stopPropagation();
    setSidebarContextMenu({ x: event.clientX, y: event.clientY, view, contextMenu: !view });
  };

  const openCommandPalette = () => {
    setCommandQuery('');
    setSelectedCommandIndex(0);
    setIsCommandPaletteOpen(true);
  };

  const handleOpenShell = async (namespace: string, pod: string, container?: string) => {
    if (!container) {
      try {
        const detail = await apiFetch<ResourceDetail>(`/api/resources/${encodeURIComponent(context || '')}/pods/${encodeURIComponent(namespace)}/${encodeURIComponent(pod)}`);
        const containers = (detail.spec?.containers || []).map((item: any) => item.name);
        if (containers.length > 1) { setShellContainerPicker({ namespace, pod, containers }); return; }
        container = containers[0];
      } catch (error: any) { feedback.notice('Could not load Pod containers', error?.message || String(error), 'error'); return; }
    }
    if (!container) return;
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
      openSectionWindow('yaml', { context, namespace: panel.namespace, name: panel.name, resourceType: panel.resourceType || 'pods' });
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
    // Tauri reads this from tauri.conf.json during the build, so a release only
    // needs its normal package version bump.
    getVersion().then(setAppVersion).catch(() => setAppVersion(import.meta.env.VITE_APP_VERSION || null));
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
  }, [activeView, context, selectedResource, selectedNamespaces]);

  useEffect(() => {
      if (selectedResource) {
          setDetailTab('overview');
          loadResourceDetail();
      }
  }, [selectedResource]);

  useEffect(() => {
    if (!initialResource) return;
    setActiveView(initialResource.type);
    setSelectedResource(initialResource);
  }, [initialResource?.type, initialResource?.name, initialResource?.namespace]);

  useEffect(() => {
    if (!initialView) return;
    setActiveView(initialView);
    setSelectedResource(null);
  }, [initialView]);

  useEffect(() => {
    const closeMenu = () => { setResourceContextMenu(null); setSidebarContextMenu(null); };
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'p') {
        event.preventDefault();
        openCommandPalette();
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

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

  const visibleResources = useMemo(() => {
    return sortedAndFilteredResources.slice(0, visibleCount);
  }, [sortedAndFilteredResources, visibleCount]);

  useEffect(() => {
    setVisibleCount(100);
    setNextPageToken(null);
  }, [activeView, selectedNamespaces, context]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollHeight - target.scrollTop <= target.clientHeight + 100) {
      if (nextPageToken && !isLoadingMore) {
        void loadData(true);
      } else if (visibleCount < sortedAndFilteredResources.length) {
        setVisibleCount(prev => prev + 100);
      }
    }
  };

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
          sortableHeader('restart_count', 'Restarts'),
          <TableHeaderCell key="actions" style={{ width: '40px' }}></TableHeaderCell>
        ];
      case 'replicasets':
      case 'other_replicasets':
        return [
          ...common,
          sortableHeader('replicas', 'Replicas'),
          sortableHeader('ready_replicas', 'Ready'),
          <TableHeaderCell key="actions" style={{ width: '40px' }}></TableHeaderCell>
        ];
      case 'jobs':
      case 'other_jobs':
        return [
          ...common,
          sortableHeader('completions', 'Completions'),
          sortableHeader('active', 'Active'),
          sortableHeader('succeeded', 'Succeeded'),
          sortableHeader('failed', 'Failed'),
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
      case 'services':
      case 'other_services':
        return [
          ...common,
          sortableHeader('type', 'Type'),
          sortableHeader('cluster_ip', 'Cluster IP'),
          <TableHeaderCell key="ports">Ports</TableHeaderCell>,
          <TableHeaderCell key="actions" style={{ width: '40px' }}></TableHeaderCell>
        ];
      case 'ingresses':
      case 'other_ingresses':
        return [
          ...common,
          <TableHeaderCell key="hosts">Hosts</TableHeaderCell>,
          <TableHeaderCell key="actions" style={{ width: '40px' }}></TableHeaderCell>
        ];
      case 'secrets':
        return [
          ...common,
          sortableHeader('type', 'Type'),
          <TableHeaderCell key="summary">Summary</TableHeaderCell>,
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
    
    try {
        if (m.containers && Array.isArray(m.containers)) {
            m.containers.forEach((c: any) => {
                if (c && c.usage) {
                    const c_cpu = c.usage.cpu;
                    if (c_cpu && typeof c_cpu === 'string') {
                        if (c_cpu.endsWith('n')) cpu += parseInt(c_cpu) / 1000000;
                        else if (c_cpu.endsWith('u')) cpu += parseInt(c_cpu) / 1000;
                        else cpu += parseInt(c_cpu) * 1000;
                    }

                    const c_mem = c.usage.memory;
                    if (c_mem && typeof c_mem === 'string') {
                        if (c_mem.endsWith('Ki')) mem += parseInt(c_mem) * 1024;
                        else if (c_mem.endsWith('Mi')) mem += parseInt(c_mem) * 1024 * 1024;
                        else if (c_mem.endsWith('Gi')) mem += parseInt(c_mem) * 1024 * 1024 * 1024;
                        else mem += parseInt(c_mem);
                    }
                }
            });
        } else if (m.usage) {
            const n_cpu = m.usage.cpu;
            if (n_cpu && typeof n_cpu === 'string') {
                if (n_cpu.endsWith('n')) cpu = parseInt(n_cpu) / 1000000;
                else if (n_cpu.endsWith('u')) cpu = parseInt(n_cpu) / 1000;
                else cpu = parseInt(n_cpu) * 1000;
            }

            const n_mem = m.usage.memory;
            if (n_mem && typeof n_mem === 'string') {
                if (n_mem.endsWith('Ki')) mem = parseInt(n_mem) * 1024;
                else if (n_mem.endsWith('Mi')) mem = parseInt(n_mem) * 1024 * 1024;
                else if (n_mem.endsWith('Gi')) mem = parseInt(n_mem) * 1024 * 1024 * 1024;
                else mem = parseInt(n_mem);
            }
        }
    } catch (e) {
        console.error("Error parsing metrics", e);
    }

    return {
        cpu: `${cpu.toFixed(1)}m`,
        mem: `${(mem / (1024 * 1024)).toFixed(1)} MiB`
    };
  };

  const renderResourceActions = (r: ResourceItem) => (
    <>
      <MenuItem icon={<Document20Regular />} onClick={() => handleOpenResourceWindow(r)}>Open in New Window</MenuItem>
      {(activeView === 'pods' || r.type === 'pods') && (
        <>
          <MenuItem icon={<TextBulletList20Regular />} onClick={() => handleOpenLogs(r.namespace!, r.name)}>View Logs</MenuItem>
          <MenuItem icon={<WindowConsole20Regular />} onClick={() => handleOpenShell(r.namespace!, r.name)}>Execute Shell</MenuItem>
        </>
      )}
      {(activeView === 'deployments' || activeView === 'other_deployments') && <MenuItem icon={<ArrowClockwise20Regular />} onClick={() => handleRedeploy(r.namespace, r.name)}>Rollout Restart</MenuItem>}
      {activeView === 'cronjobs' && <MenuItem icon={<ArrowClockwise20Regular />} onClick={() => handleRunCronJob(r.namespace, r.name)}>Run now</MenuItem>}
      {(activeView === 'services' || activeView === 'other_services' || r.cluster_ip !== undefined) && (
        (() => activePortForwards.some(f => f.namespace === r.namespace && f.service_name === r.name)
          ? <MenuItem icon={<Link20Regular />} onClick={() => handleStopPortForward(r.namespace, r.name)}>Stop Port Forward</MenuItem>
          : <MenuItem icon={<Link20Regular />} onClick={() => handleStartPortForward(r.namespace, r.name, r.ports?.[0])}>Start Port Forward</MenuItem>)()
      )}
      <MenuItem icon={<Document20Regular />} onClick={() => {
        const crd = activeView.startsWith('custom_') ? crds.find(item => item.plural === activeView.replace('custom_', '')) : undefined;
        handleOpenYaml(r.namespace || 'none', r.name, crd ? `custom_${crd.group}_${crd.version}_${crd.plural}` : resourceTypeForAction(activeView));
      }}>Edit YAML</MenuItem>
      <MenuItem icon={<Document20Regular />} onClick={() => handleSaveResourceYaml(r)}>Save YAML…</MenuItem>
      <MenuItem icon={<Delete20Regular />} style={{ color: 'var(--colorPaletteRedForeground1)' }} onClick={() => handleDeleteResource(r.namespace, r.name, activeView)}>Delete</MenuItem>
    </>
  );

  const openResourceContextMenu = (event: React.MouseEvent, resource: ResourceItem) => {
    event.preventDefault();
    event.stopPropagation();
    setResourceContextMenu({ resource, x: event.clientX, y: event.clientY });
  };

  const renderResourceRow = (r: ResourceItem) => {
    const commonCells = [
      <TableCell key="name" title={r.name}><span className={`${styles.clickableName} ${styles.truncatedName}`} onClick={() => setSelectedResource({ type: activeView, name: r.name, namespace: r.namespace })} onContextMenu={event => openResourceContextMenu(event, r)}>{r.name}</span></TableCell>,
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
                        {renderResourceActions(r)}
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
                <TableRow key={r.name} onContextMenu={event => openResourceContextMenu(event, r)}>
                    <TableCell title={r.name}><span className={`${styles.clickableName} ${styles.truncatedName}`} onClick={() => setSelectedResource({ type: 'nodes', name: r.name })} onContextMenu={event => openResourceContextMenu(event, r)}>{r.name}</span></TableCell>
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
                <TableRow key={`${r.namespace}-${r.name}`} onContextMenu={event => openResourceContextMenu(event, r)}>
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
            return (
                <TableRow key={`${r.namespace}-${r.name}`} onContextMenu={event => openResourceContextMenu(event, r)}>
                    {commonCells}
                    <TableCell>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Button size="small" appearance="subtle" aria-label={`Scale down ${r.name}`} onClick={() => handleScaleDeployment(r, Math.max(0, (r.replicas ?? 0) - 1))}>−</Button>
                        <strong style={{ minWidth: '22px', textAlign: 'center' }}>{r.replicas ?? 0}</strong>
                        <Button size="small" appearance="subtle" aria-label={`Scale up ${r.name}`} onClick={() => handleScaleDeployment(r, (r.replicas ?? 0) + 1)}>+</Button>
                      </div>
                    </TableCell>
                    <TableCell><Badge color={(r.ready_replicas ?? 0) === (r.replicas ?? 0) ? 'success' : 'warning'}>{r.ready_replicas ?? 0}</Badge></TableCell>
                    <TableCell><Badge appearance="tint" color={(r.restart_count ?? 0) > 0 ? 'warning' : 'success'}>{r.restart_count ?? 0}</Badge></TableCell>
                    {actions}
                </TableRow>
            );
        case 'statefulsets':
            return (
                <TableRow key={`${r.namespace}-${r.name}`} onContextMenu={event => openResourceContextMenu(event, r)}>
                    {commonCells}
                    <TableCell>{r.replicas ?? 0}</TableCell>
                    <TableCell><Badge color={(r.ready_replicas ?? 0) === (r.replicas ?? 0) ? 'success' : 'warning'}>{r.ready_replicas ?? 0}</Badge></TableCell>
                    <TableCell><Badge appearance="tint" color={(r.restart_count ?? 0) > 0 ? 'warning' : 'success'}>{r.restart_count ?? 0}</Badge></TableCell>
                    {actions}
                </TableRow>
            );
        case 'replicasets':
        case 'other_replicasets':
            return (
                <TableRow key={`${r.namespace}-${r.name}`} onContextMenu={event => openResourceContextMenu(event, r)}>
                    {commonCells}
                    <TableCell>{r.replicas ?? 0}</TableCell>
                    <TableCell><Badge color={(r.ready_replicas ?? 0) === (r.replicas ?? 0) ? 'success' : 'warning'}>{r.ready_replicas ?? 0}</Badge></TableCell>
                    {actions}
                </TableRow>
            );
        case 'jobs':
        case 'other_jobs':
            return (
                <TableRow key={`${r.namespace}-${r.name}`} onContextMenu={event => openResourceContextMenu(event, r)}>
                    {commonCells}
                    <TableCell>{r.completions ?? 0}</TableCell>
                    <TableCell>{r.active ?? 0}</TableCell>
                    <TableCell><Badge color="success">{r.succeeded ?? 0}</Badge></TableCell>
                    <TableCell><Badge color={(r.failed ?? 0) > 0 ? 'important' : 'subtle'}>{r.failed ?? 0}</Badge></TableCell>
                    {actions}
                </TableRow>
            );
        case 'daemonsets':
             return (
                <TableRow key={`${r.namespace}-${r.name}`} onContextMenu={event => openResourceContextMenu(event, r)}>
                    {commonCells}
                    <TableCell>{r.desired}</TableCell>
                    <TableCell><Badge color={r.ready === r.desired ? 'success' : 'warning'}>{r.ready}</Badge></TableCell>
                    {actions}
                </TableRow>
            );
        case 'cronjobs':
            return (
                <TableRow key={`${r.namespace}-${r.name}`} onContextMenu={event => openResourceContextMenu(event, r)}>
                    {commonCells}
                    <TableCell><code>{r.schedule}</code></TableCell>
                    <TableCell><Badge appearance="outline">{r.active}</Badge></TableCell>
                    <TableCell><span style={{ fontSize: '0.8rem', opacity: 0.8 }}>{r.last_schedule ? new Date(r.last_schedule).toLocaleString() : 'Never'}</span></TableCell>
                    {actions}
                </TableRow>
            );
        case 'services':
        case 'other_services':
            {
                const forward = activePortForwards.find(f => f.namespace === r.namespace && f.service_name === r.name);
                return (
                    <TableRow key={`${r.namespace}-${r.name}`} onContextMenu={event => openResourceContextMenu(event, r)}>
                        <TableCell>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <span title={r.name} className={`${styles.clickableName} ${styles.truncatedName}`} onClick={() => setSelectedResource({ type: 'services', name: r.name, namespace: r.namespace })} onContextMenu={event => openResourceContextMenu(event, r)}>{r.name}</span>
                                {forward && (
                                    <span style={{ fontSize: '0.75rem', color: 'var(--colorPaletteGreenForeground1)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Link20Regular style={{ width: '12px', height: '12px' }} />
                                        Port Forward: 127.0.0.1:{forward.local_port} &rarr; {forward.service_port}
                                    </span>
                                )}
                            </div>
                        </TableCell>
                        <TableCell><Badge appearance="tint" color="brand">{r.namespace || 'Cluster'}</Badge></TableCell>
                        <TableCell>{r.type}</TableCell>
                        <TableCell><code>{r.cluster_ip}</code></TableCell>
                        <TableCell>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px' }}>
                                {r.ports?.map((p: string, idx: number) => (
                                    <Badge key={idx} appearance="outline">{p}</Badge>
                                ))}
                            </div>
                        </TableCell>
                        {actions}
                    </TableRow>
                );
            }
        case 'ingresses':
        case 'other_ingresses':
            return (
                <TableRow key={`${r.namespace}-${r.name}`} onContextMenu={event => openResourceContextMenu(event, r)}>
                    {commonCells}
                    <TableCell>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px' }}>
                            {r.hosts && r.hosts.length > 0 ? (
                                r.hosts.map((h: string, idx: number) => (
                                    <Badge key={idx} appearance="outline">{h || '*'}</Badge>
                                ))
                            ) : (
                                <span style={{ opacity: 0.5 }}>*</span>
                            )}
                        </div>
                    </TableCell>
                    {actions}
                </TableRow>
            );
        case 'secrets':
            return (
                <TableRow key={`${r.namespace}-${r.name}`} onContextMenu={event => openResourceContextMenu(event, r)}>
                    {commonCells}
                    <TableCell><Badge appearance="tint">{r.type || 'Opaque'}</Badge></TableCell>
                    <TableCell title={r.tls_info?.subject || r.summary || ''}><div className={styles.truncatedName}>{r.tls_info ? <><strong>{r.tls_info.subject || 'TLS certificate'}</strong><div style={{ fontSize: '0.75rem', opacity: 0.68 }}>expires {r.tls_info.not_after || '—'}</div></> : r.summary || '—'}</div></TableCell>
                    {actions}
                </TableRow>
            );
        default:
            return (
                <TableRow key={r.id || `${r.namespace || 'cls'}-${r.name}`} onContextMenu={event => openResourceContextMenu(event, r)}>
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
  const commandItems = [
    { group: 'Navigation', label: 'Cluster Overview', detail: 'Go to cluster overview', icon: <Apps20Regular />, run: () => { setActiveView('overview'); setSelectedResource(null); } },
    { group: 'Navigation', label: 'Nodes', detail: 'Browse cluster nodes', icon: <Cube20Regular />, run: () => { setActiveView('nodes'); setSelectedResource(null); } },
    { group: 'Navigation', label: 'Namespaces', detail: 'Browse namespaces', icon: <Link20Regular />, run: () => { setActiveView('namespaces'); setSelectedResource(null); } },
    { group: 'Navigation', label: 'Pods', detail: 'Browse pods', icon: <Box20Regular />, run: () => { setActiveView('pods'); setSelectedResource(null); } },
    { group: 'Navigation', label: 'Deployments', detail: 'Browse deployments', icon: <Layer20Regular />, run: () => { setActiveView('deployments'); setSelectedResource(null); } },
    { group: 'Navigation', label: 'StatefulSets', detail: 'Browse stateful workloads', icon: <Layer20Regular />, run: () => { setActiveView('statefulsets'); setSelectedResource(null); } },
    { group: 'Navigation', label: 'DaemonSets', detail: 'Browse node-level workloads', icon: <Layer20Regular />, run: () => { setActiveView('daemonsets'); setSelectedResource(null); } },
    { group: 'Navigation', label: 'CronJobs', detail: 'Browse scheduled workloads', icon: <ArrowClockwise20Regular />, run: () => { setActiveView('cronjobs'); setSelectedResource(null); } },
    { group: 'Navigation', label: 'ConfigMaps', detail: 'Browse ConfigMaps', icon: <Database20Regular />, run: () => { setActiveView('configmaps'); setSelectedResource(null); } },
    { group: 'Navigation', label: 'Secrets', detail: 'Browse secrets', icon: <ShieldLock20Regular />, run: () => { setActiveView('secrets'); setSelectedResource(null); } },
    { group: 'Navigation', label: 'Persistent Volumes & Claims', detail: 'Inspect storage and PVC health', icon: <Storage20Regular />, run: () => { setActiveView('persistentvolumes'); setSelectedResource(null); } },
    { group: 'Navigation', label: 'RBAC Inspector', detail: 'Review effective access and bindings', icon: <ShieldLock20Regular />, run: () => { setActiveView('rbac'); setSelectedResource(null); } },
    { group: 'Navigation', label: 'Network Tools', detail: 'Inspect network resources and run diagnostics', icon: <Link20Regular />, run: () => { setActiveView('network'); setSelectedResource(null); } },
    { group: 'Navigation', label: 'Helm Releases', detail: 'Browse release history and revisions', icon: <Box20Regular />, run: () => { setActiveView('helm'); setSelectedResource(null); } },
    ...NATIVE_OTHERS.map(other => ({
      group: 'Navigation',
      label: other.label,
      detail: `Browse ${other.label.toLowerCase()}`,
      icon: <Grid20Regular />,
      run: () => { setActiveView(`other_${other.plural}`); setSelectedResource(null); },
    })),
    ...crds.map(crd => ({
      group: 'Custom Resources',
      label: crd.kind,
      detail: `Browse ${crd.plural} custom resources`,
      icon: <Database20Regular />,
      run: () => { setActiveView(`custom_${crd.plural}`); setSelectedResource(null); },
    })),
    { group: 'Actions', label: 'Refresh current view', detail: 'Reload cluster resources', icon: <ArrowClockwise20Regular />, run: loadData },
    { group: 'Actions', label: 'Apply YAML manifest', detail: 'Create or update a resource from YAML', icon: <Document20Regular />, run: () => {
      if (!context) return;
      setCreateKind('Resource');
      setCreateBuilderTab('YAML');
      setYamlToApply('');
      setIsApplyYamlOpen(true);
    } },
    ...(['deployments', 'statefulsets', 'daemonsets', 'cronjobs', 'configmaps', 'secrets', 'persistentvolumeclaims'].includes(activeView)
      ? [{
          group: 'Actions',
          label: `Create ${CREATE_KIND_BY_VIEW[activeView]}`,
          detail: `Create a new ${CREATE_KIND_BY_VIEW[activeView]} in this view`,
          icon: <Add20Regular />,
          run: () => {
            if (!context) return;
            const kind = CREATE_KIND_BY_VIEW[activeView];
            setCreateKind(kind);
            setCreateBuilderTab(kind === 'ConfigMap' || kind === 'Secret' ? 'Data' : 'General');
            setIsApplyYamlOpen(true);
          },
        }]
      : []),
    { group: 'Actions', label: 'Port Forward Manager', detail: 'View and manage active port forwards', icon: <Link20Regular />, run: () => context && setIsPortForwardManagerOpen(true) },
    { group: 'Actions', label: 'Run command on nodes', detail: 'Open the node command runner in a separate window', icon: <WindowConsole20Regular />, run: () => context && openSectionWindow('node-command', { context }) },
    { group: 'Actions', label: 'Manage contexts & kubeconfigs', detail: 'View, edit, favorite, or remove contexts', icon: <Cube20Regular />, run: () => setIsContextManagerOpen(true) },
    { group: 'Actions', label: 'Import kubeconfig', detail: 'Add a kubeconfig file or pasted YAML', icon: <Add20Regular />, run: () => setIsImportOpen(true) },
    { group: 'Actions', label: 'Open Settings', detail: 'Configure the application', icon: <Settings20Regular />, run: () => setIsSettingsOpen(true) },
    ...contexts.map(clusterContext => ({
      group: 'Contexts',
      label: clusterContext,
      detail: clusterContext === context ? 'Current Kubernetes context' : 'Switch Kubernetes context',
      icon: <PresenceBadge status={clusterContext === context ? 'available' : 'unknown'} size="extra-small" />,
      run: () => { setActiveContext(clusterContext); setActiveView('overview'); setSelectedResource(null); },
    })),
    ...resources.map(resource => ({
      group: 'Resources',
      label: resource.name,
      detail: `${activeView}${resource.namespace ? ` · ${resource.namespace}` : ''}`,
      icon: <Document20Regular />,
      run: () => setSelectedResource({ type: activeView, name: resource.name, namespace: resource.namespace }),
    })),
  ];
  const normalizedCommandQuery = commandQuery.trim().toLowerCase();
  const commandResults = commandItems.filter(item => !normalizedCommandQuery || `${item.label} ${item.detail} ${item.group}`.toLowerCase().includes(normalizedCommandQuery)).slice(0, 40);

  return (
    <div className={styles.container}>
      {feedback.dialog}
      {shellContainerPicker && <Dialog open onOpenChange={(_, data) => !data.open && setShellContainerPicker(null)}><DialogSurface style={{ width: 'min(460px, calc(100vw - 32px))' }}><DialogBody><DialogTitle>Choose a container</DialogTitle><DialogContent><div style={{ display: 'grid', gap: '8px' }}><span style={{ fontSize: '0.82rem', opacity: 0.68 }}>{shellContainerPicker.pod} has multiple containers.</span>{shellContainerPicker.containers.map(container => <Button key={container} appearance="secondary" style={{ justifyContent: 'flex-start' }} onClick={() => { const target = shellContainerPicker; setShellContainerPicker(null); handleOpenShell(target.namespace, target.pod, container); }}>{container}</Button>)}</div></DialogContent><DialogActions><Button appearance="subtle" onClick={() => setShellContainerPicker(null)}>Cancel</Button></DialogActions></DialogBody></DialogSurface></Dialog>}
      {backupNamespace && <Dialog open onOpenChange={(_, data) => !data.open && setBackupNamespace(null)}><DialogSurface style={{ width: 'min(760px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 32px)' }}><DialogBody><DialogTitle>Backup namespace · {backupNamespace}</DialogTitle><DialogContent><div style={{ display: 'grid', gap: '14px' }}><div style={{ fontSize: '0.82rem', opacity: 0.7 }}>Select whole kinds or individual resources. The ZIP contains cleaned desired-state manifests; runtime status and server-generated metadata are excluded.</div><div style={{ maxHeight: '52vh', overflowY: 'auto', display: 'grid', gap: '10px', paddingRight: '4px' }}>{backupKinds.map(group => { const selected = backupSelection[group.kind] || []; const all = selected.length === group.resources.length; return <Card key={group.kind} style={{ backgroundColor: 'var(--colorNeutralBackground2)' }}><div style={{ padding: '12px 14px' }}><Checkbox checked={all} onChange={(_, data) => setBackupSelection(current => ({ ...current, [group.kind]: data.checked ? [...group.resources] : [] }))} label={`${group.kind} (${group.resources.length})`} /><div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px', paddingLeft: '26px' }}>{group.resources.map(name => <Checkbox key={name} checked={selected.includes(name)} onChange={(_, data) => setBackupSelection(current => ({ ...current, [group.kind]: data.checked ? [...(current[group.kind] || []), name] : (current[group.kind] || []).filter(item => item !== name) }))} label={name} />)}</div></div></Card>; })}{!backupBusy && !backupKinds.length && <span style={{ opacity: 0.65 }}>This namespace has no portable resources to archive.</span>}</div></div></DialogContent><DialogActions><Button appearance="subtle" onClick={() => setBackupNamespace(null)}>Cancel</Button><Button appearance="primary" onClick={downloadNamespaceBackup} disabled={backupBusy}>{backupBusy ? 'Preparing…' : 'Download ZIP'}</Button></DialogActions></DialogBody></DialogSurface></Dialog>}
      {pendingDelete && <Dialog open onOpenChange={(_, data) => !data.open && setPendingDelete(null)}><DialogSurface style={{ width: 'min(560px, calc(100vw - 32px))' }}><DialogBody><DialogTitle>Delete {pendingDelete.type}</DialogTitle><DialogContent><div style={{ display: 'grid', gap: '14px' }}><div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(255, 153, 0, 0.1)', border: '1px solid rgba(255, 153, 0, 0.25)', fontSize: '0.84rem' }}><strong>Review impact</strong><div style={{ marginTop: '5px' }}>You are deleting <code>{pendingDelete.namespace ? `${pendingDelete.namespace}/` : ''}{pendingDelete.name}</code>. {['namespaces', 'nodes'].includes(pendingDelete.type) ? 'This can affect many workloads and is especially high risk.' : pendingDelete.type === 'persistentvolumeclaims' || pendingDelete.type === 'pvcs' ? 'This may make workload data unavailable; the underlying volume behavior depends on its reclaim policy.' : pendingDelete.type === 'services' || pendingDelete.type === 'other_services' ? 'This immediately removes the service endpoint used by clients.' : 'Dependent workloads may be affected.'}</div></div><div style={{ fontSize: '0.82rem', opacity: 0.72 }}>Run a server-side dry-run first to validate authorization and admission policies without removing anything.</div><Button appearance="secondary" onClick={runDeleteDryRun} disabled={isCheckingDelete}>{isCheckingDelete ? 'Running dry-run…' : 'Run dry-run'}</Button>{deleteDryRunResult && <div style={{ padding: '10px', borderRadius: '7px', background: deleteDryRunResult.startsWith('Server-side') ? 'rgba(44,197,126,0.1)' : 'rgba(255,77,99,0.1)', fontSize: '0.8rem' }}>{deleteDryRunResult}</div>}<div style={{ display: 'grid', gap: '6px' }}><Label>Type <code>{pendingDelete.name}</code> to enable deletion</Label><Input autoFocus value={deleteConfirmationText} onChange={(_, data) => setDeleteConfirmationText(data.value)} placeholder={pendingDelete.name} /></div></div></DialogContent><DialogActions><Button appearance="subtle" onClick={() => setPendingDelete(null)}>Cancel</Button><Button appearance="secondary" icon={<Delete20Regular />} disabled={deleteConfirmationText !== pendingDelete.name} onClick={() => executeDeleteResource(false)}>Delete permanently</Button></DialogActions></DialogBody></DialogSurface></Dialog>}
      <Dialog open={isPortForwardManagerOpen} onOpenChange={(_, data) => { setIsPortForwardManagerOpen(data.open); if (data.open) loadActivePortForwards(); }}>
        <DialogSurface style={{ width: 'min(980px, calc(100vw - 32px))', maxWidth: '980px' }}>
          <DialogBody>
            <DialogTitle>Port Forward Manager</DialogTitle>
            <DialogContent>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <span style={{ fontSize: '0.82rem', opacity: 0.68 }}>Active sessions for {context}</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Button size="small" icon={<ArrowClockwise20Regular />} onClick={loadActivePortForwards}>Refresh</Button>
                  <Button size="small" appearance="secondary" icon={<Dismiss16Regular />} onClick={handleStopAllPortForwards} disabled={!activePortForwards.length}>Stop all</Button>
                </div>
              </div>
              {activePortForwards.length ? (
                <div style={{ overflowX: 'auto' }}><Table size="small" style={{ minWidth: '760px' }}>
                  <TableHeader><TableRow><TableHeaderCell>Service</TableHeaderCell><TableHeaderCell>URL</TableHeaderCell><TableHeaderCell>Status</TableHeaderCell><TableHeaderCell /></TableRow></TableHeader>
                  <TableBody>
                    {activePortForwards.map(session => (
                      <TableRow key={`${session.namespace}-${session.service_name}`}>
                        <TableCell><strong>{session.service_name}</strong><div style={{ fontSize: '0.75rem', opacity: 0.65 }}>{session.namespace} · :{session.service_port}</div></TableCell>
                        <TableCell><Button appearance="transparent" size="small" style={{ padding: 0, minWidth: 0, fontFamily: 'var(--fontFamilyMonospace)' }} onClick={() => handleOpenPortForwardUrl(session)}>http://127.0.0.1:{session.local_port}</Button></TableCell>
                        <TableCell><Badge color="success" appearance="tint">{session.status || 'active'}</Badge></TableCell>
                        <TableCell>
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            <Button size="small" appearance="subtle" onClick={() => handleCopyPortForwardUrl(session)}>Copy URL</Button>
                            <Button size="small" appearance="subtle" icon={<ArrowClockwise20Regular />} onClick={() => handleReconnectPortForward(session)}>Reconnect</Button>
                            <Button size="small" appearance="subtle" onClick={() => handleStopPortForward(session.namespace, session.service_name)}>Stop</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table></div>
              ) : <div style={{ textAlign: 'center', padding: '36px 0', opacity: 0.65 }}>No active port forwards in this context.</div>}
            </DialogContent>
            <DialogActions><Button appearance="primary" onClick={() => setIsPortForwardManagerOpen(false)}>Close</Button></DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
      <Dialog open={isCommandPaletteOpen} onOpenChange={(_, data) => setIsCommandPaletteOpen(data.open)}>
        <DialogSurface style={{ width: 'min(640px, calc(100vw - 32px))', padding: 0, overflow: 'hidden' }}>
          <DialogBody style={{ padding: 0 }}>
            <DialogContent style={{ padding: 0 }}>
              <Input
                autoFocus
                value={commandQuery}
                onChange={(_, data) => { setCommandQuery(data.value); setSelectedCommandIndex(0); }}
                onKeyDown={event => {
                  if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    setSelectedCommandIndex(index => Math.min(index + 1, commandResults.length - 1));
                  } else if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    setSelectedCommandIndex(index => Math.max(index - 1, 0));
                  } else if (event.key === 'Enter' && commandResults[selectedCommandIndex]) {
                    event.preventDefault();
                    commandResults[selectedCommandIndex].run();
                    setIsCommandPaletteOpen(false);
                  }
                }}
                contentBefore={<Search20Regular />}
                placeholder="Search resources, actions, and navigation…"
                style={{ width: '100%', padding: '14px 16px', border: 'none', borderBottom: '1px solid var(--colorNeutralStroke1)', borderRadius: 0 }}
              />
              <div style={{ maxHeight: '420px', overflowY: 'auto', padding: '8px' }}>
                {commandResults.length ? commandResults.map((item, index) => (
                  <Button
                    key={`${item.group}-${item.label}-${index}`}
                    appearance="subtle"
                    onMouseEnter={() => setSelectedCommandIndex(index)}
                    onClick={() => { item.run(); setIsCommandPaletteOpen(false); }}
                    style={{ width: '100%', minHeight: '52px', justifyContent: 'flex-start', textAlign: 'left', display: 'flex', gap: '12px', padding: '10px 12px', backgroundColor: index === selectedCommandIndex ? 'var(--colorNeutralBackground3)' : undefined }}
                  >
                    {item.icon}
                    <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                      <span>{item.label}</span>
                      <span style={{ fontSize: '0.75rem', opacity: 0.62 }}>{item.group} · {item.detail}</span>
                    </span>
                  </Button>
                )) : (
                  <div style={{ padding: '28px', textAlign: 'center', opacity: 0.65 }}>No matching commands or resources.</div>
                )}
              </div>
              <div style={{ borderTop: '1px solid var(--colorNeutralStroke1)', padding: '9px 14px', fontSize: '0.75rem', opacity: 0.62 }}>
                ↑↓ to navigate · Enter to run · Esc to close
              </div>
            </DialogContent>
          </DialogBody>
        </DialogSurface>
      </Dialog>
      {resourceContextMenu && (
        <div
          role="menu"
          style={{ position: 'fixed', top: resourceContextMenu.y, left: resourceContextMenu.x, zIndex: 2000, minWidth: '210px', background: 'var(--colorNeutralBackground2)', border: '1px solid var(--colorNeutralStroke1)', borderRadius: '10px', boxShadow: '0 16px 42px rgba(0,0,0,0.42)', padding: '4px' }}
          onClick={event => event.stopPropagation()}
        >
          <MenuList>{renderResourceActions(resourceContextMenu.resource)}</MenuList>
        </div>
      )}
      {sidebarContextMenu && (
        <div role="menu" style={{ position: 'fixed', top: sidebarContextMenu.y, left: sidebarContextMenu.x, zIndex: 2000, minWidth: '210px', background: 'var(--colorNeutralBackground2)', border: '1px solid var(--colorNeutralStroke1)', borderRadius: '10px', boxShadow: '0 16px 42px rgba(0,0,0,0.42)', padding: '4px' }} onClick={event => event.stopPropagation()}>
          <MenuList>
            {sidebarContextMenu.view ? (
              <>
                <MenuItem icon={<Document20Regular />} onClick={() => handleOpenViewWindow(sidebarContextMenu.view!)}>Open in New Window</MenuItem>
                <MenuItem icon={<ArrowClockwise20Regular />} onClick={() => { setActiveView(sidebarContextMenu.view!); setSelectedResource(null); }}>Go to View</MenuItem>
              </>
            ) : (
              <>
                <MenuItem icon={<ArrowClockwise20Regular />} onClick={fetchContexts}>Refresh Contexts</MenuItem>
                <MenuItem icon={<Add20Regular />} onClick={() => setIsImportOpen(true)}>Import Kubeconfig</MenuItem>
                <MenuItem icon={<Settings20Regular />} onClick={() => setIsSettingsOpen(true)}>Open Settings</MenuItem>
              </>
            )}
          </MenuList>
        </div>
      )}
      <aside className={styles.sidebar} onContextMenu={event => openSidebarContextMenu(event)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <Menu>
            <MenuTrigger disableButtonEnhancement>
              <div className={styles.contextDropdown} onContextMenu={event => openSidebarContextMenu(event)}>
                <span style={{ fontSize: '0.85rem', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>
                  {context || 'Select Context'}
                </span>
                <MoreHorizontal20Regular />
              </div>
            </MenuTrigger>
            <MenuPopover style={{ maxHeight: 'min(520px, calc(100vh - 120px))', overflow: 'hidden' }}>
              <div style={{ padding: '8px 8px 4px' }}><Input size="small" value={contextFilter} onChange={(_, data) => setContextFilter(data.value)} placeholder="Search contexts…" contentBefore={<Search20Regular />} /></div>
              <MenuList style={{ maxHeight: '390px', overflowY: 'auto' }}>
                {contexts.filter(ctx => ctx.toLowerCase().includes(contextFilter.toLowerCase())).map(ctx => (
                  <MenuItem key={ctx} onClick={() => setActiveContext(ctx)} icon={ctx === context ? <PresenceBadge status="available" size="extra-small" /> : undefined}>
                    {ctx}
                  </MenuItem>
                ))}
                <MenuItem icon={<ArrowClockwise20Regular />} onClick={fetchContexts}>Refresh List</MenuItem>
                <MenuItem icon={<Settings20Regular />} onClick={() => setIsContextManagerOpen(true)}>Manage Contexts</MenuItem>
                <MenuItem icon={<Add20Regular />} onClick={() => setIsImportOpen(true)}>Import Kubeconfig</MenuItem>
              </MenuList>
            </MenuPopover>
          </Menu>
        </div>

        <div className={styles.tabList}>
          <Button 
            appearance="subtle" 
            className={styles.sidebarItem}
            onContextMenu={event => openSidebarContextMenu(event, 'overview')}
            icon={<Apps20Regular />}
            style={activeView === 'overview' ? { backgroundColor: 'var(--colorNeutralBackground3)' } : {}}
            onClick={() => { setActiveView('overview'); setSelectedResource(null); }}
          >
            Cluster Overview
          </Button>
          <Button 
            appearance="subtle" 
            className={styles.sidebarItem}
            onContextMenu={event => openSidebarContextMenu(event, 'nodes')}
            icon={<Cube20Regular />}
            style={activeView === 'nodes' ? { backgroundColor: 'var(--colorNeutralBackground3)' } : {}}
            onClick={() => { setActiveView('nodes'); setSelectedResource(null); }}
          >
            Nodes
          </Button>
          <Button 
            appearance="subtle" 
            className={styles.sidebarItem}
            onContextMenu={event => openSidebarContextMenu(event, 'namespaces')}
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
            onContextMenu={event => openSidebarContextMenu(event, 'pods')}
            icon={<Box20Regular />}
            style={activeView === 'pods' ? { backgroundColor: 'var(--colorNeutralBackground3)' } : {}}
            onClick={() => { setActiveView('pods'); setSelectedResource(null); }}
          >
            Pods
          </Button>
          <Button 
            appearance="subtle" 
            className={styles.sidebarItem}
            onContextMenu={event => openSidebarContextMenu(event, 'deployments')}
            icon={<Layer20Regular />}
            style={activeView === 'deployments' ? { backgroundColor: 'var(--colorNeutralBackground3)' } : {}}
            onClick={() => { setActiveView('deployments'); setSelectedResource(null); }}
          >
            Deployments
          </Button>
          <Button 
            appearance="subtle" 
            className={styles.sidebarItem}
            onContextMenu={event => openSidebarContextMenu(event, 'statefulsets')}
            icon={<Apps20Regular />}
            style={activeView === 'statefulsets' ? { backgroundColor: 'var(--colorNeutralBackground3)' } : {}}
            onClick={() => { setActiveView('statefulsets'); setSelectedResource(null); }}
          >
            StatefulSets
          </Button>
          <Button 
            appearance="subtle" 
            className={styles.sidebarItem}
            onContextMenu={event => openSidebarContextMenu(event, 'daemonsets')}
            icon={<Apps20Regular />}
            style={activeView === 'daemonsets' ? { backgroundColor: 'var(--colorNeutralBackground3)' } : {}}
            onClick={() => { setActiveView('daemonsets'); setSelectedResource(null); }}
          >
            DaemonSets
          </Button>
          <Button 
            appearance="subtle" 
            className={styles.sidebarItem}
            onContextMenu={event => openSidebarContextMenu(event, 'cronjobs')}
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
            onContextMenu={event => openSidebarContextMenu(event, 'configmaps')}
            icon={<Database20Regular />}
            style={activeView === 'configmaps' ? { backgroundColor: 'var(--colorNeutralBackground3)' } : {}}
            onClick={() => { setActiveView('configmaps'); setSelectedResource(null); }}
          >
            ConfigMaps
          </Button>
          <Button 
            appearance="subtle" 
            className={styles.sidebarItem}
            onContextMenu={event => openSidebarContextMenu(event, 'secrets')}
            icon={<ShieldLock20Regular />}
            style={activeView === 'secrets' ? { backgroundColor: 'var(--colorNeutralBackground3)' } : {}}
            onClick={() => { setActiveView('secrets'); setSelectedResource(null); }}
          >
            Secrets
          </Button>
          <Button 
            appearance="subtle" 
            className={styles.sidebarItem}
            onContextMenu={event => openSidebarContextMenu(event, 'persistentvolumes')}
            icon={<Storage20Regular />}
            style={activeView === 'persistentvolumes' ? { backgroundColor: 'var(--colorNeutralBackground3)' } : {}}
            onClick={() => { setActiveView('persistentvolumes'); setSelectedResource(null); }}
          >
            PV / PVC
          </Button>
          <Button appearance="subtle" className={styles.sidebarItem} icon={<ShieldLock20Regular />} style={activeView === 'rbac' ? { backgroundColor: 'var(--colorNeutralBackground3)' } : {}} onClick={() => { setActiveView('rbac'); setSelectedResource(null); }}>
            RBAC Inspector
          </Button>
          <Button appearance="subtle" className={styles.sidebarItem} icon={<Link20Regular />} style={activeView === 'network' ? { backgroundColor: 'var(--colorNeutralBackground3)' } : {}} onClick={() => { setActiveView('network'); setSelectedResource(null); }}>
            Network Tools
          </Button>
          <Button appearance="subtle" className={styles.sidebarItem} icon={<Box20Regular />} style={activeView === 'helm' ? { backgroundColor: 'var(--colorNeutralBackground3)' } : {}} onClick={() => { setActiveView('helm'); setSelectedResource(null); }}>
            Helm Releases
          </Button>

          {pinnedCustomKinds.length > 0 && <div style={{ display: 'grid', gap: '3px', marginTop: '4px' }}>
            <span style={{ padding: '0 10px', fontSize: '0.68rem', letterSpacing: '0.05em', opacity: 0.56 }}>PINNED RESOURCES</span>
            {pinnedCustomKinds.map(plural => {
              const crd = crds.find(item => item.plural === plural);
              return crd ? <Button key={crd.name} appearance="subtle" className={styles.sidebarItem} icon={<Database20Regular />} onContextMenu={event => openSidebarContextMenu(event, `custom_${crd.plural}`)} style={activeView === `custom_${crd.plural}` ? { backgroundColor: 'var(--colorNeutralBackground3)' } : {}} onClick={() => handleSelectCRD(crd)}>{crd.kind}</Button> : null;
            })}
          </div>}

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
                            <div key={crd.name} style={{ display: 'flex', alignItems: 'center' }}>
                              <Button
                                  appearance="subtle"
                                  className={styles.sidebarSubItem}
                                  onContextMenu={event => openSidebarContextMenu(event, `custom_${crd.plural}`)}
                                  onClick={() => handleSelectCRD(crd)}
                                  style={{ flex: 1, ...(activeView === `custom_${crd.plural}` ? { backgroundColor: 'var(--colorNeutralBackground3)', opacity: 1 } : {}) }}
                              >
                                  {crd.kind}
                              </Button>
                              <Button size="small" appearance="subtle" aria-label={`${pinnedCustomKinds.includes(crd.plural) ? 'Unpin' : 'Pin'} ${crd.kind}`} title={pinnedCustomKinds.includes(crd.plural) ? 'Unpin from sidebar' : 'Pin to sidebar'} onClick={() => togglePinnedCustomKind(crd.plural)} style={{ minWidth: '28px', padding: '2px 4px', opacity: pinnedCustomKinds.includes(crd.plural) ? 1 : 0.5 }}>★</Button>
                            </div>
                        ))}
                    </div>
                </AccordionPanel>
             </AccordionItem>
          </Accordion>
        </div>

        <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
          <Dialog open={isContextManagerOpen} onOpenChange={(_, data) => setIsContextManagerOpen(data.open)}>
            <DialogSurface style={{ width: 'min(760px, calc(100vw - 32px))', maxWidth: '760px' }}>
              <DialogBody><DialogTitle>Contexts & kubeconfig</DialogTitle><DialogContent>
                {editingContext ? <div style={{ display: 'grid', gap: '12px' }}><div style={{ fontWeight: 600 }}>{editingContext.name}</div><div style={{ display: 'grid', gap: '5px' }}><Label>API server</Label><Input value={editingContext.server || ''} onChange={(_, data) => setEditingContext({ ...editingContext, server: data.value })} /></div><div style={{ display: 'grid', gap: '5px' }}><Label>Default namespace</Label><Input value={editingContext.namespace || ''} onChange={(_, data) => setEditingContext({ ...editingContext, namespace: data.value })} /></div><div style={{ display: 'flex', gap: '8px' }}><Button appearance="primary" onClick={saveContextDetails}>Save</Button><Button appearance="subtle" onClick={() => setEditingContext(null)}>Back</Button></div></div> : <div style={{ display: 'grid', gap: '8px', maxHeight: '55vh', overflowY: 'auto' }}>
                  {contextDetails.slice().sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name)).map(item => <Card key={item.name} style={{ background: item.name === context ? 'var(--accent-bg)' : 'var(--colorNeutralBackground2)' }}><div style={{ padding: '12px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '12px', alignItems: 'center' }}><div><div style={{ display: 'flex', gap: '7px', alignItems: 'center', fontWeight: 600 }}>{item.name}{item.favorite && <span title="Favorite">★</span>}{item.name === context && <Badge color="success" appearance="tint">Current</Badge>}</div><div style={{ fontSize: '0.78rem', opacity: 0.7, marginTop: '4px', overflowWrap: 'anywhere' }}>{item.cluster || 'Unknown cluster'} · {item.server || 'Server unavailable'} · {item.namespace || 'default'}</div><div style={{ fontSize: '0.74rem', opacity: 0.55, marginTop: '2px' }}>User: {item.user || 'default'}</div></div><div style={{ display: 'flex', gap: '4px' }}><Button size="small" appearance="subtle" onClick={() => toggleFavoriteContext(item)}>{item.favorite ? 'Unfavorite' : 'Favorite'}</Button><Button size="small" appearance="subtle" onClick={() => { setActiveContext(item.name); setActiveView('overview'); setIsContextManagerOpen(false); }}>Use</Button><Button size="small" appearance="subtle" onClick={() => setEditingContext(item)}>Edit</Button><Button size="small" appearance="subtle" style={{ color: 'var(--colorPaletteRedForeground1)' }} onClick={() => removeContext(item)}>Remove</Button></div></div></Card>)}
                  {contextDetails.length === 0 && <span style={{ opacity: 0.65 }}>No contexts found. Import a kubeconfig to add one.</span>}
                  <Button appearance="secondary" icon={<Add20Regular />} onClick={() => { setIsContextManagerOpen(false); setIsImportOpen(true); }}>Add kubeconfig</Button>
                </div>}
              </DialogContent><DialogActions><Button appearance="subtle" onClick={() => setIsContextManagerOpen(false)}>Close</Button></DialogActions></DialogBody>
            </DialogSurface>
          </Dialog>
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
                                        <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', opacity: 0.6 }}>Select any kubeconfig file from your device</div>
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

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Label weight="semibold">Accent color</Label>
                        <span style={{ fontSize: '0.75rem', opacity: 0.62 }}>Personalization</span>
                      </div>
                      <div className={styles.accentOptions} aria-label="Accent color">
                        {ACCENT_OPTIONS.map(option => (
                          <Button
                            key={option.id}
                            className={styles.accentButton}
                            appearance="subtle"
                            aria-label={`Use ${option.label} accent`}
                            title={option.label}
                            onClick={() => setAccent(option.id)}
                            style={{
                              backgroundColor: option.color,
                              border: accent === option.id ? '3px solid #f5f7ff' : '2px solid transparent',
                              boxShadow: accent === option.id ? `0 0 0 2px ${option.color}` : 'none',
                            }}
                          />
                        ))}
                      </div>
                      <span style={{ fontSize: '0.78rem', opacity: 0.68 }}>
                        {ACCENT_OPTIONS.find(option => option.id === accent)?.label} is active. This preference is saved on this device.
                      </span>
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
                        {appVersion ? `Version ${appVersion}` : 'Version unavailable'}
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
                          {selectedResource.type === 'deployments' && resourceDetail && <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
                            <span style={{ fontSize: '0.78rem', opacity: 0.7 }}>Replicas</span>
                            <Button size="small" appearance="subtle" onClick={() => handleScaleDeployment({ name: selectedResource.name, namespace: selectedResource.namespace, replicas: resourceDetail.spec?.replicas ?? 0 }, Math.max(0, (resourceDetail.spec?.replicas ?? 0) - 1))}>−</Button>
                            <strong style={{ minWidth: '18px', textAlign: 'center', fontSize: '0.85rem' }}>{resourceDetail.spec?.replicas ?? 0}</strong>
                            <Button size="small" appearance="subtle" onClick={() => handleScaleDeployment({ name: selectedResource.name, namespace: selectedResource.namespace, replicas: resourceDetail.spec?.replicas ?? 0 }, (resourceDetail.spec?.replicas ?? 0) + 1)}>+</Button>
                            <Button size="small" appearance="secondary" icon={<ArrowClockwise20Regular />} onClick={() => handleRedeploy(selectedResource.namespace, selectedResource.name)}>Rollout restart</Button>
                          </div>}
                      </div>
                  </div>
              )}
            </div>
            <div className={styles.headerControls}>
              {context && selectedResource && <>
                {selectedResource.type === 'namespaces' && <><Button appearance="secondary" size="small" onClick={() => openNamespaceBackup(selectedResource.name)}>Backup</Button><Button appearance="subtle" size="small" onClick={() => restoreNamespaceBackup(selectedResource.name)} disabled={backupBusy}>Restore ZIP</Button></>}
                {CREATE_KIND_BY_VIEW[selectedResource.type] && <Button appearance="secondary" size="small" onClick={openResourceFormEditor}>Edit in form</Button>}
                <Button appearance="subtle" size="small" icon={<Document20Regular />} onClick={() => handleOpenYaml(selectedResource.namespace || 'none', selectedResource.name, resourceTypeForAction(selectedResource.type))}>Edit YAML</Button>
                <Button appearance="subtle" size="small" onClick={() => handleSaveResourceYaml({ name: selectedResource.name, namespace: selectedResource.namespace })}>Save YAML</Button>
                <Button appearance="subtle" size="small" icon={<Delete20Regular />} onClick={() => handleDeleteResource(selectedResource.namespace, selectedResource.name, selectedResource.type)}>Delete</Button>
              </>}
              {context && !selectedResource && ['overview', 'nodes', 'services', 'other_services'].includes(activeView) && (
                <>
                  <Button appearance="subtle" size="small" icon={<Link20Regular />} onClick={() => setIsPortForwardManagerOpen(true)}>
                    Port Forwards{activePortForwards.length ? ` (${activePortForwards.length})` : ''}
                  </Button>
                </>
              )}
              {context && !selectedResource && activeView === 'nodes' && <><Button appearance="secondary" size="small" icon={<WindowConsole20Regular />} onClick={() => openSectionWindow('node-command', { context })}>Run on Nodes</Button><Dialog open={isNodeCommandOpen} onOpenChange={(_, data) => setIsNodeCommandOpen(data.open)}><DialogSurface style={{ width: 'min(820px, calc(100vw - 32px))', maxWidth: '820px' }}><DialogBody><DialogTitle>Run command on all nodes</DialogTitle><DialogContent><div style={{ display: 'grid', gap: '12px' }}><span style={{ fontSize: '0.82rem', opacity: 0.7 }}>Runs an isolated Alpine Pod on every node, collects output, then automatically removes all runner Pods.</span><Textarea value={nodeCommand} onChange={(_, data) => setNodeCommand(data.value)} resize="vertical" style={{ minHeight: '88px', fontFamily: 'var(--fontFamilyMonospace)' }} /><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Label>Timeout</Label><Input type="number" min="5" max="300" value={nodeCommandTimeout} onChange={(_, data) => setNodeCommandTimeout(data.value)} style={{ width: '100px' }} /><span style={{ fontSize: '0.78rem', opacity: 0.65 }}>seconds (5–300)</span></div>{nodeCommandResult.length > 0 && <Table><TableHeader><TableRow><TableHeaderCell>Node</TableHeaderCell><TableHeaderCell>Status</TableHeaderCell><TableHeaderCell>Output</TableHeaderCell></TableRow></TableHeader><TableBody>{nodeCommandResult.map(result => <TableRow key={result.node}><TableCell>{result.node}</TableCell><TableCell><Badge color={result.status === 'Succeeded' ? 'success' : 'important'}>{result.status}</Badge></TableCell><TableCell><code style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{result.output}</code></TableCell></TableRow>)}</TableBody></Table>}</div></DialogContent><DialogActions><Button appearance="subtle" onClick={() => setIsNodeCommandOpen(false)}>Close</Button><Button appearance="primary" onClick={runNodeCommand} disabled={isRunningNodeCommand || !nodeCommand.trim()}>{isRunningNodeCommand ? 'Running…' : 'Run command'}</Button></DialogActions></DialogBody></DialogSurface></Dialog></>}
              {context && !selectedResource && ['deployments', 'statefulsets', 'daemonsets', 'cronjobs', 'configmaps', 'secrets', 'persistentvolumeclaims'].includes(activeView) && (
                <>
                  <Button appearance="primary" size="small" icon={<Add20Regular />} onClick={() => {
                    const kind = CREATE_KIND_BY_VIEW[activeView];
                    if (kind) setCreateKind(kind);
                    setCreateBuilderTab(kind === 'ConfigMap' || kind === 'Secret' ? 'Data' : 'General');
                    setIsApplyYamlOpen(true);
                  }}>
                    Create Resource
                  </Button>
                  <Dialog open={isApplyYamlOpen} onOpenChange={(_, data) => { setIsApplyYamlOpen(data.open); if (!data.open) setFormEditTarget(null); }}>
                    <DialogSurface style={{ width: 'min(960px, calc(100vw - 32px))', maxWidth: '960px', maxHeight: 'calc(100vh - 32px)' }}>
                      <DialogBody>
                        <DialogTitle>{formEditTarget ? `Edit ${createKind}` : `Create ${createKind}`}</DialogTitle>
                        <DialogContent>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', maxHeight: 'calc(100vh - 190px)', paddingRight: '4px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 0.9fr) minmax(220px, 1.2fr) minmax(140px, 0.65fr)', gap: '14px' }}>
                              <div style={{ display: 'grid', gap: '5px' }}><Label>Namespace</Label><Dropdown placeholder="Manifest namespace" value={applyNamespace || undefined} selectedOptions={applyNamespace ? [applyNamespace] : []} onOptionSelect={(_, data) => setApplyNamespace(data.optionValue || '')}>{namespaces.map(ns => <Option key={ns} value={ns}>{ns}</Option>)}</Dropdown></div>
                              <div style={{ display: 'grid', gap: '5px' }}><Label>Name</Label><Input placeholder="my-resource" value={createName} onChange={(_, data) => setCreateName(data.value)} /></div>
                              {['Deployment', 'StatefulSet'].includes(createKind) && <div style={{ display: 'grid', gap: '5px' }}><Label>Replicas</Label><Input type="number" value={createReplicas} onChange={(_, data) => setCreateReplicas(data.value)} /></div>}
                            </div>
                            <div style={{ display: 'grid', gap: '5px' }}><Label>Description <span style={{ opacity: 0.6, fontWeight: 'normal' }}>(optional)</span></Label><Input placeholder="A short description for future operators" value={createDescription} onChange={(_, data) => setCreateDescription(data.value)} /></div>
                            <div style={{ display: 'grid', gridTemplateColumns: '160px minmax(0, 1fr)', minHeight: '310px', borderTop: '1px solid var(--colorNeutralStroke1)', borderBottom: '1px solid var(--colorNeutralStroke1)' }}>
                              <nav style={{ padding: '14px 10px', borderRight: '1px solid var(--colorNeutralStroke1)', display: 'flex', flexDirection: 'column', gap: '4px', background: 'rgba(255,255,255,0.018)' }}>{(['ConfigMap', 'Secret'].includes(createKind) ? ['Data', 'Metadata', 'YAML'] : createKind === 'PersistentVolumeClaim' ? ['Storage', 'Metadata', 'YAML'] : ['General', 'Scheduling', 'Resources', 'Metadata', 'YAML']).map(tab => <Button key={tab} appearance={createBuilderTab === tab ? 'secondary' : 'subtle'} size="small" style={{ justifyContent: 'flex-start' }} onClick={() => setCreateBuilderTab(tab)}>{tab}</Button>)}</nav>
                              <section style={{ padding: '16px', minWidth: 0 }}>
                                {createBuilderTab === 'General' && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}><div style={{ gridColumn: '1 / -1', display: 'grid', gap: '5px' }}><Label>Container image</Label><Input placeholder="nginx:latest" value={createImage} onChange={(_, data) => setCreateImage(data.value)} /></div><div style={{ display: 'grid', gap: '5px' }}><Label>Command</Label><Input placeholder="/bin/sh -c run" value={createCommand} onChange={(_, data) => setCreateCommand(data.value)} /></div><div style={{ display: 'grid', gap: '5px' }}><Label>Environment</Label><Input placeholder="KEY=value, KEY2=value" value={createEnv} onChange={(_, data) => setCreateEnv(data.value)} /></div>{createKind === 'CronJob' && <div style={{ display: 'grid', gap: '5px' }}><Label>Schedule</Label><Input value={createSchedule} onChange={(_, data) => setCreateSchedule(data.value)} /></div>}</div>}
                                {createBuilderTab === 'Data' && (createKind === 'Secret' ? <div style={{ display: 'grid', gap: '14px' }}>
                                  <div style={{ display: 'grid', gap: '5px', maxWidth: '360px' }}><Label>Secret type</Label><Dropdown value={createSecretType} selectedOptions={[createSecretType]} onOptionSelect={(_, data) => setCreateSecretType(data.optionValue || 'Opaque')}>
                                    <Option value="Opaque">Opaque</Option><Option value="kubernetes.io/service-account-token">Service account token</Option><Option value="kubernetes.io/tls">TLS certificate</Option><Option value="kubernetes.io/dockerconfigjson">Docker registry credentials</Option><Option value="kubernetes.io/basic-auth">Basic authentication</Option><Option value="kubernetes.io/ssh-auth">SSH authentication</Option>
                                  </Dropdown></div>
                                  {createSecretType === 'kubernetes.io/service-account-token' ? <div style={{ display: 'grid', gap: '5px', maxWidth: '420px' }}><Label>Service account name</Label><Input placeholder="default" value={createSecretServiceAccount} onChange={(_, data) => setCreateSecretServiceAccount(data.value)} /><span style={{ fontSize: '0.78rem', opacity: 0.65 }}>Kubernetes will populate the token data after this Secret is created.</span></div>
                                    : <div style={{ display: 'grid', gridTemplateColumns: createSecretType === 'kubernetes.io/dockerconfigjson' || createSecretType === 'kubernetes.io/ssh-auth' ? '1fr' : '1fr 1fr', gap: '14px', alignItems: 'start' }}>
                                      {createSecretType === 'Opaque' && <div style={{ display: 'grid', gap: '5px' }}><Label>Key</Label><Input value={createDataKey} onChange={(_, data) => setCreateDataKey(data.value)} /></div>}
                                      <div style={{ display: 'grid', gap: '5px' }}><Label>{createSecretType === 'kubernetes.io/tls' ? 'Certificate (tls.crt)' : createSecretType === 'kubernetes.io/basic-auth' ? 'Username' : createSecretType === 'kubernetes.io/dockerconfigjson' ? 'Docker config JSON' : createSecretType === 'kubernetes.io/ssh-auth' ? 'Private key' : 'Value'}</Label><Textarea value={createDataValue} onChange={(_, data) => setCreateDataValue(data.value)} resize="vertical" style={{ height: '112px', minHeight: '112px', fontFamily: 'var(--fontFamilyMonospace)' }} /></div>
                                      {['kubernetes.io/tls', 'kubernetes.io/basic-auth'].includes(createSecretType) && <div style={{ display: 'grid', gap: '5px' }}><Label>{createSecretType === 'kubernetes.io/tls' ? 'Private key (tls.key)' : 'Password'}</Label><Textarea value={createSecretSecondaryValue} onChange={(_, data) => setCreateSecretSecondaryValue(data.value)} resize="vertical" style={{ height: '112px', minHeight: '112px', fontFamily: 'var(--fontFamilyMonospace)' }} /></div>}
                                    </div>}
                                  <span style={{ fontSize: '0.78rem', opacity: 0.65 }}>Values are applied with <code>stringData</code>; Kubernetes encodes them safely.</span>
                                </div> : <div style={{ display: 'grid', gridTemplateColumns: 'minmax(170px, 0.7fr) minmax(240px, 1.3fr)', gap: '14px', alignItems: 'start' }}><div style={{ display: 'grid', gap: '5px', alignSelf: 'start' }}><Label>Key</Label><Input value={createDataKey} onChange={(_, data) => setCreateDataKey(data.value)} style={{ alignSelf: 'start' }} /></div><div style={{ display: 'grid', gap: '5px', alignSelf: 'start' }}><Label>Value</Label><Textarea value={createDataValue} onChange={(_, data) => setCreateDataValue(data.value)} resize="vertical" style={{ height: '112px', minHeight: '112px', fontFamily: 'var(--fontFamilyMonospace)' }} /></div><span style={{ gridColumn: '1 / -1', fontSize: '0.78rem', opacity: 0.65 }}>Add additional entries in the generated YAML.</span></div>)}
                                {createBuilderTab === 'Storage' && <div style={{ display: 'grid', gap: '5px', maxWidth: '260px' }}><Label>Requested storage</Label><Input value={createStorage} onChange={(_, data) => setCreateStorage(data.value)} /></div>}
                                {createBuilderTab === 'Scheduling' && <div style={{ display: 'grid', gap: '14px' }}><div><Label>Service account</Label><Input placeholder="default" value={createServiceAccount} onChange={(_, data) => setCreateServiceAccount(data.value)} /></div><div><Label>Node selector</Label><Input placeholder="disktype=ssd, topology.kubernetes.io/zone=zone-a" value={createNodeSelector} onChange={(_, data) => setCreateNodeSelector(data.value)} /></div><span style={{ fontSize: '0.78rem', opacity: 0.65 }}>Applies to workload pod templates.</span></div>}
                                {createBuilderTab === 'Resources' && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}><div><Label>CPU request</Label><Input placeholder="100m" value={createCpuRequest} onChange={(_, data) => setCreateCpuRequest(data.value)} /></div><div><Label>Memory request</Label><Input placeholder="128Mi" value={createMemoryRequest} onChange={(_, data) => setCreateMemoryRequest(data.value)} /></div><div><Label>CPU limit</Label><Input placeholder="500m" value={createCpuLimit} onChange={(_, data) => setCreateCpuLimit(data.value)} /></div><div><Label>Memory limit</Label><Input placeholder="512Mi" value={createMemoryLimit} onChange={(_, data) => setCreateMemoryLimit(data.value)} /></div></div>}
                                {createBuilderTab === 'Metadata' && <span style={{ fontSize: '0.86rem', opacity: 0.72 }}>Name, namespace, and description are above. Add arbitrary labels and annotations in YAML.</span>}
                                {createBuilderTab === 'YAML' && <Textarea id="yaml-resource" placeholder={'apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: example'} value={yamlToApply} onChange={(_, data) => setYamlToApply(data.value)} resize="vertical" style={{ width: '100%', height: '260px', fontFamily: 'var(--fontFamilyMonospace)' }} />}
                              </section>
                            </div>
                            {createBuilderTab !== 'YAML' && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: '0.78rem', opacity: 0.65 }}>Review and customize the YAML before applying.</span><Button appearance="secondary" icon={<Document20Regular />} onClick={() => { generateResourceManifest(); setCreateBuilderTab('YAML'); }}>Generate YAML</Button></div>}
                          </div>
                        </DialogContent>
                        <DialogActions>
                          <Button appearance="subtle" onClick={() => { setIsApplyYamlOpen(false); setFormEditTarget(null); }} disabled={isApplyingYaml}>Cancel</Button>
                          <Button appearance="primary" icon={<Add20Regular />} onClick={handleApplyYaml} disabled={!yamlToApply.trim() || isApplyingYaml}>
                            {isApplyingYaml ? 'Applying…' : 'Apply YAML'}
                          </Button>
                        </DialogActions>
                      </DialogBody>
                    </DialogSurface>
                  </Dialog>
                </>
              )}
              {context && !selectedResource && activeView !== 'overview' && activeView !== 'nodes' && activeView !== 'namespaces' && (
                  <div style={{ display: 'grid', gap: '4px' }}><Input size="small" placeholder="Filter namespaces…" value={namespaceFilter} onChange={(_, data) => setNamespaceFilter(data.value)} contentBefore={<Search20Regular />} style={{ width: '180px' }} /><Dropdown multiselect placeholder="Namespace" className={styles.namespaceDropdown} value={selectedNamespaces.join(', ')} selectedOptions={selectedNamespaces} onOptionSelect={handleNamespaceChange}><Option key="all" value="All Namespaces">All Namespaces</Option>{namespaces.filter(ns => ns.toLowerCase().includes(namespaceFilter.toLowerCase())).map(ns => <Option key={ns} value={ns}>{ns}</Option>)}</Dropdown></div>
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
                onClick={selectedResource ? () => loadResourceDetail() : () => loadData()}
                disabled={loading}
              />
            </div>
          </header>

          <div className={styles.content} ref={contentRef} onScroll={handleScroll}>
            {viewError && <Card className={styles.tableCard} style={{ borderColor: 'rgba(255, 77, 99, 0.42)' }}><div style={{ padding: '14px 18px' }}><Title3>Could not load this resource view</Title3><div style={{ fontSize: '0.82rem', opacity: 0.72, marginTop: '5px', overflowWrap: 'anywhere' }}>{viewError}</div></div></Card>}
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
                  <Button appearance="primary" icon={loading ? <Spinner size="tiny" /> : <ArrowClockwise20Regular />} onClick={() => loadData()} disabled={loading}>
                      {loading ? 'Connecting...' : 'Try Again'}
                  </Button>
               </div>
            ) : selectedResource ? (
                loading && !resourceDetail ? (
                    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '4rem' }}>
                        <Spinner label="Loading details..." />
                    </div>
                ) : resourceDetail ? (
                    <div
                        className={styles.detailView}
                        style={selectedResource.type === 'configmaps' ? { flex: 1, minHeight: 0, overflow: 'hidden' } : undefined}
                    >
                        <TabList size="small" selectedValue={detailTab} onTabSelect={(_, data) => setDetailTab(data.value as string)}>
                            <Tab value="overview">Overview</Tab>
                            <Tab value="events">Events ({detailEvents.length})</Tab>
                            {selectedResource.type === 'nodes' && <Tab value="images">Images</Tab>}
                        </TabList>

                        {detailTab === 'overview' && (
                            selectedResource.type === 'configmaps' ? (
                                <ConfigMapEditorDetail context={context} resource={resourceDetail} />
                            ) : (
                            <div className={styles.detailSection}>
                                <div style={{ 
                                    display: 'grid', 
                                    gridTemplateColumns: ['nodes', 'deployments', 'statefulsets', 'daemonsets', 'namespaces', 'services', 'other_services', 'ingresses', 'other_ingresses', 'replicasets', 'other_replicasets', 'jobs', 'other_jobs', 'cronjobs', 'pods', 'configmaps'].includes(selectedResource.type) || selectedResource.type.startsWith('custom_') ? '1fr 1fr' : '1fr',
                                    gap: '1rem', 
                                    alignItems: 'stretch',
                                    marginBottom: '1rem'
                                }}>
                                    <Card style={{ backgroundColor: 'var(--colorNeutralBackground2)', height: '100%' }}>
                                        <CardHeader header={<Subtitle2>Metadata</Subtitle2>} />
                                        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <div style={{ fontSize: '1rem', fontWeight: 'bold', wordBreak: 'break-all' }}>
                                                {resourceDetail.metadata.name}
                                            </div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                                                {resourceDetail.metadata.namespace && (
                                                    <Badge appearance="tint" color="brand">
                                                        Namespace: {resourceDetail.metadata.namespace}
                                                    </Badge>
                                                )}
                                                <Badge appearance="tint" color="subtle">
                                                    Age: {new Date(resourceDetail.metadata.creation_timestamp).toLocaleString()}
                                                </Badge>
                                            </div>
                                            {resourceDetail.metadata.labels && Object.keys(resourceDetail.metadata.labels).length > 0 && (
                                                <div style={{ marginTop: '8px' }}>
                                                    <div style={{ fontSize: '0.75rem', opacity: 0.6, marginBottom: '4px' }}>Labels</div>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                        {Object.entries(resourceDetail.metadata.labels).map(([k, v]) => (
                                                            <Badge key={k} appearance="outline" style={{ fontSize: '0.7rem' }}>{k}: {v as string}</Badge>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </Card>

                                    {selectedResource.type === 'secrets' && resourceDetail.spec && (
                                        <Card style={{ backgroundColor: 'var(--colorNeutralBackground2)', height: '100%' }}>
                                            <CardHeader header={<Subtitle2>{resourceDetail.spec.type === 'kubernetes.io/tls' ? 'TLS Certificate' : 'Secret Details'}</Subtitle2>} />
                                            <div style={{ padding: '1rem', display: 'grid', gap: '10px' }}>
                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><span style={{ opacity: 0.65, fontSize: '0.82rem' }}>Type</span><Badge appearance="tint" color="brand">{resourceDetail.spec.type || 'Opaque'}</Badge></div>
                                                {resourceDetail.spec.data_keys?.length > 0 && <div><span style={{ opacity: 0.65, fontSize: '0.82rem' }}>Keys</span><div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '5px' }}>{resourceDetail.spec.data_keys.map((key: string) => <Badge key={key} appearance="outline">{key}</Badge>)}</div></div>}
                                                {resourceDetail.spec.tls_info && (resourceDetail.spec.tls_info.error ? <span style={{ color: 'var(--colorPaletteRedForeground1)', fontSize: '0.82rem' }}>{resourceDetail.spec.tls_info.error}</span> : <div style={{ display: 'grid', gridTemplateColumns: '120px minmax(0, 1fr)', gap: '7px 12px', fontSize: '0.82rem' }}>
                                                    {[["Subject", resourceDetail.spec.tls_info.subject], ["Issuer", resourceDetail.spec.tls_info.issuer], ["Serial", resourceDetail.spec.tls_info.serial], ["Valid from", resourceDetail.spec.tls_info.not_before], ["Valid until", resourceDetail.spec.tls_info.not_after], ["SANs", resourceDetail.spec.tls_info.sans]].map(([label, value]) => <div key={label} style={{ display: 'contents' }}><span style={{ opacity: 0.65 }}>{label}</span><code style={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>{value as string}</code></div>)}
                                                </div>)}
                                            </div>
                                        </Card>
                                    )}

                                    {selectedResource.type === 'nodes' && (
                                        <Card style={{ backgroundColor: 'var(--colorNeutralBackground2)', height: '100%' }}>
                                            <CardHeader header={<Subtitle2>Conditions</Subtitle2>} />
                                            <div style={{ padding: '1rem', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                {resourceDetail.status.conditions?.map((c: any) => {
                                                    const isOk = c.type === 'Ready' ? c.status === 'True' : c.status === 'False';
                                                    return (
                                                        <Badge key={c.type} color={isOk ? 'success' : 'important'} appearance="tint">
                                                            {c.type}: {c.status}
                                                        </Badge>
                                                    );
                                                })}
                                            </div>
                                        </Card>
                                    )}

                                    {(selectedResource.type === 'deployments' || selectedResource.type === 'statefulsets' || selectedResource.type === 'daemonsets') && resourceDetail.status && (
                                        <Card style={{ backgroundColor: 'var(--colorNeutralBackground2)', height: '100%' }}>
                                            <CardHeader header={<Subtitle2>Status</Subtitle2>} />
                                            <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                <div>
                                                    {selectedResource.type === 'daemonsets' ? (
                                                        <Badge appearance="tint" color="brand" style={{ fontSize: '0.85rem', padding: '6px 10px' }}>
                                                            Ready: {resourceDetail.status.number_ready} / {resourceDetail.status.desired_number_scheduled}
                                                        </Badge>
                                                    ) : (
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                            <Badge appearance="tint" color="success">Ready: {resourceDetail.status.ready_replicas ?? 0}</Badge>
                                                            <Badge appearance="tint" color="brand">Current: {resourceDetail.status.replicas ?? 0}</Badge>
                                                            <Badge appearance="tint" color="subtle">Desired: {resourceDetail.spec?.replicas ?? 1}</Badge>
                                                        </div>
                                                    )}
                                                </div>
                                                {resourceDetail.status.conditions && resourceDetail.status.conditions.length > 0 && (
                                                    <div style={{ marginTop: '4px' }}>
                                                        <div style={{ fontSize: '0.75rem', opacity: 0.6, marginBottom: '4px' }}>Conditions</div>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                            {resourceDetail.status.conditions.map((c: any) => (
                                                                <Badge key={c.type} color={c.status === 'True' ? 'success' : 'important'} appearance="outline">
                                                                    {c.type}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </Card>
                                    )}

                                    {selectedResource.type === 'namespaces' && resourceDetail.status && (
                                        <Card style={{ backgroundColor: 'var(--colorNeutralBackground2)', height: '100%' }}>
                                            <CardHeader header={<Subtitle2>Status</Subtitle2>} />
                                            <div style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ fontSize: '0.9rem', opacity: 0.7 }}>Phase:</span>
                                                <Badge color={resourceDetail.status.phase === 'Active' ? 'success' : 'important'} size="large">
                                                    {resourceDetail.status.phase}
                                                </Badge>
                                            </div>
                                        </Card>
                                    )}

                                    {(selectedResource.type === 'services' || selectedResource.type === 'other_services') && resourceDetail.spec && (
                                        <Card style={{ backgroundColor: 'var(--colorNeutralBackground2)', height: '100%' }}>
                                            <CardHeader header={<Subtitle2>Service Details</Subtitle2>} />
                                            <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                <div>
                                                    <span style={{ fontSize: '0.85rem', opacity: 0.6 }}>Type: </span>
                                                    <Badge appearance="tint" color="brand">{resourceDetail.spec.type}</Badge>
                                                </div>
                                                <div>
                                                    <span style={{ fontSize: '0.85rem', opacity: 0.6 }}>Cluster IP: </span>
                                                    <code>{resourceDetail.spec.cluster_ip}</code>
                                                </div>
                                                {resourceDetail.spec.ports && resourceDetail.spec.ports.length > 0 && (
                                                    <div>
                                                        <div style={{ fontSize: '0.75rem', opacity: 0.6, marginBottom: '4px' }}>Ports</div>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                            {resourceDetail.spec.ports.map((p: any, idx: number) => (
                                                                <Badge key={idx} appearance="outline" style={{ fontSize: '0.75rem' }}>{p.port}:{p.targetPort || p.target_port}/{p.protocol}</Badge>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </Card>
                                    )}

                                    {(selectedResource.type === 'ingresses' || selectedResource.type === 'other_ingresses') && resourceDetail.spec && (
                                        <Card style={{ backgroundColor: 'var(--colorNeutralBackground2)', height: '100%' }}>
                                            <CardHeader header={<Subtitle2>Ingress Rules</Subtitle2>} />
                                            <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', maxHeight: '180px' }}>
                                                {resourceDetail.spec.rules?.map((rule: any, idx: number) => (
                                                    <div key={idx} style={{ borderBottom: rule.http?.paths?.length > 1 ? '1px solid var(--colorNeutralStroke2)' : 'none', paddingBottom: '4px' }}>
                                                        <div style={{ fontWeight: 'bold', fontSize: '0.8rem', marginBottom: '2px' }}>Host: {rule.host || '*'}</div>
                                                        {rule.http?.paths?.map((path: any, pIdx: number) => (
                                                            <div key={pIdx} style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                                                                <code>{path.path || '/'}</code> &rarr; <code>{path.backend?.service?.name || path.backend?.serviceName}</code>:{path.backend?.service?.port?.number || path.backend?.servicePort}
                                                            </div>
                                                        ))}
                                                    </div>
                                                ))}
                                            </div>
                                        </Card>
                                    )}

                                    {(selectedResource.type === 'replicasets' || selectedResource.type === 'other_replicasets') && resourceDetail.status && (
                                        <Card style={{ backgroundColor: 'var(--colorNeutralBackground2)', height: '100%' }}>
                                            <CardHeader header={<Subtitle2>ReplicaSet Status</Subtitle2>} />
                                            <div style={{ padding: '1rem', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                <Badge appearance="tint" color="subtle">Desired: {resourceDetail.spec?.replicas}</Badge>
                                                <Badge appearance="tint" color="brand">Current: {resourceDetail.status.replicas}</Badge>
                                                <Badge color={(resourceDetail.status.ready_replicas ?? 0) === (resourceDetail.spec?.replicas ?? 0) ? 'success' : 'warning'} appearance="tint">Ready: {resourceDetail.status.ready_replicas ?? 0}</Badge>
                                                <Badge appearance="tint" color="subtle">Available: {resourceDetail.status.available_replicas ?? 0}</Badge>
                                            </div>
                                        </Card>
                                    )}

                                    {(selectedResource.type === 'jobs' || selectedResource.type === 'other_jobs') && resourceDetail.status && (
                                        <Card style={{ backgroundColor: 'var(--colorNeutralBackground2)', height: '100%' }}>
                                            <CardHeader header={<Subtitle2>Job Status</Subtitle2>} />
                                            <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                    <Badge appearance="tint">Completions: {resourceDetail.spec?.completions}</Badge>
                                                    <Badge appearance="tint">Parallelism: {resourceDetail.spec?.parallelism}</Badge>
                                                    <Badge appearance="tint" color="brand">Active: {resourceDetail.status.active}</Badge>
                                                    <Badge color="success" appearance="tint">Succeeded: {resourceDetail.status.succeeded}</Badge>
                                                    <Badge color={resourceDetail.status.failed > 0 ? 'important' : 'subtle'} appearance="tint">Failed: {resourceDetail.status.failed}</Badge>
                                                </div>
                                                <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                                                    {resourceDetail.status.start_time && <div>Started: {new Date(resourceDetail.status.start_time).toLocaleString()}</div>}
                                                    {resourceDetail.status.completion_time && <div>Completed: {new Date(resourceDetail.status.completion_time).toLocaleString()}</div>}
                                                </div>
                                            </div>
                                        </Card>
                                    )}

                                    {selectedResource.type === 'cronjobs' && resourceDetail.spec && (
                                        <Card style={{ backgroundColor: 'var(--colorNeutralBackground2)', height: '100%' }}>
                                            <CardHeader header={<Subtitle2>CronJob Details</Subtitle2>} />
                                            <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                <div>Schedule: <code>{resourceDetail.spec.schedule}</code></div>
                                                <div>Suspend: <Badge color={resourceDetail.spec.suspend ? 'warning' : 'success'}>{resourceDetail.spec.suspend ? 'Yes' : 'No'}</Badge></div>
                                                <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>Last Run: {resourceDetail.status.last_schedule_time ? new Date(resourceDetail.status.last_schedule_time).toLocaleString() : 'Never'}</div>
                                                <Button size="small" appearance="secondary" icon={<ArrowClockwise20Regular />} onClick={() => handleRunCronJob(selectedResource.namespace, selectedResource.name)}>Run now</Button>
                                            </div>
                                        </Card>
                                    )}

                                    {selectedResource.type === 'pods' && resourceDetail.status && (
                                        <Card style={{ backgroundColor: 'var(--colorNeutralBackground2)', height: '100%' }}>
                                            <CardHeader header={<Subtitle2>Pod Status</Subtitle2>} />
                                            <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span>Phase:</span>
                                                    <Badge color={resourceDetail.status.phase === 'Running' ? 'success' : 'important'}>{resourceDetail.status.phase}</Badge>
                                                </div>
                                                <div>IP: <code>{resourceDetail.status.pod_ip || '---'}</code> (Host: <code>{resourceDetail.status.host_ip || '---'}</code>)</div>
                                                <div>Node: <span className={styles.clickableName} onClick={() => setSelectedResource({ type: 'nodes', name: resourceDetail.spec.node_name })}>{resourceDetail.spec.node_name}</span></div>
                                            </div>
                                        </Card>
                                    )}

                                    {selectedResource.type === 'configmaps' && resourceDetail.spec && (
                                        <Card style={{ backgroundColor: 'var(--colorNeutralBackground2)', height: '100%' }}>
                                            <CardHeader header={<Subtitle2>ConfigMap Data</Subtitle2>} />
                                            <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '260px', overflowY: 'auto' }}>
                                                {Object.entries(resourceDetail.spec.data || {}).length > 0 ? (
                                                    Object.entries(resourceDetail.spec.data).map(([key, value]) => (
                                                        <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                            <span style={{ fontSize: '0.76rem', fontWeight: 600 }}>{key}</span>
                                                            <code style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{String(value)}</code>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <span style={{ fontSize: '0.85rem', opacity: 0.65 }}>No text data.</span>
                                                )}
                                                {resourceDetail.spec.binary_data_keys?.length > 0 && (
                                                    <span style={{ fontSize: '0.78rem', opacity: 0.65 }}>Binary values: {resourceDetail.spec.binary_data_keys.join(', ')}</span>
                                                )}
                                            </div>
                                        </Card>
                                    )}

                                    {selectedResource.type.startsWith('custom_') && resourceDetail.spec && (
                                        <Card style={{ backgroundColor: 'var(--colorNeutralBackground2)', height: '100%' }}>
                                            <CardHeader header={<Subtitle2>{['VerticalPodAutoscaler', 'VerticalPodAutoscalerCheckpoint'].includes(crds.find(item => item.plural === selectedResource.type.replace('custom_', ''))?.kind || '') ? 'Autoscaling Summary' : 'Spec Summary'}</Subtitle2>} />
                                            <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto', maxHeight: '180px' }}>
                                                <CustomResourceSummary kind={crds.find(item => item.plural === selectedResource.type.replace('custom_', ''))?.kind} resource={resourceDetail} />
                                            </div>
                                        </Card>
                                    )}
                                </div>

                                {selectedResource.type === 'namespaces' && (
                                    <>
                                    <Card style={{ backgroundColor: 'var(--colorNeutralBackground2)', marginBottom: '1rem' }}>
                                        <CardHeader header={<Subtitle2>Resource Counts</Subtitle2>} />
                                        <div style={{ padding: '1rem', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                            {Object.entries(resourceDetail.counts || {}).map(([k, v]) => (
                                                <Badge key={k} appearance="tint" color="brand" style={{ padding: '6px 10px', fontSize: '0.8rem' }}>
                                                    {k.charAt(0).toUpperCase() + k.slice(1)}: {v as number}
                                                </Badge>
                                            ))}
                                        </div>
                                    </Card>

                                    <Card style={{ backgroundColor: 'var(--colorNeutralBackground2)', marginBottom: '1rem' }}>
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

                                {(selectedResource.type === 'services' || selectedResource.type === 'other_services') && resourceDetail.spec?.selector && (
                                    <Card style={{ backgroundColor: 'var(--colorNeutralBackground2)', marginBottom: '1rem' }}>
                                        <CardHeader header={<Subtitle2>Selector Labels</Subtitle2>} />
                                        <div style={{ padding: '1rem', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                            {Object.entries(resourceDetail.spec.selector).map(([k, v]) => (
                                                <Badge key={k} appearance="tint">{k}={v as string}</Badge>
                                            ))}
                                        </div>
                                    </Card>
                                )}

                                {(selectedResource.type === 'pods' || selectedResource.type === 'deployments' || selectedResource.type === 'statefulsets' || selectedResource.type === 'daemonsets' || selectedResource.type === 'cronjobs') && resourceDetail.spec && (
                                    <>
                                    <Title3 style={{ fontSize: '1rem', marginTop: '1rem', marginBottom: '0.5rem', display: 'block' }}>{selectedResource.type === 'pods' ? 'Containers' : 'Pod Template Containers'}</Title3>
                                    {resourceDetail.spec.containers?.map((c: any) => {
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
                                                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
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

                                {(selectedResource.type === 'nodes' || selectedResource.type === 'deployments' || selectedResource.type === 'statefulsets' || selectedResource.type === 'daemonsets' || selectedResource.type === 'replicasets' || selectedResource.type === 'other_replicasets' || selectedResource.type === 'jobs' || selectedResource.type === 'other_jobs' || selectedResource.type === 'services' || selectedResource.type === 'other_services' || selectedResource.type === 'ingresses' || selectedResource.type === 'other_ingresses') && (
                                     <Card style={{ backgroundColor: 'var(--colorNeutralBackground2)', marginTop: '1rem' }}>
                                        <CardHeader header={<Subtitle2>Pods ({detailPods.length})</Subtitle2>} />
                                        <div style={{ padding: '0.5rem 1rem 1rem 1rem' }}>
                                            {detailPods && detailPods.length > 0 ? (
                                                <Table size="extra-small">
                                                    <TableHeader>
                                                        <TableRow style={{ borderBottom: '1px solid var(--colorNeutralStroke3)' }}>
                                                            <TableHeaderCell>Name</TableHeaderCell>
                                                            <TableHeaderCell style={{ width: '80px' }}>Status</TableHeaderCell>
                                                            <TableHeaderCell style={{ width: '70px' }}>CPU</TableHeaderCell>
                                                            <TableHeaderCell style={{ width: '70px' }}>Memory</TableHeaderCell>
                                                            <TableHeaderCell style={{ width: '142px' }}>Actions</TableHeaderCell>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {detailPods.map(p => {
                                                            const { cpu, mem } = getMetricValues(p);
                                                            return (
                                                                <TableRow key={p.name}>
                                                                    <TableCell>
                                                                        <span 
                                                                            className={styles.clickableName} 
                                                                            onClick={() => setSelectedResource({ type: 'pods', name: p.name, namespace: p.namespace || selectedResource.namespace })}
                                                                        >
                                                                            {p.name}
                                                                        </span>
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <Badge color={p.status === 'Running' ? 'success' : 'important'} appearance="outline">
                                                                            {p.status?.toLowerCase()}
                                                                        </Badge>
                                                                    </TableCell>
                                                                    <TableCell><span style={{ fontSize: '0.75rem' }}>{cpu}</span></TableCell>
                                                                    <TableCell><span style={{ fontSize: '0.75rem' }}>{mem}</span></TableCell>
                                                                    <TableCell>
                                                                        <div style={{ display: 'flex', gap: '4px' }}>
                                                                            <Button size="small" appearance="subtle" icon={<TextBulletList20Regular />} onClick={() => handleOpenLogs(p.namespace || selectedResource.namespace || 'default', p.name)}>Logs</Button>
                                                                            <Button size="small" appearance="subtle" icon={<WindowConsole20Regular />} onClick={() => handleOpenShell(p.namespace || selectedResource.namespace || 'default', p.name, p.containers?.[0] || 'default')}>Shell</Button>
                                                                        </div>
                                                                    </TableCell>
                                                                </TableRow>
                                                            );
                                                        })}
                                                    </TableBody>
                                                </Table>
                                            ) : (
                                                <div style={{ opacity: 0.5, fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>No pods found.</div>
                                            )}
                                        </div>
                                     </Card>
                                )}
                            </div>
                            )
                        )}

                        {detailTab === 'events' && (
                            <div className={styles.tableCard}>
                                <div style={{ padding: '18px' }}>
                                  {detailEventsWarnings.length > 0 && <div style={{ marginBottom: '12px', padding: '10px 12px', borderRadius: '7px', fontSize: '0.8rem', background: 'rgba(255, 166, 0, 0.1)', border: '1px solid rgba(255, 166, 0, 0.25)' }}><strong>Some event sources could not be queried.</strong><div style={{ marginTop: '4px', opacity: 0.72 }}>{detailEventsWarnings[0]}</div></div>}
                                  <EventTimeline events={detailEvents} emptyLabel={selectedResource.type === 'namespaces' ? 'No events recorded in this namespace.' : 'No events recorded for this resource.'} />
                                </div>
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
            ) : activeView === 'helm' ? (
                <div style={{ display: 'grid', gap: '16px' }}>
                  {helmError && <Card className={styles.tableCard} style={{ borderColor: 'rgba(255, 166, 0, 0.45)' }}><div style={{ padding: '14px 18px' }}><Title3>Helm releases could not be loaded</Title3><div style={{ fontSize: '0.82rem', opacity: 0.72, marginTop: '5px' }}>{helmError}</div><div style={{ fontSize: '0.78rem', opacity: 0.6, marginTop: '8px' }}>The Kubernetes connection remains available. Check that Helm is installed and that this context is reachable by the Helm CLI.</div></div></Card>}
                  {helmRelease && <Dialog open onOpenChange={(_, data) => !data.open && setHelmRelease(null)}>
                    <DialogSurface style={{ width: 'min(980px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 32px)' }}>
                      <DialogBody>
                        <DialogTitle>{helmRelease.name} · Helm history</DialogTitle>
                        <DialogContent>
                          <div style={{ display: 'grid', gap: '18px', maxHeight: 'calc(100vh - 180px)', overflowY: 'auto', paddingRight: '4px' }}>
                            <div style={{ overflowX: 'auto', border: '1px solid var(--colorNeutralStroke2)', borderRadius: '8px' }}>
                              <Table size="small" style={{ minWidth: '700px', tableLayout: 'fixed' }}>
                                <TableHeader><TableRow><TableHeaderCell style={{ width: '74px' }}>Revision</TableHeaderCell><TableHeaderCell style={{ width: '110px' }}>Status</TableHeaderCell><TableHeaderCell>Chart</TableHeaderCell><TableHeaderCell style={{ width: '190px' }}>Updated</TableHeaderCell><TableHeaderCell style={{ width: '112px' }}>Action</TableHeaderCell></TableRow></TableHeader>
                                <TableBody>{helmHistory.map(item => <TableRow key={item.revision}><TableCell>{item.revision}</TableCell><TableCell><Badge color={item.status === 'deployed' ? 'success' : 'warning'}>{item.status}</Badge></TableCell><TableCell style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.chart}>{item.chart}</TableCell><TableCell style={{ whiteSpace: 'nowrap', fontSize: '0.78rem' }}>{item.updated}</TableCell><TableCell><Button size="small" appearance="secondary" onClick={async () => { if (!await feedback.confirm('Rollback Helm release?', `Rollback ${helmRelease.name} to revision ${item.revision}?`, { confirmLabel: 'Rollback', destructive: true })) return; await apiFetch(`/api/helm/${context}/releases/${encodeURIComponent(helmRelease.namespace)}/${encodeURIComponent(helmRelease.name)}/rollback`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revision: item.revision }) }); setHelmRelease(null); loadData(); }}>Rollback</Button></TableCell></TableRow>)}</TableBody>
                              </Table>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}><Title3 style={{ fontSize: '0.92rem', lineHeight: 1.2 }}>Values diff · latest revision</Title3><Button size="small" appearance="secondary" onClick={loadHelmDrift} disabled={helmDriftLoading}>{helmDriftLoading ? 'Comparing…' : 'Check resource drift'}</Button></div>
                            <pre style={{ margin: 0, maxHeight: '240px', overflow: 'auto', whiteSpace: 'pre-wrap', padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.24)', fontSize: '0.76rem', lineHeight: 1.45 }}>{helmValuesDiff}</pre>
                            {helmDrift && <div style={{ display: 'grid', gap: '10px' }}><div style={{ fontSize: '0.82rem', opacity: 0.72 }}><strong>{helmDrift.changes?.length || 0}</strong> changed · <strong>{helmDrift.missing?.length || 0}</strong> missing · <strong>{helmDrift.unchanged || 0}</strong> in sync of {helmDrift.total || 0} rendered resources</div>{helmDrift.changes?.map((change: any) => <details key={change.resource}><summary style={{ cursor: 'pointer', fontWeight: 600 }}>{change.resource}</summary><pre style={{ margin: '8px 0 0', maxHeight: '220px', overflow: 'auto', whiteSpace: 'pre-wrap', padding: '10px', borderRadius: '7px', background: 'rgba(255,166,0,0.08)', fontSize: '0.74rem' }}>{change.diff}</pre></details>)}{helmDrift.missing?.map((resource: string) => <Badge key={resource} color="warning" appearance="tint">Missing: {resource}</Badge>)}{helmDrift.errors?.map((item: any) => <div key={item.resource} style={{ fontSize: '0.78rem', color: 'var(--colorPaletteRedForeground1)' }}>{item.resource}: {item.error}</div>)}</div>}
                          </div>
                        </DialogContent>
                        <DialogActions><Button onClick={() => setHelmRelease(null)}>Close</Button></DialogActions>
                      </DialogBody>
                    </DialogSurface>
                  </Dialog>}
                  <div className={styles.overviewGrid}><Card className={styles.metricCard}><Title3>Helm releases</Title3><div style={{ fontSize: '2rem', fontWeight: 700 }}>{helmData?.releases?.length || 0}</div></Card><Card className={styles.metricCard}><Title3>Deployed</Title3><div style={{ fontSize: '2rem', fontWeight: 700 }}>{helmData?.releases?.filter((item: any) => item.status === 'deployed').length || 0}</div></Card></div>
                  <div className={styles.tableCard}><Table><TableHeader><TableRow><TableHeaderCell>Release</TableHeaderCell><TableHeaderCell>Namespace</TableHeaderCell><TableHeaderCell>Status</TableHeaderCell><TableHeaderCell>Chart</TableHeaderCell><TableHeaderCell>App version</TableHeaderCell><TableHeaderCell>Revision</TableHeaderCell></TableRow></TableHeader><TableBody>{helmData?.releases?.map((item: any) => <TableRow key={`${item.namespace}/${item.name}`} onClick={() => openHelmRelease(item)} style={{ cursor: 'pointer' }}><TableCell><strong>{item.name}</strong></TableCell><TableCell>{item.namespace}</TableCell><TableCell><Badge color={item.status === 'deployed' ? 'success' : 'warning'}>{item.status}</Badge></TableCell><TableCell>{item.chart}</TableCell><TableCell>{item.app_version || '—'}</TableCell><TableCell>{item.revision}</TableCell></TableRow>)}</TableBody></Table></div>
                </div>
            ) : activeView === 'persistentvolumes' ? (
                <div style={{ display: 'grid', gap: '16px' }}>
                  <div className={styles.overviewGrid}>
                    {[
                      ['PVCs', storageData?.summary?.pvc_count],
                      ['Bound claims', storageData?.summary?.bound_pvc_count],
                      ['PersistentVolumes', storageData?.summary?.pv_count],
                      ['Attached volumes', storageData?.summary?.attached_count],
                    ].map(([label, value]) => <Card key={label as string} className={styles.metricCard}><Title3>{label}</Title3><div style={{ fontSize: '2rem', fontWeight: 700 }}>{value ?? 0}</div></Card>)}
                  </div>
                  <Card className={styles.tableCard}><div style={{ padding: '14px 18px', display: 'flex', gap: '28px', flexWrap: 'wrap' }}><div><span style={{ fontSize: '0.76rem', opacity: 0.62 }}>Requested capacity</span><div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{storageData?.summary?.requested_bytes ? `${(storageData.summary.requested_bytes / 1024 ** 3).toFixed(2)} GiB` : '—'}</div></div><div><span style={{ fontSize: '0.76rem', opacity: 0.62 }}>PV capacity</span><div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{storageData?.summary?.capacity_bytes ? `${(storageData.summary.capacity_bytes / 1024 ** 3).toFixed(2)} GiB` : '—'}</div></div><div style={{ fontSize: '0.8rem', opacity: 0.67, maxWidth: '480px' }}>Capacity is calculated from the storage quantities advertised by PersistentVolumes and requested by claims.</div></div></Card>
                  {storageData?.risks?.length > 0 && <Card className={styles.tableCard} style={{ borderColor: 'rgba(255, 166, 0, 0.35)' }}><div style={{ padding: '14px 18px' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><Title3>Storage attention</Title3><Badge color="warning">{storageData.risks.length} item{storageData.risks.length === 1 ? '' : 's'}</Badge></div><div style={{ display: 'grid', gap: '7px', marginTop: '10px' }}>{storageData.risks.slice(0, 6).map((risk: any, index: number) => <div key={index} style={{ fontSize: '0.82rem' }}><Badge color={risk.severity === 'danger' ? 'danger' : risk.severity === 'warning' ? 'warning' : 'informative'}>{risk.severity}</Badge> <strong>{risk.title}</strong><span style={{ opacity: 0.68 }}> — {risk.detail}</span></div>)}</div></div></Card>}
                  <TabList selectedValue={storageSection} onTabSelect={(_, data) => setStorageSection(data.value as typeof storageSection)}><Tab value="pvcs">PersistentVolumeClaims</Tab><Tab value="pvs">PersistentVolumes</Tab><Tab value="classes">StorageClasses</Tab><Tab value="attachments">VolumeAttachments</Tab><Tab value="snapshots">Snapshots ({storageData?.snapshots?.length || 0})</Tab></TabList>
                  {storageSection === 'pvcs' && <div className={styles.tableCard}><Table><TableHeader><TableRow><TableHeaderCell>Claim</TableHeaderCell><TableHeaderCell>Status</TableHeaderCell><TableHeaderCell>Requested</TableHeaderCell><TableHeaderCell>Capacity</TableHeaderCell><TableHeaderCell>StorageClass</TableHeaderCell><TableHeaderCell>Workloads using it</TableHeaderCell></TableRow></TableHeader><TableBody>{storageData?.pvcs?.map((item: any) => <TableRow key={`${item.namespace}/${item.name}`}><TableCell><strong>{item.namespace}/{item.name}</strong><div style={{ fontSize: '0.75rem', opacity: 0.62 }}>{item.access_modes.join(', ')}</div>{item.conditions?.filter((condition: any) => condition.status === 'True').map((condition: any) => <Badge key={condition.type} color="warning" size="small">{condition.type}</Badge>)}</TableCell><TableCell><Badge color={item.status === 'Bound' ? 'success' : 'warning'}>{item.status}</Badge></TableCell><TableCell>{item.requested}</TableCell><TableCell>{item.capacity}</TableCell><TableCell>{item.storage_class}</TableCell><TableCell>{item.consumers?.length ? item.consumers.map((consumer: any) => <div key={consumer.pod} style={{ fontSize: '0.78rem' }}><strong>{consumer.pod}</strong> · {consumer.node} · {consumer.phase}</div>) : <span style={{ opacity: 0.6 }}>Not mounted</span>}</TableCell></TableRow>)}</TableBody></Table></div>}
                  {storageSection === 'pvs' && <div className={styles.tableCard}><Table><TableHeader><TableRow><TableHeaderCell>PersistentVolume</TableHeaderCell><TableHeaderCell>Status</TableHeaderCell><TableHeaderCell>Capacity</TableHeaderCell><TableHeaderCell>Claim</TableHeaderCell><TableHeaderCell>StorageClass</TableHeaderCell><TableHeaderCell>Reclaim policy</TableHeaderCell></TableRow></TableHeader><TableBody>{storageData?.pvs?.map((item: any) => <TableRow key={item.name}><TableCell><strong>{item.name}</strong><div style={{ fontSize: '0.75rem', opacity: 0.62 }}>{item.access_modes.join(', ')}</div></TableCell><TableCell><Badge color={item.status === 'Bound' ? 'success' : item.status === 'Available' ? 'informative' : 'warning'}>{item.status}</Badge></TableCell><TableCell>{item.capacity}</TableCell><TableCell>{item.claim}</TableCell><TableCell>{item.storage_class}</TableCell><TableCell>{item.reclaim_policy}</TableCell></TableRow>)}</TableBody></Table></div>}
                  {storageSection === 'classes' && <div className={styles.tableCard}><Table><TableHeader><TableRow><TableHeaderCell>StorageClass</TableHeaderCell><TableHeaderCell>Provisioner</TableHeaderCell><TableHeaderCell>Binding mode</TableHeaderCell><TableHeaderCell>Reclaim policy</TableHeaderCell><TableHeaderCell>Expansion</TableHeaderCell></TableRow></TableHeader><TableBody>{storageData?.storage_classes?.map((item: any) => <TableRow key={item.name}><TableCell><strong>{item.name}</strong>{item.default && <Badge color="brand" appearance="tint" style={{ marginLeft: '7px' }}>Default</Badge>}</TableCell><TableCell><code>{item.provisioner}</code></TableCell><TableCell>{item.binding_mode}</TableCell><TableCell>{item.reclaim_policy}</TableCell><TableCell><Badge color={item.allow_expansion ? 'success' : 'subtle'}>{item.allow_expansion ? 'Allowed' : 'Not allowed'}</Badge></TableCell></TableRow>)}</TableBody></Table></div>}
                  {storageSection === 'attachments' && <div className={styles.tableCard}><Table><TableHeader><TableRow><TableHeaderCell>VolumeAttachment</TableHeaderCell><TableHeaderCell>PersistentVolume</TableHeaderCell><TableHeaderCell>Node</TableHeaderCell><TableHeaderCell>State</TableHeaderCell><TableHeaderCell>Issue</TableHeaderCell></TableRow></TableHeader><TableBody>{storageData?.attachments?.map((item: any) => <TableRow key={item.name}><TableCell><strong>{item.name}</strong></TableCell><TableCell>{item.pv}</TableCell><TableCell>{item.node}</TableCell><TableCell><Badge color={item.attached ? 'success' : 'warning'}>{item.attached ? 'Attached' : 'Detached'}</Badge></TableCell><TableCell>{item.attach_error || '—'}</TableCell></TableRow>)}</TableBody></Table></div>}
                  {storageSection === 'snapshots' && <div className={styles.tableCard}><Table><TableHeader><TableRow><TableHeaderCell>VolumeSnapshot</TableHeaderCell><TableHeaderCell>Source PVC</TableHeaderCell><TableHeaderCell>Size</TableHeaderCell><TableHeaderCell>Ready</TableHeaderCell><TableHeaderCell>Created</TableHeaderCell></TableRow></TableHeader><TableBody>{storageData?.snapshots?.map((item: any) => <TableRow key={`${item.namespace}/${item.name}`}><TableCell><strong>{item.namespace}/{item.name}</strong></TableCell><TableCell>{item.source_pvc}</TableCell><TableCell>{item.size}</TableCell><TableCell><Badge color={item.ready ? 'success' : 'warning'}>{item.ready ? 'Ready' : 'Pending'}</Badge></TableCell><TableCell>{item.created_at ? new Date(item.created_at).toLocaleString() : '—'}</TableCell></TableRow>)}{!storageData?.snapshots?.length && <TableRow><TableCell colSpan={5} style={{ padding: '28px', opacity: 0.65 }}>No VolumeSnapshots found, or the Kubernetes snapshot API is not installed.</TableCell></TableRow>}</TableBody></Table></div>}
                </div>
            ) : activeView === 'network' ? (
                <div style={{ display: 'grid', gap: '16px' }}>
                  <div className={styles.overviewGrid}>{[['Services', networkData?.services?.length], ['Ingresses', networkData?.ingresses?.length], ['NetworkPolicies', networkData?.policies?.length], ['Endpoints', networkData?.endpoints?.length]].map(([label, count]) => <Card key={label as string} className={styles.metricCard}><Title3>{label}</Title3><div style={{ fontSize: '2rem', fontWeight: 700 }}>{count ?? 0}</div></Card>)}</div>
                  <TabList selectedValue={networkSection} onTabSelect={(_, data) => setNetworkSection(data.value as typeof networkSection)}>
                    <Tab value="services">Services</Tab><Tab value="ingresses">Ingresses</Tab><Tab value="policies">Network Policies</Tab><Tab value="endpoints">Endpoints</Tab><Tab value="diagnostics">DNS & tests</Tab>
                  </TabList>
                  {networkSection === 'services' && <div className={styles.tableCard}><Table><TableHeader><TableRow><TableHeaderCell>Service</TableHeaderCell><TableHeaderCell>Type</TableHeaderCell><TableHeaderCell>Cluster IP</TableHeaderCell><TableHeaderCell>Ports</TableHeaderCell><TableHeaderCell>Ready endpoints</TableHeaderCell></TableRow></TableHeader><TableBody>{networkData?.services?.map((service: any) => <TableRow key={`${service.namespace}/${service.name}`}><TableCell><strong>{service.namespace}/{service.name}</strong></TableCell><TableCell><Badge appearance="tint">{service.type}</Badge></TableCell><TableCell><code>{service.cluster_ip || '—'}</code></TableCell><TableCell>{service.ports.join(', ') || '—'}</TableCell><TableCell><Badge color={service.ready_endpoints ? 'success' : 'warning'}>{service.ready_endpoints}</Badge></TableCell></TableRow>)}</TableBody></Table></div>}
                  {networkSection === 'ingresses' && <div className={styles.tableCard}><Table><TableHeader><TableRow><TableHeaderCell>Ingress</TableHeaderCell><TableHeaderCell>Class</TableHeaderCell><TableHeaderCell>Hosts</TableHeaderCell></TableRow></TableHeader><TableBody>{networkData?.ingresses?.map((item: any) => <TableRow key={`${item.namespace}/${item.name}`}><TableCell><strong>{item.namespace}/{item.name}</strong></TableCell><TableCell>{item.class || 'Default'}</TableCell><TableCell>{item.hosts.join(', ') || 'No hosts configured'}</TableCell></TableRow>)}</TableBody></Table></div>}
                  {networkSection === 'policies' && <div className={styles.tableCard}><Table><TableHeader><TableRow><TableHeaderCell>NetworkPolicy</TableHeaderCell><TableHeaderCell>Pod selector</TableHeaderCell><TableHeaderCell>Policy types</TableHeaderCell><TableHeaderCell>Rules</TableHeaderCell></TableRow></TableHeader><TableBody>{networkData?.policies?.map((item: any) => <TableRow key={`${item.namespace}/${item.name}`}><TableCell><strong>{item.namespace}/{item.name}</strong></TableCell><TableCell><code>{Object.entries(item.pod_selector || {}).map(([key, value]) => `${key}=${value}`).join(', ') || 'All pods'}</code></TableCell><TableCell>{item.policy_types.join(', ') || 'Ingress'}</TableCell><TableCell>{item.ingress_rules} ingress · {item.egress_rules} egress</TableCell></TableRow>)}</TableBody></Table></div>}
                  {networkSection === 'endpoints' && <div className={styles.tableCard}><Table><TableHeader><TableRow><TableHeaderCell>Endpoint</TableHeaderCell><TableHeaderCell>Ready addresses</TableHeaderCell><TableHeaderCell>Not ready</TableHeaderCell><TableHeaderCell>Ports</TableHeaderCell></TableRow></TableHeader><TableBody>{networkData?.endpoints?.map((item: any) => <TableRow key={`${item.namespace}/${item.name}`}><TableCell><strong>{item.namespace}/{item.name}</strong></TableCell><TableCell>{item.addresses.join(', ') || '—'}</TableCell><TableCell>{item.not_ready_addresses.join(', ') || '—'}</TableCell><TableCell>{item.ports.join(', ') || '—'}</TableCell></TableRow>)}</TableBody></Table></div>}
                  {networkSection === 'diagnostics' && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px', width: '100%' }}>
                    <Card className={styles.tableCard} style={{ gridColumn: '1 / -1', width: '100%' }}><div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}><div style={{ display: 'grid', gap: '5px', width: '280px' }}><Label>Probe source node</Label><Dropdown value={networkProbeNode || 'Any schedulable node'} selectedOptions={[networkProbeNode || '']} onOptionSelect={(_, data) => setNetworkProbeNode(data.optionValue || '')}><Option value="">Any schedulable node</Option>{(networkData?.nodes || []).map((node: string) => <Option key={node} value={node}>{node}</Option>)}</Dropdown></div><div style={{ minWidth: '260px', flex: 1 }}><strong style={{ fontSize: '0.85rem' }}>Run from inside the cluster</strong><div style={{ fontSize: '0.78rem', opacity: 0.68, marginTop: '4px' }}>A temporary Alpine Pod runs on the selected node and is removed after the result is collected.</div></div></div></Card>
                    <Card className={styles.tableCard} style={{ width: '100%', minWidth: 0 }}><div style={{ padding: '20px', display: 'grid', gap: '14px', minHeight: '260px', alignContent: 'start' }}><div><Title3>DNS resolution</Title3><div style={{ fontSize: '0.8rem', opacity: 0.68, marginTop: '5px' }}>Resolve a Service DNS name from the probe Pod.</div></div><Input value={dnsHost} onChange={(_, data) => setDnsHost(data.value)} placeholder="service.namespace.svc" /><Button appearance="primary" onClick={runDnsCheck} disabled={isRunningDnsCheck || !dnsHost.trim()}>{isRunningDnsCheck ? 'Checking…' : 'Resolve DNS'}</Button>{dnsResult && <div style={{ fontSize: '0.82rem', padding: '12px', borderRadius: '8px', background: dnsResult.reachable ? 'rgba(44,197,126,0.1)' : 'rgba(255,77,99,0.1)' }}><Badge color={dnsResult.reachable ? 'success' : 'danger'}>{dnsResult.reachable ? 'Resolved' : 'Resolution failed'}</Badge>{dnsResult.node && <span style={{ marginLeft: '8px', opacity: 0.75 }}>Source: {dnsResult.node}</span>}<pre style={{ margin: '10px 0 0', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontFamily: 'var(--fontFamilyMonospace)', fontSize: '0.76rem' }}>{dnsResult.output || dnsResult.error}</pre></div>}</div></Card>
                    <Card className={styles.tableCard} style={{ width: '100%', minWidth: 0 }}><div style={{ padding: '20px', display: 'grid', gap: '14px', minHeight: '260px', alignContent: 'start' }}><div><Title3>TCP connectivity</Title3><div style={{ fontSize: '0.8rem', opacity: 0.68, marginTop: '5px' }}>Test a Service, endpoint, or external host from the probe Pod.</div></div><div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 110px', gap: '8px' }}><Input value={connectionHost} onChange={(_, data) => setConnectionHost(data.value)} placeholder="Service DNS or endpoint IP" /><Input type="number" value={connectionPort} onChange={(_, data) => setConnectionPort(data.value)} min="1" max="65535" /></div><Button appearance="primary" onClick={runConnectionTest} disabled={isRunningConnectionCheck || !connectionHost.trim() || !connectionPort}>{isRunningConnectionCheck ? 'Testing…' : 'Test connection'}</Button>{connectionResult && <div style={{ fontSize: '0.82rem', padding: '12px', borderRadius: '8px', background: connectionResult.reachable ? 'rgba(44,197,126,0.1)' : 'rgba(255,77,99,0.1)' }}><Badge color={connectionResult.reachable ? 'success' : 'danger'}>{connectionResult.reachable ? 'Reachable' : 'Unavailable'}</Badge><span style={{ marginLeft: '8px', opacity: 0.75 }}>{connectionResult.node ? `Source: ${connectionResult.node} · ` : ''}{connectionResult.latency_ms != null ? `${connectionResult.latency_ms} ms` : ''}</span><pre style={{ margin: '10px 0 0', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontFamily: 'var(--fontFamilyMonospace)', fontSize: '0.76rem' }}>{connectionResult.output || connectionResult.error}</pre></div>}</div></Card>
                  </div>}
                </div>
            ) : activeView === 'rbac' ? (
                <div style={{ display: 'grid', gap: '16px' }}>
                  {rbacServiceAccountAccess && <Dialog open onOpenChange={(_, data) => !data.open && setRbacServiceAccountAccess(null)}><DialogSurface style={{ width: 'min(880px, calc(100vw - 32px))', maxWidth: '880px' }}><DialogBody><DialogTitle>ServiceAccount access</DialogTitle><DialogContent><div style={{ display: 'grid', gap: '12px' }}><strong>{rbacServiceAccountAccess.service_account}</strong>{(rbacServiceAccountAccess.bindings || []).map((binding: any) => { const verbs = ['get', 'list', 'watch', 'create', 'update', 'patch', 'delete']; const resources: string[] = [...new Set<string>(binding.rules.flatMap((rule: any): string[] => rule.resources?.length ? rule.resources : ['*']))]; const allows = (resource: string, verb: string) => binding.rules.some((rule: any) => (rule.resources?.includes(resource) || rule.resources?.includes('*')) && (rule.verbs?.includes(verb) || rule.verbs?.includes('*'))); return <Card key={binding.binding}><div style={{ padding: '12px' }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}><div><strong>{binding.binding}</strong> → <Badge appearance="tint">{binding.role}</Badge></div><span style={{ fontSize: '0.76rem', opacity: 0.65 }}>{binding.cluster_scoped ? 'Cluster binding' : binding.namespace || 'Namespaced binding'}</span></div><Table size="extra-small"><TableHeader><TableRow><TableHeaderCell>Resource</TableHeaderCell>{verbs.map(verb => <TableHeaderCell key={verb} style={{ textTransform: 'capitalize', textAlign: 'center' }}>{verb}</TableHeaderCell>)}</TableRow></TableHeader><TableBody>{resources.map(resource => <TableRow key={resource}><TableCell><code>{resource}</code></TableCell>{verbs.map(verb => <TableCell key={verb} style={{ textAlign: 'center' }}><Checkbox checked={allows(resource, verb)} disabled aria-label={`${verb} ${resource}`} /></TableCell>)}</TableRow>)}</TableBody></Table></div></Card>; })}{!rbacServiceAccountAccess.bindings?.length && <span style={{ opacity: 0.65 }}>No role bindings grant this ServiceAccount access.</span>}</div></DialogContent><DialogActions><Button onClick={() => setRbacServiceAccountAccess(null)}>Close</Button></DialogActions></DialogBody></DialogSurface></Dialog>}
                  {rbacBindingEditor && <Dialog open onOpenChange={(_, data) => !data.open && setRbacBindingEditor(null)}><DialogSurface style={{ width: 'min(700px, calc(100vw - 32px))', maxWidth: '700px' }}><DialogBody><DialogTitle>Edit Role Binding</DialogTitle><DialogContent><div style={{ display: 'grid', gap: '18px' }}><div style={{ padding: '10px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.035)', fontSize: '0.82rem' }}><strong>{rbacBindingEditor.namespace ? `${rbacBindingEditor.namespace}/` : 'Cluster-wide / '}{rbacBindingEditor.name}</strong><span style={{ opacity: 0.65 }}> · changes apply immediately</span></div><div style={{ display: 'grid', gridTemplateColumns: '0.8fr 1.2fr', gap: '12px' }}><div style={{ display: 'grid', gap: '5px' }}><Label>Role type</Label><Dropdown value={rbacBindingEditor.roleKind} selectedOptions={[rbacBindingEditor.roleKind]} onOptionSelect={(_, data) => setRbacBindingEditor({ ...rbacBindingEditor, roleKind: data.optionValue, roleName: '' })}><Option value="Role">Role</Option><Option value="ClusterRole">ClusterRole</Option></Dropdown></div><div style={{ display: 'grid', gap: '5px' }}><Label>Granted role</Label><Dropdown value={rbacBindingEditor.roleName} selectedOptions={[rbacBindingEditor.roleName]} onOptionSelect={(_, data) => setRbacBindingEditor({ ...rbacBindingEditor, roleName: data.optionValue })}>{(rbacBindingEditor.roleKind === 'ClusterRole' ? (rbacData?.cluster_roles || []) : (rbacData?.roles || []).filter((role: any) => role.namespace === rbacBindingEditor.namespace)).map((role: any) => <Option key={role.name} value={role.name}>{role.name}</Option>)}</Dropdown></div></div><div style={{ display: 'grid', gap: '8px' }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><Label>Subjects</Label><span style={{ fontSize: '0.76rem', opacity: 0.65 }}>{rbacBindingEditor.subjects?.length || 0} assigned</span></div><div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '10px', minHeight: '42px', border: '1px solid var(--colorNeutralStroke1)', borderRadius: '8px' }}>{rbacBindingEditor.subjects?.map((subject: any, index: number) => <Badge key={`${subject.kind}-${subject.name}-${index}`} appearance="tint">{subject.kind}: {subject.name}{subject.namespace ? ` · ${subject.namespace}` : ''}<Button size="small" appearance="transparent" style={{ minWidth: '20px', marginLeft: '3px' }} onClick={() => setRbacBindingEditor({ ...rbacBindingEditor, subjects: rbacBindingEditor.subjects.filter((_: any, subjectIndex: number) => subjectIndex !== index) })}>×</Button></Badge>)}{!rbacBindingEditor.subjects?.length && <span style={{ opacity: 0.55, fontSize: '0.82rem' }}>No subjects assigned</span>}</div><div style={{ display: 'grid', gridTemplateColumns: '130px minmax(0, 1fr) 150px auto', gap: '8px' }}><Dropdown value={rbacSubjectDraft.kind} selectedOptions={[rbacSubjectDraft.kind]} onOptionSelect={(_, data) => setRbacSubjectDraft({ ...rbacSubjectDraft, kind: data.optionValue || 'ServiceAccount' })}><Option value="ServiceAccount">ServiceAccount</Option><Option value="User">User</Option><Option value="Group">Group</Option></Dropdown><Input placeholder="Name" value={rbacSubjectDraft.name} onChange={(_, data) => setRbacSubjectDraft({ ...rbacSubjectDraft, name: data.value })} /><Input placeholder="Namespace" value={rbacSubjectDraft.namespace} disabled={rbacSubjectDraft.kind !== 'ServiceAccount'} onChange={(_, data) => setRbacSubjectDraft({ ...rbacSubjectDraft, namespace: data.value })} /><Button appearance="secondary" disabled={!rbacSubjectDraft.name.trim()} onClick={() => { setRbacBindingEditor({ ...rbacBindingEditor, subjects: [...(rbacBindingEditor.subjects || []), { kind: rbacSubjectDraft.kind, name: rbacSubjectDraft.name.trim(), ...(rbacSubjectDraft.kind === 'ServiceAccount' && rbacSubjectDraft.namespace.trim() ? { namespace: rbacSubjectDraft.namespace.trim() } : {}) }] }); setRbacSubjectDraft({ kind: 'ServiceAccount', name: '', namespace: rbacBindingEditor.namespace || '' }); }}>Add</Button></div></div></div></DialogContent><DialogActions><Button appearance="subtle" onClick={() => setRbacBindingEditor(null)}>Cancel</Button><Button appearance="primary" onClick={saveRbacBinding} disabled={!rbacBindingEditor.roleName || !rbacBindingEditor.subjects?.length}>Save binding</Button></DialogActions></DialogBody></DialogSurface></Dialog>}
                  {rbacData?.permission_errors?.length > 0 && <Card style={{ backgroundColor: 'rgba(255, 77, 99, 0.08)', border: '1px solid rgba(255, 77, 99, 0.3)' }}><div style={{ padding: '14px' }}><Title3>Permission errors</Title3>{rbacData.permission_errors.map((error: any, index: number) => <div key={index} style={{ marginTop: '8px', fontSize: '0.82rem' }}><strong>{error.area}:</strong> {error.message}</div>)}</div></Card>}
                  {(() => { const highRisk = (rbacData?.effective_rules || []).filter((rule: any) => rule.verbs?.includes('*') || rule.resources?.includes('*') || (rule.resources || []).some((resource: string) => ['secrets', 'roles', 'rolebindings', 'clusterroles', 'clusterrolebindings'].includes(resource)) && (rule.verbs || []).some((verb: string) => ['create', 'update', 'patch', 'delete', '*'].includes(verb))); return <Card style={{ backgroundColor: highRisk.length ? 'rgba(255, 153, 0, 0.09)' : 'rgba(44, 197, 126, 0.07)', border: `1px solid ${highRisk.length ? 'rgba(255,153,0,0.3)' : 'rgba(44,197,126,0.24)'}` }}><div style={{ padding: '14px', display: 'flex', justifyContent: 'space-between', gap: '14px', alignItems: 'center' }}><div><Title3>{highRisk.length ? 'Elevated permissions detected' : 'No broad permission rules detected'}</Title3><div style={{ fontSize: '0.82rem', opacity: 0.72, marginTop: '4px' }}>{highRisk.length ? `${highRisk.length} effective rule${highRisk.length === 1 ? '' : 's'} can modify sensitive resources or grant broad access.` : 'The current identity has no wildcard or sensitive-resource write rules in this namespace review.'}</div></div><Badge color={highRisk.length ? 'warning' : 'success'} appearance="tint">{highRisk.length ? 'Review access' : 'Lower risk'}</Badge></div></Card>; })()}
                  <div className={styles.overviewGrid}>
                    <Card className={styles.metricCard}><Title3>Effective access</Title3><div style={{ fontSize: '0.8rem', opacity: 0.65 }}>SelfSubjectRulesReview in {rbacData?.namespace || 'default'}</div><div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>{rbacData?.effective_rules?.slice(0, 18).map((rule: any, index: number) => <Badge key={index} appearance="tint" color="brand">{rule.verbs.join(', ')} · {(rule.resources || ['*']).join(', ')}</Badge>)}{!rbacData?.effective_rules?.length && <span style={{ opacity: 0.6 }}>No rules returned or access denied.</span>}</div></Card>
                    <Card className={styles.metricCard}><Title3>RBAC inventory</Title3><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>{[['Service Accounts', rbacData?.service_accounts?.length], ['Roles', rbacData?.roles?.length], ['Cluster Roles', rbacData?.cluster_roles?.length], ['Bindings', (rbacData?.bindings?.length || 0) + (rbacData?.cluster_bindings?.length || 0)]].map(([label, count]) => <div key={label as string} style={{ padding: '10px', background: 'rgba(255,255,255,0.035)', borderRadius: '8px' }}><div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{count ?? 0}</div><div style={{ fontSize: '0.75rem', opacity: 0.65 }}>{label}</div></div>)}</div></Card>
                  </div>
                  <div className={styles.tableCard}><div style={{ padding: '14px' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><Title3>Service Accounts</Title3><Button size="small" appearance="secondary" icon={<Add20Regular />} onClick={createRbacServiceAccount}>Create</Button></div><div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>{rbacData?.service_accounts?.slice(0, 32).map((item: any) => <Button key={`${item.namespace}/${item.name}`} size="small" appearance="secondary" onClick={() => showServiceAccountAccess(item)}>{item.namespace}/{item.name}</Button>)}</div></div></div>
                  <div className={styles.tableCard}><div style={{ padding: '14px' }}><Title3>Role bindings</Title3><div style={{ fontSize: '0.78rem', opacity: 0.65, margin: '4px 0 8px' }}>Edit changes the bound role and subjects; removing a binding immediately revokes its access.</div>{[...(rbacData?.bindings || []), ...(rbacData?.cluster_bindings || [])].map((item: any) => <div key={`${item.namespace || 'cluster'}/${item.name}`} style={{ padding: '10px 0', borderBottom: '1px solid var(--colorNeutralStroke2)', fontSize: '0.82rem', display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center' }}><div><strong>{item.namespace ? `${item.namespace}/` : ''}{item.name}</strong> → <Badge appearance="tint">{item.role}</Badge><div style={{ opacity: 0.62, marginTop: '3px' }}>{item.subjects.join(', ') || 'No subjects'}</div></div><div style={{ display: 'flex', gap: '4px' }}><Button size="small" appearance="secondary" onClick={() => { setRbacSubjectDraft({ kind: 'ServiceAccount', name: '', namespace: item.namespace || '' }); setRbacBindingEditor({ ...item, cluster: !item.namespace, roleKind: item.role.split('/')[0], roleName: item.role.split('/')[1], subjects: item.subjects.map((subject: string) => { const [kind, name] = subject.split(':'); return { kind, name, ...(kind === 'ServiceAccount' && item.namespace ? { namespace: item.namespace } : {}) }; }) }); }}>Edit</Button><Button size="small" appearance="subtle" style={{ color: 'var(--colorPaletteRedForeground1)' }} onClick={() => deleteRbacBinding(item, !item.namespace)}>Remove</Button></div></div>)}</div></div>
                </div>
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
                                    {c.status === 'Healthy' ? <Badge color="success" appearance="outline">{c.status}</Badge> : <Tooltip relationship="description" content={<div style={{ maxWidth: '300px', lineHeight: 1.4 }}><strong>{c.name}</strong><br />{c.reason || 'The API server did not report a health reason.'}</div>}><Badge color="important" appearance="outline" style={{ cursor: 'help' }}>{c.status}</Badge></Tooltip>}
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
                    {visibleResources.map(renderResourceRow)}
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
                      resourceType={p.resourceType || 'pods'}
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
