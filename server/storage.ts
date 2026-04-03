import { db } from "./db";
import { eq, desc, and, isNull, sql, gte, count } from "drizzle-orm";
import { 
  users, type User, type InsertUser,
  gameSaves, type GameSave, type InsertGameSave,
  gameLobbies, type GameLobby, type InsertGameLobby,
  playerSeats, type PlayerSeat, type InsertPlayerSeat,
  bugReports, type BugReport, type InsertBugReport
} from "@shared/schema";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getGameSavesByOwnerId(ownerId: string): Promise<GameSave[]>;
  getGameSaveById(id: number): Promise<GameSave | undefined>;
  createGameSave(save: InsertGameSave): Promise<GameSave>;
  updateGameSave(id: number, save: Partial<InsertGameSave>): Promise<GameSave | undefined>;
  deleteGameSave(id: number): Promise<boolean>;
  transferGameSaveOwnership(fromOwnerId: string, toOwnerId: string): Promise<number>;
  
  // Lobby methods
  createLobby(lobby: InsertGameLobby): Promise<GameLobby>;
  getLobbyByCode(code: string): Promise<GameLobby | undefined>;
  getLobbyById(id: number): Promise<GameLobby | undefined>;
  getOpenLobbies(): Promise<GameLobby[]>;
  updateLobby(id: number, lobby: Partial<InsertGameLobby>): Promise<GameLobby | undefined>;
  touchLobby(id: number): Promise<GameLobby | undefined>;
  updateLobbyIfUnchanged(
    id: number,
    expectedUpdatedAt: Date,
    lobby: Partial<InsertGameLobby>
  ): Promise<GameLobby | undefined>;
  deleteLobby(id: number): Promise<boolean>;
  
  // Seat methods
  createSeat(seat: InsertPlayerSeat): Promise<PlayerSeat>;
  getSeatsByLobbyId(lobbyId: number): Promise<PlayerSeat[]>;
  getSeatById(id: number): Promise<PlayerSeat | undefined>;
  claimSeatIfAvailable(
    lobbyId: number,
    seatIndex: number,
    userId: number,
    playerName: string
  ): Promise<PlayerSeat | undefined>;
  updateSeat(id: number, seat: Partial<InsertPlayerSeat>): Promise<PlayerSeat | undefined>;
  deleteSeat(id: number): Promise<boolean>;
  deleteSeatsByUserId(lobbyId: number, userId: number): Promise<boolean>;

  // Bug report methods
  getBugReportById(id: number): Promise<BugReport | undefined>;
  getBugReportBySubmissionId(submissionId: string): Promise<BugReport | undefined>;
  createBugReport(report: InsertBugReport): Promise<BugReport>;
  countBugReportsByFingerprintSince(fingerprint: string, since: Date): Promise<number>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getGameSavesByOwnerId(ownerId: string): Promise<GameSave[]> {
    return db.select().from(gameSaves)
      .where(eq(gameSaves.deviceId, ownerId))
      .orderBy(desc(gameSaves.updatedAt));
  }

  async getGameSaveById(id: number): Promise<GameSave | undefined> {
    const [save] = await db.select().from(gameSaves).where(eq(gameSaves.id, id));
    return save;
  }

  async createGameSave(save: InsertGameSave): Promise<GameSave> {
    const [created] = await db.insert(gameSaves).values(save).returning();
    return created;
  }

  async updateGameSave(id: number, save: Partial<InsertGameSave>): Promise<GameSave | undefined> {
    const [updated] = await db.update(gameSaves)
      .set({ ...save, updatedAt: new Date() })
      .where(eq(gameSaves.id, id))
      .returning();
    return updated;
  }

  async deleteGameSave(id: number): Promise<boolean> {
    const result = await db.delete(gameSaves).where(eq(gameSaves.id, id)).returning();
    return result.length > 0;
  }

  async transferGameSaveOwnership(fromOwnerId: string, toOwnerId: string): Promise<number> {
    const moved = await db.update(gameSaves)
      .set({ deviceId: toOwnerId, updatedAt: new Date() })
      .where(eq(gameSaves.deviceId, fromOwnerId))
      .returning({ id: gameSaves.id });
    return moved.length;
  }

  // Lobby methods
  async createLobby(lobby: InsertGameLobby): Promise<GameLobby> {
    const [created] = await db.insert(gameLobbies).values(lobby).returning();
    return created;
  }

  async getLobbyByCode(code: string): Promise<GameLobby | undefined> {
    const [lobby] = await db.select().from(gameLobbies).where(eq(gameLobbies.code, code));
    return lobby;
  }

  async getLobbyById(id: number): Promise<GameLobby | undefined> {
    const [lobby] = await db.select().from(gameLobbies).where(eq(gameLobbies.id, id));
    return lobby;
  }

  async getOpenLobbies(): Promise<GameLobby[]> {
    return db.select().from(gameLobbies)
      .where(eq(gameLobbies.status, "waiting"))
      .orderBy(desc(gameLobbies.createdAt));
  }

  async updateLobby(id: number, lobby: Partial<InsertGameLobby>): Promise<GameLobby | undefined> {
    const [updated] = await db.update(gameLobbies)
      .set({ ...lobby, updatedAt: new Date() })
      .where(eq(gameLobbies.id, id))
      .returning();
    return updated;
  }

  async touchLobby(id: number): Promise<GameLobby | undefined> {
    const [updated] = await db.update(gameLobbies)
      .set({ updatedAt: new Date() })
      .where(eq(gameLobbies.id, id))
      .returning();
    return updated;
  }

  async updateLobbyIfUnchanged(
    id: number,
    expectedUpdatedAt: Date,
    lobby: Partial<InsertGameLobby>
  ): Promise<GameLobby | undefined> {
    const [updated] = await db.update(gameLobbies)
      .set({ ...lobby, updatedAt: new Date() })
      .where(
        and(
          eq(gameLobbies.id, id),
          sql`date_trunc('milliseconds', ${gameLobbies.updatedAt}) = date_trunc('milliseconds', ${expectedUpdatedAt})`,
        ),
      )
      .returning();
    return updated;
  }

  async deleteLobby(id: number): Promise<boolean> {
    const result = await db.delete(gameLobbies).where(eq(gameLobbies.id, id)).returning();
    return result.length > 0;
  }

  // Seat methods
  async createSeat(seat: InsertPlayerSeat): Promise<PlayerSeat> {
    const [created] = await db.insert(playerSeats).values(seat).returning();
    return created;
  }

  async getSeatsByLobbyId(lobbyId: number): Promise<PlayerSeat[]> {
    return db.select().from(playerSeats)
      .where(eq(playerSeats.lobbyId, lobbyId))
      .orderBy(playerSeats.seatIndex);
  }

  async getSeatById(id: number): Promise<PlayerSeat | undefined> {
    const [seat] = await db.select().from(playerSeats).where(eq(playerSeats.id, id));
    return seat;
  }

  async claimSeatIfAvailable(
    lobbyId: number,
    seatIndex: number,
    userId: number,
    playerName: string
  ): Promise<PlayerSeat | undefined> {
    const [updated] = await db.update(playerSeats)
      .set({
        userId,
        playerName,
        isAI: false,
        isReady: false,
      })
      .where(
        and(
          eq(playerSeats.lobbyId, lobbyId),
          eq(playerSeats.seatIndex, seatIndex),
          isNull(playerSeats.userId),
          eq(playerSeats.isAI, false),
        ),
      )
      .returning();
    return updated;
  }

  async updateSeat(id: number, seat: Partial<InsertPlayerSeat>): Promise<PlayerSeat | undefined> {
    const [updated] = await db.update(playerSeats)
      .set(seat)
      .where(eq(playerSeats.id, id))
      .returning();
    return updated;
  }

  async deleteSeat(id: number): Promise<boolean> {
    const result = await db.delete(playerSeats).where(eq(playerSeats.id, id)).returning();
    return result.length > 0;
  }

  async deleteSeatsByUserId(lobbyId: number, userId: number): Promise<boolean> {
    const result = await db.delete(playerSeats)
      .where(and(eq(playerSeats.lobbyId, lobbyId), eq(playerSeats.userId, userId)))
      .returning();
    return result.length > 0;
  }

  async getBugReportBySubmissionId(submissionId: string): Promise<BugReport | undefined> {
    const [report] = await db.select().from(bugReports).where(eq(bugReports.submissionId, submissionId));
    return report;
  }

  async getBugReportById(id: number): Promise<BugReport | undefined> {
    const [report] = await db.select().from(bugReports).where(eq(bugReports.id, id));
    return report;
  }

  async createBugReport(report: InsertBugReport): Promise<BugReport> {
    const [created] = await db.insert(bugReports).values(report).returning();
    return created;
  }

  async countBugReportsByFingerprintSince(fingerprint: string, since: Date): Promise<number> {
    const [result] = await db
      .select({ value: count() })
      .from(bugReports)
      .where(and(eq(bugReports.fingerprint, fingerprint), gte(bugReports.createdAt, since)));
    return Number(result?.value ?? 0);
  }
}

export const storage = new DatabaseStorage();
