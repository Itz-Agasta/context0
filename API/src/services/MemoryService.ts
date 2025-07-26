import type { SearchFilters } from "../schemas/common.js";
import type { VectorMetadata } from "../schemas/eizen.js";
import type { CreateMemory, SearchMemory } from "../schemas/memory.js";
import type { EizenService } from "./EizenService.js";
import { embeddingService } from "./EmbeddingService.js";

export interface MemoryResult {
	id: number;
	content?: string;
	metadata?: VectorMetadata;
	distance?: number;
}

export interface CreateMemoryResult {
	success: boolean;
	memoryId: number;
	message: string;
}

export interface MemoryStats {
	totalMemories: number;
	embeddingService: "xenova" | "unavailable";
	isInitialized: boolean;
}

/**
 * MemoryService - Core service for semantic memory storage and retrieval via ArchiveNET API
 *
 * This service provides a high-level interface for:
 * - Converting text into searchable vector embeddings
 * - Storing memories with rich metadata
 * - Performing semantic similarity searches
 * - Managing memory lifecycle and statistics
 *
 * Architecture:
 * Text Input → EmbeddingService → Vector → EizenService → Storage
 * Text Query → EmbeddingService → Vector → EizenService → Similar Memories
 *
 * @example
 * ```typescript
 * // Create memory service for a specific user
 * const userEizenService = await EizenService.forContract(userContractId);
 * const memoryService = new MemoryService(userEizenService);
 *
 * // Create a memory
 * const result = await memoryService.createMemory({
 *   content: "User prefers dark mode",
 *   metadata: { tags: ["preference"], importance: 8 }
 * });
 *
 * // Search memories
 * const memories = await memoryService.searchMemories({
 *   query: "user interface preferences",
 *   k: 5
 * });
 * ```
 */
export class MemoryService {
	private eizenService: EizenService;

