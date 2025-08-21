import React, {useEffect, useRef, useState, useImperativeHandle, forwardRef} from 'react';
import {useXTerm} from 'react-xtermjs';
import {FitAddon} from '@xterm/addon-fit';
import {ClipboardAddon} from '@xterm/addon-clipboard';
import {Unicode11Addon} from '@xterm/addon-unicode11';
import {WebLinksAddon} from '@xterm/addon-web-links';
import {Button} from '../../../../components/ui/button';
import {Card} from '../../../../components/ui/card';
import {Separator} from '../../../../components/ui/separator';
import {ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Copy, Clipboard, RotateCcw, Terminal, X, ChevronUp, ChevronDown} from 'lucide-react';

interface SSHTerminalProps {
    hostConfig: any;
    isMobileKeyboardOpen?: boolean;
}

// Special Terminal Keys Component
const TerminalControls = ({ onKeyPress, onPaste, isVisible, isMobileKeyboardOpen }: {
    onKeyPress: (key: string) => void;
    onPaste: () => void;
    isVisible: boolean;
    isMobileKeyboardOpen: boolean;
}) => {
    const handlePaste = async () => {
        try {
            const text = await navigator.clipboard.readText();
            onKeyPress(text);
        } catch (error) {
            console.error('Failed to read clipboard:', error);
        }
    };

    if (!isVisible) return null;

    // Adjust position based on mobile keyboard state
    const bottomPosition = isMobileKeyboardOpen ? '20px' : '8px';

    return (
        <Card className="fixed bottom-0 left-0 right-0 mx-2 bg-[#0e0e10] border-2 border-[#303032] rounded-lg shadow-lg" style={{ bottom: bottomPosition, padding: 0 }}>
            <div className="p-1.5">
                {/* Header - Compact */}
                <div className="flex items-center justify-end mb-2">
                    <div className="flex items-center gap-1 absolute top-3">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handlePaste}
                            className="bg-[#1f2937] border-[#374151] text-white hover:bg-[#374151] hover:text-white h-6 px-2 text-xs"
                        >
                            <Clipboard className="h-3 w-3 mr-1" />
                            Paste
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onKeyPress('close')}
                            className="bg-[#1f2937] border-[#374151] text-white hover:bg-[#374151] hover:text-white h-6 w-6 p-0"
                        >
                            <X className="h-3 w-3" />
                        </Button>
                    </div>
                </div>

                {/* Navigation Keys - Super Compact */}
                <div className="mb-2">
                    <div className="grid grid-cols-3 gap-1 max-w-28 mx-auto">
                        <div className="col-start-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onKeyPress('\x1b[A')}
                                className="w-6 h-6 bg-[#1f2937] border-[#374151] text-white hover:bg-[#374151] hover:text-white"
                            >
                                <ArrowUp className="h-2 w-2" />
                            </Button>
                        </div>
                        <div className="col-start-1">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onKeyPress('\x1b[D')}
                                className="w-6 h-6 bg-[#1f2937] border-[#374151] text-white hover:bg-[#374151] hover:text-white"
                            >
                                <ArrowLeft className="h-2 w-2" />
                            </Button>
                        </div>
                        <div className="col-start-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onKeyPress('\x1b[B')}
                                className="w-6 h-6 bg-[#1f2937] border-[#374151] text-white hover:bg-[#374151] hover:text-white"
                            >
                                <ArrowDown className="h-2 w-2" />
                            </Button>
                        </div>
                        <div className="col-start-3">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onKeyPress('\x1b[C')}
                                className="w-6 h-6 bg-[#1f2937] border-[#374151] text-white hover:bg-[#374151] hover:text-white"
                            >
                                <ArrowRight className="h-2 w-2" />
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Control Keys & Common Shortcuts - Side by Side */}
                <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                        <div className="grid grid-cols-2 gap-1">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onKeyPress('\x1b')}
                                className="bg-[#1f2937] border-[#374151] text-white hover:bg-[#374151] hover:text-white h-6 text-xs"
                            >
                                Esc
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onKeyPress('\t')}
                                className="bg-[#1f2937] border-[#374151] text-white hover:bg-[#374151] hover:text-white h-6 text-xs"
                            >
                                Tab
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onKeyPress('\r')}
                                className="bg-[#1f2937] border-[#374151] text-white hover:bg-[#374151] hover:text-white h-6 text-xs"
                            >
                                Enter
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onKeyPress('\x7f')}
                                className="bg-[#1f2937] border-[#374151] text-white hover:bg-[#374151] hover:text-white h-6 text-xs"
                            >
                                Del
                            </Button>
                        </div>
                    </div>
                    <div>
                        <div className="grid grid-cols-2 gap-1">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onKeyPress('\x03')}
                                className="bg-[#1f2937] border-[#374151] text-white hover:bg-[#374151] hover:text-white h-6 text-xs"
                            >
                                Ctrl+C
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onKeyPress('\x04')}
                                className="bg-[#1f2937] border-[#374151] text-white hover:bg-[#374151] hover:text-white h-6 text-xs"
                            >
                                Ctrl+D
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onKeyPress('\x0c')}
                                className="bg-[#1f2937] border-[#374151] text-white hover:bg-[#374151] hover:text-white h-6 text-xs"
                            >
                                Ctrl+L
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onKeyPress('\x15')}
                                className="bg-[#1f2937] border-[#374151] text-white hover:bg-[#374151] hover:text-white h-6 text-xs"
                            >
                                Ctrl+U
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Function Keys - Compact Grid */}
                <div>
                    <div className="grid grid-cols-6 gap-1">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(num => (
                            <Button
                                key={num}
                                variant="outline"
                                size="sm"
                                onClick={() => onKeyPress(`\x1b[${num}~`)}
                                className="bg-[#1f2937] border-[#374151] text-white hover:bg-[#374151] hover:text-white h-6 text-xs"
                            >
                                F{num}
                            </Button>
                        ))}
                    </div>
                </div>
            </div>
        </Card>
    );
};

