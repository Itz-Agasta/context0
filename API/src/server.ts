/**
 * Context0 API Server
 *
 * A semantic memory API service powered by vector embeddings and blockchain storage.
 * Provides enterprise-grade memory management with AI-powered search capabilities.
 *
 * @author TeamVyse
 * @email admin@context0.tech
 * @license MIT
 * @copyright 2025 TeamVyse. All rights reserved.
 */

import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import { arLocalService } from "./config/arlocal.js";
import { logger } from "./config/winston.js";
import { initializeDatabase } from "./db/db.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { EizenService } from "./services/EizenService.js";
import { embeddingService } from "./services/EmbeddingService.js";

dotenv.config();

async function initializeServices() {
	logger.info("Initializing Context0 API...");
	// Start ArLocal first in development mode
	if (process.env.NODE_ENV !== "production") {
		logger.info("Starting ArLocal for development environment...");
		try {
			if (!arLocalService.isArLocalRunning()) {
				await arLocalService.start();
			}
		} catch (error) {
			logger.warn("⚠️ Failed to start ArLocal:", (error as Error).message);
			logger.warn("Continuing with testnet fallback...");
		}
	}
	// Initialize vector embedding service first (required by other services)
	await embeddingService.ensureInitialized();
	// Initialize database connection
	await initializeDatabase();
	// Initialize semantic search configuration (includes Redis initialization)
	await EizenService.initEizenConfig();

	logger.info("Context0 is ready to handle user requests");
}

// Bootstrap application startup
initializeServices()
	.then(async () => {
		// Dynamic route imports ensure services are initialized before route handlers
		const healthRoutes = await import("./routes/health.js");
		const memoryRoutes = await import("./routes/memories.js");
		const adminRoutes = await import("./routes/admin.js");
		const deploymentRoutes = await import("./routes/deploy.js");
		const { webhook } = await import("./routes/webhook.js");
		const subscriptionRoutes = await import("./routes/subscriptions.js");
		const instancesRoutes = await import("./routes/instances.js");

		const app = express();
		const PORT = Number.parseInt(process.env.PORT || "3000", 10);

		// Configure CORS for multiple frontend environments
		const allowedOriginsEnv = process.env.ORIGIN
			? process.env.ORIGIN
				.split(",")
				.map((o) => o.trim())
				.filter((o) => o.length > 0)
			: [];

		const allowedOrigins =
			allowedOriginsEnv.length > 0 ? allowedOriginsEnv : ["http://localhost:3000"];

		const corsOptions: cors.CorsOptions = {
			origin: (
				origin: string | undefined,
				callback: (error: Error | null, allow?: boolean) => void
			) => {
				// Allow requests without origin (mobile apps, Postman, etc.)
				if (!origin || allowedOrigins.includes(origin)) {
					callback(null, true);
				} else {
					callback(new Error(`Not allowed by CORS: ${origin}`));
				}
			},
			credentials: true, // Enable cookies and authentication headers
		};

		// Core middleware stack
		app.use(express.json());
		app.use(express.urlencoded({ extended: true }));
		app.use(cors(corsOptions));
		app.use(helmet());

		// API information endpoint
		app.get("/", (_req, res) => {
			res.json({
				name: "Context0 API",
				description:
					"Decentralized Semantic memory management with AI-powered search",
				version: "1.0.0",
				license: "MIT",
				copyright: "© 2025 TeamVyse. All rights reserved.",
				contact: "admin@context0.com",
				documentation: "/health",
			});
		});

		// API route registration
		app.use("/health", healthRoutes.default);
		app.use("/admin", adminRoutes.default);
		app.use("/memories", memoryRoutes.default);
		app.use("/deploy", deploymentRoutes.default);
		app.use("/webhook", webhook);
		app.use("/subscriptions", subscriptionRoutes.default);
		app.use("/instances", instancesRoutes.default);

		// Global error handling middleware (must be last)
		app.use(errorHandler);

		// Start HTTP server with graceful error handling
		app
			.listen(PORT, () => {
				logger.info(`Context0 API server running on port ${PORT}`);
				logger.info(`Health endpoint: http://localhost:${PORT}/health`);
			})
			.on("error", (error) => {
				logger.error("❌ Failed to start server:", error.message);
				throw new Error(error.message);
			});
	})
	.catch((error) => {
		logger.error("Failed to initialize services:", error);
		process.exit(1);
	});
