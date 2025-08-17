# Eizen - HNSW Vector Database Engine for Context0

## Overview

Eizen is a high-performance vector database engine for Context0 built on Arweave that implements the Hierarchical Navigable Small Worlds (HNSW) algorithm for approximate nearest neighbor search. It provides efficient vector storage, similarity search, and metadata management with blockchain-based persistence.

## Key Features

- **HNSW Algorithm**: State-of-the-art approximate nearest neighbor search with O(log N) complexity
- **Blockchain Storage**: Persistent vector storage on Arweave with HollowDB integration
- **Protobuf Encoding**: Efficient serialization for optimal storage and network transfer
- **Metadata Support**: Rich metadata attachment to vectors for enhanced search capabilities
- **Flexible Interface**: Database-agnostic interface supporting multiple storage backends
- **Scalable**: Handles millions of high-dimensional vectors efficiently

## HNSW Implementation

### Algorithm Overview

The Hierarchical Navigable Small Worlds (HNSW) algorithm creates a multi-layer graph structure:

- **Layer 0**: Contains all vectors with dense local connections
- **Higher Layers**: Contain progressively fewer vectors with long-range connections
- **Search Process**: Navigate from top to bottom for logarithmic search complexity

### Core Components

#### 1. HNSW Class (`src/hnsw.ts`)

The main implementation containing:

- **`insert()`**: Add new vectors with metadata (Algorithm 1)
- **`knn_search()`**: Find k nearest neighbors (Algorithm 5)
- **`search_layer()`**: Core search primitive (Algorithm 2)
- **`select_neighbors()`**: Neighbor selection heuristic (Algorithm 4)

#### 2. Database Interface (`src/db/interfaces/`)

Abstraction layer supporting different storage backends:

- Point storage and retrieval
- Graph structure management
- Metadata operations
- Entry point tracking

#### 3. Utility Functions (`src/utils/`)

Mathematical operations and data structures:

- Distance functions (cosine, euclidean)
- Priority queues for search algorithms
- Vector operations (dot product, norm)

## Usage

You can create the VectorDB as follows:

```typescript
import { EizenDbVector } from "eizen";
import { WarpFactory, defaultCacheOptions } from "warp-contracts";
import { SetSDK } from "hollowdb";
import { Redis } from "ioredis";
import { RedisCache } from "warp-contracts-redis";
import { readFileSync } from "fs";

// connect to Redis
const redis = new Redis();

// create Warp instance with Redis cache
const warp = WarpFactory.forMainnet().useKVStorageFactory(
  (contractTxId: string) =>
    new RedisCache(
      { ...defaultCacheOptions, dbLocation: `${contractTxId}` },
      { client: redis }
    )
);

// create HollowDB SDK
const wallet = JSON.parse(readFileSync("./path/to/wallet.json", "utf-8"));
const contractTxId = "your-contract-tx-id";
const hollowdb = new SetSDK<string>(wallet, contractTxId, warp);

// create Eizen Vector with advanced HNSW parameters
const vectordb = new EizenDbVector(hollowdb, {
  m: 16, // connections per node (default: 5)
  efConstruction: 200, // build quality (default: 128)
  efSearch: 50, // search quality (default: 20)
});
```

### Inserting a Vector

With this, you can insert a new point:

```typescript
const point = [
  -0.28571999073028564 /* and many more... */, 0.13964000344276428,
];

// any object
const metadata = {
  name: "My favorite vector!",
  category: "research",
  filename: "document.pdf",
};

// insert a point
await vectordb.insert(point, metadata);
```

Metadata is optional, and you can leave it out during insert.

> [!NOTE]
> The complexity of inserting a point may increase with more points in the DB.

### Fetching a Vector

You can get a vector by its index, which returns its point value and metadata:

```typescript
const { point, metadata } = await vectordb.get_vector(index);
```

### Querying a Vector

You can make a query and return top K relevant results:

