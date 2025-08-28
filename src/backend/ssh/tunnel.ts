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

const activeTunnels = new Map<string, Client>();
const retryCounters = new Map<string, number>();
const connectionStatus = new Map<string, TunnelStatus>();
const tunnelVerifications = new Map<string, VerificationData>();
const manualDisconnects = new Set<string>();
const verificationTimers = new Map<string, NodeJS.Timeout>();
const activeRetryTimers = new Map<string, NodeJS.Timeout>();
const countdownIntervals = new Map<string, NodeJS.Timeout>();
const retryExhaustedTunnels = new Set<string>();

const tunnelConfigs = new Map<string, TunnelConfig>();
const activeTunnelProcesses = new Map<string, ChildProcess>();

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
    enableFileManager: boolean;
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
        message.includes("timed out") ||
        message.includes("keepalive timeout")) {
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

function getTunnelMarker(tunnelName: string) {
    return `TUNNEL_MARKER_${tunnelName.replace(/[^a-zA-Z0-9]/g, '_')}`;
}

function cleanupTunnelResources(tunnelName: string): void {
    const tunnelConfig = tunnelConfigs.get(tunnelName);
    if (tunnelConfig) {
        killRemoteTunnelByMarker(tunnelConfig, tunnelName, (err) => {
            if (err) {
                logger.error(`Failed to kill remote tunnel for '${tunnelName}': ${err.message}`);
            }
        });
    }

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
        `${tunnelName}_verify_retry`,
        `${tunnelName}_ping`
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

    if (activeRetryTimers.has(tunnelName)) {
        clearTimeout(activeRetryTimers.get(tunnelName)!);
        activeRetryTimers.delete(tunnelName);
    }

    if (countdownIntervals.has(tunnelName)) {
        clearInterval(countdownIntervals.get(tunnelName)!);
        countdownIntervals.delete(tunnelName);
    }

    ['', '_confirm', '_retry', '_verify_retry', '_ping'].forEach(suffix => {
        const timerKey = `${tunnelName}${suffix}`;
        if (verificationTimers.has(timerKey)) {
            clearTimeout(verificationTimers.get(timerKey)!);
            verificationTimers.delete(timerKey);
        }
    });
}

function handleDisconnect(tunnelName: string, tunnelConfig: TunnelConfig | null, shouldRetry = true): void {
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

        let retryCount = retryCounters.get(tunnelName) || 0;
        retryCount = retryCount + 1;

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

            broadcastTunnelStatus(tunnelName, {
                connected: false,
                status: CONNECTION_STATES.WAITING,
                retryCount: retryCount,
                maxRetries: maxRetries,
                nextRetryIn: currentNextRetryIn
            });

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

function verifyTunnelConnection(tunnelName: string, tunnelConfig: TunnelConfig, isPeriodic = false): void {
    if (isPeriodic) {
        if (!activeTunnels.has(tunnelName)) {
            broadcastTunnelStatus(tunnelName, {
                connected: false,
                status: CONNECTION_STATES.DISCONNECTED,
                reason: 'Tunnel connection lost'
            });
        }
    }
}

function setupPingInterval(tunnelName: string, tunnelConfig: TunnelConfig): void {
    const pingKey = `${tunnelName}_ping`;
    if (verificationTimers.has(pingKey)) {
        clearInterval(verificationTimers.get(pingKey)!);
        verificationTimers.delete(pingKey);
    }
    
    const pingInterval = setInterval(() => {
        const currentStatus = connectionStatus.get(tunnelName);
        if (currentStatus?.status === CONNECTION_STATES.CONNECTED) {
            if (!activeTunnels.has(tunnelName)) {
                broadcastTunnelStatus(tunnelName, {
                    connected: false,
                    status: CONNECTION_STATES.DISCONNECTED,
                    reason: 'Tunnel connection lost'
                });
                clearInterval(pingInterval);
                verificationTimers.delete(pingKey);
            }
        } else {
            clearInterval(pingInterval);
            verificationTimers.delete(pingKey);
        }
    }, 120000);
    
    verificationTimers.set(pingKey, pingInterval);
}

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
    }

    const currentStatus = connectionStatus.get(tunnelName);
    if (!currentStatus || currentStatus.status !== CONNECTION_STATES.WAITING) {
        broadcastTunnelStatus(tunnelName, {
            connected: false,
            status: CONNECTION_STATES.CONNECTING,
            retryCount: retryAttempt > 0 ? retryAttempt : undefined
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
    }, 60000);

    conn.on("error", (err) => {
        clearTimeout(connectionTimeout);
        logger.error(`SSH error for '${tunnelName}': ${err.message}`);

        if (activeRetryTimers.has(tunnelName)) {
            return;
        }

        const errorType = classifyError(err.message);

        if (!manualDisconnects.has(tunnelName)) {
            broadcastTunnelStatus(tunnelName, {
                connected: false,
                status: CONNECTION_STATES.FAILED,
                errorType: errorType,
                reason: err.message
            });
        }

        activeTunnels.delete(tunnelName);

        const shouldNotRetry = errorType === ERROR_TYPES.AUTH ||
            errorType === ERROR_TYPES.PORT ||
            errorType === ERROR_TYPES.PERMISSION ||
            manualDisconnects.has(tunnelName);
        


        handleDisconnect(tunnelName, tunnelConfig, !shouldNotRetry);
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
            const keyFilePath = `/tmp/tunnel_key_${tunnelName.replace(/[^a-zA-Z0-9]/g, '_')}`;
            tunnelCmd = `echo '${tunnelConfig.endpointSSHKey}' > ${keyFilePath} && chmod 600 ${keyFilePath} && ssh -i ${keyFilePath} -N -o StrictHostKeyChecking=no -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -R ${tunnelConfig.endpointPort}:localhost:${tunnelConfig.sourcePort} ${tunnelConfig.endpointUsername}@${tunnelConfig.endpointIP} ${tunnelMarker} && rm -f ${keyFilePath}`;
        } else {
            tunnelCmd = `sshpass -p '${tunnelConfig.endpointPassword || ''}' ssh -N -o StrictHostKeyChecking=no -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -R ${tunnelConfig.endpointPort}:localhost:${tunnelConfig.sourcePort} ${tunnelConfig.endpointUsername}@${tunnelConfig.endpointIP} ${tunnelMarker}`;
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
                    broadcastTunnelStatus(tunnelName, {
                        connected: true,
                        status: CONNECTION_STATES.CONNECTED
                    });
                    setupPingInterval(tunnelName, tunnelConfig);
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
                    handleDisconnect(tunnelName, tunnelConfig, !manualDisconnects.has(tunnelName));
                } else if (retryExhaustedTunnels.has(tunnelName) && isLikelyRemoteClosure) {
                    retryExhaustedTunnels.delete(tunnelName);
                    retryCounters.delete(tunnelName);
                    handleDisconnect(tunnelName, tunnelConfig, true);
                }
            });

            stream.stdout?.on("data", (data: Buffer) => {
            });

            stream.on("error", (err: Error) => {
            });

            stream.stderr.on("data", (data) => {
                const errorMsg = data.toString().trim();
            });
        });
    });

    const connOptions: any = {
        host: tunnelConfig.sourceIP,
        port: tunnelConfig.sourceSSHPort,
        username: tunnelConfig.sourceUsername,
        keepaliveInterval: 30000, 
        keepaliveCountMax: 3,
        readyTimeout: 60000,
        tcpKeepAlive: true,
        tcpKeepAliveInitialDelay: 15000,
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
        if (!tunnelConfig.sourceSSHKey.includes('-----BEGIN') || !tunnelConfig.sourceSSHKey.includes('-----END')) {
            logger.error(`Invalid SSH key format for tunnel '${tunnelName}'. Key should contain both BEGIN and END markers`);
            broadcastTunnelStatus(tunnelName, {
                connected: false,
                status: CONNECTION_STATES.FAILED,
                reason: "Invalid SSH key format"
            });
            return;
        }

        const cleanKey = tunnelConfig.sourceSSHKey.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        connOptions.privateKey = Buffer.from(cleanKey, 'utf8');
        if (tunnelConfig.sourceKeyPassword) {
            connOptions.passphrase = tunnelConfig.sourceKeyPassword;
        }
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

    const finalStatus = connectionStatus.get(tunnelName);
    if (!finalStatus || finalStatus.status !== CONNECTION_STATES.WAITING) {
        broadcastTunnelStatus(tunnelName, {
            connected: false,
            status: CONNECTION_STATES.CONNECTING,
            retryCount: retryAttempt > 0 ? retryAttempt : undefined
        });
    }

    conn.connect(connOptions);
}

