import { z } from "zod";

// Subscription plan enum schema
export const subscriptionPlanSchema = z.enum(["basic", "pro", "enterprise"]);

// User subscriptions table schema
export const userSubscriptionSchema = z.object({
	id: z.string().uuid(),
	userId: z.string().min(1),
	plan: subscriptionPlanSchema,
	quotaLimit: z.number().int().positive(),
	quotaUsed: z.number().int().min(0),
	isActive: z.boolean(),
	renewsAt: z.date(),
	createdAt: z.date(),
});

// Schema for creating a new user subscription (without generated fields)
export const createUserSubscriptionSchema = z.object({
	userId: z.string().min(1),
	plan: subscriptionPlanSchema,
	quotaLimit: z.number().int().positive(),
	quotaUsed: z.number().int().min(0).default(0),
	isActive: z.boolean().default(true),
	renewsAt: z.date(),
});

// Schema for updating a user subscription (all fields optional except id)
export const updateUserSubscriptionSchema = z.object({
	id: z.string().uuid(),
	userId: z.string().min(1).optional(),
	plan: subscriptionPlanSchema.optional(),
	quotaLimit: z.number().int().positive().optional(),
	quotaUsed: z.number().int().min(0).optional(),
	isActive: z.boolean().optional(),
	renewsAt: z.date().optional(),
});

export type UserSubscription = z.infer<typeof userSubscriptionSchema>;
export type CreateUserSubscription = z.infer<
	typeof createUserSubscriptionSchema
>;
export type UpdateUserSubscription = z.infer<
	typeof updateUserSubscriptionSchema
>;
export type SubscriptionPlan = z.infer<typeof subscriptionPlanSchema>;
