/**
 * useBoardStore — single source of truth for the StrategyBoard editor.
 *
 * State is held in module-scoped refs so the same instance is shared by every
 * component that imports `useBoardStore()`. State is JSON-serializable; the
 * board can be exported / imported losslessly.
 */
import { computed, reactive, ref } from 'vue';
import type {
    BoardEdge,
    BoardNode,
    BoardState,
    EdgeType,
    NodeType,
    Point,
    Viewport,
} from '@/types/board';
import { NODE_TYPE_MAP, SAMPLE_BOARD } from '@/types/board';

const LS_KEY = 'strategy-board.state.v1';

/* ── ID generation ──────────────────────────────────────────────── */

let _counter = 0;
function uid(prefix: string): string {
    _counter += 1;

    return `${prefix}_${Date.now().toString(36)}${_counter.toString(36)}`;
}

/* ── Selection ──────────────────────────────────────────────────── */

interface Selection {
    nodes: Set<string>;
    edges: Set<string>;
}

function emptySelection(): Selection {
    return { nodes: new Set(), edges: new Set() };
}

/* ── Initial state ──────────────────────────────────────────────── */

function loadFromStorage(): BoardState | null {
    try {
        const raw = localStorage.getItem(LS_KEY);

        if (!raw) {
            return null;
        }

        const parsed = JSON.parse(raw) as BoardState;

        if (
            !parsed ||
            !Array.isArray(parsed.nodes) ||
            !Array.isArray(parsed.edges)
        ) {
            return null;
        }

        return parsed;
    } catch {
        return null;
    }
}

const initial = loadFromStorage() ?? cloneState(SAMPLE_BOARD);

const name = ref(initial.name);
const nodes = ref<BoardNode[]>(initial.nodes);
const edges = ref<BoardEdge[]>(initial.edges);
const viewport = reactive<Viewport>({ ...initial.viewport });
const selection = reactive<Selection>(emptySelection());

/** Set of node ids that participate in the current focused flow. Empty = no focus. */
const focusedNodes = ref<Set<string>>(new Set());
/** Set of edge ids that participate in the current focused flow. */
const focusedEdges = ref<Set<string>>(new Set());
const focusActive = computed(() => focusedNodes.value.size > 0);

/* ── Persistence (debounced) ────────────────────────────────────── */

let persistTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePersist() {
    if (persistTimer) {
        clearTimeout(persistTimer);
    }

    persistTimer = setTimeout(() => {
        try {
            const snapshot: BoardState = {
                name: name.value,
                nodes: nodes.value,
                edges: edges.value,
                viewport: {
                    offset: { ...viewport.offset },
                    zoom: viewport.zoom,
                },
            };
            localStorage.setItem(LS_KEY, JSON.stringify(snapshot));
        } catch {
            /* quota */
        }
    }, 200);
}

/* ── Helpers ────────────────────────────────────────────────────── */

export function cloneState(s: BoardState): BoardState {
    return {
        name: s.name,
        viewport: { offset: { ...s.viewport.offset }, zoom: s.viewport.zoom },
        nodes: s.nodes.map((n) => ({
            ...n,
            position: { ...n.position },
            metadata: { ...n.metadata },
            tags: [...n.tags],
        })),
        edges: s.edges.map((e) => ({ ...e, metadata: { ...e.metadata } })),
    };
}

function findNode(id: string): BoardNode | undefined {
    return nodes.value.find((n) => n.id === id);
}

/* ── Mutations ──────────────────────────────────────────────────── */

function defaultMetadataFor(type: NodeType) {
    switch (type) {
        case 'api':
            return { endpoints: [], auth: 'none' as const };
        case 'service':
            return { runtime: '' };
        case 'database':
            return { engine: '', tables: [] };
        case 'queue':
            return { broker: '', topics: [] };
        case 'worker':
            return { schedule: '' };
        case 'external':
            return { vendor: '' };
    }
}

function nextNameFor(type: NodeType): string {
    const def = NODE_TYPE_MAP[type];
    const base = def.label.toLowerCase();
    const taken = new Set(nodes.value.map((n) => n.name));
    let i = nodes.value.filter((n) => n.type === type).length + 1;
    let candidate = `${base}-${i}`;

    while (taken.has(candidate)) {
        i += 1;
        candidate = `${base}-${i}`;
    }

    return candidate;
}

