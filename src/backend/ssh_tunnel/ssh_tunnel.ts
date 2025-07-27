import express from 'express';
import cors from 'cors';
import {Client} from 'ssh2';
import {ChildProcess} from 'child_process';
import chalk from 'chalk';
import axios from 'axios';
import * as net from 'net';

const app = express();
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
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

// State management for host-based tunnels
const activeTunnels = new Map<string, Client>(); // tunnelName -> Client
const retryCounters = new Map<string, number>(); // tunnelName -> retryCount
const connectionStatus = new Map<string, TunnelStatus>(); // tunnelName -> status
const tunnelVerifications = new Map<string, VerificationData>(); // tunnelName -> verification
const manualDisconnects = new Set<string>(); // tunnelNames
const verificationTimers = new Map<string, NodeJS.Timeout>(); // timer keys -> timeout
const activeRetryTimers = new Map<string, NodeJS.Timeout>(); // tunnelName -> retry timer
const countdownIntervals = new Map<string, NodeJS.Timeout>(); // tunnelName -> countdown interval
const retryExhaustedTunnels = new Set<string>(); // tunnelNames
const remoteClosureEvents = new Map<string, number>(); // tunnelName -> count
const tunnelConfigs = new Map<string, TunnelConfig>(); // tunnelName -> tunnelConfig
const activeTunnelProcesses = new Map<string, ChildProcess>(); // tunnelName -> ChildProcess

// Types
interface TunnelConnection {
    sourcePort: number;
    endpointPort: number;
    endpointHost: string;
    maxRetries: number;
    retryInterval: number;
    autoStart: boolean;
}

interface SSHHost {
    id: number;
    name: string;
    ip: string;
    port: number;
    username: string;
    folder: string;
    tags: string[];
    pin: boolean;
    authType: string;
    password?: string;
    key?: string;
    keyPassword?: string;
    keyType?: string;
    enableTerminal: boolean;
    enableTunnel: boolean;
    enableConfigEditor: boolean;
    defaultPath: string;
    tunnelConnections: TunnelConnection[];
    createdAt: string;
    updatedAt: string;
}

