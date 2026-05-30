<script setup lang="ts">
/**
 * BoardNode — single node card.
 *
 * Compact, two-line layout: header row (icon + name + type chip) and a single
 * line of subtle metadata. Selection animates a soft ring; hover lifts the
 * shadow. Issues are surfaced contextually (small dot + tooltip) rather than
 * by recoloring the whole card border.
 */
import { Box, CloudOff, Cpu, Database, Globe, Layers } from 'lucide-vue-next';
import { computed } from 'vue';
import type { BoardNode, Issue } from '@/types/board';
import { NODE_TYPE_MAP } from '@/types/board';

const props = defineProps<{
    node: BoardNode;
    selected: boolean;
    issues: Issue[];
}>();

defineEmits<{
    (
        e: 'start-connection',
        payload: { nodeId: string; clientX: number; clientY: number },
    ): void;
}>();

const ICONS: Record<string, typeof Box> = {
    Box,
    Globe,
    Database,
    Layers,
    Cpu,
    CloudOff,
};

const def = computed(() => NODE_TYPE_MAP[props.node.type]);
const Icon = computed(() => ICONS[def.value.icon] ?? Box);

const summary = computed(() => {
    const md = props.node.metadata;

    switch (props.node.type) {
        case 'api':
            return md.endpoints?.[0] ?? md.auth ?? '';
        case 'service':
            return md.runtime ?? md.repo ?? '';
        case 'database':
            return md.engine ?? md.tables?.join(', ') ?? '';
        case 'queue':
            return md.broker ?? md.topics?.join(', ') ?? '';
        case 'worker':
            return md.schedule ?? '';
        case 'external':
            return md.vendor ?? md.url ?? '';
    }

    return '';
});

const hasError = computed(() =>
    props.issues.some((i) => i.severity === 'error'),
);
const hasWarn = computed(() =>
    props.issues.some((i) => i.severity === 'warning'),
);
const issueTitle = computed(() =>
    props.issues.map((i) => `• ${i.message}`).join('\n'),
);
</script>

<template>
    <div
        class="board-node"
        :class="{
            'is-selected': selected,
            'has-error': hasError,
            'has-warning': hasWarn && !hasError,
        }"
        :style="{
            width: node.width + 'px',
            minHeight: node.height + 'px',
            '--node-accent': def.accent,
        }"
    >
        <div class="board-node__head" data-drag-handle>
            <span class="board-node__icon">
                <component :is="Icon" :size="13" :stroke-width="2" />
            </span>
            <span class="board-node__title">{{ node.name }}</span>
            <span class="board-node__type">{{ def.label }}</span>
            <span
                v-if="hasError || hasWarn"
                class="board-node__alert"
                :class="hasError ? 'is-error' : 'is-warning'"
                :title="issueTitle"
            />
        </div>
        <div v-if="summary" class="board-node__body">{{ summary }}</div>

        <span class="board-node__port board-node__port--in" />
        <span
            class="board-node__port board-node__port--out"
            data-port="out"
            @pointerdown.stop.prevent="
                (e) =>
                    $emit('start-connection', {
                        nodeId: node.id,
                        clientX: e.clientX,
                        clientY: e.clientY,
                    })
            "
        />
    </div>
</template>

<style scoped>
.board-node {
    position: relative;
    border-radius: 8px;
    background: var(--color-node);
    border: 1px solid var(--color-border);
    box-shadow:
        inset 0 1px 0
            color-mix(in srgb, var(--color-foreground) 6%, transparent),
        0 1px 3px rgba(0, 0, 0, 0.28);
    color: var(--color-card-foreground);
    user-select: none;
    overflow: hidden;
    transition:
        border-color 120ms ease,
        box-shadow 140ms ease,
        transform 120ms ease;
    will-change: transform;
}
.board-node::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 2px;
    background: var(--node-accent);
    opacity: 0.8;
}
.board-node:hover {
    border-color: var(--color-border-strong);
    box-shadow:
        inset 0 1px 0
            color-mix(in srgb, var(--color-foreground) 7%, transparent),
        0 4px 16px rgba(0, 0, 0, 0.35);
}
.board-node.is-selected {
    border-color: var(--color-ring);
    box-shadow:
        0 0 0 3px color-mix(in srgb, var(--color-ring) 20%, transparent),
        0 6px 20px rgba(0, 0, 0, 0.36);
}
.board-node.has-error {
    border-color: color-mix(in srgb, hsl(0 60% 55%) 55%, var(--color-border));
}
.board-node.has-warning {
    border-color: color-mix(in srgb, hsl(35 55% 55%) 45%, var(--color-border));
}

.board-node__head {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 10px 5px 11px;
    cursor: grab;
}
.board-node__icon {
    display: inline-flex;
    color: var(--node-accent);
}
.board-node__title {
    font-weight: 600;
    font-size: 12.5px;
    letter-spacing: -0.005em;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--color-foreground);
}
.board-node__type {
    font-size: 9.5px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-text-secondary);
    font-weight: 600;
    padding: 1px 5px;
    border-radius: 3px;
    background: var(--color-surface-3);
}
.board-node__alert {
    width: 6px;
    height: 6px;
    border-radius: 50%;
}
.board-node__alert.is-error {
    background: hsl(0 65% 62%);
    box-shadow: 0 0 0 2.5px color-mix(in srgb, hsl(0 65% 62%) 28%, transparent);
}
.board-node__alert.is-warning {
    background: hsl(35 70% 62%);
    box-shadow: 0 0 0 2.5px color-mix(in srgb, hsl(35 70% 62%) 28%, transparent);
}

.board-node__body {
    padding: 2px 11px 8px;
    font-size: 11.5px;
    color: var(--color-text-secondary);
    line-height: 1.35;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
}

.board-node__port {
    position: absolute;
    top: 50%;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--color-surface-1);
    border: 1.5px solid var(--node-accent);
    transform: translateY(-50%);
    transition:
        transform 120ms ease,
        background-color 120ms ease,
        box-shadow 120ms ease;
}
.board-node__port--in {
    left: -5px;
}
.board-node__port--out {
    right: -5px;
    cursor: crosshair;
}
.board-node:hover .board-node__port--out {
    background: var(--node-accent);
    box-shadow: 0 0 0 3px
        color-mix(in srgb, var(--node-accent) 18%, transparent);
}
.board-node__port--out:hover {
    transform: translateY(-50%) scale(1.3);
}
</style>
