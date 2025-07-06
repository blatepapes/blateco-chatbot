require('dotenv').config();
import { OpenAI } from 'openai';
import { google } from 'googleapis';
import crypto from 'crypto';
import { getEmbedding, similaritySearch } from '../../utils/vector-utils';

/*────────────────────────────────────────────────────────────
  CONFIG & INITIALIZATION
────────────────────────────────────────────────────────────*/
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
const SHEET_NAME = 'Chat Log';

['GOOGLE_CLIENT_EMAIL', 'GOOGLE_PRIVATE_KEY', 'GOOGLE_SHEET_ID'].forEach(v => {
  if (!process.env[v]) throw new Error(`${v} environment variable is missing`);
});

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

/*────────────────────────────────────────────────────────────
  GOOGLE SHEETS HELPER
────────────────────────────────────────────────────────────*/
async function appendToSheet(values) {
  if (!googleAuth) return console.warn('Google Auth not ready; skipping sheet append');
  try {
    const sheets = google.sheets({ version: 'v4', auth: await googleAuth.getClient() });
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:L`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [values] },
    });
  } catch (e) {
    console.error('Sheets append error:', e.message);
  }
}

/*────────────────────────────────────────────────────────────
  API HANDLER
────────────────────────────────────────────────────────────*/
export default async function handler(req, res) {
  const {
    query,
    pageURL,
    sessionId: clientSessionId,
    history = [], // array of { role, content }
  } = req.body || {};

  if (!query) return res.status(400).json({ error: 'Missing query' });

  const sessionId = clientSessionId || crypto.randomUUID();
  const userIP = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || 'Unknown';
  const userAgent = req.headers['user-agent'] || 'Unknown';

  try {
    /* 1️⃣  Retrieve context via embeddings */
    const queryEmbedding = await getEmbedding(query);
    const docs = await similaritySearch(queryEmbedding, 4);
    const context = docs.map(d => d.metadata.text).join('\n\n');
    const confidenceScore = docs[0]?.score ?? '';

    /* 2️⃣  Build message array */
    const cappedHistory = history.slice(-10); // limit to last 10 msgs to manage tokens

    const messages = [
      {
        role: 'system',
        content:
          'You are a helpful support agent for Blated. Answer clearly and concisely. Only rely on the provided CONTEXT. If unsure, say you do not know.',
      },
      ...cappedHistory,
      { role: 'system', content: `CONTEXT:\n${context}` },
      { role: 'user', content: query },
    ];

    /* 3️⃣  Completion */
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
    });

    const answer = completion.choices[0].message.content;
    const { prompt_tokens = '', completion_tokens = '', total_tokens = '' } = completion.usage || {};

    /* 4️⃣  Log to Google Sheets */
    await appendToSheet([
      new Date().toISOString(), // Timestamp
      sessionId,
      query,
      answer,
      context,
      pageURL || 'Unknown',
      userIP,
      userAgent,
      prompt_tokens,
      completion_tokens,
      total_tokens,
      confidenceScore,
    ]);

    /* 5️⃣  Return response incl. sessionId so client can persist */
    res.json({ answer, sessionId, total_tokens, prompt_tokens, completion_tokens });
  } catch (err) {
    console.error('Handler error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}
