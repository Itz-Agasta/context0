import { eq } from "drizzle-orm";
import { type Request, type Response, Router } from "express";
import { db } from "../db/db.js";
import { keysTable } from "../db/schema/keys.js";
import { auth } from "../middlewares/auth.js";

const router = Router();

// Apply auth middleware to all routes
router.use(auth);

/**
 * GET /instances
 * Get all instances (keys) for the authenticated user
 */
router.get("/", async (req: Request, res: Response): Promise<void> => {
	try {
		const userId = req.userId;

		if (!userId) {
			res.status(401).json({ message: "User ID not found in token" });
			return;
		}

		const instances = await db
			.select()
			.from(keysTable)
			.where(eq(keysTable.clerkId, userId));

		res.status(200).json({
			success: true,
			data: instances,
		});
	} catch (error) {
		console.error("Error fetching instances:", error);
		res.status(500).json({
			success: false,
			message: "Internal server error",
		});
	}
});

/**
 * POST /instances/create
 * Create a new instance (key) for the authenticated user
 */
router.post("/create", async (req: Request, res: Response): Promise<void> => {
	try {
		const userId = req.userId || req.body.userId;

		if (!userId) {
			res.status(401).json({ message: "User ID not found in token" });
			return;
		}

		const newInstance = await db
			.insert(keysTable)
			.values({
				clerkId: userId,
				instanceKeyHash: "",
				arweaveWalletAddress: "",
				isActive: false,
			})
			.returning();

		res.status(201).json({
			success: true,
			data: newInstance[0],
		});
	} catch (error) {
		console.error("Error creating instance:", error);
		res.status(500).json({
			success: false,
			message: "Internal server error",
		});
	}
});

export default router;
