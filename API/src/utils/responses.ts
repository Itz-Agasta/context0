export interface ApiResponse<T = unknown> {
	success: boolean;
	message: string;
	data?: T;
	error?: string;
	timestamp: string;
}

/**
 * Create a successful API response
 */
export function successResponse<T>(
	data: T,
	message = "Success",
): ApiResponse<T> {
	return {
		success: true,
		message,
		data,
		timestamp: new Date().toISOString(),
	};
}

/**
 * Create an error API response
 */
export function errorResponse(message: string, error?: string): ApiResponse {
	return {
		success: false,
		message,
		error,
		timestamp: new Date().toISOString(),
	};
}

/**
 * Create a validation error API response with detailed field errors
 */
export function validationErrorResponse(
	errors: Array<{ path: (string | number)[]; message: string; code: string }>,
	message = "Validation failed",
): ApiResponse & { errors: typeof errors } {
	return {
		success: false,
		message,
		error: "Invalid request data",
		errors,
		timestamp: new Date().toISOString(),
	};
}
