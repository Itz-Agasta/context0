import { STATUS_CODES } from "node:http";
import type { NextFunction, Request, Response } from "express";
import httpErrors from "http-errors";
import { errorResponse } from "../utils/responses.js";

export function errorHandler(
	err: unknown,
	_req: Request,
	res: Response,
	next: NextFunction,
) {
	console.error("Global error handler:", err);

	// If headers were already sent, delegate to Express default error handler
	if (res.headersSent) {
		return next(err);
	}

	// Determine the appropriate status code
	const status = httpErrors.isHttpError(err) ? err.statusCode : 500;

	// Get appropriate message for the status code
	const statusMessage = STATUS_CODES[status] ?? "Error";

	const response = errorResponse(
		statusMessage,
		err instanceof Error ? err.message : "Unknown error",
	);

	res.status(status).json(response);
}
