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
    const { name, email, password } = req.body;
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
    const { email, password } = req.body;
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
    const { name, avatar } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'Nama tidak boleh kosong.' });
    try {
      let result;
      if (avatar !== undefined) {
        result = await runQuery(
          'UPDATE users SET name = $1, avatar = $2 WHERE id = $3 RETURNING id, name, email, avatar',
          [name.trim(), avatar, req.user.id]
        );
      } else {
        result = await runQuery(
          'UPDATE users SET name = $1 WHERE id = $2 RETURNING id, name, email, avatar',
          [name.trim(), req.user.id]
        );
      }
      res.json({ user: result.rows[0], message: 'Profil berhasil diperbarui.' });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  // Update avatar saja
  app.put('/api/auth/avatar', authenticateToken, async (req, res) => {
    const { avatar } = req.body;
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
    const { oldPassword, newPassword } = req.body;
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
    const { type, amount, title, category, date } = req.body;
    try {
      const result = await runQuery(
        'INSERT INTO transactions (user_id, type, amount, title, category, date) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [req.user.id, type, amount, title, category, date || new Date().toISOString().split('T')[0]]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  app.put('/api/transactions/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { type, amount, title, category, date } = req.body;
    try {
      const result = await runQuery(
        'UPDATE transactions SET type = $1, amount = $2, title = $3, category = $4, date = $5 WHERE id = $6 AND user_id = $7 RETURNING *',
        [type, amount, title, category, date, id, req.user.id]
      );
      if (result.rows.length === 0) return res.status(404).json({ message: 'Transaksi tidak ditemukan.' });
      res.json(result.rows[0]);
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

  // Reset bulan ini
  const resetMonthHandler = async (req, res) => {
    try {
      const now = new Date();
      const year = req.body?.year || req.query?.year || now.getFullYear();
      const monthNum = req.body?.month || req.query?.month || (now.getMonth() + 1);
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
        'SELECT date, type, title, category, amount FROM transactions WHERE user_id = $1 ORDER BY date DESC, created_at DESC',
        [req.user.id]
      );
      let csv = 'Tanggal,Tipe,Judul,Kategori,Nominal\r\n';
      for (const row of result.rows) {
        const typeLabel = row.type === 'income' ? 'Pemasukan' : 'Pengeluaran';
        const cleanTitle = (row.title || '').replace(/"/g, '""');
        const cleanCat = (row.category || '').replace(/"/g, '""');
        const dateStr = typeof row.date === 'string' ? row.date.split('T')[0] : new Date(row.date).toISOString().split('T')[0];
        csv += `${dateStr},${typeLabel},"${cleanTitle}","${cleanCat}",${row.amount}\r\n`;
      }
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="catatan-keuangan.csv"');
      res.send(csv);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  // ══════════════════════════════════════════════════════════════════
  //  SCAN RECEIPT OCR (GEMINI VISION)
  // ══════════════════════════════════════════════════════════════════

  app.post('/api/scan-receipt', authenticateToken, async (req, res) => {
    const { imageBase64, mimeType } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ message: 'Gambar struk tidak boleh kosong.' });
    }

    const apiKey = process.env.GEMINI_API_KEY || (env && env.GEMINI_API_KEY);
    if (!apiKey || apiKey.includes('MASUKKAN_GEMINI_API_KEY')) {
      return res.status(400).json({ message: 'API Key Gemini belum disetel di environment. Silakan set via wrangler secret put GEMINI_API_KEY.' });
    }

    const prompt = `Kamu adalah pakar OCR dan analisis struk belanja / transaksi keuangan berbahasa Indonesia yang sangat teliti.
TUGAS UTAMA:
Analisis gambar struk / screenshot transaksi berikut secara cermat dan ekstrak informasi penting:

1. "merchantName": Nama toko / minimarket / restoran / platform (contoh: "Indomaret", "Alfamart", "SPBU Pertamina", "GoFood", "Tokopedia", dll). Jika tidak ada nama toko, isi dengan "Struk Belanja".
2. "date": Tanggal transaksi pada struk.
   - Periksa tanggal di bagian atas/bawah struk (misal: "12/11/2026", "12-11-2026", "12 Nov 2026", "2026-11-12 14:30").
   - Konversikan SELALU ke format standar ISO "YYYY-MM-DD" (contoh: "2026-11-12").
   - Jika tanggal sama sekali tidak terbaca/tidak tercantum, gunakan tanggal hari ini.
3. "totalAmount": Total akhir (Grand Total) yang dibayarkan oleh pembeli. Pastikan angka integer bulat (tanpa koma desimal, tanpa titik pemisah ribuan, tanpa simbol Rp).
4. "items": Daftar barang / pengeluaran yang tercantum.
   Untuk setiap item:
   - "title": Nama produk/layanan yang dibeli. Bersihkan singkatan kasir agar rapi dan mudah dimengerti.
   - "amount": Total harga akhir untuk barang tersebut (angka integer, sudah terhitung diskon bila ada).
   - "category": Tentukan kategori paling relevan HANYA dari salah satu pilihan berikut:
     ["Makan", "Transport", "Belanja", "Tagihan", "Hiburan", "Kesehatan", "Lainnya"].

ATURAN KETAT:
- Jangan memasukkan nomor kasir, kode struk, barcode, baris subtotal, baris PPN/tax, atau nomor kartu debit/kredit sebagai item belanja!
- Kembalikan HANYA format JSON murni tanpa markdown \`\`\`json.`;

    try {
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      const validMime = mimeType || 'image/jpeg';

      const callGemini = async (modelName) => {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        return fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: validMime, data: cleanBase64 } }] }],
            generationConfig: { response_mime_type: 'application/json', temperature: 0.1 },
          }),
        });
      };

      let response = await callGemini('gemini-3.5-flash-lite');
      if (!response.ok && (response.status === 404 || response.status === 503)) {
        response = await callGemini('gemini-3.5-flash');
      }

      const jsonRes = await response.json();
      if (!response.ok) {
        const errMsg = jsonRes?.error?.message || 'Gagal memproses struk via Gemini API.';
        return res.status(response.status).json({ message: errMsg });
      }

      const rawText = jsonRes?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      const cleanedText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanedText);

      const merchantName = (parsed.merchantName || 'Struk Belanja').trim();
      let receiptDate = parsed.date;
      if (!receiptDate || !/^\d{4}-\d{2}-\d{2}$/.test(receiptDate)) {
        receiptDate = new Date().toISOString().split('T')[0];
      }

      const totalAmount = Math.abs(Number(parsed.totalAmount)) || 0;
      const allowedCategories = ['Makan', 'Transport', 'Belanja', 'Tagihan', 'Hiburan', 'Kesehatan', 'Lainnya'];
      const items = Array.isArray(parsed.items)
        ? parsed.items
            .map((item) => ({
              title: String(item.title || 'Barang').trim(),
              amount: Math.abs(Number(item.amount)) || 0,
              category: allowedCategories.includes(item.category) ? item.category : 'Belanja',
            }))
            .filter((item) => item.amount > 0 && item.title.length > 0)
        : [];

      if (items.length === 0 && totalAmount > 0) {
        items.push({
          title: merchantName !== 'Struk Belanja' ? `Belanja di ${merchantName}` : 'Belanja Struk',
          amount: totalAmount,
          category: 'Belanja',
        });
      }

      res.json({
        merchantName,
        date: receiptDate,
        totalAmount: totalAmount || items.reduce((sum, it) => sum + it.amount, 0),
        items,
      });
    } catch (err) {
      res.status(500).json({ message: 'Terjadi kesalahan sistem saat memproses struk: ' + err.message });
    }
  });

  return app;
}

module.exports = { createExpressApp };
