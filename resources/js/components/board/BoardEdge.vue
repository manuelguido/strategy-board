<script setup lang="ts">
/**
 * BoardEdge — SVG path representing one connection.
 *
 * Geometry: cubic bezier from source-output (right) to target-input (left).
 * `parallelOffset` (px) shifts both endpoints perpendicularly so multiple
 * edges between the same node pair never overlap. Backward edges (target left
 * of source) curve out wider so the route doesn't collapse.
 *
 * Visual treatments:
 *   • async edges have a subtle moving dash to imply event flow
 *   • dimmed edges (focus mode) drop opacity smoothly
 *   • selected / hovered edges thicken
 */
import { computed } from 'vue';
import type { BoardEdge, BoardNode, Issue } from '@/types/board';
import { EDGE_TYPE_MAP } from '@/types/board';

const props = withDefaults(
    defineProps<{
        edge: BoardEdge;
        source: BoardNode;
        target: BoardNode;
        selected: boolean;
        issues: Issue[];
        parallelOffset?: number;
        dimmed?: boolean;
    }>(),
    { parallelOffset: 0, dimmed: false },
);

defineEmits<{ (e: 'select', id: string): void }>();

const def = computed(() => EDGE_TYPE_MAP[props.edge.type]);

const geom = computed(() => {
    const sx = props.source.position.x + props.source.width;
    const sy = props.source.position.y + props.source.height / 2 + props.parallelOffset;
    const tx = props.target.position.x;
    const ty = props.target.position.y + props.target.height / 2 + props.parallelOffset;

    const dx = tx - sx;
    const absDx = Math.abs(dx);
    const handle = dx >= 0
        ? Math.max(36, absDx * 0.5)
        : Math.max(80, absDx * 0.6 + 40);

    const c1x = sx + handle;
    const c2x = tx - handle;

    // Cubic bezier midpoint (t=0.5)
    const mx = 0.125 * sx + 0.375 * c1x + 0.375 * c2x + 0.125 * tx;
    const my = 0.125 * sy + 0.375 * sy + 0.375 * ty + 0.125 * ty;

    return { sx, sy, tx, ty, mx, my, path: `M ${sx} ${sy} C ${c1x} ${sy}, ${c2x} ${ty}, ${tx} ${ty}` };
});

const hasError = computed(() => props.issues.some((i) => i.severity === 'error'));
const hasWarn  = computed(() => props.issues.some((i) => i.severity === 'warning'));

const stroke = computed(() => {
    if (hasError.value) return 'hsl(0 70% 60%)';
    if (hasWarn.value)  return 'hsl(35 70% 60%)';
    return def.value.color;
});

const arrowId = computed(() => `arrow-${props.edge.id}`);
const isAnimated = computed(() => props.edge.type === 'async');
</script>

<template>
    <g
        class="board-edge"
        :class="{
            'is-selected': selected,
            'is-dimmed': dimmed,
            'is-animated': isAnimated,
        }"
    >
        <defs>
            <marker
                :id="arrowId"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
            >
                <path d="M0,0 L10,5 L0,10 Z" :fill="stroke" />
            </marker>
        </defs>

        <path
            :d="geom.path"
            stroke="transparent"
            stroke-width="14"
            fill="none"
            class="board-edge__hit"
            @pointerdown.stop="$emit('select', edge.id)"
        />
        <path
            :d="geom.path"
            :stroke="stroke"
            :stroke-width="def.width * (selected ? 1.7 : 1)"
            :stroke-dasharray="def.dash || undefined"
            fill="none"
            :marker-end="`url(#${arrowId})`"
            class="board-edge__line"
        />

        <text
            v-if="edge.label"
            :x="geom.mx"
            :y="geom.my - 6"
            text-anchor="middle"
            class="board-edge__label"
        >{{ edge.label }}</text>
    </g>
</template>

<style scoped>
.board-edge { transition: opacity 180ms ease; }
.board-edge.is-dimmed { opacity: 0.1; }

.board-edge__hit { cursor: pointer; pointer-events: stroke; }

.board-edge__line {
    pointer-events: none;
    opacity: 0.8;
    transition: stroke-width 120ms ease, opacity 120ms ease;
}
.board-edge.is-selected .board-edge__line { opacity: 1; }

.board-edge.is-animated .board-edge__line {
    animation: board-edge-flow 1.6s linear infinite;
}
@keyframes board-edge-flow {
    to { stroke-dashoffset: -18; }
}

.board-edge__label {
    font-family: inherit;
    font-size: 10.5px;
    font-weight: 500;
    fill: var(--color-muted-foreground);
    pointer-events: none;
    user-select: none;
    paint-order: stroke;
    stroke: var(--color-background);
    stroke-width: 3;
    stroke-linejoin: round;
}
.board-edge.is-selected .board-edge__label { fill: var(--color-foreground); }
</style>
