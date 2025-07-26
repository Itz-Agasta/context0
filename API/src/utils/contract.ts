import crypto from "node:crypto";
import jwt from "jsonwebtoken";

if (
	!process.env.CONTRACT_JWT_SECRET &&
	process.env.NODE_ENV !== "development"
) {
	throw new Error("CONTRACT_JWT_SECRET environment variable is not set");
}

const JWT_SECRET = process.env.CONTRACT_JWT_SECRET ?? "hack4bengal_vyse";
const JWT_ISSUER = "archivenet-api";
const JWT_AUDIENCE = "archivenet-users";

export interface ContractHashPayload {
	contractId: string;
	userId: string;
	createdAt: number;
}

export interface ContractHashResult {
	contractHashFingerprint: string; //JWT token containing contract hash
	hashedContractKey: string; // SHA-256 hash of the contract token, to be stored in DB
}

/**
 * Generates a contract hash from contractId provided from Arweave wallet.
 *
 * - Signs a JWT token with the contract ID and user ID.
 * - Hashes the token using SHA-256 for secure storage.
 *
 * @param contractId - The contract ID from Arweave wallet.
 * @param userId - The user ID associated with the contract.
 * @returns ContractHashResult - Contains the signed JWT token and hashed token.
 */
export const generateContractHash = (
	contractId: string,
	userId: string,
): ContractHashResult => {
	const payload: ContractHashPayload = {
		contractId,
		userId,
		createdAt: Date.now(),
	};

	const token = jwt.sign(payload, JWT_SECRET, {
		issuer: JWT_ISSUER,
		audience: JWT_AUDIENCE,
	});

	// Hash token for secure DB storage
	const hashedContractKey = crypto
		.createHash("sha256")
		.update(token)
		.digest("hex");

	return {
		contractHashFingerprint: token,
		hashedContractKey,
	};
};

/**
 * Verifies a contract hash token.
 *
 * - Validates the JWT token signature and claims (issuer, audience).
 * - Returns the decoded ContractHashPayload containing userId if valid.
 *
 * @param token - The contract hash token to verify.
 * @returns The decoded ContractHashPayload if valid, or null otherwise.
 */
export const verifyContractHash = (
	token: string,
): ContractHashPayload | null => {
	try {
		const decoded = jwt.verify(token, JWT_SECRET, {
			issuer: JWT_ISSUER,
			audience: JWT_AUDIENCE,
			algorithms: ["HS256"],
		}) as ContractHashPayload;

		return decoded;
	} catch {
		return null;
	}
};
