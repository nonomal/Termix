import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { Client as SSHClient } from 'ssh2';
import chalk from "chalk";

const app = express();
const PORT = 8084;

app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true,
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

// --- Local File Operations ---
function normalizeFilePath(inputPath: string): string {
    if (!inputPath || typeof inputPath !== 'string') throw new Error('Invalid path');
    let normalizedPath = inputPath.replace(/\\/g, '/');
    const windowsAbsPath = /^[a-zA-Z]:\//;
    if (windowsAbsPath.test(normalizedPath)) return path.resolve(normalizedPath);
    if (normalizedPath.startsWith('/')) return path.resolve(normalizedPath);
    return path.resolve(process.cwd(), normalizedPath);
}
function isDirectory(p: string): boolean {
    try { return fs.statSync(p).isDirectory(); } catch { return false; }
}

app.get('/files', (req, res) => {
    try {
        const folderParam = req.query.folder as string || '';
        const folderPath = normalizeFilePath(folderParam);
        if (!fs.existsSync(folderPath) || !isDirectory(folderPath)) {
            logger.error('Directory not found:', folderPath);
            return res.status(404).json({ error: 'Directory not found' });
        }
        fs.readdir(folderPath, { withFileTypes: true }, (err, files) => {
            if (err) {
                logger.error('Error reading directory:', err);
                return res.status(500).json({ error: err.message });
            }
            const result = files.map(f => ({ name: f.name, type: f.isDirectory() ? 'directory' : 'file' }));
            res.json(result);
        });
    } catch (err: any) {
        logger.error('Error in /files endpoint:', err);
        res.status(400).json({ error: err.message });
    }
});

app.get('/file', (req, res) => {
    try {
        const folderParam = req.query.folder as string || '';
        const fileName = req.query.name as string;
        if (!fileName) return res.status(400).json({ error: 'Missing "name" parameter' });
        const folderPath = normalizeFilePath(folderParam);
        const filePath = path.join(folderPath, fileName);
        if (!fs.existsSync(filePath)) {
            logger.error(`File not found: ${filePath}`);
            return res.status(404).json({ error: 'File not found' });
        }
        if (isDirectory(filePath)) {
            logger.error(`Path is a directory: ${filePath}`);
            return res.status(400).json({ error: 'Path is a directory' });
        }
        const content = fs.readFileSync(filePath, 'utf8');
        res.setHeader('Content-Type', 'text/plain');
        res.send(content);
    } catch (err: any) {
        logger.error('Error in /file GET endpoint:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/file', (req, res) => {
    try {
        const folderParam = req.query.folder as string || '';
        const fileName = req.query.name as string;
        const content = req.body.content;
        if (!fileName) return res.status(400).json({ error: 'Missing "name" parameter' });
        if (content === undefined) return res.status(400).json({ error: 'Missing "content" in request body' });
        const folderPath = normalizeFilePath(folderParam);
        const filePath = path.join(folderPath, fileName);
        if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });
        fs.writeFileSync(filePath, content, 'utf8');
        res.json({ message: 'File written successfully' });
    } catch (err: any) {
        logger.error('Error in /file POST endpoint:', err);
        res.status(500).json({ error: err.message });
    }
});

// --- SSH Operations (per-session, in-memory, with cleanup) ---
interface SSHSession {
    client: SSHClient;
    isConnected: boolean;
    lastActive: number;
    timeout?: NodeJS.Timeout;
}
const sshSessions: Record<string, SSHSession> = {};
const SESSION_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

function cleanupSession(sessionId: string) {
    const session = sshSessions[sessionId];
    if (session) {
        try { session.client.end(); } catch {}
        clearTimeout(session.timeout);
        delete sshSessions[sessionId];
        logger.info(`Cleaned up SSH session: ${sessionId}`);
    }
}
function scheduleSessionCleanup(sessionId: string) {
    const session = sshSessions[sessionId];
    if (session) {
        if (session.timeout) clearTimeout(session.timeout);
        session.timeout = setTimeout(() => cleanupSession(sessionId), SESSION_TIMEOUT_MS);
    }
}

app.post('/ssh/connect', (req, res) => {
    const { sessionId, ip, port, username, password, sshKey, keyPassword } = req.body;
    if (!sessionId || !ip || !username || !port) {
        logger.warn('Missing SSH connection parameters');
        return res.status(400).json({ error: 'Missing SSH connection parameters' });
    }
    if (sshSessions[sessionId]?.isConnected) cleanupSession(sessionId);
    const client = new SSHClient();
    const config: any = {
        host: ip, port: port || 22, username,
        readyTimeout: 20000, keepaliveInterval: 10000, keepaliveCountMax: 3,
    };
    if (sshKey) { config.privateKey = sshKey; if (keyPassword) config.passphrase = keyPassword; }
    else if (password) config.password = password;
    else { logger.warn('No password or key provided'); return res.status(400).json({ error: 'Either password or SSH key must be provided' }); }
    client.on('ready', () => {
        sshSessions[sessionId] = { client, isConnected: true, lastActive: Date.now() };
        scheduleSessionCleanup(sessionId);
        logger.info(`SSH connected: ${ip}:${port} as ${username} (session: ${sessionId})`);
        res.json({ status: 'success', message: 'SSH connection established' });
    });
    client.on('error', (err) => {
        logger.error('SSH connection error:', err.message);
        res.status(500).json({ status: 'error', message: err.message });
    });
    client.on('close', () => {
        if (sshSessions[sessionId]) sshSessions[sessionId].isConnected = false;
        cleanupSession(sessionId);
    });
    client.connect(config);
});

app.post('/ssh/disconnect', (req, res) => {
    const { sessionId } = req.body;
    cleanupSession(sessionId);
    res.json({ status: 'success', message: 'SSH connection disconnected' });
});

app.get('/ssh/status', (req, res) => {
    const sessionId = req.query.sessionId as string;
    const isConnected = !!sshSessions[sessionId]?.isConnected;
    res.json({ status: 'success', connected: isConnected });
});

app.get('/ssh/listFiles', (req, res) => {
    const sessionId = req.query.sessionId as string;
    const sshConn = sshSessions[sessionId];
    const { path: sshPath = '/' } = req.query;
    if (!sshConn?.isConnected) {
        logger.warn('SSH connection not established for session', sessionId);
        return res.status(400).json({ error: 'SSH connection not established' });
    }
    sshConn.lastActive = Date.now();
    scheduleSessionCleanup(sessionId);
    sshConn.client.exec(`ls -la "${sshPath}"`, (err, stream) => {
        if (err) { logger.error('SSH listFiles error:', err); return res.status(500).json({ error: err.message }); }
        let data = '';
        stream.on('data', (chunk: Buffer) => { data += chunk.toString(); });
        stream.stderr.on('data', (_chunk: Buffer) => { /* ignore for now */ });
        stream.on('close', () => {
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
                    files.push({ name, type: isDirectory ? 'directory' : (isLink ? 'link' : 'file') });
                }
            }
            res.json(files);
        });
    });
});

