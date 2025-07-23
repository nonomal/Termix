import express from 'express';
import { db } from '../db/index.js';
import { configEditorData, configSshData } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const router = express.Router();

// --- JWT Auth Middleware ---
interface JWTPayload {
    userId: string;
    iat?: number;
    exp?: number;
}
function authenticateJWT(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }
    const token = authHeader.split(' ')[1];
    const jwtSecret = process.env.JWT_SECRET || 'secret';
    try {
        const payload = jwt.verify(token, jwtSecret) as JWTPayload;
        (req as any).userId = payload.userId;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

// --- Config Data Endpoints (DB-backed, per user) ---
router.get('/recent', authenticateJWT, async (req, res) => {
    const userId = (req as any).userId;
    try {
        const data = await db.select().from(configEditorData).where(and(eq(configEditorData.userId, userId), eq(configEditorData.type, 'recent')));
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch recent files' });
    }
});
router.post('/recent', authenticateJWT, async (req, res) => {
    const userId = (req as any).userId;
    const { name, path: filePath, server, lastOpened } = req.body;
    if (!filePath) return res.status(400).json({ error: 'Missing path' });
    try {
        const now = new Date().toISOString();
        await db.insert(configEditorData).values({
            userId,
            type: 'recent',
            name,
            path: filePath,
            server: server ? JSON.stringify(server) : null,
            lastOpened: lastOpened || now,
            createdAt: now,
            updatedAt: now,
        });
        res.json({ message: 'Added to recent' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to add to recent' });
    }
});
router.get('/pinned', authenticateJWT, async (req, res) => {
    const userId = (req as any).userId;
    try {
        const data = await db.select().from(configEditorData).where(and(eq(configEditorData.userId, userId), eq(configEditorData.type, 'pinned')));
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch pinned files' });
    }
});
router.post('/pinned', authenticateJWT, async (req, res) => {
    const userId = (req as any).userId;
    const { name, path: filePath, server } = req.body;
    if (!filePath) return res.status(400).json({ error: 'Missing path' });
    try {
        const now = new Date().toISOString();
        await db.insert(configEditorData).values({
            userId,
            type: 'pinned',
            name,
            path: filePath,
            server: server ? JSON.stringify(server) : null,
            createdAt: now,
            updatedAt: now,
        });
        res.json({ message: 'Added to pinned' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to add to pinned' });
    }
});
router.get('/shortcuts', authenticateJWT, async (req, res) => {
    const userId = (req as any).userId;
    try {
        const data = await db.select().from(configEditorData).where(and(eq(configEditorData.userId, userId), eq(configEditorData.type, 'shortcut')));
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch shortcuts' });
    }
});
router.post('/shortcuts', authenticateJWT, async (req, res) => {
    const userId = (req as any).userId;
    const { name, path: folderPath, server } = req.body;
    if (!folderPath) return res.status(400).json({ error: 'Missing path' });
    try {
        const now = new Date().toISOString();
        await db.insert(configEditorData).values({
            userId,
            type: 'shortcut',
            name,
            path: folderPath,
            server: server ? JSON.stringify(server) : null,
            createdAt: now,
            updatedAt: now,
        });
        res.json({ message: 'Added to shortcuts' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to add to shortcuts' });
    }
});

// DELETE /config_editor/shortcuts
router.delete('/shortcuts', authenticateJWT, async (req, res) => {
    const userId = (req as any).userId;
    const { path } = req.body;
    if (!path) return res.status(400).json({ error: 'Missing path' });
    try {
        await db.delete(configEditorData)
            .where(and(eq(configEditorData.userId, userId), eq(configEditorData.type, 'shortcut'), eq(configEditorData.path, path)));
        res.json({ message: 'Shortcut removed' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to remove shortcut' });
    }
});
// POST /config_editor/shortcuts/delete (for compatibility)
router.post('/shortcuts/delete', authenticateJWT, async (req, res) => {
    const userId = (req as any).userId;
    const { path } = req.body;
    if (!path) return res.status(400).json({ error: 'Missing path' });
    try {
        await db.delete(configEditorData)
            .where(and(eq(configEditorData.userId, userId), eq(configEditorData.type, 'shortcut'), eq(configEditorData.path, path)));
        res.json({ message: 'Shortcut removed' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to remove shortcut' });
    }
});

// --- Local Default Path Endpoints ---
// GET /config_editor/local_default_path
router.get('/local_default_path', authenticateJWT, async (req, res) => {
    const userId = (req as any).userId;
    try {
        const row = await db.select().from(configEditorData)
            .where(and(eq(configEditorData.userId, userId), eq(configEditorData.type, 'local_default_path')))
            .then(rows => rows[0]);
        res.json({ defaultPath: row?.path || '/' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch local default path' });
    }
});
// POST /config_editor/local_default_path
router.post('/local_default_path', authenticateJWT, async (req, res) => {
    const userId = (req as any).userId;
    const { defaultPath } = req.body;
    if (!defaultPath) return res.status(400).json({ error: 'Missing defaultPath' });
    try {
        const now = new Date().toISOString();
        // Upsert: delete old, insert new
        await db.delete(configEditorData)
            .where(and(eq(configEditorData.userId, userId), eq(configEditorData.type, 'local_default_path')));
        await db.insert(configEditorData).values({
            userId,
            type: 'local_default_path',
            name: 'Local Files',
            path: defaultPath,
            createdAt: now,
            updatedAt: now,
        });
        res.json({ message: 'Local default path saved' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to save local default path' });
    }
});

// --- SSH Connection CRUD for Config Editor ---
// GET /config_editor/ssh/host
router.get('/ssh/host', authenticateJWT, async (req, res) => {
    const userId = (req as any).userId;
    if (!userId) {
        return res.status(400).json({ error: 'Invalid userId' });
    }
    try {
        const data = await db.select().from(configSshData).where(eq(configSshData.userId, userId));
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch SSH hosts' });
    }
});
// POST /config_editor/ssh/host
router.post('/ssh/host', authenticateJWT, async (req, res) => {
    const userId = (req as any).userId;
    const { name, folder, tags, ip, port, username, password, sshKey, keyPassword, keyType, isPinned, defaultPath, authMethod } = req.body;
    if (!userId || !ip || !port) {
        return res.status(400).json({ error: 'Invalid SSH data' });
    }
    const sshDataObj: any = {
        userId,
        name,
        folder,
        tags: Array.isArray(tags) ? tags.join(',') : tags,
        ip,
        port,
        username,
        authMethod,
        isPinned: isPinned ? 1 : 0,
        defaultPath: defaultPath || null,
    };
    if (authMethod === 'password') {
        sshDataObj.password = password;
        sshDataObj.key = null;
        sshDataObj.keyPassword = null;
        sshDataObj.keyType = null;
    } else if (authMethod === 'key') {
        sshDataObj.key = sshKey;
        sshDataObj.keyPassword = keyPassword;
        sshDataObj.keyType = keyType;
        sshDataObj.password = null;
    }
    try {
        await db.insert(configSshData).values(sshDataObj);
        res.json({ message: 'SSH host created' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to create SSH host' });
    }
});
// PUT /config_editor/ssh/host/:id
router.put('/ssh/host/:id', authenticateJWT, async (req, res) => {
    const userId = (req as any).userId;
    const { id } = req.params;
    const { name, folder, tags, ip, port, username, password, sshKey, keyPassword, keyType, isPinned, defaultPath, authMethod } = req.body;
    if (!userId || !ip || !port || !id) {
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
        isPinned: isPinned ? 1 : 0,
        defaultPath: defaultPath || null,
    };
    if (authMethod === 'password') {
        sshDataObj.password = password;
        sshDataObj.key = null;
        sshDataObj.keyPassword = null;
        sshDataObj.keyType = null;
    } else if (authMethod === 'key') {
        sshDataObj.key = sshKey;
        sshDataObj.keyPassword = keyPassword;
        sshDataObj.keyType = keyType;
        sshDataObj.password = null;
    }
    try {
        await db.update(configSshData)
            .set(sshDataObj)
            .where(and(eq(configSshData.id, Number(id)), eq(configSshData.userId, userId)));
        res.json({ message: 'SSH host updated' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update SSH host' });
    }
});

// --- SSH Connection CRUD (reuse /ssh/host endpoints, or proxy) ---
router.delete('/ssh/host/:id', authenticateJWT, async (req, res) => {
    const userId = (req as any).userId;
    const { id } = req.params;
    if (!userId || !id) {
        return res.status(400).json({ error: 'Invalid userId or id' });
    }
    try {
        await db.delete(configSshData)
            .where(and(eq(configSshData.id, Number(id)), eq(configSshData.userId, userId)));
        res.json({ message: 'SSH host deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete SSH host' });
    }
});

// GET /config_editor/ssh/folders
router.get('/ssh/folders', authenticateJWT, async (req, res) => {
    const userId = (req as any).userId;
    if (!userId) {
        return res.status(400).json({ error: 'Invalid userId' });
    }
    try {
        const data = await db
            .select({ folder: configSshData.folder })
            .from(configSshData)
            .where(eq(configSshData.userId, userId));
        const folderCounts: Record<string, number> = {};
        data.forEach(d => {
            if (d.folder && d.folder.trim() !== '') {
                folderCounts[d.folder] = (folderCounts[d.folder] || 0) + 1;
            }
        });
        const folders = Object.keys(folderCounts).filter(folder => folderCounts[folder] > 0);
        res.json(folders);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch SSH folders' });
    }
});

export default router; 