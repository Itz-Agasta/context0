import type { Redis } from "ioredis";
import type { JWKInterface } from "warp-contracts";
import { defaultCacheOptions, type Warp, WarpFactory } from "warp-contracts";
import { DeployPlugin } from "warp-contracts-plugin-deploy";
import { RedisCache } from "warp-contracts-redis";
import { checkWalletBalance, validateWalletAddress } from "../utils/helper.js";
import { arLocalService } from "./arlocal.js";
import { initializeRedis } from "./redis.js";

/**
* Configuration interface for Arweave blockchain connection.
*
* This interface defines the complete setup required for ArchiveNET to interact
* with the Arweave blockchain through Warp Contracts, including wallet authentication,

* caching infrastructure (Redis), and network configuration.
*
* @interface ArweaveConfig
* @property {Warp} warp - Configured Warp instance for blockchain interactions
* @property {JWKInterface} wallet - Arweave wallet for transaction signing
* @property {Redis} redis - Optional Redis instance for contract state caching
*/

export interface ArweaveConfig {
	warp: Warp;
	wallet: JWKInterface;
	redis?: Redis;
}

/**
* Initializes and configures the complete Arweave blockchain infrastructure for ArchiveNET.
*
* This function sets up a production-ready blockchain connection with automatic
* environment detection, wallet management, and multi-tier caching. It handles:
* - Network selection (mainnet for production, ArLocal for development with testnet fallback)
* - Wallet loading from environment variables (production) or dev-wallet.json (development)
* - Redis caching integration for improved performance (delegated to helper function)
* - Contract deployment capabilities through DeployPlugin
*

* **Wallet Management:**
* - **Production**: Loads wallet from file specified by `ARWEAVE_WALLET_PATH` and validates it matches `SERVICE_WALLET_ADDRESS` (throws error if missing/invalid/mismatched)
* - **Development**: Uses existing `./dev-wallet.json` or creates new one automatically if missing
*
* **Cache Hierarchy:**

* 1. Redis Cache (primary) - Fast in-memory contract state caching (optional, via initializeRedis helper)
* 2. LevelDB Cache (fallback) - Local filesystem caching via Warp (default)
* 3. Arweave Network (source) - Direct blockchain queries as last resort
*
* @returns {Promise<ArweaveConfig>} Promise resolving to complete Arweave configuration
* 
* @throws {Error} When production wallet file is missing, unreadable, or invalid JSON
* @throws {Error} When production wallet address doesn't match SERVICE_WALLET_ADDRESS
* @throws {Error} When production environment variables (SERVICE_WALLET_ADDRESS, ARWEAVE_WALLET_PATH) are not set
*/

