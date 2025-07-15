require('dotenv').config();
const { OpenAI } = require('openai');
const { Pinecone } = require('@pinecone-database/pinecone');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

const index = pinecone.index('blateco-support');

async function getEmbedding(text) {
  const res = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return res.data[0].embedding;
}

async function similaritySearch(queryEmbedding, topK = 5, filter = null) {
  const result = await index.query({
    vector: queryEmbedding,
    topK,
    includeMetadata: true,
    ...(filter && { filter }),
  });

  const scored = result.matches
    .map((match) => {
      const priority = match.metadata?.priority || 1;
      return {
        ...match,
        weightedScore: match.score * priority,
      };
    })
    .sort((a, b) => b.weightedScore - a.weightedScore);

  return scored;
}

module.exports = { getEmbedding, similaritySearch };
