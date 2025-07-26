import type { InferSelectModel } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { db } from "../db/db.js";
import { keysTable } from "../db/schema/keys.js";
import { subscriptionsTable } from "../db/schema/subscriptions.js";
import { usersTable } from "../db/schema/users.js";
import { generateContractHash } from "../utils/contract.js";
import { EizenService } from "./EizenService.js";
import { mailService } from "./mailService.js";

export interface DeploymentResult {
	success: boolean;
	data?: {
		contractId: string;
		contractHashFingerprint: string;
		userId: string;
		deployedAt: string;
		keyId: string;
	};
	error?: string;
}

export interface ContractHashData {
	contractHashFingerprint: string; // Public-facing hash fingerprint
	hashedContractKey: string; // Internal hashed contract key for database storage
}

type UserSubscription = InferSelectModel<typeof subscriptionsTable>;
type UserKey = InferSelectModel<typeof keysTable>;

/**
 * Validates user subscription status and ensures they have an active plan
 */
export async function validateUserSubscription(userId: string): Promise<{
	valid: boolean;
	subscription?: UserSubscription;
	error?: string;
}> {
	try {
		// Query the database for the user's subscription record
		const subscription = await db.query.subscriptionsTable.findFirst({
			where: eq(subscriptionsTable.clerkId, userId),
		});

		// Check if subscription exists
		if (!subscription) {
			return { valid: false, error: "User subscription not found" };
		}

		// Validate that a plan is assigned
		if (!subscription.plan) {
			return { valid: false, error: "User subscription tier not found" };
		}

		// Ensure subscription is currently active
		if (!subscription.isActive) {
			return { valid: false, error: "User subscription is not active" };
		}

		return { valid: true, subscription };
	} catch (error) {
		console.error("Error validating subscription:", error);
		return { valid: false, error: "Failed to validate subscription" };
	}
}

/**
 * Validates user key record and ensures no existing contract deployment
 */
export async function validateUserKey(
	userId: string,
): Promise<{ valid: boolean; key?: UserKey; error?: string }> {
	try {
		// Fetch existing key record for the user
		const existingKey = await db.query.keysTable.findFirst({
			where: eq(keysTable.clerkId, userId),
		});

		// Ensure user has a key record
		if (!existingKey) {
			return { valid: false, error: "No key record found for user" };
		}

		// Check if contract has already been deployed for this user
		// instanceKeyHash is populated when a contract is successfully deployed
		if (existingKey.instanceKeyHash && existingKey.instanceKeyHash !== "") {
			return { valid: false, error: "Contract already exists for user" };
		}

		return { valid: true, key: existingKey };
	} catch (error) {
		console.error("Error validating user key:", error);
		return { valid: false, error: "Failed to validate user key" };
	}
}

/**
 * Deploys a new Eizen contract to the Arweave blockchain
 * @returns {Promise<{success: boolean, contractId?: string, walletAddress?: string, error?: string}>}
 *          Deployment result with contract ID and wallet address if successful
 */
export async function deployContract(): Promise<{
	success: boolean;
	contractId?: string;
	walletAddress?: string;
	error?: string;
}> {
	try {
		// Delegate to EizenService for actual contract deployment
		const deployResult = await EizenService.deployNewContract();
		const contractId = deployResult.contractId;
		const walletAddress = deployResult.walletAddress;

		// Validate that deployment was successful and returned a contract ID
		if (!contractId) {
			return { success: false, error: "Failed to deploy contract on Arweave" };
		}

		console.log(`Contract deployed successfully: ${contractId}`);
		return { success: true, contractId, walletAddress };
	} catch (error) {
		console.error("Error deploying contract:", error);
		return { success: false, error: "Contract deployment failed" };
	}
}

/**
 * Generates contract hash and updates user's key record in the database
 *
 * This function performs the critical post-deployment steps:
 * - Generates a unique contract hash using the contract ID and user ID
 * - Updates the user's key record with the contract information
 * - Activates the key record
 * - Returns both public and internal hash data
 *
 * @param {string} contractTxId - Arweave transaction ID of the deployed contract
 * @param {string} userId - Clerk user ID who owns the contract
 * @param {string} walletAddress - Arweave wallet address used to deploy the contract
 * @returns {Promise<{success: boolean, hashData?: ContractHashData, updatedKey?: UserKey, error?: string}>}
 *          Processing result with hash data and updated key record
 *
 */
export async function processContractHash(
	contractTxId: string,
	userId: string,
	walletAddress: string,
): Promise<{
	success: boolean;
	hashData?: ContractHashData;
	updatedKey?: UserKey;
	error?: string;
}> {
	try {
		// Debug: Log the values being processed
		console.log(`DEBUG - Processing contract hash:
  - contractTxId: ${contractTxId}
  - userId: ${userId}
  - walletAddress: ${walletAddress}`);

		// Generate the contract hash using utility function
		const contractHash = generateContractHash(contractTxId, userId);
		if (!contractHash) {
			return { success: false, error: "Failed to generate contract hash" };
		}

		const { contractHashFingerprint, hashedContractKey } = contractHash;

		// Update the user's key record with contract information
		// This marks the deployment as complete and activates the key
		const [updatedKey] = await db
			.update(keysTable)
			.set({
				instanceKeyHash: hashedContractKey, // Store hashed version for security
				arweaveWalletAddress: walletAddress, // Store wallet address used for deployment
				isActive: true, // Activate the key
			})
			.where(eq(keysTable.clerkId, userId))
			.returning();

		// Validate that the database update was successful
		if (!updatedKey) {
			return {
				success: false,
				error: "Failed to update contract hash in database",
			};
		}

		console.log(
			`Updated contract hash for user ${userId}, wallet: ${walletAddress}`,
		);

		return {
			success: true,
			hashData: { contractHashFingerprint, hashedContractKey },
			updatedKey,
		};
	} catch (error) {
		console.error("Error processing contract hash:", error);
		return { success: false, error: "Failed to process contract hash" };
	}
}

