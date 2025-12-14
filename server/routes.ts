import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/saves", async (req, res) => {
    try {
      const deviceId = req.headers["x-device-id"] as string;
      if (!deviceId) {
        return res.status(400).json({ error: "Device ID required" });
      }
      const saves = await storage.getGameSavesByDeviceId(deviceId);
      res.json(saves);
    } catch (error) {
      console.error("Failed to list saves:", error);
      res.status(500).json({ error: "Failed to list saves" });
    }
  });

  app.get("/api/saves/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const save = await storage.getGameSaveById(id);
      if (!save) {
        return res.status(404).json({ error: "Save not found" });
      }
      res.json(save);
    } catch (error) {
      console.error("Failed to get save:", error);
      res.status(500).json({ error: "Failed to get save" });
    }
  });

  app.post("/api/saves", async (req, res) => {
    try {
      const deviceId = req.headers["x-device-id"] as string;
      if (!deviceId) {
        return res.status(400).json({ error: "Device ID required" });
      }
      const { name, gameState, metadata } = req.body;
      if (!name || !gameState || !metadata) {
        return res.status(400).json({ error: "Name, gameState, and metadata required" });
      }
      const save = await storage.createGameSave({
        deviceId,
        name,
        gameState,
        metadata
      });
      res.status(201).json(save);
    } catch (error) {
      console.error("Failed to create save:", error);
      res.status(500).json({ error: "Failed to create save" });
    }
  });

  app.put("/api/saves/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { name, gameState, metadata } = req.body;
      const save = await storage.updateGameSave(id, { name, gameState, metadata });
      if (!save) {
        return res.status(404).json({ error: "Save not found" });
      }
      res.json(save);
    } catch (error) {
      console.error("Failed to update save:", error);
      res.status(500).json({ error: "Failed to update save" });
    }
  });

  app.delete("/api/saves/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteGameSave(id);
      if (!deleted) {
        return res.status(404).json({ error: "Save not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete save:", error);
      res.status(500).json({ error: "Failed to delete save" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
