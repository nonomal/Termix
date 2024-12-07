const WebSocket = require('ws');
const ssh2 = require('ssh2');
const http = require('http');

// Create an HTTP server to serve WebSocket connections
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('WebSocket server is running\n');
});

// Create a WebSocket server attached to the HTTP server
const wss = new WebSocket.Server({ server });

// WebSocket connection handling
wss.on('connection', (ws) => {
    console.log('WebSocket connection established');

    let conn = null;
    let stream = null;
    let interval = null;

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            if (data.host && data.port && data.username && data.password) {
                if (conn) {
                    conn.end();
                }

                conn = new ssh2.Client();

                interval = setInterval(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.ping();
                    } else {
                        clearInterval(interval);
                    }
                }, 15000);

                conn.on('ready', () => {
                    console.log('SSH Connection established');
                    conn.shell((err, sshStream) => {
                        if (err) {
                            console.log(`SSH Error: ${err}`);
                            ws.send(`Error: ${err}`);
                            return;
                        }

                        stream = sshStream;

                        // Send stty commands for resizing rows and columns
                        const resizeCommand = (rows, cols) => {
                            return `stty rows ${rows} cols ${cols}\n`;
                        };

                        // Adjust terminal size once shell is ready
                        ws.on('message', (msg) => {
                            try {
                                const input = JSON.parse(msg);
                                if (input.type === 'resize') {
                                    const resizeCmd = resizeCommand(input.rows, input.cols);
                                    stream.write(resizeCmd);  // Resize the terminal in SSH
                                } else {
                                    stream.write(msg); // Regular input handling
                                }
                            } catch (e) {
                                // If it's not JSON, it's a regular key press
                                stream.write(msg);
                            }
                        });

                        stream.on('data', (data) => {
                            console.log(`SSH Output: ${data}`);
                            ws.send(data.toString()); // Send the data back to the client once
                        });

                        stream.on('close', () => {
                            console.log('SSH stream closed');
                            conn.end();
                        });

                        // Send only the resize commands initially without `stty sane`
                        const initialResizeCmd = resizeCommand(24, 80); // Example initial size
                        stream.write(initialResizeCmd);  // Set terminal size
                    });
                }).on('error', (err) => {
                    console.log('SSH Connection Error: ', err);
                    ws.send(`SSH Error: ${err}`);
                }).connect({
                    host: data.host,
                    port: data.port,
                    username: data.username,
                    password: data.password,
                    keepaliveInterval: 10000,
                    keepaliveCountMax: 5,
                });
            }
        } catch (error) {
            console.log('Received non-JSON message: ', message);
        }
    });

    ws.on('close', () => {
        if (conn) {
            conn.end();
        }
        if (interval) {
            clearInterval(interval);
        }
        console.log('WebSocket connection closed');
    });
});

// Start HTTP server
server.listen(8081, () => {
    console.log('WebSocket server listening on ws://localhost:8081');
});