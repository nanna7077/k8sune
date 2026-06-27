import { getCurrentWindow } from '@tauri-apps/api/window';
import { makeStyles, shorthands } from "@fluentui/react-components";
import { 
  Dismiss20Regular, 
  Square20Regular, 
  Subtract20Regular 
} from '@fluentui/react-icons';

const useStyles = makeStyles({
  titlebar: {
    height: '32px',
    backgroundColor: 'var(--colorNeutralBackground2)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    userSelect: 'none',
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    ...shorthands.borderBottom('1px', 'solid', 'var(--colorNeutralStroke1)'),
  },
  dragRegion: {
    flex: 1,
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    ...shorthands.padding('0', '12px'),
    cursor: 'default',
  },
  title: {
    fontSize: '12px',
    fontWeight: '600',
    color: 'var(--colorNeutralForeground3)',
  },
  controls: {
    display: 'flex',
    height: '100%',
  },
  controlButton: {
    width: '46px',
    height: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    transition: 'background-color 0.2s',
    ...shorthands.borderRadius(0),
    ...shorthands.border('none'),
    backgroundColor: 'transparent',
    color: 'var(--colorNeutralForeground1)',
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: 'var(--colorNeutralBackground3)',
    }
  },
  closeButton: {
    '&:hover': {
      backgroundColor: '#c42b1c',
      color: '#fff',
    }
  }
});

export const TitleBar = ({ title = "k8sune" }: { title?: string }) => {
  const styles = useStyles();

  const handleMinimize = async () => {
    try {
      await getCurrentWindow().minimize();
    } catch (e) {
      console.error(e);
    }
  };
  
  const handleMaximize = async () => {
    try {
      await getCurrentWindow().toggleMaximize();
    } catch (e) {
      console.error("Maximize failed", e);
    }
  };
  
  const handleClose = async () => {
    try {
      await getCurrentWindow().close();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDrag = () => {
    try {
      getCurrentWindow().startDragging();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div 
      className={styles.titlebar}
      onDoubleClick={handleMaximize}
    >
      <div 
        className={styles.dragRegion}
        onMouseDown={(e) => {
          if (e.buttons === 1) handleDrag();
        }}
      >
        <span className={styles.title} style={{ pointerEvents: 'none' }}>{title}</span>
      </div>
      <div className={styles.controls} onDoubleClick={(e) => e.stopPropagation()}>
        <div className={styles.controlButton} onClick={handleMinimize}>
          <Subtract20Regular />
        </div>
        <div className={styles.controlButton} onClick={handleMaximize}>
          <Square20Regular />
        </div>
        <div className={`${styles.controlButton} ${styles.closeButton}`} onClick={handleClose}>
          <Dismiss20Regular />
        </div>
      </div>
    </div>
  );
};
