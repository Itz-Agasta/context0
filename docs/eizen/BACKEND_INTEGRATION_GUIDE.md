# EizenDbVector Backend Integration Guide

## Overview

This guide shows you how to build production-ready vector database backends using EizenDbVector. Whether you're building a RAG system, recommendation engine, or similarity search API, this guide provides complete examples and best practices for integrating EizenDbVector into your backend services.

## Table of Contents

1. [Backend Architecture Patterns](#backend-architecture-patterns)
2. [REST API Implementation](#rest-api-implementation)
3. [GraphQL API Implementation](#graphql-api-implementation)
4. [Microservice Architecture](#microservice-architecture)
5. [Production Deployment](#production-deployment)
6. [Monitoring & Observability](#monitoring--observability)
7. [Security & Authentication](#security--authentication)
8. [Performance Optimization](#performance-optimization)
9. [Complete Examples](#complete-examples)

---

## Backend Architecture Patterns

### 1. Simple Vector Database Service

The most straightforward pattern - a dedicated service that wraps EizenDbVector:

```typescript
// src/services/VectorService.ts
import { EizenDbVector } from "eizen";
import { SetSDK } from "hollowdb";
import { WarpFactory } from "warp-contracts";

export interface VectorDocument {
  id: string;
  content: string;
  metadata: Record<string, any>;
  embedding?: number[];
}

export class VectorService {
  private vectorDb: EizenDbVector<VectorDocument>;
  private isInitialized: boolean = false;

  constructor(
    private config: {
      contractTxId: string;
      wallet: any;
      warpEnvironment: "mainnet" | "testnet" | "local";
    }
  ) {}

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    const warp =
      this.config.warpEnvironment === "mainnet"
        ? WarpFactory.forMainnet()
        : WarpFactory.forTestnet();

    const sdk = new SetSDK<string>(
      this.config.wallet,
      this.config.contractTxId,
      warp
    );

    this.vectorDb = new EizenDbVector<VectorDocument>(sdk, {
      m: 16,
      efConstruction: 200,
      efSearch: 50,
    });

    this.isInitialized = true;
  }

  async addDocument(document: VectorDocument): Promise<void> {
    await this.ensureInitialized();

    if (!document.embedding) {
      throw new Error("Document must include embedding vector");
    }

    try {
      await this.vectorDb.insert(document.embedding, document);
    } catch (error) {
      throw new Error(`Failed to add document: ${error.message}`);
    }
  }

  async searchSimilar(
    query: number[],
    limit: number = 10,
    filters?: Record<string, any>
  ): Promise<Array<VectorDocument & { similarity: number }>> {
    await this.ensureInitialized();

    try {
      const results = await this.vectorDb.knn_search(query, limit * 2);

      let filteredResults = results;

      // Apply filters if provided
      if (filters) {
        filteredResults = results.filter((result) => {
          if (!result.metadata) return false;

          return Object.entries(filters).every(([key, value]) => {
            const metadataValue = result.metadata[key];
            if (Array.isArray(value)) {
              return value.includes(metadataValue);
            }
            return metadataValue === value;
          });
        });
      }

      return filteredResults.slice(0, limit).map((result) => ({
        id: result.id,
        content: result.metadata?.content || "",
        metadata: result.metadata || {},
        embedding: undefined, // Not included in search results for performance
        similarity: 1 - result.distance, // Assumes cosine distance [0,2] -> similarity [1,-1]
      }));
    } catch (error) {
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  async getDocument(id: string): Promise<VectorDocument | null> {
    // Implementation would require additional indexing
    // This is a placeholder for the concept
    throw new Error("Document retrieval by ID not implemented");
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }
}
```

### 2. Layered Architecture with Business Logic

More sophisticated pattern with separate layers:

```typescript
// src/models/Document.ts
export interface DocumentModel {
  id: string;
  title: string;
  content: string;
  author?: string;
  tags: string[];
  category: string;
  createdAt: Date;
  updatedAt: Date;
}

// src/repositories/VectorRepository.ts
import { VectorService } from "../services/VectorService";

export class VectorRepository {
  constructor(private vectorService: VectorService) {}

  async storeDocument(
    document: DocumentModel,
    embedding: number[]
  ): Promise<void> {
    const vectorDoc = {
      id: document.id,
      content: document.content,
      metadata: {
        title: document.title,
        author: document.author,
        tags: document.tags,
        category: document.category,
        createdAt: document.createdAt.toISOString(),
        updatedAt: document.updatedAt.toISOString(),
      },
      embedding,
    };

    await this.vectorService.addDocument(vectorDoc);
  }

  async findSimilarDocuments(
    queryEmbedding: number[],
    options: {
      limit?: number;
      category?: string;
      tags?: string[];
      minSimilarity?: number;
    } = {}
  ): Promise<DocumentModel[]> {
    const filters: Record<string, any> = {};

    if (options.category) {
      filters.category = options.category;
    }

    if (options.tags?.length) {
      // This would need custom filtering logic
      filters.tags = options.tags;
    }

    const results = await this.vectorService.searchSimilar(
      queryEmbedding,
      options.limit || 10,
      filters
    );

    return results
      .filter(
        (result) =>
          !options.minSimilarity || result.similarity >= options.minSimilarity
      )
      .map((result) => ({
        id: result.id,
        title: result.metadata.title,
        content: result.content,
        author: result.metadata.author,
        tags: result.metadata.tags || [],
        category: result.metadata.category,
        createdAt: new Date(result.metadata.createdAt),
        updatedAt: new Date(result.metadata.updatedAt),
      }));
  }
}

// src/services/DocumentService.ts
// Helper function for ID generation
function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export class DocumentService {
  constructor(
    private vectorRepository: VectorRepository,
    private embeddingService: EmbeddingService // Your embedding generation service
  ) {}

  async addDocument(
    document: Omit<DocumentModel, "id" | "createdAt" | "updatedAt">
  ): Promise<DocumentModel> {
    const now = new Date();
    const fullDocument: DocumentModel = {
      ...document,
      id: generateId(), // Your ID generation logic
      createdAt: now,
      updatedAt: now,
    };

    // Generate embedding for document content
    const embedding = await this.embeddingService.generateEmbedding(
      `${document.title} ${document.content}`
    );

    await this.vectorRepository.storeDocument(fullDocument, embedding);

    return fullDocument;
  }

  async searchDocuments(
    query: string,
    options: {
      limit?: number;
      category?: string;
      tags?: string[];
      minSimilarity?: number;
    } = {}
  ): Promise<DocumentModel[]> {
    // Generate embedding for search query
    const queryEmbedding = await this.embeddingService.generateEmbedding(query);

    return this.vectorRepository.findSimilarDocuments(queryEmbedding, options);
  }
}
```

---

## REST API Implementation

### Express.js Backend Example

```typescript
// src/app.ts
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { DocumentService } from "./services/DocumentService";
import { VectorService } from "./services/VectorService";
import { VectorRepository } from "./repositories/VectorRepository";
import { EmbeddingService } from "./services/EmbeddingService";

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Helper function to load wallet
function loadWallet() {
  return JSON.parse(readFileSync("./path/to/wallet.json", "utf-8"));
}

// Initialize services
const vectorService = new VectorService({
  contractTxId: process.env.CONTRACT_TX_ID!,
  wallet: loadWallet(), // Your wallet loading logic
  warpEnvironment: process.env.WARP_ENV as any,
});

const embeddingService = new EmbeddingService();
const vectorRepository = new VectorRepository(vectorService);
const documentService = new DocumentService(vectorRepository, embeddingService);

// Routes
app.post("/api/documents", async (req, res) => {
  try {
    const { title, content, author, tags, category } = req.body;

    // Validation
    if (!title || !content || !category) {
      return res.status(400).json({
        error: "Missing required fields: title, content, category",
      });
    }

    const document = await documentService.addDocument({
      title,
      content,
      author,
      tags: tags || [],
      category,
    });

    res.status(201).json({
      success: true,
      data: document,
    });
  } catch (error) {
    console.error("Error adding document:", error);
    res.status(500).json({
      error: "Failed to add document",
      message: error.message,
    });
  }
});

app.get("/api/search", async (req, res) => {
  try {
    const {
      q: query,
      limit = 10,
      category,
      tags,
      minSimilarity = 0.5,
    } = req.query;

    if (!query) {
      return res.status(400).json({
        error: 'Query parameter "q" is required',
      });
    }

    const searchOptions = {
      limit: Number(limit),
      category: category as string,
      tags: tags ? (tags as string).split(",") : undefined,
      minSimilarity: Number(minSimilarity),
    };

    const results = await documentService.searchDocuments(
      query as string,
      searchOptions
    );

    res.json({
      success: true,
      data: {
        query,
        results,
        count: results.length,
      },
    });
  } catch (error) {
    console.error("Error searching documents:", error);
    res.status(500).json({
      error: "Search failed",
      message: error.message,
    });
  }
});

app.post("/api/search/vector", async (req, res) => {
  try {
    const { vector, limit = 10, filters } = req.body;

    if (!vector || !Array.isArray(vector)) {
      return res.status(400).json({
        error: "Vector array is required",
      });
    }

    const results = await vectorService.searchSimilar(
      vector,
      Number(limit),
      filters
    );

    res.json({
      success: true,
      data: {
        results,
        count: results.length,
      },
    });
  } catch (error) {
    console.error("Error in vector search:", error);
    res.status(500).json({
      error: "Vector search failed",
      message: error.message,
    });
  }
});

// Health check
app.get("/api/health", async (req, res) => {
  try {
    await vectorService.initialize();
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version,
    });
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      error: error.message,
    });
  }
});

// Error handling middleware
app.use(
  (
    error: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error("Unhandled error:", error);
    res.status(500).json({
      error: "Internal server error",
      message:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Something went wrong",
    });
  }
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Vector database API server running on port ${PORT}`);
});

export default app;
```

### API Documentation Examples

```typescript
// API Usage Examples

// 1. Add a document
const response = await fetch("http://localhost:3000/api/documents", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    title: "Introduction to Machine Learning",
    content: "Machine learning is a subset of artificial intelligence...",
    author: "John Doe",
    tags: ["machine-learning", "ai", "tutorial"],
    category: "education",
  }),
});

// 2. Search by text query
const searchResponse = await fetch(
  "http://localhost:3000/api/search?q=machine learning&limit=5&category=education"
);

// 3. Search by vector directly
const vectorResponse = await fetch("http://localhost:3000/api/search/vector", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    vector: [0.1, 0.2, 0.3, 0.4, 0.5], // Your embedding vector
    limit: 10,
    filters: {
      category: "research",
    },
  }),
});
```

---

## GraphQL API Implementation

```typescript
// src/graphql/schema.ts
import { buildSchema } from "graphql";

