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
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isSideBarHidden, setIsSideBarHidden] = useState(false);

  useEffect(() => {
    // Initialize the terminal and the fit addon
    terminal.current = new Terminal({
      cursorBlink: true,
      theme: {
        background: '#1e1e1e',
        foreground: '#ffffff',
      },
      macOptionIsMeta: true,
      allowProposedApi: true,
      scrollback: 5000,
      // Do not enable local echo
      disableStdin: false,
    });

    // Initialize and attach the fit addon to the terminal
    fitAddon.current = new FitAddon();
    terminal.current.loadAddon(fitAddon.current);

    terminal.current.open(terminalRef.current);

    // Resize terminal to fit the container initially
    fitAddon.current.fit();

    // Adjust terminal size on window resize
    const handleResize = () => {
      fitAddon.current.fit();
      if (socket.current && socket.current.readyState === WebSocket.OPEN) {
        socket.current.send(JSON.stringify({
          type: 'resize',
          rows: terminal.current.rows,
          cols: terminal.current.cols,
        }));
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      terminal.current.dispose();
      if (socket.current) socket.current.close();
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleConnect = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/`; // Use current host and "/ws/" endpoint

    if (!host || !username || !password) {
      terminal.current.writeln('Please fill in all fields.');
      return;
    }

    socket.current = new WebSocket("ws://localhost:8081");

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
      setIsConnected(true);
    };

    socket.current.onmessage = (event) => {
      // Write the incoming data from WebSocket to the terminal
      // This ensures that data coming from the WebSocket server is shown in the terminal
      terminal.current.write(event.data);
    };

    socket.current.onerror = (error) => {
      terminal.current.writeln(`WebSocket error: ${error.message}`);
    };

    socket.current.onclose = () => {
      terminal.current.writeln('Disconnected from WebSocket server.');
      setIsConnected(false);
    };

    // Handle terminal input and send it over WebSocket
    terminal.current.onData((data) => {
      // Send input data over WebSocket without echoing it back to the terminal
      if (socket.current && socket.current.readyState === WebSocket.OPEN) {
        socket.current.send(data); // Only send to WebSocket, no echo
      }
    });
  };

  const handleInputChange = (event, setState, isNumber = false) => {
    let value = event.target.value;

    if (isNumber) {
      value = Number(value); // Convert to number if it's a number field
      if (isNaN(value)) {
        value = ''; // Optional: set an empty string if the input is invalid
      }
    }

    setState(value); // Set the state with the appropriate value
  };

  const handleSideBarHiding = () => {
    setIsSideBarHidden((prevState) => !prevState);
  };

  return (
      <div className="app-container">
        <div className={`main-content ${isSideBarHidden ? 'with-sidebar-hidden' : ''}`}>
          <div className={`sidebar ${isSideBarHidden ? 'hidden' : ''}`}>
            <h2>Connection Details</h2>
            <input
                type="text"
                placeholder="Host"
                value={host}
                onChange={(e) => handleInputChange(e, setHost)}
            />
            <input
                type="number"
                placeholder="Port"
                value={port}
                onChange={(e) => handleInputChange(e, setPort, true)}
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