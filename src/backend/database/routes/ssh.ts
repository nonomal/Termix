import express from 'express';
import { db } from '../db/index.js';
import { sshData } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import chalk from 'chalk';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import type { Request, Response, NextFunction } from 'express';

const dbIconSymbol = '🗄️';
const getTimeStamp = (): string => chalk.gray(`[${new Date().toLocaleTimeString()}]`);
const formatMessage = (level: string, colorFn: chalk.Chalk, message: string): string => {
    return `${getTimeStamp()} ${colorFn(`[${level.toUpperCase()}]`)} ${chalk.hex('#1e3a8a')(`[${dbIconSymbol}]`)} ${message}`;
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

const router = express.Router();

function isNonEmptyString(val: any): val is string {
    return typeof val === 'string' && val.trim().length > 0;
}
function isValidPort(val: any): val is number {
    return typeof val === 'number' && val > 0 && val < 65536;
}

interface JWTPayload {
    userId: string;
    iat?: number;
    exp?: number;
}

// Configure multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        // Only allow specific file types for SSH keys
        if (file.fieldname === 'key') {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type'));
        }
    }
});

// JWT authentication middleware
function authenticateJWT(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        logger.warn('Missing or invalid Authorization header');
        return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }
    const token = authHeader.split(' ')[1];
    const jwtSecret = process.env.JWT_SECRET || 'secret';
    try {
        const payload = jwt.verify(token, jwtSecret) as JWTPayload;
        (req as any).userId = payload.userId;
        next();
    } catch (err) {
        logger.warn('Invalid or expired token');
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

// Helper to check if request is from localhost
function isLocalhost(req: Request) {
    const ip = req.ip || req.connection?.remoteAddress;
    return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
}

// Internal-only endpoint for autostart (no JWT)
router.get('/host/internal', async (req: Request, res: Response) => {
    if (!isLocalhost(req) && req.headers['x-internal-request'] !== '1') {
        logger.warn('Unauthorized attempt to access internal SSH host endpoint');
        return res.status(403).json({ error: 'Forbidden' });
    }
    try {
        const data = await db.select().from(sshData);
        // Convert tags to array, booleans to bool, tunnelConnections to array
        const result = data.map((row: any) => ({
            ...row,
            tags: typeof row.tags === 'string' ? (row.tags ? row.tags.split(',').filter(Boolean) : []) : [],
            pin: !!row.pin,
            enableTerminal: !!row.enableTerminal,
            enableTunnel: !!row.enableTunnel,
            tunnelConnections: row.tunnelConnections ? JSON.parse(row.tunnelConnections) : [],
            enableConfigEditor: !!row.enableConfigEditor,
        }));
        res.json(result);
    } catch (err) {
        logger.error('Failed to fetch SSH data (internal)', err);
        res.status(500).json({ error: 'Failed to fetch SSH data' });
    }
});

// Route: Create SSH data (requires JWT)
// POST /ssh/host
router.post('/host', authenticateJWT, upload.single('key'), async (req: Request, res: Response) => {
    let hostData: any;
    
    // Check if this is a multipart form data request (file upload)
    if (req.headers['content-type']?.includes('multipart/form-data')) {
        // Parse the JSON data from the 'data' field
        if (req.body.data) {
            try {
                hostData = JSON.parse(req.body.data);
            } catch (err) {
                logger.warn('Invalid JSON data in multipart request');
                return res.status(400).json({ error: 'Invalid JSON data' });
            }
        } else {
            logger.warn('Missing data field in multipart request');
            return res.status(400).json({ error: 'Missing data field' });
        }
        
        // Add the file data if present
        if (req.file) {
            hostData.key = req.file.buffer.toString('utf8');
        }
    } else {
        // Regular JSON request
        hostData = req.body;
    }
    
    const { name, folder, tags, ip, port, username, password, authMethod, key, keyPassword, keyType, pin, enableTerminal, enableTunnel, enableConfigEditor, defaultPath, tunnelConnections } = hostData;
    const userId = (req as any).userId;
    if (!isNonEmptyString(userId) || !isNonEmptyString(ip) || !isValidPort(port)) {
        logger.warn('Invalid SSH data input');
        return res.status(400).json({ error: 'Invalid SSH data' });
    }

    const sshDataObj: any = {
        userId: userId,
        name,
        folder,
        tags: Array.isArray(tags) ? tags.join(',') : (tags || ''),
        ip,
        port,
        username,
        authType: authMethod,
        pin: !!pin ? 1 : 0,
        enableTerminal: !!enableTerminal ? 1 : 0,
        enableTunnel: !!enableTunnel ? 1 : 0,
        tunnelConnections: Array.isArray(tunnelConnections) ? JSON.stringify(tunnelConnections) : null,
        enableConfigEditor: !!enableConfigEditor ? 1 : 0,
        defaultPath: defaultPath || null,
    };

    // Handle authentication data based on authMethod
    if (authMethod === 'password') {
        sshDataObj.password = password;
        sshDataObj.key = null;
        sshDataObj.keyPassword = null;
        sshDataObj.keyType = null;
    } else if (authMethod === 'key') {
        sshDataObj.key = key;
        sshDataObj.keyPassword = keyPassword;
        sshDataObj.keyType = keyType;
        sshDataObj.password = null;
    }

    try {
        await db.insert(sshData).values(sshDataObj);
        res.json({ message: 'SSH data created' });
    } catch (err) {
        logger.error('Failed to save SSH data', err);
        res.status(500).json({ error: 'Failed to save SSH data' });
    }
});

// Route: Update SSH data (requires JWT)
// PUT /ssh/host/:id
router.put('/host/:id', authenticateJWT, upload.single('key'), async (req: Request, res: Response) => {
    let hostData: any;
    
    // Check if this is a multipart form data request (file upload)
    if (req.headers['content-type']?.includes('multipart/form-data')) {
        // Parse the JSON data from the 'data' field
        if (req.body.data) {
            try {
                hostData = JSON.parse(req.body.data);
            } catch (err) {
                logger.warn('Invalid JSON data in multipart request');
                return res.status(400).json({ error: 'Invalid JSON data' });
            }
        } else {
            logger.warn('Missing data field in multipart request');
            return res.status(400).json({ error: 'Missing data field' });
        }
        
        // Add the file data if present
        if (req.file) {
            hostData.key = req.file.buffer.toString('utf8');
        }
    } else {
        // Regular JSON request
        hostData = req.body;
    }
    
    const { name, folder, tags, ip, port, username, password, authMethod, key, keyPassword, keyType, pin, enableTerminal, enableTunnel, enableConfigEditor, defaultPath, tunnelConnections } = hostData;
    const { id } = req.params;
    const userId = (req as any).userId;
    if (!isNonEmptyString(userId) || !isNonEmptyString(ip) || !isValidPort(port) || !id) {
        logger.warn('Invalid SSH data input for update');
        return res.status(400).json({ error: 'Invalid SSH data' });
    }

    const sshDataObj: any = {
        name,
        folder,
        tags: Array.isArray(tags) ? tags.join(',') : (tags || ''),
        ip,
        port,
        username,
        authType: authMethod,
        pin: !!pin ? 1 : 0,
        enableTerminal: !!enableTerminal ? 1 : 0,
        enableTunnel: !!enableTunnel ? 1 : 0,
        tunnelConnections: Array.isArray(tunnelConnections) ? JSON.stringify(tunnelConnections) : null,
        enableConfigEditor: !!enableConfigEditor ? 1 : 0,
        defaultPath: defaultPath || null,
    };

    // Handle authentication data based on authMethod
    if (authMethod === 'password') {
        sshDataObj.password = password;
        sshDataObj.key = null;
        sshDataObj.keyPassword = null;
        sshDataObj.keyType = null;
    } else if (authMethod === 'key') {
        sshDataObj.key = key;
        sshDataObj.keyPassword = keyPassword;
        sshDataObj.keyType = keyType;
        sshDataObj.password = null;
    }

    try {
        await db.update(sshData)
            .set(sshDataObj)
            .where(and(eq(sshData.id, Number(id)), eq(sshData.userId, userId)));
        res.json({ message: 'SSH data updated' });
    } catch (err) {
        logger.error('Failed to update SSH data', err);
        res.status(500).json({ error: 'Failed to update SSH data' });
    }
});

// Route: Get SSH data for the authenticated user (requires JWT)
// GET /ssh/host
router.get('/host', authenticateJWT, async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    if (!isNonEmptyString(userId)) {
        logger.warn('Invalid userId for SSH data fetch');
        return res.status(400).json({ error: 'Invalid userId' });
    }
    try {
        const data = await db
            .select()
            .from(sshData)
            .where(eq(sshData.userId, userId));
        // Convert tags to array, booleans to bool, tunnelConnections to array
        const result = data.map((row: any) => ({
            ...row,
            tags: typeof row.tags === 'string' ? (row.tags ? row.tags.split(',').filter(Boolean) : []) : [],
            pin: !!row.pin,
            enableTerminal: !!row.enableTerminal,
            enableTunnel: !!row.enableTunnel,
            tunnelConnections: row.tunnelConnections ? JSON.parse(row.tunnelConnections) : [],
            enableConfigEditor: !!row.enableConfigEditor,
        }));
        res.json(result);
    } catch (err) {
        logger.error('Failed to fetch SSH data', err);
        res.status(500).json({ error: 'Failed to fetch SSH data' });
    }
});

