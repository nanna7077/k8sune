import { getCurrentWindow } from '@tauri-apps/api/window';
import { makeStyles } from "@fluentui/react-components";

type ResizeDirection = 'East' | 'North' | 'NorthEast' | 'NorthWest' | 'South' | 'SouthEast' | 'SouthWest' | 'West';

const useStyles = makeStyles({
  resizerTop: {
    position: 'fixed',
    top: 0,
    left: '6px',
    right: '6px',
    height: '6px',
    cursor: 'ns-resize',
    zIndex: 9999,
  },
  resizerBottom: {
    position: 'fixed',
    bottom: 0,
    left: '6px',
    right: '6px',
    height: '6px',
    cursor: 'ns-resize',
    zIndex: 9999,
  },
  resizerLeft: {
    position: 'fixed',
    left: 0,
    top: '6px',
    bottom: '6px',
    width: '6px',
    cursor: 'ew-resize',
    zIndex: 9999,
  },
  resizerRight: {
    position: 'fixed',
    right: 0,
    top: '6px',
    bottom: '6px',
    width: '6px',
    cursor: 'ew-resize',
    zIndex: 9999,
  },
  resizerTopLeft: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '8px',
    height: '8px',
    cursor: 'nwse-resize',
    zIndex: 10000,
  },
  resizerTopRight: {
    position: 'fixed',
    top: 0,
    right: 0,
    width: '8px',
    height: '8px',
    cursor: 'nesw-resize',
    zIndex: 10000,
  },
  resizerBottomLeft: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    width: '8px',
    height: '8px',
    cursor: 'nesw-resize',
    zIndex: 10000,
  },
  resizerBottomRight: {
    position: 'fixed',
    bottom: 0,
    right: 0,
    width: '8px',
    height: '8px',
    cursor: 'nwse-resize',
    zIndex: 10000,
  },
});

export const WindowResizer = () => {
  const styles = useStyles();

  const handleMouseDown = (e: React.MouseEvent, direction: ResizeDirection) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      getCurrentWindow().startResizeDragging(direction);
    } catch (err) {
      console.error('Failed to start resize dragging:', err);
    }
  };

  return (
    <>
      <div className={styles.resizerTop} onMouseDown={(e) => handleMouseDown(e, 'North')} />
      <div className={styles.resizerBottom} onMouseDown={(e) => handleMouseDown(e, 'South')} />
      <div className={styles.resizerLeft} onMouseDown={(e) => handleMouseDown(e, 'West')} />
      <div className={styles.resizerRight} onMouseDown={(e) => handleMouseDown(e, 'East')} />
      <div className={styles.resizerTopLeft} onMouseDown={(e) => handleMouseDown(e, 'NorthWest')} />
      <div className={styles.resizerTopRight} onMouseDown={(e) => handleMouseDown(e, 'NorthEast')} />
      <div className={styles.resizerBottomLeft} onMouseDown={(e) => handleMouseDown(e, 'SouthWest')} />
      <div className={styles.resizerBottomRight} onMouseDown={(e) => handleMouseDown(e, 'SouthEast')} />
    </>
  );
};
