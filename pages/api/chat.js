require('dotenv').config();
import { OpenAI } from 'openai';
import { google } from 'googleapis';
import crypto from 'crypto'; // for uuid fallback
import { getEmbedding, similaritySearch } from '../../utils/vector-utils';

/**
 * ────────────────────────────────────────────────────────────────
 *  OPENAI
 * ────────────────────────────────────────────────────────────────
 */
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * ────────────────────────────────────────────────────────────────
 *  GOOGLE SHEETS CONFIG
 * ────────────────────────────────────────────────────────────────
 */
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID; // Vercel env var
const SHEET_NAME = 'Chat Log';

// Validate required env vars early
['GOOGLE_CLIENT_EMAIL', 'GOOGLE_PRIVATE_KEY', 'GOOGLE_SHEET_ID'].forEach(v => {
  if (!process.env[v]) throw new Error(`${v} environment variable is missing`);
});

// Build Google auth client (replace escaped \n with real new‑lines)
let googleAuth;
try {
  googleAuth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
} catch (err) {
  console.error('Failed to initialize Google Auth:', err.message);
}

/**
 * Append a row to Google Sheets
 * Columns:
 *  A Timestamp          (ISO string)
 *  B Session ID         (UUID per browser session)
 *  C User Question
 *  D Bot Response
 *  E Context            (KB snippets used)
 *  F Page URL           (Shopify page)
 *  G IP Address
 *  H Usergit‑Agent         (browser/device)
 *  I Prompt Tokens      (upload)
 *  J Completion Tokens  (download)
 *  K Total Tokens
 *  L Confidence Score   (simple heuristic / similarity)
 */
async function appendToSheet(valuesArray) {
  if (!googleAuth) {
    console.warn('Google Auth not initialized, skipping sheet append');
    return;
  }
  try {
    const authClient = await googleAuth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: authClient });

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:L`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [valuesArray] },
    });
    console.log('Logged to Google Sheets');
  } catch (err) {
    console.error('Error appending to Google Sheet:', err.message);
  }
}

/**
 * API Route Handler
 */
export default async function handler(req, res) {
  const { query, pageURL, sessionId: clientSessionId } = req.body || {};
  const userIP =
    req.headers['x-forwarded-for']?.split(',')[0] ||
    req.socket?.remoteAddress ||
    'Unknown';
  const userAgent = req.headers['user-agent'] || 'Unknown';
  const sessionId = clientSessionId || crypto.randomUUID();

  if (!query) return res.status(400).json({ error: 'Missing query' });

  try {
    // 1️⃣ Vector search
    const queryEmbedding = await getEmbedding(query);
    const docs = await similaritySearch(queryEmbedding, 4); // docs = [{ metadata, score? }]

    // 2️⃣ Build prompt & complete
    const context = docs.map(d => d.metadata.text).join('\n\n');
    const prompt =
      `You are a helpful support agent for Blated. Use only the provided context.\n\n` +
      `CONTEXT:\n${context}\n\nQUESTION: ${query}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            'Answer clearly, concisely, and only with the provided context.',
        },
        { role: 'user', content: prompt },
      ],
    });

    const answer = completion.choices[0].message.content;
    const { prompt_tokens, completion_tokens, total_tokens } =
      completion.usage || {};

    // 3️⃣ Simple "confidence" heuristic: highest similarity score of returned docs
    const confidenceScore = docs.length && docs[0].score !== undefined ? docs[0].score : '';

    // 4️⃣ Persist to Google Sheets
    await appendToSheet([
      new Date().toISOString(), // Timestamp
      sessionId, // Session ID
      query, // User Question
      answer, // Bot Response
      context, // Context snippets
      pageURL || 'Unknown', // Page URL
      userIP, // IP
      userAgent, // UA
      prompt_tokens || '', // Prompt tokens (upload)
      completion_tokens || '', // Completion tokens (download)
      total_tokens || '', // Total tokens
      confidenceScore, // Heuristic confidence
    ]);

    res.json({ answer, sessionId, total_tokens });
  } catch (err) {
    console.error('Handler error:', err.message);
    res.status(500).json({ error: 'Internal error' });
  }
}
