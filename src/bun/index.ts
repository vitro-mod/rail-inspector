import { BrowserWindow, BrowserView, Updater, Utils } from "electrobun/bun";
import type { AppRPC, FileUrlPayload } from "../shared/rpc.types";
import nodePath from 'node:path'

const TITLE = "Shape Inspector";

const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

const fileServerToken = crypto.randomUUID();
const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, OPTIONS',
	'Access-Control-Allow-Private-Network': 'true',
};

// Binary model and texture data must not travel through Electrobun RPC: RPC
// messages are JSON encoded, which turns a Uint8Array into a very large object.
const fileServer = Bun.serve({
	hostname: '127.0.0.1',
	port: 0,
	async fetch(request) {
		if (request.method === 'OPTIONS') {
			return new Response(null, { status: 204, headers: corsHeaders });
		}

		const url = new URL(request.url);
		if (request.method !== 'GET' || url.pathname !== '/file') {
			return new Response('Not found', { status: 404, headers: corsHeaders });
		}

		if (url.searchParams.get('token') !== fileServerToken) {
			return new Response('Forbidden', { status: 403, headers: corsHeaders });
		}

		const path = url.searchParams.get('path');
		if (!path) {
			return new Response('Missing path', { status: 400, headers: corsHeaders });
		}

		const file = Bun.file(path);
		if (!(await file.exists())) {
			return new Response('File not found', { status: 404, headers: corsHeaders });
		}

		return new Response(file, {
			headers: {
				...corsHeaders,
				'Cache-Control': 'no-store',
				'Content-Type': 'application/octet-stream',
			},
		});
	},
});

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
			getFileUrl({ path }): FileUrlPayload {
				const url = new URL('/file', fileServer.url);
				url.searchParams.set('token', fileServerToken);
				url.searchParams.set('path', path);
				return {
					url: url.toString(),
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

					const fileDialogResult = {
						requestId,
						dir: paths[0] ? nodePath.dirname(paths[0]) : null,
						file: paths[0] ? nodePath.basename(paths[0]) : null,
						path: paths[0] ?? null,
						error: null,
					}

					if (fileDialogResult.dir?.toLowerCase().endsWith('shapes')) {
						fileDialogResult.dir = nodePath.join(fileDialogResult.dir, '..', 'textures', nodePath.sep);
					}

					setTitle(fileDialogResult.path ? `${TITLE} - ${fileDialogResult.path}` : TITLE);

					rpc.send.fileDialogResult(fileDialogResult);
				} catch (error) {
					console.error('File dialog failed:', error);
					rpc.send.fileDialogResult({
						requestId,
						dir: null,
						file: null,
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
	title: TITLE,
	url,
	frame: {
		width: 900,
		height: 700,
		x: 100,
		y: 100,
	},
	rpc,
});

function setTitle(title: string) {
	mainWindow.setTitle(title);
}

console.log("Bun app started!");

// mainWindow.webview.openDevTools();