function killRemoteTunnelByMarker(tunnelConfig: TunnelConfig, tunnelName: string, callback: (err?: Error) => void) {
    const tunnelMarker = getTunnelMarker(tunnelName);
    const conn = new Client();
    const connOptions: any = {
        host: tunnelConfig.sourceIP,
        port: tunnelConfig.sourceSSHPort,
        username: tunnelConfig.sourceUsername,
        keepaliveInterval: 30000,
        keepaliveCountMax: 3,
        readyTimeout: 60000,
        tcpKeepAlive: true,
        tcpKeepAliveInitialDelay: 15000,
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
        if (!tunnelConfig.sourceSSHKey.includes('-----BEGIN') || !tunnelConfig.sourceSSHKey.includes('-----END')) {
            callback(new Error('Invalid SSH key format'));
            return;
        }
        
        const cleanKey = tunnelConfig.sourceSSHKey.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        connOptions.privateKey = Buffer.from(cleanKey, 'utf8');
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
            stream.on('data', () => {
            });
            stream.stderr.on('data', () => {
            });
        });
    });
    conn.on('error', (err) => {
        callback(err);
    });
    conn.connect(connOptions);
}

app.get('/ssh/tunnel/status', (req, res) => {
    res.json(getAllTunnelStatus());
});

app.get('/ssh/tunnel/status/:tunnelName', (req, res) => {
    const {tunnelName} = req.params;
    const status = connectionStatus.get(tunnelName);

    if (!status) {
        return res.status(404).json({error: 'Tunnel not found'});
    }

    res.json({name: tunnelName, status});
});

