require('dotenv').config();
import { OpenAI } from 'openai';
import { getEmbedding, similaritySearch } from '../../utils/vector-utils';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'Missing query' });

  try {
    const queryEmbedding = await getEmbedding(query);
    const docs = await similaritySearch(queryEmbedding, 4);

    const context = docs.map(d => d.metadata.text).join('\n\n');
    const prompt = `You are a helpful support agent for BlateCo. Use only the provided context.\n\nCONTEXT:\n${context}\n\nQUESTION: ${query}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'Answer clearly, concisely, and only with the provided context.' },
        { role: 'user', content: prompt },
      ],
    });

    res.json({ answer: completion.choices[0].message.content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal error' });
  }
}