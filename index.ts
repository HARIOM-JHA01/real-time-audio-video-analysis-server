import express from "express";
import { WebSocketServer } from "ws";
import http from "http";

const app = express();

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

const server = http.createServer(app);

const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  console.log("Client connected ✅");

  ws.on("message", (msg) => {
    console.log("Received:", msg.toString());
    ws.send(`Echo: ${msg}`);
  });

  ws.on("close", () => {
    console.log("Client disconnected ❌");
  });
});

const PORT = 4000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🌐 WebSocket server running on ws://localhost:${PORT}`);
});