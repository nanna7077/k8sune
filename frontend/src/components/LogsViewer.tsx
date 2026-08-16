import { useEffect, useState, useRef } from 'react';
import { 
  makeStyles, 
  shorthands, 
  Button,
  Select
} from "@fluentui/react-components";
import { ArrowDownload20Regular } from '@fluentui/react-icons';
import { getBackendPort } from '../utils/api';
import { apiFetch } from '../utils/api';
import { useFeedbackDialog } from './FeedbackDialog';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    width: '100%',
    backgroundColor: '#09090b',
    color: '#a1a1aa',
    ...shorthands.padding('1.25rem'),
    boxSizing: 'border-box',
    fontFamily: 'var(--fontFamilyMonospace)'
  },
  header: {
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    marginBottom: '1rem',
    gap: '1rem'
  },
  titleGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    flexShrink: 0
  },
  title: {
    fontSize: '0.9rem',
    fontWeight: '600',
    color: 'var(--colorBrandForeground1)'
  },
  subtitle: {
    fontSize: '0.75rem',
    opacity: 0.6,
    color: 'var(--colorNeutralForeground3)'
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem'
  },
  logArea: {
    flexGrow: 1,
    backgroundColor: '#000',
    ...shorthands.border('1px', 'solid', 'var(--colorNeutralStroke1)'),
    ...shorthands.padding('1rem'),
    ...shorthands.borderRadius('6px'),
    overflowY: 'auto',
    whiteSpace: 'pre-wrap',
    fontSize: '0.85rem',
    lineHeight: '1.4',
    color: '#10b981', // Emerald green
  }
});

const timeframes = [
  { label: 'Live', value: '0' },
  { label: 'Last 5m', value: '300' },
  { label: 'Last 15m', value: '900' },
  { label: 'Last 1h', value: '3600' },
  { label: 'Last 6h', value: '21600' },
  { label: 'Last 24h', value: '86400' },
];

export const LogsViewer = ({ context, namespace, pod }: { context: string, namespace: string, pod: string }) => {
  const styles = useStyles();
  const feedback = useFeedbackDialog();
  const [logs, setLogs] = useState<string[]>([]);
  const [timeframe, setTimeframe] = useState('0');
  const [logSource, setLogSource] = useState<'current' | 'previous'>('current');
  const [containers, setContainers] = useState<string[]>([]);
  const [container, setContainer] = useState('');
  const logAreaRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const startStreaming = async (seconds: string, source: 'current' | 'previous') => {
    if (eventSourceRef.current) eventSourceRef.current.close();
    setLogs([]);
    
    const port = await getBackendPort();
    const params = new URLSearchParams();
    if (seconds !== '0') {
      params.set('since_seconds', seconds);
    }
    if (source === 'previous') params.set('previous', 'true');
    if (container) params.set('container', container);
    const query = params.toString();
    const url = `http://127.0.0.1:${port}/api/logs/${context}/${namespace}/${pod}${query ? `?${query}` : ''}`;
    
    const es = new EventSource(url);
    es.onmessage = (event) => {
      setLogs(prev => [...prev, event.data]);
    };
    es.onerror = (e) => {
      console.error("Log stream error:", e);
      es.close();
    };
    eventSourceRef.current = es;
  };

  useEffect(() => {
    apiFetch<any>(`/api/resources/${encodeURIComponent(context)}/pods/${encodeURIComponent(namespace)}/${encodeURIComponent(pod)}`).then(data => {
      const names = (data.spec?.containers || []).map((item: any) => item.name);
      setContainers(names); setContainer(current => current || names[0] || '');
    }).catch(error => feedback.notice('Could not load Pod containers', String(error), 'warning'));
  }, [context, namespace, pod]);

  useEffect(() => {
    startStreaming(timeframe, logSource);
    return () => {
      if (eventSourceRef.current) eventSourceRef.current.close();
    };
  }, [context, namespace, pod, timeframe, logSource, container]);

  useEffect(() => {
    if (logAreaRef.current) {
      logAreaRef.current.scrollTop = logAreaRef.current.scrollHeight;
    }
  }, [logs]);

  const handleDownload = async () => {
    try {
      const filePath = await save({
        filters: [{ name: 'Text', extensions: ['txt', 'log'] }],
        defaultPath: `${pod}_logs.txt`
      });

      if (filePath) {
        await writeTextFile(filePath, logs.join('\n'));
      }
    } catch (e) {
      feedback.notice('Could not save logs', String(e), 'error');
    }
  };

  return (
    <div className={styles.container}>
      {feedback.dialog}
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <div className={styles.title}>Logs: {pod}</div>
          <div className={styles.subtitle}>{namespace} • {context}</div>
        </div>
        
        <div className={styles.controls}>
          {containers.length > 1 && <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span style={{ fontSize: '0.75rem', opacity: 0.6 }}>Container:</span><Select size="small" value={container} onChange={event => setContainer(event.target.value)}>{containers.map(name => <option key={name} value={name}>{name}</option>)}</Select></div>}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>Source:</span>
            <Select size="small" value={logSource} onChange={(e) => setLogSource(e.target.value as 'current' | 'previous')}>
              <option value="current">Current container</option>
              <option value="previous">Previous container</option>
            </Select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>Time:</span>
            <Select 
              size="small" 
              value={timeframe} 
              onChange={(e) => setTimeframe(e.target.value)}
            >
              {timeframes.map(tf => (
                <option key={tf.value} value={tf.value}>{tf.label}</option>
              ))}
            </Select>
          </div>
          
          <Button 
            size="small" 
            icon={<ArrowDownload20Regular />} 
            onClick={handleDownload}
          >
            Download
          </Button>
          
          <Button size="small" appearance="subtle" onClick={() => setLogs([])}>Clear</Button>
        </div>
      </div>
      <div className={styles.logArea} ref={logAreaRef}>
        {logs.length === 0 ? <div style={{ opacity: 0.4 }}>{logSource === 'previous' ? 'Loading previous container logs...' : 'Waiting for logs...'}</div> : logs.map((log, i) => (
          <div key={i}>{log}</div>
        ))}
      </div>
    </div>
  );
};
