import express from 'express';
import {db} from '../db/index.js';
import {users, settings} from '../db/schema.js';
import {eq} from 'drizzle-orm';
import chalk from 'chalk';
import bcrypt from 'bcryptjs';
import {nanoid} from 'nanoid';
import jwt from 'jsonwebtoken';
import type {Request, Response, NextFunction} from 'express';

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
        return res.status(401).json({error: 'Missing or invalid Authorization header'});
    }
    const token = authHeader.split(' ')[1];
    const jwtSecret = process.env.JWT_SECRET || 'secret';
    try {
        const payload = jwt.verify(token, jwtSecret) as JWTPayload;
        (req as any).userId = payload.userId;
        next();
    } catch (err) {
        logger.warn('Invalid or expired token');
        return res.status(401).json({error: 'Invalid or expired token'});
    }
}

// Route: Create user
// POST /users/create
router.post('/create', async (req, res) => {
    try {
        const row = db.$client.prepare("SELECT value FROM settings WHERE key = 'allow_registration'").get();
        if (row && (row as any).value !== 'true') {
            return res.status(403).json({error: 'Registration is currently disabled'});
        }
    } catch (e) {
    }
    const {username, password} = req.body;
    if (!isNonEmptyString(username) || !isNonEmptyString(password)) {
        logger.warn('Invalid user creation attempt');
        return res.status(400).json({error: 'Invalid username or password'});
    }
    try {
        const existing = await db
            .select()
            .from(users)
            .where(eq(users.username, username));
        if (existing && existing.length > 0) {
            logger.warn(`Attempt to create duplicate username: ${username}`);
            return res.status(409).json({error: 'Username already exists'});
        }
        let isFirstUser = false;
        try {
            const countResult = db.$client.prepare('SELECT COUNT(*) as count FROM users').get();
            isFirstUser = ((countResult as any)?.count || 0) === 0;
        } catch (e) {
            isFirstUser = true;
        }
        const saltRounds = parseInt(process.env.SALT || '10', 10);
        const password_hash = await bcrypt.hash(password, saltRounds);
        const id = nanoid();
        await db.insert(users).values({id, username, password_hash, is_admin: isFirstUser});
        logger.success(`User created: ${username} (is_admin: ${isFirstUser})`);
        res.json({message: 'User created', is_admin: isFirstUser});
    } catch (err) {
        logger.error('Failed to create user', err);
        res.status(500).json({error: 'Failed to create user'});
    }
});

// Route: Get user JWT by username and password
// POST /users/get
router.post('/get', async (req, res) => {
    const {username, password} = req.body;
    if (!isNonEmptyString(username) || !isNonEmptyString(password)) {
        logger.warn('Invalid get user attempt');
        return res.status(400).json({error: 'Invalid username or password'});
    }
    try {
        const user = await db
            .select()
            .from(users)
            .where(eq(users.username, username));
        if (!user || user.length === 0) {
            logger.warn(`User not found: ${username}`);
            return res.status(404).json({error: 'User not found'});
        }
        const userRecord = user[0];
        const isMatch = await bcrypt.compare(password, userRecord.password_hash);
        if (!isMatch) {
            logger.warn(`Incorrect password for user: ${username}`);
            return res.status(401).json({error: 'Incorrect password'});
        }
        const jwtSecret = process.env.JWT_SECRET || 'secret';
        const token = jwt.sign({userId: userRecord.id}, jwtSecret, {expiresIn: '50d'});
        res.json({token});
    } catch (err) {
        logger.error('Failed to get user', err);
        res.status(500).json({error: 'Failed to get user'});
    }
});

// Route: Get current user's username using JWT
// GET /users/me
router.get('/me', authenticateJWT, async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    if (!isNonEmptyString(userId)) {
        logger.warn('Invalid userId in JWT for /users/me');
        return res.status(401).json({error: 'Invalid userId'});
    }
    try {
        const user = await db
            .select()
            .from(users)
            .where(eq(users.id, userId));
        if (!user || user.length === 0) {
            logger.warn(`User not found for /users/me: ${userId}`);
            return res.status(401).json({error: 'User not found'});
        }
        res.json({username: user[0].username, is_admin: !!user[0].is_admin});
    } catch (err) {
        logger.error('Failed to get username', err);
        res.status(500).json({error: 'Failed to get username'});
    }
});

// Route: Count users
// GET /users/count
router.get('/count', async (req, res) => {
    try {
        const countResult = db.$client.prepare('SELECT COUNT(*) as count FROM users').get();
        const count = (countResult as any)?.count || 0;
        res.json({count});
    } catch (err) {
        logger.error('Failed to count users', err);
        res.status(500).json({error: 'Failed to count users'});
    }
});

// Route: DB health check (actually queries DB)
// GET /users/db-health
router.get('/db-health', async (req, res) => {
    try {
        db.$client.prepare('SELECT 1').get();
        res.json({status: 'ok'});
    } catch (err) {
        logger.error('DB health check failed', err);
        res.status(500).json({error: 'Database not accessible'});
    }
});

// Route: Get registration allowed status
// GET /users/registration-allowed
router.get('/registration-allowed', async (req, res) => {
    try {
        const row = db.$client.prepare("SELECT value FROM settings WHERE key = 'allow_registration'").get();
        res.json({allowed: row ? (row as any).value === 'true' : true});
    } catch (err) {
        logger.error('Failed to get registration allowed', err);
        res.status(500).json({error: 'Failed to get registration allowed'});
    }
});

// Route: Set registration allowed status (admin only)
// PATCH /users/registration-allowed
router.patch('/registration-allowed', authenticateJWT, async (req, res) => {
    const userId = (req as any).userId;
    try {
        const user = await db.select().from(users).where(eq(users.id, userId));
        if (!user || user.length === 0 || !user[0].is_admin) {
            return res.status(403).json({error: 'Not authorized'});
        }
        const {allowed} = req.body;
        if (typeof allowed !== 'boolean') {
            return res.status(400).json({error: 'Invalid value for allowed'});
        }
        db.$client.prepare("UPDATE settings SET value = ? WHERE key = 'allow_registration'").run(allowed ? 'true' : 'false');
        res.json({allowed});
    } catch (err) {
        logger.error('Failed to set registration allowed', err);
        res.status(500).json({error: 'Failed to set registration allowed'});
    }
});

export default router;