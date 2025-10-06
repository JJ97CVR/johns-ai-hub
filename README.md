# AI Chat Platform

Modern AI chat application with multi-mode streaming, RAG knowledge retrieval, and comprehensive security.

## Project Info

**URL**: https://lovable.dev/projects/30a9e00f-17a8-4c85-b65c-5e621f616fbb

## Features

- **Multi-Mode Chat System**: Fast, Auto, and Extended modes for different response speeds and depths
- **Real-time Streaming**: Token-by-token streaming with batched updates for smooth UX
- **Multi-Provider Support**: OpenAI (GPT-5), Anthropic (Claude Sonnet 4), and Lovable AI (Gemini models)
- **Intelligent Tool Usage**: Auto mode uses heuristics to determine when tools are needed
- **RAG Integration**: Vector-based knowledge retrieval with configurable context windows
- **Citations & Sources**: Automatic citation extraction and display from web searches
- **File Upload**: Support for Excel, CSV, JSON, Python, images, and PDFs (max 50MB)
- **Secure Backend**: RLS policies, input validation, and secure file handling
- **Performance Optimized**: HNSW vector indexes, conversation trimming, and deadline controls

## Architecture

### Mode System

The chat supports three modes with different strategies:

| Mode      | Model           | Tools | RAG topK | Max Tokens | Deadline | Use Case                    |
|-----------|-----------------|-------|----------|------------|----------|-----------------------------|
| Fast      | Gemini Flash Lite | No    | 0        | 500        | 7s       | Quick answers, no research  |
| Auto      | Gemini Flash    | Smart | 3        | 1000       | 12s      | Balanced performance        |
| Extended  | Gemini Pro      | Yes   | 6-8      | 2000       | 25s      | Deep analysis, sources      |

### Backend Components

- **LLM Router** (`supabase/functions/shared/llm-router.ts`): Multi-provider client with retries and fallbacks
- **Mode Strategy** (`supabase/functions/shared/mode-strategy.ts`): Mode configuration and heuristics
- **Knowledge Retrieval** (`supabase/functions/shared/knowledge-retrieval.ts`): RAG with vector search
- **Web Search** (`supabase/functions/shared/web-search.ts`): External search integration
- **Chat Function** (`supabase/functions/chat/index.ts`): Main orchestration with streaming

### Database

- **PostgreSQL** with pgvector extension for semantic search
- **HNSW indexes** for fast nearest-neighbor retrieval
- **RLS policies** for user data isolation
- **Efficient indexes** on conversations, messages, and analytics

## Development

### Prerequisites

- Node.js 20+
- Supabase account (or Lovable Cloud)
- API keys for AI providers (optional, Gemini models are free until Oct 6, 2025)

### Setup

1. Clone and install:
   ```bash
   git clone <YOUR_GIT_URL>
   cd <YOUR_PROJECT_NAME>
   npm install
   ```

2. Configure environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your Supabase credentials (auto-configured in Lovable Cloud)
   ```

3. Run locally:
   ```bash
   npm run dev
   ```

4. Deploy backend:
   ```bash
   # Edge functions deploy automatically with Lovable Cloud
   # Or use Supabase CLI: supabase functions deploy
   ```

### Testing

#### E2E Tests with Playwright

Run end-to-end tests covering chat modes, streaming, and citations:

```bash
# Install Playwright browsers
npx playwright install

# Run tests headless
npm run test:e2e

# Run with UI
npm run test:e2e:headed

# View test report
npx playwright show-report
```

Test coverage includes:
- Fast mode: Quick responses without tools
- Auto mode: Smart tool activation with citations
- Extended mode: Deep reasoning with sources
- Mode switching between messages
- Streaming validation
- Citation display

#### Docker Development

Run the frontend in Docker for consistent testing:

```bash
# Build and run
docker compose up --build

# Access at http://localhost:5173
```

#### CI/CD

GitHub Actions workflow (`.github/workflows/e2e.yml`) runs E2E tests on every PR and push to main.

### Environment Variables

Required for Lovable Cloud (auto-configured):
- `VITE_SUPABASE_URL`: Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY`: Public anon key
- `VITE_SUPABASE_PROJECT_ID`: Project identifier

