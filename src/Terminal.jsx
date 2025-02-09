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
            theme: {
                background: "#1a1a1a",
                foreground: "#ffffff",
                cursor: "#ffffff",
            },
            fontSize: 14,
            scrollback: 1000,
            rendererType: "canvas",
            allowTransparency: true,
        });

        // Initialize FitAddon for auto-sizing
        const fitAddon = new FitAddon();
        terminal.loadAddon(fitAddon);

        // Open terminal in the container
        terminal.open(terminalRef.current);

        // Resize function (Restoring your original logic)
        const resizeTerminal = () => {
            const terminalContainer = terminalRef.current;
            const sidebarWidth = 14 * 16; // Sidebar width in pixels
            const topbarHeight = 64; // Topbar height in pixels
            const availableWidth = window.innerWidth - sidebarWidth;
            const availableHeight = window.innerHeight - topbarHeight;

            terminalContainer.style.width = `${availableWidth}px`;
            terminalContainer.style.height = `${availableHeight}px`;

            fitAddon.fit();
            const { cols, rows } = terminal;

            if (socket) {
                socket.emit("resize", { cols, rows });
                console.log(`Terminal resized: cols=${cols}, rows=${rows}`);
            }
        };

        // Ensure correct sizing on start
        setTimeout(() => {
            fitAddon.fit();
            resizeTerminal();
        }, 50); // Small delay to ensure proper initialization

        // Focus on terminal after initialization
        terminal.focus();

        // Listen for window resize events
        window.addEventListener("resize", resizeTerminal);

        // Write initial connection message
        terminal.write("\r\n*** Connecting to backend ***\r\n");

        // Create socket connection
        const isSecure = window.location.protocol === "https:";
        const wsProtocol = isSecure ? "https" : "http";
        const ioUrl = `${wsProtocol}://${window.location.host}/io/`;

        const socket = io(ioUrl);

        // Emit hostConfig to start SSH connection
        socket.on("connect", () => {
            fitAddon.fit();
            resizeTerminal(); // Ensure proper size on connection
            const { cols, rows } = terminal;
            socket.emit("connectToHost", cols, rows, hostConfig);
            terminal.write("\r\n*** Connected to backend ***\r\n");

            terminal.onKey((key) => {
                socket.emit("data", key.key);
            });

            socket.on("data", (data) => {
                terminal.write(data);
            });

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
    }, [hostConfig]);

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