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
    backgroundColor: 'rgba(13, 14, 19, 0.9)',
    backdropFilter: 'blur(18px)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    userSelect: 'none',
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    ...shorthands.borderBottom('1px', 'solid', 'rgba(171, 183, 220, 0.1)'),
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
    fontSize: '11px',
    fontWeight: '650',
    letterSpacing: '0.04em',
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
      backgroundColor: 'rgba(174, 189, 255, 0.1)',
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

  const handleMouseDown = async (e: React.MouseEvent) => {
    if (e.buttons === 1) {
      if (e.detail === 2) {
        try {
          await getCurrentWindow().toggleMaximize();
        } catch (err) {
          console.error("Maximize failed", err);
        }
      } else {
        try {
          await getCurrentWindow().startDragging();
        } catch (err) {
          console.error("Drag failed", err);
        }
      }
    }
  };

  return (
    <div 
      className={styles.titlebar}
      onMouseDown={handleMouseDown}
    >
      <div className={styles.dragRegion}>
        <span className={styles.title} style={{ pointerEvents: 'none' }}>{title}</span>
      </div>
      <div 
        className={styles.controls} 
        onMouseDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
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
