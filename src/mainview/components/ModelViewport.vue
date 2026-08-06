<!-- src/components/ModelViewport.vue -->

<script setup lang="ts">
import { markRaw, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useViewportStore } from '../stores/viewport'
import { Viewer } from '../viewer/Viewer'
import { FileDialogResult } from '../file-dialog';

const props = defineProps<{
    model?: FileDialogResult | null
}>()

const container = ref<HTMLElement | null>(null)
const store = useViewportStore()

let viewer: Viewer | null = null

onMounted(() => {
    if (!container.value) {
        return
    }

    viewer = markRaw(new Viewer(container.value, {
        showGrid: store.showGrid,
        showAxes: store.showAxes,
        wireframe: store.wireframe,
    }))

    if (props.model) {
        viewer.loadModel(props.model).then(model => {
            viewer?.setModel(model)
        }).catch(error => {
            console.error('Failed to load model:', error)
        })
    }
})

watch(
    () => props.model,
    model => {
        if (!viewer) {
            return
        }

        if (model) {
            viewer.loadModel(model).then(lod => {
                viewer?.setModel(lod)
            }).catch(error => {
                console.error('Failed to load model:', error)
            })
        } else {
            viewer.clearModel()
        }
    },
)

watch(
    () => store.showGrid,
    visible => viewer?.setGridVisible(visible),
)

watch(
    () => store.showAxes,
    visible => viewer?.setAxesVisible(visible),
)

watch(
    () => store.wireframe,
    enabled => viewer?.setWireframe(enabled),
)

onBeforeUnmount(() => {
    viewer?.dispose()
    viewer = null
})

defineExpose({
    frameModel(): void {
        viewer?.frameModel()
    },
})
</script>

<template>
    <div ref="container" class="model-viewport" />
</template>

<style scoped>
.model-viewport {
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
}
</style>

<style>
.model-viewport canvas {
    width: 100%;
    height: 100%;
    display: block;
}
</style>