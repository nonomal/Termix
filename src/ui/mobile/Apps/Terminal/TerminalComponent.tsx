import {useEffect, useRef, useState, useImperativeHandle, forwardRef} from 'react';
import {useXTerm} from 'react-xtermjs';
import {FitAddon} from '@xterm/addon-fit';
import {ClipboardAddon} from '@xterm/addon-clipboard';
import {Unicode11Addon} from '@xterm/addon-unicode11';
import {WebLinksAddon} from '@xterm/addon-web-links';

interface SSHTerminalProps {
    hostConfig: any;
    isVisible?: boolean;
}

export const TerminalComponent = forwardRef<any, SSHTerminalProps>(function SSHTerminal(
    {hostConfig, isVisible = true},
    ref
) {
    const {instance: terminal, ref: xtermRef} = useXTerm();
    const fitAddonRef = useRef<FitAddon | null>(null);
    const webSocketRef = useRef<WebSocket | null>(null);
    const resizeTimeout = useRef<NodeJS.Timeout | null>(null);
    const wasDisconnectedBySSH = useRef(false);
    const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const [visible, setVisible] = useState(false);
    const isVisibleRef = useRef<boolean>(false);

    const lastSentSizeRef = useRef<{ cols: number; rows: number } | null>(null);
    const pendingSizeRef = useRef<{ cols: number; rows: number } | null>(null);
    const notifyTimerRef = useRef<NodeJS.Timeout | null>(null);
    const DEBOUNCE_MS = 140;

    useEffect(() => {
        isVisibleRef.current = isVisible;
    }, [isVisible]);

    function hardRefresh() {
        try {
            if (terminal && typeof (terminal as any).refresh === 'function') {
                (terminal as any).refresh(0, terminal.rows - 1);
            }
        } catch (_) {
        }
    }

    function scheduleNotify(cols: number, rows: number) {
        if (!(cols > 0 && rows > 0)) return;
        pendingSizeRef.current = {cols, rows};
        if (notifyTimerRef.current) clearTimeout(notifyTimerRef.current);
        notifyTimerRef.current = setTimeout(() => {
            const next = pendingSizeRef.current;
            const last = lastSentSizeRef.current;
            if (!next) return;
            if (last && last.cols === next.cols && last.rows === next.rows) return;
            if (webSocketRef.current?.readyState === WebSocket.OPEN) {
                webSocketRef.current.send(JSON.stringify({type: 'resize', data: next}));
                lastSentSizeRef.current = next;
            }
        }, DEBOUNCE_MS);
    }

    useImperativeHandle(ref, () => ({
        disconnect: () => {
            if (pingIntervalRef.current) {
                clearInterval(pingIntervalRef.current);
                pingIntervalRef.current = null;
            }
            webSocketRef.current?.close();
        },
        fit: () => {
            if (!isVisibleRef.current) return;
            fitAddonRef.current?.fit();
            if (terminal) scheduleNotify(terminal.cols, terminal.rows);
            hardRefresh();
        },
        sendInput: (data: string) => {
            if (webSocketRef.current?.readyState === 1) {
                webSocketRef.current.send(JSON.stringify({type: 'input', data}));
            }
        },
        notifyResize: () => {
            if (!isVisibleRef.current) return;
            try {
                const cols = terminal?.cols ?? undefined;
                const rows = terminal?.rows ?? undefined;
                if (typeof cols === 'number' && typeof rows === 'number') {
                    scheduleNotify(cols, rows);
                    hardRefresh();
                }
            } catch (_) {
            }
        },
        refresh: () => {
            if (!isVisibleRef.current) return;
            hardRefresh();
        },
    }), [terminal]);

    useEffect(() => {
        const handleWindowResize = () => {
            if (!isVisibleRef.current) return;
            if (fitAddonRef.current && terminal) {
                fitAddonRef.current.fit();
                scheduleNotify(terminal.cols, terminal.rows);
                hardRefresh();
            }
        };

        window.addEventListener('resize', handleWindowResize);
        return () => window.removeEventListener('resize', handleWindowResize);
    }, [terminal]);

    useEffect(() => {
        if (!terminal || !xtermRef.current || !hostConfig) return;

        terminal.options = {
            cursorBlink: true,
            cursorStyle: 'bar',
            scrollback: 5000,
            fontSize: 16,
            fontFamily: '"JetBrains Mono Nerd Font", "MesloLGS NF", "FiraCode Nerd Font", "Cascadia Code", "JetBrains Mono", Consolas, "Courier New", monospace',
            theme: {background: '#18181b', foreground: '#f7f7f7'},
            allowTransparency: true,
            convertEol: true,
            macOptionIsMeta: false,
            macOptionClickForcesSelection: false,
            fastScrollModifier: 'alt',
            fastScrollSensitivity: 5,
            allowProposedApi: true,
            rightClickSelectsWord: true,
        };

        const fitAddon = new FitAddon();
        const clipboardAddon = new ClipboardAddon();
        const unicode11Addon = new Unicode11Addon();
        const webLinksAddon = new WebLinksAddon();

        fitAddonRef.current = fitAddon;
        terminal.loadAddon(fitAddon);
        terminal.loadAddon(clipboardAddon);
        terminal.loadAddon(unicode11Addon);
        terminal.loadAddon(webLinksAddon);

        terminal.open(xtermRef.current);

        const resizeObserver = new ResizeObserver(() => {
            if (resizeTimeout.current) clearTimeout(resizeTimeout.current);
            resizeTimeout.current = setTimeout(() => {
                if (!isVisibleRef.current) return;
                if (fitAddonRef.current && terminal) {
                    fitAddonRef.current.fit();
                    scheduleNotify(terminal.cols, terminal.rows);
                    hardRefresh();
                }
            }, 100);
        });

        if (xtermRef.current) {
            resizeObserver.observe(xtermRef.current);
        }

        const readyFonts = (document as any).fonts?.ready instanceof Promise ? (document as any).fonts.ready : Promise.resolve();
        readyFonts.then(() => {
            setTimeout(() => {
                if (fitAddonRef.current && terminal) {
                    fitAddonRef.current.fit();
                    setTimeout(() => {
                        if (fitAddonRef.current && terminal) {
                            fitAddonRef.current.fit();
                            scheduleNotify(terminal.cols, terminal.rows);
                            hardRefresh();
                        }

                        if (terminal) {
                            const cols = terminal.cols;
                            const rows = terminal.rows;
                            const wsUrl = window.location.hostname === 'localhost' ? 'ws://localhost:8082' : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ssh/websocket/`;

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
                                        // Terminal is connected
                                    } else if (msg.type === 'disconnected') {
                                        wasDisconnectedBySSH.current = true;
                                        terminal.writeln(`\r\n[${msg.message || 'Disconnected'}]`);
                                    }
                                } catch (error) {
                                    console.error('Error parsing WebSocket message:', error);
                                }
                            });

                            ws.addEventListener('close', () => {
                                if (!wasDisconnectedBySSH.current) terminal.writeln('\r\n[Connection closed]');
                            });
                            ws.addEventListener('error', () => {
                                terminal.writeln('\r\n[Connection error]');
                            });
                        }
                    }, 50);
                }

                setVisible(true);
            }, 300);
        });

        return () => {
            resizeObserver.disconnect();
            if (notifyTimerRef.current) clearTimeout(notifyTimerRef.current);
            if (resizeTimeout.current) clearTimeout(resizeTimeout.current);
            if (pingIntervalRef.current) {
                clearInterval(pingIntervalRef.current);
                pingIntervalRef.current = null;
            }
            webSocketRef.current?.close();
        };
    }, [xtermRef, terminal, hostConfig]);

    // Handle visibility changes with debounced loading
    useEffect(() => {
        if (isVisible && fitAddonRef.current && visible) {
            setTimeout(() => {
                if (isVisibleRef.current && fitAddonRef.current && terminal) {
                    fitAddonRef.current.fit();
                    scheduleNotify(terminal.cols, terminal.rows);
                    hardRefresh();
                }
            }, 50);
        }
    }, [isVisible, visible]);

    return (
        <div className="terminal-container" style={{position: 'absolute', inset: 0}}>
            <div 
                ref={xtermRef} 
                className="terminal-wrapper"
                style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    bottom: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    display: 'block'
                }}
            />
        </div>
    );
});

// Add mobile-optimized styles
const style = document.createElement('style');
style.innerHTML = `
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&display=swap');

/* Load NerdFonts locally */
@font-face {
  font-family: 'JetBrains Mono Nerd Font';
  src: url('/fonts/JetBrainsMonoNerdFont-Regular.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'JetBrains Mono Nerd Font';
  src: url('/fonts/JetBrainsMonoNerdFont-Bold.ttf') format('truetype');
  font-weight: bold;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'JetBrains Mono Nerd Font';
  src: url('/fonts/JetBrainsMonoNerdFont-Italic.ttf') format('truetype');
  font-weight: normal;
  font-style: italic;
  font-display: swap;
}

/* Terminal container styles */
.terminal-container {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 100%;
  display: flex;
  flex-direction: column;
}

.terminal-wrapper {
  flex: 1;
  width: 100%;
  height: 100%;
  min-height: 100%;
  position: relative;
}

/* XTerm specific styles */
.xterm {
  width: 100% !important;
  height: 100% !important;
  min-height: 100% !important;
  font-feature-settings: "liga" 1, "calt" 1;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.xterm .xterm-viewport {
  width: 100% !important;
  height: 100% !important;
}

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

.xterm .xterm-screen {
  font-family: 'JetBrains Mono Nerd Font', 'MesloLGS NF', 'FiraCode Nerd Font', 'Cascadia Code', 'JetBrains Mono', Consolas, "Courier New", monospace !important;
  font-variant-ligatures: contextual;
  width: 100% !important;
  height: 100% !important;
}

.xterm .xterm-screen .xterm-char {
  font-feature-settings: "liga" 1, "calt" 1;
}

.xterm .xterm-screen .xterm-char[data-char-code^="\\uE"] {
  font-family: 'JetBrains Mono Nerd Font', 'MesloLGS NF', 'FiraCode Nerd Font' !important;
}

/* Mobile-specific optimizations */
@media (max-width: 768px) {
  .xterm {
    font-size: 14px !important;
  }
  
  .terminal-container {
    padding: 0 !important;
  }
  
  .terminal-wrapper {
    padding: 0 !important;
  }
}

/* Ensure the terminal takes full dimensions */
.xterm .xterm-viewport,
.xterm .xterm-screen,
.xterm .xterm-rows {
  width: 100% !important;
  height: 100% !important;
}

/* Force full dimensions on all xterm elements */
.xterm,
.xterm-viewport,
.xterm-screen,
.xterm-rows,
.xterm-cursor-layer,
.xterm-selection-layer {
  width: 100% !important;
  height: 100% !important;
  min-width: 100% !important;
  min-height: 100% !important;
}
`;

// Only add the style once
if (!document.getElementById('terminal-mobile-styles')) {
    style.id = 'terminal-mobile-styles';
    document.head.appendChild(style);
}
