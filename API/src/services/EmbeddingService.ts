import { pipeline } from "@xenova/transformers";
import type { VectorEmbedding } from "../schemas/eizen.js";

type EmbeddingPipeline = (
	texts: string[],
	options?: { pooling?: string; normalize?: boolean },
) => Promise<{
	data: Float32Array | number[];
	dims: number[];
}>;

export interface EmbeddingResult {
	embeddings: VectorEmbedding;
	dimensions: number;
	model: string;
}

/**
 * Service class for converting text to vector embeddings using transformer language models.
 *
 * This service provides a high-level interface for text ----> vector conversion using
 * the Xenova transformers library. It handles model loading, initialization, and
 * provides both single and batch processing capabilities.
 *
 * Technical Details:
 * - Uses the "all-MiniLM-L6-v2" model (384-dimensional embeddings)
 * - Employs mean pooling to combine token-level embeddings
 * - Outputs are L2-normalized for consistent similarity calculations
 */
export class EmbeddingService {
	private extractor: EmbeddingPipeline | null = null;
	private isInitialized = false;
	private initializationPromise: Promise<void> | null = null;
	/**
	 * all-MiniLM-L6-v2 is a lightweight, fast model that produces `384-dimensional` embeddings.
	 *  @see https://huggingface.co/Xenova/all-MiniLM-L6-v2
	 */
	private readonly modelName = "Xenova/all-MiniLM-L6-v2";

	/**
	 * Loads the transformer model and prepares the feature-extraction pipeline.
	 *
	 * This method handles the heavy lifting of downloading and initializing the
	 * transformer model. The model files are cached locally after first download.
	 *
	 * Process:
	 * 1. Downloads model files (if not cached)
	 * 2. Initializes the feature-extraction pipeline
	 * 3. Marks service as ready for use
	 *
	 * @private
	 * @throws {Error} If model loading or pipeline initialization fails
	 */
	private async initialize(): Promise<void> {
		try {
			console.log("Initializing EmbeddingService...");
			console.log(`Loading model: ${this.modelName}`);

			this.extractor = (await pipeline(
				"feature-extraction",
				this.modelName,
			)) as EmbeddingPipeline; // This may take time on first run as it downloads model files

			this.isInitialized = true;
			console.log("EmbeddingService initialized successfully");
		} catch (error) {
			console.error("EmbeddingService initialization failed:", error);
			throw error;
		}
	}

	/**
	 * Ensure the service is initialized before operations
	 * Public method to allow controlled initialization during server startup
	 * Prevents multiple concurrent initialization attempts
	 */
	async ensureInitialized(): Promise<void> {
		// If already initialized, return immediately
		if (this.isInitialized && this.extractor) {
			return;
		}

		// If initialization is already in progress, wait for it
		if (this.initializationPromise) {
			await this.initializationPromise;
			return;
		}

		// Start new initialization
		this.initializationPromise = this.initialize();

		try {
			await this.initializationPromise;
		} finally {
			// Clear the promise once initialization is complete
			this.initializationPromise = null;
		}

		if (!this.extractor) {
			throw new Error("EmbeddingService is not properly initialized");
		}
	}

