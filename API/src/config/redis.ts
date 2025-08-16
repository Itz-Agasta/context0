import { Redis } from "ioredis";

/**
 * Initializes Redis connection based on environment
 *
 * Development: Uses local Redis (localhost:6379 or Docker Compose redis service)
 * Production: Uses AWS hosted Redis with authentication
 *
 * Creates a resilient Redis connection with automatic reconnection capabilities.
 * The connection includes proper error handling, reconnection logic, and
 * connection monitoring for production stability.
 *
 * @returns Promise<Redis | undefined> - Redis instance if connection successful, undefined otherwise
 * @throws Never throws - all errors are caught and logged as warnings
 */
export async function initializeRedis(): Promise<Redis | undefined> {
	const nodeEnv = process.env.NODE_ENV || 'development';
	
	let redisConfig: {
		host: string;
		port: number;
		password?: string;
	};

	if (nodeEnv === 'development') {
		// Development: Use local Redis or Docker Compose Redis
		const localRedisHost = process.env.REDIS_URL?.includes('redis://') 
			? process.env.REDIS_URL.replace('redis://', '').split(':')[0]
			: process.env.REDIS_HOST || 'localhost';
		
		redisConfig = {
			host: localRedisHost,
			port: 6379,
			// No password for local development
		};
		
		console.log(`Development mode: Connecting to local Redis at ${redisConfig.host}:${redisConfig.port}...`);
	} else {
		// Production: Use AWS hosted Redis with authentication
		const redisHost = process.env.REDIS_SERVER;
		const redisPort = process.env.REDIS_PORT;
		const redisPassword = process.env.REDIS_AUTH_KEY;

		if (!redisHost || !redisPort) {
			console.log(
				"No Redis configuration provided for production, proceeding without Redis cache",
			);
			return undefined;
		}

		redisConfig = {
			host: redisHost,
			port: parseInt(redisPort, 10),
			password: redisPassword,
		};
		
		console.log(`Production mode: Connecting to AWS Redis at ${redisConfig.host}:${redisConfig.port}...`);
	}

	let redis: Redis | undefined;

	try {
		const connectionOptions = {
			host: redisConfig.host,
			port: redisConfig.port,
			password: redisConfig.password,
			// Connection settings
			connectTimeout: 10000,
			commandTimeout: 5000,
			lazyConnect: false,
			maxRetriesPerRequest: nodeEnv === 'development' ? 1 : 2,
			enableAutoPipelining: true,
			// Additional settings
			enableReadyCheck: true,
			family: 4, // Use IPv4
		};

		// Remove password if not provided (for development)
		if (!redisConfig.password) {
			delete connectionOptions.password;
		}

		redis = new Redis(connectionOptions);

		// Track connection state to prevent spam
		let hasLoggedDisconnection = false;

		redis.on("ready", () => {
			const envLabel = nodeEnv === 'development' ? '🔧 Local' : '🚀 AWS';
			console.log(`✅ ${envLabel} Redis connected successfully for caching`);
			hasLoggedDisconnection = false; // Reset flag when connected
		});

		redis.on("error", (_err) => {
			// Only log disconnect once until reconnection
			if (!hasLoggedDisconnection) {
				const envLabel = nodeEnv === 'development' ? 'Local' : 'AWS';
				console.warn(`⚠️ ${envLabel} Redis connection lost`);
				hasLoggedDisconnection = true;
			}
		});

		// Suppress other events (connect, reconnecting, close, end)

		// Test initial connection
		await redis.ping();
		const envLabel = nodeEnv === 'development' ? 'Local' : 'AWS';
		console.log(`Redis ping successful - ${envLabel} connection established`);

		return redis;
	} catch (error) {
		const envLabel = nodeEnv === 'development' ? 'Local' : 'AWS';
		console.warn(
			`❌ ${envLabel} Redis initial connection failed, proceeding without caching`,
			error,
		);

		return redis;
	}
}
