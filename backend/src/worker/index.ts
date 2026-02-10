/**
 * Worker Entry Point
 * Loads environment variables then starts the LLM judgement worker
 *
 * Run: npm run worker:llm
 */

// Load .env FIRST — same pattern as src/index.ts
import { loadEnv, validateEnv } from '../utils/env-loader';
loadEnv();
validateEnv();

// Now start the worker (side-effect import — pollLoop starts immediately)
import './llm-judgement.worker';
