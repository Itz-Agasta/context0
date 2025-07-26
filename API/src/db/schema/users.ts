import {
	index,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";

export const userStatusEnum = pgEnum("user_status", [
	"active",
	"suspended",
	"deleted",
]);

/**
 * Users Table Schema
 *
 * @Relationships
 * - One-to-One with subscriptions table
 * - One-to-Many with keys table (API key instances)
 */
export const usersTable = pgTable(
	"users",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		clerkId: text("clerk_id").notNull().unique(),
		fullName: text("full_name").notNull(),
		email: text("email").notNull().unique(),
		metaMaskWalletAddress: text("meta_mask_wallet_address").unique(),
		status: userStatusEnum("status").notNull().default("active"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()), // Auto-update on changes
		lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
	},
	(table) => ({
		clerkIdIdx: index("clerk_id_idx").on(table.clerkId),
	}),
);
