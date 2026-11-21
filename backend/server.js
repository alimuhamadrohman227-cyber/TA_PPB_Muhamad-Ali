/**
 * server.js  —  Entry point untuk development lokal dengan Node.js / nodemon
 *
 * Gunakan:  node server.js   atau   nodemon server.js
 *
 * Untuk deploy ke Cloudflare Workers, gunakan worker.js via wrangler deploy.
 */

'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config();

const { createExpressApp } = require('./app');
const { initDB } = require('./db');

if (typeof globalThis.WebSocketPair === 'undefined') {
  const app = createExpressApp({ sql: null, env: null });

  // Inisialisasi skema database saat server Node pertama kali jalan
  initDB();

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`[Local] Server Express berjalan di http://localhost:${PORT}`);
  });
}
