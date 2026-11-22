/**
 * app.js  —  Inti Express Application yang digunakan bersama oleh:
 *   - server.js  : Menjalankan lokal dengan Node.js / nodemon
 *   - worker.js  : Deploy ke Cloudflare Workers
 *
 * Koneksi database menggunakan @neondatabase/serverless agar
 * kompatibel dengan Cloudflare Workers (HTTP transport, bukan TCP).
 */

'use strict';

// Support both CommonJS (server.js) and ESM (worker.js via wrangler bundle)
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

function createExpressApp({ sql, env } = {}) {
  const app = express();

  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.status(204).end();
    next();
  });

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // ── Helper: Jalankan query Neon ────────────────────────────────────────────
  const runQuery = async (text, params) => {
    if (sql) {
      if (typeof sql.query === 'function') {
        const result = await sql.query(text, params);
        return { rows: result.rows || result };
      }
      const result = await sql(text, params);
      return { rows: result.rows || result };
    }
    const { getPool } = require('./db');
    return getPool().query(text, params);
  };

  const getJwtSecret = () => {
    const secret = process.env.JWT_SECRET || (env && env.JWT_SECRET);
    if (!secret) throw new Error('JWT_SECRET is not configured');
    return secret;
  };

  // ── Middleware JWT ──────────────────────────────────────────────────────────
  const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Akses ditolak. Token tidak ditemukan.' });
    jwt.verify(token, getJwtSecret(), (err, user) => {
      if (err) return res.status(403).json({ message: 'Token tidak valid.' });
      req.user = user;
      next();
    });
  };

  // ── Health check ───────────────────────────────────────────────────────────
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ══════════════════════════════════════════════════════════════════
  //  AUTH ROUTES
  // ══════════════════════════════════════════════════════════════════

  // Register
  app.post('/api/auth/register', async (req, res) => {
    const name = String(req.body?.name ?? '').trim();
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Nama, email, dan password wajib diisi.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password minimal 6 karakter.' });
    }
    try {
      const existing = await runQuery('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rows.length > 0) {
        return res.status(400).json({ message: 'Email sudah terdaftar.' });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      const result = await runQuery(
        'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email, avatar',
        [name, email, hashedPassword]
      );
      const user = result.rows[0];
      const token = jwt.sign({ id: user.id, email: user.email }, getJwtSecret(), { expiresIn: '30d' });
      res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar || null } });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  // Login
  app.post('/api/auth/login', async (req, res) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');
    if (!email || !password) {
      return res.status(400).json({ message: 'Email dan password wajib diisi.' });
    }
    try {
      const result = await runQuery('SELECT * FROM users WHERE email = $1', [email]);
      if (result.rows.length === 0) {
        return res.status(400).json({ message: 'Email atau password salah.' });
      }
      const user = result.rows[0];
      const validPass = await bcrypt.compare(password, user.password);
      if (!validPass) {
        return res.status(400).json({ message: 'Email atau password salah.' });
      }
      const token = jwt.sign({ id: user.id, email: user.email }, getJwtSecret(), { expiresIn: '30d' });
      res.json({ token, user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar || null } });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  // Ambil profil
  app.get('/api/auth/me', authenticateToken, async (req, res) => {
    try {
      const result = await runQuery('SELECT id, name, email, avatar FROM users WHERE id = $1', [req.user.id]);
      if (result.rows.length === 0) return res.status(404).json({ message: 'Pengguna tidak ditemukan.' });
      res.json({ user: result.rows[0] });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  // Update profil (nama & avatar sekaligus)
  app.put('/api/auth/profile', authenticateToken, async (req, res) => {
    const name = String(req.body?.name ?? '').trim();
    const { avatar } = req.body ?? {};
    if (!name) return res.status(400).json({ message: 'Nama tidak boleh kosong.' });
    try {
      let result;
      if (avatar !== undefined) {
        result = await runQuery(
          'UPDATE users SET name = $1, avatar = $2 WHERE id = $3 RETURNING id, name, email, avatar',
          [name, avatar, req.user.id]
        );
      } else {
        result = await runQuery(
          'UPDATE users SET name = $1 WHERE id = $2 RETURNING id, name, email, avatar',
          [name, req.user.id]
        );
      }
      if (result.rows.length === 0) return res.status(404).json({ message: 'Pengguna tidak ditemukan.' });
      res.json({ user: result.rows[0], message: 'Profil berhasil diperbarui.' });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  // Update avatar saja
  app.put('/api/auth/avatar', authenticateToken, async (req, res) => {
    const { avatar } = req.body ?? {};
    try {
      const result = await runQuery(
        'UPDATE users SET avatar = $1 WHERE id = $2 RETURNING id, name, email, avatar',
        [avatar || null, req.user.id]
      );
      if (result.rows.length === 0) return res.status(404).json({ message: 'Pengguna tidak ditemukan.' });
      res.json({ user: result.rows[0], message: 'Foto profil berhasil diperbarui.' });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  // Ganti password
  app.put('/api/auth/change-password', authenticateToken, async (req, res) => {
    const { oldPassword, newPassword } = req.body ?? {};
    if (!oldPassword || !newPassword) return res.status(400).json({ message: 'Semua kolom wajib diisi.' });
    if (newPassword.length < 6) return res.status(400).json({ message: 'Password baru minimal 6 karakter.' });
    try {
      const userRes = await runQuery('SELECT password FROM users WHERE id = $1', [req.user.id]);
      if (userRes.rows.length === 0) return res.status(404).json({ message: 'User tidak ditemukan.' });
      const valid = await bcrypt.compare(oldPassword, userRes.rows[0].password);
      if (!valid) return res.status(400).json({ message: 'Password lama salah.' });
      const hashed = await bcrypt.hash(newPassword, 10);
      await runQuery('UPDATE users SET password = $1 WHERE id = $2', [hashed, req.user.id]);
      res.json({ message: 'Password berhasil diperbarui.' });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  // ══════════════════════════════════════════════════════════════════
  //  TRANSACTION ROUTES
  // ══════════════════════════════════════════════════════════════════

  app.get('/api/transactions', authenticateToken, async (req, res) => {
    try {
      const result = await runQuery(
        'SELECT * FROM transactions WHERE user_id = $1 ORDER BY date DESC, created_at DESC',
        [req.user.id]
      );
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/transactions', authenticateToken, async (req, res) => {
    const { type } = req.body ?? {};
    const hasId = Object.prototype.hasOwnProperty.call(req.body ?? {}, 'id');
    const id = hasId ? req.body.id : undefined;
    const amount = Number(req.body?.amount);
    const title = String(req.body?.title ?? '').trim();
    const category = String(req.body?.category ?? '').trim();
    const date = req.body?.date || new Date().toISOString().split('T')[0];
    const note = String(req.body?.note ?? '').trim();
    if (hasId && (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) {
      return res.status(400).json({ message: 'ID transaksi tidak valid.' });
    }
    if (!['income', 'expense'].includes(type)) {
      return res.status(400).json({ message: 'Tipe transaksi harus pemasukan atau pengeluaran.' });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ message: 'Nominal transaksi harus berupa angka lebih dari 0.' });
    }
    if (!title) return res.status(400).json({ message: 'Judul transaksi tidak boleh kosong.' });
    if (!category) return res.status(400).json({ message: 'Kategori transaksi tidak boleh kosong.' });
    try {
      const result = hasId
        ? await runQuery(
          'INSERT INTO transactions (id, user_id, type, amount, title, category, date, note) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, amount = EXCLUDED.amount, title = EXCLUDED.title, category = EXCLUDED.category, date = EXCLUDED.date, note = EXCLUDED.note WHERE transactions.user_id = EXCLUDED.user_id RETURNING *',
          [id, req.user.id, type, amount, title, category, date, note]
        )
        : await runQuery(
          'INSERT INTO transactions (user_id, type, amount, title, category, date, note) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
          [req.user.id, type, amount, title, category, date, note]
        );
      if (hasId && result.rows.length === 0) {
        return res.status(409).json({ message: 'ID transaksi sudah digunakan.' });
      }
      res.status(201).json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  app.put('/api/transactions/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { type } = req.body ?? {};
    const amount = Number(req.body?.amount);
    const title = String(req.body?.title ?? '').trim();
    const category = String(req.body?.category ?? '').trim();
    const date = req.body?.date;
    const note = String(req.body?.note ?? '').trim();
    if (!['income', 'expense'].includes(type)) {
      return res.status(400).json({ message: 'Tipe transaksi harus pemasukan atau pengeluaran.' });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ message: 'Nominal transaksi harus berupa angka lebih dari 0.' });
    }
    if (!title) return res.status(400).json({ message: 'Judul transaksi tidak boleh kosong.' });
    if (!category) return res.status(400).json({ message: 'Kategori transaksi tidak boleh kosong.' });
    if (!date) return res.status(400).json({ message: 'Tanggal transaksi wajib diisi.' });
    try {
      const result = await runQuery(
        'UPDATE transactions SET type = $1, amount = $2, title = $3, category = $4, date = $5, note = $6 WHERE id = $7 AND user_id = $8 RETURNING *',
        [type, amount, title, category, date, note, id, req.user.id]
      );
      if (result.rows.length === 0) return res.status(404).json({ message: 'Transaksi tidak ditemukan.' });
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  // Reset routes must be registered before the parameterized DELETE route below.
  const resetMonthHandler = async (req, res) => {
    try {
      const now = new Date();
      const year = Number(req.query?.year ?? req.body?.year ?? now.getFullYear());
      const requestedMonth = req.query?.month ?? req.body?.month;
      if (!Number.isInteger(year) || year < 1 || year > 9999) {
        return res.status(400).json({ message: 'Tahun transaksi tidak valid.' });
      }
      if (requestedMonth === undefined) {
        const startOfYear = `${String(year).padStart(4, '0')}-01-01`;
        const startOfNextYear = `${String(year + 1).padStart(4, '0')}-01-01`;
        await runQuery(
          'DELETE FROM transactions WHERE user_id = $1 AND date >= $2::date AND date < $3::date',
          [req.user.id, startOfYear, startOfNextYear]
        );
        return res.json({ message: `Semua transaksi tahun ${year} berhasil direset.` });
      }
      const monthNum = Number(requestedMonth);
      if (!Number.isInteger(monthNum) || monthNum < 1 || monthNum > 12) {
        return res.status(400).json({ message: 'Bulan harus berupa angka antara 1 dan 12.' });
      }
      const month = String(monthNum).padStart(2, '0');
      const startOfMonth = `${year}-${month}-01`;
      await runQuery(
        `DELETE FROM transactions WHERE user_id = $1 AND date >= $2::date AND date < ($2::date + interval '1 month')`,
        [req.user.id, startOfMonth]
      );
      res.json({ message: 'Semua transaksi bulan ini berhasil direset.' });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  };

  app.delete('/api/transactions/reset/monthly', authenticateToken, resetMonthHandler);
  app.delete('/api/transactions/reset/month', authenticateToken, resetMonthHandler);

  app.delete('/api/transactions/reset/all', authenticateToken, async (req, res) => {
    try {
      await runQuery('DELETE FROM transactions WHERE user_id = $1', [req.user.id]);
      res.json({ message: 'Semua riwayat transaksi berhasil direset permanen.' });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  // Ekspor CSV
  app.get('/api/transactions/export/csv', authenticateToken, async (req, res) => {
    try {
      const result = await runQuery(
        'SELECT date, type, title, category, amount, note FROM transactions WHERE user_id = $1 ORDER BY date DESC, created_at DESC',
        [req.user.id]
      );
      const escapeCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
      const csvRows = [
        ['Tanggal', 'Tipe', 'Judul', 'Kategori', 'Nominal', 'Catatan'],
        ...result.rows.map((row) => {
          const typeLabel = row.type === 'income' ? 'Pemasukan' : 'Pengeluaran';
          const dateStr = typeof row.date === 'string' ? row.date.split('T')[0] : new Date(row.date).toISOString().split('T')[0];
          return [dateStr, typeLabel, row.title, row.category, row.amount, row.note];
        }),
      ];
      const csv = `${csvRows.map((row) => row.map(escapeCsv).join(',')).join('\r\n')}\r\n`;
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="catatan-keuangan.csv"');
      res.send(csv);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete('/api/transactions/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
      await runQuery('DELETE FROM transactions WHERE id = $1 AND user_id = $2', [id, req.user.id]);
      res.json({ message: 'Transaksi berhasil dihapus.' });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  return app;
}

module.exports = { createExpressApp };
