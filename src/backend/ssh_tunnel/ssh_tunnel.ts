import express from 'express';
import cors from 'cors';
import { Client } from 'ssh2';
import { exec } from 'child_process';
import chalk from 'chalk';
import axios from 'axios';

const app = express();
app.use(cors({
    origin: [
        'http://localhost:5173', // Vite dev server
        'http://localhost:3000', // Common React dev port
        'http://127.0.0.1:5173',
        'http://127.0.0.1:3000',
        '*', // Allow all for dev, remove in prod
    ],
    credentials: true,
    methods: 'GET,POST,PUT,DELETE,OPTIONS',
    allowedHeaders: 'Origin,X-Requested-With,Content-Type,Accept,Authorization',
}));
app.use(express.json());

const tunnelIconSymbol = '📡';
const getTimeStamp = (): string => chalk.gray(`[${new Date().toLocaleTimeString()}]`);
const formatMessage = (level: string, colorFn: chalk.Chalk, message: string): string => {
    return `${getTimeStamp()} ${colorFn(`[${level.toUpperCase()}]`)} ${chalk.hex('#1e3a8a')(`[${tunnelIconSymbol}]`)} ${message}`;
};
const logger = {
    info: (msg: string): void => {
        console.log(formatMessage('info', chalk.cyan, msg));
    },
    warn: (msg: string): void => {
        console.warn(formatMessage('warn', chalk.yellow, msg));
    },
    error: (msg: string, err?: unknown): void => {
        console.error(formatMessage('error', chalk.redBright, msg));
        if (err) console.error(err);
    },
    success: (msg: string): void => {
        console.log(formatMessage('success', chalk.greenBright, msg));
    },
    debug: (msg: string): void => {
        if (process.env.NODE_ENV !== 'production') {
            console.debug(formatMessage('debug', chalk.magenta, msg));
        }
    }
};

// State management
const activeTunnels = new Map<string, Client>();
const retryCounters = new Map<string, number>();
const connectionStatus = new Map<string, TunnelStatus>();
const tunnelVerifications = new Map<string, VerificationData>();
const manualDisconnects = new Set<string>();
const verificationTimers = new Map<string, NodeJS.Timeout>();
const activeRetryTimers = new Map<string, NodeJS.Timeout>();
const retryExhaustedTunnels = new Set<string>();
const remoteClosureEvents = new Map<string, number>();
const hostConfigs = new Map<string, HostConfig>();

// Types
interface HostConfig {
    name: string;
    sourceIP: string;
    sourceSSHPort: number;
    sourceUsername: string;
    sourcePassword?: string;
    sourceAuthMethod: string;
    sourceSSHKey?: string;
    sourceKeyPassword?: string;
    sourceKeyType?: string;
    endpointIP: string;
    endpointSSHPort: number;
    endpointUsername: string;
    endpointPassword?: string;
    endpointAuthMethod: string;
    endpointSSHKey?: string;
    endpointKeyPassword?: string;
    endpointKeyType?: string;
    sourcePort: number;
    endpointPort: number;
    maxRetries: number;
    retryInterval: number;
    autoStart: boolean;
    isPinned: boolean;
}

interface TunnelStatus {
    connected: boolean;
    status: ConnectionState;
    retryCount?: number;
    maxRetries?: number;
    nextRetryIn?: number;
    reason?: string;
    errorType?: ErrorType;
    manualDisconnect?: boolean;
    retryExhausted?: boolean;
    isRemoteRetry?: boolean;
}

interface VerificationData {
    conn: Client;
    timeout: NodeJS.Timeout;
}

const CONNECTION_STATES = {
    DISCONNECTED: "disconnected",
    CONNECTING: "connecting",
    CONNECTED: "connected",
    VERIFYING: "verifying",
    FAILED: "failed",
    UNSTABLE: "unstable",
    RETRYING: "retrying"
} as const;

const ERROR_TYPES = {
    AUTH: "authentication",
    NETWORK: "network",
    PORT: "port_conflict",
    PERMISSION: "permission",
    TIMEOUT: "timeout",
    UNKNOWN: "unknown"
} as const;

type ConnectionState = typeof CONNECTION_STATES[keyof typeof CONNECTION_STATES];
type ErrorType = typeof ERROR_TYPES[keyof typeof ERROR_TYPES];

