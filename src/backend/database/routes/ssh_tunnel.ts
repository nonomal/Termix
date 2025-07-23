import express from 'express';
import { db } from '../db/index.js';
import { sshTunnelData } from '../db/schema.js';
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
    // Only allow bypass if X-Internal-Request header is set
    if (req.headers['x-internal-request'] === '1') {
        (req as any).userId = 'internal_service';
        return next();
    }
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

// Route: Create SSH tunnel data (requires JWT)
// POST /ssh_tunnel/tunnel
router.post('/tunnel', authenticateJWT, async (req: Request, res: Response) => {
    const { 
        name, folder, sourcePort, endpointPort, sourceIP, sourceSSHPort, sourceUsername, 
        sourcePassword, sourceAuthMethod, sourceSSHKey, sourceKeyPassword, sourceKeyType,
        endpointIP, endpointSSHPort, endpointUsername, endpointPassword, endpointAuthMethod,
        endpointSSHKey, endpointKeyPassword, endpointKeyType, maxRetries, retryInterval, autoStart, isPinned
    } = req.body;
    const userId = (req as any).userId;
    
    if (!isNonEmptyString(userId) || !isNonEmptyString(sourceIP) || !isValidPort(sourcePort) || 
        !isValidPort(endpointPort) || !isValidPort(sourceSSHPort) || !isNonEmptyString(endpointIP) || 
        !isValidPort(endpointSSHPort)) {
        logger.warn('Invalid SSH tunnel data input');
        return res.status(400).json({ error: 'Invalid SSH tunnel data' });
    }

    const sshTunnelDataObj: any = {
        userId: userId,
        name,
        folder,
        sourcePort,
        endpointPort,
        sourceIP,
        sourceSSHPort,
        sourceUsername,
        sourceAuthMethod,
        endpointIP,
        endpointSSHPort,
        endpointUsername,
        endpointAuthMethod,
        maxRetries: maxRetries || 3,
        retryInterval: retryInterval || 5000,
        connectionState: 'DISCONNECTED',
        autoStart: autoStart || false,
        isPinned: isPinned || false
    };

    // Handle source authentication
    if (sourceAuthMethod === 'password') {
        sshTunnelDataObj.sourcePassword = sourcePassword;
        sshTunnelDataObj.sourceSSHKey = null;
        sshTunnelDataObj.sourceKeyPassword = null;
        sshTunnelDataObj.sourceKeyType = null;
    } else if (sourceAuthMethod === 'key') {
        sshTunnelDataObj.sourceSSHKey = sourceSSHKey;
        sshTunnelDataObj.sourceKeyPassword = sourceKeyPassword;
        sshTunnelDataObj.sourceKeyType = sourceKeyType;
        sshTunnelDataObj.sourcePassword = null;
    }

    // Handle endpoint authentication
    if (endpointAuthMethod === 'password') {
        sshTunnelDataObj.endpointPassword = endpointPassword;
        sshTunnelDataObj.endpointSSHKey = null;
        sshTunnelDataObj.endpointKeyPassword = null;
        sshTunnelDataObj.endpointKeyType = null;
    } else if (endpointAuthMethod === 'key') {
        sshTunnelDataObj.endpointSSHKey = endpointSSHKey;
        sshTunnelDataObj.endpointKeyPassword = endpointKeyPassword;
        sshTunnelDataObj.endpointKeyType = endpointKeyType;
        sshTunnelDataObj.endpointPassword = null;
    }

    try {
        await db.insert(sshTunnelData).values(sshTunnelDataObj);
        res.json({ message: 'SSH tunnel data created' });
    } catch (err) {
        logger.error('Failed to save SSH tunnel data', err);
        res.status(500).json({ error: 'Failed to save SSH tunnel data' });
    }
});

