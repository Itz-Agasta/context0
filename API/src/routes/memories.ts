import { type Request, type Response, Router } from "express";
import { verifyContractHashMiddleware } from "../middlewares/contract.js";
import { validateData } from "../middlewares/validate.js";
import { createMemorySchema, searchMemorySchema } from "../schemas/memory.js";
import { EizenService } from "../services/EizenService.js";
import { MemoryService } from "../services/MemoryService.js";
import {
	checkQuota,
	incrementQuotaUsage,
} from "../services/SubscriptionService.js";
import { errorResponse, successResponse } from "../utils/responses.js";

//  User-facing semantic memory API

const router = Router();

// TODO: Replace this with actual user lookup from SQL database
// This will be implemented when payment gateway integration is added
async function getUserMemoryService(
	req: Request,
): Promise<MemoryService | undefined> {
	// TODO: Extract API key from request headers
	// const apiKey = req.headers['x-api-key'] as string;

	// TODO: Look up user's contract ID from database
	// const user = await getUserByApiKey(apiKey);
	// const eizenService = await EizenService.forContract(user.contractId);
	// return new MemoryService(eizenService);

	// For now, use environment variable as fallback (single tenant mode)
	const contract = req.contract;
	const contractId = contract?.contractId;
	if (!contractId) {
		console.error("No contract ID found in request");
		return;
	}

	const eizenService = await EizenService.forContract(contractId);
	return new MemoryService(eizenService);
}

/**
 * POST /memories/insert
 * Create a new memory from text content
 * This endpoint converts text to embeddings and stores in Eizen
 *
 * Request body:
 * {
 *   "content": "User's favorite color is blue",
 *   "metadata": {
 *     "context": "preference setting",
 *     "importance": 7,
 *     "tags": ["preference", "color"],
 *     "timestamp": "2025-06-06T14:30:00Z",
 *     "client": "cursor"
 *   }
 * }
 */
router.post(
	"/insert",
	verifyContractHashMiddleware,
	validateData(createMemorySchema),
	async (req, res) => {
		try {
			// Check if user has quota available
			const clerkId = req.contract?.userId;
			if (!clerkId) {
				res
					.status(401)
					.json(
						errorResponse("Authentication failed", "Unable to identify user"),
					);
				return;
			}

			const quotaCheck = await checkQuota(clerkId);
			if (!quotaCheck.allowed) {
				res
					.status(429)
					.json(
						errorResponse(
							"Quota exceeded",
							quotaCheck.error ||
								"You have reached your memory insertion limit",
						),
					);
				return;
			}

			const memoryService = await getUserMemoryService(req);
			if (!memoryService) {
				res
					.status(500)
					.json(
						errorResponse(
							"Memory service not available",
							"Unable to initialize memory service",
						),
					);
				return;
			}

			// Create the memory
			const result = await memoryService.createMemory(req.body);

			// Update quota usage after successful memory creation
			const quotaUpdate = await incrementQuotaUsage(clerkId, 1);
			if (!quotaUpdate.success) {
				console.error(
					"Failed to update quota after memory creation:",
					quotaUpdate.error,
				);
				// Note: We don't fail the request since the memory was created successfully
				// but we log the error for monitoring
			}

			res
				.status(201)
				.json(successResponse(result, "Memory created successfully"));
		} catch (error) {
			console.error("Memory creation error:", error);
			res
				.status(500)
				.json(
					errorResponse(
						"Failed to create memory",
						error instanceof Error ? error.message : "Unknown error",
					),
				);
		}
	},
);

/**
 * POST /memories/search
 * Search for memories using natural language query
 * This endpoint converts text query to embeddings and searches Eizen
 *
 * Request body:
 * {
 *   "query": "favorite color preference",
 *   "k": 5,
 *   "filters": {
 *     "tags": ["preference", "color"],
 *     "importance_min": 5
 *   }
 * }
 */
router.post(
	"/search",
	verifyContractHashMiddleware,
	validateData(searchMemorySchema),
	async (req, res) => {
		try {
			const memoryService = await getUserMemoryService(req);
			if (!memoryService) {
				res
					.status(500)
					.json(
						errorResponse(
							"Memory service not available",
							"Unable to initialize memory service",
						),
					);
				return;
			}
			const results = await memoryService.searchMemories(req.body);

			res.json(
				successResponse(results, `Found ${results.length} relevant memories`),
			);
		} catch (error) {
			console.error("Memory search error:", error);
			res
				.status(500)
				.json(
					errorResponse(
						"Failed to search memories",
						error instanceof Error ? error.message : "Unknown error",
					),
				);
		}
	},
);

/**
 * GET /memories/search/:id
 * Get a specific memory by its vector ID
 */
router.get(
	"/search/:id",
	verifyContractHashMiddleware,
	async (req: Request, res: Response): Promise<void> => {
		try {
			const memoryService = await getUserMemoryService(req);
			if (!memoryService) {
				res
					.status(500)
					.json(
						errorResponse(
							"Memory service not available",
							"Unable to initialize memory service",
						),
					);
				return;
			}
			const memoryId = Number.parseInt(req.params.id, 10);

			if (Number.isNaN(memoryId)) {
				res
					.status(400)
					.json(
						errorResponse("Invalid memory ID", "Memory ID must be a number"),
					);
				return;
			}

			const memory = await memoryService.getMemory(memoryId);
			if (!memory) {
				res
					.status(404)
					.json(
						errorResponse(
							"Memory not found",
							`No memory found with ID: ${memoryId}`,
						),
					);
				return;
			}

			if (!memory) {
				res
					.status(404)
					.json(
						errorResponse(
							"Memory not found",
							`No memory found with ID: ${memoryId}`,
						),
					);
				return;
			}

			res.json(successResponse(memory, "Memory retrieved successfully"));
		} catch (error) {
			console.error("Memory get error:", error);
			res
				.status(500)
				.json(
					errorResponse(
						"Failed to retrieve memory",
						error instanceof Error ? error.message : "Unknown error",
					),
				);
		}
	},
);

/**
 * GET /memories
 * Get memory statistics and database info
 */
router.get("/", verifyContractHashMiddleware, async (req, res) => {
	try {
		const memoryService = await getUserMemoryService(req);
		if (!memoryService) {
			res
				.status(500)
				.json(
					errorResponse(
						"Memory service not available",
						"Unable to initialize memory service",
					),
				);
			return;
		}
		const stats = await memoryService.getStats();

		res.json(successResponse(stats, "Memory statistics retrieved"));
	} catch (error) {
		console.error("Memory stats error:", error);
		res
			.status(500)
			.json(
				errorResponse(
					"Failed to get memory statistics",
					error instanceof Error ? error.message : "Unknown error",
				),
			);
	}
});

export default router;
