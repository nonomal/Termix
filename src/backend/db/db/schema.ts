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
    key: text('key', { length: 2048 }),
    saveAuthMethod: integer('save_auth_method', { mode: 'boolean' }),
    isPinned: integer('is_pinned', { mode: 'boolean' }),
});

export const settings = sqliteTable('settings', {
    key: text('key').primaryKey(),
    value: text('value').notNull(),
});