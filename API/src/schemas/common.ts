import { z } from "zod";

// Basic field validations for context0 system
export const uuidSchema = z.string().uuid();
export const emailSchema = z.string().email();
export const arweaveTransactionIdSchema = z.string().length(43); // Arweave TX IDs are exactly 43 chars
export const apiKeySchema = z.string(); // API key

// Memory metadata schema - structured metadata for AI memories
export const memoryMetadataSchema = z
	.object({
		context: z.string().optional(), // "preference setting", "casual conversation"
		importance: z.number().int().min(1).max(10).optional(), // 1-10 importance score
		tags: z.array(z.string()).optional(), // ["preference", "color", "personal" etc....]
		timestamp: z.string().datetime().optional(), // ISO 8601 timestamp
		client: z.string().optional().default("unknown"), // Conversation identifier
	})
	.describe("Structured metadata for AI memory storage that Api will received");

// Search filters for memory queries
export const searchFiltersSchema = z
	.object({
		tags: z.array(z.string()).optional(), // Filter by specific tags
		importance_min: z.number().int().min(1).max(10).optional(),
		importance_max: z.number().int().min(1).max(10).optional(),
		date_from: z.string().datetime().optional(), // Search from date
		date_to: z.string().datetime().optional(), // Search to date
		context: z.string().optional(), // Filter by context
		client: z.string().optional(), // Filer by client name (cursor, claude, copilot etc...)
	})
	.describe("Filters for memory search queries");

export type UUID = z.infer<typeof uuidSchema>;
export type Email = z.infer<typeof emailSchema>;
export type ArweaveTransactionId = z.infer<typeof arweaveTransactionIdSchema>;
export type ApiKey = z.infer<typeof apiKeySchema>;
export type MemoryMetadata = z.infer<typeof memoryMetadataSchema>;
export type SearchFilters = z.infer<typeof searchFiltersSchema>;
