require('dotenv').config();
const { OpenAI } = require('openai');
const { Pinecone } = require('@pinecone-database/pinecone');

// Configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_INDEX = 'blated-support';
const EMBED_MODEL = 'text-embedding-3-large';
const PINECONE_DIMENSIONS = 3072;

// Validate environment variables
if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is missing in .env');
if (!PINECONE_API_KEY) throw new Error('PINECONE_API_KEY is missing in .env');

// Initialize clients
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

const pinecone = new Pinecone({
  apiKey: PINECONE_API_KEY,
});

const index = pinecone.index(PINECONE_INDEX);

async function getEmbedding(text) {
  try {
    const res = await openai.embeddings.create({
      model: EMBED_MODEL,
      input: text,
    });
    const embedding = res.data[0].embedding;
    if (embedding.length !== PINECONE_DIMENSIONS) {
      throw new Error(`Embedding dimension mismatch: got ${embedding.length}, expected ${PINECONE_DIMENSIONS}`);
    }
    return embedding;
  } catch (error) {
    console.error(`Error generating embedding for text: ${text.slice(0, 40)}...`, error.message);
    throw error;
  }
}

async function similaritySearch(queryEmbedding, topK = 5) {
  try {
    const result = await index.query({
      vector: queryEmbedding,
      topK,
      includeMetadata: true,
      includeValues: false,
    });
    return result.matches.map(match => ({
      id: match.id,
      score: match.score,
      metadata: match.metadata,
    }));
  } catch (error) {
    console.error('Error performing similarity search:', error.message);
    throw error;
  }
}

module.exports = { getEmbedding, similaritySearch };