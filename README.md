# Kiros AI Support Triage & Recovery

An intelligent support triage system that uses AI to analyze tickets, categorize them, and draft responses. Built with Engineering Depth in mind.

## 🚀 Features

- **Automated Triage**: Classifies tickets (Billing, Technical, Feature) and determines urgency.
- **Sentiment Analysis**: Detects customer sentiment (1-10) to prioritize angry users.
- **Draft Replies**: Uses LLM (OpenAI) to generate context-aware draft responses.
- **Real-time Updates**: Pushes updates to the frontend via Server-Sent Events (SSE) / Polling.
- **Robust Architecture**:
    - **Separation of Concerns**: API and Background Worker are separate processes.
    - **Reliability**: Queue-based processing (BullMQ) with automatic retries and exponential backoff.
    - **Performance**: Redis-based caching and event publishing.

## 🛠 Tech Stack

- **Frontend**: Next.js, TailwindCSS, Lucide Icons.
- **Backend**: Node.js, Express, Prisma (PostgreSQL), BullMQ (Redis).
- **AI**: OpenAI API.
- **Infrastructure**: Docker (Redis), Render (Deployment).

## 🏃 Local Development

### Prerequisites

1.  **Node.js** (v18+)
2.  **Docker** (for Redis)
3.  **OpenAI API Key**

### 1. Start Infrastructure (Redis)

Use Docker Compose to start the Redis instance needed for the job queue.

```bash
docker-compose up -d redis
```

### 2. Run Full Stack with Docker Compose (Optional)

If you prefer to run the entire stack (API, Worker, Client, Redis) in containers:

```bash
# Ensure you have a .env file in ./server
docker-compose up --build
```

The app will be available at:
- Client: `http://localhost:3000`
- API: `http://localhost:3001`

### 3. Backend Setup (`/server`)

Create a `.env` file in `server/` based on `.env.example`:

```env
DATABASE_URL="postgresql://..." # Your Postgres URL (e.g., local or Neon)
REDIS_HOST="localhost"
REDIS_PORT=6379
OPENAI_API_KEY="sk-..."
PORT=3001
```

Install and Run:

```bash
cd server
npm install
npx prisma migrate dev  # Set up database
npm run dev             # Starts API Server
```

**Start the Background Worker:**

IN A SEPARATE TERMINAL, start the worker process to handle ticket analysis.

```bash
cd server
npm run dev:worker
```

### 3. Frontend Setup (`/client`)

Create a `.env.local` file in `client/`:

```env
NEXT_PUBLIC_API_URL="http://localhost:3001"
```

Install and Run:

```bash
cd client
npm install
npm run dev
```

Visit `http://localhost:3000` to access the application.

## ☁️ Deployment (Render.com)

This project is configured for easy deployment on [Render](https://render.com) using Infrastructure as Code (`render.yaml`).

1.  Push your code to a GitHub repository.
2.  In Render dashboard, go to **Blueprints** -> **New Blueprint Instance**.
3.  Connect your repository.
4.  Render will automatically detect `render.yaml` and prompt you to create:
    - **API Service**
    - **Worker Service**
    - **Client Service**
    - **Redis**
5.  **Important**: You must manually provide the `DATABASE_URL` and `OPENAI_API_KEY` in the Render dashboard environment variables for the API and Worker services.

## 🧪 Verification

To verify the system's engineering depth (retries, error handling):

1.  Start the app components.
2.  Stop the Worker process (`npm run dev:worker`).
3.  Create a ticket in the UI.
4.  Note it stays "PENDING" in the queue.
5.  Start the Worker. It will pick up the job and process it.
6.  (Optional) Disconnect internet to simulate OpenAI failure -> Worker will retry 5 times with backoff.
