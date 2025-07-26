import { Redis } from "ioredis";

/**
 * Initializes Redis connection if REDIS_URL is provided
 *
 * Creates a resilient Redis connection with automatic reconnection capabilities.
 * The connection includes proper error handling, reconnection logic, and
 * connection monitoring for production stability.
 *
 * @returns Promise<Redis | undefined> - Redis instance if connection successful, undefined otherwise
 * @throws Never throws - all errors are caught and logged as warnings
 */
export async function initializeRedis(): Promise<Redis | undefined> {
	const redisHost = process.env.REDIS_SERVER;
	const redisPort = process.env.REDIS_PORT;
	const redisPassword = process.env.REDIS_AUTH_KEY;

	if (!redisHost || !redisPort) {
		console.log(
			"No Redis configuration provided, proceeding without Redis cache",
		);
		return undefined;
	}

	console.log(`Attempting to connect to Redis at PORT:${redisPort}...`);

	let redis: Redis | undefined;

	try {
		redis = new Redis({
			host: redisHost,
			port: parseInt(redisPort, 10),
			password: redisPassword,
			// Connection settings
			connectTimeout: 10000,
			commandTimeout: 5000,
			lazyConnect: false,
			maxRetriesPerRequest: 2,
			enableAutoPipelining: true,
			// Additional settings for external Redis
			enableReadyCheck: true,
			family: 4, // Use IPv4
		});

		// Track connection state to prevent spam
		let hasLoggedDisconnection = false;

		redis.on("ready", () => {
			console.log("✅ Redis connected successfully for caching");
			hasLoggedDisconnection = false; // Reset flag when connected
		});

		redis.on("error", (_err) => {
			// Only log disconnect once until reconnection
			if (!hasLoggedDisconnection) {
				console.warn("⚠️ Redis connection lost");
				hasLoggedDisconnection = true;
			}
		});

		// Suppress other events (connect, reconnecting, close, end)

		// Test initial connection
		await redis.ping();
		console.log("Redis ping successful - connection established");

		return redis;
	} catch (error) {
		console.warn(
			"❌ Redis initial connection failed, proceeding without caching",
			error,
		);

		return redis;
	}
}