// Helper functions
function broadcastTunnelStatus(tunnelName: string, status: TunnelStatus): void {
    if (status.status === CONNECTION_STATES.CONNECTED && activeRetryTimers.has(tunnelName)) {
        return;
    }

    if (retryExhaustedTunnels.has(tunnelName) && status.status === CONNECTION_STATES.FAILED) {
        status.reason = "Max retries exhausted";
    }

    // In Express, we'll use a different approach for broadcasting
    // For now, we'll store the status and provide endpoints to fetch it
    connectionStatus.set(tunnelName, status);
}

function getAllTunnelStatus(): Record<string, TunnelStatus> {
    const tunnelStatus: Record<string, TunnelStatus> = {};
    connectionStatus.forEach((status, key) => {
        tunnelStatus[key] = status;
    });
    return tunnelStatus;
}

function classifyError(errorMessage: string): ErrorType {
    if (!errorMessage) return ERROR_TYPES.UNKNOWN;

    const message = errorMessage.toLowerCase();

    if (message.includes("closed by remote host") ||
        message.includes("connection reset by peer") ||
        message.includes("connection refused") ||
        message.includes("broken pipe")) {
        return ERROR_TYPES.NETWORK;
    }

    if (message.includes("authentication failed") ||
        message.includes("permission denied") ||
        message.includes("incorrect password")) {
        return ERROR_TYPES.AUTH;
    }

    if (message.includes("connect etimedout") ||
        message.includes("timeout") ||
        message.includes("timed out")) {
        return ERROR_TYPES.TIMEOUT;
    }

    if (message.includes("bind: address already in use") ||
        message.includes("failed for listen port") ||
        message.includes("port forwarding failed")) {
        return ERROR_TYPES.PORT;
    }

    if (message.includes("permission") ||
        message.includes("access denied")) {
        return ERROR_TYPES.PERMISSION;
    }

    return ERROR_TYPES.UNKNOWN;
}

// Cleanup and disconnect functions
function cleanupTunnelResources(tunnelName: string): void {
    if (activeTunnels.has(tunnelName)) {
        try {
            const conn = activeTunnels.get(tunnelName);
            if (conn) conn.end();
        } catch (e) {}
        activeTunnels.delete(tunnelName);
    }

    if (tunnelVerifications.has(tunnelName)) {
        const verification = tunnelVerifications.get(tunnelName);
        if (verification?.timeout) clearTimeout(verification.timeout);
        try {
            verification?.conn.end();
        } catch (e) {}
        tunnelVerifications.delete(tunnelName);
    }

    const timerKeys = [
        tunnelName,
        `${tunnelName}_confirm`,
        `${tunnelName}_retry`,
        `${tunnelName}_verify_retry`
    ];

    timerKeys.forEach(key => {
        if (verificationTimers.has(key)) {
            clearTimeout(verificationTimers.get(key)!);
            verificationTimers.delete(key);
        }
    });

    if (activeRetryTimers.has(tunnelName)) {
        clearTimeout(activeRetryTimers.get(tunnelName)!);
        activeRetryTimers.delete(tunnelName);
    }
}

function resetRetryState(tunnelName: string): void {
    retryCounters.delete(tunnelName);
    retryExhaustedTunnels.delete(tunnelName);
    remoteClosureEvents.delete(tunnelName);

    if (activeRetryTimers.has(tunnelName)) {
        clearTimeout(activeRetryTimers.get(tunnelName)!);
        activeRetryTimers.delete(tunnelName);
    }

    ['', '_confirm', '_retry', '_verify_retry'].forEach(suffix => {
        const timerKey = `${tunnelName}${suffix}`;
        if (verificationTimers.has(timerKey)) {
            clearTimeout(verificationTimers.get(timerKey)!);
            verificationTimers.delete(timerKey);
        }
    });
}