```typescript
// a query point
const query = [
  -0.28571999073028564 /* and many more... */, 0.13964000344276428,
];

// number of top results to return
const K = 10;

// make a KNN search
const results = await vectordb.knn_search(query, K);

// each result contains the vector id, its distance to query, and metadata
const { id, distance, metadata } = results[0];
```

### Deploying your own Contract

Eizen Vector exports a static function that allows you two deploy a new contract that you own. Assuming that you have a wallet and a warp instance as described above, you can create a new contract with:

```typescript
const { contractTxId } = await EizenDbVector.deploy(wallet, warp);
console.log("Deployed at:", contractTxId);
```

### Parameter Tuning Guide

| Parameter           | Purpose                    | Recommended Range      | Impact                                |
| ------------------- | -------------------------- | ---------------------- | ------------------------------------- |
| **M**               | Connections per node       | 5-48 (default: 5)      | Higher = better quality, more memory  |
| **ef_construction** | Build candidate list size  | 100-400 (default: 128) | Higher = better graph, slower build   |
| **ef_search**       | Search candidate list size | >= K (default: 20)     | Higher = better recall, slower search |

### Performance Characteristics

- **Time Complexity**: O(log N) for both insertion and search
- **Space Complexity**: O(M × N) where M is average connections per node
- **Scalability**: Efficiently handles millions of high-dimensional vectors
- **Distance Function**: Currently uses cosine distance (configurable)

## Installation

Install the package from npm:

```bash
npm install eizen
```

## Advanced Examples

### Vector Database with Express.js Backend

```typescript
import express from "express";
import { EizenDbVector } from "eizen";
import { SetSDK } from "hollowdb";
import { WarpFactory } from "warp-contracts";
import { readFileSync } from "fs";

const app = express();
app.use(express.json());

// Initialize vector database with blockchain storage
const warp = WarpFactory.forMainnet(); // or forTestnet() for testing

// Load your Arweave wallet (choose one method):
// Option 1: From file
const wallet = JSON.parse(readFileSync("./path/to/wallet.json", "utf-8"));
// Option 2: Generate new wallet
// const wallet = await warp.arweave.wallets.generate();

const contractTxId = "your-contract-transaction-id";
const sdk = new SetSDK<string>(wallet, contractTxId, warp);

const db = new EizenDbVector(sdk);

// Add vector endpoint
app.post("/vectors", async (req, res) => {
  const { vector, metadata } = req.body;
  await db.insert(vector, metadata);
  res.json({ success: true });
});

// Search vectors endpoint
app.get("/search", async (req, res) => {
  const { vector, k = 10 } = req.query;
  const results = await db.knn_search(JSON.parse(vector as string), Number(k));
  res.json(results);
});

app.listen(3000, () => {
  console.log("Vector database server running on port 3000");
});
```

### Production Deployment with Arweave Backend

```typescript
import { EizenDbVector } from "eizen";
import { SetSDK } from "hollowdb";
import { WarpFactory } from "warp-contracts";
import { readFileSync } from "fs";

// Connect to existing contract
const warp = WarpFactory.forMainnet(); // or forTestnet()

// Load your Arweave wallet
const wallet = JSON.parse(readFileSync("./path/to/wallet.json", "utf-8"));

const contractTxId = "your-contract-transaction-id";
const sdk = new SetSDK<string>(wallet, contractTxId, warp);

// Initialize with Arweave backend
const db = new EizenDbVector(sdk);

// Insert vectors with blockchain persistence
await db.insert([0.1, 0.2, 0.3], { id: "doc1", title: "Document 1" });
await db.insert([0.4, 0.5, 0.6], { id: "doc2", title: "Document 2" });

// Search for similar vectors
const results = await db.knn_search([0.1, 0.2, 0.35], 5);
console.log("Similar documents:", results);
```

## Installation (Development)

