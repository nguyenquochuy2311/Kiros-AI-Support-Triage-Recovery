import { env } from "./config/index";

// Worker entry point - will be implemented in backend-worker phase
console.log(`🔧 Worker starting in ${env.NODE_ENV} mode...`);
console.log(`🤖 LLM Mock Mode: ${env.LLM_MOCK}`);

// TODO: Initialize BullMQ worker and process jobs
