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
if (!connectionString) {
	throw new Error("DATABASE_URL environment variable is not set");
}

// Disable prefetch as it is not supported for "Transaction" pool mode
export const client = postgres(connectionString, { prepare: false });
export const db = drizzle(client, { schema });
