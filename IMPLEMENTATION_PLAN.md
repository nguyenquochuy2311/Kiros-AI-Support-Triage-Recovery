---
name: AI Support Triage Hub
overview: Build a full-stack MVP that ingests support tickets, processes them asynchronously via AI (LLM), and provides a real-time agent dashboard using Express, BullMQ, Prisma, and Next.js.
todos:
  - id: setup-infra
    content: Setup project structure + Docker Compose (Postgres, Redis)
    status: pending
  - id: backend-prisma
    content: Initialize Express, Prisma schema, and DB migrations
    status: pending
  - id: backend-adapter
    content: Implement IQueueAdapter interface + BullMQAdapter
    status: pending
  - id: backend-api
    content: Build ticket API endpoints (CRUD + validation)
    status: pending
  - id: backend-worker
    content: Implement worker with LLM integration + Zod validation
    status: pending
  - id: backend-sse
    content: Setup Redis Pub/Sub + SSE endpoint
    status: pending
  - id: frontend-setup
    content: Initialize Next.js with Shadcn/UI + TailwindCSS
    status: pending
  - id: frontend-sse
    content: Implement useSSE hook with exponential backoff
    status: pending
  - id: frontend-dashboard
    content: Build Dashboard UI (list, detail, create form)
    status: pending
  - id: integration-test
    content: End-to-end demo test scenarios
    status: pending
---

# AI Support "Triage & Recovery" Hub - Implementation Plan

## 1. PRD Summary

### Problem Statement

Support teams are overwhelmed with tickets. Manual triage is slow, inconsistent, and delays response times.

### Solution

An AI-powered system that:

- Automatically categorizes tickets (Billing, Technical, General)
- Assigns urgency (High/Medium/Low)
- Analyzes sentiment (1-10 scale)
- Generates draft replies for agents

### Success Metrics

- API response `POST /tickets` < 200ms (non-blocking)
- AI processing completes in background (BullMQ worker)
- Real-time updates via SSE (no page refresh)
- Graceful failure handling (no crashes on bad AI output)

---

## 2. Technical Architecture

```mermaid
flowchart TB
    subgraph client [Frontend - Next.js]
        Dashboard[Dashboard UI]
        SSEHook[useSSE Hook]
    end
    
    subgraph api [API Server - Express]
        Controller[Ticket Controller]
        SSEEndpoint[SSE Endpoint]
        QueueAdapter[IQueueAdapter]
    end
    
    subgraph infra [Infrastructure]
        Redis[(Redis)]
        Postgres[(PostgreSQL)]
        BullMQ[BullMQ Queue]
    end
    
    subgraph worker [Background Worker]
        Processor[Job Processor]
        LLMService[LLM Service]
        ZodValidator[Zod Validator]
    end
    
    Dashboard -->|POST /tickets| Controller
    Controller -->|201 Immediate| Dashboard
    Controller -->|addJob| QueueAdapter
    QueueAdapter --> BullMQ
    BullMQ --> Processor
    Processor --> LLMService
    LLMService --> ZodValidator
    ZodValidator -->|Update| Postgres
    Processor -->|Publish| Redis
    Redis -->|Subscribe| SSEEndpoint
    SSEEndpoint -->|Stream| SSEHook
    SSEHook -->|Update State| Dashboard
```

### Data Flow

1. **User submits ticket** → API validates with Zod → Creates DB record (PENDING) → Enqueues job → Returns 201
2. **Worker picks job** → Fetches ticket → Calls LLM → Validates output with Zod → Updates DB (PROCESSED/FAILED) → Publishes to Redis
3. **SSE streams update** → Frontend merges state → UI updates instantly

---

## 3. Project Structure

```
/
├── server/                    # Backend (Express + Worker)
│   ├── src/
│   │   ├── config/           # env, redis, prisma configs
│   │   ├── controllers/      # ticketController.ts
│   │   ├── services/         # ticketService.ts, llmService.ts
│   │   ├── adapters/         # IQueueAdapter, BullMQAdapter
│   │   ├── workers/          # ticketWorker.ts
│   │   ├── validators/       # Zod schemas (input + AI output)
│   │   ├── routes/           # API routes
│   │   ├── sse/              # SSE manager + Redis subscriber
│   │   └── index.ts          # Express entry
│   ├── prisma/
│   │   └── schema.prisma
│   └── package.json
│
├── client/                    # Frontend (Next.js)
│   ├── app/
│   │   ├── page.tsx          # Dashboard
│   │   ├── tickets/[id]/     # Ticket detail
│   │   └── layout.tsx
│   ├── components/
│   │   ├── TicketList.tsx
│   │   ├── TicketCard.tsx
│   │   ├── TicketDetail.tsx
│   │   └── CreateTicketForm.tsx
│   ├── hooks/
│   │   └── useSSE.ts         # Exponential backoff
│   ├── lib/
│   │   └── api.ts            # Fetch helpers
│   └── package.json
│
├── docker-compose.yml         # Postgres + Redis
└── .env.example
```