export const schema = buildSchema(`
  type Document {
    id: ID!
    title: String!
    content: String!
    author: String
    tags: [String!]!
    category: String!
    createdAt: String!
    updatedAt: String!
  }

  type SearchResult {
    document: Document!
    similarity: Float!
  }

  type SearchResponse {
    query: String!
    results: [SearchResult!]!
    count: Int!
  }

  input DocumentInput {
    title: String!
    content: String!
    author: String
    tags: [String!]
    category: String!
  }

  input SearchFilters {
    category: String
    tags: [String!]
    minSimilarity: Float
  }

  type Query {
    searchDocuments(
      query: String!
      limit: Int = 10
      filters: SearchFilters
    ): SearchResponse!

    searchByVector(
      vector: [Float!]!
      limit: Int = 10
      filters: SearchFilters
    ): [SearchResult!]!
  }

  type Mutation {
    addDocument(input: DocumentInput!): Document!
  }
`);

// src/graphql/resolvers.ts
import { DocumentService } from "../services/DocumentService";

export const createResolvers = (documentService: DocumentService) => ({
  Query: {
    searchDocuments: async (_: any, { query, limit, filters }: any) => {
      const results = await documentService.searchDocuments(query, {
        limit,
        category: filters?.category,
        tags: filters?.tags,
        minSimilarity: filters?.minSimilarity,
      });

      return {
        query,
        results: results.map((doc) => ({
          document: doc,
          similarity: 0.8, // This would come from the actual search
        })),
        count: results.length,
      };
    },

    searchByVector: async (_: any, { vector, limit, filters }: any) => {
      // Implementation for direct vector search
      throw new Error("Not implemented");
    },
  },

  Mutation: {
    addDocument: async (_: any, { input }: any) => {
      return documentService.addDocument(input);
    },
  },
});

