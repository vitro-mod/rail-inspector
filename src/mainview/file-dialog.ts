import type { AppRPC } from '../shared/rpc.types';
import { rpc } from './main'

interface PendingFileDialog {
    resolve: (path: string | null) => void
    reject: (error: Error) => void
}

const pendingFileDialogs = new Map<string, PendingFileDialog>();

export function selectModelFile(): Promise<string | null> {
    const requestId = crypto.randomUUID();

    return new Promise((resolve, reject) => {
        pendingFileDialogs.set(requestId, {
            resolve,
            reject,
        })

        rpc.send.openModelDialog({ requestId });
    })
}

export function modelDialogResult({ requestId, path, error }: AppRPC['webview']['messages']['modelDialogResult']): void | undefined {
    console.log('modelDialogResult received:', { requestId, path, error })
    const pending = pendingFileDialogs.get(requestId)

    if (!pending) {
        return undefined;
    }

    pendingFileDialogs.delete(requestId)

    if (error) {
        pending.reject(new Error(error))
    } else {
        pending.resolve(path)
    }
}
