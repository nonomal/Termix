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
app.use(express.json({limit: '100mb'}));
app.use(express.urlencoded({limit: '100mb', extended: true}));
app.use(express.raw({limit: '200mb', type: 'application/octet-stream'}));

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
    }
}

app.post('/ssh/file_manager/ssh/connect', async (req, res) => {
    const {sessionId, ip, port, username, password, sshKey, keyPassword} = req.body;
    if (!sessionId || !ip || !username || !port) {
        return res.status(400).json({error: 'Missing SSH connection parameters'});
    }

    if (sshSessions[sessionId]?.isConnected) {
        cleanupSession(sessionId);
    }
    const client = new SSHClient();
    const config: any = {
        host: ip,
        port: port || 22,
        username,
        readyTimeout: 0,
        keepaliveInterval: 30000,
        keepaliveCountMax: 0,
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
        try {
            if (!sshKey.includes('-----BEGIN') || !sshKey.includes('-----END')) {
                throw new Error('Invalid private key format');
            }
            
            const cleanKey = sshKey.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n');
            
            config.privateKey = Buffer.from(cleanKey, 'utf8');
            
            if (keyPassword) config.passphrase = keyPassword;
            
            logger.info('SSH key authentication configured successfully for file manager');
        } catch (keyError) {
            logger.error('SSH key format error: ' + keyError.message);
            return res.status(400).json({error: 'Invalid SSH key format'});
        }
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

app.post('/ssh/file_manager/ssh/disconnect', (req, res) => {
    const {sessionId} = req.body;
    cleanupSession(sessionId);
    res.json({status: 'success', message: 'SSH connection disconnected'});
});

app.get('/ssh/file_manager/ssh/status', (req, res) => {
    const sessionId = req.query.sessionId as string;
    const isConnected = !!sshSessions[sessionId]?.isConnected;
    res.json({status: 'success', connected: isConnected});
});

app.get('/ssh/file_manager/ssh/listFiles', (req, res) => {
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

app.get('/ssh/file_manager/ssh/readFile', (req, res) => {
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

app.post('/ssh/file_manager/ssh/writeFile', (req, res) => {
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

    const trySFTP = () => {
        try {
            sshConn.client.sftp((err, sftp) => {
                if (err) {
                    logger.warn(`SFTP failed, trying fallback method: ${err.message}`);
                    tryFallbackMethod();
                    return;
                }

                let fileBuffer;
                try {
                    if (typeof content === 'string') {
                        fileBuffer = Buffer.from(content, 'utf8');
                    } else if (Buffer.isBuffer(content)) {
                        fileBuffer = content;
                    } else {
                        fileBuffer = Buffer.from(content);
                    }
                } catch (bufferErr) {
                    logger.error('Buffer conversion error:', bufferErr);
                    if (!res.headersSent) {
                        return res.status(500).json({error: 'Invalid file content format'});
                    }
                    return;
                }

                const writeStream = sftp.createWriteStream(filePath);

                let hasError = false;
                let hasFinished = false;

                writeStream.on('error', (streamErr) => {
                    if (hasError || hasFinished) return;
                    hasError = true;
                    logger.warn(`SFTP write failed, trying fallback method: ${streamErr.message}`);
                    tryFallbackMethod();
                });

                writeStream.on('finish', () => {
                    if (hasError || hasFinished) return;
                    hasFinished = true;
                    logger.success(`File written successfully via SFTP: ${filePath}`);
                    if (!res.headersSent) {
                        res.json({message: 'File written successfully', path: filePath});
                    }
                });

                writeStream.on('close', () => {
                    if (hasError || hasFinished) return;
                    hasFinished = true;
                    logger.success(`File written successfully via SFTP: ${filePath}`);
                    if (!res.headersSent) {
                        res.json({message: 'File written successfully', path: filePath});
                    }
                });

                try {
                    writeStream.write(fileBuffer);
                    writeStream.end();
                } catch (writeErr) {
                    if (hasError || hasFinished) return;
                    hasError = true;
                    logger.warn(`SFTP write operation failed, trying fallback method: ${writeErr.message}`);
                    tryFallbackMethod();
                }
            });
        } catch (sftpErr) {
            logger.warn(`SFTP connection error, trying fallback method: ${sftpErr.message}`);
            tryFallbackMethod();
        }
    };

    const tryFallbackMethod = () => {
        try {
            const base64Content = Buffer.from(content, 'utf8').toString('base64');
            const escapedPath = filePath.replace(/'/g, "'\"'\"'");

            const writeCommand = `echo '${base64Content}' | base64 -d > '${escapedPath}' && echo "SUCCESS"`;

            sshConn.client.exec(writeCommand, (err, stream) => {
                if (err) {

                    logger.error('Fallback write command failed:', err);
                    if (!res.headersSent) {
                        return res.status(500).json({error: `Write failed: ${err.message}`});
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
                });

                stream.on('close', (code) => {


                    if (outputData.includes('SUCCESS')) {
                        logger.success(`File written successfully via fallback: ${filePath}`);
                        if (!res.headersSent) {
                            res.json({message: 'File written successfully', path: filePath});
                        }
                    } else {
                        logger.error(`Fallback write failed with code ${code}: ${errorData}`);
                        if (!res.headersSent) {
                            res.status(500).json({error: `Write failed: ${errorData}`});
                        }
                    }
                });

                stream.on('error', (streamErr) => {

                    logger.error('Fallback write stream error:', streamErr);
                    if (!res.headersSent) {
                        res.status(500).json({error: `Write stream error: ${streamErr.message}`});
                    }
                });
            });
        } catch (fallbackErr) {

            logger.error('Fallback method failed:', fallbackErr);
            if (!res.headersSent) {
                res.status(500).json({error: `All write methods failed: ${fallbackErr.message}`});
            }
        }
    };

    trySFTP();
});

app.post('/ssh/file_manager/ssh/uploadFile', (req, res) => {
    const {sessionId, path: filePath, content, fileName} = req.body;
    const sshConn = sshSessions[sessionId];

    if (!sessionId) {
        return res.status(400).json({error: 'Session ID is required'});
    }

    if (!sshConn?.isConnected) {
        return res.status(400).json({error: 'SSH connection not established'});
    }

    if (!filePath || !fileName || content === undefined) {
        return res.status(400).json({error: 'File path, name, and content are required'});
    }

    sshConn.lastActive = Date.now();
    

    const fullPath = filePath.endsWith('/') ? filePath + fileName : filePath + '/' + fileName;



    const trySFTP = () => {
        try {
            sshConn.client.sftp((err, sftp) => {
                if (err) {
                    logger.warn(`SFTP failed, trying fallback method: ${err.message}`);
                    tryFallbackMethod();
                    return;
                }

                let fileBuffer;
                try {
                    if (typeof content === 'string') {
                        fileBuffer = Buffer.from(content, 'utf8');
                    } else if (Buffer.isBuffer(content)) {
                        fileBuffer = content;
                    } else {
                        fileBuffer = Buffer.from(content);
                    }
                } catch (bufferErr) {

                    logger.error('Buffer conversion error:', bufferErr);
                    if (!res.headersSent) {
                        return res.status(500).json({error: 'Invalid file content format'});
                    }
                    return;
                }

                const writeStream = sftp.createWriteStream(fullPath);

                let hasError = false;
                let hasFinished = false;

                writeStream.on('error', (streamErr) => {
                    if (hasError || hasFinished) return;
                    hasError = true;
                    logger.warn(`SFTP write failed, trying fallback method: ${streamErr.message}`);
                    tryFallbackMethod();
                });

                writeStream.on('finish', () => {
                    if (hasError || hasFinished) return;
                    hasFinished = true;

                    logger.success(`File uploaded successfully via SFTP: ${fullPath}`);
                    if (!res.headersSent) {
                        res.json({message: 'File uploaded successfully', path: fullPath});
                    }
                });

                writeStream.on('close', () => {
                    if (hasError || hasFinished) return;
                    hasFinished = true;

                    logger.success(`File uploaded successfully via SFTP: ${fullPath}`);
                    if (!res.headersSent) {
                        res.json({message: 'File uploaded successfully', path: fullPath});
                    }
                });

                try {
                    writeStream.write(fileBuffer);
                    writeStream.end();
                } catch (writeErr) {
                    if (hasError || hasFinished) return;
                    hasError = true;
                    logger.warn(`SFTP write operation failed, trying fallback method: ${writeErr.message}`);
                    tryFallbackMethod();
                }
            });
        } catch (sftpErr) {
            logger.warn(`SFTP connection error, trying fallback method: ${sftpErr.message}`);
            tryFallbackMethod();
        }
    };

    const tryFallbackMethod = () => {
        try {
            const base64Content = Buffer.from(content, 'utf8').toString('base64');
            const chunkSize = 1000000;
            const chunks = [];

            for (let i = 0; i < base64Content.length; i += chunkSize) {
                chunks.push(base64Content.slice(i, i + chunkSize));
            }

            if (chunks.length === 1) {
                const tempFile = `/tmp/upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                const escapedTempFile = tempFile.replace(/'/g, "'\"'\"'");
                const escapedPath = fullPath.replace(/'/g, "'\"'\"'");

                const writeCommand = `echo '${chunks[0]}' | base64 -d > '${escapedPath}' && echo "SUCCESS"`;

                sshConn.client.exec(writeCommand, (err, stream) => {
                    if (err) {
    
                        logger.error('Fallback upload command failed:', err);
                        if (!res.headersSent) {
                            return res.status(500).json({error: `Upload failed: ${err.message}`});
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
                    });

                    stream.on('close', (code) => {
    

                        if (outputData.includes('SUCCESS')) {
                            logger.success(`File uploaded successfully via fallback: ${fullPath}`);
                            if (!res.headersSent) {
                                res.json({message: 'File uploaded successfully', path: fullPath});
                            }
                        } else {
                            logger.error(`Fallback upload failed with code ${code}: ${errorData}`);
                            if (!res.headersSent) {
                                res.status(500).json({error: `Upload failed: ${errorData}`});
                            }
                        }
                    });

                    stream.on('error', (streamErr) => {
    
                        logger.error('Fallback upload stream error:', streamErr);
                        if (!res.headersSent) {
                            res.status(500).json({error: `Upload stream error: ${streamErr.message}`});
                        }
                    });
                });
            } else {
                const tempFile = `/tmp/upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                const escapedTempFile = tempFile.replace(/'/g, "'\"'\"'");
                const escapedPath = fullPath.replace(/'/g, "'\"'\"'");

                let writeCommand = `> '${escapedPath}'`;

                chunks.forEach((chunk, index) => {
                    writeCommand += ` && echo '${chunk}' | base64 -d >> '${escapedPath}'`;
                });

                writeCommand += ` && echo "SUCCESS"`;

                sshConn.client.exec(writeCommand, (err, stream) => {
                    if (err) {
    
                        logger.error('Chunked fallback upload failed:', err);
                        if (!res.headersSent) {
                            return res.status(500).json({error: `Chunked upload failed: ${err.message}`});
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
                    });

                    stream.on('close', (code) => {
    

                        if (outputData.includes('SUCCESS')) {
                            logger.success(`File uploaded successfully via chunked fallback: ${fullPath}`);
                            if (!res.headersSent) {
                                res.json({message: 'File uploaded successfully', path: fullPath});
                            }
                        } else {
                            logger.error(`Chunked fallback upload failed with code ${code}: ${errorData}`);
                            if (!res.headersSent) {
                                res.status(500).json({error: `Chunked upload failed: ${errorData}`});
                            }
                        }
                    });

                    stream.on('error', (streamErr) => {
                        logger.error('Chunked fallback upload stream error:', streamErr);
                        if (!res.headersSent) {
                            res.status(500).json({error: `Chunked upload stream error: ${streamErr.message}`});
                        }
                    });
                });
            }
        } catch (fallbackErr) {
            logger.error('Fallback method failed:', fallbackErr);
            if (!res.headersSent) {
                res.status(500).json({error: `All upload methods failed: ${fallbackErr.message}`});
            }
        }
    };

    trySFTP();
});

app.post('/ssh/file_manager/ssh/createFile', (req, res) => {
    const {sessionId, path: filePath, fileName, content = ''} = req.body;
    const sshConn = sshSessions[sessionId];

    if (!sessionId) {
        return res.status(400).json({error: 'Session ID is required'});
    }

    if (!sshConn?.isConnected) {
        return res.status(400).json({error: 'SSH connection not established'});
    }

    if (!filePath || !fileName) {
        return res.status(400).json({error: 'File path and name are required'});
    }

    sshConn.lastActive = Date.now();

    const fullPath = filePath.endsWith('/') ? filePath + fileName : filePath + '/' + fileName;
    const escapedPath = fullPath.replace(/'/g, "'\"'\"'");

    const createCommand = `touch '${escapedPath}' && echo "SUCCESS" && exit 0`;

    sshConn.client.exec(createCommand, (err, stream) => {
        if (err) {
            logger.error('SSH createFile error:', err);
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
                logger.error(`Permission denied creating file: ${fullPath}`);
                if (!res.headersSent) {
                    return res.status(403).json({
                        error: `Permission denied: Cannot create file ${fullPath}. Check directory permissions.`
                    });
                }
                return;
            }
        });

        stream.on('close', (code) => {
            if (outputData.includes('SUCCESS')) {
                if (!res.headersSent) {
                    res.json({message: 'File created successfully', path: fullPath});
                }
                return;
            }

            if (code !== 0) {
                logger.error(`SSH createFile command failed with code ${code}: ${errorData.replace(/\n/g, ' ').trim()}`);
                if (!res.headersSent) {
                    return res.status(500).json({error: `Command failed: ${errorData}`});
                }
                return;
            }

            if (!res.headersSent) {
                res.json({message: 'File created successfully', path: fullPath});
            }
        });

        stream.on('error', (streamErr) => {
            logger.error('SSH createFile stream error:', streamErr);
            if (!res.headersSent) {
                res.status(500).json({error: `Stream error: ${streamErr.message}`});
            }
        });
    });
});

app.post('/ssh/file_manager/ssh/createFolder', (req, res) => {
    const {sessionId, path: folderPath, folderName} = req.body;
    const sshConn = sshSessions[sessionId];

    if (!sessionId) {
        return res.status(400).json({error: 'Session ID is required'});
    }

    if (!sshConn?.isConnected) {
        return res.status(400).json({error: 'SSH connection not established'});
    }

    if (!folderPath || !folderName) {
        return res.status(400).json({error: 'Folder path and name are required'});
    }

    sshConn.lastActive = Date.now();

    const fullPath = folderPath.endsWith('/') ? folderPath + folderName : folderPath + '/' + folderName;
    const escapedPath = fullPath.replace(/'/g, "'\"'\"'");

    const createCommand = `mkdir -p '${escapedPath}' && echo "SUCCESS" && exit 0`;

    sshConn.client.exec(createCommand, (err, stream) => {
        if (err) {

            logger.error('SSH createFolder error:', err);
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
                logger.error(`Permission denied creating folder: ${fullPath}`);
                if (!res.headersSent) {
                    return res.status(403).json({
                        error: `Permission denied: Cannot create folder ${fullPath}. Check directory permissions.`
                    });
                }
                return;
            }
        });

        stream.on('close', (code) => {
            if (outputData.includes('SUCCESS')) {
                if (!res.headersSent) {
                    res.json({message: 'Folder created successfully', path: fullPath});
                }
                return;
            }

            if (code !== 0) {
                logger.error(`SSH createFolder command failed with code ${code}: ${errorData.replace(/\n/g, ' ').trim()}`);
                if (!res.headersSent) {
                    return res.status(500).json({error: `Command failed: ${errorData}`});
                }
                return;
            }

            if (!res.headersSent) {
                res.json({message: 'Folder created successfully', path: fullPath});
            }
        });

        stream.on('error', (streamErr) => {
            logger.error('SSH createFolder stream error:', streamErr);
            if (!res.headersSent) {
                res.status(500).json({error: `Stream error: ${streamErr.message}`});
            }
        });
    });
});

app.delete('/ssh/file_manager/ssh/deleteItem', (req, res) => {
    const {sessionId, path: itemPath, isDirectory} = req.body;
    const sshConn = sshSessions[sessionId];

    if (!sessionId) {
        return res.status(400).json({error: 'Session ID is required'});
    }

    if (!sshConn?.isConnected) {
        return res.status(400).json({error: 'SSH connection not established'});
    }

    if (!itemPath) {
        return res.status(400).json({error: 'Item path is required'});
    }

    sshConn.lastActive = Date.now();
    const escapedPath = itemPath.replace(/'/g, "'\"'\"'");

    const deleteCommand = isDirectory
        ? `rm -rf '${escapedPath}' && echo "SUCCESS" && exit 0`
        : `rm -f '${escapedPath}' && echo "SUCCESS" && exit 0`;

    sshConn.client.exec(deleteCommand, (err, stream) => {
        if (err) {
            logger.error('SSH deleteItem error:', err);
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
                logger.error(`Permission denied deleting: ${itemPath}`);
                if (!res.headersSent) {
                    return res.status(403).json({
                        error: `Permission denied: Cannot delete ${itemPath}. Check file permissions.`
                    });
                }
                return;
            }
        });

        stream.on('close', (code) => {
            if (outputData.includes('SUCCESS')) {
                if (!res.headersSent) {
                    res.json({message: 'Item deleted successfully', path: itemPath});
                }
                return;
            }

            if (code !== 0) {
                logger.error(`SSH deleteItem command failed with code ${code}: ${errorData.replace(/\n/g, ' ').trim()}`);
                if (!res.headersSent) {
                    return res.status(500).json({error: `Command failed: ${errorData}`});
                }
                return;
            }

            if (!res.headersSent) {
                res.json({message: 'Item deleted successfully', path: itemPath});
            }
        });

        stream.on('error', (streamErr) => {
            logger.error('SSH deleteItem stream error:', streamErr);
            if (!res.headersSent) {
                res.status(500).json({error: `Stream error: ${streamErr.message}`});
            }
        });
    });
});

app.put('/ssh/file_manager/ssh/renameItem', (req, res) => {
    const {sessionId, oldPath, newName} = req.body;
    const sshConn = sshSessions[sessionId];

    if (!sessionId) {
        return res.status(400).json({error: 'Session ID is required'});
    }

    if (!sshConn?.isConnected) {
        return res.status(400).json({error: 'SSH connection not established'});
    }

    if (!oldPath || !newName) {
        return res.status(400).json({error: 'Old path and new name are required'});
    }

    sshConn.lastActive = Date.now();

    const oldDir = oldPath.substring(0, oldPath.lastIndexOf('/') + 1);
    const newPath = oldDir + newName;
    const escapedOldPath = oldPath.replace(/'/g, "'\"'\"'");
    const escapedNewPath = newPath.replace(/'/g, "'\"'\"'");

    const renameCommand = `mv '${escapedOldPath}' '${escapedNewPath}' && echo "SUCCESS" && exit 0`;

    sshConn.client.exec(renameCommand, (err, stream) => {
        if (err) {
            logger.error('SSH renameItem error:', err);
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
                logger.error(`Permission denied renaming: ${oldPath}`);
                if (!res.headersSent) {
                    return res.status(403).json({
                        error: `Permission denied: Cannot rename ${oldPath}. Check file permissions.`
                    });
                }
                return;
            }
        });

        stream.on('close', (code) => {
            if (outputData.includes('SUCCESS')) {
                if (!res.headersSent) {
                    res.json({message: 'Item renamed successfully', oldPath, newPath});
                }
                return;
            }

            if (code !== 0) {
                logger.error(`SSH renameItem command failed with code ${code}: ${errorData.replace(/\n/g, ' ').trim()}`);
                if (!res.headersSent) {
                    return res.status(500).json({error: `Command failed: ${errorData}`});
                }
                return;
            }

            if (!res.headersSent) {
                res.json({message: 'Item renamed successfully', oldPath, newPath});
            }
        });

        stream.on('error', (streamErr) => {
            logger.error('SSH renameItem stream error:', streamErr);
            if (!res.headersSent) {
                res.status(500).json({error: `Stream error: ${streamErr.message}`});
            }
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