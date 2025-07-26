import { eq } from "drizzle-orm";
import { db } from "../db/db.js";
import { subscriptionsTable } from "../db/schema/subscriptions.js";

export interface QuotaCheckResult {
	allowed: boolean;
	currentUsage: number;
	limit: number;
	remaining: number;
	error?: string;
}

export interface QuotaUpdateResult {
	success: boolean;
	newUsage: number;
	error?: string;
}

/**
 * Check if user has quota available for API operations
 * @param clerkId - User's Clerk ID
 * @returns Promise<QuotaCheckResult> - Quota check result
 */
export async function checkQuota(clerkId: string): Promise<QuotaCheckResult> {
	try {
		const subscription = await db.query.subscriptionsTable.findFirst({
			where: eq(subscriptionsTable.clerkId, clerkId),
		});

		if (!subscription) {
			return {
				allowed: false,
				currentUsage: 0,
				limit: 0,
				remaining: 0,
				error: "No subscription found for user",
			};
		}

		if (!subscription.isActive) {
			return {
				allowed: false,
				currentUsage: subscription.quotaUsed,
				limit: subscription.quotaLimit,
				remaining: 0,
				error: "Subscription is not active",
			};
		}

		const remaining = subscription.quotaLimit - subscription.quotaUsed;
		const allowed = remaining > 0;

		return {
			allowed,
			currentUsage: subscription.quotaUsed,
			limit: subscription.quotaLimit,
			remaining,
		};
	} catch (error) {
		console.error("Error checking quota:", error);
		return {
			allowed: false,
			currentUsage: 0,
			limit: 0,
			remaining: 0,
			error: "Failed to check quota",
		};
	}
}

/**
 * Increment user's quota usage by specified amount
 * @param clerkId - User's Clerk ID
 * @param increment - Amount to increment (default: 1)
 * @returns Promise<QuotaUpdateResult> - Update result
 */
export async function incrementQuotaUsage(
	clerkId: string,
	increment: number = 1,
): Promise<QuotaUpdateResult> {
	try {
		// First, get current subscription
		const subscription = await db.query.subscriptionsTable.findFirst({
			where: eq(subscriptionsTable.clerkId, clerkId),
		});

		if (!subscription) {
			return {
				success: false,
				newUsage: 0,
				error: "No subscription found for user",
			};
		}

		const newUsage = subscription.quotaUsed + increment;

		// Update the quota usage
		await db
			.update(subscriptionsTable)
			.set({
				quotaUsed: newUsage,
			})
			.where(eq(subscriptionsTable.clerkId, clerkId));

		console.log(
			`Updated quota for user ${clerkId}: ${subscription.quotaUsed} -> ${newUsage}`,
		);

		return {
			success: true,
			newUsage,
		};
	} catch (error) {
		console.error("Error updating quota:", error);
		return {
			success: false,
			newUsage: 0,
			error: "Failed to update quota",
		};
	}
}

/**
 * Get user's current subscription details including quota info
 * @param clerkId - User's Clerk ID
 * @returns Promise with subscription details or null
 */
export async function getUserSubscription(clerkId: string) {
	try {
		return await db.query.subscriptionsTable.findFirst({
			where: eq(subscriptionsTable.clerkId, clerkId),
		});
	} catch (error) {
		console.error("Error fetching user subscription:", error);
		return null;
	}
}
