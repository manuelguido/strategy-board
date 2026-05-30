<script setup lang="ts">
/**
 * Canvas — the infinite pan/zoom surface.
 *
 * Handles:
 *   • Pan with wheel (no modifier) and middle-mouse / space drag.
 *   • Zoom with ctrl/meta + wheel (anchored to cursor).
 *   • Marquee selection on left-drag from empty space.
 *   • Node drag on header (snaps to 8px on release).
 *   • Edge creation by dragging from a node's right port to another node.
 *   • Renders the grid background, edges (SVG), nodes (DIV layer), ghost edge,
 *     and marquee.
 *
 * The canvas listens to `pointermove` / `pointerup` on the window during drags
 * to keep tracking even if the cursor leaves the element.
 */
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useBoardActions } from '@/composables/board/useBoardActions';
import { useBoardStore } from '@/composables/board/useBoardStore';
import { useHistory } from '@/composables/board/useHistory';
import { useValidation } from '@/composables/board/useValidation';
import { useViewport } from '@/composables/board/useViewport';
import type { BoardNode as BoardNodeT, EdgeType, Point } from '@/types/board';
import BoardEdge from './BoardEdge.vue';
import BoardNode from './BoardNode.vue';

const store = useBoardStore();
const vp = useViewport();
const actions = useBoardActions();
const validation = useValidation();
const history = useHistory();

const root = ref<HTMLDivElement | null>(null);
const size = reactive({ width: 0, height: 0 });

/* Element geometry tracking ─────────────────────────────────────── */
let ro: ResizeObserver | null = null;

onMounted(() => {
    if (!root.value) {
        return;
    }

    const r = root.value.getBoundingClientRect();
    size.width = r.width;
    size.height = r.height;
    ro = new ResizeObserver((entries) => {
        for (const e of entries) {
            size.width = e.contentRect.width;
            size.height = e.contentRect.height;
        }
    });
    ro.observe(root.value);
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
});
onBeforeUnmount(() => {
    ro?.disconnect();
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKey);
});

defineExpose({
    getViewportSize: () => ({ width: size.width, height: size.height }),
    fit: () => vp.fit(size),
});

/* ── Pan/zoom (wheel) ───────────────────────────────────────────── */
function onWheel(e: WheelEvent) {
    e.preventDefault();

    if (!root.value) {
        return;
    }

    if (e.ctrlKey || e.metaKey) {
        const r = root.value.getBoundingClientRect();
        const factor = Math.exp(-e.deltaY * 0.0015);
        vp.zoomAt({ x: e.clientX - r.left, y: e.clientY - r.top }, factor);
    } else {
        vp.panBy(-e.deltaX, -e.deltaY);
    }
}

/* ── Space-to-pan tracking ──────────────────────────────────────── */
const spaceHeld = ref(false);
function onKey(e: KeyboardEvent) {
    if (e.code === 'Space') {
        const inText =
            document.activeElement &&
            /^(INPUT|TEXTAREA|SELECT)$/i.test(
                (document.activeElement as HTMLElement).tagName,
            );

        if (!inText) {
            spaceHeld.value = e.type === 'keydown';
        }
    }
}

/* ── Pointer interaction state ──────────────────────────────────── */
type Mode =
    | { kind: 'idle' }
    | { kind: 'pan'; lastClient: Point }
    | {
          kind: 'marquee';
          startWorld: Point;
          currentWorld: Point;
          additive: boolean;
      }
    | { kind: 'drag'; last: Point; ids: string[] }
    | { kind: 'connect'; fromId: string; cursor: Point };

const mode = ref<Mode>({ kind: 'idle' });

function clientToLocal(e: PointerEvent): Point {
    const r = root.value!.getBoundingClientRect();

    return { x: e.clientX - r.left, y: e.clientY - r.top };
}

function startPan(e: PointerEvent) {
    (e.target as Element).setPointerCapture(e.pointerId);
    mode.value = { kind: 'pan', lastClient: { x: e.clientX, y: e.clientY } };
}

