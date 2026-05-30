<script setup lang="ts">
/**
 * NodePalette — left dock with one card per NodeType. Click adds the node at
 * the centre of the current viewport (transformed back to world space).
 */
import { Box, CloudOff, Cpu, Database, Globe, Layers } from 'lucide-vue-next';
import { useBoardActions } from '@/composables/board/useBoardActions';
import { useViewport } from '@/composables/board/useViewport';
import type { NodeType } from '@/types/board';
import { NODE_TYPES } from '@/types/board';

const props = defineProps<{
    viewportSize: { width: number; height: number };
}>();

const ICONS: Record<string, typeof Box> = {
    Box,
    Globe,
    Database,
    Layers,
    Cpu,
    CloudOff,
};
const actions = useBoardActions();
const vp = useViewport();

function add(type: NodeType) {
    const center = vp.toWorld({
        x: props.viewportSize.width / 2,
        y: props.viewportSize.height / 2,
    });
    actions.addNodeAt(type, {
        x: Math.round(center.x - 100),
        y: Math.round(center.y - 46),
    });
}
</script>

<template>
    <aside class="palette">
        <div class="palette__title">Add node</div>
        <button
            v-for="def in NODE_TYPES"
            :key="def.type"
            class="palette__item"
            :style="{ '--accent': def.accent }"
            @click="add(def.type)"
        >
            <span class="palette__icon">
                <component :is="ICONS[def.icon] ?? Box" :size="14" />
            </span>
            <span class="palette__label">{{ def.label }}</span>
        </button>

        <div class="palette__hints">
            <div><kbd>⌘Z</kbd> undo</div>
            <div><kbd>⌘C</kbd> / <kbd>⌘V</kbd> copy / paste</div>
            <div><kbd>⌘D</kbd> duplicate</div>
            <div><kbd>Del</kbd> remove</div>
            <div><kbd>Space</kbd> + drag = pan</div>
            <div><kbd>⌘</kbd> + scroll = zoom</div>
        </div>
    </aside>
</template>

<style scoped>
.palette {
    width: 200px;
    border-right: 1px solid var(--color-border);
    background: var(--color-card);
    padding: 14px 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    overflow-y: auto;
}
.palette__title {
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-muted-foreground);
    margin-bottom: 6px;
    padding: 0 4px;
    font-weight: 600;
}
.palette__item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 10px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 7px;
    color: var(--color-foreground);
    font: inherit;
    font-size: 12.5px;
    cursor: pointer;
    text-align: left;
    transition:
        background-color 80ms ease,
        border-color 80ms ease;
}
.palette__item:hover {
    background: var(--color-surface-2);
    border-color: var(--color-border-subtle);
}
.palette__icon {
    display: inline-flex;
    width: 22px;
    height: 22px;
    align-items: center;
    justify-content: center;
    border-radius: 5px;
    background: color-mix(in srgb, var(--color-primary) 14%, transparent);
    color: var(--color-primary);
}
.palette__item:active {
    background: var(--color-surface-3);
}

.palette__hints {
    margin-top: auto;
    padding-top: 14px;
    border-top: 1px solid var(--color-border-subtle);
    font-size: 11px;
    color: var(--color-text-secondary);
    display: flex;
    flex-direction: column;
    gap: 4px;
}
.palette__hints kbd {
    background: color-mix(in srgb, var(--color-foreground) 8%, transparent);
    border: 1px solid var(--color-border);
    border-radius: 4px;
    padding: 0 4px;
    font-size: 10px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
</style>
