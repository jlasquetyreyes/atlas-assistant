# Atlas

AI-powered document management system with RAG (Retrieval-Augmented Generation) capabilities and change tracking for Notion documents.

The sample Notion document is here: https://www.notion.so/Jeremiah-Atlas-Edit-Weekly-Proposal-for-Agent-Launch-Week-of-2025-03-10-231aacd47a478086b616ca880113c6a6

## 🏗️ Architecture

- **Backend**: Node.js/Express API with vector database integration
- **Frontend**: React/TypeScript with Vite and Tailwind CSS
- **Data Pipeline**: dbt for data transformations and change detection
- **Database**: Supabase PostgreSQL
- **Vector Database**: Pinecone for semantic search
- **AI**: Google Gemini for embeddings and text generation
- **Data Sync**: Airbyte for Notion integration

## ✨ Features

### 🤖 **RAG System**
- Semantic search across Notion documents
- Real-time AI-powered question answering
- Streaming responses for better UX

### 📊 **Change Detection**
- Track additions, updates, moves, and deletions
- Advanced deletion detection using registry pattern
- Confidence-based deletion classification
- Complete diff history with full audit trail

#### Why Deletion Detection is Complex
Unlike additions, updates, and moves which generate clear signals in the data pipeline, **deletions are inherently challenging** because:

- **No Direct Signal**: When a block is deleted in Notion, it simply disappears from API responses
- **CDC Limitation**: Change Data Capture systems (like Airbyte) only see what exists, not what's missing
- **False Positives**: Temporary API failures, network issues, or sync problems can make blocks appear "deleted"
- **Incremental Syncs**: Many connectors only sync changed data, leaving deleted items untouched in the destination

Our **registry-based solution** solves this by:
1. **Tracking Block Lifecycle**: Maintaining a registry of all known blocks with timestamps
2. **Consecutive Miss Counting**: Only flagging deletions after multiple consecutive absences
3. **Confidence Scoring**: Classifying deletions as "possible", "likely", or "confirmed"
4. **Grace Period**: Allowing temporary issues to resolve before triggering deletion events

### 🔄 **Vector Management**
- Automatic vector database synchronization
- Full refresh strategy for deletion handling
- Progress monitoring and error tracking

