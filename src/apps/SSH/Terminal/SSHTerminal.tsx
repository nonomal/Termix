import {useEffect, useRef, useState, useImperativeHandle, forwardRef} from 'react';
import {useXTerm} from 'react-xtermjs';
import {FitAddon} from '@xterm/addon-fit';
import {ClipboardAddon} from '@xterm/addon-clipboard';

interface SSHTerminalProps {
    hostConfig: any;
    isVisible: boolean;
    title?: string;
    showTitle?: boolean;
    splitScreen?: boolean;
}

export const SSHTerminal = forwardRef<any, SSHTerminalProps>(function SSHTerminal(
    {hostConfig, isVisible, splitScreen = false},
    ref
) {
    const {instance: terminal, ref: xtermRef} = useXTerm();
    const fitAddonRef = useRef<FitAddon | null>(null);
    const webSocketRef = useRef<WebSocket | null>(null);
    const resizeTimeout = useRef<NodeJS.Timeout | null>(null);
    const wasDisconnectedBySSH = useRef(false);
    const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const [visible, setVisible] = useState(false);

    useImperativeHandle(ref, () => ({
        disconnect: () => {
            if (pingIntervalRef.current) {
                clearInterval(pingIntervalRef.current);
                pingIntervalRef.current = null;
            }
            webSocketRef.current?.close();
        },
        fit: () => {
            fitAddonRef.current?.fit();
        },
        sendInput: (data: string) => {
            if (webSocketRef.current?.readyState === 1) {
                webSocketRef.current.send(JSON.stringify({type: 'input', data}));
            }
        }
    }), []);

    useEffect(() => {
        window.addEventListener('resize', handleWindowResize);
        return () => window.removeEventListener('resize', handleWindowResize);
    }, []);

    function handleWindowResize() {
        fitAddonRef.current?.fit();
    }

    useEffect(() => {
        if (!terminal || !xtermRef.current || !hostConfig) return;

        const fitAddon = new FitAddon();
        const clipboardAddon = new ClipboardAddon();

        fitAddonRef.current = fitAddon;
        terminal.loadAddon(fitAddon);
        terminal.loadAddon(clipboardAddon);
        terminal.open(xtermRef.current);

        terminal.options = {
            cursorBlink: true,
            cursorStyle: 'bar',
            scrollback: 5000,
            fontSize: 15,
            theme: {
                background: '#09090b',
                foreground: '#f7f7f7',
            },
        };

        const resizeObserver = new ResizeObserver(() => {
            if (resizeTimeout.current) clearTimeout(resizeTimeout.current);
            resizeTimeout.current = setTimeout(() => {
                fitAddonRef.current?.fit();
                const cols = terminal.cols + 1;
                const rows = terminal.rows;
                webSocketRef.current?.send(JSON.stringify({type: 'resize', data: {cols, rows}}));
            }, 100);
        });

        resizeObserver.observe(xtermRef.current);
        setTimeout(() => {
            fitAddon.fit();
            setVisible(true);

            const cols = terminal.cols + 1;
            const rows = terminal.rows;
            const wsUrl = window.location.hostname === 'localhost'
                ? 'ws://localhost:8082'
                : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ssh/websocket/`;

            const ws = new WebSocket(wsUrl);
            webSocketRef.current = ws;
            wasDisconnectedBySSH.current = false;

            ws.addEventListener('open', () => {
                ws.send(JSON.stringify({type: 'connectToHost', data: {cols, rows, hostConfig}}));
                terminal.onData((data) => {
                    ws.send(JSON.stringify({type: 'input', data}));
                });

                pingIntervalRef.current = setInterval(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({type: 'ping'}));
                    }
                }, 30000);
            });

            ws.addEventListener('message', (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    if (msg.type === 'data') terminal.write(msg.data);
                    else if (msg.type === 'error') terminal.writeln(`\r\n[ERROR] ${msg.message}`);
                    else if (msg.type === 'connected') {
                    } else if (msg.type === 'disconnected') {
                        wasDisconnectedBySSH.current = true;
                        terminal.writeln(`\r\n[${msg.message || 'Disconnected'}]`);
                    }
                } catch (_) {
                }
            });

            ws.addEventListener('close', () => {
                if (!wasDisconnectedBySSH.current) {
                    terminal.writeln('\r\n[Connection closed]');
                }
            });

            ws.addEventListener('error', () => {
                terminal.writeln('\r\n[Connection error]');
            });
        }, 300);

        return () => {
            resizeObserver.disconnect();
            if (resizeTimeout.current) clearTimeout(resizeTimeout.current);
            if (pingIntervalRef.current) {
                clearInterval(pingIntervalRef.current);
                pingIntervalRef.current = null;
            }
            webSocketRef.current?.close();
        };
    }, [xtermRef, terminal, hostConfig]);

    useEffect(() => {
        if (isVisible && fitAddonRef.current) {
            fitAddonRef.current.fit();
        }
    }, [isVisible]);

    return (
        <div
            ref={xtermRef}
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                marginLeft: 2,
                opacity: visible && isVisible ? 1 : 0,
                overflow: 'hidden',
            }}
        />
    );
});

const style = document.createElement('style');
style.innerHTML = `
.xterm .xterm-viewport::-webkit-scrollbar {
  width: 8px;
  background: transparent;
}
.xterm .xterm-viewport::-webkit-scrollbar-thumb {
  background: rgba(180,180,180,0.7);
  border-radius: 4px;
}
.xterm .xterm-viewport::-webkit-scrollbar-thumb:hover {
  background: rgba(120,120,120,0.9);
}
.xterm .xterm-viewport {
  scrollbar-width: thin;
  scrollbar-color: rgba(180,180,180,0.7) transparent;
}
`;
document.head.appendChild(style);
