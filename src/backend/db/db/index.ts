import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema.js';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

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

const dbDir = path.resolve('./db/data');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const sqlite = new Database('./db/data/db.sqlite');
logger.success('Database connection established');

sqlite.exec(`
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    is_admin INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS ssh_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    name TEXT,
    folder TEXT,
    tags TEXT,
    ip TEXT NOT NULL,
    port INTEGER NOT NULL,
    username TEXT,
    password TEXT,
    auth_method TEXT,
    key TEXT,
    key_password TEXT,
    key_type TEXT,
    save_auth_method INTEGER,
    is_pinned INTEGER,
    FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS ssh_tunnel_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    name TEXT,
    folder TEXT,
    source_port INTEGER NOT NULL,
    endpoint_port INTEGER NOT NULL,
    source_ip TEXT NOT NULL,
    source_ssh_port INTEGER NOT NULL,
    source_username TEXT,
    source_password TEXT,
    source_auth_method TEXT,
    source_ssh_key TEXT,
    source_key_password TEXT,
    source_key_type TEXT,
    endpoint_ip TEXT NOT NULL,
    endpoint_ssh_port INTEGER NOT NULL,
    endpoint_username TEXT,
    endpoint_password TEXT,
    endpoint_auth_method TEXT,
    endpoint_ssh_key TEXT,
    endpoint_key_password TEXT,
    endpoint_key_type TEXT,
    max_retries INTEGER NOT NULL DEFAULT 3,
    retry_interval INTEGER NOT NULL DEFAULT 5000,
    connection_state TEXT NOT NULL DEFAULT 'DISCONNECTED',
    auto_start INTEGER NOT NULL DEFAULT 0,
    is_pinned INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
`);
try {
    sqlite.prepare('SELECT is_admin FROM users LIMIT 1').get();
} catch (e) {
    sqlite.exec('ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;');
}
try {
    const row = sqlite.prepare("SELECT value FROM settings WHERE key = 'allow_registration'").get();
    if (!row) {
        sqlite.prepare("INSERT INTO settings (key, value) VALUES ('allow_registration', 'true')").run();
    }
} catch (e) {
}

export const db = drizzle(sqlite, { schema });