import { useEffect, useState } from 'react';
import Editor, { DiffEditor } from '@monaco-editor/react';
import { 
  makeStyles, 
  shorthands, 
  Button,
  Spinner
} from "@fluentui/react-components";
import { Save20Regular, ArrowSync20Regular, EyeOff20Regular, Eye20Regular } from '@fluentui/react-icons';
import { apiFetch } from '../utils/api';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    width: '100%',
    backgroundColor: '#09090b',
    color: 'var(--colorNeutralForeground1)',
    ...shorthands.padding('1.25rem'),
    boxSizing: 'border-box'
  },
  header: {
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    marginBottom: '1rem'
  },
  titleGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px'
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
  editorArea: {
    flexGrow: 1,
    ...shorthands.border('1px', 'solid', 'var(--colorNeutralStroke1)'),
    ...shorthands.borderRadius('6px'),
    overflow: 'hidden'
  }
});

export const YamlEditor = ({ context, namespace, name, resourceType }: { 
  context: string, 
  namespace: string, 
  name: string,
  resourceType: string 
}) => {
  const styles = useStyles();
  const [yamlContent, setYamlContent] = useState<string>('');
  const [originalYaml, setOriginalYaml] = useState<string>('');
  const [showDiff, setShowDiff] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadYaml = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ yaml: string }>(`/api/yaml/${context}/${resourceType}/${namespace}/${name}`);
      setYamlContent(data.yaml);
      setOriginalYaml(data.yaml);
    } catch (e) {
      alert(`Error loading YAML: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  const saveYaml = async () => {
    setSaving(true);
    try {
      await apiFetch(`/api/yaml/${context}/${resourceType}/${namespace}/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yaml_content: yamlContent })
      });
      setOriginalYaml(yamlContent);
      setShowDiff(false);
      alert('Successfully applied YAML');
    } catch (e) {
      alert(`Error applying YAML: ${e}`);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    loadYaml();
  }, [context, namespace, name, resourceType]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <div className={styles.title}>Edit: {name}</div>
          <div className={styles.subtitle}>{resourceType} • {namespace} • {context}</div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button 
            size="small" 
            icon={showDiff ? <EyeOff20Regular /> : <Eye20Regular />} 
            onClick={() => setShowDiff(!showDiff)}
            disabled={loading}
          >
            {showDiff ? 'Hide Diff' : 'Show Diff'}
          </Button>
          <Button size="small" icon={<ArrowSync20Regular />} onClick={loadYaml} disabled={loading || saving}>Reload</Button>
          <Button size="small" icon={<Save20Regular />} appearance="primary" onClick={saveYaml} disabled={loading || saving}>
            {saving ? 'Applying...' : 'Apply Changes'}
          </Button>
        </div>
      </div>
      
      {loading ? (
        <Spinner label="Loading resource YAML..." style={{ marginTop: '2rem' }} />
      ) : (
        <div className={styles.editorArea}>
          {showDiff ? (
            <DiffEditor
              height="100%"
              language="yaml"
              theme="vs-dark"
              original={originalYaml}
              modified={yamlContent}
              options={{
                renderSideBySide: true,
                minimap: { enabled: false },
                fontSize: 13,
                scrollBeyondLastLine: false,
                readOnly: false,
                originalEditable: false
              }}
            />
          ) : (
            <Editor
              height="100%"
              defaultLanguage="yaml"
              theme="vs-dark"
              value={yamlContent}
              onChange={(v) => setYamlContent(v || '')}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                formatOnPaste: true,
                scrollBeyondLastLine: false,
                padding: { top: 10, bottom: 10 }
              }}
            />
          )}
        </div>
      )}
    </div>
  );
};
