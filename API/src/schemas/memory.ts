import { z } from "zod";
import { memoryMetadataSchema, searchFiltersSchema } from "./common.js";

// This schemas are what Context0 api expects

/** Memory creation request - what MCP server sends to API
POST https://api.context0.com/memories
Authorization: Bearer ak_1234567890abcdef (API key)
Content-Type: application/json

{
  "content": "User's favorite color is blue",
  "metadata": {
    "context": "preference setting",
    "importance": 7,
    "tags": ["preference", "color", "personal"],
    "timestamp": "2025-06-06T14:30:00Z",
    "client": "cursor"
  }
}
*/

export const createMemorySchema = z
	.object({
		content: z.string().min(1).max(10000), // Text content to convert to embeddings
		metadata: memoryMetadataSchema.optional(), // Rich metadata from MCP server
	})
	.describe(
		"API request to create new memory - content will be converted to embeddings and stored via Eizen",
	);

/** Memory search request - for semantic search through user's memories
GET https://api.context0.com/memories/search
Authorization: Bearer ak_1234567890abcdef (API key)
Content-Type: application/json

{
  "query": "favorite color preference",
  "k"(limit): 5,
  "filters": {
    "tags": ["preference", "color"],
    "importance_min": 5
  }
}
*/
export const searchMemorySchema = z
	.object({
		query: z.string().min(1).max(1000), // General text
		k: z.number().int().min(1).max(100).default(10), // number of results Agent will received
		filters: searchFiltersSchema.optional(), // Optional search filters
	})
	.describe(
		"Semantic search request - query gets converted to embeddings for Eizen.knn_search()",
	);

export type CreateMemory = z.infer<typeof createMemorySchema>;
export type SearchMemory = z.infer<typeof searchMemorySchema>;