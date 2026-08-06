<script setup lang="ts">
import { shallowRef } from 'vue'
import ModelViewport from './components/ModelViewport.vue'
import { useViewportStore } from './stores/viewport'
import { FileDialogResult, selectFile } from './file-dialog.js'

const viewport = shallowRef<InstanceType<typeof ModelViewport> | null>(null)
const model = shallowRef<FileDialogResult | null>(null)

const viewportStore = useViewportStore();

async function openModel(): Promise<void> {
    try {
        const fileDialogResult = await selectFile();

        if (!fileDialogResult) {
            return
        }

        model.value = fileDialogResult
    } catch (error) {
        console.error('File dialog failed:', error)
    }
}
</script>

<template>
    <main class="app">
        <header class="toolbar">
            <button type="button" @click="openModel">
                Open
            </button>

            <button type="button" :disabled="!model" @click="viewport?.frameModel()">
                Fit to View
            </button>

            <label>
                <input v-model="viewportStore.showGrid" type="checkbox">
                Grid
            </label>

            <label>
                <input v-model="viewportStore.showAxes" type="checkbox">
                Axes
            </label>

            <label>
                <input v-model="viewportStore.wireframe" type="checkbox">
                Wireframe
            </label>
        </header>

        <ModelViewport ref="viewport" :model="model" class="viewport" />
    </main>
</template>

<style>
:root {
    --text-color: light-dark(black, white);
    --toolbar-background: light-dark(#f0f0f0, #1a1a1a);
    --toolbar-hover-background: light-dark(#e0e0e0, #333333);
}

html,
body,
#app {
    width: 100%;
    height: 100%;
    margin: 0;
    font-family: system-ui, sans-serif;
    color: var(--text-color);
}

button,
input {
    font: inherit;
}

.app {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    width: 100%;
    height: 100%;
}

.toolbar {
    display: flex;
    align-items: center;
    background-color: var(--toolbar-background);
}

.toolbar label {
    display: flex;
    gap: 4px;
    align-items: center;
    padding: 8px;
}

.toolbar label:hover {
    background-color: var(--toolbar-hover-background);
}

.toolbar input[type="checkbox"] {
    accent-color: dimgray;
}

.toolbar button {
    padding: 8px;
    border: none;
    background-color: transparent;
    color: var(--text-color);
    cursor: pointer;
}

.toolbar button:hover {
    background-color: var(--toolbar-hover-background);
}

.toolbar button:disabled {
    opacity: 0.5;
    cursor: unset;
}

.toolbar button:hover:disabled {
    background-color: transparent;
}


.viewport {
    min-width: 0;
    min-height: 0;
}
</style>