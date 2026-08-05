import { Electroview } from 'electrobun/view'
import type { AppRPC } from "../shared/rpc.types";
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { modelDialogResult } from './file-dialog'

const rpcInstance = Electroview.defineRPC<AppRPC>({
    handlers: {
        requests: {},
        messages: {
            modelDialogResult
        },
    },
});

const electroview = new Electroview({ rpc: rpcInstance });

if (!electroview.rpc) {
    throw new Error("Failed to initialize RPC");
}

export const rpc = electroview.rpc;
window.rpc = rpc;

createApp(App).use(createPinia()).mount('#app');
