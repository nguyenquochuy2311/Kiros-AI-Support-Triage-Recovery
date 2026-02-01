
import './config/env'; // Load environment variables first with validation and expansion
import express from 'express';
import cors from 'cors';
import ticketRoutes from './routes/tickets';
import { BullMQAdapter } from './adapters';
// Worker is now run in a separate process (see worker.ts)


const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/tickets', ticketRoutes);

import { sseManager } from './sse';
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  sseManager.addClient(res);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Initialize Queue Adapter for Worker (in a real app, worker might be a separate process)
// For this MVP, we'll run it in the same process or separate, but we need to ensure Redis connection.
// The Worker instantiation will happen in the worker file.

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
