import { relations } from "drizzle-orm";
import {
	boolean,
	index,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/**
 * Keys Table Schema
 *
 * @Notes
 * - One user can have multiple API keys (1:N relationship)
 * - Each key can be independently activated/deactivated
 * - Keys link to the the Arweave wallet used to deploy its contract
 */
export const keysTable = pgTable(
	"keys",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		clerkId: text("clerk_id")
			.notNull()
			.references(() => usersTable.clerkId, { onDelete: "cascade" }),
		instanceKeyHash: text("instance_key_hash").notNull().unique(),
		arweaveWalletAddress: text("arweave_wallet_address"),
		isActive: boolean("is_active").notNull().default(false),
		lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
	},
	(table) => ({
		clerkIdIdx: index("keys_clerk_idx").on(table.clerkId),
		activeKeysIdx: index("keys_active_idx").on(table.isActive),
		instanceKeyHashIdx: index("keys_hash_idx").on(table.instanceKeyHash),
	}),
);

// Keys ---> Users Relationship (many-to-one)
export const keyRelations = relations(keysTable, ({ one }) => ({
	user: one(usersTable, {
		fields: [keysTable.clerkId],
		references: [usersTable.clerkId],
	}),
}));

// Users ---> keys Relationship (one-to-many)
export const userKeyRelations = relations(usersTable, ({ many }) => ({
	keys: many(keysTable),
}));