function onCanvasPointerDown(e: PointerEvent) {
    if (e.button === 1 || (e.button === 0 && spaceHeld.value)) {
        e.preventDefault();
        startPan(e);

        return;
    }

    if (e.button !== 0) {
        return;
    }

    // Did the click hit a node?
    const target = e.target as HTMLElement;
    const nodeEl = target.closest('[data-node-id]') as HTMLElement | null;
    const portEl = target.closest('[data-port="out"]') as HTMLElement | null;

    if (portEl && nodeEl) {
        // handled by BoardNode emit; skip here
        return;
    }

    if (nodeEl) {
        const nodeId = nodeEl.dataset.nodeId!;
        const additive = e.shiftKey || e.metaKey || e.ctrlKey;
        const handle = target.closest('[data-drag-handle]');

        // Selection logic
        if (additive) {
            if (store.selection.nodes.has(nodeId)) {
                store.selection.nodes.delete(nodeId);
            } else {
                store.selectNode(nodeId, true);
            }
        } else if (!store.selection.nodes.has(nodeId)) {
            store.selectNode(nodeId, false);
        }

        // Begin drag if pointer down on header
        if (handle && store.selection.nodes.has(nodeId)) {
            (e.target as Element).setPointerCapture(e.pointerId);
            history.record();
            mode.value = {
                kind: 'drag',
                last: { x: e.clientX, y: e.clientY },
                ids: [...store.selection.nodes],
            };
        }

        return;
    }

    // Empty canvas → marquee (or pan with space)
    const local = clientToLocal(e);
    const world = vp.toWorld(local);
    (e.target as Element).setPointerCapture(e.pointerId);

    if (!e.shiftKey && !e.metaKey && !e.ctrlKey) {
        store.clearSelection();
    }

    mode.value = {
        kind: 'marquee',
        startWorld: world,
        currentWorld: world,
        additive: e.shiftKey || e.metaKey || e.ctrlKey,
    };
}

function onCanvasPointerMove(e: PointerEvent) {
    const m = mode.value;

    if (m.kind === 'idle') {
        return;
    }

    if (m.kind === 'pan') {
        const dx = e.clientX - m.lastClient.x;
        const dy = e.clientY - m.lastClient.y;
        vp.panBy(dx, dy);
        m.lastClient = { x: e.clientX, y: e.clientY };

        return;
    }

    if (m.kind === 'drag') {
        const dx = (e.clientX - m.last.x) / store.viewport.zoom;
        const dy = (e.clientY - m.last.y) / store.viewport.zoom;
        const updates = new Map<string, Point>();

        for (const id of m.ids) {
            const n = store.findNode(id);

            if (!n) {
                continue;
            }

            updates.set(id, { x: n.position.x + dx, y: n.position.y + dy });
        }

        store.moveNodesBatch(updates);
        m.last = { x: e.clientX, y: e.clientY };

        return;
    }

    if (m.kind === 'marquee') {
        m.currentWorld = vp.toWorld(clientToLocal(e));

        return;
    }

    if (m.kind === 'connect') {
        m.cursor = vp.toWorld(clientToLocal(e));

        return;
    }
}

function snap(v: number, grid = 8): number {
    return Math.round(v / grid) * grid;
}

function onCanvasPointerUp(e: PointerEvent) {
    const m = mode.value;

    if (m.kind === 'drag') {
        // snap to grid
        const updates = new Map<string, Point>();

        for (const id of m.ids) {
            const n = store.findNode(id);

            if (!n) {
                continue;
            }

            updates.set(id, { x: snap(n.position.x), y: snap(n.position.y) });
        }

        store.moveNodesBatch(updates);
    }

    if (m.kind === 'marquee') {
        const a = m.startWorld;
        const b = m.currentWorld;
        const x1 = Math.min(a.x, b.x),
            x2 = Math.max(a.x, b.x);
        const y1 = Math.min(a.y, b.y),
            y2 = Math.max(a.y, b.y);
        const inside = store.nodes.value
            .filter((n) => {
                const cx = n.position.x + n.width / 2;
                const cy = n.position.y + n.height / 2;

                return cx >= x1 && cx <= x2 && cy >= y1 && cy <= y2;
            })
            .map((n) => n.id);

        if (m.additive) {
            inside.forEach((id) => store.selection.nodes.add(id));
        } else {
            store.setNodeSelection(inside);
        }
    }

    if (m.kind === 'connect') {
        // Find node under cursor (use document.elementsFromPoint).
        const hit = document
            .elementsFromPoint(e.clientX, e.clientY)
            .map(
                (el) =>
                    (el as HTMLElement).closest?.(
                        '[data-node-id]',
                    ) as HTMLElement | null,
            )
            .find((el) => el && el.dataset.nodeId !== m.fromId);

        if (hit) {
            const targetId = hit.dataset.nodeId!;
            const src = store.findNode(m.fromId);
            const tgt = store.findNode(targetId);

            if (src && tgt) {
                // Pick a sensible default edge type.
                let type: EdgeType = 'sync';

                if (tgt.type === 'database') {
                    type = 'write';
                } else if (tgt.type === 'queue') {
                    type = 'async';
                } else if (tgt.type === 'worker') {
                    type = 'async';
                }

                actions.connect(m.fromId, targetId, type);
            }
        }
    }

    mode.value = { kind: 'idle' };
}