app.get('/ssh/readFile', (req, res) => {
    const sessionId = req.query.sessionId as string;
    const sshConn = sshSessions[sessionId];
    const { path: filePath } = req.query;
    if (!sshConn?.isConnected) {
        logger.warn('SSH connection not established for session', sessionId);
        return res.status(400).json({ error: 'SSH connection not established' });
    }
    if (!filePath) {
        logger.warn('File path is required for readFile');
        return res.status(400).json({ error: 'File path is required' });
    }
    sshConn.lastActive = Date.now();
    scheduleSessionCleanup(sessionId);
    sshConn.client.exec(`cat "${filePath}"`, (err, stream) => {
        if (err) { logger.error('SSH readFile error:', err); return res.status(500).json({ error: err.message }); }
        let data = '';
        stream.on('data', (chunk: Buffer) => { data += chunk.toString(); });
        stream.stderr.on('data', (_chunk: Buffer) => { /* ignore for now */ });
        stream.on('close', () => {
            res.json({ content: data, path: filePath });
        });
    });
});

app.post('/ssh/writeFile', (req, res) => {
    const { sessionId, path: filePath, content } = req.body;
    const sshConn = sshSessions[sessionId];
    if (!sshConn?.isConnected) {
        logger.warn('SSH connection not established for session', sessionId);
        return res.status(400).json({ error: 'SSH connection not established' });
    }
    if (!filePath) {
        logger.warn('File path is required for writeFile');
        return res.status(400).json({ error: 'File path is required' });
    }
    if (content === undefined) {
        logger.warn('File content is required for writeFile');
        return res.status(400).json({ error: 'File content is required' });
    }
    sshConn.lastActive = Date.now();
    scheduleSessionCleanup(sessionId);
    // Write to a temp file, then move
    const tempFile = `/tmp/temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const safeContent = content.replace(/'/g, "'\"'\"'");
    sshConn.client.exec(`echo '${safeContent}' > "${tempFile}" && mv "${tempFile}" "${filePath}"`, (err, stream) => {
        if (err) { logger.error('SSH writeFile error:', err); return res.status(500).json({ error: err.message }); }
        stream.on('close', () => {
            res.json({ message: 'File written successfully', path: filePath });
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

app.listen(PORT, () => {});