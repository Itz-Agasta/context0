import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config();

if (!process.env.DATABASE_URL) {
	// Warn instead of throwing so the app/container can start without a DB for development/testing.
	console.warn("DATABASE_URL environment variable is not set. Drizzle operations will be disabled until a valid DATABASE_URL is provided.");
} 

export default defineConfig({
	dialect: "postgresql",
	schema: "./src/db/schema",
	out: "./drizzle",
	dbCredentials: {
		url: process.env.DATABASE_URL,
	},
	verbose: true,
	strict: true,
});
