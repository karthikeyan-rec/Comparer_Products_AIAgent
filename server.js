// server.js — Unit-Price Comparer secure proxy server
// Loads GEMINI_API_KEY from .env and proxies requests to Google Generative Language API.
// The API key never leaves the server.

require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Parse incoming JSON bodies
app.use(express.json());

// Serve all static files (HTML, CSS, JS) from the same directory
app.use(express.static(path.join(__dirname)));

// ---------------------------------------------------------------
// POST /api/gemini
// Accepts a Gemini generateContent request body from the browser,
// injects the server-side API key, forwards to Google, returns response.
// ---------------------------------------------------------------
app.post('/api/gemini', async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({
            error: {
                message: 'GEMINI_API_KEY is not configured on the server. ' +
                         'Please add it to your .env file.'
            }
        });
    }

    const model = req.query.model || 'gemini-1.5-flash';
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    try {
        const response = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });

        const data = await response.json();

        // Forward whatever status code Gemini returned
        return res.status(response.status).json(data);
    } catch (err) {
        console.error('[Gemini Proxy Error]', err.message);
        return res.status(502).json({
            error: { message: `Proxy failed to reach Gemini API: ${err.message}` }
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    const hasKey = !!process.env.GEMINI_API_KEY;
    res.json({
        status: 'ok',
        gemini_key_configured: hasKey
    });
});

app.listen(PORT, () => {
    const hasGeminiKey = !!process.env.GEMINI_API_KEY;
    console.log(`\n✅ Unit-Price Comparer server running at http://localhost:${PORT}`);
    console.log(`   GEMINI_API_KEY: ${hasGeminiKey ? '✔ Loaded from .env' : '✗ NOT SET — add it to .env'}`);
    console.log(`   Open http://localhost:${PORT} in your browser.\n`);
});
