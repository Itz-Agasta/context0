# EizenDbVector Developer Guide

## Overview

EizenDbVector is a high-performance vector database library built on Arweave blockchain that implements the Hierarchical Navigable Small Worlds (HNSW) algorithm for approximate nearest neighbor search. This guide provides comprehensive documentation for developers integrating EizenDbVector into their applications.

## Table of Contents

1. [Installation & Setup](#installation--setup)
2. [Quick Start](#quick-start)
3. [Core API Reference](#core-api-reference)
4. [Architecture Overview](#architecture-overview)
5. [Advanced Usage](#advanced-usage)
6. [Performance Tuning](#performance-tuning)
7. [Error Handling](#error-handling)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)
10. [Examples](#examples)

---

## Installation & Setup

### Prerequisites

- Node.js 18+ or compatible runtime
- TypeScript 5.0+ (for TypeScript projects)
- Arweave wallet (for blockchain deployment)
- Warp Contracts SDK

### Installation

```bash
npm install eizen
# or
yarn add eizen
# or
pnpm add eizen
```

### Dependencies

The library requires the following peer dependencies:

```bash
npm install hollowdb warp-contracts warp-contracts-plugin-deploy
```

---

## Quick Start

### Basic Setup

```typescript
import { EizenDbVector, EizenCompatSDK } from "eizen";
import { SetSDK } from "hollowdb";
import { WarpFactory, defaultCacheOptions } from "warp-contracts";
import { Redis } from "ioredis";
import { RedisCache } from "warp-contracts-redis";
import { readFileSync } from "fs";

// 1. Connect to Redis (optional for caching)
const redis = new Redis();

// 2. Setup Warp with Redis cache
const warp = WarpFactory.forMainnet().useKVStorageFactory(
  (contractTxId: string) =>
    new RedisCache(
      { ...defaultCacheOptions, dbLocation: `${contractTxId}` },
      { client: redis }
    )
);

// 3. Load wallet and create SDK
const wallet = JSON.parse(readFileSync("./path/to/wallet.json", "utf-8"));
const contractTxId = "your-contract-tx-id";
const sdk = new SetSDK<string>(wallet, contractTxId, warp);

// 4. Create vector database instance with advanced HNSW parameters
const vectordb = new EizenDbVector<YourMetadataType>(sdk, {
  m: 16, // Connections per node
  efConstruction: 200, // Build quality
  efSearch: 50, // Search quality
});

// 5. Insert vectors with metadata
await vectordb.insert([0.1, 0.2, 0.3, 0.4], {
  id: "doc1",
  title: "Research Paper",
  category: "machine-learning",
});

// 6. Search for similar vectors
const results = await vectordb.knn_search([0.15, 0.25, 0.35, 0.45], 5);
```

### Contract Deployment

```typescript
import { EizenDbVector } from "eizen";
import { WarpFactory } from "warp-contracts";
import { readFileSync } from "fs";

// Deploy a new vector storage contract
const warp = WarpFactory.forMainnet();
const wallet = JSON.parse(readFileSync("./path/to/wallet.json", "utf-8"));

const { contractTxId, srcTxId } = await EizenDbVector.deploy(wallet, warp);
console.log(`Contract deployed: ${contractTxId}`);
```

---

## Core API Reference

### EizenDbVector Class

The main class that provides vector database functionality with blockchain persistence.

#### Constructor

```typescript
constructor(
  contractSDK: SetSDK<string>,
  options?: {
    m?: number;           // Default: 5
    efConstruction?: number; // Default: 128
    efSearch?: number;       // Default: 20
  }
)
```

**Parameters:**

- `contractSDK`: HollowDB SDK instance for blockchain storage
- `options.m`: Maximum bidirectional connections per node (5-48 range)
- `options.efConstruction`: Candidate list size during graph construction
- `options.efSearch`: Candidate list size during search operations

#### Methods

##### `insert(vector, metadata?)`

Inserts a vector with optional metadata into the database.

```typescript
async insert(vector: number[], metadata?: M): Promise<void>
```

**Parameters:**

- `vector`: Array of numbers representing the vector
- `metadata`: Optional metadata object associated with the vector

**Example:**

```typescript
await vectorDb.insert([0.1, 0.2, 0.3], {
  id: "doc1",
  type: "document",
});
```

##### `knn_search(query, k)`

Performs k-nearest neighbor search to find similar vectors.

```typescript
async knn_search(query: number[], k: number): Promise<KNNResult<M>[]>
```

**Parameters:**

- `query`: Query vector to search for
- `k`: Number of nearest neighbors to return

**Returns:**
Array of results with `id`, `distance`, and `metadata` properties.

**Example:**

```typescript
const results = await vectorDb.knn_search([0.1, 0.2, 0.3], 10);
for (const result of results) {
  console.log(`ID: ${result.id}, Distance: ${result.distance}`);
  console.log("Metadata:", result.metadata);
}
```

##### `get_vector(index)`

Retrieves a vector and its metadata by index.

```typescript
async get_vector(idx: number): Promise<{
  point: number[];
  metadata: M | null;
}>
```

##### `deploy(wallet, warp)` (Static)

Deploys a new vector storage contract on Arweave.

```typescript
static async deploy(
  wallet: JWKInterface,
  warp: Warp
): Promise<{ contractTxId: string; srcTxId: string }>
```

### EizenCompatSDK Class

Compatibility layer for legacy contracts using `upsertVectorMulti` instead of standard `setMany`.

```typescript
class EizenCompatSDK extends SetSDK<string> {
  async setMany(keys: string[], values: string[]): Promise<void>;
  async set(key: string, value: string): Promise<void>;
}
```

### Type Definitions

#### KNNResult

```typescript
interface KNNResult<M = unknown> {
  id: number; // Vector index/ID
  distance: number; // Cosine distance from query
  metadata: M | null; // Associated metadata
}
```

#### Point

```typescript
type Point = number[]; // Vector data as array of numbers
```

---

## Architecture Overview

### Multi-Layer Graph Structure

EizenDbVector implements HNSW's hierarchical graph structure:

- **Layer 0**: Contains all vectors with dense local connections
- **Layer 1+**: Contains progressively fewer vectors with long-range connections
- **Entry Point**: Starting node for all search operations

### Storage Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Application   │     │   EizenDbVector  │     │    Arweave      │
│                 │───▶│      (HNSW)      │───▶│   Blockchain    |
│   Your Code     │     │                  │     │   (HollowDB)    │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │   EizenMemory    │
                        │   (Database      │
                        │    Interface)    │
                        └──────────────────┘
```

### Key Components

1. **HNSW Algorithm**: Core approximate nearest neighbor search
2. **EizenMemory**: Database abstraction layer with protobuf encoding
3. **HollowDB Integration**: Blockchain storage interface
4. **Protocol Buffers**: Efficient serialization for vectors and metadata

---

## Advanced Usage

### Custom Metadata Types

Define strongly-typed metadata for better development experience:

```typescript
interface DocumentMetadata {
  id: string;
  title: string;
  author: string;
  timestamp: number;
  tags: string[];
}

const vectorDb = new EizenDbVector<DocumentMetadata>(sdk, options);

await vectorDb.insert([0.1, 0.2, 0.3], {
  id: "doc_123",
  title: "AI Research Paper",
  author: "John Doe",
  timestamp: Date.now(),
  tags: ["machine-learning", "neural-networks"],
});
```

### Batch Operations

For better performance when inserting multiple vectors:

```typescript
// Insert multiple vectors
const vectors = [
  { vector: [0.1, 0.2, 0.3], metadata: { id: "doc1" } },
  { vector: [0.4, 0.5, 0.6], metadata: { id: "doc2" } },
  { vector: [0.7, 0.8, 0.9], metadata: { id: "doc3" } },
];

for (const { vector, metadata } of vectors) {
  await vectorDb.insert(vector, metadata);
}
```

### Advanced Search Patterns

```typescript
// Search with filtering (post-processing)
const results = await vectorDb.knn_search(queryVector, 20);
const filteredResults = results.filter(
  (result) => result.metadata?.category === "research"
);

// Distance-based filtering
const closeResults = results.filter((result) => result.distance < 0.5);

// Multi-query search
const queries = [query1, query2, query3];
const allResults = await Promise.all(
  queries.map((q) => vectorDb.knn_search(q, 10))
);
```

### Working with Different Storage Backends

```typescript
// Using Redis for development/testing
import { Redis } from "ioredis";
import { RedisCache } from "warp-contracts-redis";

const redis = new Redis();
const warp = WarpFactory.forLocal(1984).useKVStorageFactory(
  (contractTxId: string) =>
    new RedisCache(
      { ...defaultCacheOptions, dbLocation: contractTxId },
      { client: redis }
    )
);
```

---

## Performance Tuning

### Parameter Guidelines

| Parameter          | Use Case            | Recommended Value | Impact                        |
| ------------------ | ------------------- | ----------------- | ----------------------------- |
| **m**              | Development/Testing | 5-8               | Faster, less memory           |
| **m**              | Production          | 12-16             | Balanced performance          |
| **m**              | High-Quality Search | 24-48             | Better recall, more memory    |
| **efConstruction** | Fast Building       | 40-100            | Quick indexing                |
| **efConstruction** | Balanced            | 100-200           | Good quality/speed trade-off  |
| **efConstruction** | High Quality        | 200-400           | Slower building, better graph |
| **efSearch**       | Fast Search         | k to 2\*k         | Quick results                 |
| **efSearch**       | Balanced            | 2*k to 5*k        | Good recall                   |
| **efSearch**       | High Recall         | 5*k to 10*k       | Better results, slower        |

### Optimization Strategies

#### For High-Dimensional Data (>100 dimensions)

```typescript
const vectorDb = new EizenDbVector(sdk, {
  m: 24, // More connections for high dimensions
  efConstruction: 300, // Better graph quality
  efSearch: 100, // Higher recall
});
```

#### For Fast Insertion

```typescript
const vectorDb = new EizenDbVector(sdk, {
  m: 8, // Fewer connections
  efConstruction: 80, // Faster building
  efSearch: 30, // Quick searches
});
```

#### For Memory Efficiency

```typescript
const vectorDb = new EizenDbVector(sdk, {
  m: 6, // Minimal connections
  efConstruction: 60, // Lower memory usage
  efSearch: 20, // Efficient searches
});
```

### Performance Monitoring

```typescript
// Measure insertion performance
const insertStart = performance.now();
await vectorDb.insert(vector, metadata);
const insertTime = performance.now() - insertStart;
console.log(`Insert took ${insertTime.toFixed(2)}ms`);

// Measure search performance
const searchStart = performance.now();
const results = await vectorDb.knn_search(query, k);
const searchTime = performance.now() - searchStart;
console.log(`Search took ${searchTime.toFixed(2)}ms`);

// Memory usage estimation
const vectorCount = await getVectorCount(); // Your implementation
const estimatedMemory = vectorCount * m * 8; // Approximate bytes
console.log(
  `Estimated memory: ${(estimatedMemory / 1024 / 1024).toFixed(2)}MB`
);
```

---

## Error Handling

### Common Error Types

```typescript
try {
  await vectorDb.insert(vector, metadata);
} catch (error) {
  if (error.message.includes("Warp must be connected to mainnet")) {
    console.error("Network error: Wrong Warp environment");
  } else if (error.message.includes("Keys and values arrays")) {
    console.error("Data validation error");
  } else {
    console.error("Unexpected error:", error);
  }
}
```

### Retry Logic for Blockchain Operations

```typescript
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      await new Promise((resolve) => setTimeout(resolve, delay * attempt));
    }
  }
  throw new Error("Max retries exceeded");
}

// Usage
await withRetry(() => vectorDb.insert(vector, metadata));
```

### Error Recovery Strategies

```typescript
// Graceful degradation for search failures
async function safeSearch(query: number[], k: number) {
  try {
    return await vectorDb.knn_search(query, k);
  } catch (error) {
    console.warn("Search failed, falling back to cached results:", error);
    return getCachedResults(query, k); // Your fallback implementation
  }
}
```

---

## Best Practices

### 1. Vector Normalization

For cosine distance (default), normalize your vectors:

```typescript
function normalizeVector(vector: number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  return magnitude === 0 ? vector : vector.map((val) => val / magnitude);
}

const normalizedVector = normalizeVector([0.1, 0.2, 0.3]);
await vectorDb.insert(normalizedVector, metadata);
```

### 2. Batch Processing

```typescript
// Process vectors in batches to avoid overwhelming the system
async function insertBatch(
  vectors: Array<{ vector: number[]; metadata: any }>
) {
  const BATCH_SIZE = 10;

  for (let i = 0; i < vectors.length; i += BATCH_SIZE) {
    const batch = vectors.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(({ vector, metadata }) => vectorDb.insert(vector, metadata))
    );

    // Optional: Add delay between batches
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
```

### 3. Connection Management

```typescript
// Reuse SDK instances
const sdk = new SetSDK<string>(wallet, contractTxId, warp);
const vectorDb = new EizenDbVector(sdk, options);

// Keep connections alive for multiple operations
// Don't create new instances for each operation
```

### 4. Metadata Design

```typescript
// Good: Structured, searchable metadata
interface GoodMetadata {
  id: string;
  type: "document" | "image" | "audio";
  timestamp: number;
  tags: string[];
  source: string;
}

// Avoid: Unstructured, large metadata
interface AvoidMetadata {
  [key: string]: any; // Too generic
  largeContent: string; // Avoid large strings in metadata
}
```

### 5. Testing Strategy

```typescript
// Test with known vectors
const testVectors = [
  [1, 0, 0], // x-axis
  [0, 1, 0], // y-axis
  [0, 0, 1], // z-axis
];

// Insert test data
for (let i = 0; i < testVectors.length; i++) {
  await vectorDb.insert(testVectors[i], { id: `test_${i}` });
}

// Verify search results
const results = await vectorDb.knn_search([1, 0, 0], 1);
assert(results[0].metadata.id === "test_0");
```

---

## Troubleshooting

### Poor Search Quality

**Symptoms:** Low recall, missing obvious neighbors

**Solutions:**

- Increase `m` parameter (more connections per node)
- Increase `efConstruction` (better graph during building)
- Increase `efSearch` (larger candidate list during search)
- Verify vector normalization for cosine distance

```typescript
// Debugging search quality
const vectorDb = new EizenDbVector(sdk, {
  m: 32, // Increase connections
  efConstruction: 400, // Better graph quality
  efSearch: 100, // More thorough search
});
```

### Slow Insertions

**Symptoms:** Long build times, timeouts

**Solutions:**

- Decrease `efConstruction`
- Decrease `m`
- Check blockchain network performance
- Use batch insertions

```typescript
// Faster insertion configuration
const vectorDb = new EizenDbVector(sdk, {
  m: 8, // Fewer connections
  efConstruction: 80, // Faster building
  efSearch: 30, // Still reasonable search
});
```

### High Memory Usage

**Symptoms:** Out of memory errors

**Solutions:**

- Decrease `m` (fewer connections)
- Monitor vector count vs available memory
- Consider dimensionality reduction

```typescript
// Memory-efficient configuration
const vectorDb = new EizenDbVector(sdk, {
  m: 6, // Minimal connections
  efConstruction: 60,
  efSearch: 20,
});
```

### Blockchain Connectivity Issues

**Symptoms:** Network timeouts, transaction failures

**Solutions:**

- Verify Warp environment settings
- Check wallet permissions
- Implement retry logic
- Monitor Arweave network status

```typescript
// Debug blockchain connectivity
console.log("Warp environment:", warp.environment);
console.log("Contract ID:", contractTxId);

try {
  const state = await sdk.getState();
  console.log("Contract state accessible:", !!state);
} catch (error) {
  console.error("Contract access failed:", error);
}
```

---

## Examples

### Complete RAG (Retrieval-Augmented Generation) Implementation

```typescript
import { EizenDbVector } from "eizen";

interface DocumentMetadata {
  id: string;
  title: string;
  content: string;
  source: string;
  timestamp: number;
}

class DocumentVectorStore {
  private vectorDb: EizenDbVector<DocumentMetadata>;

  constructor(sdk: SetSDK<string>) {
    this.vectorDb = new EizenDbVector(sdk, {
      m: 16,
      efConstruction: 200,
      efSearch: 50,
    });
  }

  async addDocument(
    content: string,
    embedding: number[],
    metadata: Omit<DocumentMetadata, "timestamp">
  ) {
    const docMetadata: DocumentMetadata = {
      ...metadata,
      timestamp: Date.now(),
    };

    await this.vectorDb.insert(embedding, docMetadata);
  }

  async searchDocuments(queryEmbedding: number[], limit: number = 10) {
    const results = await this.vectorDb.knn_search(queryEmbedding, limit);

    return results.map((result) => ({
      id: result.metadata?.id,
      title: result.metadata?.title,
      content: result.metadata?.content,
      similarity: 1 - result.distance, // Convert distance to similarity
      source: result.metadata?.source,
    }));
  }

  async findSimilarDocuments(documentId: string, limit: number = 5) {
    // Implementation would require storing document vectors
    // This is a conceptual example
    const documentVector = await this.getDocumentVector(documentId);
    return this.searchDocuments(documentVector, limit);
  }

  private async getDocumentVector(documentId: string): Promise<number[]> {
    // Implementation to retrieve document vector by ID
    throw new Error("Not implemented");
  }
}
```

### Image Similarity Search

```typescript
interface ImageMetadata {
  id: string;
  filename: string;
  width: number;
  height: number;
  tags: string[];
  uploadedAt: number;
}

class ImageVectorStore {
  private vectorDb: EizenDbVector<ImageMetadata>;

  constructor(sdk: SetSDK<string>) {
    this.vectorDb = new EizenDbVector(sdk, {
      m: 24, // Higher M for image features
      efConstruction: 300,
      efSearch: 80,
    });
  }

  async addImage(
    imageFeatures: number[],
    metadata: Omit<ImageMetadata, "uploadedAt">
  ) {
    // Normalize image features
    const normalizedFeatures = this.normalizeVector(imageFeatures);

    const imageMetadata: ImageMetadata = {
      ...metadata,
      uploadedAt: Date.now(),
    };

    await this.vectorDb.insert(normalizedFeatures, imageMetadata);
  }

  async findSimilarImages(
    queryFeatures: number[],
    options: {
      limit?: number;
      tags?: string[];
      minSimilarity?: number;
    } = {}
  ) {
    const { limit = 10, tags, minSimilarity = 0.0 } = options;

    const normalizedQuery = this.normalizeVector(queryFeatures);
    const results = await this.vectorDb.knn_search(normalizedQuery, limit * 2);

    return results
      .filter((result) => {
        const similarity = 1 - result.distance;
        if (similarity < minSimilarity) return false;

        if (tags && tags.length > 0) {
          const imageTags = result.metadata?.tags || [];
          return tags.some((tag) => imageTags.includes(tag));
        }

        return true;
      })
      .slice(0, limit)
      .map((result) => ({
        id: result.metadata?.id,
        filename: result.metadata?.filename,
        similarity: 1 - result.distance,
        metadata: result.metadata,
      }));
  }

  private normalizeVector(vector: number[]): number[] {
    const magnitude = Math.sqrt(
      vector.reduce((sum, val) => sum + val * val, 0)
    );
    return magnitude === 0 ? vector : vector.map((val) => val / magnitude);
  }
}
```

### Real-time Recommendation System

```typescript
interface UserInteraction {
  userId: string;
  itemId: string;
  action: "view" | "like" | "purchase";
  timestamp: number;
  rating?: number;
}

interface ItemMetadata {
  id: string;
  title: string;
  category: string;
  price: number;
  features: string[];
}

class RecommendationEngine {
  private vectorDb: EizenDbVector<ItemMetadata>;
  private userProfiles: Map<string, number[]> = new Map();

  constructor(sdk: SetSDK<string>) {
    this.vectorDb = new EizenDbVector(sdk, {
      m: 20,
      efConstruction: 250,
      efSearch: 60,
    });
  }

  async addItem(itemFeatures: number[], metadata: ItemMetadata) {
    await this.vectorDb.insert(itemFeatures, metadata);
  }

  async recordInteraction(interaction: UserInteraction) {
    // Update user profile based on interaction
    // This is a simplified example
    const currentProfile = this.userProfiles.get(interaction.userId) || [];
    // Update logic would be more sophisticated in practice
    this.userProfiles.set(interaction.userId, currentProfile);
  }

  async getRecommendations(
    userId: string,
    options: {
      limit?: number;
      categories?: string[];
      excludeViewed?: boolean;
    } = {}
  ) {
    const { limit = 10, categories, excludeViewed = true } = options;

    const userProfile = this.userProfiles.get(userId);
    if (!userProfile) {
      throw new Error(`User profile not found for ${userId}`);
    }

    const candidates = await this.vectorDb.knn_search(userProfile, limit * 3);

    return candidates
      .filter((result) => {
        if (categories && categories.length > 0) {
          return categories.includes(result.metadata?.category || "");
        }
        return true;
      })
      .slice(0, limit)
      .map((result) => ({
        itemId: result.metadata?.id,
        title: result.metadata?.title,
        score: 1 - result.distance,
        metadata: result.metadata,
      }));
  }
}
```

---

This developer guide provides comprehensive documentation for integrating EizenDbVector into production applications. For additional support, refer to the BACKEND_INTEGRATION_GUIDE.md repository's examples and test files, or consult the HNSW algorithm documentation for deeper algorithmic insights.
