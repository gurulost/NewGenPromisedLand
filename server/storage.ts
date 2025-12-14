import { db } from "./db";
import { eq, desc } from "drizzle-orm";
import { 
  users, type User, type InsertUser,
  gameSaves, type GameSave, type InsertGameSave 
} from "@shared/schema";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getGameSavesByDeviceId(deviceId: string): Promise<GameSave[]>;
  getGameSaveById(id: number): Promise<GameSave | undefined>;
  createGameSave(save: InsertGameSave): Promise<GameSave>;
  updateGameSave(id: number, save: Partial<InsertGameSave>): Promise<GameSave | undefined>;
  deleteGameSave(id: number): Promise<boolean>;
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

  async getGameSavesByDeviceId(deviceId: string): Promise<GameSave[]> {
    return db.select().from(gameSaves)
      .where(eq(gameSaves.deviceId, deviceId))
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
}

export const storage = new DatabaseStorage();