---

## 4. Backend Implementation Details

### 4.1 Database Schema ([server/prisma/schema.prisma](server/prisma/schema.prisma))

```prisma
enum TicketStatus {
  PENDING
  PROCESSED
  FAILED
  RESOLVED
}

model Ticket {
  id         String       @id @default(uuid())
  content    String
  status     TicketStatus @default(PENDING)
  category   String?      // Billing, Technical, General
  urgency    String?      // High, Medium, Low
  sentiment  Int?         // 1-10
  draftReply String?
  finalReply String?
  createdAt  DateTime     @default(now())
  updatedAt  DateTime     @updatedAt
}
```

### 4.2 Queue Adapter Pattern ([server/src/adapters/](server/src/adapters/))

```typescript
// IQueueAdapter.ts - Interface
interface IQueueAdapter {
  connect(): Promise<void>;
  addJob(name: string, data: unknown): Promise<void>;
  process(name: string, handler: JobHandler): void;
  close(): Promise<void>;
}

// BullMQAdapter.ts - Implementation
// Uses BullMQ Queue + Worker internally
```

### 4.3 API Endpoints ([server/src/routes/](server/src/routes/))

| Method | Endpoint           | Description                | Response               |
| ------ | ------------------ | -------------------------- | ---------------------- |
| POST   | `/api/tickets`     | Create ticket, enqueue job | 201 + ticket (PENDING) |
| GET    | `/api/tickets`     | List all tickets           | 200 + tickets[]        |
| GET    | `/api/tickets/:id` | Get single ticket          | 200 + ticket           |
| PATCH  | `/api/tickets/:id` | Resolve ticket (agent)     | 200 + updated ticket   |
| GET    | `/api/events`      | SSE stream                 | text/event-stream      |

### 4.4 Zod Validators ([server/src/validators/](server/src/validators/))

```typescript
// Input validation
const createTicketSchema = z.object({
  content: z.string().min(10).max(2000),
});

// AI output validation (CRITICAL - prevents crashes)
const llmResponseSchema = z.object({
  category: z.enum(["Billing", "Technical", "General"]),
  urgency: z.enum(["High", "Medium", "Low"]),
  sentiment: z.number().int().min(1).max(10),
  draftReply: z.string().min(1),
});
```

### 4.5 Worker Logic ([server/src/workers/ticketWorker.ts](server/src/workers/ticketWorker.ts))

```typescript
// Pseudocode flow:
// 1. Fetch ticket by ID from Prisma
// 2. Call LLM with ticket.content
// 3. Parse response as JSON
// 4. Validate with Zod (safeParse)
// 5. If valid: update DB with results, status = PROCESSED
// 6. If invalid: status = FAILED, log error
// 7. Publish to Redis channel "ticket-updates"
```

### 4.6 SSE + Redis Pub/Sub ([server/src/sse/](server/src/sse/))

```typescript
// Redis subscriber listens to "ticket-updates"
// SSE manager maintains connected clients Map
// On message: broadcast to all connected clients
```

---

## 5. Frontend Implementation Details

### 5.1 useSSE Hook with Exponential Backoff ([client/hooks/useSSE.ts](client/hooks/useSSE.ts))

```typescript
// Key features:
// - Initial delay: 1000ms
// - Max delay: 30000ms
// - Multiplier: 2x on each retry
// - Reset delay on successful connection
// - Cleanup on unmount
```

### 5.2 Dashboard Components

| Component          | Purpose                                        |
| ------------------ | ---------------------------------------------- |
| `TicketList`       | Displays all tickets, color-coded by urgency   |
| `TicketCard`       | Single ticket summary (status badge, category) |
| `TicketDetail`     | Full view with draft/final reply editing       |
| `CreateTicketForm` | Submit new ticket                              |

### 5.3 UI Color Coding (Urgency)

- **High**: Red (`bg-red-100 border-red-500`)
- **Medium**: Yellow (`bg-yellow-100 border-yellow-500`)
- **Low**: Green (`bg-green-100 border-green-500`)

---

## 6. Infrastructure (Docker Compose)

```yaml
services:
  postgres:
    image: postgres:15
    ports: ["5432:5432"]
    environment:
      POSTGRES_DB: triage_hub
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
```

---

## 7. Environment Variables

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/triage_hub"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# OpenAI (or mock)
OPENAI_API_KEY=sk-...
LLM_MOCK=true  # Use mock for demo

# Server
PORT=3001
NODE_ENV=development
```

---

## 8. Demo Test Scenarios

1. **Happy Path**: Submit ticket → See PENDING → Watch SSE update to PROCESSED → View AI results
2. **Failure Recovery**: Force bad AI response → Verify FAILED status (no crash)
3. **Reconnection**: Kill SSE → Verify exponential backoff → Reconnect
4. **Agent Resolution**: Edit draft → Submit final reply → Status = RESOLVED
