/**
 * useBoardActions — high-level mutations that wrap the store with history.
 *
 * Components and the keyboard layer call these — never the raw store — so
 * every change is recorded for undo/redo.
 */
import type { EdgeType, NodeType, Point } from '@/types/board';
import { useBoardStore } from './useBoardStore';
import { useHistory } from './useHistory';

export function useBoardActions() {
    const store = useBoardStore();
    const { record } = useHistory();

    function addNodeAt(type: NodeType, position: Point) {
        record();
        const node = store.addNode({ type, position });
        store.selectNode(node.id);
        return node;
    }

    function moveNodes(updates: Array<{ id: string; position: Point }>) {
        record();
        for (const u of updates) store.moveNode(u.id, u.position);
    }

    function renameNode(id: string, name: string) {
        record();
        store.updateNode(id, { name });
    }

    function patchNode(id: string, patch: Parameters<typeof store.updateNode>[1]) {
        record();
        store.updateNode(id, patch);
    }

    function deleteSelection() {
        const nodeIds = [...store.selection.nodes];
        const edgeIds = [...store.selection.edges];
        if (!nodeIds.length && !edgeIds.length) return;
        record();
        if (edgeIds.length) store.removeEdges(edgeIds);
        if (nodeIds.length) store.removeNodes(nodeIds);
    }

    function connect(source: string, target: string, type: EdgeType) {
        record();
        return store.addEdge(source, target, type);
    }

    function patchEdge(id: string, patch: Parameters<typeof store.updateEdge>[1]) {
        record();
        store.updateEdge(id, patch);
    }

    return { addNodeAt, moveNodes, renameNode, patchNode, deleteSelection, connect, patchEdge };
}
