import { BrowserWindow, BrowserView, Updater, Utils } from "electrobun/bun";
import type { AppRPC, BinaryFilePayload, SerializedUint8Array } from "../shared/rpc.types";
import { basename } from 'node:path'

const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

// Check if Vite dev server is running for HMR
async function getMainViewUrl(): Promise<string> {
	const channel = await Updater.localInfo.channel();
	if (channel === "dev") {
		try {
			await fetch(DEV_SERVER_URL, { method: "HEAD" });
			console.log(`HMR enabled: Using Vite dev server at ${DEV_SERVER_URL}`);
			return DEV_SERVER_URL;
		} catch {
			console.log(
				"Vite dev server not running. Run 'bun run dev:hmr' for HMR support.",
			);
		}
	}
	return "views://mainview/index.html";
}

const rpc = BrowserView.defineRPC<AppRPC>({
	maxRequestTime: 2000,
	handlers: {
		requests: {
			async readFile({ path }): Promise<BinaryFilePayload> {
				console.log('readFile request received for path:', path)
				const file = Bun.file(path)

				if (!(await file.exists())) {
					throw new Error(`File does not exist: ${path}`)
				}

				const bytes = new Uint8Array(await file.arrayBuffer())

				return {
					path,
					name: basename(path),
					data: bytes as unknown as SerializedUint8Array,
				}
			},
		},
		messages: {
			openModelDialog: async ({ requestId }) => {
				try {
					console.log('openModelDialog request received with requestId:', requestId)
					const paths = await Utils.openFileDialog({
						allowedFileTypes: 's',
						canChooseFiles: true,
						canChooseDirectory: false,
						allowsMultipleSelection: false,
					});

					console.log('File dialog opened, selected paths:', paths);

					rpc.send.modelDialogResult({
						requestId,
						path: paths[0] ?? null,
						error: null,
					});

					console.log('File dialog result sent:', { requestId, path: paths[0] ?? null });
				} catch (error) {
					console.error('File dialog failed:', error);
					rpc.send.modelDialogResult({
						requestId,
						path: null,
						error: error instanceof Error ? error.message : String(error),
					});
				}
			}
		},
	},
});

// Create the main application window
const url = await getMainViewUrl();

const mainWindow = new BrowserWindow({
	title: "Rail Inspector",
	url,
	frame: {
		width: 900,
		height: 700,
		x: 100,
		y: 100,
	},
	rpc,
});

console.log("Bun app started!");

mainWindow.webview.openDevTools();