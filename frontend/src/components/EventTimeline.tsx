import { Badge } from '@fluentui/react-components';

export interface KubernetesEvent { type: string; reason: string; message: string; first_timestamp?: string; last_timestamp?: string; count?: number; object_name?: string; object_kind?: string; namespace?: string; }

const time = (event: KubernetesEvent) => new Date(event.last_timestamp || event.first_timestamp || 0).getTime();
const color = (event: KubernetesEvent) => event.type === 'Warning' ? '#ff526f' : event.reason.toLowerCase().includes('created') ? '#53d58a' : '#4b88ff';

export const EventTimeline = ({ events, emptyLabel = 'No events recorded.' }: { events: KubernetesEvent[]; emptyLabel?: string }) => {
  if (!events.length) return <div style={{ textAlign: 'center', padding: '48px 16px', opacity: 0.65 }}>{emptyLabel}</div>;
  const sorted = [...events].sort((a, b) => time(a) - time(b));
  const times = sorted.map(time).filter(Boolean);
  const start = Math.min(...times), range = Math.max(Math.max(...times) - start, 60_000);
  const groups = Object.values(sorted.reduce<Record<string, KubernetesEvent[]>>((all, event) => { const key = event.object_name ? `${event.object_kind || 'Resource'}:${event.object_name}` : 'Resource events'; (all[key] ||= []).push(event); return all; }, {}));
  const ticks = Array.from({ length: 5 }, (_, index) => new Date(start + range * index / 4));
  const warnings = events.filter(event => event.type === 'Warning').length;

  return <div style={{ display: 'grid', gap: '14px' }}><div style={{ overflowX: 'auto', border: '1px solid var(--colorNeutralStroke1)', borderRadius: '12px', background: 'rgba(8, 10, 16, 0.36)' }}>
    <div style={{ minWidth: '680px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid var(--colorNeutralStroke1)', fontSize: '0.78rem' }}>
        <div style={{ display: 'flex', gap: '12px' }}><span>● Normal</span><span style={{ color: '#ff8697' }}>● Warning</span><span style={{ opacity: 0.65 }}>{events.length} events · {groups.length} resources</span></div>
        {warnings > 0 && <Badge color="warning" appearance="tint">{warnings} warnings</Badge>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '210px minmax(470px, 1fr)', borderBottom: '1px solid var(--colorNeutralStroke1)' }}>
        <div style={{ padding: '12px 14px', fontWeight: 650, fontSize: '0.8rem', borderRight: '1px solid var(--colorNeutralStroke1)' }}>Resource</div>
        <div style={{ position: 'relative', height: '40px' }}>{ticks.map((tick, index) => <span key={index} style={{ position: 'absolute', left: `${index * 25}%`, transform: index ? 'translateX(-50%)' : 'none', top: '11px', fontSize: '0.74rem', opacity: 0.68 }}>{tick.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>)}</div>
      </div>
      {groups.map((group, row) => {
        const first = group[0];
        return <div key={`${first.object_name}-${row}`} style={{ display: 'grid', gridTemplateColumns: '210px minmax(470px, 1fr)', minHeight: '82px', borderBottom: row < groups.length - 1 ? '1px solid var(--colorNeutralStroke2)' : 'none' }}>
          <div style={{ padding: '14px', borderRight: '1px solid var(--colorNeutralStroke1)', overflow: 'hidden' }}><Badge appearance="tint" color="brand">{first.object_kind || 'Resource'}</Badge><div style={{ marginTop: '6px', fontWeight: 650, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{first.object_name || 'Resource events'}</div><div style={{ fontSize: '0.72rem', opacity: 0.62 }}>{first.namespace || ''}</div></div>
          <div style={{ position: 'relative', backgroundImage: 'linear-gradient(to right, rgba(174,189,255,0.08) 1px, transparent 1px)', backgroundSize: '25% 100%' }}>{group.map((event, index) => { const left = Math.max(1, Math.min(98, ((time(event) - start) / range) * 100)); const marker = color(event); return <button key={`${event.reason}-${index}`} title={`${event.reason}: ${event.message}\n${event.last_timestamp ? new Date(event.last_timestamp).toLocaleString() : ''}`} style={{ position: 'absolute', left: `${left}%`, top: `${31 + index % 2 * 20}px`, width: event.type === 'Warning' ? '16px' : '12px', height: event.type === 'Warning' ? '16px' : '12px', transform: 'translate(-50%, -50%)', borderRadius: '50%', border: '2px solid var(--colorNeutralBackground2)', background: marker, boxShadow: `0 0 0 3px ${marker}33`, cursor: 'pointer', padding: 0 }} />; })}</div>
        </div>;
      })}
    </div>
  </div><div style={{ overflowX: 'auto', border: '1px solid var(--colorNeutralStroke1)', borderRadius: '12px', background: 'rgba(8, 10, 16, 0.24)' }}><div style={{ padding: '12px 14px', borderBottom: '1px solid var(--colorNeutralStroke1)', fontSize: '0.84rem', fontWeight: 650 }}>Event history</div><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}><thead><tr style={{ textAlign: 'left', color: 'var(--colorNeutralForeground3)' }}><th style={{ padding: '10px 14px', fontWeight: 500 }}>Time</th><th style={{ padding: '10px 14px', fontWeight: 500 }}>Type</th><th style={{ padding: '10px 14px', fontWeight: 500 }}>Reason</th><th style={{ padding: '10px 14px', fontWeight: 500 }}>Message</th><th style={{ padding: '10px 14px', fontWeight: 500 }}>Count</th></tr></thead><tbody>{sorted.map((event, index) => <tr key={`${event.object_name}-${event.reason}-${index}`} style={{ borderTop: '1px solid var(--colorNeutralStroke2)' }}><td style={{ padding: '10px 14px', whiteSpace: 'nowrap', opacity: 0.75 }}>{event.last_timestamp || event.first_timestamp ? new Date(event.last_timestamp || event.first_timestamp || '').toLocaleString() : '—'}</td><td style={{ padding: '10px 14px' }}><Badge color={event.type === 'Warning' ? 'warning' : 'informative'} appearance="tint">{event.type}</Badge></td><td style={{ padding: '10px 14px', fontWeight: 600 }}>{event.reason}</td><td style={{ padding: '10px 14px', minWidth: '320px', lineHeight: 1.45 }}>{event.message || '—'}</td><td style={{ padding: '10px 14px' }}>{event.count || 1}</td></tr>)}</tbody></table></div></div>;
};
