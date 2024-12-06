const WebSocket = require('ws');
const SSH = require('ssh2-promise');
const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('WebSocket server is running\n');
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('WebSocket connection established');

  let ssh = null;
  let termDimensions = { rows: 0, cols: 0, height: 0, weight: 0 };

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'resize') {
        termDimensions = data;
      } else if (data.username && data.password) {
        ssh = new SSH({
          host: data.host,
          username: data.username,
          password: data.password
        });

        try {
          await ssh.connect();
          const stream = await ssh.shell();

          stream.on('data', (data) => {
            const dataString = data.toString();
            ws.send(dataString);
          });

          stream.stderr.on('data', (data) => {
            const errorString = data.toString();
            console.error('SSH error:', errorString);
          });

          ws.on('message', (message) => {
            try {
              const data = JSON.parse(message);
              if (data.type === 'resize') {
                termDimensions = data;
              }
            } catch (err) {
              stream.write(message);
            }
          });

          stream.on('close', () => {
            console.log('Stream closed');
            ssh.close();
          });
        } catch (err) {
          console.error('SSH connection error:', err);
        }
      }
    } catch (err) {
      console.error('Message processing error:', err);
    }
  });

  ws.on('close', () => {
    console.log('WebSocket closed');
    if (ssh) {
      ssh.close();
    }
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
  });

  // Ping-pong is used to keep the connection alive.
  const interval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    } else {
      clearInterval(interval);
    }
  }, 5000);
});

server.listen(8081, () => {
  console.log('Server listening on port 8081');
});