/**
 * Main deployment orchestrator - Coordinates the complete contract deployment workflow
 *
 * This is the primary function that handles the end-to-end deployment process:
 * 1. Validates user subscription status and plan
 * 2. Checks user key record and prevents duplicate deployments
 * 3. Deploys the contract to Arweave blockchain
 * 4. Generates and stores contract hash in database
 * 5. Returns comprehensive deployment information
 *
 * The function follows a fail-fast approach, returning early on any validation failure
 * to prevent unnecessary operations.
 *
 * @param {string} userId - Clerk user ID requesting contract deployment
 * @returns {Promise<DeploymentResult>} Complete deployment result with all relevant data
 *
 * @throws {Error} When unexpected errors occur during the deployment process
 *
 * @example
 * ```typescript
 * const deployment = await deployForUser("user_clerkId123");
 * if (deployment.success) {
 *   const { contractTxId, contractHashFingerprint } = deployment.data;
 *   // Notify user of successful deployment
 *   await sendDeploymentEmail(userId, contractTxId);
 * } else {
 *   // Handle deployment failure
 *   console.error(deployment.error);
 * }
 * ```
 */
export async function deployForUser(userId: string): Promise<DeploymentResult> {
	try {
		// Step 1: Validate user subscription
		// Ensures user has paid and has an active subscription
		const subscriptionValidation = await validateUserSubscription(userId);
		if (!subscriptionValidation.valid) {
			return { success: false, error: subscriptionValidation.error };
		}

		// Step 2: Validate user key record
		// Prevents duplicate deployments and ensures user is properly onboarded
		const keyValidation = await validateUserKey(userId);
		if (!keyValidation.valid) {
			return { success: false, error: keyValidation.error };
		}

		// Step 3: Deploy contract to Arweave
		// This is the core blockchain operation
		const deployment = await deployContract();
		if (!deployment.success) {
			return { success: false, error: deployment.error };
		}

		// Step 4: Process contract hash and update database
		// Finalizes the deployment by storing contract information
		const hashProcessing = await processContractHash(
			deployment.contractId as string,
			userId,
			deployment.walletAddress as string,
		);
		if (!hashProcessing.success) {
			return { success: false, error: hashProcessing.error };
		}

		// Step 5: Prepare deployment result data
		const deploymentData = {
			contractId: deployment.contractId as string,
			contractHashFingerprint: (hashProcessing.hashData as ContractHashData)
				.contractHashFingerprint,
			userId,
			deployedAt: new Date().toISOString(),
			keyId: (hashProcessing.updatedKey as UserKey).id,
		};

		// Step 6: Send email notification (non-blocking)
		sendDeploymentNotification(userId, deploymentData);

		// Step 7: Return success with comprehensive deployment data
		return {
			success: true,
			data: deploymentData,
		};
	} catch (error) {
		console.error("Deployment service error:", error);
		return {
			success: false,
			error:
				error instanceof Error ? error.message : "Unknown deployment error",
		};
	}
}

/**
 * Sends deployment success notification email to the user
 *
 * @param {string} userId - Clerk user ID
 * @param {DeploymentResult['data']} deploymentData - Deployment result data
 * @returns {Promise<void>} Email sending result (non-blocking)
 */
async function sendDeploymentNotification(
	userId: string,
	deploymentData: DeploymentResult["data"],
): Promise<void> {
	try {
		if (!deploymentData) return;

		// Get user details from database for email notification
		const user = await db.query.usersTable.findFirst({
			where: eq(usersTable.clerkId, userId),
		});

		if (user) {
			await mailService.sendDeploymentSuccess({
				userEmail: user.email,
				userName: user.fullName,
				sessionKey: deploymentData.contractHashFingerprint,
				contractId: deploymentData.contractId,
				deploymentTime: new Date(deploymentData.deployedAt),
			});
			console.log(`Deployment notification email sent to ${user.email}`);
		}
	} catch (emailError) {
		// Don't fail the deployment if email sending fails
		console.error("Failed to send deployment notification email:", emailError);
	}
}

/**
 * Retrieves deployment status for a specific user
 *
 * This utility function checks if a user has already deployed a contract
 * by examining their key record in the database. It's useful for:
 * - Frontend status checks
 * - Preventing duplicate deployment attempts
 * - Displaying deployment information to users
 *
 * @param {string} userId - Clerk user ID to check deployment status for
 * @returns {Promise<{hasDeployment: boolean, keyData?: UserKey}>}
 *          Status result with key data if deployment exists
 *
 * @example
 * ```typescript
 * const status = await getDeploymentStatus("user_123");
 * if (status.hasDeployment) {
 *   console.log(`Contract ID: ${status.keyData.arweaveWalletAddress}`);
 * } else {
 *   // Show deployment option to user
 * }
 * ```
 */
export async function getDeploymentStatus(
	userId: string,
): Promise<{ hasDeployment: boolean; keyData?: UserKey }> {
	try {
		// Fetch the user's key record
		const keyData = await db.query.keysTable.findFirst({
			where: eq(keysTable.clerkId, userId),
		});

		// Check if user has a key record and if it contains deployment data
		// instanceKeyHash is only populated after successful contract deployment
		if (
			!keyData ||
			!keyData.instanceKeyHash ||
			keyData.instanceKeyHash === ""
		) {
			return { hasDeployment: false };
		}

		return { hasDeployment: true, keyData };
	} catch (error) {
		console.error("Error checking deployment status:", error);
		return { hasDeployment: false };
	}
}