export async function initializeArweave(): Promise<ArweaveConfig> {
	const isProduction = process.env.NODE_ENV?.trim() === "production";
	// Initialize Redis connection for both production and development
	const redis = await initializeRedis();

	// Create Warp instance with appropriate network
	let warp: Warp;

	if (isProduction) {
		// Production: Use Arweave mainnet with Redis caching if available
		warp = redis
			? WarpFactory.forMainnet(undefined, true).useKVStorageFactory(
					(contractTxId: string) =>
						new RedisCache(
							{ ...defaultCacheOptions, dbLocation: `${contractTxId}` },
							{ client: redis },
						),
				)
			: WarpFactory.forMainnet(undefined, true); // Fallback: mainnet without Redis caching

		console.log(
			"Configured for Arweave mainnet (production) using https://arweave.net gateway",
		);
	} else {
		// Development: Use ArLocal if already running, otherwise start it
		const ARLOCAL_PORT = 1984; // Match ArLocal service port
		try {
			// Check if ArLocal is already running, if not start it
			if (!arLocalService.isArLocalRunning()) {
				console.log("ArLocal not running, starting it now...");
				await arLocalService.start();
			}
			warp = redis
				? WarpFactory.forLocal(ARLOCAL_PORT).useKVStorageFactory(
						(contractTxId: string) =>
							new RedisCache(
								{ ...defaultCacheOptions, dbLocation: `${contractTxId}` },
								{ client: redis },
							),
					)
				: WarpFactory.forLocal(ARLOCAL_PORT);

			console.log(
				`Configured for ArLocal development server on PORT:${ARLOCAL_PORT}`,
			);
		} catch (error) {
			console.warn("Failed to start ArLocal:", (error as Error).message);
			console.warn("Falling back to Warp Testnet...");
			console.warn("⚠️ Some endpoints may not work as expected in testnet mode");

			// FALLBACK: Use testnet when ArLocal startup fails
			warp = redis
				? WarpFactory.forTestnet(undefined, true).useKVStorageFactory(
						(contractTxId: string) =>
							new RedisCache(
								{ ...defaultCacheOptions, dbLocation: `${contractTxId}` },

								{ client: redis },
							),
					)
				: WarpFactory.forTestnet(undefined, true);
		}
	}

	warp.use(new DeployPlugin()); // Enable SmartWeave contract deployment capabilities

	// Initialize wallet based on environment with strict separation
	let wallet: JWKInterface;

	if (isProduction) {
		// PRODUCTION MODE: Strict wallet loading from environment variables
		if (process.env.SERVICE_WALLET_ADDRESS && process.env.ARWEAVE_WALLET_PATH) {
			try {
				const { readFile } = await import("node:fs/promises");
				const walletPath = process.env.ARWEAVE_WALLET_PATH;
				const expectedAddress = process.env.SERVICE_WALLET_ADDRESS;
				wallet = JSON.parse(await readFile(walletPath, "utf-8"));
				// Validate wallet address using helper function
				const walletAddress = await validateWalletAddress(
					wallet,
					expectedAddress,
					walletPath,
					warp,
				);

				console.log("Production wallet loaded successfully");
				console.log(`Wallet Source: ${walletPath}`);
				console.log(`Wallet Address: ${walletAddress}`);
				console.log("Wallet validation passed.");
			} catch (error) {
				console.error("❌ Failed to load production wallet:", error);

				throw new Error(
					"Production wallet is required but could not be loaded. Please check ARWEAVE_WALLET_PATH and ensure the wallet file exists and contains valid JSON.",
				);
			}
		} else {
			throw new Error(
				"Production environment requires both SERVICE_WALLET_ADDRESS and ARWEAVE_WALLET_PATH environment variables to be set.",
			);
		}
	} else {
		// DEVELOPMENT MODE: Auto-managed dev-wallet.json
		const devWalletPath = process.env.ARWEAVE_WALLET_PATH || "dev-wallet.json";
		try {
			// Attempt to load existing development wallet
			const { readFile } = await import("node:fs/promises");
			wallet = JSON.parse(await readFile(devWalletPath, "utf-8"));
			const walletAddress = await warp.arweave.wallets.jwkToAddress(wallet);
			console.log("Development wallet loaded from existing file");
			console.log(`Wallet Source: ${devWalletPath}`);
			console.log(`Wallet Address: ${walletAddress}`);

			// Fund the wallet if using ArLocal
			if (arLocalService.isArLocalRunning()) {
				await fundDevelopmentWallet(warp, wallet, walletAddress);
			}
		} catch (_error) {
			// Generate and save new development wallet if file doesn't exist
			console.log("Development wallet not found, creating new one...");
			wallet = await warp.arweave.wallets.generate();
			const walletAddress = await warp.arweave.wallets.jwkToAddress(wallet);

			// Persist the wallet for future development sessions
			const { writeFile } = await import("node:fs/promises");
			await writeFile(devWalletPath, JSON.stringify(wallet, null, 2));
			console.log("New development wallet created and saved");
			console.log(`Wallet Source: ${devWalletPath}`);
			console.log(`Wallet Address: ${walletAddress}`);
			console.log(
				"For production deployment, configure SERVICE_WALLET_ADDRESS and ARWEAVE_WALLET_PATH environment variables",
			);

			// Fund the newly created wallet if using ArLocal
			if (arLocalService.isArLocalRunning()) {
				await fundDevelopmentWallet(warp, wallet, walletAddress);
			}
		}
	}

	console.log(
		`Arweave blockchain configured for ${isProduction ? "production" : "development"} environment`,
	);

	return {
		warp,
		wallet,
		redis,
	};
}

/**
 * Funds a wallet in ArLocal development environment
 * @param warp - Warp instance configured for ArLocal
 * @param wallet - JWK wallet to fund
 * @param address - Wallet address
 */

async function fundDevelopmentWallet(
	warp: Warp,
	wallet: JWKInterface,
	address: string,
): Promise<void> {
	try {
		// Fund the wallet with 10 AR (10000000000000000 winston)
		const response = await warp.arweave.api.get(
			`mint/${address}/10000000000000000`,
		);

		if (response.status === 200) {
			// Check and log the wallet balance after funding
			const balanceInfo = await checkWalletBalance(warp, wallet);
			console.log(`Adding 10000 AR on dev wallet ${address}`);
			console.log(`Current wallet balance: ${balanceInfo.readableBalance} AR`);
		} else {
			console.warn("Failed to fund development wallet:", response.status);
		}
	} catch (error) {
		console.warn(
			"Failed to fund development wallet:",
			(error as Error).message,
		);
	}
}
