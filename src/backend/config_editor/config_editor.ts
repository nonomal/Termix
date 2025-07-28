import express from 'express';
import cors from 'cors';
import {Client as SSHClient} from 'ssh2';
import chalk from "chalk";

const app = express();

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

const sshIconSymbol = '📁';
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

interface SSHSession {
    client: SSHClient;
    isConnected: boolean;
    lastActive: number;
    timeout?: NodeJS.Timeout;
}

const sshSessions: Record<string, SSHSession> = {};
const SESSION_TIMEOUT_MS = 10 * 60 * 1000;

function cleanupSession(sessionId: string) {
    const session = sshSessions[sessionId];
    if (session) {
        try {
            session.client.end();
        } catch {
        }
        clearTimeout(session.timeout);
        delete sshSessions[sessionId];
    }
}

function scheduleSessionCleanup(sessionId: string) {
    const session = sshSessions[sessionId];
    if (session) {
        if (session.timeout) clearTimeout(session.timeout);
        session.timeout = setTimeout(() => cleanupSession(sessionId), SESSION_TIMEOUT_MS);
    }
}

app.post('/ssh/config_editor/ssh/connect', (req, res) => {
    const {sessionId, ip, port, username, password, sshKey, keyPassword} = req.body;
    if (!sessionId || !ip || !username || !port) {
        return res.status(400).json({error: 'Missing SSH connection parameters'});
    }

    if (sshSessions[sessionId]?.isConnected) cleanupSession(sessionId);
    const client = new SSHClient();
    const config: any = {
        host: ip,
        port: port || 22,
        username,
        readyTimeout: 20000,
        keepaliveInterval: 10000,
        keepaliveCountMax: 3,
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

    if (sshKey && sshKey.trim()) {
        config.privateKey = sshKey;
        if (keyPassword) config.passphrase = keyPassword;
    } else if (password && password.trim()) {
        config.password = password;
    } else {
        return res.status(400).json({error: 'Either password or SSH key must be provided'});
    }

    let responseSent = false;

    client.on('ready', () => {
        if (responseSent) return;
        responseSent = true;
        sshSessions[sessionId] = {client, isConnected: true, lastActive: Date.now()};
        scheduleSessionCleanup(sessionId);
        res.json({status: 'success', message: 'SSH connection established'});
    });

    client.on('error', (err) => {
        if (responseSent) return;
        responseSent = true;
        logger.error(`SSH connection error for session ${sessionId}:`, err.message);
        res.status(500).json({status: 'error', message: err.message});
    });

    client.on('close', () => {
        if (sshSessions[sessionId]) sshSessions[sessionId].isConnected = false;
        cleanupSession(sessionId);
    });

    client.connect(config);
});

app.post('/ssh/config_editor/ssh/disconnect', (req, res) => {
    const {sessionId} = req.body;
    cleanupSession(sessionId);
    res.json({status: 'success', message: 'SSH connection disconnected'});
});

app.get('/ssh/config_editor/ssh/status', (req, res) => {
    const sessionId = req.query.sessionId as string;
    const isConnected = !!sshSessions[sessionId]?.isConnected;
    res.json({status: 'success', connected: isConnected});
});

app.get('/ssh/config_editor/ssh/listFiles', (req, res) => {
    const sessionId = req.query.sessionId as string;
    const sshConn = sshSessions[sessionId];
    const sshPath = decodeURIComponent((req.query.path as string) || '/');

    if (!sessionId) {
        return res.status(400).json({error: 'Session ID is required'});
    }

    if (!sshConn?.isConnected) {
        return res.status(400).json({error: 'SSH connection not established'});
    }

    sshConn.lastActive = Date.now();
    scheduleSessionCleanup(sessionId);

    const escapedPath = sshPath.replace(/'/g, "'\"'\"'");
    sshConn.client.exec(`ls -la '${escapedPath}'`, (err, stream) => {
        if (err) {
            logger.error('SSH listFiles error:', err);
            return res.status(500).json({error: err.message});
        }

        let data = '';
        let errorData = '';

        stream.on('data', (chunk: Buffer) => {
            data += chunk.toString();
        });

        stream.stderr.on('data', (chunk: Buffer) => {
            errorData += chunk.toString();
        });

        stream.on('close', (code) => {
            if (code !== 0) {
                logger.error(`SSH listFiles command failed with code ${code}: ${errorData.replace(/\n/g, ' ').trim()}`);
                return res.status(500).json({error: `Command failed: ${errorData}`});
            }

            const lines = data.split('\n').filter(line => line.trim());
            const files = [];

            for (let i = 1; i < lines.length; i++) {
                const line = lines[i];
                const parts = line.split(/\s+/);
                if (parts.length >= 9) {
                    const permissions = parts[0];
                    const name = parts.slice(8).join(' ');
                    const isDirectory = permissions.startsWith('d');
                    const isLink = permissions.startsWith('l');

                    if (name === '.' || name === '..') continue;

                    files.push({
                        name,
                        type: isDirectory ? 'directory' : (isLink ? 'link' : 'file')
                    });
                }
            }

            res.json(files);
        });
    });
});

app.get('/ssh/config_editor/ssh/readFile', (req, res) => {
    const sessionId = req.query.sessionId as string;
    const sshConn = sshSessions[sessionId];
    const filePath = decodeURIComponent(req.query.path as string);

    if (!sessionId) {
        return res.status(400).json({error: 'Session ID is required'});
    }

    if (!sshConn?.isConnected) {
        return res.status(400).json({error: 'SSH connection not established'});
    }

    if (!filePath) {
        return res.status(400).json({error: 'File path is required'});
    }

    sshConn.lastActive = Date.now();
    scheduleSessionCleanup(sessionId);

    const escapedPath = filePath.replace(/'/g, "'\"'\"'");
    sshConn.client.exec(`cat '${escapedPath}'`, (err, stream) => {
        if (err) {
            logger.error('SSH readFile error:', err);
            return res.status(500).json({error: err.message});
        }

        let data = '';
        let errorData = '';

        stream.on('data', (chunk: Buffer) => {
            data += chunk.toString();
        });

        stream.stderr.on('data', (chunk: Buffer) => {
            errorData += chunk.toString();
        });

        stream.on('close', (code) => {
            if (code !== 0) {
                logger.error(`SSH readFile command failed with code ${code}: ${errorData.replace(/\n/g, ' ').trim()}`);
                return res.status(500).json({error: `Command failed: ${errorData}`});
            }

            res.json({content: data, path: filePath});
        });
    });
});

app.post('/ssh/config_editor/ssh/writeFile', (req, res) => {
    const {sessionId, path: filePath, content} = req.body;
    const sshConn = sshSessions[sessionId];

    if (!sessionId) {
        return res.status(400).json({error: 'Session ID is required'});
    }

    if (!sshConn?.isConnected) {
        return res.status(400).json({error: 'SSH connection not established'});
    }

    if (!filePath) {
        return res.status(400).json({error: 'File path is required'});
    }

    if (content === undefined) {
        return res.status(400).json({error: 'File content is required'});
    }

    sshConn.lastActive = Date.now();
    scheduleSessionCleanup(sessionId);

    const tempFile = `/tmp/temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const escapedTempFile = tempFile.replace(/'/g, "'\"'\"'");
    const escapedFilePath = filePath.replace(/'/g, "'\"'\"'");

    const base64Content = Buffer.from(content, 'utf8').toString('base64');

    const commandTimeout = setTimeout(() => {
        logger.error(`SSH writeFile command timed out for session: ${sessionId}`);
        if (!res.headersSent) {
            res.status(500).json({error: 'SSH command timed out'});
        }
    }, 15000);

    const checkCommand = `ls -la '${escapedFilePath}' 2>/dev/null || echo "File does not exist"`;

    sshConn.client.exec(checkCommand, (checkErr, checkStream) => {
        if (checkErr) {
            return res.status(500).json({error: `File check failed: ${checkErr.message}`});
        }

        let checkResult = '';
        checkStream.on('data', (chunk: Buffer) => {
            checkResult += chunk.toString();
        });

        checkStream.on('close', (checkCode) => {
            const writeCommand = `echo '${base64Content}' > '${escapedTempFile}' && base64 -d '${escapedTempFile}' > '${escapedFilePath}' && rm -f '${escapedTempFile}' && echo "SUCCESS" && exit 0`;

            sshConn.client.exec(writeCommand, (err, stream) => {
                if (err) {
                    clearTimeout(commandTimeout);
                    logger.error('SSH writeFile error:', err);
                    if (!res.headersSent) {
                        return res.status(500).json({error: err.message});
                    }
                    return;
                }

                let outputData = '';
                let errorData = '';

                stream.on('data', (chunk: Buffer) => {
                    outputData += chunk.toString();
                });

                stream.stderr.on('data', (chunk: Buffer) => {
                    errorData += chunk.toString();

                    if (chunk.toString().includes('Permission denied')) {
                        clearTimeout(commandTimeout);
                        logger.error(`Permission denied writing to file: ${filePath}`);
                        if (!res.headersSent) {
                            return res.status(403).json({
                                error: `Permission denied: Cannot write to ${filePath}. Check file ownership and permissions. Use 'ls -la ${filePath}' to verify.`
                            });
                        }
                        return;
                    }
                });

                stream.on('close', (code) => {
                    clearTimeout(commandTimeout);

                    if (outputData.includes('SUCCESS')) {
                        const verifyCommand = `ls -la '${escapedFilePath}' 2>/dev/null | awk '{print $5}'`;

                        sshConn.client.exec(verifyCommand, (verifyErr, verifyStream) => {
                            if (verifyErr) {
                                if (!res.headersSent) {
                                    res.json({message: 'File written successfully', path: filePath});
                                }
                                return;
                            }

                            let verifyResult = '';
                            verifyStream.on('data', (chunk: Buffer) => {
                                verifyResult += chunk.toString();
                            });

                            verifyStream.on('close', (verifyCode) => {
                                const fileSize = Number(verifyResult.trim());

                                if (fileSize > 0) {
                                    if (!res.headersSent) {
                                        res.json({message: 'File written successfully', path: filePath});
                                    }
                                } else {
                                    if (!res.headersSent) {
                                        res.status(500).json({error: 'File write operation may have failed - file appears empty'});
                                    }
                                }
                            });
                        });
                        return;
                    }

                    if (code !== 0) {
                        logger.error(`SSH writeFile command failed with code ${code}: ${errorData.replace(/\n/g, ' ').trim()}`);
                        if (!res.headersSent) {
                            return res.status(500).json({error: `Command failed: ${errorData}`});
                        }
                        return;
                    }

                    if (!res.headersSent) {
                        res.json({message: 'File written successfully', path: filePath});
                    }
                });

                stream.on('error', (streamErr) => {
                    clearTimeout(commandTimeout);
                    logger.error('SSH writeFile stream error:', streamErr);
                    if (!res.headersSent) {
                        res.status(500).json({error: `Stream error: ${streamErr.message}`});
                    }
                });
            });
        });
    });
});

process.on('SIGINT', () => {
    Object.keys(sshSessions).forEach(cleanupSession);
    process.exit(0);
});

process.on('SIGTERM', () => {
    Object.keys(sshSessions).forEach(cleanupSession);
    process.exit(0);
});

const PORT = 8084;
app.listen(PORT, () => {
});