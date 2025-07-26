# Context0

> **Where AI memories live forever** - A decentralized semantic memory platform powered by blockchain and vector search

[![Hackathon Project](https://img.shields.io/badge/Hackathon-2025-ff6b6b?style=for-the-badge&logo=code&logoColor=white)](https://github.com/your-username/ArchiveNET)
[![Arweave](https://img.shields.io/badge/Powered%20by-Arweave-9945FF?style=for-the-badge&logo=arweave&logoColor=white)](https://arweave.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)

[![License](https://img.shields.io/badge/License-ISC-blue.svg?style=flat-square)](LICENSE)
[![Build Status](https://img.shields.io/badge/Build-Passing-brightgreen?style=flat-square)](https://github.com/your-username/ArchiveNET)
[![AI Powered](https://img.shields.io/badge/AI-Powered-orange?style=flat-square&logo=openai)](https://github.com/your-username/ArchiveNET)
[![Blockchain](https://img.shields.io/badge/Blockchain-Decentralized-purple?style=flat-square)](https://github.com/your-username/ArchiveNET)

Context0 is a revolutionary decentralized memory management platform that combines the power of AI embeddings with blockchain permanence. Built on Arweave, it provides enterprise-grade semantic search capabilities through advanced vector database technology, enabling applications to store, search, and retrieve contextual information with unprecedented permanence and accuracy.

## Key Features

- **Semantic Memory**: AI-powered contextual memory storage and retrieval
- **Blockchain Persistence**: Permanent storage on Arweave blockchain
- **Vector Search**: State-of-the-art HNSW algorithm for similarity search
- **High Performance**: O(log N) search complexity for millions of vectors
- **Decentralized**: No single point of failure or censorship
- **Rich Metadata**: Comprehensive metadata support for enhanced search
- **Enterprise-Ready**: Production-grade API with authentication and monitoring

## Architecture

// image add

Context0 is a comprehensive monorepo consisting of four main components:

### **Eizen** - Vector Database Engine

The world's first decentralized vector engine built on Arweave blockchain, implementing the Hierarchical Navigable Small Worlds (HNSW) algorithm for approximate nearest neighbor search.

**Key Features:**

- HNSW algorithm with O(log N) complexity
- Blockchain-based persistence via HollowDB
- Protobuf encoding for efficient storage
- Database-agnostic interface
- Handles millions of high-dimensional vectors

### **API** - Backend Service

A robust Express.js API service providing semantic memory management with AI-powered search capabilities.

**Stack:**

- Express.js with TypeScript
- Neon PostgreSQL with Drizzle ORM
- EizenDB for vector operations
- Redis for caching
- JWT authentication
- Comprehensive validation with Zod

### **Frontend** - Web Interface

A modern Next.js application providing an intuitive interface for memory management and search operations.

**Features:**

- React-based UI with TypeScript
- Real-time search capabilities
- Memory visualization
- User dashboard
- Responsive design

### **MCP server**

The central Model Context Protocol (MCP) server that orchestrates memory operations and provides intelligent context management.

## Quick Start

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- PostgreSQL database
- Redis server
- Arweave wallet

### Installation

1. **Clone the repository**:

   ```bash
   git clone https://github.com/Itz-Agasta/context0.git
   cd context0
   ```

2. **Start with Docker Compose**:

   ```bash
   docker-compose up -d
   ```

3. **Manual setup** (alternative):

   ```bash
   # API Setup
   cd API
   npm install
   npm run build
   npx drizzle-kit push
   npm run dev

   # Frontend Setup
   cd ../frontend
   npm install
   npm run dev

   # Eizen Setup
   cd ../Eizen
   npm install
   npm run build
   ```

### Configuration

Create `.env` files in respective directories:

**API/.env**:

```env
DATABASE_URL=your_postgres_url
REDIS_URL=redis://localhost:6379
JWT_SECRET=your_jwt_secret
ARWEAVE_WALLET_PATH=./data/wallet.json
```

## Usage Examples

### Basic Vector Operations

```typescript
import { EizenDbVector } from "eizen";

// Initialize vector database
const vectordb = new EizenDbVector(sdk, {
  m: 16,
  efConstruction: 200,
  efSearch: 50,
});

// Insert a memory with embedding
await vectordb.insert([0.1, 0.2, 0.3, 0.4], {
  id: "memory1",
  content: "Important meeting notes",
  metadata: { type: "meeting", date: "2025-01-15" },
});

// Search for similar memories
const results = await vectordb.knn_search([0.15, 0.25, 0.35, 0.45], 5);
```

### API Integration

```javascript
// Store a memory
const response = await fetch("/api/memories", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    content: "Project discussion about AI integration",
    metadata: { project: "AI-Platform", priority: "high" },
  }),
});

// Search memories
const searchResults = await fetch("/api/memories/search", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    query: "AI project discussions",
    limit: 10,
  }),
});
```

### Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
   s

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Made with ❤️ by Team Vyse**