// src/graphql/server.ts
import { graphqlHTTP } from "express-graphql";
import { schema } from "./schema";
import { createResolvers } from "./resolvers";

export const createGraphQLMiddleware = (documentService: DocumentService) => {
  return graphqlHTTP({
    schema,
    rootValue: createResolvers(documentService),
    graphiql: process.env.NODE_ENV === "development",
  });
};
```

---

## Microservice Architecture

### Vector Database Microservice

```typescript
// services/vector-db-service/src/server.ts
import express from "express";
import { VectorService } from "./VectorService";
import { createPrometheusMetrics } from "./metrics";

class VectorDatabaseService {
  private app: express.Application;
  private vectorService: VectorService;
  private metrics: any;

  constructor() {
    this.app = express();
    this.metrics = createPrometheusMetrics();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    this.app.use(express.json());
    this.app.use((req, res, next) => {
      this.metrics.httpRequestsTotal.inc({
        method: req.method,
        route: req.route?.path || req.path,
      });
      next();
    });
  }

  private setupRoutes() {
    // Vector operations
    this.app.post("/vectors", async (req, res) => {
      const timer = this.metrics.operationDuration.startTimer({
        operation: "insert",
      });

      try {
        const { vector, metadata } = req.body;
        await this.vectorService.addDocument({
          ...metadata,
          embedding: vector,
        });

        res.status(201).json({ success: true });
      } catch (error) {
        this.metrics.operationErrors.inc({ operation: "insert" });
        res.status(500).json({ error: error.message });
      } finally {
        timer();
      }
    });

    this.app.post("/vectors/search", async (req, res) => {
      const timer = this.metrics.operationDuration.startTimer({
        operation: "search",
      });

      try {
        const { vector, limit, filters } = req.body;
        const results = await this.vectorService.searchSimilar(
          vector,
          limit,
          filters
        );

        res.json({ results });
      } catch (error) {
        this.metrics.operationErrors.inc({ operation: "search" });
        res.status(500).json({ error: error.message });
      } finally {
        timer();
      }
    });

    // Health and metrics
    this.app.get("/health", (req, res) => {
      res.json({ status: "healthy" });
    });

    this.app.get("/metrics", (req, res) => {
      res.set("Content-Type", this.metrics.register.contentType);
      res.end(this.metrics.register.metrics());
    });
  }

