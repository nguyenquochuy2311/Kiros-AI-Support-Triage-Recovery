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
2.  **Docker** & Docker Compose (for Redis & Postgres)
3.  **OpenAI API Key**

### 1. Environment Setup

This project uses a root `.env` file for Docker Compose and specific configurations for local development.

1.  **Root (Docker)**: Copy `.env.example` to `.env` in the root directory.
    ```bash
    cp .env.example .env
    ```
    *Fill in your `OPENAI_API_KEY` in the `.env` file.*

2.  **Client**: Copy `client/.env.example` to `client/.env.local`.
    ```bash
    cp client/.env.example client/.env.local
    ```

### 2. Start Infrastructure (Redis & Postgres)

Start the database and queue instances using Docker Compose.

```bash
docker-compose up -d redis postgres
```

### 3. Backend Setup (`/server`)

The server and worker run together in development mode.

1.  **Install Dependencies**:
    ```bash
    cd server
    npm install
    ```

2.  **Database Migration**:
    ```bash
    npx prisma migrate dev
    ```

3.  **Start Server & Worker**:
    ```bash
    npm run dev
    ```
    *This command starts both the API Server (port 3001) and the Background Worker.*

### 4. Frontend Setup (`/client`)

1.  **Install Dependencies**:
    ```bash
    cd client
    npm install
    ```

2.  **Start Client**:
    ```bash
    npm run dev
    ```

Visit `http://localhost:3000` to access the application.

## 🐳 Full Stack Docker (Optional)

Run the entire stack (API, Worker, Client, Redis, Postgres) in containers:

```bash
# Ensure root .env is configured
docker-compose up --build
```

- Client: `http://localhost:3000`
- API: `http://localhost:3001`

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
    - **Postgres**
5.  **Important**: You must manually provide the `OPENAI_API_KEY` in the Render dashboard environment variables for the API and Worker services. The `DATABASE_URL` is automatically injected by Render's managed database service.

## 🧪 Verification

To verify the system's engineering depth (retries, error handling):

1.  Start the app components.
2.  Stop the Worker process (`npm run dev:worker`).
3.  Create a ticket in the UI.
4.  Note it stays "PENDING" in the queue.
5.  Start the Worker. It will pick up the job and process it.
6.  (Optional) Disconnect internet to simulate OpenAI failure -> Worker will retry 5 times with backoff.
