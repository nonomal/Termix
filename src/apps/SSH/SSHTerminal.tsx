import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { useXTerm } from 'react-xtermjs';
import { FitAddon } from '@xterm/addon-fit';
import { ClipboardAddon } from '@xterm/addon-clipboard';

interface SSHTerminalProps {
    hostConfig: any;
    isVisible: boolean;
    title?: string;
    showTitle?: boolean;
    splitScreen?: boolean;
}

export const SSHTerminal = forwardRef<any, SSHTerminalProps>(function SSHTerminal(
    { hostConfig, isVisible, splitScreen = false },
    ref
) {
    console.log('Rendering SSHTerminal', { hostConfig, isVisible });
    const { instance: terminal, ref: xtermRef } = useXTerm();
    const fitAddonRef = useRef<FitAddon | null>(null);
    const webSocketRef = useRef<WebSocket | null>(null);
    const resizeTimeout = useRef<NodeJS.Timeout | null>(null);
    const [visible, setVisible] = useState(false);

    useImperativeHandle(ref, () => ({
        disconnect: () => {
            if (webSocketRef.current) {
                webSocketRef.current.close();
            }
        },
        fit: () => {
            if (fitAddonRef.current) {
                fitAddonRef.current.fit();
            }
        }
    }), []);

    useEffect(() => {
        function handleWindowResize() {
            fitAddonRef.current?.fit();
        }
        window.addEventListener('resize', handleWindowResize);
        return () => window.removeEventListener('resize', handleWindowResize);
    }, []);

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

        const onResize = () => {
            if (!xtermRef.current) return;
            const { width, height } = xtermRef.current.getBoundingClientRect();

            if (width < 100 || height < 50) return;

            if (resizeTimeout.current) clearTimeout(resizeTimeout.current);
            resizeTimeout.current = setTimeout(() => {
                fitAddonRef.current?.fit();

                // Always send cols + 1
                const cols = terminal.cols + 1;
                const rows = terminal.rows;

                webSocketRef.current?.send(JSON.stringify({
                    type: 'resize',
                    data: { cols, rows }
                }));
            }, 100);
        };

        const resizeObserver = new ResizeObserver(onResize);
        resizeObserver.observe(xtermRef.current);

        setTimeout(() => {
            fitAddon.fit();
            setVisible(true);

            // Always send cols + 1
            const cols = terminal.cols + 1;
            const rows = terminal.rows;

            const ws = new WebSocket('ws://localhost:8082');
            webSocketRef.current = ws;

            ws.addEventListener('open', () => {
                terminal.writeln('WebSocket opened');

                ws.send(JSON.stringify({
                    type: 'connectToHost',
                    data: {
                        cols,
                        rows,
                        hostConfig: hostConfig
                    }
                }));

                terminal.onData((data) => {
                    ws.send(JSON.stringify({
                        type: 'input',
                        data
                    }));
                });
            });

            ws.addEventListener('message', (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    console.log('WS message received:', msg); // Debug log

                    if (msg.type === 'data') {
                        terminal.write(msg.data);
                    } else if (msg.type === 'error') {
                        terminal.writeln(`\r\n[ERROR] ${msg.message}`);
                    } else if (msg.type === 'connected') {
                        terminal.writeln('[SSH connected. Waiting for prompt...]');
                    } else {
                        console.log('Unhandled message:', msg);
                    }
                } catch (err) {
                    console.error('Failed to parse message', err);
                }
            });

            ws.addEventListener('close', () => {
                terminal.writeln('\r\n[Connection closed]');
            });

            ws.addEventListener('error', () => {
                terminal.writeln('\r\n[Connection error]');
            });
        }, 300);

        return () => {
            resizeObserver.disconnect();
            if (resizeTimeout.current) clearTimeout(resizeTimeout.current);
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
                top: splitScreen ? 0 : 48,
                left: 0,
                right: '-1ch',
                bottom: 0,
                marginLeft: 2,
                opacity: visible && isVisible ? 1 : 0,
            }}
        />
    );
});