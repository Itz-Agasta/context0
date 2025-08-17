import { Router } from "express";
import { z } from "zod";
import { auth } from "../middlewares/auth.js";
import { validateData } from "../middlewares/validate.js";
import { createMemorySchema, searchMemorySchema } from "../schemas/memory.js";
import { EizenService } from "../services/EizenService.js";
import { MemoryService } from "../services/MemoryService.js";
import { errorResponse, successResponse } from "../utils/responses.js";
import { logger } from "../config/winston.js";

/**
 * ADMIN ROUTES - context0 Memory Service Administration
 *
 * These routes provide direct high-level access to the Memory Service
 * for administrative purposes only. They are NOT intended for public use.
 *
 * Security Note: These endpoints bypass user authentication and operate
 * directly on the specified contract. (Will private this endpoint later)
 */

// Admin-specific schemas with required contract ID
const adminCreateMemorySchema = createMemorySchema.extend({
	contractId: z.string().min(1, "Contract ID is required"),
});

const adminSearchMemorySchema = searchMemorySchema.extend({
	contractId: z.string().min(1, "Contract ID is required"),
});

const router = Router();

/**
 * Get admin Memory service instance
 * Uses the contract ID from request - contract ID is required
 *
 * @param contractId - Required contract ID from request
 * @returns Promise<MemoryService> - Admin Memory service instance
 * @throws Error if no contract ID is provided
 */
async function getAdminMemoryService(
	contractId: string
): Promise<MemoryService> {
	if (!contractId) {
		throw new Error(
			"Contract ID is required. Please include 'contractId' in your request."
		);
	}

	const eizenService = await EizenService.forContract(contractId);
	return new MemoryService(eizenService);
}

/**
 * POST /admin/insert
 * Create a memory from text content with optional metadata
 *
 * Admin Use Case: Direct memory creation for testing and data seeding
 * Uses MemoryService to handle text-to-embedding conversion automatically
 *
 * Request body:
 * {
 *   "content": "User prefers dark mode interface",  // Text content to store
 *   "metadata": { "tags": ["preference"], "importance": 8 }, // Optional metadata object
 *   "contractId": "your-contract-id"  // Required contract ID
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": { "memoryId": 123, "message": "Memory created from 25 characters of content" },
 *   "message": "Memory created successfully"
 * }
 */
router.post(
	"/insert",
	auth,
	validateData(adminCreateMemorySchema),
	async (req, res) => {
		try {
			const { contractId, ...memoryData } = req.body;
			const memoryService = await getAdminMemoryService(contractId);
			const result = await memoryService.createMemory(memoryData);

			res
				.status(201)
				.json(successResponse(result, "Memory created successfully"));
		} catch (error) {
			logger.error("Admin memory creation error:", error);
			res
				.status(500)
				.json(
					errorResponse(
						"Failed to create memory",
						error instanceof Error ? error.message : "Unknown error"
					)
				);
		}
	}
);

/**
 * POST /admin/search
 * Search for similar memories using natural language queries
 *
 * Admin Use Case: Direct semantic memory search for testing and debugging
 * Uses MemoryService to handle query-to-embedding conversion automatically
 *
 * Request body:
 * {
 *   "query": "user interface preferences",
 *   "k": 10,                               // Number of results (optional, defaults to 10)
 *   "filters": {                           // Optional filters
 *     "tags": ["preference"],
 *     "importance_min": 5
 *   },
 *   "contractId": "your-contract-id"       // Required contract ID
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": [
 *     { "id": 123, "content": "User prefers dark mode", "distance": 0.15, "metadata": {...} },
 *     { "id": 456, "content": "Interface should be minimal", "distance": 0.23, "metadata": {...} }
 *   ],
 *   "message": "Found 2 similar memories"
 * }
 */
router.post(
	"/search",
	auth,
	validateData(adminSearchMemorySchema),
	async (req, res) => {
		try {
			const { contractId, ...searchData } = req.body;
			const memoryService = await getAdminMemoryService(contractId);
			const results = await memoryService.searchMemories(searchData);

			res.json(
				successResponse(results, `Found ${results.length} similar memories`)
			);
		} catch (error) {
			logger.error("Admin memory search error:", error);
			res
				.status(500)
				.json(
					errorResponse(
						"Failed to search memories",
						error instanceof Error ? error.message : "Unknown error"
					)
				);
		}
	}
);

/**
 * GET /admin/memories/count/:contractId
 * Check how many memories exist for a specific contract ID
 *
 * @NOTE contractID is a path parameter not query
 */
router.get("/memories/count/:contractId", async (req, res) => {
	try {
		const { contractId } = req.params;

		if (!contractId) {
			res
				.status(400)
				.json(
					errorResponse("Contract ID required", "Please provide a contract ID")
				);
			return;
		}

		const memoryService = await getAdminMemoryService(contractId);
		const stats = await memoryService.getStats();

		res.json(
			successResponse(
				{
					contractId,
					totalMemories: stats.totalMemories,
					isInitialized: stats.isInitialized,
				},
				`Contract ${contractId} has ${stats.totalMemories} memories`
			)
		);
	} catch (error) {
		logger.error("Memory count check error:", error);
		res
			.status(500)
			.json(
				errorResponse(
					"Failed to get memory count",
					error instanceof Error ? error.message : "Unknown error"
				)
			);
	}
});

