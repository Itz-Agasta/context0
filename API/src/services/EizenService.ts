import { readFileSync } from "node:fs";
import { join } from "node:path";
import { EizenDbVector } from "eizendb";
import { SetSDK } from "hollowdb";
import { type ArweaveConfig, initializeArweave } from "../config/arweave.js";
import type {
	InsertVector,
	SearchVector,
	VectorEmbedding,
	VectorMetadata,
} from "../schemas/eizen.js";
import {
	checkWalletBalance,
	getWalletRechargeInstructions,
	logWalletBalanceAfterOperation,
} from "../utils/helper.js";

export interface EizenSearchResult {
	id: number;
	distance: number; // Distance/similarity score (lower value == higher similarity)
	metadata?: VectorMetadata;
}

export interface EizenInsertResult {
	success: boolean;
	vectorId: number;
	message: string;
}

/**
 * Service class for managing Eizen vector database operations with multi-tenant support
 *
 * This service provides a high-level interface for:
 * - Vector storage and retrieval
 * - Similarity search using HNSW (Hierarchical Navigable Small World) algorithm
 * - Database statistics and management
 * - Multi-tenant contract management
 *
 * The service uses Arweave for decentralized storage and HollowDB as the underlying data layer.
 * Each user gets their own contract instance for isolated vector storage.
 *
 * @see https://github.com/Itz-Agasta/Eizendb/blob/main/docs/DEVELOPER_GUIDE.md --> Official Eizen Docs
 *
 * @example
 * ```typescript
 * // Create a user-specific instance
 * const userEizenService = await EizenService.forContract(userContractId);
 *
 * // Insert a vector
 * const result = await userEizenService.insertVector({
 *   vector: [0.1, 0.2, 0.3, ...],
 *   metadata: {
 *     "content": "User's favorite color is blue",
 *     "context": "preference setting"
 *   }
 * });
 *
 * // Search for similar vectors
 * const similar = await userEizenService.searchVectors({
 *   query: [0.1, 0.2, 0.3, ...],
 *   k: 5
 * });
 * ```
 */
export class EizenService {
	private vectorDb: EizenDbVector<VectorMetadata> | null = null; // The Eizen vector database instance with generic metadata type
	private sdk: SetSDK<string> | null = null; // HollowDB SDK instance for Arweave interactions
	private contractId: string; // The contract ID for this specific instance
	private isInitialized = false;

	// Shared Arweave configuration across all instances
	private static sharedArweaveConfig: ArweaveConfig | null = null;
	private static arweaveInitPromise: Promise<ArweaveConfig> | null = null;

	/**
	 * Creates a new EizenService instance for a specific contract
	 *
	 * Note: Use the static factory methods instead of calling constructor directly.
	 *
	 * @param contractId - The Arweave contract ID for this user's vector database
	 */
	private constructor(contractId: string) {
		this.contractId = contractId;
	}

	/**
	 * Create a new EizenService instance for a specific user contract
	 *
	 * This factory method creates and initializes a service instance for a specific
	 * contract ID. Each user should have their own contract for data isolation.
	 *
	 * @param contractId - The Arweave contract ID for the user's vector database
	 * @returns Promise resolving to an initialized EizenService instance
	 *
	 * @example
	 * ```typescript
	 * // Create service for a user's contract
	 * const userService = await EizenService.forContract("user123_contract_id");
	 *
	 * // Insert vectors using user's isolated database
	 * await userService.insertVector({
	 *   vector: [0.1, 0.2, 0.3],
	 *   metadata: { content: "user data" }
	 * });
	 * ```
	 */
	static async forContract(contractId: string): Promise<EizenService> {
		const service = new EizenService(contractId);
		await service.initialize();
		return service;
	}

