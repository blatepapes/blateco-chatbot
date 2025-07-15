require('dotenv').config();
const fs = require('fs');
const { OpenAI } = require('openai');
const { Pinecone } = require('@pinecone-database/pinecone');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pinecone.index('blateco-support');

// Load Q&A from JSON file
const data = JSON.parse(fs.readFileSync('./faq.json', 'utf-8'));

async function upload() {
  for (let i = 0; i < data.length; i++) {
    const { question, answer } = data[i]?.fields || {};

    if (!question || !answer) {
      console.warn(`⚠️ Skipping entry at index ${i} - Missing question or answer`, data[i]);
      continue;
    }

    try {
      const input = `Q: ${question}\nA: ${answer}`;
      const embedding = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input,
      });

      await index.upsert([
        {
          id: `faq-${i}`,
          values: embedding.data[0].embedding,
          metadata: {
            question,
            answer,
            type: 'faq',
            priority: 10,
            text: input,
          },
        },
      ]);

      console.log(`✅ Uploaded FAQ ${i + 1}/${data.length}`);
    } catch (err) {
      console.error(`❌ Failed to upload FAQ ${i + 1}: ${err.message}`);
    }
  }

  console.log('✅ All done.');
}

upload().catch((err) => {
  console.error('Fatal error during upload:', err.message);
});
