import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";
import { db } from "../db/db.js";
import { keysTable } from "../db/schema/keys.js";
import { verifyContractHash } from "../utils/contract.js";

interface ContractRequest extends Request {
	contract?: {
		contractId: string;
		userId: string;
		createdAt: number;
	};
}

export const verifyContractHashMiddleware = async (
	req: ContractRequest,
	res: Response,
	next: NextFunction,
) => {
	const authHeader = req.headers.authorization;

	if (!authHeader || !authHeader.startsWith("Bearer ")) {
		res.status(401).json({ error: "Missing or invalid Authorization header" });
		return;
	}

	const token = authHeader.split(" ")[1];
	const payload = verifyContractHash(token);

	if (!payload) {
		res.status(401).json({ error: "Invalid or expired contract token" });
		return;
	}

	const hash = crypto.createHash("sha256").update(token).digest("hex");

	// Check if the hashed token exists in the database and the key is active
	const keyRecord = await db.query.keysTable.findFirst({
		where: eq(keysTable.instanceKeyHash, hash),
	});

	if (!keyRecord || !keyRecord.isActive) {
		res.status(403).json({ error: "Unknown or expired contract token" });
		return;
	}

	const headerContractId = req.headers["x-contract-id"];

	if (headerContractId && payload.contractId !== headerContractId) {
		res.status(403).json({ error: "Contract ID mismatch" });
		return;
	}

	req.contract = payload;

	// Update the last used timestamp for the key
	await db
		.update(keysTable)
		.set({ lastUsedAt: new Date() })
		.where(eq(keysTable.instanceKeyHash, hash));

	next();
};
