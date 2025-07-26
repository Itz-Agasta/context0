/**
 * ArchiveNET Infrastructure Helper Functions
 *
 * This module handles critical system operations including:
 *
 * - Detection and connectivity testing for local Arweave gateway (Arlocal)
 * - Production wallet validation and address verification
 * - Health check utilities for status monitoring and diagnostics
 */

import { Redis } from "ioredis";
import type { JWKInterface, Warp } from "warp-contracts";

/**
 * Checks if ArLocal is running on the specified port
 *
 * @usage
 * - `src/config/arweave.ts` - Used during Arweave initialization to detect ArLocal
 */
export async function checkArLocalRunning(port = 8080): Promise<boolean> {
	const controller = new AbortController();
	const id = setTimeout(() => controller.abort(), 1000);
	try {
		const response = await fetch(`http://localhost:${port}/info`, {
			signal: controller.signal,
		});
		return response.ok;
	} catch {
		return false;
	} finally {
		clearTimeout(id);
	}
}

/**
 * Validates that a loaded Arweave wallet matches the expected address
 *
 * @param wallet - The loaded JWK wallet object
 * @param expectedAddress - The expected wallet address from environment variable
 * @param walletSource - Description of wallet source for error messages (e.g., file path)
 * @param warp - Warp instance with arweave.wallets.jwkToAddress method
 * @returns Promise<string> - The validated wallet address
 *
 * @throws {Error} When wallet address doesn't match expected address
 *
 * @usage
 * - `src/config/arweave.ts` - Used during production wallet loading to validate wallet identity
 *
 */
export async function validateWalletAddress(
	wallet: JWKInterface,
	expectedAddress: string,
	walletSource: string,
	warp: {
		arweave: {
			wallets: { jwkToAddress: (wallet: JWKInterface) => Promise<string> };
		};
	},
): Promise<string> {
	const walletAddress = await warp.arweave.wallets.jwkToAddress(wallet);

	if (walletAddress !== expectedAddress) {
		console.error("❌ Wallet address mismatch detected!");
		console.error(`Expected: ${expectedAddress}`);
		console.error(`Loaded:   ${walletAddress}`);
		console.error(`Source:   ${walletSource}`);
		throw new Error(
			`Wallet address mismatch. Expected '${expectedAddress}' but loaded wallet has address '${walletAddress}'. Please verify the wallet file and expected address are correct.`,
		);
	}

	return walletAddress;
}

/**
 * Checks Redis connectivity without creating a persistent connection
 *
 * This function performs a lightweight connectivity test to Redis without
 * creating a long-lived connection. It's specifically designed for health
 * checks and status endpoints. Results are cached for 30 seconds to prevent
 * excessive Redis connections on frequent health checks.
 *
 * Uses the new Redis configuration style with REDIS_SERVER, REDIS_PORT, and REDIS_AUTH_KEY
 * environment variables to match the connection setup in redis.ts.
 *
 * @returns Promise<Object> - Connection status and details
 * @throws Never throws - all errors are caught and returned as status
 *
 * @usage
 * - `src/routes/health.ts` - Used in health endpoint to report real-time Redis status
 *
 */

// Cache for health check results to prevent excessive Redis connections
let healthCheckCache: {
	result: {
		configured: boolean;
		connected: boolean;
		status: string;
		details?: string;
	};
	timestamp: number;
} | null = null;

