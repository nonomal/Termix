import {WebSocketServer, WebSocket, type RawData} from 'ws';
import {Client, type ClientChannel, type PseudoTtyOptions} from 'ssh2';
import chalk from 'chalk';

const wss = new WebSocketServer({port: 8082});




const sshIconSymbol = '🖥️';
const getTimeStamp = (): string => chalk.gray(`[${new Date().toLocaleTimeString()}]`);
const formatMessage = (level: string, colorFn: chalk.Chalk, message: string): string => {
    return `${getTimeStamp()} ${colorFn(`[${level.toUpperCase()}]`)} ${chalk.hex('#1e3a8a')(`[${sshIconSymbol}]`)} ${message}`;
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



wss.on('connection', (ws: WebSocket) => {
    let sshConn: Client | null = null;
    let sshStream: ClientChannel | null = null;
    let pingInterval: NodeJS.Timeout | null = null;



    ws.on('close', () => {
        cleanupSSH();
    });

    ws.on('message', (msg: RawData) => {


        let parsed: any;
        try {
            parsed = JSON.parse(msg.toString());
        } catch (e) {
            logger.error('Invalid JSON received: ' + msg.toString());
            ws.send(JSON.stringify({type: 'error', message: 'Invalid JSON'}));
            return;
        }

        const {type, data} = parsed;

        switch (type) {
            case 'connectToHost':
                handleConnectToHost(data);
                break;

            case 'resize':
                handleResize(data);
                break;

            case 'disconnect':
                cleanupSSH();
                break;

            case 'input':
                if (sshStream) {
                    if (data === '\t') {
                        sshStream.write(data);
                    } else if (data.startsWith('\x1b')) {
                        sshStream.write(data);
                    } else {
                        sshStream.write(Buffer.from(data, 'utf8'));
                    }
                }
                break;

            case 'ping':
                ws.send(JSON.stringify({type: 'pong'}));
                break;

            default:
                logger.warn('Unknown message type: ' + type);
        }
    });

    function handleConnectToHost(data: {
        cols: number;
        rows: number;
        hostConfig: {
            ip: string;
            port: number;
            username: string;
            password?: string;
            key?: string;
            keyPassword?: string;
            keyType?: string;
            authType?: string;
        };
    }) {
        const {cols, rows, hostConfig} = data;
        const {ip, port, username, password, key, keyPassword, keyType, authType} = hostConfig;

        if (!username || typeof username !== 'string' || username.trim() === '') {
            logger.error('Invalid username provided');
            ws.send(JSON.stringify({type: 'error', message: 'Invalid username provided'}));
            return;
        }

        if (!ip || typeof ip !== 'string' || ip.trim() === '') {
            logger.error('Invalid IP provided');
            ws.send(JSON.stringify({type: 'error', message: 'Invalid IP provided'}));
            return;
        }

        if (!port || typeof port !== 'number' || port <= 0) {
            logger.error('Invalid port provided');
            ws.send(JSON.stringify({type: 'error', message: 'Invalid port provided'}));
            return;
        }

        sshConn = new Client();

        const connectionTimeout = setTimeout(() => {
            if (sshConn) {
                logger.error('SSH connection timeout');
                ws.send(JSON.stringify({type: 'error', message: 'SSH connection timeout'}));
                cleanupSSH(connectionTimeout);
            }
        }, 15000);

        sshConn.on('ready', () => {
            clearTimeout(connectionTimeout);


            sshConn!.shell({
                rows: data.rows,
                cols: data.cols,
                term: 'xterm-256color'
            } as PseudoTtyOptions, (err, stream) => {
                if (err) {
                    logger.error('Shell error: ' + err.message);
                    ws.send(JSON.stringify({type: 'error', message: 'Shell error: ' + err.message}));
                    return;
                }

                sshStream = stream;

                stream.on('data', (data: Buffer) => {
                    ws.send(JSON.stringify({type: 'data', data: data.toString()}));
                });

                stream.on('close', () => {

                    ws.send(JSON.stringify({type: 'disconnected', message: 'Connection lost'}));
                });

                stream.on('error', (err: Error) => {
                    logger.error('SSH stream error: ' + err.message);
                    ws.send(JSON.stringify({type: 'error', message: 'SSH stream error: ' + err.message}));
                });

                setupPingInterval();

                ws.send(JSON.stringify({type: 'connected', message: 'SSH connected'}));
            });
        });

        sshConn.on('error', (err: Error) => {
            clearTimeout(connectionTimeout);
            logger.error('SSH connection error: ' + err.message);

            let errorMessage = 'SSH error: ' + err.message;
            if (err.message.includes('No matching key exchange algorithm')) {
                errorMessage = 'SSH error: No compatible key exchange algorithm found. This may be due to an older SSH server or network device.';
            } else if (err.message.includes('No matching cipher')) {
                errorMessage = 'SSH error: No compatible cipher found. This may be due to an older SSH server or network device.';
            } else if (err.message.includes('No matching MAC')) {
                errorMessage = 'SSH error: No compatible MAC algorithm found. This may be due to an older SSH server or network device.';
            } else if (err.message.includes('ENOTFOUND') || err.message.includes('ENOENT')) {
                errorMessage = 'SSH error: Could not resolve hostname or connect to server.';
            } else if (err.message.includes('ECONNREFUSED')) {
                errorMessage = 'SSH error: Connection refused. The server may not be running or the port may be incorrect.';
            } else if (err.message.includes('ETIMEDOUT')) {
                errorMessage = 'SSH error: Connection timed out. Check your network connection and server availability.';
            } else if (err.message.includes('ECONNRESET') || err.message.includes('EPIPE')) {
                errorMessage = 'SSH error: Connection was reset. This may be due to network issues or server timeout.';
            } else if (err.message.includes('authentication failed') || err.message.includes('Permission denied')) {
                errorMessage = 'SSH error: Authentication failed. Please check your username and password/key.';
            }

            ws.send(JSON.stringify({type: 'error', message: errorMessage}));
            cleanupSSH(connectionTimeout);
        });

        sshConn.on('close', () => {
            clearTimeout(connectionTimeout);

            cleanupSSH(connectionTimeout);
        });



        const connectConfig: any = {
            host: ip,
            port,
            username,
            keepaliveInterval: 30000,
            keepaliveCountMax: 3,
            readyTimeout: 10000,
            tcpKeepAlive: true,
            tcpKeepAliveInitialDelay: 30000,

            env: {
                TERM: 'xterm-256color',
                LANG: 'en_US.UTF-8',
                LC_ALL: 'en_US.UTF-8',
                LC_CTYPE: 'en_US.UTF-8',
                LC_MESSAGES: 'en_US.UTF-8',
                LC_MONETARY: 'en_US.UTF-8',
                LC_NUMERIC: 'en_US.UTF-8',
                LC_TIME: 'en_US.UTF-8',
                LC_COLLATE: 'en_US.UTF-8',
                COLORTERM: 'truecolor',
            },

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
        if (authType === 'key' && key) {
            try {
                if (!key.includes('-----BEGIN') || !key.includes('-----END')) {
                    throw new Error('Invalid private key format');
                }
             
                const cleanKey = key.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n');
                
                connectConfig.privateKey = Buffer.from(cleanKey, 'utf8');
                
                if (keyPassword) {
                    connectConfig.passphrase = keyPassword;
                }
                
                if (keyType && keyType !== 'auto') {
                    connectConfig.privateKeyType = keyType;
                }
            } catch (keyError) {
                logger.error('SSH key format error: ' + keyError.message);
                ws.send(JSON.stringify({type: 'error', message: 'SSH key format error: Invalid private key format'}));
                return;
            }
        } else if (authType === 'key') {
            logger.error('SSH key authentication requested but no key provided');
            ws.send(JSON.stringify({type: 'error', message: 'SSH key authentication requested but no key provided'}));
            return;
        } else {
            connectConfig.password = password;
        }

        sshConn.connect(connectConfig);
    }

    function handleResize(data: { cols: number; rows: number }) {
        if (sshStream && sshStream.setWindow) {
            sshStream.setWindow(data.rows, data.cols, data.rows, data.cols);
            ws.send(JSON.stringify({type: 'resized', cols: data.cols, rows: data.rows}));
        }
    }

    function cleanupSSH(timeoutId?: NodeJS.Timeout) {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }

        if (pingInterval) {
            clearInterval(pingInterval);
            pingInterval = null;
        }

        if (sshStream) {
            try {
                sshStream.end();
            } catch (e: any) {
                logger.error('Error closing stream: ' + e.message);
            }
            sshStream = null;
        }

        if (sshConn) {
            try {
                sshConn.end();
            } catch (e: any) {
                logger.error('Error closing connection: ' + e.message);
            }
            sshConn = null;
        }
    }

    function setupPingInterval() {
        pingInterval = setInterval(() => {
            if (sshConn && sshStream) {
                try {
                    sshStream.write('\x00');
                } catch (e: any) {
                    logger.error('SSH keepalive failed: ' + e.message);
                    cleanupSSH();
                }
            }
        }, 60000);
    }


});