Optional:
- `VITE_SHOW_THINKING`: Set to `true` to show AI reasoning process (default: `false`)
- `E2E_BASE_URL`: Base URL for E2E tests (default: `http://localhost:5173`)

Backend secrets (configured via Lovable Cloud):
- `LOVABLE_API_KEY`: Auto-provisioned for Gemini models
- `OPENAI_API_KEY`: Optional for GPT models
- `ANTHROPIC_API_KEY`: Optional for Claude models
- `BRAVE_SEARCH_API_KEY`: For web search functionality

## Security

- **RLS Policies**: All tables have row-level security
- **Input Validation**: Zod schemas on auth, file size limits, MIME type checks
- **SQL Injection Protection**: Parameterized queries only, no raw SQL in edge functions
- **File Upload Security**: Size limits (50MB), sanitized filenames, buffer validation
- **CORS Configuration**: Configurable allowed origins
- **Query Analytics Privacy**: Users see only their own data, admins get aggregated stats

## Performance Optimizations

1. **Vector Indexes**: HNSW for sub-10ms semantic search
2. **Conversation Trimming**: Automatic history summarization after 10 messages
3. **Batched Streaming**: Flush every ~60 characters for smooth rendering
4. **Deadline Controls**: Soft timeouts prevent hanging requests
5. **Smart Tool Usage**: Auto mode only activates tools when needed

## Project Structure

```
src/
├── components/          # React components
│   ├── ChatModeControl.tsx    # Mode selector UI
│   ├── AIMessageBubble.tsx    # Message display with citations
│   └── CitationsList.tsx      # Source references
├── hooks/              # Custom React hooks
│   ├── useChatStream.ts       # Streaming handler
│   └── useMessages.ts         # Message state management
└── pages/              # Route pages

supabase/
├── functions/          # Edge functions
│   ├── chat/                  # Main chat endpoint
│   ├── shared/                # Shared utilities
│   │   ├── llm-router.ts     # Multi-provider client
│   │   ├── mode-strategy.ts  # Mode configuration
│   │   └── knowledge-retrieval.ts
│   └── upload-file/           # File handling (50MB limit)
└── migrations/         # Database schema

tests/
└── chat.e2e.spec.ts    # Playwright E2E tests

.github/
└── workflows/
    └── e2e.yml         # CI/CD pipeline
```

## Editing This Project

There are several ways to edit your application:

### Use Lovable

Simply visit the [Lovable Project](https://lovable.dev/projects/30a9e00f-17a8-4c85-b65c-5e621f616fbb) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

### Use Your Preferred IDE

Clone this repo and push changes. Pushed changes will also be reflected in Lovable.

```sh
# Clone the repository
git clone <YOUR_GIT_URL>

# Navigate to the project directory
cd <YOUR_PROJECT_NAME>

# Install dependencies
npm i

# Start development server
npm run dev
```

### Edit Directly in GitHub

- Navigate to the desired file(s)
- Click the "Edit" button (pencil icon) at the top right
- Make your changes and commit

### Use GitHub Codespaces

- Navigate to the main page of your repository
- Click on the "Code" button (green button) near the top right
- Select the "Codespaces" tab
- Click on "New codespace"
- Edit files directly within the Codespace and commit your changes

## Tech Stack

- **Frontend**: React, TypeScript, Vite, TailwindCSS, Shadcn/ui
- **Backend**: Lovable Cloud (Supabase) with Edge Functions
- **Database**: PostgreSQL with pgvector for semantic search
- **AI**: Multi-provider routing (OpenAI, Anthropic, Google Gemini)
- **Testing**: Playwright for E2E testing
- **Deployment**: Automatic via Lovable

## Deployment

### Deploy with Lovable

Simply open [Lovable](https://lovable.dev/projects/30a9e00f-17a8-4c85-b65c-5e621f616fbb) and click on Share → Publish.

### Custom Domain

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new features
4. Ensure all tests pass: `npm run test:e2e`
5. Submit a pull request

## License

MIT
