// Terminal.jsx
import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import io from "socket.io-client";
import PropTypes from "prop-types";

export function NewTerminal({ hostConfig }) {
    const terminalRef = useRef(null);

    useEffect(() => {
        if (!hostConfig || !terminalRef.current) return;

        // Initialize terminal
        const terminal = new Terminal({
            cursorBlink: true,
            cursorStyle: "block",
            theme: { background: "#1a1a1a", foreground: "#ffffff", cursor: "#ffffff" },
            fontSize: 14,
            scrollback: 1000,
        });

        // Initialize FitAddon for auto-sizing
        const fitAddon = new FitAddon();
        terminal.loadAddon(fitAddon);

        // Open terminal in the container
        terminal.open(terminalRef.current);

        // Apply fit after terminal is fully initialized
        setTimeout(() => {
            fitAddon.fit();
            resizeTerminal();
        }, 100);

        // Focus on terminal and reset layout
        terminal.focus();

        // Resize terminal to fit the container
        const resizeTerminal = () => {
            const terminalContainer = terminalRef.current;
            const sidebarWidth = 14 * 16; // Sidebar width in pixels
            const topbarHeight = 96; // Topbar height in pixels
            const availableWidth = window.innerWidth - sidebarWidth;
            const availableHeight = window.innerHeight - topbarHeight;

            terminalContainer.style.width = `${availableWidth}px`;
            terminalContainer.style.height = `${availableHeight}px`;

            fitAddon.fit();
            const { cols, rows } = terminal;

            // Emit new terminal size to the backend
            if (socket) {
                socket.emit("resize", { cols, rows });
                console.log(`Terminal resized: cols=${cols}, rows=${rows}`);
            }
        };

        // Handle window resize events
        window.addEventListener("resize", resizeTerminal);

        // Write initial connection message
        terminal.write("\r\n*** Connecting to backend ***\r\n");

        // Create the socket connection with the provided hostConfig
        const socket = io("http://localhost:8081");

        // Emit the hostConfig to the server to start SSH connection
        fitAddon.fit();
        const { cols, rows } = terminal;
        socket.emit("connectToHost", cols, rows, hostConfig);

        // Handle socket connection events
        socket.on("connect", () => {
            terminal.write("\r\n*** Connected to backend ***\r\n");

            // Send keystrokes to the backend
            terminal.onKey((key) => {
                socket.emit("data", key.key);
            });

            // Display output from the backend
            socket.on("data", (data) => {
                terminal.write(data);
            });

            // Handle disconnection
            socket.on("disconnect", () => {
                terminal.write("\r\n*** Disconnected from backend ***\r\n");
            });
        });

        // Cleanup on component unmount
        return () => {
            terminal.dispose();
            window.removeEventListener("resize", resizeTerminal);
            socket.disconnect();
        };
    }, [hostConfig]); // Re-run effect when hostConfig changes

    return (
        <div
            ref={terminalRef}
            style={{
                width: "100%",
                height: "100%",
                minHeight: "400px",
                overflow: "hidden",
                textAlign: "left",
            }}
        />
    );
}

// Prop validation using PropTypes
NewTerminal.propTypes = {
    hostConfig: PropTypes.shape({
        ip: PropTypes.string.isRequired,
        user: PropTypes.string.isRequired,
        password: PropTypes.string.isRequired,
        port: PropTypes.string.isRequired,
    }).isRequired,
};