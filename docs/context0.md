# Context0 Developer Documentation

Context0 is a decentralized AI memory platform where users can store and retrieve their AI conversation memories using vector embeddings. The system uses blockchain storage (Arweave) for permanent, user-owned data with MCP (Model Context Protocol) integration.

Context0 provides a subscription-based AI memory service where users pay monthly, and we handle all blockchain costs and complexity behind the scenes. Users get permanent AI memory storage without needing to understand cryptocurrency or blockchain technology.

## User Journey & Flow

### **1. User Discovery & Registration**

- User discovers our platform through marketing/word-of-mouth
- Visits our website, sees value proposition: "Give your AI permanent memory"
- Signs up using **Clerk authentication** (email/password, Google, GitHub, etc.)
- Chooses subscription plan (Basic $5/month, Pro $15/month, Enterprise $50/month)
- Completes payment with integrated payment system
- **Behind the scenes**: We create Arweave wallet and deploy EizenDB contract using our service wallet
- User receives API token and MCP server connection details on the website dashboard

### **2. AI Agent Integration**

- User adds our MCP server to their AI setup (Claude Desktop, custom agents, etc.)
- AI agent connects to our MCP server using user's API token
- **No blockchain interaction needed** - user just configures MCP connection
- AI can now store and retrieve memories automatically during conversations

### **3. Daily Usage Flow**

#### **Memory Storage (Automatic)**

1. User has conversation with AI agent
2. AI decides certain parts are worth remembering or user expliitly says 'remeber it'
3. AI calls our MCP server: `store_memory(content, context, importance)`
4. **Behind the scenes**:
   - MCP server validates user's API token
   - Generates vector embedding from content
   - Stores in user's isolated database section
   - We pay ~$0.001 in Arweave costs
5. Memory stored permanently on blockchain
6. User charged against monthly quota

#### **Memory Retrieval (Automatic)**

1. User asks AI something that relates to past conversations
2. AI calls our MCP server: `search_memory(query, limit)`
3. **Behind the scenes**:
   - MCP server validates token and user access
   - Performs vector similarity search
   - Returns only user's own memories
4. AI uses retrieved memories to provide better, contextual responses
5. User gets AI that "remembers" past conversations

### **4. User Dashboard Experience**

- User logs into our website dashboard via **Clerk authentication**
- Views memory statistics: total memories, storage used, monthly quota
- Browses stored memories with search functionality
- Manages API tokens (create, revoke, monitor usage)
- Updates subscription plan or billing information via Stripe portal
- Downloads memory exports (optional advanced feature)

### **5. Billing & Subscription Management**

- Monthly recurring billing charged to user's payment method
- Usage tracking: memories stored, API calls made
- Overage protection: soft limits with upgrade prompts
- Easy plan changes and cancellation
- **Cost structure**: User pays $5-50/month, we pay ~$0.10-2/month in actual storage

---

## Developer Journey & Backend Implementation Flow

