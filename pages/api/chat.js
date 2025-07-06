require('dotenv').config();
import { OpenAI } from 'openai';
import { google } from 'googleapis';
import { getEmbedding, similaritySearch } from '../../utils/vector-utils';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SPREADSHEET_ID = '1OZZkYXJMadLMrHddVuCLdsOTWRSNCq2jVYODiVZVyrs';
const SHEET_NAME = 'Chat Log';

let googleAuth;
try {
  if (!process.env.GOOGLE_CREDENTIALS_JSON) {
    throw new Error('GOOGLE_CREDENTIALS_JSON environment variable is missing');
  }
  googleAuth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
} catch (err) {
  console.error('Failed to initialize Google Auth:', err.message);
}

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
      range: `${SHEET_NAME}!A:F`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [valuesArray] },
    });
    console.log('Logged to Google Sheets');
  } catch (err) {
    console.error('Error appending to Google Sheet:', err.message);
  }
}

export default async function handler(req, res) {
  const { query, pageURL } = req.body;
  const userIP =
    req.headers['x-forwarded-for']?.split(',')[0] ||
    req.socket?.remoteAddress ||
    'Unknown';

  console.log('Received query:', query);
  console.log('Page URL:', pageURL);
  console.log('User IP:', userIP);

  if (!query) {
    console.log('Missing query');
    return res.status(400).json({ error: 'Missing query' });
  }

  try {
    const queryEmbedding = await getEmbedding(query);
    console.log('Got query embedding');

    const docs = await similaritySearch(queryEmbedding, 4);
    console.log('Got docs');

    const context = docs.map(d => d.metadata.text).join('\n\n');
    const prompt =
      `You are a helpful support agent for Blated. Use only the provided context.\n\n` +
      `CONTEXT:\n${context}\n\nQUESTION: ${query}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'Answer clearly, concisely, and only with the provided context.' },
        { role: 'user', content: prompt },
      ],
    });

    const answer = completion.choices[0].message.content;
    console.log('Got completion');

    await appendToSheet([
      new Date().toISOString(),
      query,
      answer,
      context,
      pageURL || 'Unknown',
      userIP,
    ]);

    res.json({ answer });
  } catch (err) {
    console.error('Handler error:', err.message);
    res.status(500).json({ error: 'Internal error' });
  }
}