// Route: Get SSH host by ID (requires JWT)
// GET /ssh/host/:id
router.get('/host/:id', authenticateJWT, async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = (req as any).userId;
    
    if (!isNonEmptyString(userId) || !id) {
        logger.warn('Invalid request for SSH host fetch');
        return res.status(400).json({ error: 'Invalid request' });
    }
    
    try {
        const data = await db
            .select()
            .from(sshData)
            .where(and(eq(sshData.id, Number(id)), eq(sshData.userId, userId)));
        
        if (data.length === 0) {
            return res.status(404).json({ error: 'SSH host not found' });
        }
        
        const host = data[0];
        const result = {
            ...host,
            tags: typeof host.tags === 'string' ? (host.tags ? host.tags.split(',').filter(Boolean) : []) : [],
            pin: !!host.pin,
            enableTerminal: !!host.enableTerminal,
            enableTunnel: !!host.enableTunnel,
            tunnelConnections: host.tunnelConnections ? JSON.parse(host.tunnelConnections) : [],
            enableConfigEditor: !!host.enableConfigEditor,
        };
        
        res.json(result);
    } catch (err) {
        logger.error('Failed to fetch SSH host', err);
        res.status(500).json({ error: 'Failed to fetch SSH host' });
    }
});

// Route: Get all unique folders for the authenticated user (requires JWT)
// GET /ssh/folders
router.get('/folders', authenticateJWT, async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    if (!isNonEmptyString(userId)) {
        logger.warn('Invalid userId for SSH folder fetch');
        return res.status(400).json({ error: 'Invalid userId' });
    }
    try {
        const data = await db
            .select({ folder: sshData.folder })
            .from(sshData)
            .where(eq(sshData.userId, userId));

        const folderCounts: Record<string, number> = {};
        data.forEach(d => {
            if (d.folder && d.folder.trim() !== '') {
                folderCounts[d.folder] = (folderCounts[d.folder] || 0) + 1;
            }
        });

        const folders = Object.keys(folderCounts).filter(folder => folderCounts[folder] > 0);

        res.json(folders);
    } catch (err) {
        logger.error('Failed to fetch SSH folders', err);
        res.status(500).json({ error: 'Failed to fetch SSH folders' });
    }
});

// Route: Delete SSH host by id (requires JWT)
// DELETE /ssh/host/:id
router.delete('/host/:id', authenticateJWT, async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    const { id } = req.params;
    if (!isNonEmptyString(userId) || !id) {
        logger.warn('Invalid userId or id for SSH host delete');
        return res.status(400).json({ error: 'Invalid userId or id' });
    }
    try {
        const result = await db.delete(sshData)
            .where(and(eq(sshData.id, Number(id)), eq(sshData.userId, userId)));
        res.json({ message: 'SSH host deleted' });
    } catch (err) {
        logger.error('Failed to delete SSH host', err);
        res.status(500).json({ error: 'Failed to delete SSH host' });
    }
});

export default router; 