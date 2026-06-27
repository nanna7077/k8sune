import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { getBackendPort } from '../utils/api';

interface ShellTerminalProps {
  context: string;
  namespace: string;
  pod: string;
  container: string;
}

export const ShellTerminal = ({ context, namespace, pod, container }: ShellTerminalProps) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#000000',
        foreground: '#ffffff',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;

    const connect = async () => {
      const port = await getBackendPort();
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${protocol}//127.0.0.1:${port}/api/ws/exec/${context}/${namespace}/${pod}/${container}`;
      
      const socket = new WebSocket(url);
      socketRef.current = socket;

      socket.onopen = () => {
        term.writeln('\x1b[1;32m[Connected to container]\x1b[0m');
      };

      socket.onmessage = (event) => {
        term.write(event.data);
      };

      socket.onclose = () => {
        term.writeln('\r\n\x1b[1;31m[Session disconnected]\x1b[0m');
      };

      term.onData((data) => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(data);
        }
      });
    };

    connect();

    const handleResize = () => {
      fitAddon.fit();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      socketRef.current?.close();
      term.dispose();
    };
  }, [context, namespace, pod, container]);

  return (
    <div style={{ height: '100%', width: '100%', backgroundColor: '#000', padding: '8px', boxSizing: 'border-box' }}>
      <div ref={terminalRef} style={{ height: '100%', width: '100%' }} />
    </div>
  );
};
