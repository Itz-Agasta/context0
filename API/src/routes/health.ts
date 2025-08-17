import { Router } from "express";
import { EizenService } from "../services/EizenService.js";
import { embeddingService } from "../services/EmbeddingService.js";
import { MemoryService } from "../services/MemoryService.js";
import { checkRedisConnectivity } from "../utils/helper.js";
import { errorResponse, successResponse } from "../utils/responses.js";
import { logger } from "../config/winston.js";

const router = Router();

/**
 * GET /health
 * Basic health check endpoint
 */
router.get("/", (_req, res) => {
	res.json(
		successResponse(
			{
				status: "healthy",
				timestamp: new Date().toISOString(),
				uptime: process.uptime(),
				service: "Context0 API",
			},
			"API is healthy"
		)
	);
});

/**
 * GET /health/detailed
 * Detailed health check including service status
 * Note: Uses fallback contract for system health checks
 */
router.get("/detailed", async (_req, res) => {
	try {
		// For health checks, use fallback contract ID from environment
		// This is for system monitoring, not user-specific operations
		const fallbackContractId = process.env.EIZEN_CONTRACT_ID;

		let eizenStats = null;
		if (fallbackContractId) {
			try {
				const eizenService = await EizenService.forContract(fallbackContractId);
				eizenStats = await eizenService.getStats();
			} catch (error) {
				logger.warn("Could not get Eizen stats for health check:", error);
			}
		}

		// Create memory service instance for health check
		let memoryStats = null;
		if (fallbackContractId) {
			try {
				const eizenService = await EizenService.forContract(fallbackContractId);
				const memoryService = new MemoryService(eizenService);
				memoryStats = await memoryService.getStats();
			} catch (error) {
				logger.warn("Could not get Memory stats for health check:", error);
			}
		}

		// Environment info
		const environment = {
			nodeEnv: process.env.NODE_ENV,
			nodeVersion: process.version,
			platform: process.platform,
			arch: process.arch,
		};

		// Get actual Redis connection status efficiently without logs
		const redisStatus = await checkRedisConnectivity();

		// Service configuration
		const embeddingInfo = embeddingService.getInfo();
		const allowedOrigins = process.env.ORIGIN?.split(",")
			.map((origin) => origin.trim())
			.filter((origin) => origin.length > 0) || ["http://localhost:3000"];

		const config = {
			arweaveGateway: process.env.ARWEAVE_GATEWAY,
			hasServiceWallet: !!process.env.SERVICE_WALLET_ADDRESS,
			hasEizenContract: !!process.env.EIZEN_CONTRACT_ID,
			redis: redisStatus,
			cors: {
				allowedOrigins,
				credentialsEnabled: true,
				originCount: allowedOrigins.length,
			},
			embeddingService: embeddingInfo.isInitialized ? "xenova" : "unavailable",
			architecture: "multi-tenant",
		};

		const healthData = {
			status: "healthy",
			timestamp: new Date().toISOString(),
			uptime: process.uptime(),
			service: "Context0 API",
			version: process.env.npm_package_version || "unknown",
			environment,
			config,
			services: {
				eizen: eizenStats
					? {
							initialized: eizenStats.isInitialized,
							totalVectors: eizenStats.totalVectors,
							contractId: eizenStats.contractId,
							note: "Stats from admin fallback contract",
						}
					: {
							status: "operational",
							note: "Service available - uses user-provided contract IDs",
							adminFallback:
								"not configured (optional for admin operations only)",
						},
				memory: memoryStats
					? {
							initialized: memoryStats.isInitialized,
							totalMemories: memoryStats.totalMemories,
							embeddingModel: embeddingInfo.isInitialized
								? embeddingInfo.model
								: "unavailable",
							note: "Stats from admin fallback contract",
						}
					: {
							status: "operational",
							embeddingService: embeddingInfo.isInitialized
								? "xenova"
								: "unavailable",
							embeddingModel: embeddingInfo.isInitialized
								? embeddingInfo.model
								: "unavailable",
							note: "Service available - uses user-provided contract IDs",
							adminFallback:
								"not configured (optional for admin operations only)",
						},
			},
		};

		res.json(successResponse(healthData, "Detailed health check completed"));
	} catch (error) {
		logger.error("Health check error:", error);
		res
			.status(503)
			.json(
				errorResponse(
					"Service degraded",
					error instanceof Error ? error.message : "Unknown error"
				)
			);
	}
});

