# Project: AI Support "Triage & Recovery" Hub (Option A)

## Objective
Build a Full Stack MVP that ingests user complaints (tickets), processes them asynchronously using AI (LLM), and provides a real-time dashboard for agents.

## Core Features & Architecture

### 1. Database Schema (Prisma)
- **Model:** `Ticket`
- **Fields:**
  - `id` (UUID)
  - `content` (String - User input)
  - `status` (Enum: PENDING, PROCESSED, FAILED, RESOLVED)
  - `category` (String? - e.g., Billing, Technical)
  - `urgency` (String? - High, Medium, Low)
  - `sentiment` (Int? - 1-10)
  - `draftReply` (String? - AI generated)
  - `finalReply` (String? - Agent edited)
  - `createdAt`, `updatedAt`

### 2. Backend (Node.js/Express)
- **Architecture:** Controller -> Service -> Queue Adapter -> Worker.
- **Queue System (Adapter Pattern):**
  - Define `IQueueAdapter` interface (connect, addJob, process, close).
  - Implement `BullMQAdapter` using BullMQ.
  - Use a `QueueFactory` to initialize the adapter based on `.env`.
- **API Endpoints:**
  - `POST /api/tickets`: Validates input, pushes job to Queue, returns 201 immediately.
  - `GET /api/events`: SSE endpoint for real-time updates.
  - `GET /api/tickets`: Fetch all tickets.
  - `PATCH /api/tickets/:id`: Agent resolves the ticket.
- **Real-time (SSE + Redis Pub/Sub):**
  - **Worker** processes job -> Publishes event to Redis channel `ticket-updates`.
  - **API Server** subscribes to `ticket-updates` -> Streams data to Client via SSE.

### 3. Background Worker (The "Engine")
- **Prompt Engineering:**
  - Instruct LLM to act as a support lead.
  - Output MUST be strictly valid JSON.
- **Process:**
  - Fetch Ticket from DB.
  - Call LLM.
  - **Validation:** Parse LLM response with Zod.
  - Update DB.
  - Publish completion event to Redis.

### 4. Frontend (Next.js)
- **Dashboard:**
  - List view of tickets color-coded by Urgency.
  - Detail view to edit Draft and Resolve.
- **Custom Hook:** `useSSE`
  - Must implement **Exponential Backoff** reconnection strategy.
  - Listen for updates and merge into local state without refreshing.

## Step-by-Step Implementation Plan
1. **Setup:** Initialize monorepo or separate folders (client/server), Docker Compose (Postgres, Redis).
2. **Backend Scaffolding:** Setup Express, Prisma, and Queue Adapter structure.
3. **Queue & Worker:** Implement BullMQ Adapter and the Worker logic.
4. **AI Integration:** Connect OpenAI/Mock LLM and Zod validation.
5. **Real-time:** Implement Redis Pub/Sub and SSE endpoint.
6. **Frontend:** Build Dashboard and `useSSE` hook.