![Context0 Architecture Diagram](https://eraser.imgix.net/workspaces/EczXZGqGIT7cn98Fs9X2/I3QuLSjHsWXbFPChXaX4W9U6bpm2/4b0fMBQZdUg-sbn-pMIsO.png?ixlib=js-3.7.0 "Context0 Architecture Diagram")

Our backend consists of 4 main repositories that work together to provide AI memory storage service:

### **1. Vector Database Engine (Eizen)**

This is the core vector database engine that stores AI memories on Arweave blockchain. Each user gets their own isolated database contract.

**What it handles:**

- Vector storage using HNSW algorithm for fast similarity search
- Protocol buffer encoding to compress vector data
- Blockchain contract deployment and management
- User data isolation through separate contract instances

**Key operations:**

- Deploy new contract for each user (costs ~$1-2 in AR tokens)
- Store vector embeddings with metadata
- Search similar vectors using cosine distance
- All operations paid by our service wallet

### **2. Backend API Repository (Context0 API)**

This is our main backend service that handles user accounts, authentication, and business logic.

**What it handles:**

- Clerk webhook integration for user management
- API token generation and validation
- Subscription management and payment processing
- Cost tracking and usage monitoring
- Store user related data in Neon PostgreSQL
- Vector database operations via Eizen
- Memory management with advanced search capabilities

**User registration flow:**

1. User signs up via Clerk (frontend)
2. Clerk webhook creates user record in Neon PostgreSQL
3. User pays via integrated payment system
4. Queue background job to deploy Arweave contract
5. Generate API token for user
6. User can access dashboard and API credentials

**Authentication flow:**

1. User provides API token with MCP requests
2. Validate token and get user ID from database
3. Check user subscription status and quotas
4. Vector conversion of the request
5. Route request to appropriate service (Eizen)

### **3. MCP Server Repository (AI Integration)**

This handles the Model Context Protocol communication with AI agents like Claude, ChatGPT, etc.

**What it handles:**

- MCP protocol implementation for AI memory tools
- Vector embedding generation from text content
- Memory storage and retrieval operations
- Tool definitions for AI agents

**Memory storage flow:**

1. AI agent calls `store_memory` tool with content
2. Validate user API token
3. Generate vector embedding from content
4. Store in user's dedicated vector database
5. Log usage and costs

**Memory search flow:**

1. AI agent calls `search_memory` tool with query
2. Generate query vector embedding
3. Search user's vector database for similar memories
4. Return ranked results with metadata

### **4. Frontend Repository (Client Dashboard)**

Web interface for users to manage their AI memory service. Uses **Clerk for authentication** and integrated payment processing.

**What it handles:**

- **Clerk authentication** (login/register/profile management)
- API token management
- Memory browsing and search interface
- Usage statistics and analytics dashboards
- Integrated billing portal for subscription management

**Key Features:**

- Dashboard with memory statistics
- API token creation and management
- Memory search and browsing interface
- Usage analytics and billing information
- Subscription management via integrated payment portal

## Complete Context0 API Repository Structure

Below is how the `API/` repository is structured:

```
API/
├── 📄 package.json                  # Dependencies and scripts
├── 📄 pnpm-lock.yaml               # Lock file for reproducible builds
├── 📄 tsconfig.json                # TypeScript configuration
├── 📄 biome.json                   # Biome linter/formatter config
├── 📄 drizzle.config.ts            # Drizzle ORM configuration
├── 📄 Dockerfile                   # Production container setup
├── 📄 .env.example                 # Environment variables template
├── 📄 .gitignore                   # Git ignore patterns
├── 📄 README.md                    # Project documentation
├── 📄 LICENSE                      # MIT license
│
├── 📁 drizzle/                     # Database migrations
│   ├── 📄 0000_purple_betty_ross.sql
│   └── 📁 meta/                    # Migration metadata
│       ├── 📄 _journal.json
│       └── 📄 0000_snapshot.json
│
├── 📁 src/                         # Source code
│   ├── 📄 server.ts                # Express app entry point
│   │
│   ├── 📁 config/                  # Configuration modules
│   │   ├── 📄 arlocal.ts           # ArLocal development setup
│   │   ├── 📄 arweave.ts           # Arweave blockchain setup
│   │   ├── 📄 redis.ts             # Redis cache configuration
│   │   └── 📄 winston.ts           # Winston logging configuration
│   │
│   ├── � db/                      # Database layer
│   │   ├── 📄 db.ts                # Database connection setup
│   │   └── � schema/              # Drizzle schema definitions
│   │       ├── 📄 users.ts         # Users table schema
│   │       ├── 📄 keys.ts          # API keys table schema
│   │       └── 📄 subscriptions.ts # User subscriptions schema
│   │
│   ├── 📁 middlewares/             # Express middleware
│   │   ├── 📄 auth.ts              # JWT & API key validation
│   │   ├── 📄 contract.ts          # Contract verification
│   │   ├── 📄 errorHandler.ts      # Global error handling
│   │   └── 📄 validate.ts          # Zod schema validation
│   │
│   ├── � routes/                  # API endpoint definitions
│   │   ├── 📄 admin.ts             # Admin operations
│   │   ├── 📄 deploy.ts            # Contract deployment
│   │   ├── 📄 etherscan.ts         # Etherscan integration
│   │   ├── 📄 health.ts            # Health check endpoints
│   │   ├── 📄 instances.ts         # API key instances
│   │   ├── 📄 memories.ts          # Memory storage/retrieval
│   │   ├── 📄 subscriptions.ts     # Subscription management
│   │   └── 📄 webhook.ts           # Webhook handlers
│   │
│   ├── 📁 schemas/                 # Zod validation schemas
│   │   ├── 📄 common.ts            # Foundation schemas
│   │   ├── 📄 eizen.ts             # Vector operations schemas
│   │   ├── 📄 instances.ts         # Instance schemas
│   │   ├── 📄 memory.ts            # Memory management schemas
│   │   ├── 📄 user.ts              # User schemas
│   │   └── 📄 userSubscriptions.ts # Subscription schemas
│   │
│   ├── 📁 services/                # Business logic layer
│   │   ├── 📄 DeployService.ts     # Contract deployment logic
│   │   ├── 📄 EizenService.ts      # Vector database operations
│   │   ├── 📄 EmbeddingService.ts  # Text-to-vector conversion
│   │   ├── 📄 mailService.ts       # Email service
│   │   ├── 📄 MemoryService.ts     # Memory operations
│   │   └── 📄 SubscriptionService.ts # Subscription management
│   │
│   └── 📁 utils/                   # Helper functions
│       ├── 📄 contract.ts          # Contract utilities
│       ├── 📄 etherscan.ts         # Etherscan API helpers
│       ├── 📄 helper.ts            # General utilities
│       └── 📄 responses.ts         # Standardized API responses
```

### Key Implementation Details

#### **Environment Variables**

```bash
# Database
DATABASE_URL="postgresql://user:pass@ep-xxx.neon.tech/archivenet"
REDIS_URL="redis://localhost:6379"

# Authentication
CLERK_SECRET_KEY="sk_test_xxx"
CLERK_WEBHOOK_SECRET="whsec_xxx"
JWT_SECRET="your-jwt-secret"

# Blockchain
ARWEAVE_WALLET_PATH="./service-wallet.json"
ARWEAVE_GATEWAY="https://arweave.net"

# AI Services
OPENAI_API_KEY="sk-xxx"
EMBEDDING_MODEL="text-embedding-3-small"

# Billing
STRIPE_SECRET_KEY="sk_test_xxx"
STRIPE_WEBHOOK_SECRET="whsec_xxx"

# Server
PORT=3000
NODE_ENV="production"
```

#### **API Endpoints Structure**

- **Authentication**: `/auth/*` - User registration, login, token management
- **Memory Operations**: `/memories/*` - Store, retrieve, delete AI memories
- **Search**: `/search/*` - Vector similarity search with metadata
- **User Management**: `/users/*` - Profile, usage stats, API key management
- **Webhooks**: `/webhooks/*` - Clerk and Stripe event processing
-

#### **Database Layer (Drizzle + Neon)**

- **Schema Definition**: Type-safe table schemas with relationships
- **Migrations**: Automatic schema versioning and updates
- **Seeds**: Development data and subscription plans
- **Models**: Abstracted database operations with proper typing

#### **Service Layer Architecture**

- **EizenService**: Vector database operations and HNSW management
- **EmbeddingService**: Text-to-vector conversion using OpenAI
- **AuthService**: JWT and API key validation logic
- **BillingService**: Usage tracking and subscription management
- **WebhookService**: Event processing from external services

#### **Background Job Processing**

- **Contract Deployment**: Automatic Arweave contract setup for new users
- **Embedding Processing**: Async text-to-vector conversion
- **Usage Aggregation**: Monthly billing calculations
- **Health Monitoring**: Contract and system health checks

#### Context0 Database Schema (Neon PostgreSQL)

Here's the Context0 database schema:

## **Context0 Database Schema**

### **Table: users**

| Column                   | Type      | Constraints                | Description                |
| ------------------------ | --------- | -------------------------- | -------------------------- |
| id                       | uuid      | PRIMARY KEY                | User unique identifier     |
| clerk_id                 | text      | NOT NULL, UNIQUE           | Clerk unique identifier    |
| full_name                | text      | NOT NULL                   | User display name          |
| email                    | text      | NOT NULL, UNIQUE           | User email from Clerk      |
| meta_mask_wallet_address | text      | UNIQUE                     | User's MetaMask wallet     |
| status                   | enum      | NOT NULL, DEFAULT 'active' | active, suspended, deleted |
| created_at               | timestamp | NOT NULL, DEFAULT NOW()    | Account creation time      |
| updated_at               | timestamp | NOT NULL, DEFAULT NOW()    | Last update time           |
| last_login_at            | timestamp |                            | Last login timestamp       |

### **Table: keys** (API Keys/Instances)

| Column                 | Type      | Constraints             | Description                     |
| ---------------------- | --------- | ----------------------- | ------------------------------- |
| id                     | uuid      | PRIMARY KEY             | API key unique identifier       |
| user_id                | uuid      | FOREIGN KEY → users(id) | Owner of this API key           |
| key                    | text      | NOT NULL, UNIQUE        | The actual API key string       |
| description            | text      | NOT NULL                | User-defined key description    |
| contract_tx_id         | text      | NOT NULL                | Arweave contract transaction ID |
| arweave_wallet_address | text      | NOT NULL                | Dedicated Arweave wallet        |
| is_active              | boolean   | NOT NULL, DEFAULT true  | Key activation status           |
| created_at             | timestamp | NOT NULL, DEFAULT NOW() | Key creation time               |
| last_used_at           | timestamp |                         | Last usage timestamp            |

### **Table: subscriptions**

| Column      | Type      | Constraints             | Description                    |
| ----------- | --------- | ----------------------- | ------------------------------ |
| id          | uuid      | PRIMARY KEY             | Subscription unique identifier |
| user_id     | uuid      | FOREIGN KEY → users(id) | Owner of this subscription     |
| plan        | text      | NOT NULL                | basic, pro, enterprise         |
| quota_limit | integer   | NOT NULL                | Monthly memory storage limit   |
| quota_used  | integer   | NOT NULL, DEFAULT 0     | Current usage count            |
| is_active   | boolean   | NOT NULL, DEFAULT true  | Subscription status            |
| renews_at   | timestamp | NOT NULL                | Next billing/renewal date      |
| created_at  | timestamp | NOT NULL, DEFAULT NOW() | Subscription start time        |

## **Relationships**

- **users** → **keys** (One-to-Many): One user can have multiple API keys/instances
- **users** → **subscriptions** (One-to-One): One user can have one subscription

### **2. MCP Server Repository (AI Integration)**

This handles the Model Context Protocol communication with AI agents like Claude, ChatGPT, etc.

**What it handles:**

- MCP protocol implementation for AI memory tools
- Vector embedding generation from text content
- Memory storage and retrieval operations
- Tool definitions for AI agents

**Memory storage flow:**

1. AI agent calls `store_memory` tool with content
2. Validate user API token
3. Generate vector embedding from content
4. Store in user's dedicated vector database
5. Log usage and costs

**Memory search flow:**

1. AI agent calls `search_memory` tool with query
2. Generate query vector embedding
3. Search user's vector database for similar memories
4. Return ranked results with metadata

### **3. Frontend Repository (user dashboard)**

Web interface for users to manage their AI memory service. Uses **Clerk for authentication** and integrated payment processing.

**What it handles:**

- **Clerk authentication** (login/register/profile management)
- API token management
- Memory browsing and search interface
- Usage statistics and analytics dashboards
- Integrated billing portal for subscription management

**Key Features:**

- Dashboard with memory statistics
- API token creation and management
- Memory search and browsing interface
- Usage analytics and billing information
- Subscription management via integrated payment portal

## Backend Data Flow Between Repositories

### **User Onboarding Complete Flow:**

**Step 1: Frontend → Clerk → Webhook**

- User signs up via Clerk on frontend
- Clerk handles authentication and user creation
- Clerk sends webhook to our API with user data

**Step 2: Webhook → Database**

- Our API receives Clerk webhook
- Creates user record in PostgreSQL database
- User chooses plan and pays via integrated payment system
- Webhook triggers in backend API → EizenDB contract deploy in Arweave for the user via our Arweave service wallet

**Step 3: Background Processing**

- Background worker calls `EizenDB.deploy()` with service wallet
- Returns unique `contractTxId` for this user
- Updates user record with contractTxId in NeonDB
- Generates API token for user and shows it in the frontend

**Step 4: User Access**

- User can now access dashboard via Clerk authentication
- API token available in dashboard for MCP integration

### **AI Memory Storage Complete Flow:**

**Step 1: AI Agent → MCP Server**

- AI agent calls store_memory(apiToken, content, metadata)

**Step 2: MCP Server → API Gateway**

- MCP server calls API to validate API key from the user AI
- API authenticates from the NeonDB
- API returns userId and subscription status
- Checks if user has remaining quota
- If yes, API generates vector embedding from content
- Creates EizenDB instance using service wallet + user's contractTxId
- Stores vector and metadata in user's isolated database
- Blockchain transaction submitted and confirmed

**Step 3: Usage Tracking**

- API logs operation
- API Gateway updates user usage statistics
- Costs tracked for billing purposes
- Updates the NeonDB
- Result sent to MCP server → AI agent

## Architecture Summary

**Core Components:**

1. **Eizen** - Vector database engine with Arweave storage
2. **Context0 API** - Backend service with Clerk integration
3. **MCP Server** - AI agent integration layer
4. **Client Dashboard** - User interface with Clerk auth

**Key Technologies:**

- **Authentication**: Clerk (frontend) + API tokens (MCP)
- **Billing**: Integrated payment processing
- **Database**: Neon PostgreSQL for user data, Arweave for vector storage
- **AI Integration**: Model Context Protocol (MCP)
- **Vector Search**: HNSW algorithm with cosine similarity (Eizen)
