import { z } from "zod";

// Instances table schema
export const instanceSchema = z.object({
	id: z.string().uuid(),
	instanceKeyHash: z.string().min(1),
	userId: z.string().min(1),
	name: z.string().min(1),
	description: z.string().optional(),
	arweave_wallet_address: z.string().min(1),
	isActive: z.boolean(),
	lastUsedAt: z.date().optional(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

// Schema for creating a new instance (without generated fields)
export const createInstanceSchema = z.object({
	instanceKeyHash: z.string().min(1),
	userId: z.string().min(1),
	name: z.string().min(1),
	description: z.string().optional(),
	arweave_wallet_address: z.string().min(1),
	isActive: z.boolean().default(false),
});

// Schema for updating an instance (all fields optional except id)
export const updateInstanceSchema = z.object({
	id: z.string().uuid(),
	instanceKeyHash: z.string().min(1).optional(),
	userId: z.string().min(1).optional(),
	name: z.string().min(1).optional(),
	description: z.string().optional(),
	arweave_wallet_address: z.string().min(1).optional(),
	isActive: z.boolean().optional(),
	lastUsedAt: z.date().optional(),
});

export type Instance = z.infer<typeof instanceSchema>;
export type CreateInstance = z.infer<typeof createInstanceSchema>;
export type UpdateInstance = z.infer<typeof updateInstanceSchema>;
