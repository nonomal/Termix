const WebSocket = require('ws');
const { Client } = require('ssh2');

const wss = new WebSocket.Server({ port: 8082 });

wss.on('connection', (ws) => {
    let sshConn = null;
    let sshStream = null;

    ws.on('close', () => {
        cleanupSSH();
    });

    ws.on('message', (msg) => {
        let parsed;
        try {
            parsed = JSON.parse(msg);
        } catch (e) {
            console.error('Invalid JSON received:', msg);
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
            return;
        }

        const { type, data } = parsed;

        switch (type) {
            case 'connectToHost':
                handleConnectToHost(data);
                break;

            case 'resize':
                handleResize(data);
                break;

            case 'disconnect':
                cleanupSSH();
                break;

            case 'input':
                if (sshStream) sshStream.write(data);
                break;

            default:
                console.warn('Unknown message type:', type);
        }
    });

    function handleConnectToHost({ cols, rows, hostConfig }) {
        const { ip, port, username, password } = hostConfig;

        sshConn = new Client();

        sshConn.on('ready', () => {
            sshConn.shell({
                term: "xterm-256color",
                cols,
                rows,
                modes: {
                    ECHO: 1,
                    ECHOCTL: 0,
                    ICANON: 1,
                    TTY_OP_OSWRAP: 1
                }
            }, (err, stream) => {
                if (err) {
                    console.error('Shell error:', err);
                    ws.send(JSON.stringify({ type: 'error', message: 'Shell error: ' + err.message }));
                    return;
                }

                sshStream = stream;

                stream.on('data', (chunk) => {
                    ws.send(JSON.stringify({ type: 'data', data: chunk.toString() }));
                });

                stream.on('close', () => {
                    cleanupSSH();
                });

                stream.on('error', (err) => {
                    console.error('SSH stream error:', err.message);
                    ws.send(JSON.stringify({ type: 'error', message: 'SSH stream error: ' + err.message }));
                });

                ws.send(JSON.stringify({ type: 'connected', message: 'SSH connected' }));
                // stream.write('\n'); // Force prompt to appear (removed to avoid double prompt)
                console.log('Sent connected message and newline to SSH stream');
            });
        });

        sshConn.on('error', (err) => {
            console.error('SSH connection error:', err.message);
            ws.send(JSON.stringify({ type: 'error', message: 'SSH error: ' + err.message }));
            cleanupSSH();
        });

        sshConn.on('close', () => {
            cleanupSSH();
        });

        sshConn.connect({
            host: ip,
            port,
            username,
            password,
            keepaliveInterval: 5000,
            keepaliveCountMax: 10,
            readyTimeout: 10000,
            tcpKeepAlive: true,
        });
    }

    function handleResize({ cols, rows }) {
        if (sshStream && sshStream.setWindow) {
            sshStream.setWindow(rows, cols, rows, cols);
            ws.send(JSON.stringify({ type: 'resized', cols, rows }));
        }
    }

    function cleanupSSH() {
        if (sshStream) {
            try {
                sshStream.end();
            } catch (e) {
                console.error('Error closing stream:', e.message);
            }
            sshStream = null;
        }

        if (sshConn) {
            try {
                sshConn.end();
            } catch (e) {
                console.error('Error closing connection:', e.message);
            }
            sshConn = null;
        }
    }
});

console.log('WebSocket server running on ws://localhost:8082');