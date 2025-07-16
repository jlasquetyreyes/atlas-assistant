import express, { Request, Response } from 'express';
import { Pool } from 'pg';
import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';
import cors from 'cors';
import { traceable } from 'langsmith/traceable';

// Load environment variables from mounted secret file if available
const secretPath = '/run/secrets/secrets-node';
if (fs.existsSync(secretPath)) {
  const envContent = fs.readFileSync(secretPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmedLine = line.trim(); // Trim whitespace from the line
    if (trimmedLine.length === 0 || trimmedLine.startsWith('#')) { // Ignore empty lines or comments
      return;
    }
    const parts = trimmedLine.split('=');
    if (parts.length === 2) {
      const key = parts[0].trim();
      const value = parts[1].trim();
      if (key && value) { // Only set if both key and value are non-empty
        process.env[key] = value;
      }
    }
  });
}

const app = express();
app.use(express.json());
app.use(cors({ 
  origin: [
    'https://atlas-prototype-f89b0.web.app',
    'https://marvelous-gecko-6d1594.netlify.app'
  ] 
}));
const port = process.env.PORT || 8080;

// --- Database and AI Client Initialization ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// --- Vector Update State Management ---
let isVectorUpdateRunning = false;
let vectorUpdateProgress = {
  total: 0,
  processed: 0,
  errors: 0,
  status: 'idle'
};

// --- API Endpoints ---

app.get('/', (req: Request, res: Response) => {
  res.json({
    service: 'Atlas Node Backend',
    version: '1.0.0',
    status: 'operational',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      rag: '/rag',
      diffHistory: '/diff_history',
      vectorUpdate: '/vector-update',
      vectorStatus: '/vector-update/status'
    },
    documentation: 'https://github.com/jlasquetyreyes/atlas-assistant'
  });
});

app.get('/health', async (req: Request, res: Response) => {
  try {
    // Test database connection
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        pinecone: 'configured',
        gemini: 'configured'
      },
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
      }
    });
  } catch (error: any) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

app.get('/diff_history', async (req: Request, res: Response) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT * FROM complete_diff_history');
    res.json(result.rows);
    client.release();
  } catch (err: any) {
    console.error(err);
    res.status(500).send('Error connecting to the database');
  }
});

app.post('/rag', async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders(); // Flush the headers to establish the SSE connection immediately

  try {
    const { query } = req.body;

    if (!query) {
      res.write('event: error\ndata: {"message": "Query is required"}\n\n');
      return res.status(400).end();
    }

    // 1. Generate embedding for the query
    const embeddingModel = genAI.getGenerativeModel({ model: "embedding-001"});

    // Get the actual embedding
    const actualEmbeddingResult = await embeddingModel.embedContent(query);
    const queryEmbedding = actualEmbeddingResult.embedding.values;

    // Track embedding generation in LangSmith
    await traceable(async (q: string) => {
      return {
        query: q,
        embedding_length: queryEmbedding.length,
        model: "embedding-001"
      };
    }, { name: "Gemini Embedding" })(query);

    // 2. Query Pinecone
    const indexName = process.env.PINECONE_INDEX_NAME!;
    const index = pinecone.index(indexName);
    const queryResponse = await index.query({
      topK: 10,
      vector: queryEmbedding,
      includeMetadata: true,
    });

    // 3. Form the context
    const context = queryResponse.matches
      .map(match => (match.metadata as { text: string }).text)
      .join('\n\n');

    // 4. Generate response with Gemini
    const generativeModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // Enhanced RAG prompt with better instructions
    const prompt = `You are Atlas, an AI assistant that helps users understand and navigate their Notion documents. You have access to relevant content from their documentation.

Your role:
- Provide helpful, accurate, and actionable answers
- Use a professional yet conversational tone
- Draw insights and connections from the provided content
- Be concise but comprehensive

Guidelines:
- Answer directly and naturally without mentioning "context" or "based on the context"
- If information is incomplete, acknowledge what you know and suggest next steps
- Use specific details and examples from the content when relevant
- Structure longer responses with clear sections or bullet points
- If the question cannot be answered with the available information, say so clearly and suggest alternative approaches

Relevant content from your documents:
${context}

User question: ${query}

Response:`;

    const result = await generativeModel.generateContentStream(prompt);
    let fullResponse = '';

    const tracedGeneration = traceable(
      async (inputPrompt: string) => {
        // The actual generation already happened, we're just logging it
        // Return the response as output (inputPrompt is the input)
        return fullResponse;
      },
      { name: "Gemini Generation" }
    );

    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      if (chunkText) {
        fullResponse += chunkText;
        res.write(`data: ${JSON.stringify({ chunk: chunkText })}\n\n`);
      }
    }

    // Log the complete interaction to LangSmith
    await tracedGeneration(prompt);
    res.write('event: end\ndata: {"message": "Stream complete"}\n\n');
    res.end();

  } catch (err: any) {
    console.error(err);
    res.write(`event: error\ndata: {"message": "Error processing RAG request: ${err.message}"}\n\n`);
    res.status(500).end();
  }
});

