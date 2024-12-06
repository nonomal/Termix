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
  let conn = null;
  let termDimensions = { rows: 0, cols: 0, height: 0, width: 0 }; // Store terminal dimensions

  const interval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    } else {
      clearInterval(interval);
    }
  }, 15000);

  ws.on('pong', () => {
    console.log('Received pong from client');
  });

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      if (data.host && data.username && data.password) {
        if (conn) {
          conn.end();
        }

        conn = new ssh2.Client();

        conn
            .on('ready', () => {
              console.log('SSH Connection established');
              conn.shell((err, stream) => {
                if (err) {
                  ws.send(`Error: ${err.message}`);
                  return;
                }

                stream.on('data', (data) => {
                  const dataString = data.toString();
                  ws.send(dataString);

                  if (dataString.includes('[Process completed]')) { // Replace with your actual completion detection
                    stream.setWindow(termDimensions.rows, termDimensions.cols, termDimensions.height, termDimensions.width);
                  }
                });

                stream.stderr.on('data', (data) => {
                  console.error('SSH stderr:', data.toString())
                })

                stream.on('close', () => {
                  console.log('SSH Stream closed');
                  conn.end();
                  ws.send(JSON.stringify({ type: 'process_closed' })); // Signal process has closed
                });

                ws.on('message', (message) => {
                  try {
                    const data = JSON.parse(message);
                    if (data.type === 'resize' && data.rows && data.cols) {
                      console.log('Resize event received:', data);
                      termDimensions = data; // Store received dimensions
                      stream.setWindow(data.rows, data.cols, data.height, data.width);
                    }
                  } catch (err) {
                    console.log('User Input:', message);
                    stream.write(message);
                  }
                });
              });
            })
            .on('error', (err) => {
              console.log('SSH Error:', err.message);
              ws.send(`SSH Error: ${err.message}`);
            })
            .on('close', () => {
              console.log('SSH Connection closed');
            })
            .connect({
              host: data.host,
              port: 22,
              username: data.username,
              password: data.password,
              keepaliveInterval: 20000,
              keepaliveCountMax: 5,
            });
      }
    } catch (error) {
      console.log('Non-JSON message received:', message);
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
  console.log('WebSocket server is running on ws://localhost:8081');
});