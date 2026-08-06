import type { AppRPC } from '../shared/rpc.types';
import { rpc } from './main'

export type FileDialogResult = AppRPC['webview']['messages']['fileDialogResult'];

interface PendingFileDialog {
    resolve: (fileDialogResult: FileDialogResult | null) => void
    reject: (error: Error) => void
}

const pendingFileDialogs = new Map<string, PendingFileDialog>();

export function selectFile(): Promise<FileDialogResult | null> {
    const requestId = crypto.randomUUID();

    return new Promise((resolve, reject) => {
        pendingFileDialogs.set(requestId, {
            resolve,
            reject,
        })

        rpc.send.openModelDialog({ requestId });
    })
}

export function fileDialogResult(fileDialogResult: FileDialogResult): void | undefined {
    const { requestId, dir, file, path, error } = fileDialogResult;
    console.log('fileDialogResult received:', { requestId, dir, file, path, error })
    const pending = pendingFileDialogs.get(requestId)

    if (!pending) {
        return undefined;
    }

    pendingFileDialogs.delete(requestId)

    if (error) {
        pending.reject(new Error(error))
    } else {
        pending.resolve(fileDialogResult)
    }
}
