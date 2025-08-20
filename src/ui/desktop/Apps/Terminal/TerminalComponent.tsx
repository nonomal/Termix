import {useEffect, useRef, useState, useImperativeHandle, forwardRef} from 'react';
import {useXTerm} from 'react-xtermjs';
import {FitAddon} from '@xterm/addon-fit';
import {ClipboardAddon} from '@xterm/addon-clipboard';
import {Unicode11Addon} from '@xterm/addon-unicode11';
import {WebLinksAddon} from '@xterm/addon-web-links';

interface SSHTerminalProps {
    hostConfig: any;
    isVisible: boolean;
    title?: string;
    showTitle?: boolean;
    splitScreen?: boolean;
}

export const TerminalComponent = forwardRef<any, SSHTerminalProps>(function SSHTerminal(
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
        refresh: () => hardRefresh(),
    }), [terminal]);

    useEffect(() => {
        window.addEventListener('resize', handleWindowResize);
        return () => window.removeEventListener('resize', handleWindowResize);
    }, []);

    function handleWindowResize() {
        if (!isVisibleRef.current) return;
        fitAddonRef.current?.fit();
        if (terminal) scheduleNotify(terminal.cols, terminal.rows);
        hardRefresh();
    }

    function getCookie(name: string) {
        return document.cookie.split('; ').reduce((r, v) => {
            const parts = v.split('=');
            return parts[0] === name ? decodeURIComponent(parts[1]) : r;
        }, "");
    }

    function getUseRightClickCopyPaste() {
        return getCookie("rightClickCopyPaste") === "true"
    }

    async function writeTextToClipboard(text: string): Promise<void> {
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
                return;
            }
        } catch (_) {
        }
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        try {
            document.execCommand('copy');
        } finally {
            document.body.removeChild(textarea);
        }
    }

    async function readTextFromClipboard(): Promise<string> {
        try {
            if (navigator.clipboard && navigator.clipboard.readText) {
                return await navigator.clipboard.readText();
            }
        } catch (_) {
        }
        return '';
    }

    useEffect(() => {
        if (!terminal || !xtermRef.current || !hostConfig) return;

        terminal.options = {
            cursorBlink: true,
            cursorStyle: 'bar',
            scrollback: 10000,
            fontSize: 14,
            fontFamily: '"JetBrains Mono Nerd Font", "MesloLGS NF", "FiraCode Nerd Font", "Cascadia Code", "JetBrains Mono", Consolas, "Courier New", monospace',
            theme: {background: '#18181b', foreground: '#f7f7f7'},
            allowTransparency: true,
            convertEol: true,
            windowsMode: false,
            macOptionIsMeta: false,
            macOptionClickForcesSelection: false,
            rightClickSelectsWord: false,
            fastScrollModifier: 'alt',
            fastScrollSensitivity: 5,
            allowProposedApi: true,
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

        const element = xtermRef.current;
        const handleContextMenu = async (e: MouseEvent) => {
            if (!getUseRightClickCopyPaste()) return;
            e.preventDefault();
            e.stopPropagation();
            try {
                if (terminal.hasSelection()) {
                    const selection = terminal.getSelection();
                    if (selection) {
                        await writeTextToClipboard(selection);
                        terminal.clearSelection();
                    }
                } else {
                    const pasteText = await readTextFromClipboard();
                    if (pasteText) terminal.paste(pasteText);
                }
            } catch (_) {
            }
        };
        element?.addEventListener('contextmenu', handleContextMenu);

        const resizeObserver = new ResizeObserver(() => {
            if (resizeTimeout.current) clearTimeout(resizeTimeout.current);
            resizeTimeout.current = setTimeout(() => {
                if (!isVisibleRef.current) return;
                fitAddonRef.current?.fit();
                if (terminal) scheduleNotify(terminal.cols, terminal.rows);
                hardRefresh();
            }, 100);
        });

        resizeObserver.observe(xtermRef.current);

        const readyFonts = (document as any).fonts?.ready instanceof Promise ? (document as any).fonts.ready : Promise.resolve();
        readyFonts.then(() => {
            setTimeout(() => {
                fitAddon.fit();
                setTimeout(() => {
                    fitAddon.fit();
                    if (terminal) scheduleNotify(terminal.cols, terminal.rows);
                    hardRefresh();
                    setVisible(true);
                }, 0);

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
                        } else if (msg.type === 'disconnected') {
                            wasDisconnectedBySSH.current = true;
                            terminal.writeln(`\r\n[${msg.message || 'Disconnected'}]`);
                        }
                    } catch (error) {
                    }
                });

                ws.addEventListener('close', () => {
                    if (!wasDisconnectedBySSH.current) terminal.writeln('\r\n[Connection closed]');
                });
                ws.addEventListener('error', () => {
                    terminal.writeln('\r\n[Connection error]');
                });
            }, 300);
        });

        return () => {
            resizeObserver.disconnect();
            element?.removeEventListener('contextmenu', handleContextMenu);
            if (notifyTimerRef.current) clearTimeout(notifyTimerRef.current);
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
            setTimeout(() => {
                fitAddonRef.current?.fit();
                if (terminal) scheduleNotify(terminal.cols, terminal.rows);
                hardRefresh();
            }, 0);
        }
    }, [isVisible]);

    useEffect(() => {
        if (!fitAddonRef.current) return;
        setTimeout(() => {
            fitAddonRef.current?.fit();
            if (terminal) scheduleNotify(terminal.cols, terminal.rows);
            hardRefresh();
        }, 0);
    }, [splitScreen]);

    return (
        <div ref={xtermRef} className="h-full w-full m-1"
             style={{opacity: visible && isVisible ? 1 : 0, overflow: 'hidden'}}/>
    );
});

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

.xterm {
  font-feature-settings: "liga" 1, "calt" 1;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.xterm .xterm-screen {
  font-family: 'JetBrains Mono Nerd Font', 'MesloLGS NF', 'FiraCode Nerd Font', 'Cascadia Code', 'JetBrains Mono', Consolas, "Courier New", monospace !important;
  font-variant-ligatures: contextual;
}

.xterm .xterm-screen .xterm-char {
  font-feature-settings: "liga" 1, "calt" 1;
}

.xterm .xterm-screen .xterm-char[data-char-code^="\\uE"] {
  font-family: 'JetBrains Mono Nerd Font', 'MesloLGS NF', 'FiraCode Nerd Font' !important;
}
`;
document.head.appendChild(style);
