import { relations } from "drizzle-orm";
import {
	boolean,
	index,
	integer,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const subscriptionPlanEnum = pgEnum("subscription_plan", [
	"basic",
	"pro",
	"enterprise",
]);

/**
 * Subscriptions Table Schema
 *
 *@NOTE
 * - quotaLimit: Maximum API calls per billing period
 * - quotaUsed: Current usage counter (resets on renewal)
 * - Middleware checks quota before processing API requests
 */
export const subscriptionsTable = pgTable(
	"subscriptions",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		clerkId: text("clerk_id")
			.notNull()
			.references(() => usersTable.clerkId, { onDelete: "cascade" }),
		plan: subscriptionPlanEnum("plan").notNull(),
		quotaLimit: integer("quota_limit").notNull().default(1000),
		quotaUsed: integer("quota_used").notNull().default(0),
		isActive: boolean("is_active").notNull().default(true),
		renewsAt: timestamp("renews_at", { withTimezone: true }).notNull(),
	},
	(table) => ({
		clerkIdIdx: index("subscription_clerk_id_idx").on(table.clerkId),
		activeSubscriptionsIdx: index("active_subscriptions_idx").on(
			table.isActive,
		),
	}),
);

// Subscription ---> User Relationship (Many-to-One)
export const userSubscriptionRelations = relations(
	subscriptionsTable,
	({ one }) => ({
		user: one(usersTable, {
			fields: [subscriptionsTable.clerkId],
			references: [usersTable.clerkId],
		}),
	}),
);

// User ---> Subscription Relationship (One-to-One)
export const userRelations = relations(usersTable, ({ one }) => ({
	subscription: one(subscriptionsTable, {
		fields: [usersTable.clerkId],
		references: [subscriptionsTable.clerkId],
	}),
}));
