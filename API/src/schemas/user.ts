import { z } from "zod";

// User status enum schema
export const userStatusSchema = z.enum(["active", "suspended", "deleted"]);

// User table schema
export const userSchema = z.object({
	id: z.string().uuid(),
	username: z.string().min(1),
	email: z.string().email(),
	fullName: z.string().min(1),
	metaMaskWalletAddress: z.string().optional(),
	status: userStatusSchema.optional(),
	createdAt: z.date(),
	updatedAt: z.date(),
	lastLoginAt: z.date().optional(),
});

// Schema for creating a new user (without generated fields)
export const createUserSchema = z.object({
	username: z.string().min(1),
	email: z.string().email(),
	fullName: z.string().min(1),
	metaMaskWalletAddress: z.string().optional(),
	status: userStatusSchema.optional(),
});

// Schema for updating a user (all fields optional except id)
export const updateUserSchema = z.object({
	id: z.string().uuid(),
	username: z.string().min(1).optional(),
	email: z.string().email().optional(),
	fullName: z.string().min(1).optional(),
	metaMaskWalletAddress: z.string().optional(),
	status: userStatusSchema.optional(),
	lastLoginAt: z.date().optional(),
});

export type User = z.infer<typeof userSchema>;
export type CreateUser = z.infer<typeof createUserSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;
export type UserStatus = z.infer<typeof userStatusSchema>;
