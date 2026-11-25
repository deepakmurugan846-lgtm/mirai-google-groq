import "dotenv/config";
import express from "express";
import http from "node:http";
import cors from "cors";
import { Server } from "socket.io";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const server = http.createServer(app);
const allowedOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";
const io = new Server(server, {
  cors: { origin: allowedOrigin, methods: ["GET", "POST"] }
});

app.use(cors({ origin: allowedOrigin }));
app.use(express.json({ limit: "100kb" }));

const activeSessions = new Map();
const recentRegistrations = [];

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.post("/api/session", (req, res) => {
  const { registrationCode } = req.body || {};
  if (typeof registrationCode !== "string" || !/^[a-f0-9-]{20,80}$/i.test(registrationCode)) {
    return res.status(400).json({ error: "Invalid registration code" });
  }
  activeSessions.set(registrationCode, { createdAt: Date.now(), completed: false });
  res.json({ ok: true });
});

app.post("/api/google-form-webhook", (req, res) => {
  const expected = process.env.GOOGLE_WEBHOOK_SECRET;
  const supplied = req.get("x-webhook-secret");
  if (!expected || supplied !== expected) {
    return res.status(401).json({ error: "Unauthorized webhook" });
  }

  const payload = req.body || {};
  const code = String(payload.registrationCode || "");
  if (!code || code.length > 100) return res.status(400).json({ error: "Missing registrationCode" });

  const session = activeSessions.get(code);
  if (!session || session.completed) {
    return res.json({ ok: true, matched: false });
  }

  session.completed = true;
  const event = {
    registrationCode: code,
    name: String(payload.name || ""),
    company: String(payload.company || ""),
    designation: String(payload.designation || ""),
    favorite: String(payload.favorite || ""),
    submittedAt: new Date().toISOString()
  };
  recentRegistrations.unshift(event);
  if (recentRegistrations.length > 100) recentRegistrations.pop();

  io.emit("registration:complete", { registrationCode: code });
  io.emit("admin:registration", event);
  res.json({ ok: true, matched: true });
});

app.get("/api/admin/registrations", (req, res) => {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey || req.get("x-admin-key") !== adminKey) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  res.json({ registrations: recentRegistrations });
});

app.post("/api/chat", async (req, res) => {
  const { message } = req.body || {};
  if (typeof message !== "string" || !message.trim() || message.length > 1000) {
    return res.status(400).json({ error: "Enter a message (max 1000 characters)." });
  }
  if (!process.env.GROQ_API_KEY) {
    return res.status(503).json({ error: "Groq is not configured yet. Add GROQ_API_KEY to server/.env." });
  }
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: "You are MIRAI, a friendly and concise AI exhibition robot. Reply warmly in simple English. Keep answers under 70 words." },
          { role: "user", content: message.trim() }
        ],
        temperature: 0.6,
        max_tokens: 180
      })
    });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data.error?.message || "Groq request failed" });
    res.json({ reply: data.choices?.[0]?.message?.content || "Sorry, I could not prepare a reply." });
  } catch {
    res.status(502).json({ error: "Could not reach Groq. Please try again." });
  }
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, "../../client/dist");
app.use(express.static(clientDist));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(clientDist, "index.html"), err => { if (err) res.status(404).send("Build the client first."); });
});

const port = Number(process.env.PORT || 4000);
server.listen(port, () => console.log(`MIRAI server running on port ${port}`));
