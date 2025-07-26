import { type Request, type Response, Router } from "express";
import { auth } from "../middlewares/auth.js";
import { deployForUser } from "../services/DeployService.js";
import { errorResponse, successResponse } from "../utils/responses.js";

const router = Router();

/**
 * POST /deploy/
 * Deploy a new Eizen contract for an authenticated user
 *
 * **Typical Usage Flow:**
 * - User completes payment → Payment webhook triggers this endpoint
 * - Frontend polls this endpoint to check deployment status
 * - User receives contract ID and hash fingerprint for verification
 *
 * @route POST /deploy/
 *
 * @middleware auth - Validates JWT token and extracts user ID
 * @returns {201} Success with contract deployment data
 * @returns {400} Client error (invalid request, subscription issues, duplicate deployment)
 * @returns {500} Server error (deployment failure, database issues)
 *
 * @example Success Response:
 * ```json
 * {
 *   "success": true,
 *   "message": "Eizen contract deployed successfully",
 *   "data": {
 *     "contractId": "arweave_tx_abc123",
 *     "contractHashFingerprint": "hash_fingerprint_def456",
 *     "userId": "user_clerkId789",
 *     "deployedAt": "2025-06-26T10:30:00.000Z",
 *     "keyId": "key_record_id_123"
 *   }
 */
router.post("/", auth, async (req: Request, res: Response) => {
	try {
		// Extract user ID from authenticated request
		// This is set by the auth middleware after JWT validation
		const userId = req.userId;
		if (!userId) {
			res.status(400).json({
				message: "User ID is required for contract deployment",
			});
			return;
		}

		// Delegate to the deployment service for the complete workflow
		// This handles all validation, deployment, and post-processing steps
		const deploymentResult = await deployForUser(userId);

		if (!deploymentResult.success) {
			res.status(400).json({
				message: deploymentResult.error || "Deployment failed",
			});
			return;
		}

		// Return successful deployment data to the client
		res
			.status(201)
			.json(
				successResponse(
					deploymentResult.data,
					"Eizen contract deployed successfully",
				),
			);
	} catch (error) {
		console.error("Contract deployment error:", error);
		res
			.status(500)
			.json(
				errorResponse(
					"Failed to deploy contract",
					error instanceof Error ? error.message : "Unknown error",
				),
			);
	}
});

/**
 * GET /deploy/status
 * Check deployment status for the authenticated user
 *
 * This endpoint allows clients to check if a user has already deployed
 * a contract without triggering a new deployment. Useful for:
 * - Frontend conditional rendering
 * - Preventing duplicate deployment attempts
 * - Displaying existing contract information
 *
 * @route GET /deploy/status
 *
 * @middleware auth - Validates JWT token and extracts user ID
 * @returns {200} Success with deployment status
 * @returns {400} Client error (missing user ID)
 * @returns {500} Server error (database issues)
 *
 * @example Response - Has Deployment:
 * ```json
 * {
 *   "success": true,
 *   "message": "Deployment status retrieved",
 *   "data": {
 *     "hasDeployment": true,
 *     "contractId": "arweave_tx_abc123",
 *     "deployedAt": "2025-06-26T10:30:00.000Z",
 *     "isActive": true
 *   }
 * }
 * ```
 */
router.get("/status", auth, async (req: Request, res: Response) => {
	try {
		const userId = req.userId;
		if (!userId) {
			res.status(400).json({
				message: "User ID is required to check deployment status",
			});
			return;
		}

		// Import the function only when needed to avoid circular dependencies
		const { getDeploymentStatus } = await import(
			"../services/DeployService.js"
		);

		// Check deployment status for the user
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
					"Deployment status retrieved",
				),
			);
		} else {
			// User has no deployment
			res
				.status(200)
				.json(successResponse({ hasDeployment: false }, "No deployment found"));
		}
	} catch (error) {
		console.error("Error checking deployment status:", error);

		res
			.status(500)
			.json(
				errorResponse(
					"Failed to check deployment status",
					error instanceof Error ? error.message : "Unknown error",
				),
			);
	}
});

export default router;