#### Full Refresh Vector Strategy
To ensure deleted blocks don't appear in RAG results, the system uses a **full refresh approach**:
1. **Clear Entire Index**: Wipes all vectors from Pinecone
2. **Rebuild from Current Data**: Re-processes all existing blocks
3. **Natural Deletion**: Deleted blocks automatically disappear (they're not in current data)
4. **Guaranteed Consistency**: Vector database perfectly matches current document state

### 📈 **Data Pipeline**
- dbt snapshots for historical tracking
- Incremental models for efficient processing
- Configurable deletion thresholds

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.8+ (for dbt)
- PostgreSQL database (Supabase)
- Pinecone account
- Google Cloud account (for Gemini API)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/atlas-node.git
cd atlas-node

# Install all dependencies
npm run install:all

# Or install individually
cd backend && npm install
cd ../frontend && npm install
cd ../dbt && pip install dbt-core dbt-postgres python-dotenv
```

### Environment Setup

1. **Backend** (`backend/.env`):
```bash
DATABASE_URL=postgresql://user:pass@host:5432/db
GEMINI_API_KEY=your_gemini_api_key
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX_NAME=atlas-vector
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=your_langsmith_key
LANGCHAIN_PROJECT=atlas-langsmith
```

2. **dbt** (`dbt/.env`):
```bash
DBT_PASSWORD=your_db_password
SUPABASE_URL=https://your-project.supabase.co
```

3. **Frontend** (`frontend/.env`):
```bash
VITE_API_URL=http://localhost:8080
```

### Development

```bash
# Start backend (port 8080)
npm run dev:backend

# Start frontend (port 5173)
npm run dev:frontend

# Run dbt pipeline
cd dbt
python run_dbt.py snapshot
python run_dbt.py run

# Update vector database (full refresh)
cd ../backend
python trigger_vector_update.py
```

## 📁 Project Structure

```
atlas-node/
├── backend/                 # Express.js API server
│   ├── src/
│   │   ├── index.ts        # Main server file
│   │   └── commands.txt    # Deployment commands
│   └── package.json
├── frontend/               # React frontend
│   ├── src/
│   │   ├── App.tsx
│   │   └── components/
│   └── package.json
├── dbt/                    # Data transformation pipeline
│   ├── models/
│   │   ├── staging/        # Raw data cleaning
│   │   └── marts/          # Business logic models
│   ├── snapshots/          # Historical tracking
│   ├── run_dbt.py         # dbt runner script
│   └── dbt_project.yml
└── docs/                   # Documentation
```

## 🔧 Configuration

### Deletion Detection Thresholds

The system uses configurable thresholds to balance **accuracy vs. speed** of deletion detection:

```yaml
# In dbt/dbt_project.yml
vars:
  deletion_confirmation_threshold: 3  # Consecutive misses before marking inactive
  medium_confidence_threshold: 3      # "likely" deletion confidence
  high_confidence_threshold: 5        # "confirmed" deletion confidence
```

#### How It Works
1. **Block Missing (1st time)**: `consecutive_misses = 1`, still `active = true`
2. **Block Missing (2nd time)**: `consecutive_misses = 2`, still `active = true`
3. **Block Missing (3rd time)**: `consecutive_misses = 3`, now `active = false`, deletion event created with "likely" confidence
4. **Block Missing (5th time)**: Deletion confidence upgraded to "confirmed"

#### Why 3+ Consecutive Misses?
- **Resilience**: Protects against temporary API failures, network issues, or sync problems
- **False Positive Prevention**: Avoids flagging blocks as deleted due to transient issues
- **Configurable**: Adjust based on your sync frequency and reliability requirements
- **Grace Period**: Allows time for temporary problems to resolve

#### Tuning Guidelines
- **Frequent syncs** (hourly): Keep default threshold of 3 (3-hour grace period)
- **Daily syncs**: Consider threshold of 2 (2-day grace period)
- **Reliable network**: Lower threshold for faster detection
- **Unreliable network**: Higher threshold to reduce false positives

### Airbyte Sync Mode

For proper deletion detection, configure Airbyte to use:
- **Sync Mode**: Full Refresh | Overwrite (not Incremental)

This ensures deleted blocks are removed from the source `blocks` table, enabling the registry system to detect their absence.

### Complete Workflow

The recommended workflow after making changes in Notion:

1. **Airbyte Sync**: Full refresh to update source data
2. **dbt Snapshot**: `python run_dbt.py snapshot` - Capture current state
3. **dbt Run**: `python run_dbt.py run` - Process changes and update registry
4. **Vector Update**: `python trigger_vector_update.py` - Full refresh of vector database

The vector update performs a **complete rebuild**:
- Clears all existing vectors from Pinecone
- Re-generates embeddings for all current blocks
- Uploads fresh vectors to Pinecone
- Ensures deleted blocks don't appear in RAG results

## 📊 Key Models

- **`diff_history`**: Tracks all document changes (add/update/move/delete)
- **`block_registry`**: Lifecycle tracking for deletion detection
- **`vector_chunks`**: Processed content for vector database
- **`complete_diff_history`**: Unified view of all changes

## 🚀 Deployment

### Backend (Google Cloud Run)
```bash
cd backend
gcloud run deploy atlas-node-backend --source . --platform managed --region europe-west3
```

### Frontend (Netlify)
```bash
cd frontend
npm run build
# Deploy dist/ folder to Netlify
```

## 📖 API Documentation

### Endpoints

- `GET /` - Service information and available endpoints
- `GET /health` - Health check with service status
- `POST /rag` - RAG query endpoint (streaming)
- `GET /diff_history` - Complete change history
- `POST /vector-update` - Trigger vector database update
- `GET /vector-update/status` - Vector update progress

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

For issues and questions:
- Create an issue on GitHub
- Check the documentation in `/docs`
- Review the dbt model documentation
