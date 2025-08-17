import axios from "axios";
import { logger } from "../config/winston.js";

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;

export const verifyTransaction = async (txHash?: string) => {
	if (!ETHERSCAN_API_KEY) {
		throw new Error("Etherscan API key is not set");
	}
	if (!txHash) {
		throw new Error("Transaction hash is required");
	}

	const url = `https://api.etherscan.io/v2/api?chainid=1&module=transaction&action=getstatus&txhash=${txHash}&apikey=${ETHERSCAN_API_KEY}`;

	try {
		const response = await axios.get(url);
		logger.info("Etherscan response:", response.data);
		return response.data;
	} catch (error) {
		logger.error("Error verifying transaction:", error);
		throw error;
	}
};
