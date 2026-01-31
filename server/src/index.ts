import express from "express";
import cors from "cors";
import { env } from "./config/index.js";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// TODO: Mount routes
// app.use("/api/tickets", ticketRoutes);
// app.use("/api/events", sseRoutes);

app.listen(env.PORT, () => {
  console.log(`🚀 Server running on http://localhost:${env.PORT}`);
  console.log(`📊 Environment: ${env.NODE_ENV}`);
  console.log(`🤖 LLM Mock Mode: ${env.LLM_MOCK}`);
});
