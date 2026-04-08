require('dotenv').config();
const express = require('express');
const rateLimit = require('express-rate-limit');
const axios = require('axios');
const cors = require('cors');
const validator = require('validator');

const app = express();

// --- 1. KONFIGURASI CORS ---
const allowedOrigins = [
    'http://localhost:3000', 
    'https://menfess.domain.com'
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('CORS_POLICY_VIOLATION'));
        }
    }
}));

// --- 2. MIDDLEWARE ERROR HANDLER (Mencegah Respon HTML) ---
app.use((err, req, res, next) => {
    if (err.message === 'CORS_POLICY_VIOLATION') {
        return res.status(403).json({ 
            message: "Akses ditolak: Domain tidak diizinkan oleh kebijakan CORS." 
        });
    }
    next(err);
});

app.use(express.json());
app.use(express.static('public'));

// --- 3. RATE LIMITING ---
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    handler: (req, res) => {
        res.status(429).json({ message: "Batas pengiriman tercapai. Coba lagi dalam 15 menit." });
    }
});

// --- 4. ENDPOINT API ---
app.post('/api/pesan', limiter, async (req, res) => {
    let { nama, pesan, email_confirm } = req.body;

    if (email_confirm) return res.status(400).json({ message: "Spam detected." });

    const cleanNama = validator.escape(nama || 'Anonim').trim();
    const cleanPesan = validator.escape(pesan || '').trim();

    if (validator.isEmpty(cleanPesan) || cleanPesan.length < 10) {
        return res.status(400).json({ message: "Pesan minimal 10 karakter." });
    }

    try {
        const text = `<b>MENFESS BARU</b>\n\n<b>Dari:</b> ${validator.unescape(cleanNama)}\n<b>Pesan:</b>\n<i>${validator.unescape(cleanPesan)}</i>`;
        
        await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: process.env.TELEGRAM_CHAT_ID,
            text: text,
            parse_mode: 'HTML'
        });
        
        res.status(200).json({ message: "Pesan berhasil dikirim!" });
    } catch (error) {
        res.status(500).json({ message: "Gagal terhubung ke Telegram." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));