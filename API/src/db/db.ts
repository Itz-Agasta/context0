import "dotenv/config";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as keySchema from "./schema/keys.js";
import * as subscriptionSchema from "./schema/subscriptions.js";
import * as userSchema from "./schema/users.js";

const schema = {
	...userSchema,
	...subscriptionSchema,
	...keySchema,
};

const connectionString = process.env.DATABASE_URL;

let client: ReturnType<typeof postgres> | null = null;
let db: unknown;

if (!connectionString) {
	console.warn(
		"DATABASE_URL environment variable is not set. Database operations are disabled."
	);

	// Export a proxy that throws when any DB operation is attempted. This avoids crashing at startup
	// but surfaces a clear error at runtime if code tries to use the DB.
	client = null;
	db = new Proxy(
		{},
		{
			get() {
				throw new Error(
					"DATABASE_URL is not set. Database operations are disabled. Provide a valid DATABASE_URL to enable DB functionality."
				);
			},
			apply() {
				throw new Error(
					"DATABASE_URL is not set. Database operations are disabled. Provide a valid DATABASE_URL to enable DB functionality."
				);
			},
		}
	);
} else {
	// Disable prefetch as it is not supported for "Transaction" pool mode
	client = postgres(connectionString, { prepare: false });
	db = drizzle(client, { schema });
}

/**
 * Initialize database connection and perform connectivity check
 * This function should be called during application startup to ensure
 * the database connection is properly established and logged
 */
export async function initializeDatabase(): Promise<void> {
	if (!client) {
		return; // Database is disabled
	}

	try {
		await client`SELECT 1`;
		console.info("Database connection established.");
	} catch (err) {
		console.error(
			"Database connectivity check failed:",
			err instanceof Error ? err.message : String(err)
		);
	}
}

export { client, db };
