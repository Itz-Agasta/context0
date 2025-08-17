import { z } from "zod";

//This schemas are what Eizen expects

/** Vector embedding array - raw numerical embeddings for Eizen */
export const vectorEmbeddingSchema = z
	.array(z.number())
	.min(1)
	.max(4096) // Support up to 4096 dimensions
	.describe(
		"Vector embedding array - matches Eizen insert(point, metadata) 'point' parameter"
	);

/** Vector metadata - optional structured data attached to embeddings */
export const vectorMetadataSchema = z
	.record(z.any())
	.optional()
	.describe(
		"Optional metadata object - matches Eizen insert(point, metadata) 'metadata' parameter"
	);

/** Insert vector request - combining embeddings with metadata for Eizen storage
Example: Direct Eizen.insert() call:
{
  "vector": [
    -0.28571999073028564, 0.13964000344276428, 0.45123456789012345,
    // ... more embedding values
  ],
  "metadata": {
    "content": "User's favorite color is blue",
    "context": "preference setting",
    "importance": 7,
    "tags": ["preference", "color", "personal"],
    "timestamp": "2025-06-06T14:30:00Z",
    "client": "cursor"
  }
}
*/
export const insertVectorSchema = z
	.object({
		vector: vectorEmbeddingSchema,
		metadata: vectorMetadataSchema,
	})
	.describe("Schema for Eizen.insert(vector, metadata) method");

/** Admin insert vector request - includes optional contractId for admin operations */
export const adminInsertVectorSchema = z
	.object({
		vector: vectorEmbeddingSchema,
		metadata: vectorMetadataSchema,
		contractId: z
			.string()
			.optional()
			.describe(
				"Optional contract ID for admin operations. If not provided, uses EIZEN_CONTRACT_ID from environment"
			),
	})
	.describe(
		"Schema for admin Eizen.insert(vector, metadata) method with optional contractId"
	);

/** Search vector request - semantic search through Eizen vector database
Example: Finding similar memories to "color preferences":
{
  "query": [
    -0.28571999073028564, 0.13964000344276428, 0.45123456789012345,
    // ... embedding values for "color preferences" query
  ],
  "k": 5
}
*/
export const searchVectorSchema = z
	.object({
		query: vectorEmbeddingSchema,
		k: z.number().int().min(1).max(50).default(10),
	})
	.describe("Schema for Eizen.knn_search(query, k) method");

/** Admin search vector request - includes optional contractId for admin operations */
export const adminSearchVectorSchema = z
	.object({
		query: vectorEmbeddingSchema,
		k: z.number().int().min(1).max(50).default(10),
		contractId: z
			.string()
			.optional()
			.describe(
				"Optional contract ID for admin operations. If not provided, uses EIZEN_CONTRACT_ID from environment"
			),
	})
	.describe(
		"Schema for admin Eizen.knn_search(query, k) method with optional contractId"
	);

export type VectorEmbedding = z.infer<typeof vectorEmbeddingSchema>;
export type VectorMetadata = z.infer<typeof vectorMetadataSchema>;
export type InsertVector = z.infer<typeof insertVectorSchema>;
export type SearchVector = z.infer<typeof searchVectorSchema>;
export type AdminInsertVector = z.infer<typeof adminInsertVectorSchema>;
export type AdminSearchVector = z.infer<typeof adminSearchVectorSchema>;