export interface AddNodeOptions {
    type: NodeType;
    position: Point;
    name?: string;
}

function addNode(opts: AddNodeOptions): BoardNode {
    const node: BoardNode = {
        id: uid('n'),
        type: opts.type,
        name: opts.name ?? nextNameFor(opts.type),
        position: { ...opts.position },
        width: 184,
        height: 70,
        metadata: defaultMetadataFor(opts.type),
        tags: [],
        domain: null,
    };
    nodes.value = [...nodes.value, node];
    schedulePersist();

    return node;
}

function updateNode(id: string, patch: Partial<BoardNode>) {
    nodes.value = nodes.value.map((n) =>
        n.id === id
            ? {
                  ...n,
                  ...patch,
                  position: patch.position ? { ...patch.position } : n.position,
                  metadata: patch.metadata
                      ? { ...n.metadata, ...patch.metadata }
                      : n.metadata,
                  tags: patch.tags ? [...patch.tags] : n.tags,
              }
            : n,
    );
    schedulePersist();
}

function moveNode(id: string, position: Point) {
    const arr = nodes.value;

    for (let i = 0; i < arr.length; i++) {
        if (arr[i].id === id) {
            arr[i] = { ...arr[i], position: { ...position } };
            break;
        }
    }

    nodes.value = arr;
    schedulePersist();
}

/**
 * Apply many position updates in a single reactive pass. Used by drag handlers
 * so a 50-node multi-select drag doesn't trigger 50 reactivity cycles per frame.
 */
function moveNodesBatch(updates: Map<string, Point>) {
    if (!updates.size) {
        return;
    }

    const arr = nodes.value.slice();

    for (let i = 0; i < arr.length; i++) {
        const next = updates.get(arr[i].id);

        if (next) {
            arr[i] = { ...arr[i], position: { x: next.x, y: next.y } };
        }
    }

    nodes.value = arr;
    schedulePersist();
}

function removeNodes(ids: string[]) {
    const set = new Set(ids);
    nodes.value = nodes.value.filter((n) => !set.has(n.id));
    edges.value = edges.value.filter(
        (e) => !set.has(e.source) && !set.has(e.target),
    );
    ids.forEach((id) => selection.nodes.delete(id));
    schedulePersist();
}

function addEdge(
    source: string,
    target: string,
    type: EdgeType,
): BoardEdge | null {
    if (source === target) {
        return null;
    }

    const exists = edges.value.some(
        (e) => e.source === source && e.target === target && e.type === type,
    );

    if (exists) {
        return null;
    }

    const edge: BoardEdge = {
        id: uid('e'),
        type,
        source,
        target,
        metadata: {},
    };
    edges.value = [...edges.value, edge];
    schedulePersist();

    return edge;
}

function updateEdge(id: string, patch: Partial<BoardEdge>) {
    edges.value = edges.value.map((e) =>
        e.id === id
            ? {
                  ...e,
                  ...patch,
                  metadata: patch.metadata
                      ? { ...e.metadata, ...patch.metadata }
                      : e.metadata,
              }
            : e,
    );
    schedulePersist();
}

function removeEdges(ids: string[]) {
    const set = new Set(ids);
    edges.value = edges.value.filter((e) => !set.has(e.id));
    ids.forEach((id) => selection.edges.delete(id));
    schedulePersist();
}

/* ── Selection mutations ────────────────────────────────────────── */

function selectNode(id: string, additive = false) {
    if (!additive) {
        selection.nodes.clear();
        selection.edges.clear();
    } else {
        selection.edges.clear();
    }

    selection.nodes.add(id);
}

function selectEdge(id: string, additive = false) {
    if (!additive) {
        selection.nodes.clear();
        selection.edges.clear();
    } else {
        selection.nodes.clear();
    }

    selection.edges.add(id);
}

function setNodeSelection(ids: string[]) {
    selection.nodes.clear();
    selection.edges.clear();
    ids.forEach((id) => selection.nodes.add(id));
}

function clearSelection() {
    selection.nodes.clear();
    selection.edges.clear();
}

const selectedNodes = computed(() =>
    nodes.value.filter((n) => selection.nodes.has(n.id)),
);
const selectedEdges = computed(() =>
    edges.value.filter((e) => selection.edges.has(e.id)),
);

