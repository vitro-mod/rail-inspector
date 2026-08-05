// src/stores/viewport.ts

import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useViewportStore = defineStore('viewport', () => {
    const showGrid = ref(true)
    const showAxes = ref(true)
    const wireframe = ref(false)

    function reset(): void {
        showGrid.value = true
        showAxes.value = true
        wireframe.value = false
    }

    return {
        showGrid,
        showAxes,
        wireframe,
        reset,
    }
})
