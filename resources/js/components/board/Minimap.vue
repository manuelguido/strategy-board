<script setup lang="ts">
/**
 * Minimap — overview of all nodes + the current viewport rectangle.
 *
 * Click anywhere to recenter the viewport on that point.
 */
import { computed } from 'vue';
import { useBoardStore } from '@/composables/board/useBoardStore';
import { NODE_TYPE_MAP } from '@/types/board';

const props = defineProps<{ viewportSize: { width: number; height: number } }>();

const store = useBoardStore();

const MAP_W = 200;
const MAP_H = 130;
const PAD   = 80;

const bounds = computed(() => {
    const ns = store.nodes.value;
    if (!ns.length) return { minX: -PAD, minY: -PAD, maxX: PAD, maxY: PAD };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of ns) {
        minX = Math.min(minX, n.position.x);
        minY = Math.min(minY, n.position.y);
        maxX = Math.max(maxX, n.position.x + n.width);
        maxY = Math.max(maxY, n.position.y + n.height);
    }
    // Also include current viewport rect so it's always visible.
    const vp = store.viewport;
    const vx1 = -vp.offset.x / vp.zoom;
    const vy1 = -vp.offset.y / vp.zoom;
    const vx2 = vx1 + props.viewportSize.width / vp.zoom;
    const vy2 = vy1 + props.viewportSize.height / vp.zoom;
    minX = Math.min(minX, vx1);
    minY = Math.min(minY, vy1);
    maxX = Math.max(maxX, vx2);
    maxY = Math.max(maxY, vy2);
    return { minX: minX - PAD, minY: minY - PAD, maxX: maxX + PAD, maxY: maxY + PAD };
});

const scale = computed(() => {
    const b = bounds.value;
    const w = b.maxX - b.minX;
    const h = b.maxY - b.minY;
    return Math.min(MAP_W / w, MAP_H / h);
});

function project(x: number, y: number) {
    const b = bounds.value;
    const s = scale.value;
    return { x: (x - b.minX) * s, y: (y - b.minY) * s };
}

const nodeRects = computed(() =>
    store.nodes.value.map((n) => {
        const p = project(n.position.x, n.position.y);
        return {
            id: n.id,
            x: p.x,
            y: p.y,
            w: n.width * scale.value,
            h: n.height * scale.value,
            color: NODE_TYPE_MAP[n.type].accent,
            selected: store.selection.nodes.has(n.id),
        };
    }),
);

const viewportRect = computed(() => {
    const vp = store.viewport;
    const x1 = -vp.offset.x / vp.zoom;
    const y1 = -vp.offset.y / vp.zoom;
    const w  = props.viewportSize.width / vp.zoom;
    const h  = props.viewportSize.height / vp.zoom;
    const p = project(x1, y1);
    return { x: p.x, y: p.y, w: w * scale.value, h: h * scale.value };
});

function onClick(e: MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const b = bounds.value;
    const s = scale.value;
    const worldX = px / s + b.minX;
    const worldY = py / s + b.minY;
    store.viewport.offset = {
        x: props.viewportSize.width / 2 - worldX * store.viewport.zoom,
        y: props.viewportSize.height / 2 - worldY * store.viewport.zoom,
    };
}
</script>

<template>
    <div class="minimap" @click="onClick">
        <svg :width="MAP_W" :height="MAP_H">
            <rect
                v-for="r in nodeRects"
                :key="r.id"
                :x="r.x"
                :y="r.y"
                :width="Math.max(2, r.w)"
                :height="Math.max(2, r.h)"
                :fill="r.color"
                :opacity="r.selected ? 1 : 0.55"
                rx="1"
            />
            <rect
                :x="viewportRect.x"
                :y="viewportRect.y"
                :width="viewportRect.w"
                :height="viewportRect.h"
                fill="none"
                :stroke="'var(--color-ring)'"
                stroke-width="1"
                stroke-dasharray="2 2"
                opacity="0.7"
            />
        </svg>
    </div>
</template>

<style scoped>
.minimap {
    position: absolute;
    bottom: 14px;
    left: 14px;
    width: 200px;
    height: 130px;
    background: var(--color-popover);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45), 0 1px 0 rgba(255, 255, 255, 0.04) inset;
    cursor: crosshair;
    overflow: hidden;
    z-index: 10;
}
.minimap svg { display: block; }
</style>
