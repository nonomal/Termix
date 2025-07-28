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

export const configEditorRecent = sqliteTable('config_editor_recent', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: text('user_id').notNull().references(() => users.id),
    hostId: integer('host_id').notNull().references(() => sshData.id), // SSH host ID
    name: text('name').notNull(), // File name
    path: text('path').notNull(), // File path
    lastOpened: text('last_opened').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const configEditorPinned = sqliteTable('config_editor_pinned', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: text('user_id').notNull().references(() => users.id),
    hostId: integer('host_id').notNull().references(() => sshData.id), // SSH host ID
    name: text('name').notNull(), // File name
    path: text('path').notNull(), // File path
    pinnedAt: text('pinned_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const configEditorShortcuts = sqliteTable('config_editor_shortcuts', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: text('user_id').notNull().references(() => users.id),
    hostId: integer('host_id').notNull().references(() => sshData.id), // SSH host ID
    name: text('name').notNull(), // Folder name
    path: text('path').notNull(), // Folder path
    createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});