interface TunnelConfig {
    name: string;
    hostName: string;
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

interface HostConfig {
    host: SSHHost;
    tunnels: TunnelConfig[];
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
    RETRYING: "retrying",
    WAITING: "waiting"
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

// Helper to build a unique marker for each tunnel
function getTunnelMarker(tunnelName: string) {
    return `TUNNEL_MARKER_${tunnelName.replace(/[^a-zA-Z0-9]/g, '_')}`;
}

// Cleanup and disconnect functions
function cleanupTunnelResources(tunnelName: string): void {
    // Fire-and-forget remote pkill (do not block local cleanup)
    const tunnelConfig = tunnelConfigs.get(tunnelName);
    if (tunnelConfig) {
        killRemoteTunnelByMarker(tunnelConfig, tunnelName, (err) => {
            if (err) {
                logger.error(`Failed to kill remote tunnel for '${tunnelName}': ${err.message}`);
            }
        });
    }

    // Local cleanup (always run immediately)
    if (activeTunnelProcesses.has(tunnelName)) {
        try {
            const proc = activeTunnelProcesses.get(tunnelName);
            if (proc) {
                proc.kill('SIGTERM');
            }
        } catch (e) {
            logger.error(`Error while killing local ssh process for tunnel '${tunnelName}'`, e);
        }
        activeTunnelProcesses.delete(tunnelName);
    }

    if (activeTunnels.has(tunnelName)) {
        try {
            const conn = activeTunnels.get(tunnelName);
            if (conn) {
                conn.end();
            }
        } catch (e) {
            logger.error(`Error while closing SSH2 Client for tunnel '${tunnelName}'`, e);
        }
        activeTunnels.delete(tunnelName);
    }

    if (tunnelVerifications.has(tunnelName)) {
        const verification = tunnelVerifications.get(tunnelName);
        if (verification?.timeout) clearTimeout(verification.timeout);
        try {
            verification?.conn.end();
        } catch (e) {
        }
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

    if (countdownIntervals.has(tunnelName)) {
        clearInterval(countdownIntervals.get(tunnelName)!);
        countdownIntervals.delete(tunnelName);
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

    if (countdownIntervals.has(tunnelName)) {
        clearInterval(countdownIntervals.get(tunnelName)!);
        countdownIntervals.delete(tunnelName);
    }

    ['', '_confirm', '_retry', '_verify_retry'].forEach(suffix => {
        const timerKey = `${tunnelName}${suffix}`;
        if (verificationTimers.has(timerKey)) {
            clearTimeout(verificationTimers.get(timerKey)!);
            verificationTimers.delete(timerKey);
        }
    });
}

function handleDisconnect(tunnelName: string, tunnelConfig: TunnelConfig | null, shouldRetry = true, isRemoteClosure = false): void {
    if (tunnelVerifications.has(tunnelName)) {
        try {
            const verification = tunnelVerifications.get(tunnelName);
            if (verification?.timeout) clearTimeout(verification.timeout);
            verification?.conn.end();
        } catch (e) {
        }
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

    if (shouldRetry && tunnelConfig) {
        const maxRetries = tunnelConfig.maxRetries || 3;
        const retryInterval = tunnelConfig.retryInterval || 5000;

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
                nextRetryIn: retryInterval / 1000
            });

            if (activeRetryTimers.has(tunnelName)) {
                clearTimeout(activeRetryTimers.get(tunnelName)!);
                activeRetryTimers.delete(tunnelName);
            }

            const initialNextRetryIn = Math.ceil(retryInterval / 1000);
            let currentNextRetryIn = initialNextRetryIn;

            // Set initial WAITING status with countdown
            broadcastTunnelStatus(tunnelName, {
                connected: false,
                status: CONNECTION_STATES.WAITING,
                retryCount: retryCount,
                maxRetries: maxRetries,
                nextRetryIn: currentNextRetryIn
            });

            // Update countdown every second
            const countdownInterval = setInterval(() => {
                currentNextRetryIn--;
                if (currentNextRetryIn > 0) {
                    broadcastTunnelStatus(tunnelName, {
                        connected: false,
                        status: CONNECTION_STATES.WAITING,
                        retryCount: retryCount,
                        maxRetries: maxRetries,
                        nextRetryIn: currentNextRetryIn
                    });
                }
            }, 1000);

            countdownIntervals.set(tunnelName, countdownInterval);

            const timer = setTimeout(() => {
                clearInterval(countdownInterval);
                countdownIntervals.delete(tunnelName);
                activeRetryTimers.delete(tunnelName);

                if (!manualDisconnects.has(tunnelName)) {
                    activeTunnels.delete(tunnelName);

                    connectSSHTunnel(tunnelConfig, retryCount);
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
function verifyTunnelConnection(tunnelName: string, tunnelConfig: TunnelConfig, isPeriodic = false): void {
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
            } catch (e) {
            }
            tunnelVerifications.delete(tunnelName);
        }

        if (isSuccessful) {
            broadcastTunnelStatus(tunnelName, {
                connected: true,
                status: CONNECTION_STATES.CONNECTED
            });

            if (!isPeriodic) {
                setupPingInterval(tunnelName, tunnelConfig);
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
            handleDisconnect(tunnelName, tunnelConfig, !manualDisconnects.has(tunnelName));
        }
    }

    function attemptVerification() {
        const testCmd = `nc -z localhost ${tunnelConfig.sourcePort}`;

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
                    cleanupVerification(false, `Port ${tunnelConfig.sourcePort} is not accessible`);
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
        host: tunnelConfig.sourceIP,
        port: tunnelConfig.sourceSSHPort,
        username: tunnelConfig.sourceUsername,
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

    if (tunnelConfig.sourceAuthMethod === "key" && tunnelConfig.sourceSSHKey) {
        connOptions.privateKey = tunnelConfig.sourceSSHKey;
        if (tunnelConfig.sourceKeyPassword) {
            connOptions.passphrase = tunnelConfig.sourceKeyPassword;
        }
        // Add key type handling if specified
        if (tunnelConfig.sourceKeyType && tunnelConfig.sourceKeyType !== 'auto') {
            connOptions.privateKeyType = tunnelConfig.sourceKeyType;
        }
    } else if (tunnelConfig.sourceAuthMethod === "key") {
        logger.error(`SSH key authentication requested but no key provided for tunnel '${tunnelName}'`);
        broadcastTunnelStatus(tunnelName, {
            connected: false,
            status: CONNECTION_STATES.FAILED,
            reason: "SSH key authentication requested but no key provided"
        });
        return;
    } else {
        connOptions.password = tunnelConfig.sourcePassword;
    }

    verificationConn.connect(connOptions);
}

function setupPingInterval(tunnelName: string, tunnelConfig: TunnelConfig): void {
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
                handleDisconnect(tunnelName, tunnelConfig, !manualDisconnects.has(tunnelName));
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
                    handleDisconnect(tunnelName, tunnelConfig, !manualDisconnects.has(tunnelName));
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
                handleDisconnect(tunnelName, tunnelConfig, !manualDisconnects.has(tunnelName));
            });
        });
    }, 30000); // Ping every 30 seconds
}

// Main SSH tunnel connection function
function connectSSHTunnel(tunnelConfig: TunnelConfig, retryAttempt = 0): void {
    const tunnelName = tunnelConfig.name;
    const tunnelMarker = getTunnelMarker(tunnelName);

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

    // Only set status to CONNECTING if we're not already in WAITING state
    const currentStatus = connectionStatus.get(tunnelName);
    if (!currentStatus || currentStatus.status !== CONNECTION_STATES.WAITING) {
        broadcastTunnelStatus(tunnelName, {
            connected: false,
            status: CONNECTION_STATES.CONNECTING,
            retryCount: retryAttempt > 0 ? retryAttempt : undefined,
            isRemoteRetry: !!isRetryAfterRemoteClosure
        });
    }

    if (!tunnelConfig || !tunnelConfig.sourceIP || !tunnelConfig.sourceUsername || !tunnelConfig.sourceSSHPort) {
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
            } catch (e) {
            }

            activeTunnels.delete(tunnelName);

            if (!activeRetryTimers.has(tunnelName)) {
                handleDisconnect(tunnelName, tunnelConfig, !manualDisconnects.has(tunnelName));
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

        handleDisconnect(tunnelName, tunnelConfig, !shouldNotRetry, isRemoteHostClosure);
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
                handleDisconnect(tunnelName, tunnelConfig, !manualDisconnects.has(tunnelName));
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
        if (tunnelConfig.endpointAuthMethod === "key" && tunnelConfig.endpointSSHKey) {
            // For SSH key authentication, we need to create a temporary key file
            const keyFilePath = `/tmp/tunnel_key_${tunnelName.replace(/[^a-zA-Z0-9]/g, '_')}`;
            tunnelCmd = `echo '${tunnelConfig.endpointSSHKey}' > ${keyFilePath} && chmod 600 ${keyFilePath} && ssh -i ${keyFilePath} -N -o StrictHostKeyChecking=no -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -L ${tunnelConfig.sourcePort}:localhost:${tunnelConfig.endpointPort} ${tunnelConfig.endpointUsername}@${tunnelConfig.endpointIP} ${tunnelMarker} && rm -f ${keyFilePath}`;
        } else {
            tunnelCmd = `sshpass -p '${tunnelConfig.endpointPassword || ''}' ssh -N -o StrictHostKeyChecking=no -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -L ${tunnelConfig.sourcePort}:localhost:${tunnelConfig.endpointPort} ${tunnelConfig.endpointUsername}@${tunnelConfig.endpointIP} ${tunnelMarker}`;
        }

        conn.exec(tunnelCmd, (err, stream) => {
            if (err) {
                logger.error(`Connection error for '${tunnelName}': ${err.message}`);

                conn.end();

                activeTunnels.delete(tunnelName);

                const errorType = classifyError(err.message);
                const shouldNotRetry = errorType === ERROR_TYPES.AUTH ||
                    errorType === ERROR_TYPES.PORT ||
                    errorType === ERROR_TYPES.PERMISSION;

                handleDisconnect(tunnelName, tunnelConfig, !shouldNotRetry);
                return;
            }

            activeTunnels.set(tunnelName, conn);

            setTimeout(() => {
                if (!manualDisconnects.has(tunnelName) && activeTunnels.has(tunnelName)) {
                    verifyTunnelConnection(tunnelName, tunnelConfig, false);
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
                    } catch (e) {
                    }
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
                    handleDisconnect(tunnelName, tunnelConfig, !manualDisconnects.has(tunnelName), isLikelyRemoteClosure);
                } else if (retryExhaustedTunnels.has(tunnelName) && isLikelyRemoteClosure) {
                    retryExhaustedTunnels.delete(tunnelName);
                    retryCounters.delete(tunnelName);
                    handleDisconnect(tunnelName, tunnelConfig, true, true);
                }
            });

            stream.stdout?.on("data", (data: Buffer) => {
                // Ignore stdout data
            });

            stream.on("error", (err: Error) => {
                // Ignore stream errors
            });

            stream.stderr.on("data", (data) => {
                const errorMsg = data.toString().trim();

                const isNonRetryableError = errorMsg.includes("Permission denied") ||
                    errorMsg.includes("Authentication failed") ||
                    errorMsg.includes("failed for listen port") ||
                    errorMsg.includes("address already in use") ||
                    errorMsg.includes("bind: Address already in use") ||
                    errorMsg.includes("channel 0: open failed") ||
                    errorMsg.includes("remote port forwarding failed");

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

                    handleDisconnect(tunnelName, tunnelConfig, !shouldNotRetry, isRemoteHostClosure);
                }
            });
        });
    });

    const connOptions: any = {
        host: tunnelConfig.sourceIP,
        port: tunnelConfig.sourceSSHPort,
        username: tunnelConfig.sourceUsername,
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

    if (tunnelConfig.sourceAuthMethod === "key" && tunnelConfig.sourceSSHKey) {
        // Validate SSH key format
        if (!tunnelConfig.sourceSSHKey.includes('-----BEGIN')) {
            logger.error(`Invalid SSH key format for tunnel '${tunnelName}'. Key should start with '-----BEGIN'`);
            broadcastTunnelStatus(tunnelName, {
                connected: false,
                status: CONNECTION_STATES.FAILED,
                reason: "Invalid SSH key format"
            });
            return;
        }

        connOptions.privateKey = tunnelConfig.sourceSSHKey;
        if (tunnelConfig.sourceKeyPassword) {
            connOptions.passphrase = tunnelConfig.sourceKeyPassword;
        }
        // Add key type handling if specified
        if (tunnelConfig.sourceKeyType && tunnelConfig.sourceKeyType !== 'auto') {
            connOptions.privateKeyType = tunnelConfig.sourceKeyType;
        }
    } else if (tunnelConfig.sourceAuthMethod === "key") {
        logger.error(`SSH key authentication requested but no key provided for tunnel '${tunnelName}'`);
        broadcastTunnelStatus(tunnelName, {
            connected: false,
            status: CONNECTION_STATES.FAILED,
            reason: "SSH key authentication requested but no key provided"
        });
        return;
    } else {
        connOptions.password = tunnelConfig.sourcePassword;
    }

    // Test basic network connectivity first
    const testSocket = new net.Socket();
    testSocket.setTimeout(5000);

    testSocket.on('connect', () => {
        testSocket.destroy();

        // Only update status to CONNECTING if we're not already in WAITING state
        const currentStatus = connectionStatus.get(tunnelName);
        if (!currentStatus || currentStatus.status !== CONNECTION_STATES.WAITING) {
            broadcastTunnelStatus(tunnelName, {
                connected: false,
                status: CONNECTION_STATES.CONNECTING,
                retryCount: retryAttempt > 0 ? retryAttempt : undefined,
                isRemoteRetry: !!isRetryAfterRemoteClosure
            });
        }

        conn.connect(connOptions);
    });

    testSocket.on('timeout', () => {
        testSocket.destroy();
        broadcastTunnelStatus(tunnelName, {
            connected: false,
            status: CONNECTION_STATES.FAILED,
            reason: "Network connectivity test failed - server not reachable"
        });
    });

    testSocket.on('error', (err: any) => {
        testSocket.destroy();
        broadcastTunnelStatus(tunnelName, {
            connected: false,
            status: CONNECTION_STATES.FAILED,
            reason: `Network connectivity test failed - ${err.message}`
        });
    });

    testSocket.connect(tunnelConfig.sourceSSHPort, tunnelConfig.sourceIP);
}

