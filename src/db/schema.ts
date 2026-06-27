import { pgTable, uuid, varchar, integer, text, timestamp } from 'drizzle-orm/pg-core';

// Projects Table
export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  subdomain: varchar('subdomain', { length: 255 }).notNull().unique(),
  port: integer('port').notNull().unique(),
  framework: varchar('framework', { length: 100 }).notNull(), // nextjs, vite, static, etc.
  deploymentPath: varchar('deployment_path', { length: 512 }).notNull(), // e.g., /home/mdspl-sujith/sujith/apps/project_id
  buildFolder: varchar('build_folder', { length: 100 }).default('dist'), // .next, dist, build, etc.
  pm2ProcessName: varchar('pm2_process_name', { length: 255 }).notNull().unique(),
  status: varchar('status', { length: 50 }).default('idle').notNull(), // idle, deploying, active, failed
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Deployments Table
export const deployments = pgTable('deployments', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  status: varchar('status', { length: 50 }).default('pending').notNull(), // pending, extracting, active, successful, failed
  commitMessage: text('commit_message'),
  version: varchar('version', { length: 50 }),
  logPath: varchar('log_path', { length: 512 }).notNull(), // Log file location on VPS
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});

// Logs Table
export const logs = pgTable('logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  deploymentId: uuid('deployment_id').references(() => deployments.id, { onDelete: 'cascade' }).notNull(),
  level: varchar('level', { length: 20 }).default('info').notNull(), // info, warn, error
  message: text('message').notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

// System Settings Table
export const settings = pgTable('settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  key: varchar('key', { length: 100 }).notNull().unique(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
