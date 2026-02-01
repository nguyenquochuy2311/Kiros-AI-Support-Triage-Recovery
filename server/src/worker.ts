import './config/env'; // Load environment variables first with validation and expansion
import { env } from "./config/index";

console.log(`🔧 Worker starting in ${env.NODE_ENV} mode...`);
console.log(`🤖 LLM Mock Mode: ${env.LLM_MOCK}`);

import './workers/ticketWorker';