/**
 * GET /health/eizen
 * Specific health check for Eizen service
 * Note: Uses fallback contract for system health checks
 */
router.get("/eizen", async (_req, res) => {
	try {
		const fallbackContractId = process.env.EIZEN_CONTRACT_ID;

		if (!fallbackContractId) {
			res.json(
				successResponse(
					{
						service: "Eizen Vector Database",
						status: "operational",
						message: "Service available - uses user-provided contract IDs",
						architecture: "multi-tenant",
						adminFallback:
							"not configured (optional for admin operations only)",
						parameters: {
							m: process.env.EIZEN_M || 16,
							efConstruction: process.env.EIZEN_EF_CONSTRUCTION || 200,
							efSearch: process.env.EIZEN_EF_SEARCH || 50,
						},
					},
					"Eizen service health check"
				)
			);
			return;
		}

		const eizenService = await EizenService.forContract(fallbackContractId);
		const stats = await eizenService.getStats();

		res.json(
			successResponse(
				{
					service: "Eizen Vector Database",
					status: stats.isInitialized ? "healthy" : "initializing",
					totalVectors: stats.totalVectors,
					contractId: stats.contractId,
					parameters: {
						m: process.env.EIZEN_M || 16,
						efConstruction: process.env.EIZEN_EF_CONSTRUCTION || 200,
						efSearch: process.env.EIZEN_EF_SEARCH || 50,
					},
					architecture: "multi-tenant",
				},
				"Eizen service health check"
			)
		);
	} catch (error) {
		logger.error("Eizen health check error:", error);
		res
			.status(503)
			.json(
				errorResponse(
					"Eizen service error",
					error instanceof Error ? error.message : "Unknown error"
				)
			);
	}
});

/**
 * GET /health/memory
 * Specific health check for Memory service
 * Note: Uses fallback contract for system health checks
 */
router.get("/memory", async (_req, res) => {
	try {
		const fallbackContractId = process.env.EIZEN_CONTRACT_ID;

		if (!fallbackContractId) {
			res.json(
				successResponse(
					{
						service: "Memory Management",
						status: "operational",
						message: "Service available - uses user-provided contract IDs",
						architecture: "multi-tenant",
						adminFallback:
							"not configured (optional for admin operations only)",
						embeddingService: embeddingService.getInfo().isInitialized
							? "xenova"
							: "unavailable",
						embeddingModel: embeddingService.getInfo().isInitialized
							? embeddingService.getInfo().model
							: "unavailable",
					},
					"Memory service health check"
				)
			);
			return;
		}

		const eizenService = await EizenService.forContract(fallbackContractId);
		const memoryService = new MemoryService(eizenService);
		const stats = await memoryService.getStats();

		res.json(
			successResponse(
				{
					service: "Memory Management",
					status: stats.isInitialized ? "healthy" : "initializing",
					totalMemories: stats.totalMemories,
					embeddingService: stats.embeddingService,
					configuration: {
						embeddingService: stats.embeddingService,
						embeddingModel: embeddingService.getInfo().isInitialized
							? embeddingService.getInfo().model
							: "unavailable",
					},
					architecture: "multi-tenant",
				},
				"Memory service health check"
			)
		);
	} catch (error) {
		logger.error("Memory health check error:", error);
		res
			.status(503)
			.json(
				errorResponse(
					"Memory service error",
					error instanceof Error ? error.message : "Unknown error"
				)
			);
	}
});

export default router;
