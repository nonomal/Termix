import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = sqliteTable('users', {
    id: text('id').primaryKey(), // Unique user ID (nanoid)
    username: text('username').notNull(), // Username
    password_hash: text('password_hash').notNull(), // Hashed password
    is_admin: integer('is_admin', { mode: 'boolean' }).notNull().default(false), // Admin flag
});

export const settings = sqliteTable('settings', {
    key: text('key').primaryKey(),
    value: text('value').notNull(),
});

export const sshData = sqliteTable('ssh_data', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: text('user_id').notNull().references(() => users.id),
    name: text('name'), // Host name
    ip: text('ip').notNull(),
    port: integer('port').notNull(),
    username: text('username').notNull(),
    folder: text('folder'),
    tags: text('tags'), // JSON stringified array
    pin: integer('pin', { mode: 'boolean' }).notNull().default(false),
    authType: text('auth_type').notNull(), // 'password' | 'key'
    password: text('password'),
    key: text('key', { length: 8192 }), // Increased for larger keys
    keyPassword: text('key_password'), // Password for protected keys
    keyType: text('key_type'), // Type of SSH key (RSA, ED25519, etc.)
    enableTerminal: integer('enable_terminal', { mode: 'boolean' }).notNull().default(true),
    enableTunnel: integer('enable_tunnel', { mode: 'boolean' }).notNull().default(true),
    tunnelConnections: text('tunnel_connections'), // JSON stringified array of tunnel connections
    enableConfigEditor: integer('enable_config_editor', { mode: 'boolean' }).notNull().default(true),
    defaultPath: text('default_path'), // Default path for SSH connection
    createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});