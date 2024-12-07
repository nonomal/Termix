import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import 'xterm/css/xterm.css';
import { FitAddon } from '@xterm/addon-fit';
import './App.css';

const App = () => {
  const terminalRef = useRef(null);
  const terminal = useRef(null);
  const fitAddon = useRef(null);
  const socket = useRef(null);
  const [host, setHost] = useState('');
  const [port, setPort] = useState('22');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isSideBarHidden, setIsSideBarHidden] = useState(false);

  useEffect(() => {
    terminal.current = new Terminal({
      cursorBlink: true,
      theme: {
        background: '#1e1e1e',
        foreground: '#ffffff',
      },
      macOptionIsMeta: true,
      allowProposedApi: true,
      scrollback: 5000,
    });

    fitAddon.current = new FitAddon();
    terminal.current.loadAddon(fitAddon.current);

    terminal.current.open(terminalRef.current);
    fitAddon.current.fit();

    // Fit the terminal and send the size when needed
    const fitAndNotifyResize = () => {
      fitAddon.current.fit();
      if (socket.current && socket.current.readyState === WebSocket.OPEN) {
        socket.current.send(JSON.stringify({
          cols: terminal.current.cols,
          rows: terminal.current.rows,
        }));
      }
    };
    window.addEventListener('resize', fitAndNotifyResize);

    terminal.current.onResize(({ cols, rows }) => {
      console.log(`Terminal resized to cols:${cols}, rows:${rows}`);
      fitAndNotifyResize();
    });

    const handleConnectionEstablished = () => {
      fitAndNotifyResize();
    };

    window.addEventListener('connection-established', handleConnectionEstablished);

    // Monitor terminal data (activity)
    terminal.current.onData((data) => {
      if (socket.current && socket.current.readyState === WebSocket.OPEN) {
        socket.current.send(data);
      }
    });

    return () => {
      terminal.current.dispose();
      if (socket.current) {
        socket.current.close();
      }
      window.removeEventListener('resize', fitAndNotifyResize);
    };
  }, []);

  const handleConnect = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/`; // Use current host and "/ws/" endpoint

    if (!host || !username || !password) {
      terminal.current.writeln('Please fill in all fields.');
      return;
    }

    socket.current = new WebSocket(wsUrl);

    socket.current.onopen = () => {
      terminal.current.writeln(`Connected to WebSocket server at ${wsUrl}`);
      socket.current.send(
          JSON.stringify({
            host,
            port,
            username,
            password,
            rows: terminal.current.rows,
            cols: terminal.current.cols
          })
      );

      // Dispatch a custom event when connection is open
      const event = new Event('connection-established');
      window.dispatchEvent(event);

      setIsConnected(true);
    };

    socket.current.onmessage = (event) => {
      terminal.current.write(event.data);
    };

    socket.current.onerror = (error) => {
      terminal.current.writeln(`WebSocket error: ${error.message}`);
    };

    socket.current.onclose = () => {
      terminal.current.writeln('Disconnected from WebSocket server.');
      setIsConnected(false);
    };
  };

  const handleInputChange = (event, setState) => {
    setState(event.target.value);
  };

  const handleSideBarHiding = () => {
    setIsSideBarHidden((prevState) => {
      const newState = !prevState;
      if (newState) {
        setTimeout(() => {
          // Add a delay to ensure layout settles before resize action
          fitAddon.current.fit();
          if (socket.current && socket.current.readyState === WebSocket.OPEN) {
            socket.current.send(JSON.stringify({
              cols: terminal.current.cols,
              rows: terminal.current.rows,
            }));
          }
        }, 100); // Delay of 100 milliseconds
      } else {
        setTimeout(() => {
          // Refit terminal when showing sidebar as well
          fitAddon.current.fit();
          if (socket.current && socket.current.readyState === WebSocket.OPEN) {
            socket.current.send(JSON.stringify({
              cols: terminal.current.cols,
              rows: terminal.current.rows,
            }));
          }
        }, 100); // Delay of 100 milliseconds
      }
      return newState;
    });
  };

  return (
      <div className="app-container">
        <div className="main-content">
          <div className={`sidebar ${isSideBarHidden ? 'hidden' : ''}`}>
            <h2>Connection Details</h2>
            <input
                type="text"
                placeholder="Host"
                value={host}
                onChange={(e) => handleInputChange(e, setHost)}
            />
            <input
                type="text"
                placeholder="Port"
                value={port}
                onChange={(e) => handleInputChange(e, setPort)}
            />
            <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => handleInputChange(e, setUsername)}
            />
            <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => handleInputChange(e, setPassword)}
            />
            <button onClick={handleConnect} disabled={isConnected}>
              {isConnected ? 'Connected' : 'Start Session'}
            </button>
          </div>

          <div ref={terminalRef} className="terminal-container"></div>
        </div>

        {/* Hide button always positioned in the bottom-right corner */}
        <button
            className="hide-sidebar-button"
            onClick={handleSideBarHiding}
        >
          {isSideBarHidden ? '+' : '-'}
        </button>
      </div>
  );
};

export default App;