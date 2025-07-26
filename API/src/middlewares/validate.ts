import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";
import { validationErrorResponse } from "../utils/responses.js";

/**
 * Middleware to validate request data against a Zod schema
 */
export const validateData =
	<T>(schema: ZodSchema<T>) =>
	(req: Request, res: Response, next: NextFunction): void => {
		const result = schema.safeParse(req.body);
		if (!result.success) {
			const response = validationErrorResponse(result.error.errors);
			res.status(400).json(response);
			return;
		}
		req.body = result.data; // Use validated data
		next();
	};

// Legacy export for backwards compatibility
export const validate = validateData;
