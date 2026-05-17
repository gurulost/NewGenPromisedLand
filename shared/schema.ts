import { pgTable, text, serial, integer, boolean, timestamp, jsonb, varchar, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const gameSaves = pgTable("game_saves", {
  id: serial("id").primaryKey(),
  deviceId: text("device_id").notNull(),
  name: text("name").notNull(),
  gameState: jsonb("game_state").notNull(),
  metadata: jsonb("metadata").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertGameSaveSchema = createInsertSchema(gameSaves).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertGameSave = z.infer<typeof insertGameSaveSchema>;
export type GameSave = typeof gameSaves.$inferSelect;

export const bugReports = pgTable("bug_reports", {
  id: serial("id").primaryKey(),
  submissionId: varchar("submission_id", { length: 128 }).notNull(),
  userId: integer("user_id").references(() => users.id),
  deviceId: text("device_id"),
  source: text("source").notNull(),
  category: text("category").notNull(),
  status: text("status").notNull().default("open"),
  playerMessage: text("player_message").notNull(),
  expectedBehavior: text("expected_behavior"),
  reproFrequency: text("repro_frequency").notNull(),
  contact: text("contact"),
  includeDiagnostics: boolean("include_diagnostics").notNull().default(true),
  includeScreenshot: boolean("include_screenshot").notNull().default(false),
  screenshotUrl: text("screenshot_url"),
  fingerprint: varchar("fingerprint", { length: 64 }).notNull(),
  duplicateCount24h: integer("duplicate_count_24h").notNull().default(1),
  diagnostics: jsonb("diagnostics"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  submissionIdUnique: uniqueIndex("bug_reports_submission_id_idx").on(table.submissionId),
}));

export const insertBugReportSchema = createInsertSchema(bugReports).omit({
  id: true,
  createdAt: true,
});

export type InsertBugReport = z.infer<typeof insertBugReportSchema>;
export type BugReport = typeof bugReports.$inferSelect;

// Multiplayer game lobbies
export const gameLobbies = pgTable("game_lobbies", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 8 }).notNull().unique(),
  name: text("name").notNull(),
  hostUserId: integer("host_user_id").notNull().references(() => users.id),
  maxPlayers: integer("max_players").notNull().default(8),
  mapSize: text("map_size").notNull().default("normal"),
  status: text("status").notNull().default("waiting"),
  gameState: jsonb("game_state"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Player seats in a lobby - one user can claim multiple seats
export const playerSeats = pgTable("player_seats", {
  id: serial("id").primaryKey(),
  lobbyId: integer("lobby_id").notNull().references(() => gameLobbies.id, { onDelete: "cascade" }),
  seatIndex: integer("seat_index").notNull(),
  userId: integer("user_id").references(() => users.id),
  playerName: text("player_name"),
  factionId: text("faction_id"),
  isReady: boolean("is_ready").notNull().default(false),
  isAI: boolean("is_ai").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  lobbySeatUnique: uniqueIndex("lobby_seat_unique_idx").on(table.lobbyId, table.seatIndex),
}));

export const multiplayerActionAudits = pgTable("multiplayer_action_audits", {
  id: serial("id").primaryKey(),
  lobbyId: integer("lobby_id").notNull().references(() => gameLobbies.id, { onDelete: "cascade" }),
  lobbyCode: varchar("lobby_code", { length: 8 }).notNull(),
  actionVersion: integer("action_version"),
  clientActionId: varchar("client_action_id", { length: 128 }).notNull(),
  userId: integer("user_id").references(() => users.id),
  playerId: text("player_id"),
  status: text("status").notNull(),
  reason: text("reason"),
  baseActionVersion: integer("base_action_version"),
  preStateHash: varchar("pre_state_hash", { length: 64 }),
  postStateHash: varchar("post_state_hash", { length: 64 }),
  action: jsonb("action"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  lobbyClientActionUnique: uniqueIndex("multiplayer_action_audit_lobby_client_action_idx").on(table.lobbyId, table.clientActionId),
}));

export const multiplayerSnapshotCheckpoints = pgTable("multiplayer_snapshot_checkpoints", {
  id: serial("id").primaryKey(),
  lobbyId: integer("lobby_id").notNull().references(() => gameLobbies.id, { onDelete: "cascade" }),
  lobbyCode: varchar("lobby_code", { length: 8 }).notNull(),
  actionVersion: integer("action_version").notNull(),
  snapshotVersion: integer("snapshot_version").notNull(),
  stateHash: varchar("state_hash", { length: 64 }).notNull(),
  snapshot: jsonb("snapshot").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  lobbySnapshotVersionUnique: uniqueIndex("multiplayer_snapshot_lobby_version_idx").on(table.lobbyId, table.snapshotVersion),
}));

// Relations defined after all tables
export const gameLobbyRelations = relations(gameLobbies, ({ one, many }) => ({
  host: one(users, {
    fields: [gameLobbies.hostUserId],
    references: [users.id],
  }),
  seats: many(playerSeats),
}));

export const playerSeatRelations = relations(playerSeats, ({ one }) => ({
  lobby: one(gameLobbies, {
    fields: [playerSeats.lobbyId],
    references: [gameLobbies.id],
  }),
  user: one(users, {
    fields: [playerSeats.userId],
    references: [users.id],
  }),
}));

export const userRelations = relations(users, ({ many }) => ({
  hostedLobbies: many(gameLobbies),
  seats: many(playerSeats),
}));

export const insertGameLobbySchema = createInsertSchema(gameLobbies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPlayerSeatSchema = createInsertSchema(playerSeats).omit({
  id: true,
  createdAt: true,
});

export type InsertGameLobby = z.infer<typeof insertGameLobbySchema>;
export type GameLobby = typeof gameLobbies.$inferSelect;
export type InsertPlayerSeat = z.infer<typeof insertPlayerSeatSchema>;
export type PlayerSeat = typeof playerSeats.$inferSelect;

export const insertMultiplayerActionAuditSchema = createInsertSchema(multiplayerActionAudits).omit({
  id: true,
  createdAt: true,
});

export const insertMultiplayerSnapshotCheckpointSchema = createInsertSchema(multiplayerSnapshotCheckpoints).omit({
  id: true,
  createdAt: true,
});

export type InsertMultiplayerActionAudit = z.infer<typeof insertMultiplayerActionAuditSchema>;
export type MultiplayerActionAudit = typeof multiplayerActionAudits.$inferSelect;
export type InsertMultiplayerSnapshotCheckpoint = z.infer<typeof insertMultiplayerSnapshotCheckpointSchema>;
export type MultiplayerSnapshotCheckpoint = typeof multiplayerSnapshotCheckpoints.$inferSelect;
