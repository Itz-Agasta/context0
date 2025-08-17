import { eq } from "drizzle-orm";
import { Router } from "express";
import { db } from "../db/db.js";
import {
	subscriptionPlanEnum,
	subscriptionsTable,
} from "../db/schema/subscriptions.js";
import { usersTable } from "../db/schema/users.js";
import { auth } from "../middlewares/auth.js";
import { logger } from "../config/winston.js";

const router = Router();

// GET /subscriptions - Get user subscription by userId
/**
 * @route GET /subscriptions
 * @desc Get the authenticated user's subscription details
 * @access Private (requires auth middleware)
 *
 * @example Request:
 * GET /subscriptions
 * Headers: {
 *   "Authorization": "Bearer <jwt_token>"
 * }
 *
 * @example Response (Success):
 * {
 *   "success": true,
 *   "data": {
 *     "id": "123e4567-e89b-12d3-a456-426614174000",
 *     "clerkId": "user_123abc",
 *     "plan": "pro",
 *     "quotaLimit": 10000,
 *     "quotaUsed": 2450,
 *     "isActive": true,
 *     "renewsAt": "2025-07-30T00:00:00.000Z"
 *   }
 * }
 */
router.get("/", auth, async (req, res) => {
	try {
		const userId = req.userId;

		if (!userId) {
			res.status(400).json({
				success: false,
				message: "User ID is required",
			});
			return;
		}

		// Find user's subscription
		const subscription = await db
			.select()
			.from(subscriptionsTable)
			.where(eq(subscriptionsTable.clerkId, userId))
			.limit(1);

		if (subscription.length === 0) {
			res.status(404).json({
				success: false,
				message: "No subscription found for this user",
			});
			return;
		}

		res.status(200).json({
			success: true,
			data: subscription[0],
		});
	} catch (error) {
		logger.error("Error fetching subscription:", error);
		res.status(500).json({
			success: false,
			message: "Internal server error",
		});
	}
});

// POST /subscriptions - Create new subscription for user
/**
 * @route POST /subscriptions
 * @desc Create a new subscription for the authenticated user
 * @access Private (requires auth middleware)
 *
 * @example Request Body (Required fields):
 * {
 *   "plan": "pro",
 *   "renewsAt": "2025-07-30T00:00:00.000Z"
 * }
 *
 * @example Request Body (With optional quotaLimit):
 * {
 *   "plan": "enterprise",
 *   "quotaLimit": 50000,
 *   "renewsAt": "2025-12-31T23:59:59.000Z"
 * }
 *
 * @example Request:
 * POST /subscriptions
 * Headers: {
 *   "Authorization": "Bearer <jwt_token>",
 *   "Content-Type": "application/json"
 * }
 * Body: {
 *   "plan": "basic",
 *   "renewsAt": "2025-08-30T00:00:00.000Z"
 * }
 *
 * @example Response (Success):
 * {
 *   "success": true,
 *   "message": "Subscription created successfully",
 *   "data": {
 *     "id": "456e7890-f12c-34e5-b678-987654321000",
 *     "clerkId": "user_123abc",
 *     "plan": "basic",
 *     "quotaLimit": 1000,
 *     "quotaUsed": 0,
 *     "isActive": true,
 *     "renewsAt": "2025-08-30T00:00:00.000Z"
 *   }
 * }
 *
 * @param {string} plan - Subscription plan: "basic", "pro", or "enterprise"
 * @param {string} renewsAt - ISO date string for when subscription renews
 * @param {number} [quotaLimit] - Optional custom quota limit (defaults by plan: basic=1000, pro=10000, enterprise=100000)
 */
router.post("/", auth, async (req, res) => {
	try {
		const userId = req.userId;
		const { plan, quotaLimit, renewsAt } = req.body;

		if (!userId) {
			res.status(400).json({
				success: false,
				message: "User ID is required",
			});
			return;
		}

		// Validate required fields
		if (!(plan && renewsAt)) {
			res.status(400).json({
				success: false,
				message: "Plan and renewsAt are required fields",
			});
			return;
		}

		// Validate plan enum
		const validPlans = ["basic", "pro", "enterprise"];
		if (!validPlans.includes(plan)) {
			res.status(400).json({
				success: false,
				message: "Invalid plan. Must be one of: basic, pro, enterprise",
			});
			return;
		}

		// Parse and validate renewsAt once and reuse the Date instance
		const parsedRenewsAt = new Date(renewsAt);
		if (Number.isNaN(parsedRenewsAt.getTime())) {
			res.status(400).json({
				success: false,
				message: "Invalid renewsAt date",
			});
			return;
		}

		// Check if user exists
		const userExists = await db
			.select()
			.from(usersTable)
			.where(eq(usersTable.clerkId, userId))
			.limit(1);

		if (userExists.length === 0) {
			res.status(404).json({
				success: false,
				message: "User not found",
			});
			return;
		}

		// Check if user already has a subscription
		const existingSubscription = await db
			.select()
			.from(subscriptionsTable)
			.where(eq(subscriptionsTable.clerkId, userId))
			.limit(1);

		if (existingSubscription.length > 0) {
			res.status(409).json({
				success: false,
				message: "User already has a subscription",
			});
			return;
		}

		// Set default quota limit based on plan if not provided
		let finalQuotaLimit = quotaLimit;
		if (!finalQuotaLimit) {
			switch (plan) {
				case "basic":
					finalQuotaLimit = 1000;
					break;
				case "pro":
					finalQuotaLimit = 10_000;
					break;
				case "enterprise":
					finalQuotaLimit = 100_000;
					break;
				default:
					finalQuotaLimit = 1000;
			}
		}

		// Create new subscription
		const newSubscription = await db
			.insert(subscriptionsTable)
			.values({
				clerkId: userId,
				plan: plan as "basic" | "pro" | "enterprise",
				quotaLimit: finalQuotaLimit,
				quotaUsed: 0,
				isActive: true,
				renewsAt: parsedRenewsAt,
			})
			.returning();

		res.status(201).json({
			success: true,
			data: newSubscription[0],
			message: "Subscription created successfully",
		});
	} catch (error) {
		logger.error("Error creating subscription:", error);
		res.status(500).json({
			success: false,
			message: "Internal server error",
		});
	}
});

export default router;