function handleDisconnect(tunnelName: string, hostConfig: HostConfig | null, shouldRetry = true, isRemoteClosure = false): void {
    if (tunnelVerifications.has(tunnelName)) {
        try {
            const verification = tunnelVerifications.get(tunnelName);
            if (verification?.timeout) clearTimeout(verification.timeout);
            verification?.conn.end();
        } catch (e) {}
        tunnelVerifications.delete(tunnelName);
    }

    cleanupTunnelResources(tunnelName);

    if (manualDisconnects.has(tunnelName)) {
        resetRetryState(tunnelName);

        broadcastTunnelStatus(tunnelName, {
            connected: false,
            status: CONNECTION_STATES.DISCONNECTED,
            manualDisconnect: true
        });
        return;
    }

    if (isRemoteClosure) {
        const currentCount = remoteClosureEvents.get(tunnelName) || 0;
        remoteClosureEvents.set(tunnelName, currentCount + 1);

        broadcastTunnelStatus(tunnelName, {
            connected: false,
            status: CONNECTION_STATES.FAILED,
            reason: "Remote host disconnected"
        });

        if (currentCount === 0) {
            retryCounters.delete(tunnelName);
        }
    }

    if (isRemoteClosure && retryExhaustedTunnels.has(tunnelName)) {
        retryExhaustedTunnels.delete(tunnelName);
    }

    if (retryExhaustedTunnels.has(tunnelName)) {
        broadcastTunnelStatus(tunnelName, {
            connected: false,
            status: CONNECTION_STATES.FAILED,
            reason: "Max retries already exhausted"
        });
        return;
    }

    if (activeRetryTimers.has(tunnelName)) {
        return;
    }

    if (shouldRetry && hostConfig) {
        const maxRetries = hostConfig.maxRetries || 3;
        const retryInterval = hostConfig.retryInterval || 5000;

        if (isRemoteClosure) {
            const currentCount = remoteClosureEvents.get(tunnelName) || 0;
            remoteClosureEvents.set(tunnelName, currentCount + 1);

            if (currentCount === 0) {
                retryCounters.delete(tunnelName);
            }
        }

        let retryCount = (retryCounters.get(tunnelName) || 0) + 1;

        if (retryCount > maxRetries) {
            logger.error(`All ${maxRetries} retries failed for ${tunnelName}`);

            retryExhaustedTunnels.add(tunnelName);
            activeTunnels.delete(tunnelName);
            retryCounters.delete(tunnelName);

            broadcastTunnelStatus(tunnelName, {
                connected: false,
                status: CONNECTION_STATES.FAILED,
                retryExhausted: true,
                reason: `Max retries exhausted`
            });
            return;
        }

        retryCounters.set(tunnelName, retryCount);

        if (retryCount <= maxRetries) {
            broadcastTunnelStatus(tunnelName, {
                connected: false,
                status: CONNECTION_STATES.RETRYING,
                retryCount: retryCount,
                maxRetries: maxRetries,
                nextRetryIn: retryInterval/1000
            });

            if (activeRetryTimers.has(tunnelName)) {
                clearTimeout(activeRetryTimers.get(tunnelName)!);
                activeRetryTimers.delete(tunnelName);
            }

            const timer = setTimeout(() => {
                activeRetryTimers.delete(tunnelName);

                if (!manualDisconnects.has(tunnelName)) {
                    activeTunnels.delete(tunnelName);
                    connectSSHTunnel(hostConfig, retryCount);
                }
            }, retryInterval);

            activeRetryTimers.set(tunnelName, timer);
        }
    } else {
        broadcastTunnelStatus(tunnelName, {
            connected: false,
            status: CONNECTION_STATES.FAILED
        });

        activeTunnels.delete(tunnelName);
    }
}