/* ── Connection start (from BoardNode emit) ─────────────────────── */
function startConnection(payload: {
    nodeId: string;
    clientX: number;
    clientY: number;
}) {
    if (!root.value) {
        return;
    }

    const local = {
        x: payload.clientX - root.value.getBoundingClientRect().left,
        y: payload.clientY - root.value.getBoundingClientRect().top,
    };
    mode.value = {
        kind: 'connect',
        fromId: payload.nodeId,
        cursor: vp.toWorld(local),
    };
}

/* ── Derived rendering data ─────────────────────────────────────── */
const transformStyle = computed(() => ({
    transform: `translate(${store.viewport.offset.x}px, ${store.viewport.offset.y}px) scale(${store.viewport.zoom})`,
    transformOrigin: '0 0',
}));

const gridStyle = computed(() => {
    const z = store.viewport.zoom;
    const minor = 24 * z;
    const major = minor * 4;
    const ox = store.viewport.offset.x;
    const oy = store.viewport.offset.y;

    return {
        // Two-tier grid: major lines slightly stronger, minor lines barely
        // perceptible. Both use foreground tints (alpha) so the same value
        // works on light and dark themes without a hard-coded color.
        backgroundImage: `
            linear-gradient(to right, color-mix(in srgb, var(--color-foreground) 6%, transparent) 1px, transparent 1px),
            linear-gradient(to bottom, color-mix(in srgb, var(--color-foreground) 6%, transparent) 1px, transparent 1px),
            linear-gradient(to right, color-mix(in srgb, var(--color-foreground) 3%, transparent) 1px, transparent 1px),
            linear-gradient(to bottom, color-mix(in srgb, var(--color-foreground) 3%, transparent) 1px, transparent 1px)
        `,
        backgroundSize: `${major}px ${major}px, ${major}px ${major}px, ${minor}px ${minor}px, ${minor}px ${minor}px`,
        backgroundPosition: `${ox}px ${oy}px, ${ox}px ${oy}px, ${ox}px ${oy}px, ${ox}px ${oy}px`,
    };
});

const nodesById = computed(
    () => new Map(store.nodes.value.map((n) => [n.id, n] as const)),
);

const renderableEdges = computed(() => {
    // Group edges by undirected pair so parallel edges between the same two
    // nodes get a perpendicular offset and never overlap.
    const groups = new Map<string, string[]>();

    for (const e of store.edges.value) {
        const key =
            e.source < e.target
                ? `${e.source}|${e.target}`
                : `${e.target}|${e.source}`;

        if (!groups.has(key)) {
            groups.set(key, []);
        }

        groups.get(key)!.push(e.id);
    }

    const offsetIndex = new Map<string, { index: number; total: number }>();

    for (const ids of groups.values()) {
        ids.forEach((id, i) =>
            offsetIndex.set(id, { index: i, total: ids.length }),
        );
    }

    return store.edges.value
        .map((e) => {
            const s = nodesById.value.get(e.source);
            const t = nodesById.value.get(e.target);

            if (!s || !t) {
                return null;
            }

            const meta = offsetIndex.get(e.id)!;
            const offset = (meta.index - (meta.total - 1) / 2) * 14;

            return { edge: e, source: s, target: t, parallelOffset: offset };
        })
        .filter(
            (
                x,
            ): x is {
                edge: (typeof store.edges.value)[number];
                source: BoardNodeT;
                target: BoardNodeT;
                parallelOffset: number;
            } => !!x,
        );
});

const ghostEdgePath = computed(() => {
    const m = mode.value;

    if (m.kind !== 'connect') {
        return null;
    }

    const src = store.findNode(m.fromId);

    if (!src) {
        return null;
    }

    const sx = src.position.x + src.width;
    const sy = src.position.y + src.height / 2;
    const tx = m.cursor.x;
    const ty = m.cursor.y;
    const dx = Math.max(40, Math.abs(tx - sx) * 0.5);

    return `M ${sx} ${sy} C ${sx + dx} ${sy}, ${tx - dx} ${ty}, ${tx} ${ty}`;
});

