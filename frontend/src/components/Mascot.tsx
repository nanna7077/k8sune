import { useStore } from '../store/useStore';

export const Mascot = () => {
  const status = useStore((state) => state.status);
  
  const getSprite = () => {
    switch (status) {
      case 'loading':
        return '/sprites/k8sune-think.png';
      case 'connecting':
        return '/sprites/k8sune-run.png';
      case 'error':
        return '/sprites/k8sune-confused.png';
      case 'success':
        return '/sprites/k8sune-wave.png';
      case 'idle':
      default:
        return '/sprites/k8sune-icon.png';
    }
  };

  const getLabel = () => {
    switch (status) {
      case 'loading':
        return 'Analyzing...';
      case 'connecting':
        return 'Connecting to cluster...';
      case 'error':
        return 'Something went wrong';
      case 'success':
        return 'Cluster Ready!';
      case 'idle':
        return 'Welcome!';
      default:
        return 'k8sune';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
      <img 
        src={getSprite()} 
        alt="k8sune" 
        style={{ width: '150px', height: 'auto', transition: 'transform 0.3s' }}
      />
      <span style={{ fontSize: '1rem', color: '#ffb6c1', fontWeight: 'bold' }}>
        {getLabel()}
      </span>
    </div>
  );
};