// Tunnel verification function
function verifyTunnelConnection(tunnelName: string, hostConfig: HostConfig, isPeriodic = false): void {
    if (manualDisconnects.has(tunnelName) || !activeTunnels.has(tunnelName)) {
        return;
    }

    if (tunnelVerifications.has(tunnelName)) {
        return;
    }

    const conn = activeTunnels.get(tunnelName);
    if (!conn) return;

    broadcastTunnelStatus(tunnelName, {
        connected: false,
        status: CONNECTION_STATES.VERIFYING
    });

    const verificationConn = new Client();
    tunnelVerifications.set(tunnelName, {
        conn: verificationConn,
        timeout: setTimeout(() => {
            logger.error(`Verification timeout for '${tunnelName}'`);
            cleanupVerification(false, "Verification timeout");
        }, 10000)
    });

    function cleanupVerification(isSuccessful: boolean, failureReason = "Unknown verification failure") {
        const verification = tunnelVerifications.get(tunnelName);
        if (verification) {
            clearTimeout(verification.timeout);
            try {
                verification.conn.end();
            } catch (e) {}
            tunnelVerifications.delete(tunnelName);
        }

        if (isSuccessful) {
            broadcastTunnelStatus(tunnelName, {
                connected: true,
                status: CONNECTION_STATES.CONNECTED
            });

            if (!isPeriodic) {
                setupPingInterval(tunnelName, hostConfig);
            }
        } else {
            logger.error(`Verification failed for '${tunnelName}': ${failureReason}`);
            
            if (!manualDisconnects.has(tunnelName)) {
                broadcastTunnelStatus(tunnelName, {
                    connected: false,
                    status: CONNECTION_STATES.FAILED,
                    reason: failureReason
                });
            }

            activeTunnels.delete(tunnelName);
            handleDisconnect(tunnelName, hostConfig, !manualDisconnects.has(tunnelName));
        }
    }

    function attemptVerification() {
        const testCmd = `nc -z localhost ${hostConfig.sourcePort}`;
        
        verificationConn.exec(testCmd, (err, stream) => {
            if (err) {
                cleanupVerification(false, `Verification command failed: ${err.message}`);
                return;
            }

            let output = '';
            stream.on('data', (data: Buffer) => {
                output += data.toString();
            });

            stream.on('close', (code: number) => {
                if (code === 0 && code !== undefined) {
                    cleanupVerification(true);
                } else {
                    cleanupVerification(false, `Port ${hostConfig.sourcePort} is not accessible`);
                }
            });

            stream.on('error', (err: Error) => {
                cleanupVerification(false, `Verification stream error: ${err.message}`);
            });
        });
    }

    verificationConn.on('ready', () => {
        attemptVerification();
    });

    verificationConn.on('error', (err: Error) => {
        cleanupVerification(false, `Verification connection error: ${err.message}`);
    });

    verificationConn.on('close', () => {
        if (tunnelVerifications.has(tunnelName)) {
            cleanupVerification(false, "Verification connection closed");
        }
    });

    const connOptions: any = {
        host: hostConfig.sourceIP,
        port: hostConfig.sourceSSHPort,
        username: hostConfig.sourceUsername,
        readyTimeout: 10000,
        algorithms: {
            kex: [
                'diffie-hellman-group14-sha256',
                'diffie-hellman-group14-sha1',
                'diffie-hellman-group1-sha1',
                'diffie-hellman-group-exchange-sha256',
                'diffie-hellman-group-exchange-sha1',
                'ecdh-sha2-nistp256',
                'ecdh-sha2-nistp384',
                'ecdh-sha2-nistp521'
            ],
            cipher: [
                'aes128-ctr',
                'aes192-ctr',
                'aes256-ctr',
                'aes128-gcm@openssh.com',
                'aes256-gcm@openssh.com',
                'aes128-cbc',
                'aes192-cbc',
                'aes256-cbc',
                '3des-cbc'
            ],
            hmac: [
                'hmac-sha2-256',
                'hmac-sha2-512',
                'hmac-sha1',
                'hmac-md5'
            ],
            compress: [
                'none',
                'zlib@openssh.com',
                'zlib'
            ]
        }
    };

    if (hostConfig.sourceAuthMethod === "key" && hostConfig.sourceSSHKey) {
        connOptions.privateKey = hostConfig.sourceSSHKey;
        if (hostConfig.sourceKeyPassword) {
            connOptions.passphrase = hostConfig.sourceKeyPassword;
        }
    } else {
        connOptions.password = hostConfig.sourcePassword;
    }

    verificationConn.connect(connOptions);
}

function setupPingInterval(tunnelName: string, hostConfig: HostConfig): void {
    const pingInterval = setInterval(() => {
        if (!activeTunnels.has(tunnelName) || manualDisconnects.has(tunnelName)) {
            clearInterval(pingInterval);
            return;
        }

        const conn = activeTunnels.get(tunnelName);
        if (!conn) {
            clearInterval(pingInterval);
            return;
        }

        conn.exec('echo "ping"', (err, stream) => {
            if (err) {
                clearInterval(pingInterval);
                
                if (!manualDisconnects.has(tunnelName)) {
                    broadcastTunnelStatus(tunnelName, {
                        connected: false,
                        status: CONNECTION_STATES.UNSTABLE,
                        reason: "Ping failed"
                    });
                }
                
                activeTunnels.delete(tunnelName);
                handleDisconnect(tunnelName, hostConfig, !manualDisconnects.has(tunnelName));
                return;
            }

            stream.on('close', (code: number) => {
                if (code !== 0) {
                    clearInterval(pingInterval);
                    
                    if (!manualDisconnects.has(tunnelName)) {
                        broadcastTunnelStatus(tunnelName, {
                            connected: false,
                            status: CONNECTION_STATES.UNSTABLE,
                            reason: "Ping command failed"
                        });
                    }
                    
                    activeTunnels.delete(tunnelName);
                    handleDisconnect(tunnelName, hostConfig, !manualDisconnects.has(tunnelName));
                }
            });

            stream.on('error', (err: Error) => {
                clearInterval(pingInterval);
                
                if (!manualDisconnects.has(tunnelName)) {
                    broadcastTunnelStatus(tunnelName, {
                        connected: false,
                        status: CONNECTION_STATES.UNSTABLE,
                        reason: "Ping stream error"
                    });
                }
                
                activeTunnels.delete(tunnelName);
                handleDisconnect(tunnelName, hostConfig, !manualDisconnects.has(tunnelName));
            });
        });
    }, 30000); // Ping every 30 seconds
}

