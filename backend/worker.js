/**
 * Cloudflare Workers entry point.
 */

import { createServer } from 'node:http';
import { httpServerHandler } from 'cloudflare:node';
import { neon, neonConfig } from '@neondatabase/serverless';

neonConfig.fetchConnectionCache = true;

const { createExpressApp } = await import('./app.js');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

let workerHandlerPromise;

function copyBindingsToProcessEnv(env) {
  for (const name of ['DATABASE_URL', 'JWT_SECRET']) {
    if (typeof env[name] !== 'string' || env[name].length === 0) {
      throw new Error(`Missing required Worker binding: ${name}`);
    }
    process.env[name] = env[name];
  }
  process.env.GEMINI_API_KEY =
    typeof env.GEMINI_API_KEY === 'string' ? env.GEMINI_API_KEY : '';
}

async function getWorkerHandler(env) {
  if (!workerHandlerPromise) {
    workerHandlerPromise = (async () => {
      const sql = neon(env.DATABASE_URL);
      const app = createExpressApp({ sql, env });
      const server = createServer(app);

      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, resolve);
      });

      return httpServerHandler(server);
    })();
  }
  return workerHandlerPromise;
}

function addCorsHeaders(response) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(CORS_HEADERS)) {
    headers.set(name, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request, env, ctx) {
    try {
      copyBindingsToProcessEnv(env);

      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
      }

      const handler = await getWorkerHandler(env);
      return addCorsHeaders(await handler.fetch(request, env, ctx));
    } catch (error) {
      console.error('[Worker] Request failed:', error);
      return addCorsHeaders(
        Response.json({ message: 'Internal Server Error' }, { status: 500 })
      );
    }
  },
};