app.post('/vector-update', async (req: Request, res: Response) => {
  try {
    // Check if vector update is already running
    if (isVectorUpdateRunning) {
      return res.json({ 
        status: 'running', 
        message: 'Vector update is already in progress',
        progress: vectorUpdateProgress
      });
    }

    // Start vector update process
    isVectorUpdateRunning = true;
    vectorUpdateProgress = {
      total: 0,
      processed: 0,
      errors: 0,
      status: 'started'
    };

    // Return immediate response
    res.json({ 
      status: 'started', 
      message: 'Vector update process started',
      progress: vectorUpdateProgress
    });

    // Start the vector update process asynchronously
    processVectorUpdate();

  } catch (err: any) {
    console.error('Error starting vector update:', err);
    isVectorUpdateRunning = false;
    vectorUpdateProgress.status = 'error';
    res.status(500).json({ 
      status: 'error', 
      message: `Error starting vector update: ${err.message}`,
      progress: vectorUpdateProgress
    });
  }
});

app.get('/vector-update/status', (req: Request, res: Response) => {
  res.json({
    isRunning: isVectorUpdateRunning,
    progress: vectorUpdateProgress
  });
});

// --- Vector Update Processing Function ---
async function processVectorUpdate() {
  try {
    console.log('Starting vector update process...');
    
    // 1. Fetch vector_chunks data from database
    const client = await pool.connect();
    const result = await client.query('SELECT * FROM vector_chunks');
    const vectorChunks = result.rows;
    client.release();

    vectorUpdateProgress.total = vectorChunks.length;
    vectorUpdateProgress.processed = 0;
    vectorUpdateProgress.errors = 0;
    vectorUpdateProgress.status = 'processing';

    console.log(`Found ${vectorChunks.length} vector chunks to process`);

    // 2. Initialize Pinecone index
    const indexName = process.env.PINECONE_INDEX_NAME!;
    const index = pinecone.index(indexName);

    // 2.5. Clear existing vectors to ensure deleted blocks are removed
    console.log('Clearing existing vectors from Pinecone index...');
    try {
      await index.deleteAll();
      console.log('Successfully cleared all vectors from index');
    } catch (error: any) {
      console.error('Error clearing index:', error);
      // Continue anyway - upserts will still work
    }

    // 3. Process each vector chunk
    for (const chunk of vectorChunks) {
      try {
        // Generate embedding for the text content
        const embeddingModel = genAI.getGenerativeModel({ model: "embedding-001" });
        const embeddingResult = await embeddingModel.embedContent(chunk.text_content);
        const embedding = embeddingResult.embedding.values;

        // Prepare metadata - filter out null values as Pinecone doesn't accept them
        const cleanMetadata = Object.fromEntries(
          Object.entries(chunk.metadata).filter(([_, value]) => value !== null)
        );
        
        const metadata = {
          text: chunk.text_content,
          ...cleanMetadata
        };

        // Upsert to Pinecone
        await index.upsert([{
          id: chunk.block_id,
          values: embedding,
          metadata: metadata
        }]);

        vectorUpdateProgress.processed++;
        console.log(`Processed ${vectorUpdateProgress.processed}/${vectorUpdateProgress.total}: ${chunk.block_id}`);

      } catch (error: any) {
        console.error(`Error processing chunk ${chunk.block_id}:`, error);
        vectorUpdateProgress.errors++;
      }
    }

    // 4. Update final status
    vectorUpdateProgress.status = 'completed';
    isVectorUpdateRunning = false;
    
    console.log(`Vector update completed. Processed: ${vectorUpdateProgress.processed}, Errors: ${vectorUpdateProgress.errors}`);

  } catch (error: any) {
    console.error('Error in vector update process:', error);
    vectorUpdateProgress.status = 'error';
    isVectorUpdateRunning = false;
  }
}

// --- Server Start ---

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});