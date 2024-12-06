import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import 'xterm/css/xterm.css';
import { FitAddon } from 'xterm-addon-fit';
import './App.css';

const App = () => {
  const terminalRef = useRef(null);
  const terminal = useRef(null);
  const fitAddon = useRef(null);
  const socket = useRef(null);
  const [host, setHost] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isSideBarHidden, setIsSideBarHidden] = useState(false);

  useEffect(() => {
    console.log('Initializing terminal...');
    terminal.current = new Terminal({
      cursorBlink: true,
      theme: { background: '#1e1e1e', foreground: '#ffffff' },
      macOptionIsMeta: true,
      allowProposedApi: true,
      fontSize: 14,
    });

    fitAddon.current = new FitAddon();
    terminal.current.loadAddon(fitAddon.current);

    let resizeObserver = new ResizeObserver(() => {
      fitAddon.current.fit();
      notifyServerOfResize();
    });

    if (terminalRef.current) {
      terminal.current.open(terminalRef.current);
      console.log('Terminal opened successfully.');
      resizeObserver.observe(terminalRef.current);
    } else {
      console.error('Terminal reference is not valid!');
    }

    terminal.current.onData((data) => {
      if (socket.current && socket.current.readyState === WebSocket.OPEN) {
        socket.current.send(data);
      }
    });


    const notifyServerOfResize = () => {
      if (socket.current && socket.current.readyState === WebSocket.OPEN) {
        const { rows, cols } = terminal.current;
        socket.current.send(
            JSON.stringify({
              type: 'resize',
              rows,
              cols,
              height: terminalRef.current.offsetHeight,
              width: terminalRef.current.offsetWidth,
            })
        );
      }
    };

    const resizeTerminal = () => {
      if (terminalRef.current) {
        fitAddon.current.fit();
        notifyServerOfResize();
      }
    };

    resizeTerminal();
    window.addEventListener('resize', resizeTerminal);

    return () => {
      terminal.current.dispose();
      if (socket.current) {
        socket.current.close();
      }
      window.removeEventListener('resize', resizeTerminal);
      resizeObserver.disconnect();
    };
  }, []);

  const handleConnect = () => {
    console.log('Connecting...');
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/`;
    console.log(`WebSocket URL: ${wsUrl}`);

    socket.current = new WebSocket(wsUrl);

    socket.current.onopen = () => {
      console.log('WebSocket connection opened');
      terminal.current.writeln(`Connected to WebSocket server at ${wsUrl}`);
      socket.current.send(JSON.stringify({ host, username, password }));
      setIsConnected(true);
    };

    socket.current.onmessage = (event) => {
      console.log('Received message:', event.data);
      try {
        const parsedData = JSON.parse(event.data);
        if (parsedData.type === 'process_closed') {
          notifyServerOfResize();
        } else {
          terminal.current.write(event.data);
        }
      } catch (error) {
        terminal.current.write(event.data)
      }
    };

    socket.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      terminal.current.writeln(`WebSocket error: ${error.message}`);
    };

    socket.current.onclose = () => {
      console.log('WebSocket connection closed');
      terminal.current.writeln('Disconnected from WebSocket server.');
      setIsConnected(false);
    };
  };

  const handleInputChange = (event, setState) => {
    setState(event.target.value);
  };

  const handleSideBarHiding = () => {
    setIsSideBarHidden((prevState) => !prevState);
    if (!isSideBarHidden) {
      setTimeout(() => {
        fitAddon.current.fit();
      }, 100);
    }
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

        <button className="hide-sidebar-button" onClick={handleSideBarHiding}>
          {isSideBarHidden ? '+' : '-'}
        </button>
      </div>
  );
};

export default App;