/**
 * useClipboard — in-memory copy/paste of nodes (and the edges between them).
 *
 * Pasting offsets positions and re-IDs nodes/edges so the new selection is
 * disjoint from the original. Edges that crossed the selection boundary are
 * dropped (would dangle).
 */
import { ref } from 'vue';
import type { BoardEdge, BoardNode } from '@/types/board';
import { useBoardStore } from './useBoardStore';
import { useHistory } from './useHistory';

interface ClipboardPayload {
    nodes: BoardNode[];
    edges: BoardEdge[];
}

const buffer = ref<ClipboardPayload | null>(null);

let pasteCounter = 0;

export function useClipboard() {
    const store = useBoardStore();
    const { record } = useHistory();

    function copySelection(): boolean {
        const selectedIds = [...store.selection.nodes];
        if (!selectedIds.length) return false;
        const selSet = new Set(selectedIds);
        const ns = store.nodes.value
            .filter((n) => selSet.has(n.id))
            .map((n) => ({
                ...n,
                position: { ...n.position },
                metadata: { ...n.metadata },
                tags: [...n.tags],
            }));
        const es = store.edges.value
            .filter((e) => selSet.has(e.source) && selSet.has(e.target))
            .map((e) => ({ ...e, metadata: { ...e.metadata } }));
        buffer.value = { nodes: ns, edges: es };
        pasteCounter = 0;
        return true;
    }

    function paste(): string[] {
        if (!buffer.value || !buffer.value.nodes.length) return [];
        record();
        pasteCounter += 1;
        const offset = 32 * pasteCounter;
        const idMap = new Map<string, string>();
        const newIds: string[] = [];

        for (const original of buffer.value.nodes) {
            const placed = store.addNode({
                type: original.type,
                position: { x: original.position.x + offset, y: original.position.y + offset },
                name: `${original.name}-copy${pasteCounter > 1 ? pasteCounter : ''}`,
            });
            store.updateNode(placed.id, {
                metadata: { ...original.metadata },
                tags: [...original.tags],
                domain: original.domain ?? null,
                width: original.width,
                height: original.height,
            });
            idMap.set(original.id, placed.id);
            newIds.push(placed.id);
        }

        for (const e of buffer.value.edges) {
            const src = idMap.get(e.source);
            const tgt = idMap.get(e.target);
            if (!src || !tgt) continue;
            const placed = store.addEdge(src, tgt, e.type);
            if (placed) store.updateEdge(placed.id, { label: e.label, metadata: { ...e.metadata } });
        }

        store.setNodeSelection(newIds);
        return newIds;
    }

    function hasClip(): boolean {
        return !!buffer.value && buffer.value.nodes.length > 0;
    }

    return { copySelection, paste, hasClip };
}