	/**
	 * Deploy a new contract and return the contractID from Arweave
	 *
	 * This method creates a new Arweave contract for a user and returns
	 * the contract ID for storage in Arweave.
	 *
	 * @returns Promise resolving to the new contract ID
	 * @use const { contractId } = await EizenService.deployNewContract();
	 */
	static async deployNewContract(): Promise<{
		contractId: string;
		walletAddress: string;
	}> {
		// Initialize shared Arweave config
		const arweaveConfig = await EizenService.getSharedArweaveConfig();

		try {
			console.log("Deploying new Eizen contract...");

			// Get wallet address that will be used for deployment
			const walletAddress = await arweaveConfig.warp.arweave.wallets.getAddress(
				arweaveConfig.wallet,
			);

			// Check wallet balance before attempting deployment
			const balanceInfo = await checkWalletBalance(
				arweaveConfig.warp,
				arweaveConfig.wallet,
			);
			console.log(
				`Wallet balance check: ${balanceInfo.readableBalance} AR (${balanceInfo.walletAddress})`,
			);

			if (!balanceInfo.hasBalance) {
				const rechargeInfo = getWalletRechargeInstructions(
					balanceInfo.walletAddress,
				);

				if (!rechargeInfo.isProduction) {
					throw new Error(
						`Insufficient wallet balance for deployment. Current balance: ${balanceInfo.readableBalance} AR. ` +
							`💡 Dev tip: ${rechargeInfo.tip}
Command: ${rechargeInfo.instructions}`,
					);
				}

				throw new Error(
					`Insufficient wallet balance for deployment. Current balance: ${balanceInfo.readableBalance} AR. ${rechargeInfo.instructions}`,
				);
			}

			const isProduction = process.env.NODE_ENV === "production";

			// Eizen internally uses contractTxId, we get it and then return as contractId for API consistency
			let contractTxId: string;

			if (isProduction) {
				// Production: Use EizenDbVector.deploy() for mainnet
				const result = await EizenDbVector.deploy(
					arweaveConfig.wallet,
					arweaveConfig.warp,
				);
				contractTxId = result.contractTxId;
			} else {
				// Development with Arlocal Use warp.deploy() with embedded contract source
				console.log("Using Arlocal TestNet for deployment");

				// Read contract source and state from data folder
				const contractSource = readFileSync(
					join(process.cwd(), "data", "contract.js"),
					"utf8",
				);
				const initialState = JSON.parse(
					readFileSync(join(process.cwd(), "data", "state.json"), "utf8"),
				);

				// Set the owner to our wallet address
				initialState.owner = walletAddress;

				const result = await arweaveConfig.warp.deploy({
					wallet: arweaveConfig.wallet,
					initState: JSON.stringify(initialState),
					src: contractSource,
					evaluationManifest: {
						evaluationOptions: {
							allowBigInt: true,
							useKVStorage: true,
						},
					},
				}); // testnet uses bundling
				contractTxId = result.contractTxId;
			}

			console.log(`Eizen contract deployed successfully: ${contractTxId}`);

			// Check wallet balance after successful deployment
			await logWalletBalanceAfterOperation(
				arweaveConfig.warp,
				arweaveConfig.wallet,
				"deployment",
			);

			return {
				contractId: contractTxId,
				walletAddress: walletAddress,
			};
		} catch (error) {
			console.error("Failed to deploy contract:", error);
			throw new Error(
				`Failed to deploy contract: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * Get or initialize the shared Arweave configuration
	 *
	 * This method ensures that Arweave configuration is initialized only once
	 * and shared across all service instances for efficiency.
	 *
	 * @private
	 */
	private static async getSharedArweaveConfig(): Promise<ArweaveConfig> {
		if (EizenService.sharedArweaveConfig) {
			return EizenService.sharedArweaveConfig;
		}

		// Ensure only one initialization happens at a time
		if (!EizenService.arweaveInitPromise) {
			EizenService.arweaveInitPromise = initializeArweave();
		}

		EizenService.sharedArweaveConfig = await EizenService.arweaveInitPromise;
		return EizenService.sharedArweaveConfig;
	}

	/**
	 * Get HNSW parameters from environment variables with defaults
	 *
	 * This method centralizes HNSW parameter configuration to avoid duplication
	 * between startup logging and instance initialization.
	 *
	 * @private
	 * @returns HNSW configuration object
	 */
	private static getHnswParams() {
		return {
			m: Number(process.env.EIZEN_M) || 16, // Maximum number of bi-directional links for each element
			efConstruction: Number(process.env.EIZEN_EF_CONSTRUCTION) || 200, // Dynamic candidate list size during index construction (higher == better quality == slower build)
			efSearch: Number(process.env.EIZEN_EF_SEARCH) || 50, // Dynamic candidate list size during search (higher == better accuracy == slower search)
		};
	}
	/**
	 * Initialize the service instance for a specific contract
	 *
	 * This method:
	 * 1. Gets the shared Arweave configuration
	 * 2. Creates HollowDB SDK with the contract ID
	 * 3. Initializes EizenDbVector with HNSW parameters
	 *
	 * HNSW Parameters (configured via environment variables):
	 * - m: Number of bi-directional links for each new element (default: 16)
	 * - efConstruction: Size of dynamic candidate list during construction (default: 200)
	 * - efSearch: Size of dynamic candidate list during search (default: 50)
	 *
	 * @private
	 * @throws {Error} When initialization fails
	 */
	private async initialize(): Promise<void> {
		try {
			console.log(`Initializing EizenService for contract: ${this.contractId}`);

			// Step 1: Get shared Arweave configuration
			const arweaveConfig = await EizenService.getSharedArweaveConfig();

			// Step 2: Create HollowDB SDK instance for this specific contract
			this.sdk = new SetSDK<string>(
				arweaveConfig.wallet,
				this.contractId,
				arweaveConfig.warp,
			);

			// Step 3: Configure HNSW algorithm parameters from environment or use defaults
			const options = EizenService.getHnswParams();

			// Step 4: Create the Eizen vector database instance with configured parameters
			this.vectorDb = new EizenDbVector<VectorMetadata>(this.sdk, options);

			this.isInitialized = true;
			console.log(
				`EizenService initialized successfully for contract: ${this.contractId}`,
			);
			console.log(
				`HNSW Parameters: m=${options.m}, efConstruction=${options.efConstruction}, efSearch=${options.efSearch}`,
			);
		} catch (error) {
			console.error(
				`EizenService initialization failed for contract ${this.contractId}:`,
				error,
			);
			throw error;
		}
	}

	/**
	 * Ensures the service is fully initialized before performing operations
	 *
	 * This method is called by all public methods to guarantee that the service
	 * is ready for use. Since instances are created via factory methods,
	 * this should typically not be needed, but provides a safety check.
	 *
	 * @private
	 * @throws {Error} When the service fails to initialize properly
	 */
	private async ensureInitialized(): Promise<void> {
		if (!this.isInitialized) {
			await this.initialize();
		}

		if (!this.vectorDb) {
			throw new Error("EizenService is not properly initialized");
		}
	}

	/**
	 * Insert a vector with associated metadata into the database
	 *
	 * The vector will be added to the HNSW index for future similarity searches.
	 * Each vector must have consistent dimensionality with existing vectors in the database.
	 *
	 * @param data - The vector data and metadata to insert
	 * @param data.vector - The numerical vector representation (e.g., embeddings)
	 * @param data.metadata - Associated metadata (document ID, type, etc.)
	 * @returns Promise resolving to insertion result with assigned vector ID
	 *
	 * @example
	 * ```typescript
	 * const result = await eizenService.insertVector({
	 *   vector: [0.1, 0.2, 0.3, 0.4, 0.5],
	 *   metadata: {
	 *  		"content": "User's favorite color is blue",
	 *  		"context": "preference setting",
	 * 			"importance": 7,
	 * 			"tags": ["preference", "color", "personal"],
	 * 			"timestamp": "2025-06-06T14:30:00Z",
	 * 			"client": "cursor"
	 * 		}
	 * });
	 *
	 * if (result.success) {
	 *   console.log(`Vector stored with ID: ${result.vectorId}`);
	 * }
	 * ```
	 *
	 * @throws {Error} When the service is not initialized or insertion fails
	 */
	async insertVector(data: InsertVector): Promise<EizenInsertResult> {
		await this.ensureInitialized();

		if (!this.vectorDb) {
			throw new Error("Vector database not initialized");
		}

		try {
			console.log(`Inserting vector with ${data.vector.length} dimensions`);

			// Get the next ID before insertion from the underlying database
			const vectorId = await this.vectorDb.db.get_datasize();

			// Insert vector into the HNSW index with associated metadata
			await this.vectorDb.insert(data.vector, data.metadata);

			console.log(`Vector inserted successfully with ID: ${vectorId}`);

			// Check wallet balance after successful insert
			const arweaveConfig = await EizenService.getSharedArweaveConfig();
			await logWalletBalanceAfterOperation(
				arweaveConfig.warp,
				arweaveConfig.wallet,
				"insert",
			);

			return {
				success: true,
				vectorId,
				message: `Vector inserted successfully with ID: ${vectorId}`,
			};
		} catch (error) {
			console.error("Failed to insert vector:", error);
			throw new Error(
				`Failed to insert vector: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * Search for the k most similar vectors using the HNSW algorithm
	 *
	 * This method performs approximate nearest neighbor search to find vectors
	 * most similar to the query vector. Results are ordered by similarity
	 * (lower distance = higher similarity).
	 *
	 * @param data - Search parameters
	 * @param data.query - The query vector to find similar vectors for
	 * @param data.k - Number of nearest neighbors to return (must be > 0)
	 * @returns Promise resolving to array of similar vectors with distances and metadata
	 *
	 *@Note This operation doesn't cost any AR tokens

	 * @example
	 * ```typescript
	 * // Find 5 most similar vectors
	 * const results = await eizenService.searchVectors({
	 *   query: [0.1, 0.2, 0.3, 0.4, 0.5],
	 *   k: 5
	 * });
	 *
	 * results.forEach((result, index) => {
	 *   console.log(`${index + 1}. Vector ID: ${result.id}, Distance: ${result.distance}`);
	 *   if (result.metadata) {
	 *     console.log(`   Metadata:`, result.metadata);
	 *   }
	 * });
	 * ```
	 *
	 * @throws {Error} When the service is not initialized or search fails
	 */
	async searchVectors(data: SearchVector): Promise<EizenSearchResult[]> {
		await this.ensureInitialized();

		if (!this.vectorDb) {
			throw new Error("Vector database not initialized");
		}

		try {
			console.log(`Searching for ${data.k} nearest neighbors`);

			// Perform k-nearest neighbor search using HNSW algorithm
			const results = await this.vectorDb.knn_search(data.query, data.k);

			console.log(`Found ${results.length} similar vectors`);

			// Transform results to match our interface
			return results.map((result) => ({
				id: result.id,
				distance: result.distance,
				metadata: result.metadata || undefined,
			}));
		} catch (error) {
			console.error("Failed to search vectors:", error);
			throw new Error(
				`Failed to search vectors: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * Retrieve a specific vector by its unique ID (Experimental)
	 *
	 * This method allows direct access to a vector and its metadata using
	 * the ID returned from previous insert or search operations.
	 *
	 * @param vectorId - The unique identifier of the vector to retrieve
	 * @returns Promise resolving to vector data and metadata, or null if not found
	 *
	 * @example
	 * ```typescript
	 * const vector = await eizenService.getVector(123);
	 *
	 * if (vector) {
	 *   console.log(`Vector dimensions: ${vector.point.length}`);
	 *   console.log(`Metadata:`, vector.metadata);
	 * } else {
	 *   console.log('Vector not found');
	 * }
	 * ```
	 *
	 * @throws {Error} When the service is not initialized or retrieval fails
	 */
	async getVector(
		vectorId: number,
	): Promise<{ point: VectorEmbedding; metadata?: VectorMetadata } | null> {
		await this.ensureInitialized();

		if (!this.vectorDb) {
			throw new Error("Vector database not initialized");
		}

		try {
			console.log(`Retrieving vector with ID: ${vectorId}`);

			// Fetch vector data by ID from the database
			const result = await this.vectorDb.get_vector(vectorId);

			if (result) {
				console.log(`Vector ${vectorId} retrieved successfully`);
				return {
					point: result.point,
					metadata: result.metadata || undefined,
				};
			}

			console.log(`Vector ${vectorId} not found`);
			return null;
		} catch (error) {
			console.error(`Failed to retrieve vector ${vectorId}:`, error);
			throw new Error(
				`Failed to retrieve vector: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	// ============================================================================
	// Support Functions
	// These functions are not part of the core Eizen logic,
	// but can be called externally (e.g., for logging, diagnostics, etc.).
	// ============================================================================

	/**
	 * Get database statistics and service status
	 *
	 * Provides information about the current state of the vector database,
	 * including the total number of stored vectors and initialization status.
	 *
	 * @returns Promise resolving to database statistics
	 *
	 * @todo Implement vector count tracking via service NEON db
	 */
	async getStats(): Promise<{
		totalVectors: number;
		isInitialized: boolean;
		contractId: string;
	}> {
		try {
			return {
				totalVectors: this.vectorDb ? await this.getVectorCount() : 0,
				isInitialized: this.isInitialized,
				contractId: this.contractId,
			};
		} catch {
			return {
				totalVectors: 0,
				isInitialized: this.isInitialized,
				contractId: this.contractId,
			};
		}
	}

	/**
	 * Get the total number of vectors in the database via our service NEON db
	 *
	 * This is a helper method used internally for statistics and ID estimation.
	 *
	 * @private
	 * @returns Promise resolving to the vector count
	 * @todo Implement it via service NEON db
	 */
	private async getVectorCount(): Promise<number> {
		if (!this.vectorDb) {
			return 0;
		}
		return await this.vectorDb.db.get_datasize();
	}

	/**
	 * Clean up service resources and close connections
	 *
	 * This method should be called when shutting down the application
	 * to properly close database connections and free resources.
	 *
	 * Note: This only cleans up this specific instance. The shared Arweave
	 * configuration remains for other instances.
	 *
	 * @example
	 * ```typescript
	 * // During application shutdown or when done with this user's service
	 * await userEizenService.cleanup();
	 * ```
	 */
	async cleanup(): Promise<void> {
		try {
			// Reset initialization state for this instance
			this.isInitialized = false;
			this.vectorDb = null;
			this.sdk = null;

			console.log(
				`EizenService cleanup completed for contract: ${this.contractId}`,
			);
		} catch (error) {
			console.error(
				`Error during cleanup for contract ${this.contractId}:`,
				error,
			);
		}
	}

	/**
	 * Clean up shared resources (call this only during application shutdown)
	 *
	 * This static method cleans up shared Arweave configuration and should
	 * only be called when the entire application is shutting down.
	 *
	 * @example
	 * ```typescript
	 * // During complete application shutdown
	 * await EizenService.globalCleanup();
	 * ```
	 */
	static async globalCleanup(): Promise<void> {
		try {
			// Close Redis connection if it exists
			if (EizenService.sharedArweaveConfig?.redis) {
				await EizenService.sharedArweaveConfig.redis.quit();
				console.log("Redis connection closed");
			}

			// Reset shared state
			EizenService.sharedArweaveConfig = null;
			EizenService.arweaveInitPromise = null;

			console.log("EizenService global cleanup completed");
		} catch (error) {
			console.error("Error during global cleanup:", error);
		}
	}

	// Get the contract ID associated with this service instance
	getContractId(): string {
		return this.contractId;
	}

	/**
	 * Initialize shared system configuration at startup
	 *
	 * Used for displaying system monitor logs at API startup.
	 * @public
	 * @returns Promise that resolves when shared configuration is initialized
	 */
	static async initEizenConfig(): Promise<void> {
		await EizenService.getSharedArweaveConfig();
		const hnswParams = EizenService.getHnswParams();

		console.log("Shared Arweave configuration initialized");
		console.log(
			`HNSW Parameters: m=${hnswParams.m}, efConstruction=${hnswParams.efConstruction}, efSearch=${hnswParams.efSearch}`,
		);
	}
}

// To create instances: await EizenService.forContract(contractId)
// To deploy new contract: await EizenService.deployNewContract()