// Main SSH tunnel connection function
function connectSSHTunnel(hostConfig: HostConfig, retryAttempt = 0): void {
    const tunnelName = hostConfig.name;

    if (manualDisconnects.has(tunnelName)) {
        return;
    }

    cleanupTunnelResources(tunnelName);

    if (retryAttempt === 0) {
        retryExhaustedTunnels.delete(tunnelName);
        retryCounters.delete(tunnelName);
        remoteClosureEvents.delete(tunnelName);
    }

    const isRetryAfterRemoteClosure = remoteClosureEvents.get(tunnelName) && retryAttempt > 0;

    broadcastTunnelStatus(tunnelName, {
        connected: false,
        status: CONNECTION_STATES.CONNECTING,
        retryCount: retryAttempt > 0 ? retryAttempt : undefined,
        isRemoteRetry: !!isRetryAfterRemoteClosure
    });

    if (!hostConfig || !hostConfig.sourceIP || !hostConfig.sourceUsername || !hostConfig.sourceSSHPort) {
        logger.error(`Invalid connection details for '${tunnelName}'`);
        broadcastTunnelStatus(tunnelName, { 
            connected: false, 
            status: CONNECTION_STATES.FAILED,
            reason: "Missing required connection details"
        });
        return;
    }

    const conn = new Client();

    const connectionTimeout = setTimeout(() => {
        if (conn) {
            if (activeRetryTimers.has(tunnelName)) {
                return;
            }

            try {
                conn.end();
            } catch (e) {}

            activeTunnels.delete(tunnelName);

            if (!activeRetryTimers.has(tunnelName)) {
                handleDisconnect(tunnelName, hostConfig, !manualDisconnects.has(tunnelName));
            }
        }
    }, 15000);

    conn.on("error", (err) => {
        clearTimeout(connectionTimeout);
        logger.error(`SSH error for '${tunnelName}': ${err.message}`);

        if (activeRetryTimers.has(tunnelName)) {
            return;
        }

        const errorType = classifyError(err.message);
        const isRemoteHostClosure = err.message.toLowerCase().includes("closed by remote host") ||
            err.message.toLowerCase().includes("connection reset by peer") ||
            err.message.toLowerCase().includes("broken pipe");

        if (!manualDisconnects.has(tunnelName)) {
            broadcastTunnelStatus(tunnelName, {
                connected: false,
                status: CONNECTION_STATES.FAILED,
                errorType: errorType,
                reason: err.message
            });
        }

        activeTunnels.delete(tunnelName);

        if (isRemoteHostClosure && retryExhaustedTunnels.has(tunnelName)) {
            retryExhaustedTunnels.delete(tunnelName);
        }

        const shouldNotRetry = !isRemoteHostClosure && (
            errorType === ERROR_TYPES.AUTH ||
            errorType === ERROR_TYPES.PORT ||
            errorType === ERROR_TYPES.PERMISSION ||
            manualDisconnects.has(tunnelName)
        );

        handleDisconnect(tunnelName, hostConfig, !shouldNotRetry, isRemoteHostClosure);
    });

    conn.on("close", () => {
        clearTimeout(connectionTimeout);

        if (activeRetryTimers.has(tunnelName)) {
            return;
        }

        if (!manualDisconnects.has(tunnelName)) {
            const currentStatus = connectionStatus.get(tunnelName);
            if (!currentStatus || currentStatus.status !== CONNECTION_STATES.FAILED) {
                broadcastTunnelStatus(tunnelName, {
                    connected: false,
                    status: CONNECTION_STATES.DISCONNECTED
                });
            }

            if (!activeRetryTimers.has(tunnelName)) {
                handleDisconnect(tunnelName, hostConfig, !manualDisconnects.has(tunnelName));
            }
        }
    });

    conn.on("ready", () => {
        clearTimeout(connectionTimeout);

        const isAlreadyVerifying = tunnelVerifications.has(tunnelName);
        if (isAlreadyVerifying) {
            return;
        }

        let tunnelCmd: string;
        if (hostConfig.endpointAuthMethod === "key" && hostConfig.endpointSSHKey) {
            tunnelCmd = `ssh -T -o StrictHostKeyChecking=no -o ExitOnForwardFailure=yes -R ${hostConfig.endpointPort}:localhost:${hostConfig.sourcePort} ${hostConfig.endpointUsername}@${hostConfig.endpointIP}`;
        } else {
            tunnelCmd = `sshpass -p '${hostConfig.endpointPassword || ''}' ssh -T -o StrictHostKeyChecking=no -o ExitOnForwardFailure=yes -R ${hostConfig.endpointPort}:localhost:${hostConfig.sourcePort} ${hostConfig.endpointUsername}@${hostConfig.endpointIP}`;
        }

        conn.exec(tunnelCmd, (err, stream) => {
            if (err) {
                logger.error(`Connection error for '${tunnelName}': ${err.message}`);

                try { conn.end(); } catch(e) {}

                activeTunnels.delete(tunnelName);

                const errorType = classifyError(err.message);
                const shouldNotRetry = errorType === ERROR_TYPES.AUTH ||
                    errorType === ERROR_TYPES.PORT ||
                    errorType === ERROR_TYPES.PERMISSION;

                handleDisconnect(tunnelName, hostConfig, !shouldNotRetry);
                return;
            }

            activeTunnels.set(tunnelName, conn);

            setTimeout(() => {
                if (!manualDisconnects.has(tunnelName) && activeTunnels.has(tunnelName)) {
                    verifyTunnelConnection(tunnelName, hostConfig, false);
                }
            }, 2000);

            stream.on("close", (code: number) => {
                if (activeRetryTimers.has(tunnelName)) {
                    return;
                }

                activeTunnels.delete(tunnelName);

                if (tunnelVerifications.has(tunnelName)) {
                    try {
                        const verification = tunnelVerifications.get(tunnelName);
                        if (verification?.timeout) clearTimeout(verification.timeout);
                        verification?.conn.end();
                    } catch (e) {}
                    tunnelVerifications.delete(tunnelName);
                }

                const isLikelyRemoteClosure = code === 255;

                if (isLikelyRemoteClosure && retryExhaustedTunnels.has(tunnelName)) {
                    retryExhaustedTunnels.delete(tunnelName);
                }

                if (!manualDisconnects.has(tunnelName) && code !== 0 && code !== undefined) {
                    if (retryExhaustedTunnels.has(tunnelName)) {
                        broadcastTunnelStatus(tunnelName, {
                            connected: false,
                            status: CONNECTION_STATES.FAILED,
                            reason: "Max retries exhausted"
                        });
                    } else {
                        broadcastTunnelStatus(tunnelName, {
                            connected: false,
                            status: CONNECTION_STATES.FAILED,
                            reason: isLikelyRemoteClosure ? "Connection closed by remote host" : "Connection closed unexpectedly"
                        });
                    }
                }

                if (!activeRetryTimers.has(tunnelName) && !retryExhaustedTunnels.has(tunnelName)) {
                    handleDisconnect(tunnelName, hostConfig, !manualDisconnects.has(tunnelName), isLikelyRemoteClosure);
                } else if (retryExhaustedTunnels.has(tunnelName) && isLikelyRemoteClosure) {
                    retryExhaustedTunnels.delete(tunnelName);
                    retryCounters.delete(tunnelName);
                    handleDisconnect(tunnelName, hostConfig, true, true);
                }
            });

            stream.stderr.on("data", (data) => {
                const errorMsg = data.toString();

                const isNonRetryableError = errorMsg.includes("Permission denied") ||
                    errorMsg.includes("Authentication failed") ||
                    errorMsg.includes("failed for listen port") ||
                    errorMsg.includes("address already in use");

                const isRemoteHostClosure = errorMsg.includes("closed by remote host") ||
                    errorMsg.includes("connection reset by peer") ||
                    errorMsg.includes("broken pipe");

                if (isNonRetryableError || isRemoteHostClosure) {
                    if (activeRetryTimers.has(tunnelName)) {
                        return;
                    }

                    if (retryExhaustedTunnels.has(tunnelName)) {
                        if (isRemoteHostClosure) {
                            retryExhaustedTunnels.delete(tunnelName);
                            retryCounters.delete(tunnelName);
                        } else {
                            return;
                        }
                    }

                    activeTunnels.delete(tunnelName);

                    if (!manualDisconnects.has(tunnelName)) {
                        broadcastTunnelStatus(tunnelName, {
                            connected: false,
                            status: CONNECTION_STATES.FAILED,
                            errorType: classifyError(errorMsg),
                            reason: errorMsg
                        });
                    }

                    const errorType = classifyError(errorMsg);
                    const shouldNotRetry = !isRemoteHostClosure && (
                        errorType === ERROR_TYPES.AUTH ||
                        errorType === ERROR_TYPES.PORT ||
                        errorType === ERROR_TYPES.PERMISSION
                    );

                    handleDisconnect(tunnelName, hostConfig, !shouldNotRetry, isRemoteHostClosure);
                }
            });
        });
    });

    const connOptions: any = {
        host: hostConfig.sourceIP,
        port: hostConfig.sourceSSHPort,
        username: hostConfig.sourceUsername,
        keepaliveInterval: 5000,
        keepaliveCountMax: 10,
        readyTimeout: 10000,
        tcpKeepAlive: true,
        algorithms: {
            kex: [
                'diffie-hellman-group14-sha256',
                'diffie-hellman-group14-sha1',
                'diffie-hellman-group1-sha1',
                'diffie-hellman-group-exchange-sha256',
                'diffie-hellman-group-exchange-sha1',
                'ecdh-sha2-nistp256',
                'ecdh-sha2-nistp384',
                'ecdh-sha2-nistp521'
            ],
            cipher: [
                'aes128-ctr',
                'aes192-ctr',
                'aes256-ctr',
                'aes128-gcm@openssh.com',
                'aes256-gcm@openssh.com',
                'aes128-cbc',
                'aes192-cbc',
                'aes256-cbc',
                '3des-cbc'
            ],
            hmac: [
                'hmac-sha2-256',
                'hmac-sha2-512',
                'hmac-sha1',
                'hmac-md5'
            ],
            compress: [
                'none',
                'zlib@openssh.com',
                'zlib'
            ]
        }
    };

    if (hostConfig.sourceAuthMethod === "key" && hostConfig.sourceSSHKey) {
        connOptions.privateKey = hostConfig.sourceSSHKey;
        if (hostConfig.sourceKeyPassword) {
            connOptions.passphrase = hostConfig.sourceKeyPassword;
        }
    } else {
        connOptions.password = hostConfig.sourcePassword;
    }

    conn.connect(connOptions);
}

