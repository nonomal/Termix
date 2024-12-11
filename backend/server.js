const WebSocket = require('ws');
const ssh2 = require('ssh2');
const http = require('http');

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('WebSocket server is running\n');
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    console.log('WebSocket connection established');

    let conn = new ssh2.Client();
    let stream = null;
    let currentCols = 80;
    let currentRows = 24;

    const resizeTerminal = (cols, rows) => {
        if (stream && stream.setWindow) {
            stream.setWindow(rows, cols, rows * 100, cols * 100);  // Adjust terminal size
            console.log(`Terminal resized successfully: cols=${cols}, rows=${rows}`);
        }
    };

    ws.on('message', (message) => {
        const messageStr = message.toString();

        let data;
        try {
            if (messageStr.trim().startsWith('{')) {
                data = JSON.parse(messageStr);
            } else if (stream && stream.writable) {
                stream.write(messageStr);
                return;
            }
        } catch (error) {
            console.error('Failed to process message:', error);
            return;
        }

        if (data?.host && data.port && data.username && data.password) {
            conn.on('ready', () => {
                console.log('SSH Connection established');

                const interval = setInterval(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.ping();
                    } else {
                        clearInterval(interval);
                    }
                }, 15000);

                conn.shell({ term: 'xterm', cols: currentCols, rows: currentRows }, (error, newStream) => {
                    if (error) {
                        console.error(`SSH Shell Error: ${error}`);
                        ws.send(`Error: Could not establish a shell: ${error.message}`);
                        return;
                    }

                    stream = newStream;

                    stream.on('data', (chunk) => {
                        ws.send(chunk.toString());
                    });

                    stream.on('close', () => {
                        console.log('SSH stream closed');
                        conn.end();
                    });
                });
            }).on('error', (err) => {
                console.log('SSH Connection Error:', err);
                ws.send(`SSH Connection Error: ${err.message}`);
            }).connect({
                host: data.host,
                port: data.port,
                username: data.username,
                password: data.password,
                keepaliveInterval: 10000,
                keepaliveCountMax: 5,
            });
        } else if (data?.cols && data.rows) {
            currentCols = data.cols;
            currentRows = data.rows;
            resizeTerminal(currentCols, currentRows);
        }
    });

    ws.on('close', () => {
        console.log('WebSocket closed');
        clearInterval(interval);
        if (conn) {
            conn.end();
        }
    });
});

server.listen(8081, () => {
    console.log('WebSocket server is listening on ws://localhost:8081');
});