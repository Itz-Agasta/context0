import { createRequire } from "node:module";
import Arweave from "arweave";

export class ArLocalService {
	private arLocal: { start(): Promise<void>; stop(): Promise<void> } | null =
		null;

	private isRunning = false;
	private port = 1984;
	constructor(port = 1984) {
		this.port = port;
	}

	async start(): Promise<void> {
		if (this.isRunning) {
			console.log("ArLocal is already running");

			// Verify it's actually accessible
			const accessible = await this.isArLocalAccessible();

			if (!accessible) {
				console.log(
					"ArLocal appears to be running but not accessible, restarting...",
				);

				await this.stop();
				// Continue with start process below
			} else {
				return;
			}
		}

		try {
			// Dynamic import for ArLocal to handle ES module issues
			const require = createRequire(import.meta.url);
			const ArLocal = require("arlocal").default;

			this.arLocal = new ArLocal(this.port, false); // false = don't show logs

			if (!this.arLocal) {
				throw new Error("Failed to create ArLocal instance");
			}

			await this.arLocal.start();
			this.isRunning = true;
			// Give ArLocal a moment to fully initialize
			await new Promise((resolve) => setTimeout(resolve, 3000));

			// Verify it's accessible
			const accessible = await this.isArLocalAccessible();
			if (!accessible) {
				throw new Error("ArLocal started but is not accessible");
			}
		} catch (error) {
			console.error("Failed to start ArLocal:", error);
			this.isRunning = false;
			this.arLocal = null;
			throw error;
		}
	}

	async stop(): Promise<void> {
		if (!this.isRunning || !this.arLocal) {
			console.log("ArLocal is not running");
			return;
		}
		try {
			console.log("Stopping ArLocal...");
			await this.arLocal.stop();
			this.arLocal = null;
			this.isRunning = false;
			console.log("ArLocal stopped successfully");
		} catch (error) {
			console.error("Failed to stop ArLocal:", error);
			throw error;
		}
	}

	async mine(): Promise<void> {
		if (!this.isRunning) {
			throw new Error("ArLocal is not running");
		}
		try {
			const arweave = Arweave.init({
				host: "localhost",
				port: this.port,
				protocol: "http",
			});

			await arweave.api.get("mine");
			console.log("Block mined successfully");
		} catch (error) {
			console.error("Failed to mine block:", error);
			throw error;
		}
	}

	isArLocalRunning(): boolean {
		return this.isRunning;
	}

	getPort(): number {
		return this.port;
	}

	getArweaveInstance(): Arweave {
		if (!this.isRunning) {
			throw new Error("ArLocal is not running");
		}
		return Arweave.init({
			host: "localhost",
			port: this.port,
			protocol: "http",
		});
	}

	async isArLocalAccessible(): Promise<boolean> {
		if (!this.isRunning) {
			return false;
		}
		try {
			const arweave = Arweave.init({
				host: "localhost",
				port: this.port,
				protocol: "http",
			});

			// Try to get network info to verify ArLocal is responding
			await arweave.network.getInfo();
			return true;
		} catch (error) {
			console.warn("ArLocal is not accessible:", (error as Error).message);
			return false;
		}
	}
}

export const arLocalService = new ArLocalService();