	/**
	 * Creates a new MemoryService instance for a specific user
	 *
	 * @param eizenService - User-specific EizenService instance
	 */
	constructor(eizenService: EizenService) {
		this.eizenService = eizenService;
	}
	/**
	 * Creates a new memory from text content
	 *
	 * Process:
	 * 1. Converts text to vector embeddings using Xenova transformers
	 * 2. Enhances metadata with system information
	 * 3. Stores the vector in Eizen vector database
	 *
	 * @param data - Memory creation parameters
	 * @param data.content - The text content to store as memory
	 * @param data.metadata - Optional metadata (tags, importance, etc.)
	 * @returns Promise resolving to creation result with new memory ID
	 *
	 * @throws {Error} When embedding generation or storage fails
	 *
	 * @example
	 * ```typescript
	 * const memory = await memoryService.createMemory({
	 *   content: "Client mentioned they work remotely on Fridays",
	 *   metadata: {
	 *     tags: ["work-schedule", "client-info"],
	 *     importance: 7,
	 *     client: "cursor"
	 *   }
	 * });
	 * ```
	 */
	async createMemory(data: CreateMemory): Promise<CreateMemoryResult> {
		try {
			console.log(
				`Creating memory from ${data.content.length} characters of content`,
			);

			// Step 1: Convert human-readable text into numerical vectors
			// This enables semantic similarity matching later
			// NOTE: For now we are only embedding the content. Metadata embedding is still in consideration
			const embeddings = await this.textToEmbeddings(data.content);

			// Step 2: Enhance user-provided metadata with system metadata
			// This ensures we have audit trail and content reference. More key-values can be added later
			const enhancedMetadata: VectorMetadata = {
				...data.metadata,
				content: data.content,
			};
			// Step 3: Store the vector and metadata in Eizen vector database
			const result = await this.eizenService.insertVector({
				vector: embeddings, // currently API received content == vector // metadata != vector
				metadata: enhancedMetadata,
			});

			console.log(`Memory created successfully with ID: ${result.vectorId}`);

			return {
				success: true,
				memoryId: result.vectorId,
				message: `Memory created from ${data.content.length} characters of content`,
			};
		} catch (error) {
			console.error("Failed to create memory:", error);
			throw new Error(
				`Failed to create memory: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * Searches memories using natural language queries
	 *
	 * Uses semantic similarity to find relevant memories even when
	 * exact keywords don't match. For example, searching "coffee"
	 * might return memories about "espresso" or "caffeine".
	 *
	 * Process:
	 * 1. Converts search query to vector embeddings
	 * 2. Performs similarity search in vector space
	 * 3. Applies optional filters (tags, dates, etc.)
	 * 4. Returns ranked results by similarity
	 *
	 * @param data - Search parameters
	 * @param data.query - Natural language search query
	 * @param data.k - Maximum number of results to return
	 * @param data.filters - Optional filters for metadata
	 * @returns Promise resolving to array of matching memories
	 *
	 * @throws {Error} When embedding generation or search fails
	 *
	 * @example
	 * ```typescript
	 * const results = await memoryService.searchMemories({
	 *   query: "client communication preferences",
	 *   k: 10,
	 *   filters: {
	 *     tags: ["client-info"],
	 *     importance_min: 5,
	 *     date_from: "2024-01-01"
	 *   }
	 * });
	 * ```
	 */
	async searchMemories(data: SearchMemory): Promise<MemoryResult[]> {
		try {
			console.log(`Searching memories with query: "${data.query}"`);

			// Step 1: Convert search query into the same vector space as stored memories
			// This enables semantic comparison (similarity matching)
			const queryEmbeddings = await this.textToEmbeddings(data.query);

			// Step 2: Perform vector similarity search in Eizen
			// Uses cosine similarity or similar algorithms to find closest matches
			const searchResults = await this.eizenService.searchVectors({
				query: queryEmbeddings,
				k: data.k || 10, // Limit number of results (default is 10)
			});

			// Step 3: Transform Eizen results into our memory format
			// Extract content from metadata for easier access
			const memories: MemoryResult[] = searchResults.map((result) => ({
				id: result.id,
				content: (result.metadata?.content as string) || undefined,
				metadata: result.metadata,
				distance: result.distance,
			}));

			// Step 4: Apply additional filters based on metadata
			// This allows filtering by tags, dates, importance, etc.
			// NOTE: Still theoretical. may not work properly
			const filteredMemories = this.applyFilters(memories, data.filters);

			console.log(`Found ${filteredMemories.length} relevant memories`);

			return filteredMemories;
		} catch (error) {
			console.error("Failed to search memories:", error);
			throw new Error(
				`Failed to search memories: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * Retrieves a specific memory by its unique identifier
	 *
	 * Used when user have a memory ID and need to fetch its full content
	 * and metadata. Unlike search, this is a direct lookup operation.
	 *
	 * @param memoryId - The unique ID of the memory to retrieve
	 * @returns Promise resolving to memory data or null if not found
	 *
	 * @throws {Error} When retrieval operation fails
	 *
	 * @example
	 * ```typescript
	 * const memory = await memoryService.getMemory(123);
	 * if (memory) {
	 *   console.log(`Memory content: ${memory.content}`);
	 * }
	 * ```
	 */
	async getMemory(memoryId: number): Promise<MemoryResult | null> {
		try {
			console.log(`Retrieving memory with ID: ${memoryId}`);

			// Direct lookup in Eizen by vector ID
			const vector = await this.eizenService.getVector(memoryId);

			if (!vector) {
				return null;
			}

			// Transform Eizen vector into our memory format
			return {
				id: memoryId,
				content: (vector.metadata?.content as string) || undefined,
				metadata: vector.metadata,
			};
		} catch (error) {
			console.error(`Failed to retrieve memory ${memoryId}:`, error);
			throw new Error(
				`Failed to retrieve memory: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * Retrieves system statistics and health information
	 *
	 * Useful for monitoring, debugging, and displaying system status
	 * to users. Aggregates data from both Eizen and embedding services.
	 *
	 * @returns Promise resolving to current system statistics
	 *
	 * @example
	 * ```typescript
	 * const stats = await memoryService.getStats();
	 * console.log(`Total memories: ${stats.totalMemories}`);
	 * console.log(`System ready: ${stats.isInitialized}`);
	 * ```
	 *
	 * @TODO Need further work (Probably wrote it in diff file)
	 */
	async getStats(): Promise<MemoryStats> {
		try {
			const eizenStats = await this.eizenService.getStats();
			const embeddingInfo = embeddingService.getInfo();

			return {
				totalMemories: eizenStats.totalVectors,
				embeddingService: embeddingInfo.isInitialized
					? "xenova"
					: "unavailable",
				isInitialized: eizenStats.isInitialized && embeddingInfo.isInitialized,
			};
		} catch (error) {
			console.error("Failed to get memory stats:", error);
			return {
				totalMemories: 0,
				embeddingService: "unavailable",
				isInitialized: false,
			};
		}
	}

	// ============================================================================
	// Internal Helper Functions
	// These methods support the main public API but are not intended to be used
	// directly by external callers.
	// ============================================================================

	/**
	 * Converts text content into numerical vector embeddings
	 *
	 * This is the core ML operation that enables semantic search.
	 * Uses transformer models (via Xenova) to create high-dimensional
	 * vectors that capture semantic meaning of text.
	 *
	 * @private This is an internal helper method
	 * @param text - The text content to vectorize
	 * @returns Promise resolving to numerical embedding array
	 *
	 * @throws {Error} When embedding generation fails
	 */
	private async textToEmbeddings(text: string): Promise<number[]> {
		try {
			console.log("Converting text to embeddings using Xenova/transformers");

			const result = await embeddingService.textToEmbeddings(text);
			return result.embeddings;
		} catch (error) {
			console.error("Failed to generate embeddings:", error);
			throw new Error(
				`Failed to generate embeddings: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * Applies metadata-based filters to search results
	 *
	 * Filters allow users to narrow down search results based on:
	 * - Tags (categories, labels)
	 * - Importance level (numerical rating)
	 * - Client/source information
	 * - Date ranges (creation or custom timestamps)
	 *
	 * @private This is an internal helper method
	 * @param memories - Array of memory results to filter
	 * @param filters - Optional filter criteria
	 * @returns Filtered array of memories
	 */
	private applyFilters(
		memories: MemoryResult[],
		filters?: SearchFilters,
	): MemoryResult[] {
		// If no filters provided, return all results unchanged
		if (!filters) {
			return memories;
		}

		return memories.filter((memory) => {
			// Skip filtering if memory has no metadata
			if (!memory.metadata) return true;

			// Filter by tags - check if memory has any of the requested tags
			if (filters.tags && Array.isArray(filters.tags)) {
				const memoryTags = (memory.metadata.tags as string[]) || [];
				const hasRequiredTags = filters.tags.some((tag: string) =>
					memoryTags.includes(tag),
				);
				if (!hasRequiredTags) return false;
			}

			// Filter by minimum importance level
			if (
				filters.importance_min !== undefined &&
				filters.importance_min !== null &&
				typeof filters.importance_min === "number"
			) {
				const importance = (memory.metadata.importance as number) || 0;
				if (importance < filters.importance_min) return false;
			}

			// Filter by client - partial string matching
			if (filters.client && typeof filters.client === "string") {
				const client = (memory.metadata.client as string) || "";
				if (!client.includes(filters.client)) return false;
			}

			// Filter by date range - check creation date or custom timestamp
			if (filters.date_from || filters.date_to) {
				const timestamp =
					(memory.metadata.timestamp as string) ||
					(memory.metadata.createdAt as string);
				if (timestamp) {
					const memoryDate = new Date(timestamp);
					// Check if memory is after start date
					if (filters.date_from && memoryDate < new Date(filters.date_from))
						return false;
					// Check if memory is before end date
					if (filters.date_to && memoryDate > new Date(filters.date_to))
						return false;
				}
			}

			return true;
		});
	}
}