/**
 * POST /admin/deploy
 * Deploy a new Eizen contract (admin operation)
 *
 * Admin Use Case: Deploy new contract instances for system scaling or testing
 *
 * Note: This operation creates a new contract on Arweave blockchain.
 * No contractId needed as this creates a new contract.
 *
 * Response:
 * {
 *   "success": true,
 *   "data": { "contractId": "abc123..." },
 *   "message": "Eizen contract deployed successfully"
 * }
 */
router.post("/deploy", auth, async (_req, res) => {
	try {
		const deployResult = await EizenService.deployNewContract();
		const contractId = deployResult.contractId;

		res
			.status(201)
			.json(
				successResponse({ contractId }, "Eizen contract deployed successfully")
			);
	} catch (error) {
		logger.error("Admin contract deploy error:", error);
		res
			.status(500)
			.json(
				errorResponse(
					"Failed to deploy contract",
					error instanceof Error ? error.message : "Unknown error"
				)
			);
	}
});

/**
 * POST /admin/test-deploy
 * Test the deploy.ts route functionality (admin testing)
 *
 * Admin Use Case: Test the deployForUser function with a provided user ID
 * This simulates the main deploy route without requiring authentication
 *
 * Request body:
 * {
 *   "userId": "test_user_123"  // Required user ID to test deployment
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "contractId": "arweave_tx_abc123",
 *     "contractHashFingerprint": "hash_fingerprint_def456",
 *     "userId": "test_user_123",
 *     "deployedAt": "2025-06-27T10:30:00.000Z",
 *     "keyId": "key_record_id_123"
 *   },
 *   "message": "Deploy service test completed successfully"
 * }
 */
router.post("/test-deploy", auth, async (req, res) => {
	try {
		const { userId } = req.body;

		if (!userId) {
			res
				.status(400)
				.json(
					errorResponse(
						"User ID is required",
						"Please provide 'userId' in the request body for testing"
					)
				);
			return;
		}

		// Import the deployForUser function from DeployService
		const { deployForUser } = await import("../services/DeployService.js");

		// Test the deployment service with the provided user ID
		const deploymentResult = await deployForUser(userId);

		if (!deploymentResult.success) {
			res
				.status(400)
				.json(
					errorResponse(
						"Deployment test failed",
						deploymentResult.error || "Unknown deployment error"
					)
				);
			return;
		}

		// Return successful deployment test data
		res
			.status(201)
			.json(
				successResponse(
					deploymentResult.data,
					"Deploy service test completed successfully"
				)
			);
	} catch (error) {
		logger.error("Admin deploy test error:", error);
		res
			.status(500)
			.json(
				errorResponse(
					"Failed to test deploy service",
					error instanceof Error ? error.message : "Unknown error"
				)
			);
	}
});

/**
 * GET /admin/test-deploy-status
 * Test the deploy status checking functionality (admin testing)
 *
 * Admin Use Case: Test the getDeploymentStatus function with a provided user ID
 * This simulates the deploy/status route without requiring authentication
 *
 * Query Parameters:
 * - userId: Required user ID to test deployment status check
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "hasDeployment": true,
 *     "contractId": "arweave_tx_abc123",
 *     "lastUsedAt": "2025-06-27T10:30:00.000Z",
 *     "isActive": true
 *   },
 *   "message": "Deploy status test completed successfully"
 * }
 */
router.get("/test-deploy-status", auth, async (req, res) => {
	try {
		const userId = req.query.userId as string;

		if (!userId) {
			res
				.status(400)
				.json(
					errorResponse(
						"User ID is required",
						"Please provide 'userId' as a query parameter for testing"
					)
				);
			return;
		}

		// Import the getDeploymentStatus function from DeployService
		const { getDeploymentStatus } = await import(
			"../services/DeployService.js"
		);

		// Test the deployment status check with the provided user ID
		const status = await getDeploymentStatus(userId);

		if (status.hasDeployment && status.keyData) {
			// User has an existing deployment
			res.status(200).json(
				successResponse(
					{
						hasDeployment: true,
						contractId: status.keyData.arweaveWalletAddress,
						lastUsedAt: status.keyData.lastUsedAt,
						isActive: status.keyData.isActive,
					},
					"Deploy status test completed successfully"
				)
			);
		} else {
			// User has no deployment
			res
				.status(200)
				.json(
					successResponse(
						{ hasDeployment: false },
						"Deploy status test completed - No deployment found"
					)
				);
		}
	} catch (error) {
		logger.error("Admin deploy status test error:", error);
		res
			.status(500)
			.json(
				errorResponse(
					"Failed to test deploy status service",
					error instanceof Error ? error.message : "Unknown error"
				)
			);
	}
});

export default router;