export const TerminalComponent = forwardRef<any, SSHTerminalProps>(function SSHTerminal(
    {hostConfig, isMobileKeyboardOpen = false},
    ref
) {
    const {instance: terminal, ref: xtermRef} = useXTerm();
    const fitAddonRef = useRef<FitAddon | null>(null);
    const webSocketRef = useRef<WebSocket | null>(null);
    const resizeTimeout = useRef<NodeJS.Timeout | null>(null);
    const wasDisconnectedBySSH = useRef(false);
    const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const [showControls, setShowControls] = useState(false);

    const lastSentSizeRef = useRef<{ cols: number; rows: number } | null>(null);
    const pendingSizeRef = useRef<{ cols: number; rows: number } | null>(null);
    const notifyTimerRef = useRef<NodeJS.Timeout | null>(null);
    const DEBOUNCE_MS = 140;

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

    const handleKeyPress = (key: string) => {
        if (key === 'close') {
            setShowControls(false);
            return;
        }
        if (webSocketRef.current?.readyState === WebSocket.OPEN) {
            webSocketRef.current.send(JSON.stringify({type: 'input', data: key}));
        }
    };

    const handlePaste = async () => {
        try {
            const text = await navigator.clipboard.readText();
            handleKeyPress(text);
        } catch (error) {
            console.error('Failed to read clipboard:', error);
        }
    };

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
        const handleWindowResize = () => {
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
                    }, 50);
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
            }, 100);
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

    // Calculate terminal height based on mobile keyboard and controls state
    const getTerminalHeight = () => {
        if (isMobileKeyboardOpen) {
            return showControls ? 'calc(100% - 200px)' : 'calc(100% - 100px)';
        }
        return showControls ? 'calc(100% - 200px)' : '100%';
    };

    const getTerminalBottom = () => {
        if (isMobileKeyboardOpen) {
            return showControls ? '200px' : '100px';
        }
        return showControls ? '200px' : '0';
    };

    return (
        <div className="terminal-container bg-[#18181b] text-white rounded-lg border-2 border-[#303032] overflow-hidden" style={{position: 'absolute', inset: 0}}>
            <div 
                ref={xtermRef} 
                className="terminal-wrapper"
                style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    bottom: getTerminalBottom(),
                    left: 0,
                    width: '100%',
                    height: getTerminalHeight(),
                    display: 'block'
                }}
            />
            
            {/* Show Controls Button - Only when controls are hidden */}
            {!showControls && (
                <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => setShowControls(true)}
                    className="absolute bottom-4 right-4 z-50 bg-[#1f2937] border-[#374151] text-white hover:bg-[#374151] hover:text-white shadow-lg"
                    style={{
                        bottom: isMobileKeyboardOpen ? '120px' : '16px'
                    }}
                >
                    <Terminal className="h-4 w-4 mr-2" />
                    Show Controls
                </Button>
            )}

            {/* Terminal Controls */}
            <TerminalControls
                onKeyPress={handleKeyPress}
                onPaste={handlePaste}
                isVisible={showControls}
                isMobileKeyboardOpen={isMobileKeyboardOpen}
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
