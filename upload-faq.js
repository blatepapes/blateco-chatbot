require('dotenv').config();
const fs = require('fs');
const { Pinecone } = require('@pinecone-database/pinecone');

// Setup Pinecone
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pinecone.index('blateco-support');

// Load your corrected Q&A vectors
const data = JSON.parse(fs.readFileSync('./qa_vectors.json', 'utf-8')); // not faq.json anymore

async function upload() {
  for (let i = 0; i < data.length; i++) {
    const entry = data[i];
    const { id, embedding, metadata } = entry;

    if (!embedding || !metadata?.text) {
      console.warn(`⚠️ Skipping entry ${i} - Missing embedding or text`);
      continue;
    }

    try {
      await index.upsert([
        {
          id: id || `qa-${i}`,
          values: embedding,
          metadata: {
            ...metadata,
            type: 'faq',
            priority: 10,
          },
        },
      ]);

      console.log(`✅ Uploaded ${id || `qa-${i}`}`);
    } catch (err) {
      console.error(`❌ Upload failed for ${id}: ${err.message}`);
    }
  }

  console.log('✅ All done uploading.');
}

upload().catch((err) => {
  console.error('❌ Fatal upload error:', err.message);
});
