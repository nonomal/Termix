import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
    id: text('id').primaryKey(), // Unique user ID (nanoid)
    username: text('username').notNull(), // Username
    password_hash: text('password_hash').notNull(), // Hashed password
    is_admin: integer('is_admin', { mode: 'boolean' }).notNull().default(false), // Admin flag
});

export const sshData = sqliteTable('ssh_data', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: text('user_id').notNull().references(() => users.id),
    name: text('name'),
    folder: text('folder'),
    tags: text('tags'),
    ip: text('ip').notNull(),
    port: integer('port').notNull(),
    username: text('username'),
    password: text('password'),
    authMethod: text('auth_method'),
    key: text('key', { length: 8192 }), // Increased for larger keys
    keyPassword: text('key_password'), // Password for protected keys
    keyType: text('key_type'), // Type of SSH key (RSA, ED25519, etc.)
    saveAuthMethod: integer('save_auth_method', { mode: 'boolean' }),
    isPinned: integer('is_pinned', { mode: 'boolean' }),
});

export const sshTunnelData = sqliteTable('ssh_tunnel_data', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: text('user_id').notNull().references(() => users.id),
    name: text('name'),
    folder: text('folder'),
    sourcePort: integer('source_port').notNull(),
    endpointPort: integer('endpoint_port').notNull(),
    sourceIP: text('source_ip').notNull(),
    sourceSSHPort: integer('source_ssh_port').notNull(),
    sourceUsername: text('source_username'),
    sourcePassword: text('source_password'),
    sourceAuthMethod: text('source_auth_method'),
    sourceSSHKey: text('source_ssh_key', { length: 8192 }),
    sourceKeyPassword: text('source_key_password'),
    sourceKeyType: text('source_key_type'),
    endpointIP: text('endpoint_ip').notNull(),
    endpointSSHPort: integer('endpoint_ssh_port').notNull(),
    endpointUsername: text('endpoint_username'),
    endpointPassword: text('endpoint_password'),
    endpointAuthMethod: text('endpoint_auth_method'),
    endpointSSHKey: text('endpoint_ssh_key', { length: 8192 }),
    endpointKeyPassword: text('endpoint_key_password'),
    endpointKeyType: text('endpoint_key_type'),
    maxRetries: integer('max_retries').notNull().default(3),
    retryInterval: integer('retry_interval').notNull().default(5000),
    connectionState: text('connection_state').notNull().default('DISCONNECTED'),
    autoStart: integer('auto_start', { mode: 'boolean' }).notNull().default(false),
    isPinned: integer('is_pinned', { mode: 'boolean' }).notNull().default(false),
});

export const settings = sqliteTable('settings', {
    key: text('key').primaryKey(),
    value: text('value').notNull(),
});