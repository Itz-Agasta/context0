import { eq } from "drizzle-orm";
import express from "express";
import { db } from "../db/db.js";
import { subscriptionsTable } from "../db/schema/subscriptions.js";
import { usersTable } from "../db/schema/users.js";
import { auth } from "../middlewares/auth.js";
import { verifyTransaction } from "../utils/etherscan.js";
import { logger } from "../config/winston.js";

/**
 * Webhook Routes for context0 API
 *
 * This module handles external webhook events from:
 * - Clerk (user authentication/registration)
 * - Web3 payments (subscription management)
 *
 * @module WebhookRoutes
 */
export const webhook = express.Router();

/**
 * Clerk User Registration Webhook
 *
 * Triggered when a new user registers via Clerk authentication.
 * Creates a new user record in the database with basic profile information.
 *
 * @route POST /webhook/clerk/registered
 *
 * @param {Object} req.body.data - Clerk user data payload
 * @param {Object[]} req.body.data.email_addresses - Array of user email addresses
 * @param {string} req.body.data.first_name - User's first name
 * @param {string} req.body.data.last_name - User's last name
 * @param {string} req.body.data.id - Clerk user ID
 *
 * @returns {Object} Success message confirmation
 *
 * @example
 * // Clerk sends this payload on user registration:
 * {
 *   "data": {
 *     "id": "user_clerk_id_123",
 *     "first_name": "Rupam",
 *     "last_name": "Golui",
 *     "email_addresses": [{"email_address": "idk@gmail.com"}]
 *   }
 * }
 */
webhook.post("/clerk/registered", async (req, res) => {
	// Extract user data from Clerk webhook payload
	const userData = req.body.data;
	const email = userData.email_addresses?.[0]?.email_address;
	const fullName = `${userData.first_name} ${userData.last_name}`;
	const clerkId = userData.id;

	// Create new user record in database
	const [user] = await db
		.insert(usersTable)
		.values({
			fullName,
			email,
			clerkId,
			metaMaskWalletAddress: "", // Placeholder, should be set after web3 pay
			status: "active", // Default status
			lastLoginAt: new Date(), // Set to current time
		})
		.returning();

	logger.info("User registered:", user);
	res.status(200).json({ message: "User registration received" });
});

/**
 * Web3 Payment Webhook for Subscription Management
 *
 * Processes cryptocurrency payments for context0 subscriptions.
 * Verifies blockchain transactions and creates/updates user subscriptions.
 *
 * @route POST /webhook/payments/web3
 *
 * @middleware auth - Requires valid JWT authentication
 * @param {string} req.body.txHash - Blockchain transaction hash to verify
 * @param {string} req.body.subscriptionPlan - Plan type: "basic" | "pro" | "enterprise"
 * @param {number} [req.body.quotaLimit=1000] - API call quota limit for the subscription
 *
 * @returns {Object} Subscription creation/update confirmation
 *
 * @example
 * // Frontend sends payment data:
 * {
 *   "txHash": "0x1234567890abcdef...",
 *   "subscriptionPlan": "pro",
 *   "quotaLimit": 10,000
 * }
 *
 * @workflow
 * 1. Authenticate user via JWT middleware
 * 2. Validate transaction on blockchain via Etherscan API
 * 3. Check if user has existing subscription
 * 4. Create new subscription OR update existing one
 * 5. Set 30-day renewal period
 */
webhook.post("/payments/web3", auth, async (req, res) => {
	// Extract payment data from request
	const txHash = req.body.txHash;
	const userId = req.userId; // Set by auth middleware
	const subscriptionPlan = req.body.subscriptionPlan;
	const quotaLimit = req.body.quotaLimit || 1000; // Default quota limit if not provided

	logger.info("Receieved payment webhook:✅");

	// Validate authentication
	if (!userId) {
		res.status(401).json({ error: "Unauthorized" });
		return;
	}

	// Verify user exists in database
	const user = await db.query.usersTable.findFirst({
		where: eq(usersTable.clerkId, userId),
	});
	if (!user) {
		res.status(404).json({ error: "User not found" });
		return;
	}

	// Validate required payment parameters
	if (!(txHash && userId && subscriptionPlan)) {
		res.status(400).json({ error: "Missing required fields" });
		return;
	}

	// Verify the blockchain transaction using Etherscan API
	const verifyTxn = await verifyTransaction(txHash);
	const result = verifyTxn.result;
	logger.info(result.data);

	// Process payment if transaction is valid
	if (result.isError === "0") {
		// Check if user already has a subscription
		const findSubscription = await db.query.subscriptionsTable.findFirst({
			where: eq(subscriptionsTable.clerkId, userId),
		});

		if (findSubscription) {
			// Update existing subscription with new plan and reset quota
			await db
				.update(subscriptionsTable)
				.set({
					plan: subscriptionPlan,
					quotaLimit,
					isActive: true,
					renewsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
					quotaUsed: 0, // Reset usage counter
				})
				.where(eq(subscriptionsTable.clerkId, userId));

			logger.info("User subscription updated", userId);
			res.status(200).json({ message: "Subscription updated", userId });
			return;
		}

		// Create new subscription for first-time subscriber
		await db.insert(subscriptionsTable).values({
			clerkId: userId,
			plan: subscriptionPlan,
			quotaLimit,
			isActive: true,
			renewsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
		});

		logger.info("User subscription created", userId);
		res.status(200).json({ message: "Subscription created", userId });
		return;
	}
	logger.error("Transaction error");
	res.status(400).json({ txHash, error: result.errDescription });
});