export async function checkRedisConnectivity(): Promise<{
	configured: boolean;
	connected: boolean;
	status: string;
	details?: string;
}> {
	// Return cached result if less than 30 seconds old
	if (healthCheckCache && Date.now() - healthCheckCache.timestamp < 30000) {
		return healthCheckCache.result;
	}

	const redisHost = process.env.REDIS_SERVER;
	const redisPort = process.env.REDIS_PORT;
	const redisPassword = process.env.REDIS_AUTH_KEY;

	if (!redisHost || !redisPort) {
		const result = {
			configured: false,
			connected: false,
			status: "not configured",
			details: "REDIS_SERVER or REDIS_PORT environment variables not set",
		};

		// Cache the result
		healthCheckCache = { result, timestamp: Date.now() };
		return result;
	}

	// Create a temporary Redis connection just for testing
	const testRedis = new Redis({
		host: redisHost,
		port: parseInt(redisPort, 10),
		password: redisPassword,
		connectTimeout: 2000,
		commandTimeout: 2000,
		lazyConnect: false,
		maxRetriesPerRequest: 1,
		family: 4, // Use IPv4
	});

	try {
		// Add error handler to prevent unhandled error events
		testRedis.on("error", () => {
			// Suppress errors - we're handling them in the catch block
		});

		// Test the connection with a quick ping and a timeout
		await Promise.race([
			testRedis.ping(),
			new Promise((_, reject) =>
				setTimeout(() => reject(new Error("Connection timeout")), 2000),
			),
		]);

		const result = {
			configured: true,
			connected: true,
			status: "ready",
			details: "Redis connection is healthy",
		};

		// Cache the result
		healthCheckCache = { result, timestamp: Date.now() };
		return result;
	} catch (error) {
		const result = {
			configured: true,
			connected: false,
			status: "disconnected",
			details: `Redis connection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
		};

		// Cache the result
		healthCheckCache = { result, timestamp: Date.now() };
		return result;
	} finally {
		// Always close the test connection to prevent socket leaks
		if (testRedis) {
			testRedis.disconnect();
		}
	}
}

/**
 * Checks if a wallet has sufficient balance for contract deployment
 *
 * @param warp - The Warp instance to check balance with
 * @param wallet - The wallet to check balance for
 * @param requiredBalance - Minimum required balance in Winston (default: 0.1 AR)
 * @returns Promise<{ hasBalance: boolean, currentBalance: string, walletAddress: string }>
 */
export async function checkWalletBalance(
	warp: Warp,
	wallet: JWKInterface,
	requiredBalance = "100000000000", // 0.1 AR in Winston
): Promise<{
	hasBalance: boolean;
	currentBalance: string;
	walletAddress: string;
	readableBalance: string;
}> {
	try {
		const walletAddress = await warp.arweave.wallets.jwkToAddress(wallet);
		const balance = await warp.arweave.wallets.getBalance(walletAddress); // Convert Winston to AR for display (1 AR = 1,000,000,000,000 Winston)
		const readableBalance = (
			Number.parseInt(balance, 10) / 1000000000000
		).toFixed(6);

		return {
			hasBalance:
				Number.parseInt(balance, 10) >= Number.parseInt(requiredBalance, 10),
			currentBalance: balance,
			walletAddress,
			readableBalance,
		};
	} catch (error) {
		console.error("Error checking wallet balance:", error);
		// If we can't check balance, assume it's insufficient
		return {
			hasBalance: false,
			currentBalance: "0",
			walletAddress: "unknown",
			readableBalance: "0",
		};
	}
}

/**
 * Logs wallet balance after an operation with a descriptive message
 *
 * @param warp - Warp instance for balance checking
 * @param wallet - JWK wallet object
 * @param operationType - Description of the operation (e.g., "deployment", "insert", "search")
 */
export async function logWalletBalanceAfterOperation(
	warp: Warp,
	wallet: JWKInterface,
	operationType: string,
): Promise<void> {
	try {
		const balanceInfo = await checkWalletBalance(warp, wallet);
		console.log(
			`Wallet balance after ${operationType}: ${balanceInfo.readableBalance} AR (${balanceInfo.walletAddress})`,
		);
	} catch (balanceError) {
		console.warn(
			`Could not check wallet balance after ${operationType}:`,
			balanceError,
		);
	}
}

/**
 * Provides wallet recharge instructions based on the current environment
 *
 * @param walletAddress - The wallet address to recharge
 * @returns Object with recharge instructions and tips
 */
export function getWalletRechargeInstructions(walletAddress: string): {
	instructions: string;
	tip: string;
	isProduction: boolean;
} {
	const isProduction = process.env.NODE_ENV?.trim() === "production";

	if (isProduction) {
		return {
			instructions: "Please acquire AR tokens from an exchange",
			tip: "For production deployment, ensure your wallet has sufficient AR tokens (typically at least 0.1 AR).",
			isProduction: true,
		};
	}

	return {
		instructions: `curl -X GET "http://localhost:8080/mint/${walletAddress}/100000000000000"`,
		tip: "This command adds 100 AR tokens to your wallet in the ArLocal development environment.",
		isProduction: false,
	};
}