// Express API endpoints
app.get('/status', (req, res) => {
    res.json(getAllTunnelStatus());
});

app.get('/status/:tunnelName', (req, res) => {
    const { tunnelName } = req.params;
    const status = connectionStatus.get(tunnelName);
    
    if (!status) {
        return res.status(404).json({ error: 'Tunnel not found' });
    }
    
    res.json({ name: tunnelName, status });
});

app.post('/connect', (req, res) => {
    const hostConfig: HostConfig = req.body;
    
    if (!hostConfig || !hostConfig.name) {
        return res.status(400).json({ error: 'Invalid tunnel configuration' });
    }

    const tunnelName = hostConfig.name;
    
    // Reset retry state for new connection
    manualDisconnects.delete(tunnelName);
    retryCounters.delete(tunnelName);
    retryExhaustedTunnels.delete(tunnelName);
    
    // Store host config
    hostConfigs.set(tunnelName, hostConfig);
    
    // Start connection
    connectSSHTunnel(hostConfig, 0);
    
    res.json({ message: 'Connection request received', tunnelName });
});

app.post('/disconnect', (req, res) => {
    const { tunnelName } = req.body;
    
    if (!tunnelName) {
        return res.status(400).json({ error: 'Tunnel name required' });
    }
    
    manualDisconnects.add(tunnelName);
    retryCounters.delete(tunnelName);
    retryExhaustedTunnels.delete(tunnelName);

    if (activeRetryTimers.has(tunnelName)) {
        clearTimeout(activeRetryTimers.get(tunnelName)!);
        activeRetryTimers.delete(tunnelName);
    }

    broadcastTunnelStatus(tunnelName, {
        connected: false,
        status: CONNECTION_STATES.DISCONNECTED,
        manualDisconnect: true
    });

    const hostConfig = hostConfigs.get(tunnelName) || null;
    handleDisconnect(tunnelName, hostConfig, false);

    // Clear manual disconnect flag after a delay
    setTimeout(() => {
        manualDisconnects.delete(tunnelName);
    }, 5000);

    res.json({ message: 'Disconnect request received', tunnelName });
});

