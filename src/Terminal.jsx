import { forwardRef, useImperativeHandle, useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import io from "socket.io-client";
import PropTypes from "prop-types";
import theme from "./theme";

export const NewTerminal = forwardRef(({ hostConfig, isVisible }, ref) => {
    const terminalRef = useRef(null);
    const socketRef = useRef(null);
    const fitAddon = useRef(new FitAddon());
    const terminalInstance = useRef(null);

    const resizeTerminal = () => {
        const terminalContainer = terminalRef.current;
        const parentContainer = terminalContainer?.parentElement;

        if (!parentContainer || !isVisible) return;

        // Force a reflow to ensure the container's dimensions are up-to-date
        void parentContainer.offsetHeight;

        // Use a small delay to ensure the DOM has fully updated
        setTimeout(() => {
            const parentWidth = parentContainer.clientWidth;
            const parentHeight = parentContainer.clientHeight;

            terminalContainer.style.width = `${parentWidth}px`;
            terminalContainer.style.height = `${parentHeight}px`;

            // Fit the terminal to the container
            fitAddon.current.fit();

            // Notify the backend of the new terminal size
            if (socketRef.current && terminalInstance.current) {
                const { cols, rows } = terminalInstance.current;
                socketRef.current.emit("resize", { cols, rows });
            }
        }, 10); // Small delay to ensure proper DOM updates
    };

    useImperativeHandle(ref, () => ({
        resizeTerminal: resizeTerminal,
    }));

    useEffect(() => {
        if (!hostConfig || !terminalRef.current) return;

        terminalInstance.current = new Terminal({
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

        terminalInstance.current.loadAddon(fitAddon.current);

        terminalInstance.current.open(terminalRef.current);

        setTimeout(() => {
            fitAddon.current.fit();
            resizeTerminal();
            terminalInstance.current.focus();
        }, 50);

        terminalInstance.current.write("\r\n*** Connecting to backend ***\r\n");

        const socket = io(
            window.location.hostname === "localhost"
                ? "http://localhost:8081"
                : "/",
            {
                path: "/socket.io",
                transports: ["websocket", "polling"],
            }
        );
        socketRef.current = socket;

        socket.on("connect", () => {
            fitAddon.current.fit();
            resizeTerminal();
            const { cols, rows } = terminalInstance.current;
            socket.emit("connectToHost", cols, rows, hostConfig);
            terminalInstance.current.write("\r\n*** Connected to backend ***\r\n");
        });

        socket.on("data", (data) => {
            terminalInstance.current.write(data);
        });

        socket.on("disconnect", () => {
            terminalInstance.current.write("\r\n*** Disconnected from backend ***\r\n");
        });

        terminalInstance.current.onKey(({ key }) => {
            socket.emit("data", key);
        });

        socket.on("connect_error", (err) => {
            terminalInstance.current.write(`\r\n*** Error: ${err.message} ***\r\n`);
        });

        return () => {
            terminalInstance.current.dispose();
            socket.disconnect();
        };
    }, [hostConfig]);

    useEffect(() => {
        if (isVisible) {
            resizeTerminal();
        }
    }, [isVisible]);

    return (
        <div
            ref={terminalRef}
            className="w-full h-full overflow-hidden text-left"
            style={{ display: isVisible ? "block" : "none" }}
        />
    );
});

NewTerminal.displayName = "NewTerminal";

NewTerminal.propTypes = {
    hostConfig: PropTypes.shape({
        ip: PropTypes.string.isRequired,
        user: PropTypes.string.isRequired,
        password: PropTypes.string.isRequired,
        port: PropTypes.string.isRequired,
    }).isRequired,
    isVisible: PropTypes.bool.isRequired,
};