// Add a helper to kill the tunnel by marker
function killRemoteTunnelByMarker(tunnelConfig: TunnelConfig, tunnelName: string, callback: (err?: Error) => void) {
    const tunnelMarker = getTunnelMarker(tunnelName);
    const conn = new Client();
    const connOptions: any = {
        host: tunnelConfig.sourceIP,
        port: tunnelConfig.sourceSSHPort,
        username: tunnelConfig.sourceUsername,
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
    if (tunnelConfig.sourceAuthMethod === "key" && tunnelConfig.sourceSSHKey) {
        connOptions.privateKey = tunnelConfig.sourceSSHKey;
        if (tunnelConfig.sourceKeyPassword) {
            connOptions.passphrase = tunnelConfig.sourceKeyPassword;
        }
        if (tunnelConfig.sourceKeyType && tunnelConfig.sourceKeyType !== 'auto') {
            connOptions.privateKeyType = tunnelConfig.sourceKeyType;
        }
    } else {
        connOptions.password = tunnelConfig.sourcePassword;
    }
    conn.on('ready', () => {
        // Use pkill to kill the tunnel by marker
        const killCmd = `pkill -f '${tunnelMarker}'`;
        conn.exec(killCmd, (err, stream) => {
            if (err) {
                conn.end();
                callback(err);
                return;
            }
            stream.on('close', () => {
                conn.end();
                callback();
            });
            stream.on('data', () => {});
            stream.stderr.on('data', () => {});
        });
    });
    conn.on('error', (err) => {
        callback(err);
    });
    conn.connect(connOptions);
}

// Express API endpoints
app.get('/status', (req, res) => {
    res.json(getAllTunnelStatus());
});

app.get('/status/:tunnelName', (req, res) => {
    const {tunnelName} = req.params;
    const status = connectionStatus.get(tunnelName);

    if (!status) {
        return res.status(404).json({error: 'Tunnel not found'});
    }

    res.json({name: tunnelName, status});
});

app.post('/connect', (req, res) => {
    const tunnelConfig: TunnelConfig = req.body;

    if (!tunnelConfig || !tunnelConfig.name) {
        return res.status(400).json({error: 'Invalid tunnel configuration'});
    }

    const tunnelName = tunnelConfig.name;


    // Reset retry state for new connection
    manualDisconnects.delete(tunnelName);
    retryCounters.delete(tunnelName);
    retryExhaustedTunnels.delete(tunnelName);

    // Store tunnel config
    tunnelConfigs.set(tunnelName, tunnelConfig);

    // Start connection
    connectSSHTunnel(tunnelConfig, 0);

    res.json({message: 'Connection request received', tunnelName});
});

app.post('/disconnect', (req, res) => {
    const {tunnelName} = req.body;

    if (!tunnelName) {
        return res.status(400).json({error: 'Tunnel name required'});
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

    const tunnelConfig = tunnelConfigs.get(tunnelName) || null;
    handleDisconnect(tunnelName, tunnelConfig, false);

    // Clear manual disconnect flag after a delay
    setTimeout(() => {
        manualDisconnects.delete(tunnelName);
    }, 5000);

    res.json({message: 'Disconnect request received', tunnelName});
});

app.post('/cancel', (req, res) => {
    const {tunnelName} = req.body;

    if (!tunnelName) {
        return res.status(400).json({error: 'Tunnel name required'});
    }

    // Cancel retry operations
    retryCounters.delete(tunnelName);
    retryExhaustedTunnels.delete(tunnelName);

    if (activeRetryTimers.has(tunnelName)) {
        clearTimeout(activeRetryTimers.get(tunnelName)!);
        activeRetryTimers.delete(tunnelName);
    }

    if (countdownIntervals.has(tunnelName)) {
        clearInterval(countdownIntervals.get(tunnelName)!);
        countdownIntervals.delete(tunnelName);
    }

    // Set status to disconnected
    broadcastTunnelStatus(tunnelName, {
        connected: false,
        status: CONNECTION_STATES.DISCONNECTED,
        manualDisconnect: true
    });

    // Clean up any existing tunnel resources
    const tunnelConfig = tunnelConfigs.get(tunnelName) || null;
    handleDisconnect(tunnelName, tunnelConfig, false);

    // Clear manual disconnect flag after a delay
    setTimeout(() => {
        manualDisconnects.delete(tunnelName);
    }, 5000);

    res.json({message: 'Cancel request received', tunnelName});
});

// Auto-start functionality
async function initializeAutoStartTunnels(): Promise<void> {
    try {
        // Fetch hosts with auto-start tunnel connections from the new internal endpoint
        const response = await axios.get('http://localhost:8081/ssh/host/internal', {
            headers: {
                'Content-Type': 'application/json',
                'X-Internal-Request': '1'
            }
        });

        const hosts: SSHHost[] = response.data || [];
        const autoStartTunnels: TunnelConfig[] = [];

        // Process each host and extract auto-start tunnel connections
        for (const host of hosts) {
            if (host.enableTunnel && host.tunnelConnections) {
                for (const tunnelConnection of host.tunnelConnections) {
                    if (tunnelConnection.autoStart) {
                        // Find the endpoint host
                        const endpointHost = hosts.find(h =>
                            h.name === tunnelConnection.endpointHost ||
                            `${h.username}@${h.ip}` === tunnelConnection.endpointHost
                        );

                        if (endpointHost) {
                            const tunnelConfig: TunnelConfig = {
                                name: `${host.name || `${host.username}@${host.ip}`}_${tunnelConnection.sourcePort}_${tunnelConnection.endpointPort}`,
                                hostName: host.name || `${host.username}@${host.ip}`,
                                sourceIP: host.ip,
                                sourceSSHPort: host.port,
                                sourceUsername: host.username,
                                sourcePassword: host.password,
                                sourceAuthMethod: host.authType,
                                sourceSSHKey: host.key,
                                sourceKeyPassword: host.keyPassword,
                                sourceKeyType: host.keyType,
                                endpointIP: endpointHost.ip,
                                endpointSSHPort: endpointHost.port,
                                endpointUsername: endpointHost.username,
                                endpointPassword: endpointHost.password,
                                endpointAuthMethod: endpointHost.authType,
                                endpointSSHKey: endpointHost.key,
                                endpointKeyPassword: endpointHost.keyPassword,
                                endpointKeyType: endpointHost.keyType,
                                sourcePort: tunnelConnection.sourcePort,
                                endpointPort: tunnelConnection.endpointPort,
                                maxRetries: tunnelConnection.maxRetries,
                                retryInterval: tunnelConnection.retryInterval * 1000,
                                autoStart: tunnelConnection.autoStart,
                                isPinned: host.pin
                            };

                            autoStartTunnels.push(tunnelConfig);
                        }
                    }
                }
            }
        }

        logger.info(`Found ${autoStartTunnels.length} auto-start tunnels`);

        // Start each auto-start tunnel
        for (const tunnelConfig of autoStartTunnels) {
            tunnelConfigs.set(tunnelConfig.name, tunnelConfig);

            // Start the tunnel with a delay to avoid overwhelming the system
            setTimeout(() => {
                connectSSHTunnel(tunnelConfig, 0);
            }, 1000);
        }
    } catch (error: any) {
        logger.error('Failed to initialize auto-start tunnels:', error.message);
    }
}

const PORT = 8083;
app.listen(PORT, () => {
    setTimeout(() => {
        initializeAutoStartTunnels();
    }, 2000);
}); 