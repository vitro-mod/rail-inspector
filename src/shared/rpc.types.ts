import type { RPCSchema } from 'electrobun'

export interface SerializedUint8Array {
    [index: number]: number
}

export interface BinaryFilePayload {
    path: string
    name: string
    data: SerializedUint8Array
}

export type AppRPC = {
    bun: RPCSchema<{
        requests: {
            readFile: {
                params: {
                    path: string
                }
                response: BinaryFilePayload
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
            modelDialogResult: {
                requestId: string
                path: string | null
                error: string | null
            }
        }
    }>
}