// Auto-start functionality
async function initializeAutoStartTunnels(): Promise<void> {
    try {
        // Fetch auto-start tunnels from database
        const response = await axios.get('http://localhost:8081/ssh_tunnel/tunnel?allAutoStart=1', {
            headers: {
                'Content-Type': 'application/json',
                'X-Internal-Request': '1'
            }
        });

        const tunnels = response.data || [];
        const autoStartTunnels = tunnels.filter((tunnel: any) => tunnel.autoStart);

        logger.info(`Found ${autoStartTunnels.length} auto-start tunnels`);

        for (const tunnel of autoStartTunnels) {
            const hostConfig: HostConfig = {
                name: tunnel.name,
                sourceIP: tunnel.sourceIP,
                sourceSSHPort: tunnel.sourceSSHPort,
                sourceUsername: tunnel.sourceUsername,
                sourcePassword: tunnel.sourcePassword,
                sourceAuthMethod: tunnel.sourceAuthMethod,
                sourceSSHKey: tunnel.sourceSSHKey,
                sourceKeyPassword: tunnel.sourceKeyPassword,
                sourceKeyType: tunnel.sourceKeyType,
                endpointIP: tunnel.endpointIP,
                endpointSSHPort: tunnel.endpointSSHPort,
                endpointUsername: tunnel.endpointUsername,
                endpointPassword: tunnel.endpointPassword,
                endpointAuthMethod: tunnel.endpointAuthMethod,
                endpointSSHKey: tunnel.endpointSSHKey,
                endpointKeyPassword: tunnel.endpointKeyPassword,
                endpointKeyType: tunnel.endpointKeyType,
                sourcePort: tunnel.sourcePort,
                endpointPort: tunnel.endpointPort,
                maxRetries: tunnel.maxRetries || 3,
                retryInterval: tunnel.retryInterval || 5000,
                autoStart: tunnel.autoStart,
                isPinned: tunnel.isPinned || false
            };

            hostConfigs.set(tunnel.name, hostConfig);
            
            // Start the tunnel
            setTimeout(() => {
                connectSSHTunnel(hostConfig, 0);
            }, 1000); // Stagger startup to avoid overwhelming the system
        }
    } catch (error) {
        logger.error('Failed to initialize auto-start tunnels:', error);
    }
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        activeTunnels: activeTunnels.size,
        timestamp: new Date().toISOString()
    });
});