const marqueeRect = computed(() => {
    const m = mode.value;

    if (m.kind !== 'marquee') {
        return null;
    }

    const a = vp.toScreen(m.startWorld);
    const b = vp.toScreen(m.currentWorld);

    return {
        left: Math.min(a.x, b.x),
        top: Math.min(a.y, b.y),
        width: Math.abs(b.x - a.x),
        height: Math.abs(b.y - a.y),
    };
});

const cursorClass = computed(() => {
    if (mode.value.kind === 'pan') {
        return 'is-grabbing';
    }

    if (spaceHeld.value) {
        return 'is-grab';
    }

    return '';
});

function nodeIssues(id: string) {
    return validation.issueByNode.value.get(id) ?? [];
}
function edgeIssues(id: string) {
    return validation.issueByEdge.value.get(id) ?? [];
}
</script>

<template>
    <div
        ref="root"
        class="canvas-root"
        :class="cursorClass"
        @wheel="onWheel"
        @pointerdown="onCanvasPointerDown"
        @pointermove="onCanvasPointerMove"
        @pointerup="onCanvasPointerUp"
        @pointercancel="onCanvasPointerUp"
        @contextmenu.prevent
    >
        <!-- Grid (fixed to root, simulated by background-position offset) -->
        <div class="canvas-grid" :style="gridStyle" />

        <!-- SVG layer for edges -->
        <svg class="canvas-svg" :width="size.width" :height="size.height">
            <g
                :transform="`translate(${store.viewport.offset.x} ${store.viewport.offset.y}) scale(${store.viewport.zoom})`"
            >
                <BoardEdge
                    v-for="entry in renderableEdges"
                    :key="entry.edge.id"
                    :edge="entry.edge"
                    :source="entry.source"
                    :target="entry.target"
                    :selected="store.selection.edges.has(entry.edge.id)"
                    :issues="edgeIssues(entry.edge.id)"
                    :parallel-offset="entry.parallelOffset"
                    :dimmed="
                        store.focusActive.value &&
                        !store.focusedEdges.value.has(entry.edge.id)
                    "
                    @select="(id) => store.selectEdge(id)"
                />
                <path
                    v-if="ghostEdgePath"
                    :d="ghostEdgePath"
                    stroke="var(--color-ring)"
                    stroke-width="1.5"
                    stroke-dasharray="4 3"
                    fill="none"
                    opacity="0.7"
                />
            </g>
        </svg>

        <!-- Node layer (transformed) -->
        <div class="canvas-world" :style="transformStyle">
            <div
                v-for="n in store.nodes.value"
                :key="n.id"
                class="canvas-node-wrap"
                :class="{
                    'is-dimmed':
                        store.focusActive.value &&
                        !store.focusedNodes.value.has(n.id),
                }"
                :data-node-id="n.id"
                :style="{ left: n.position.x + 'px', top: n.position.y + 'px' }"
            >
                <BoardNode
                    :node="n"
                    :selected="store.selection.nodes.has(n.id)"
                    :issues="nodeIssues(n.id)"
                    @start-connection="startConnection"
                />
            </div>
        </div>

        <!-- Marquee overlay (screen space) -->
        <div
            v-if="marqueeRect"
            class="canvas-marquee"
            :style="{
                left: marqueeRect.left + 'px',
                top: marqueeRect.top + 'px',
                width: marqueeRect.width + 'px',
                height: marqueeRect.height + 'px',
            }"
        />
    </div>
</template>

<style scoped>
.canvas-root {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: var(--color-background);
    touch-action: none;
    cursor: default;
}
.canvas-root.is-grab {
    cursor: grab;
}
.canvas-root.is-grabbing {
    cursor: grabbing;
}

.canvas-grid {
    position: absolute;
    inset: 0;
    pointer-events: none;
}
.canvas-svg {
    position: absolute;
    inset: 0;
    pointer-events: none;
}
.canvas-svg :deep(g) {
    pointer-events: auto;
}

.canvas-world {
    position: absolute;
    inset: 0;
    pointer-events: none;
}
.canvas-node-wrap {
    position: absolute;
    pointer-events: auto;
    transition: opacity 180ms ease;
}
.canvas-node-wrap.is-dimmed {
    opacity: 0.18;
}
.canvas-marquee {
    position: absolute;
    border: 1px solid var(--color-ring);
    background: color-mix(in srgb, var(--color-ring) 10%, transparent);
    border-radius: 2px;
    pointer-events: none;
}
</style>