// Route: Update SSH tunnel data (requires JWT)
// PUT /ssh_tunnel/tunnel/:id
router.put('/tunnel/:id', authenticateJWT, async (req: Request, res: Response) => {
    const { 
        name, folder, sourcePort, endpointPort, sourceIP, sourceSSHPort, sourceUsername, 
        sourcePassword, sourceAuthMethod, sourceSSHKey, sourceKeyPassword, sourceKeyType,
        endpointIP, endpointSSHPort, endpointUsername, endpointPassword, endpointAuthMethod,
        endpointSSHKey, endpointKeyPassword, endpointKeyType, maxRetries, retryInterval, autoStart, isPinned
    } = req.body;
    const { id } = req.params;
    const userId = (req as any).userId;
    
    if (!isNonEmptyString(userId) || !isNonEmptyString(sourceIP) || !isValidPort(sourcePort) || 
        !isValidPort(endpointPort) || !isValidPort(sourceSSHPort) || !isNonEmptyString(endpointIP) || 
        !isValidPort(endpointSSHPort) || !id) {
        logger.warn('Invalid SSH tunnel data input for update');
        return res.status(400).json({ error: 'Invalid SSH tunnel data' });
    }

    const sshTunnelDataObj: any = {
        name,
        folder,
        sourcePort,
        endpointPort,
        sourceIP,
        sourceSSHPort,
        sourceUsername,
        sourceAuthMethod,
        endpointIP,
        endpointSSHPort,
        endpointUsername,
        endpointAuthMethod,
        maxRetries: maxRetries || 3,
        retryInterval: retryInterval || 5000,
        autoStart: autoStart || false,
        isPinned: isPinned || false
    };

    // Handle source authentication
    if (sourceAuthMethod === 'password') {
        sshTunnelDataObj.sourcePassword = sourcePassword;
        sshTunnelDataObj.sourceSSHKey = null;
        sshTunnelDataObj.sourceKeyPassword = null;
        sshTunnelDataObj.sourceKeyType = null;
    } else if (sourceAuthMethod === 'key') {
        sshTunnelDataObj.sourceSSHKey = sourceSSHKey;
        sshTunnelDataObj.sourceKeyPassword = sourceKeyPassword;
        sshTunnelDataObj.sourceKeyType = sourceKeyType;
        sshTunnelDataObj.sourcePassword = null;
    }

    // Handle endpoint authentication
    if (endpointAuthMethod === 'password') {
        sshTunnelDataObj.endpointPassword = endpointPassword;
        sshTunnelDataObj.endpointSSHKey = null;
        sshTunnelDataObj.endpointKeyPassword = null;
        sshTunnelDataObj.endpointKeyType = null;
    } else if (endpointAuthMethod === 'key') {
        sshTunnelDataObj.endpointSSHKey = endpointSSHKey;
        sshTunnelDataObj.endpointKeyPassword = endpointKeyPassword;
        sshTunnelDataObj.endpointKeyType = endpointKeyType;
        sshTunnelDataObj.endpointPassword = null;
    }

    try {
        const result = await db.update(sshTunnelData)
            .set(sshTunnelDataObj)
            .where(and(eq(sshTunnelData.id, Number(id)), eq(sshTunnelData.userId, userId)));
        res.json({ message: 'SSH tunnel data updated' });
    } catch (err) {
        logger.error('Failed to update SSH tunnel data', err);
        res.status(500).json({ error: 'Failed to update SSH tunnel data' });
    }
});

// Route: Get SSH tunnel data for the authenticated user (requires JWT)
// GET /ssh_tunnel/tunnel
router.get('/tunnel', authenticateJWT, async (req: Request, res: Response) => {
    // If internal request and allAutoStart=1, return all autoStart tunnels
    if (req.headers['x-internal-request'] === '1' && req.query.allAutoStart === '1') {
        try {
            const data = await db
                .select()
                .from(sshTunnelData)
                .where(eq(sshTunnelData.autoStart, true));
            return res.json(data);
        } catch (err) {
            logger.error('Failed to fetch all auto-start SSH tunnel data', err);
            return res.status(500).json({ error: 'Failed to fetch auto-start SSH tunnel data' });
        }
    }
    // Default: filter by userId
    const userId = (req as any).userId;
    if (!isNonEmptyString(userId)) {
        logger.warn('Invalid userId for SSH tunnel data fetch');
        return res.status(400).json({ error: 'Invalid userId' });
    }
    try {
        const data = await db
            .select()
            .from(sshTunnelData)
            .where(eq(sshTunnelData.userId, userId));
        res.json(data);
    } catch (err) {
        logger.error('Failed to fetch SSH tunnel data', err);
        res.status(500).json({ error: 'Failed to fetch SSH tunnel data' });
    }
});

// Route: Get all unique folders for the authenticated user (requires JWT)
// GET /ssh_tunnel/folders
router.get('/folders', authenticateJWT, async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    if (!isNonEmptyString(userId)) {
        logger.warn('Invalid userId for SSH tunnel folder fetch');
        return res.status(400).json({ error: 'Invalid userId' });
    }
    try {
        const data = await db
            .select({ folder: sshTunnelData.folder })
            .from(sshTunnelData)
            .where(eq(sshTunnelData.userId, userId));

        const folderCounts: Record<string, number> = {};
        data.forEach(d => {
            if (d.folder && d.folder.trim() !== '') {
                folderCounts[d.folder] = (folderCounts[d.folder] || 0) + 1;
            }
        });

        const folders = Object.keys(folderCounts).filter(folder => folderCounts[folder] > 0);

        res.json(folders);
    } catch (err) {
        logger.error('Failed to fetch SSH tunnel folders', err);
        res.status(500).json({ error: 'Failed to fetch SSH tunnel folders' });
    }
});

// Route: Delete SSH tunnel by id (requires JWT)
// DELETE /ssh_tunnel/tunnel/:id
router.delete('/tunnel/:id', authenticateJWT, async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    const { id } = req.params;
    if (!isNonEmptyString(userId) || !id) {
        logger.warn('Invalid userId or id for SSH tunnel delete');
        return res.status(400).json({ error: 'Invalid userId or id' });
    }
    try {
        const result = await db.delete(sshTunnelData)
            .where(and(eq(sshTunnelData.id, Number(id)), eq(sshTunnelData.userId, userId)));
        res.json({ message: 'SSH tunnel deleted' });
    } catch (err) {
        logger.error('Failed to delete SSH tunnel', err);
        res.status(500).json({ error: 'Failed to delete SSH tunnel' });
    }
});

export default router;
