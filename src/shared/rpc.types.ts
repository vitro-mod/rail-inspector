import type { RPCSchema } from 'electrobun'

export interface FileUrlPayload {
    url: string
}

export type AppRPC = {
    bun: RPCSchema<{
        requests: {
            getFileUrl: {
                params: {
                    path: string
                }
                response: FileUrlPayload
            }
        }
        messages: {
            openModelDialog: {
                requestId: string
            }
        }
    }>

    webview: RPCSchema<{
        requests: {}
        messages: {
            fileDialogResult: {
                requestId: string
                dir: string | null
                file: string | null
                path: string | null
                error: string | null
            }
        }
    }>
}
