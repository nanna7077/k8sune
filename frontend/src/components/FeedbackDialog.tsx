import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Input,
} from '@fluentui/react-components';
import { CheckmarkCircle20Regular, ErrorCircle20Regular, Info20Regular, Warning20Regular } from '@fluentui/react-icons';

type Tone = 'success' | 'error' | 'info' | 'warning';
type Request = {
  kind: 'notice' | 'confirm' | 'prompt';
  title: string;
  message: string;
  tone: Tone;
  confirmLabel?: string;
  destructive?: boolean;
  defaultValue?: string;
  resolve?: (value: boolean | string | null) => void;
};

const toneIcon = {
  success: <CheckmarkCircle20Regular color="#5ed6a0" />,
  error: <ErrorCircle20Regular color="#ff9ca8" />,
  info: <Info20Regular color="var(--colorBrandForeground1)" />,
  warning: <Warning20Regular color="#ffc875" />,
};

export const useFeedbackDialog = () => {
  const [request, setRequest] = useState<Request | null>(null);
  const [inputValue, setInputValue] = useState('');

  const notice = (title: string, message: string, tone: Tone = 'info') => setRequest({ kind: 'notice', title, message, tone });

  const confirm = (title: string, message: string, options: { confirmLabel?: string; destructive?: boolean } = {}) =>
    new Promise<boolean>(resolve => setRequest({
      kind: 'confirm', title, message, tone: options.destructive ? 'warning' : 'info',
      resolve: value => resolve(value === true), ...options,
    }));

  const prompt = (title: string, message: string, defaultValue = '') =>
    new Promise<string | null>(resolve => {
      setInputValue(defaultValue);
      setRequest({ kind: 'prompt', title, message, tone: 'info', resolve: value => resolve(typeof value === 'string' ? value : null), defaultValue });
    });

  const close = (value: boolean | string | null = null) => {
    request?.resolve?.(value);
    setRequest(null);
  };

  const dialog = request && (
    <Dialog open onOpenChange={(_, data) => !data.open && close(request.kind === 'confirm' ? false : null)}>
      <DialogSurface style={{ maxWidth: '440px' }}>
        <DialogBody>
          <DialogTitle>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>{toneIcon[request.tone]}{request.title}</span>
          </DialogTitle>
          <DialogContent>
            <p style={{ whiteSpace: 'pre-wrap', color: 'var(--colorNeutralForeground2)' }}>{request.message}</p>
            {request.kind === 'prompt' && (
              <Input
                autoFocus
                value={inputValue}
                onChange={(_, data) => setInputValue(data.value)}
                onKeyDown={event => { if (event.key === 'Enter') close(inputValue); }}
                style={{ width: '100%', marginTop: '16px' }}
              />
            )}
          </DialogContent>
          <DialogActions>
            {request.kind === 'notice' ? (
              <Button appearance="primary" onClick={() => close()}>Close</Button>
            ) : (
              <>
                <Button appearance="subtle" onClick={() => close(request.kind === 'confirm' ? false : null)}>Cancel</Button>
                <Button appearance={request.destructive ? 'secondary' : 'primary'} onClick={() => close(request.kind === 'prompt' ? inputValue : true)}>
                  {request.confirmLabel || 'Continue'}
                </Button>
              </>
            )}
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );

  return { dialog, notice, confirm, prompt };
};