app.post('/ssh/tunnel/connect', (req, res) => {
    const tunnelConfig: TunnelConfig = req.body;

    if (!tunnelConfig || !tunnelConfig.name) {
        return res.status(400).json({error: 'Invalid tunnel configuration'});
    }

    const tunnelName = tunnelConfig.name;

    manualDisconnects.delete(tunnelName);
    retryCounters.delete(tunnelName);
    retryExhaustedTunnels.delete(tunnelName);

    tunnelConfigs.set(tunnelName, tunnelConfig);

    connectSSHTunnel(tunnelConfig, 0);

    res.json({message: 'Connection request received', tunnelName});
});

app.post('/ssh/tunnel/disconnect', (req, res) => {
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

    setTimeout(() => {
        manualDisconnects.delete(tunnelName);
    }, 5000);

    res.json({message: 'Disconnect request received', tunnelName});
});

app.post('/ssh/tunnel/cancel', (req, res) => {
    const {tunnelName} = req.body;

    if (!tunnelName) {
        return res.status(400).json({error: 'Tunnel name required'});
    }

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

    broadcastTunnelStatus(tunnelName, {
        connected: false,
        status: CONNECTION_STATES.DISCONNECTED,
        manualDisconnect: true
    });

    const tunnelConfig = tunnelConfigs.get(tunnelName) || null;
    handleDisconnect(tunnelName, tunnelConfig, false);

    setTimeout(() => {
        manualDisconnects.delete(tunnelName);
    }, 5000);

    res.json({message: 'Cancel request received', tunnelName});
});

async function initializeAutoStartTunnels(): Promise<void> {
    try {
        const response = await axios.get('http://localhost:8081/ssh/db/host/internal', {
            headers: {
                'Content-Type': 'application/json',
                'X-Internal-Request': '1'
            }
        });

        const hosts: SSHHost[] = response.data || [];
        const autoStartTunnels: TunnelConfig[] = [];

        for (const host of hosts) {
            if (host.enableTunnel && host.tunnelConnections) {
                for (const tunnelConnection of host.tunnelConnections) {
                    if (tunnelConnection.autoStart) {
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

        for (const tunnelConfig of autoStartTunnels) {
            tunnelConfigs.set(tunnelConfig.name, tunnelConfig);

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