1. Clone the repository:

   ```bash
   git clone https://github.com/Itz-Agasta/Eizendb.git
   ```

2. Navigate to the project directory:

   ```bash
   cd Eizendb
   ```

3. Install dependencies:

   ```bash
   pnpm install
   ```

4. Build the project:
   ```bash
   pnpm run build
   ```

## Development

### Testing

The project includes comprehensive tests covering different aspects:

```bash
# Run all tests (local development)
npm run test:local

# Run tests for CI (excludes Python tests)
npm run test:ci

# Run only TypeScript tests
npm test

# Run specific test suites
npm run test:heap     # Heap data structure tests
npm run test:hnsw     # Core HNSW algorithm tests
npm run test:proto    # Protocol buffer serialization tests
npm run test:eizen    # Full blockchain integration tests

# Run Python reference implementation
npm run test:python # After setting up the python env.

# Additional development commands
npm run test:ui       # Interactive test UI
npm run coverage      # Generate test coverage report
npm run check         # Code formatting and linting
```

#### Test Structure

- **`test/heap.test.ts`**: Tests the heap data structure used in HNSW
- **`test/proto.test.ts`**: Tests Protocol Buffer serialization
- **`test/hnsw.test.ts`**: Tests the core HNSW algorithm with different storage backends
- **`test/eizen.test.ts`**: Integration tests with Arweave blockchain and Redis
- **`test/python.test.ts`**: Python reference implementation validation (skipped in CI)

#### Python Reference Implementation

The `test/python/` directory contains a Python implementation of the HNSW algorithm that serves as the ground truth for validation. This requires Python and `uv` to be installed:

```bash
# Setup Python environment (one-time)
cd test/python
uv sync

# Run Python reference implementation
uv run main.py
```

**Note**: For some reason `ArLocal` doesn't work with `pnpm`, so the `eizen.test.ts` will fail. That's why for testing `npm` is recommended. If you are using pnpm, you can switch to npm with:

```bash
pnpm run use-npm
```

## Architecture

```
src/
├── hnsw.ts              # Main HNSW implementation
├── types/               # TypeScript type definitions
├── utils/               # Utility functions and data structures
├── db/                  # Database abstraction layer
│   ├── interfaces/      # Database interface definitions
│   ├── common/          # Common database utilities
│   └── index.ts         # EizenMemory implementation
├── codec.ts             # Protobuf encoding/decoding
└── index.ts             # Main exports

docs/                    # Additional documentation
├── BACKEND_INTEGRATION_GUIDE.md  # Backend integration examples
├── DEVELOPER_GUIDE.md             # Development guidelines
└── HNSW_GUIDE.md                  # HNSW algorithm details

test/                    # Test suite
├── *.test.ts           # Unit and integration tests
├── data/               # Test data and fixtures
├── db/                 # Database test utilities
└── python/             # Python reference implementation
```

## Documentation

For detailed information, check out our comprehensive guides:

- **[HNSW Guide](docs/HNSW_GUIDE.md)**: Deep dive into the HNSW algorithm implementation
- **[Developer Guide](docs/DEVELOPER_GUIDE.md)**: Development setup and contribution guidelines
- **[Backend Integration Guide](docs/BACKEND_INTEGRATION_GUIDE.md)**: Examples for integrating with different backends

## References

- [HNSW Paper](https://arxiv.org/pdf/1603.09320.pdf): "Efficient and robust approximate nearest neighbor search using Hierarchical Navigable Small World graphs" by Malkov & Yashunin
- [Arweave](https://www.arweave.org/): Permanent data storage blockchain

## Contributing

We welcome contributions! Please see our contributing guidelines:

1. Fork the repository
2. Create a feature branch
3. Add comprehensive tests
4. Update documentation
5. Submit a pull request

### Code Style

- Use TypeScript for type safety
- Follow existing code formatting (Biome)
- Add JSDoc comments for public APIs
- Include performance considerations in code reviews

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
