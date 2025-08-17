# HNSW Algorithm Deep Dive

## Table of Contents

1. [Introduction](#introduction)
2. [Core Concepts](#core-concepts)
3. [Algorithm Walkthrough](#algorithm-walkthrough)
4. [Implementation Details](#implementation-details)
5. [Performance Analysis](#performance-analysis)
6. [Troubleshooting](#troubleshooting)

## Introduction

Hierarchical Navigable Small Worlds (HNSW) is a graph-based algorithm for approximate nearest neighbor search that achieves excellent performance on high-dimensional data. This guide provides a comprehensive understanding of how our implementation works.

### Why HNSW?

Traditional approaches to similarity search include:

- **Linear scan**: O(N) - accurate but slow
- **Tree-based methods**: Break down in high dimensions (curse of dimensionality)
- **LSH**: Fast but requires careful tuning and may miss neighbors
- **HNSW**: O(log N) with high recall and robust performance

## Core Concepts

### 1. Multi-Layer Graph Structure

Think of HNSW as a skyscraper:

- **Ground floor (Layer 0)**: Contains all points, densely connected to nearby neighbors
- **Upper floors (Layer 1+)**: Contain fewer points, connected across longer distances
- **Elevator (Search)**: Start at the top, navigate down to find your destination

```
Layer 2: [    •         •    ]  <- Sparse, long connections
Layer 1: [  • • •   •   • •  ]  <- Medium density
Layer 0: [• • • • • • • • • •]  <- All points, dense local connections
```

### 2. Probabilistic Layer Assignment

When inserting a new point, we randomly decide which layers it belongs to:

- ~50% of points exist only in Layer 0
- ~25% of points reach Layer 1
- ~12.5% of points reach Layer 2
- And so on...

This creates the hierarchical structure naturally.

### 3. Entry Point

The entry point is the single node in the highest layer that serves as the starting point for all searches. It's like the "lobby" of our skyscraper.

## Algorithm Walkthrough

### Insertion Process

Let's walk through inserting a new point `q`:

1. **Layer Selection**: Randomly determine `l = 2` (point will exist in layers 0, 1, 2)

2. **Find Entry Point**: Start from current entry point in top layer

   ```
   Layer 2: EP → • → • → closest_to_q
   ```

3. **Navigate Down**: Use greedy search to find best entry point for each layer

   ```
   Layer 1: closest_from_layer2 → • → • → even_closer_to_q
   Layer 0: even_closer_from_layer1 → • → final_neighbors
   ```

4. **Connect in Each Layer**: For each layer from `l` down to 0:
   - Find `ef_construction` candidates near `q`
   - Select best `M` neighbors using selection heuristic
   - Create bidirectional connections
   - Prune existing connections if needed

### Search Process

To find the 5 nearest neighbors to query `q`:

1. **Routing Phase** (Layers 2 → 1):

   ```
   Start: entry_point
   Layer 2: entry_point → closest_in_layer2 (greedy, ef=1)
   Layer 1: closest_in_layer2 → closest_in_layer1 (greedy, ef=1)
   ```

2. **Search Phase** (Layer 0):
   ```
   Layer 0: closest_in_layer1 → expand with ef=50 → top 5 results
   ```

## Implementation Details

### Key Data Structures

#### NodeHeap

```typescript
// Min-heap for managing candidates during search
const candidates = new NodeHeap();
candidates.push([distance, point_id]);
const closest = candidates.pop(); // [smallest_distance, point_id]
```

#### Graph Storage

```typescript
// Layer 1 connections for point 42
const neighbors: LayerNode = {
  15: 0.23, // Point 15 is distance 0.23 away
  27: 0.31, // Point 27 is distance 0.31 away
  8: 0.19, // Point 8 is distance 0.19 away
};
```

### Critical Algorithms

#### Algorithm 1: INSERT

```typescript
async insert(q: Point, metadata?: M) {
  // 1. Select layer for new point
  const l = select_layer();

  // 2. Add point to database
  const idx = await db.new_point(q);

  // 3. Find entry point through upper layers
  let ep = await find_entry_point(q, from_layer: L, to_layer: l+1);

  // 4. Insert into each layer l down to 0
  for (let layer = min(L, l); layer >= 0; layer--) {
    // Find candidates
    const candidates = await search_layer(q, ep, ef_construction, layer);

    // Select best neighbors
    const neighbors = select_neighbors(q, candidates, layer);

    // Create bidirectional connections & prune if needed
    await connect_and_prune(q, neighbors, layer);

    // Update entry point for next layer
    ep = candidates;
  }
}
```

#### Algorithm 2: SEARCH_LAYER

```typescript
async search_layer(q: Point, entry_points: Node[], ef: number, layer: number) {
  const visited = new Set();
  const candidates = new NodeHeap(entry_points);  // Min-heap
  const results = new NodeHeap();                 // Max-heap (negated distances)

  while (!candidates.isEmpty()) {
    const current = candidates.pop();

    // Stop if current candidate is further than worst result
    if (current.distance > results.worst_distance) break;

    // Explore neighbors
    for (const neighbor of await get_neighbors(current.id, layer)) {
      if (!visited.has(neighbor.id)) {
        visited.add(neighbor.id);

        if (neighbor.distance < results.worst_distance || results.size < ef) {
          candidates.push(neighbor);
          results.push(neighbor);

          // Keep only best ef results
          if (results.size > ef) results.pop();
        }
      }
    }
  }

  return results.all();
}
```

### Distance Functions

Our implementation uses **cosine distance** by default:

```typescript
cosine_distance(a, b) = 1 - (a·b) / (||a|| × ||b||)
```

**Why cosine distance?**

- Focuses on angle between vectors, not magnitude
- Works well with normalized embeddings
- Less affected by curse of dimensionality
- Range [0, 2]: 0=identical, 1=orthogonal, 2=opposite

## Performance Analysis

### Time Complexity

| Operation | Expected | Worst Case | Notes                         |
| --------- | -------- | ---------- | ----------------------------- |
| Insert    | O(log N) | O(N)       | Depends on graph connectivity |
| Search    | O(log N) | O(N)       | ef parameter affects constant |
| Space     | O(M × N) | O(M × N)   | M = avg connections per node  |

### Memory Usage

For N=1M points with M=16:

- **Graph structure**: ~16M edges × 8 bytes = 128MB
- **Vector data**: 1M × D × 4 bytes (D=dimension)
- **Metadata**: Variable depending on your data

### Performance Tips

1. **For high recall**: Increase `ef` during search
2. **For fast building**: Decrease `ef_construction`
3. **For memory efficiency**: Decrease `M`
4. **For high dimensions**: Increase `M` and `ef_construction`

## Troubleshooting

### Common Issues

#### Poor Search Quality

**Symptoms**: Low recall, missing obvious neighbors
**Solutions**:

- Increase `M` (more connections per node)
- Increase `ef_construction` (better graph during building)
- Increase `ef` during search (larger candidate list)
- Check if vectors are normalized (for cosine distance)

#### Slow Insertions

**Symptoms**: Long build times, timeouts during insertion
**Solutions**:

- Decrease `ef_construction`
- Decrease `M`
- Check database performance (batch operations)
- Consider inserting in smaller batches

#### High Memory Usage

**Symptoms**: Out of memory errors, slow performance
**Solutions**:

- Decrease `M` (fewer connections)
- Use quantization techniques
- Consider dimensionality reduction
- Optimize database storage format

#### Inconsistent Results

**Symptoms**: Different results for same query
**Solutions**:

- Check for race conditions in concurrent access
- Verify database consistency
- Ensure deterministic distance calculations

### Debugging Tools

```typescript
// Check graph connectivity
const stats = await analyzeGraph();
console.log(`Avg connections per node: ${stats.avgDegree}`);
console.log(`Disconnected components: ${stats.components}`);

// Profile search performance
const start = performance.now();
const results = await hnsw.knn_search(query, k);
console.log(`Search took ${performance.now() - start}ms`);

// Verify distance calculations
const dist1 = cosine_distance(a, b);
const dist2 = cosine_distance(b, a);
assert(Math.abs(dist1 - dist2) < 1e-10); // Should be symmetric
```

### Parameter Tuning Workflow

1. **Start with defaults**: M=16, ef_construction=200, ef=50
2. **Build small index**: Test with 1K-10K points
3. **Measure recall**: Compare with brute force results
4. **Adjust parameters**:
   - Low recall → increase M, ef_construction, ef
   - Slow search → decrease ef
   - Slow build → decrease ef_construction
5. **Scale test**: Verify performance with full dataset

## Further Reading

- [Original HNSW Paper](https://arxiv.org/pdf/1603.09320.pdf)
- [HNSW in Practice](https://www.pinecone.io/learn/hnsw/)
- [Vector Database Benchmarks](https://ann-benchmarks.com/)
- [High-Dimensional Similarity Search](https://dl.acm.org/doi/10.1145/3347146)