  async start(port: number = 3001) {
    this.vectorService = new VectorService({
      contractTxId: process.env.CONTRACT_TX_ID!,
      wallet: loadWallet(),
      warpEnvironment: process.env.WARP_ENV as any,
    });

    await this.vectorService.initialize();

    this.app.listen(port, () => {
      console.log(`Vector database service running on port ${port}`);
    });
  }
}

new VectorDatabaseService().start();
```

### Service Communication Example

```typescript
// services/api-gateway/src/VectorServiceClient.ts
import axios from "axios";

export class VectorServiceClient {
  constructor(private baseUrl: string) {}

  async addVector(vector: number[], metadata: any): Promise<void> {
    await axios.post(`${this.baseUrl}/vectors`, {
      vector,
      metadata,
    });
  }

  async searchVectors(
    vector: number[],
    limit: number = 10,
    filters?: any
  ): Promise<any[]> {
    const response = await axios.post(`${this.baseUrl}/vectors/search`, {
      vector,
      limit,
      filters,
    });

    return response.data.results;
  }
}

// Usage in main API service
const vectorClient = new VectorServiceClient("http://vector-service:3001");

app.post("/api/documents", async (req, res) => {
  try {
    // Save document to main database
    const document = await documentRepository.save(req.body);

    // Generate embedding
    const embedding = await embeddingService.generate(document.content);

    // Store in vector database
    await vectorClient.addVector(embedding, {
      documentId: document.id,
      title: document.title,
      category: document.category,
    });

    res.json({ success: true, document });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

## Production Deployment

### Docker Configuration

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S vector-api -u 1001

# Set ownership
CHOWN -R vector-api:nodejs /app
USER vector-api

EXPOSE 3000

CMD ["npm", "start"]
```

```yaml
# docker-compose.yml
version: "3.8"

services:
  vector-api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - CONTRACT_TX_ID=${CONTRACT_TX_ID}
      - WARP_ENV=mainnet
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis
    volumes:
      - ./wallet.json:/app/wallet.json:ro
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - vector-api
    restart: unless-stopped

volumes:
  redis_data:
```

### Kubernetes Deployment

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vector-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: vector-api
  template:
    metadata:
      labels:
        app: vector-api
    spec:
      containers:
        - name: vector-api
          image: your-registry/vector-api:latest
          ports:
            - containerPort: 3000
          env:
            - name: CONTRACT_TX_ID
              valueFrom:
                secretKeyRef:
                  name: vector-secrets
                  key: contract-tx-id
            - name: WARP_ENV
              value: "mainnet"
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "512Mi"
              cpu: "500m"
          livenessProbe:
            httpGet:
              path: /api/health
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /api/health
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5

---
apiVersion: v1
kind: Service
metadata:
  name: vector-api-service
spec:
  selector:
    app: vector-api
  ports:
    - port: 80
      targetPort: 3000
  type: LoadBalancer
```

---

## Monitoring & Observability

### Prometheus Metrics

```typescript
// src/metrics.ts
import client from "prom-client";

export const createPrometheusMetrics = () => {
  const register = new client.Registry();

  const httpRequestsTotal = new client.Counter({
    name: "http_requests_total",
    help: "Total number of HTTP requests",
    labelNames: ["method", "route", "status"],
    registers: [register],
  });

  const operationDuration = new client.Histogram({
    name: "vector_operation_duration_seconds",
    help: "Duration of vector operations",
    labelNames: ["operation"],
    buckets: [0.1, 0.5, 1, 5, 10],
    registers: [register],
  });

  const operationErrors = new client.Counter({
    name: "vector_operation_errors_total",
    help: "Total number of vector operation errors",
    labelNames: ["operation"],
    registers: [register],
  });

  const vectorCount = new client.Gauge({
    name: "vector_database_size",
    help: "Number of vectors in database",
    registers: [register],
  });

  return {
    register,
    httpRequestsTotal,
    operationDuration,
    operationErrors,
    vectorCount,
  };
};
```

### Logging Configuration

```typescript
// src/logger.ts
import winston from "winston";

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: "vector-api" },
  transports: [
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "combined.log" }),
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

// Usage in your services
export class VectorService {
  async addDocument(document: VectorDocument): Promise<void> {
    const startTime = Date.now();

    try {
      logger.info("Adding document", {
        documentId: document.id,
        contentLength: document.content.length,
      });

      await this.vectorDb.insert(document.embedding!, document);

      logger.info("Document added successfully", {
        documentId: document.id,
        duration: Date.now() - startTime,
      });
    } catch (error) {
      logger.error("Failed to add document", {
        documentId: document.id,
        error: error.message,
        duration: Date.now() - startTime,
      });
      throw error;
    }
  }
}
```

---

## Security & Authentication

### JWT Authentication

```typescript
// src/middleware/auth.ts
import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export const authenticateToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  jwt.verify(token, process.env.JWT_SECRET!, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid token" });
    }

    req.user = user as any;
    next();
  });
};

// Usage in routes
app.post(
  "/api/documents",
  authenticateToken,
  async (req: AuthenticatedRequest, res) => {
    // Now you have access to req.user
    const document = await documentService.addDocument({
      ...req.body,
      author: req.user!.email,
    });

    res.json({ success: true, document });
  }
);
```

### Rate Limiting

```typescript
// src/middleware/rateLimiting.ts
import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL);

export const createRateLimiter = (options: {
  windowMs: number;
  max: number;
  message: string;
}) => {
  return rateLimit({
    store: new RedisStore({
      client: redis,
      prefix: "rl:",
    }),
    windowMs: options.windowMs,
    max: options.max,
    message: { error: options.message },
    standardHeaders: true,
    legacyHeaders: false,
  });
};

// Different limits for different operations
export const searchLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 searches per 15 minutes
  message: "Too many search requests",
});

export const uploadLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10, // 10 uploads per 15 minutes
  message: "Too many upload requests",
});

// Usage
app.get("/api/search", searchLimiter, searchHandler);
app.post("/api/documents", uploadLimiter, uploadHandler);
```

---

## Performance Optimization

### Caching Strategy

```typescript
// src/services/CacheService.ts
import Redis from "ioredis";

export class CacheService {
  private redis: Redis;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
  }

  async cacheSearchResult(
    queryHash: string,
    results: any[],
    ttlSeconds: number = 300
  ): Promise<void> {
    await this.redis.setex(
      `search:${queryHash}`,
      ttlSeconds,
      JSON.stringify(results)
    );
  }

  async getCachedSearchResult(queryHash: string): Promise<any[] | null> {
    const cached = await this.redis.get(`search:${queryHash}`);
    return cached ? JSON.parse(cached) : null;
  }

  private hashQuery(query: string, filters: any): string {
    return require("crypto")
      .createHash("md5")
      .update(JSON.stringify({ query, filters }))
      .digest("hex");
  }
}

// Enhanced search service with caching
export class CachedDocumentService extends DocumentService {
  constructor(
    vectorRepository: VectorRepository,
    embeddingService: EmbeddingService,
    private cacheService: CacheService
  ) {
    super(vectorRepository, embeddingService);
  }

  async searchDocuments(
    query: string,
    options: any = {}
  ): Promise<DocumentModel[]> {
    const queryHash = this.hashQuery(query, options);

    // Check cache first
    const cached = await this.cacheService.getCachedSearchResult(queryHash);
    if (cached) {
      logger.info("Cache hit for search query", { queryHash });
      return cached;
    }

    // Perform actual search
    const results = await super.searchDocuments(query, options);

    // Cache results
    await this.cacheService.cacheSearchResult(queryHash, results);

    return results;
  }

  private hashQuery(query: string, options: any): string {
    return require("crypto")
      .createHash("md5")
      .update(JSON.stringify({ query, options }))
      .digest("hex");
  }
}
```

### Connection Pooling

```typescript
// src/services/VectorServicePool.ts
export class VectorServicePool {
  private pool: VectorService[] = [];
  private currentIndex = 0;

  constructor(private poolSize: number, private config: any) {
    this.initializePool();
  }

  private async initializePool(): Promise<void> {
    for (let i = 0; i < this.poolSize; i++) {
      const service = new VectorService(this.config);
      await service.initialize();
      this.pool.push(service);
    }
  }

  getService(): VectorService {
    const service = this.pool[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.poolSize;
    return service;
  }

  async addDocument(document: VectorDocument): Promise<void> {
    const service = this.getService();
    return service.addDocument(document);
  }

  async searchSimilar(
    query: number[],
    limit: number,
    filters?: any
  ): Promise<any[]> {
    const service = this.getService();
    return service.searchSimilar(query, limit, filters);
  }
}
```

---

## Complete Examples

### 1. RAG System Backend

```typescript
// Complete RAG (Retrieval-Augmented Generation) Backend
import express from "express";
import { EizenDbVector } from "eizen";
import OpenAI from "openai";

interface RAGDocument {
  id: string;
  title: string;
  content: string;
  source: string;
  chunkIndex: number;
  embedding: number[];
}

class RAGSystem {
  private vectorDb: EizenDbVector<RAGDocument>;
  private openai: OpenAI;

  constructor(vectorService: VectorService) {
    this.vectorDb = vectorService as any; // Type assertion for example
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async ingestDocument(
    title: string,
    content: string,
    source: string
  ): Promise<void> {
    // Split content into chunks
    const chunks = this.splitIntoChunks(content, 1000);

    for (let i = 0; i < chunks.length; i++) {
      // Generate embedding for chunk
      const embedding = await this.generateEmbedding(chunks[i]);

      const document: RAGDocument = {
        id: `${source}_chunk_${i}`,
        title,
        content: chunks[i],
        source,
        chunkIndex: i,
        embedding,
      };

      await this.vectorDb.insert(embedding, document);
    }
  }

  async generateResponse(
    question: string,
    maxContextChunks: number = 5
  ): Promise<string> {
    // Generate embedding for question
    const questionEmbedding = await this.generateEmbedding(question);

    // Find relevant context
    const relevantChunks = await this.vectorDb.knn_search(
      questionEmbedding,
      maxContextChunks
    );

    // Build context from relevant chunks
    const context = relevantChunks
      .map((chunk) => chunk.metadata!.content)
      .join("\n\n");

    // Generate response using OpenAI
    const completion = await this.openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant. Answer the question based on the provided context. If the context doesn't contain relevant information, say so.",
        },
        {
          role: "user",
          content: `Context:\n${context}\n\nQuestion: ${question}`,
        },
      ],
      max_tokens: 500,
    });

    return (
      completion.choices[0].message.content || "I couldn't generate a response."
    );
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: text,
    });

    return response.data[0].embedding;
  }

  private splitIntoChunks(text: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    const sentences = text.split(/[.!?]+/);

    let currentChunk = "";

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length <= chunkSize) {
        currentChunk += sentence + ".";
      } else {
        if (currentChunk) chunks.push(currentChunk.trim());
        currentChunk = sentence + ".";
      }
    }

    if (currentChunk) chunks.push(currentChunk.trim());

    return chunks;
  }
}

// Express routes for RAG system
const app = express();
const ragSystem = new RAGSystem(vectorService);

app.post("/api/ingest", async (req, res) => {
  try {
    const { title, content, source } = req.body;
    await ragSystem.ingestDocument(title, content, source);
    res.json({ success: true, message: "Document ingested successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/ask", async (req, res) => {
  try {
    const { question } = req.body;
    const response = await ragSystem.generateResponse(question);
    res.json({ success: true, response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### 2. Image Similarity API

```typescript
// Complete Image Similarity Search Backend
import multer from "multer";
import sharp from "sharp";
import tf from "@tensorflow/tfjs-node";

interface ImageMetadata {
  id: string;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  width: number;
  height: number;
  tags: string[];
  uploadedAt: Date;
}

class ImageSimilarityService {
  private vectorDb: EizenDbVector<ImageMetadata>;
  private model: tf.LayersModel | null = null;

  constructor(vectorService: VectorService) {
    this.vectorDb = vectorService as any;
    this.loadModel();
  }

  private async loadModel(): Promise<void> {
    // Load a pre-trained image feature extraction model
    this.model = await tf.loadLayersModel(
      "file://./models/image-feature-extractor"
    );
  }

  async extractFeatures(imageBuffer: Buffer): Promise<number[]> {
    if (!this.model) {
      throw new Error("Model not loaded");
    }

    // Preprocess image
    const processedImage = await sharp(imageBuffer)
      .resize(224, 224)
      .rgb()
      .raw()
      .toBuffer();

    // Convert to tensor
    const tensor = tf
      .tensor3d(new Uint8Array(processedImage), [224, 224, 3])
      .expandDims(0)
      .div(255.0);

    // Extract features
    const features = this.model.predict(tensor) as tf.Tensor;
    const featuresArray = await features.data();

    // Cleanup
    tensor.dispose();
    features.dispose();

    return Array.from(featuresArray);
  }

  async addImage(
    imageBuffer: Buffer,
    metadata: Omit<ImageMetadata, "id" | "uploadedAt">
  ): Promise<string> {
    const features = await this.extractFeatures(imageBuffer);
    const imageId = generateImageId();

    const fullMetadata: ImageMetadata = {
      ...metadata,
      id: imageId,
      uploadedAt: new Date(),
    };

    await this.vectorDb.insert(features, fullMetadata);

    return imageId;
  }

  async findSimilarImages(
    queryImageBuffer: Buffer,
    options: {
      limit?: number;
      tags?: string[];
      minSimilarity?: number;
    } = {}
  ): Promise<Array<ImageMetadata & { similarity: number }>> {
    const queryFeatures = await this.extractFeatures(queryImageBuffer);

    const results = await this.vectorDb.knn_search(
      queryFeatures,
      options.limit || 10
    );

    return results
      .filter((result) => {
        const similarity = 1 - result.distance;
        if (options.minSimilarity && similarity < options.minSimilarity) {
          return false;
        }

        if (options.tags?.length) {
          const imageTags = result.metadata?.tags || [];
          return options.tags.some((tag) => imageTags.includes(tag));
        }

        return true;
      })
      .map((result) => ({
        ...result.metadata!,
        similarity: 1 - result.distance,
      }));
  }
}

// Express setup for image similarity
const upload = multer({ storage: multer.memoryStorage() });
const imageSimilarityService = new ImageSimilarityService(vectorService);

app.post("/api/images", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image file provided" });
    }

    const { tags = [], description } = req.body;

    // Get image dimensions
    const { width, height } = await sharp(req.file.buffer).metadata();

    const imageId = await imageSimilarityService.addImage(req.file.buffer, {
      filename: `${Date.now()}_${req.file.originalname}`,
      originalName: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype,
      width: width || 0,
      height: height || 0,
      tags: Array.isArray(tags) ? tags : tags.split(","),
    });

    res.json({
      success: true,
      imageId,
      message: "Image uploaded and indexed successfully",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/images/search", upload.single("query"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No query image provided" });
    }

    const { limit = 10, tags, minSimilarity = 0.5 } = req.body;

    const results = await imageSimilarityService.findSimilarImages(
      req.file.buffer,
      {
        limit: Number(limit),
        tags: tags ? tags.split(",") : undefined,
        minSimilarity: Number(minSimilarity),
      }
    );

    res.json({
      success: true,
      results,
      count: results.length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

This backend integration guide provides comprehensive examples for building production-ready applications with EizenDbVector. Choose the architecture pattern that best fits your needs and customize the examples for your specific use case.

For additional examples and advanced patterns, refer to the main developer guide and the repository's test files.
