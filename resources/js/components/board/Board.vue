<script setup lang="ts">
/**
 * Board — top-level composition that wires the canvas with all UI surfaces.
 *
 * Viewport size is tracked via ResizeObserver on the canvas root (no per-frame
 * RAF loop) so passive layout never burns CPU when the user is idle.
 */
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useKeyboard } from '@/composables/board/useKeyboard';
import Canvas from './Canvas.vue';
import Inspector from './Inspector.vue';
import IssuesPanel from './IssuesPanel.vue';
import Minimap from './Minimap.vue';
import NodePalette from './NodePalette.vue';
import Toolbar from './Toolbar.vue';

useKeyboard();

const canvasRef = ref<InstanceType<typeof Canvas> | null>(null);
const canvasHost = ref<HTMLDivElement | null>(null);
const viewportSize = reactive({ width: 0, height: 0 });

let ro: ResizeObserver | null = null;
onMounted(() => {
    if (!canvasHost.value) {
        return;
    }

    const measure = () => {
        const r = canvasHost.value!.getBoundingClientRect();
        viewportSize.width = r.width;
        viewportSize.height = r.height;
    };
    measure();
    ro = new ResizeObserver(measure);
    ro.observe(canvasHost.value);
});
onBeforeUnmount(() => ro?.disconnect());
</script>

<template>
    <div class="board">
        <Toolbar :viewport-size="viewportSize" />
        <div class="board__main">
            <NodePalette :viewport-size="viewportSize" />
            <div ref="canvasHost" class="board__canvas">
                <Canvas ref="canvasRef" />
                <Minimap :viewport-size="viewportSize" />
                <IssuesPanel :viewport-size="viewportSize" />
            </div>
            <Inspector />
        </div>
    </div>
</template>

<style scoped>
.board {
    display: flex;
    flex-direction: column;
    width: 100vw;
    height: 100vh;
    background: var(--color-background);
    color: var(--color-foreground);
    font-family:
        'Geist',
        'Inter var',
        'Inter',
        ui-sans-serif,
        system-ui,
        -apple-system,
        BlinkMacSystemFont,
        'Segoe UI',
        sans-serif;
    font-feature-settings: 'cv11', 'ss01', 'ss03';
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
    letter-spacing: -0.005em;
    overflow: hidden;
}
.board__main {
    display: flex;
    flex: 1;
    min-height: 0;
}
.board__canvas {
    position: relative;
    flex: 1;
    min-width: 0;
    min-height: 0;
}
</style>