	/**
	 * Converts a single text string into a vector embedding.
	 *
	 * This is the primary method for single-text embedding generation. The input
	 * text is processed through the transformer model to produce a normalized
	 * vector representation suitable for similarity calculations.
	 *
	 * Processing steps:
	 * 1. Tokenize the input text
	 * 2. Generate token-level embeddings
	 * 3. Apply mean pooling to create sentence-level embedding
	 * 4. L2-normalize the final vector
	 *
	 * @param text - The input string to convert to a vector embedding
	 * @returns Promise resolving to an EmbeddingResult with the vector and metadata
	 * @throws {Error} If the service is not initialized or embedding generation fails
	 *
	 * @example
	 * ```typescript
	 * const result = await embeddingService.textToEmbeddings("machine learning");
	 * console.log(`Generated ${result.dimensions}D embedding for text`);
	 * console.log(`First few values: ${result.embeddings.slice(0, 5)}`);
	 * ```
	 */
	async textToEmbeddings(text: string): Promise<EmbeddingResult> {
		await this.ensureInitialized();

		if (!this.extractor) {
			throw new Error("Extractor not initialized");
		}

		try {
			console.log(
				`Converting text to embeddings: "${text.substring(0, 50)}..."`,
			);

			// The pipeline returns a Float32Array (or number[]) and dims describing its shape.
			const response = await this.extractor([text], {
				pooling: "mean", // Mean-pool token embeddings to get sentence embedding
				normalize: true, // L2-normalize for consistent similarity calculations
			});

			// Convert to plain number[] for easier downstream use & JSON serialization
			// Float32Array is not JSON-serializable, so we convert to regular array
			const embeddings: VectorEmbedding = Array.from(response.data);

			console.log(`Generated ${embeddings.length}-dimensional embeddings`);

			return {
				embeddings,
				dimensions: embeddings.length,
				model: this.modelName,
			};
		} catch (error) {
			console.error("Failed to generate embeddings:", error);
			throw new Error(
				`Failed to generate embeddings: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * Processes multiple texts in a single batch operation for improved efficiency.
	 *
	 * Batch processing is more efficient than individual calls when dealing with
	 * multiple texts, as it reduces the overhead of model inference. The transformer
	 * model can process multiple texts simultaneously, making this method ideal for
	 * bulk operations.
	 *
	 * Performance benefits:
	 * - Reduced per-text overhead
	 * - Better GPU utilization (if available)
	 * - Lower memory allocation overhead
	 *
	 * @param texts - Array of strings to convert to embeddings
	 * @returns Promise resolving to array of EmbeddingResult objects in the same order as input
	 * @throws {Error} If the service is not initialized or batch processing fails
	 *
	 * @TODO Need further work and tests
	 */
	async batchTextToEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
		await this.ensureInitialized();

		if (!this.extractor) {
			throw new Error("Extractor not initialized");
		}

		try {
			console.log(`Converting ${texts.length} texts to embeddings (batch)`);

			// Process all texts in a single pipeline call for efficiency
			const response = await this.extractor(texts, {
				pooling: "mean",
				normalize: true,
			});

			// Extract embedding dimension as the last axis of the tensor
			// This works correctly for tensors of any dimensionality (1D, 2D, 3D, etc.)
			const embeddingDim = response.dims.at(-1) ?? 0;

			// Validate that embeddingDim is valid
			if (embeddingDim <= 0) {
				throw new Error(
					`Invalid embedding dimension: ${embeddingDim}. Response dims: [${response.dims.join(", ")}]`,
				);
			}

			// Validate batch dimension matches expected number of texts
			const batchDim = response.dims[0] ?? 0;
			if (batchDim !== texts.length) {
				throw new Error(
					`Batch dimension mismatch: expected ${texts.length} texts but got batch size ${batchDim}. Response dims: [${response.dims.join(", ")}]`,
				);
			}

			const results: EmbeddingResult[] = [];

			// Handle different tensor shapes properly
			if (response.dims.length === 1) {
				// 1D case: single embedding flattened
				if (texts.length !== 1) {
					throw new Error(
						`Expected 1 text for 1D tensor, got ${texts.length} texts`,
					);
				}
				const embeddings: VectorEmbedding = Array.from(response.data);
				results.push({
					embeddings,
					dimensions: embeddings.length,
					model: this.modelName,
				});
			} else if (response.dims.length === 2) {
				// 2D case: [batch_size, embedding_dim] - most common case
				for (let i = 0; i < texts.length; i++) {
					const startIdx = i * embeddingDim;
					const endIdx = startIdx + embeddingDim;

					// Validate indices are within bounds
					if (
						startIdx >= response.data.length ||
						endIdx > response.data.length
					) {
						throw new Error(
							`Index out of bounds: trying to slice [${startIdx}:${endIdx}] from data of length ${response.data.length}`,
						);
					}

					// Extract this text's embedding from the flat array
					const embeddings: VectorEmbedding = Array.from(
						response.data.slice(startIdx, endIdx),
					);

					results.push({
						embeddings,
						dimensions: embeddings.length,
						model: this.modelName,
					});
				}
			} else {
				// 3D+ case: [batch_size, sequence_length, embedding_dim] or higher
				// For mean pooling, the result should still be [batch_size, embedding_dim]
				// If we get here, it might indicate the pooling didn't work as expected
				throw new Error(
					`Unexpected tensor dimensionality: ${response.dims.length}D tensor with dims [${response.dims.join(", ")}]. Expected 1D or 2D after pooling.`,
				);
			}

			console.log(`Generated embeddings for ${results.length} texts`);
			return results;
		} catch (error) {
			console.error("Failed to generate batch embeddings:", error);
			throw new Error(
				`Failed to generate batch embeddings: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * Returns metadata about the service's current state and configuration.
	 *
	 * @returns Object containing model name and initialization status
	 */
	getInfo(): { model: string; isInitialized: boolean } {
		return {
			model: this.modelName,
			isInitialized: this.isInitialized,
		};
	}
}

/**
 * Singleton instance of EmbeddingService for application-wide use.
 *
 * This singleton pattern ensures that:
 * - Only one model is loaded in memory at a time
 * - Initialization overhead is minimized
 * - Consistent behavior across the application
 */
export const embeddingService = new EmbeddingService();
