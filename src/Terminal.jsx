import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import io from "socket.io-client";
import PropTypes from "prop-types";
import theme from "./theme";

export function NewTerminal({ hostConfig }) {
    const terminalRef = useRef(null);
    const socketRef = useRef(null);

    useEffect(() => {
        if (!hostConfig || !terminalRef.current) return;

        // Initialize terminal
        const terminal = new Terminal({
            cursorBlink: true,
            theme: {
                background: theme.palette.background.terminal,
                foreground: theme.palette.text.primary,
                cursor: theme.palette.text.primary,
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

        // Resize function
        const resizeTerminal = () => {
            const terminalContainer = terminalRef.current;
            const parentContainer = terminalContainer?.parentElement;

            if (!parentContainer) return;

            const parentWidth = parentContainer.clientWidth;
            const parentHeight = parentContainer.clientHeight;

            terminalContainer.style.width = `${parentWidth}px`;
            terminalContainer.style.height = `${parentHeight}px`;

            fitAddon.fit();
            const { cols, rows } = terminal;

            if (socketRef.current) {
                socketRef.current.emit("resize", { cols, rows });
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

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        let ioUrl = `${protocol}//${window.location.hostname}:${window.location.port}/socket.io/`;

        if (window.location.hostname === "localhost") {
            ioUrl = "http://localhost:8081";
        }

        const socket = io(ioUrl);
        socketRef.current = socket;

        socket.off("connect");
        socket.off("data");
        socket.off("disconnect");

        socket.on("connect", () => {
            fitAddon.fit();
            resizeTerminal(); // Ensure proper size on connection
            const { cols, rows } = terminal;
            socket.emit("connectToHost", cols, rows, hostConfig);
            terminal.write("\r\n*** Connected to backend ***\r\n");
        });

        socket.on("data", (data) => {
            terminal.write(data);
        });

        socket.on("disconnect", () => {
            terminal.write("\r\n*** Disconnected from backend ***\r\n");
        });

        // Capture and send keystrokes
        terminal.onKey(({ key }) => {
            socket.emit("data", key);
        });

        // Handle socket errors
        socket.on("connect_error", (err) => {
            terminal.write(`\r\n*** Error: ${err.message} ***\r\n`);
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
            className="w-full h-full overflow-hidden text-left"
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