require('dotenv').config();
const fs = require('fs');
const { OpenAI } = require('openai');
const { Pinecone } = require('@pinecone-database/pinecone');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pinecone.index('blateco-support');

// Load existing FAQ vector file
const data = JSON.parse(fs.readFileSync('./faq.json', 'utf-8'));

async function upload() {
  for (let i = 0; i < data.length; i++) {
    const entry = data[i];
    const { id, embedding, metadata } = entry;
    const question = metadata?.question?.trim();
    const answer = metadata?.answer?.trim();

    if (!question || !answer || !embedding) {
      console.warn(`⚠️ Skipping entry at index ${i} - Missing question, answer, or embedding`, entry);
      continue;
    }

    try {
      await index.upsert([
        {
          id: id || `faq-${i}`,
          values: embedding,
          metadata: {
            question,
            answer,
            type: 'faq',
            priority: 10,
            text: `Q: ${question}\nA: ${answer}`,
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