const singleSelectedNode = computed<BoardNode | null>(() =>
    selection.nodes.size === 1 && selection.edges.size === 0
        ? (findNode([...selection.nodes][0]) ?? null)
        : null,
);

const singleSelectedEdge = computed<BoardEdge | null>(() =>
    selection.edges.size === 1 && selection.nodes.size === 0
        ? (edges.value.find((e) => e.id === [...selection.edges][0]) ?? null)
        : null,
);

/* ── Replace whole state (import / restore) ─────────────────────── */

function replaceAll(next: BoardState) {
    name.value = next.name;
    nodes.value = next.nodes.map((n) => ({
        ...n,
        position: { ...n.position },
        metadata: { ...n.metadata },
        tags: [...n.tags],
    }));
    edges.value = next.edges.map((e) => ({
        ...e,
        metadata: { ...e.metadata },
    }));
    viewport.offset = { ...next.viewport.offset };
    viewport.zoom = next.viewport.zoom;
    clearSelection();
    schedulePersist();
}

function snapshot(): BoardState {
    return cloneState({
        name: name.value,
        nodes: nodes.value,
        edges: edges.value,
        viewport: { offset: { ...viewport.offset }, zoom: viewport.zoom },
    });
}

function rename(next: string) {
    name.value = next;
    schedulePersist();
}

/* ── Focus mode ─────────────────────────────────────────────────── */

/**
 * Compute the connected flow around `rootId` — all nodes reachable in either
 * direction by following edges (data-flow agnostic). Activates focus mode.
 */
function focusFlow(rootId: string) {
    const adjOut = new Map<string, string[]>();
    const adjIn = new Map<string, string[]>();
    edges.value.forEach((e) => {
        if (!adjOut.has(e.source)) {
            adjOut.set(e.source, []);
        }

        adjOut.get(e.source)!.push(e.target);

        if (!adjIn.has(e.target)) {
            adjIn.set(e.target, []);
        }

        adjIn.get(e.target)!.push(e.source);
    });
    const visited = new Set<string>([rootId]);
    const queue: string[] = [rootId];

    while (queue.length) {
        const u = queue.shift()!;

        for (const v of adjOut.get(u) ?? []) {
            if (!visited.has(v)) {
                visited.add(v);
                queue.push(v);
            }
        }

        for (const v of adjIn.get(u) ?? []) {
            if (!visited.has(v)) {
                visited.add(v);
                queue.push(v);
            }
        }
    }

    const eIds = new Set<string>();
    edges.value.forEach((e) => {
        if (visited.has(e.source) && visited.has(e.target)) {
            eIds.add(e.id);
        }
    });
    focusedNodes.value = visited;
    focusedEdges.value = eIds;
}

function clearFocus() {
    if (focusedNodes.value.size === 0 && focusedEdges.value.size === 0) {
        return;
    }

    focusedNodes.value = new Set();
    focusedEdges.value = new Set();
}

function toggleFocusOnSelection() {
    if (focusActive.value) {
        clearFocus();

        return;
    }

    const id = [...selection.nodes][0];

    if (id) {
        focusFlow(id);
    }
}

function setViewport(next: Partial<Viewport>) {
    if (next.offset) {
        viewport.offset = { ...next.offset };
    }

    if (typeof next.zoom === 'number') {
        viewport.zoom = next.zoom;
    }

    schedulePersist();
}

/* ── Public API ─────────────────────────────────────────────────── */

export function useBoardStore() {
    return {
        // state
        name,
        nodes,
        edges,
        viewport,
        selection,
        // derived
        selectedNodes,
        selectedEdges,
        singleSelectedNode,
        singleSelectedEdge,
        // node/edge mutations
        addNode,
        updateNode,
        moveNode,
        moveNodesBatch,
        removeNodes,
        addEdge,
        updateEdge,
        removeEdges,
        // selection
        selectNode,
        selectEdge,
        setNodeSelection,
        clearSelection,
        // bulk
        replaceAll,
        snapshot,
        rename,
        setViewport,
        // utilities
        findNode,
        // focus mode
        focusedNodes,
        focusedEdges,
        focusActive,
        focusFlow,
        clearFocus,
        toggleFocusOnSelection,
    };
}