// Get all tunnel configurations
app.get('/tunnels', (req, res) => {
    const tunnels = Array.from(hostConfigs.values());
    res.json(tunnels);
});

// Update tunnel configuration
app.put('/tunnel/:name', (req, res) => {
    const { name } = req.params;
    const hostConfig: HostConfig = req.body;
    
    if (!hostConfig || !hostConfig.name) {
        return res.status(400).json({ error: 'Invalid tunnel configuration' });
    }

    hostConfigs.set(name, hostConfig);
    
    // If tunnel is currently connected, disconnect and reconnect with new config
    if (activeTunnels.has(name)) {
        manualDisconnects.add(name);
        handleDisconnect(name, hostConfig, false);
        
        setTimeout(() => {
            manualDisconnects.delete(name);
            connectSSHTunnel(hostConfig, 0);
        }, 2000);
    }
    
    res.json({ message: 'Tunnel configuration updated', name });
});

// Delete tunnel configuration
app.delete('/tunnel/:name', (req, res) => {
    const { name } = req.params;
    
    // Disconnect if active
    if (activeTunnels.has(name)) {
        manualDisconnects.add(name);
        const hostConfig = hostConfigs.get(name) || null;
        handleDisconnect(name, hostConfig, false);
    }
    
    // Remove from configurations
    hostConfigs.delete(name);
    
    res.json({ message: 'Tunnel deleted', name });
});

// Start the server
const PORT = process.env.SSH_TUNNEL_PORT || 8083;
app.listen(PORT, () => {
    // Initialize auto-start tunnels after a short delay
    setTimeout(() => {
        initializeAutoStartTunnels();
    }, 2000);
}); 