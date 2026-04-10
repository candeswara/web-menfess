require('dotenv').config();
const express = require('express');
const rateLimit = require('express-rate-limit');
const axios = require('axios');
const cors = require('cors');
const validator = require('validator');

const app = express();

// --- 1. KONFIGURASI CORS ---
const allowedOrigins = ['http://localhost:3001'];
app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('CORS_POLICY_VIOLATION'));
        }
    }
}));

app.disable('x-powered-by');
app.use(express.json());
app.use(express.static('public'));

// --- 2. RATE LIMITING ---
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    handler: (req, res) => {
        res.status(429).json({ message: "Batas pengiriman tercapai. Coba lagi nanti." });
    }
});

// --- 3. ENDPOINT API ---
app.post('/api/pesan', limiter, async (req, res) => {
    try {
        const { nama, pesan, email_confirm } = req.body;

        if (email_confirm) return res.status(400).json({ message: "Spam detected." });

        if (!process.env.DISCORD_WEBHOOK_URL) {
            console.error("EROR: DISCORD_WEBHOOK_URL tidak ditemukan di .env");
            return res.status(500).json({ message: "Konfigurasi server bermasalah." });
        }

        const cleanNama = validator.escape(nama || 'Anonim').trim();
        const cleanPesan = validator.escape(pesan || '').trim();

        if (validator.isEmpty(cleanPesan) || cleanPesan.length < 10) {
            return res.status(400).json({ message: "Pesan minimal 10 karakter." });
        }

        // Kirim ke Discord
        await axios.post(process.env.DISCORD_WEBHOOK_URL, {
            embeds: [
                {
                    title: "📩 MenFess Baru",
                    color: 5793266,
                    fields: [
                        {
                            name: "👤 Pengirim",
                            value: validator.unescape(cleanNama),
                            inline: true
                        },
                        {
                            name: "📝 Isi Pesan",
                            value: validator.unescape(cleanPesan)
                        }
                    ],
                    footer: {
                        text: "Web MenFess • " + new Date().toLocaleString('id-ID')
                    }
                }
            ]
        });

        res.status(200).json({ message: "Pesan berhasil dikirim!" });

    } catch (error) {
        console.error("Detail Error:", error.message);
        res.status(500).json({ message: "Terjadi kesalahan saat mengirim pesan." });
    }
});

// --- 4. GLOBAL ERROR HANDLER (Agar tidak kirim HTML) ---
app.use((err, req, res, next) => {
    if (err.message === 'CORS_POLICY_VIOLATION') {
        return res.status(403).json({ message: "Akses ditolak oleh kebijakan CORS." });
    }
    res.status(500).json({ message: "Internal Server Error." });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Server berjalan di port ${PORT}`));