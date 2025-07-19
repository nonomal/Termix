import express from 'express';
import { db } from '../db/index.js';
import { sshData } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import chalk from 'chalk';
import jwt from 'jsonwebtoken';
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

// Route: Create SSH data (requires JWT)
// POST /ssh/host
router.post('/host', authenticateJWT, async (req: Request, res: Response) => {
    const { name, folder, tags, ip, port, username, password, authMethod, key, saveAuthMethod, isPinned } = req.body;
    const userId = (req as any).userId;
    if (!isNonEmptyString(userId) || !isNonEmptyString(ip) || !isValidPort(port)) {
        logger.warn('Invalid SSH data input');
        return res.status(400).json({ error: 'Invalid SSH data' });
    }

    const sshDataObj: any = {
        userId: userId,
        name,
        folder,
        tags: Array.isArray(tags) ? tags.join(',') : tags,
        ip,
        port,
        username,
        authMethod,
        saveAuthMethod: saveAuthMethod ? 1 : 0,
        isPinned: isPinned ? 1 : 0,
    };

    if (saveAuthMethod) {
        if (authMethod === 'password') {
            sshDataObj.password = password;
            sshDataObj.key = null;
        } else if (authMethod === 'key') {
            sshDataObj.key = key;
            sshDataObj.password = null;
        }
    } else {
        sshDataObj.password = null;
        sshDataObj.key = null;
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
router.put('/host/:id', authenticateJWT, async (req: Request, res: Response) => {
    const { name, folder, tags, ip, port, username, password, authMethod, key, saveAuthMethod, isPinned } = req.body;
    const { id } = req.params;
    const userId = (req as any).userId;
    
    if (!isNonEmptyString(userId) || !isNonEmptyString(ip) || !isValidPort(port) || !id) {
        logger.warn('Invalid SSH data input for update');
        return res.status(400).json({ error: 'Invalid SSH data' });
    }

    const sshDataObj: any = {
        name,
        folder,
        tags: Array.isArray(tags) ? tags.join(',') : tags,
        ip,
        port,
        username,
        authMethod,
        saveAuthMethod: saveAuthMethod ? 1 : 0,
        isPinned: isPinned ? 1 : 0,
    };

    if (saveAuthMethod) {
        if (authMethod === 'password') {
            sshDataObj.password = password;
            sshDataObj.key = null;
        } else if (authMethod === 'key') {
            sshDataObj.key = key;
            sshDataObj.password = null;
        }
    } else {
        sshDataObj.password = null;
        sshDataObj.key = null;
    }

    try {
        const result = await db.update(sshData)
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
        res.json(data);
    } catch (err) {
        logger.error('Failed to fetch SSH data', err);
        res.status(500).json({ error: 'Failed to fetch SSH data' });
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