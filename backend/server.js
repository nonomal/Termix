const WebSocket = require('ws');
const ssh2 = require('ssh2');
const http = require('http');

// Create an HTTP server
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('WebSocket server is running\n');
});

// Create a WebSocket server
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('WebSocket connection established');
  let conn = null;

  // Ping-Pong for WebSocket Keep-Alives
  const interval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    } else {
      clearInterval(interval);
    }
  }, 15000); // Send a ping every 15 seconds

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
                ws.send(data.toString());
              });

              stream.on('close', () => {
                console.log('SSH Stream closed');
                conn.end();
              });

              // Forward user input and resize events to the SSH stream
              ws.on('message', (message) => {
                let data;
              
                // Try parsing the message as JSON
                try {
                  data = JSON.parse(message);
                } catch (err) {
                  // If it's not JSON, it's likely user input. Forward it to the SSH stream.
                  console.log('User Input:', message);
                  stream.write(message);
                  return;  // Exit early since it's user input
                }
              
                // If it's a resize event, handle it
                if (data.type === 'resize' && data.rows && data.cols) {
                  console.log('Resize event received:', data);
                  stream.setWindow(data.rows, data.cols, data.height, data.width);
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
            keepaliveInterval: 20000, // Send SSH keepalive every 20 seconds
            keepaliveCountMax: 5, // Allow 5 missed keepalives before disconnecting
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

// Start the server
server.listen(8081, () => {
  console.log('WebSocket server is running on ws://localhost:8081');
});