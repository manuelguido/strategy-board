/**
 * useHistory — single global undo/redo stack for the board.
 *
 * Snapshots are full BoardState clones (cheap at this scale; the whole model
 * fits in a few KB). `record()` is called explicitly BEFORE each mutation by
 * the actions layer, so redo/undo navigate to the state we want.
 */
import { computed, ref } from 'vue';
import type { BoardState } from '@/types/board';
import { cloneState, useBoardStore } from './useBoardStore';

const past   = ref<BoardState[]>([]);
const future = ref<BoardState[]>([]);
const MAX    = 100;

let applying = false;

export function isApplyingHistory(): boolean {
    return applying;
}

export function useHistory() {
    const store = useBoardStore();

    function record() {
        if (applying) return;
        past.value.push(store.snapshot());
        if (past.value.length > MAX) past.value.shift();
        if (future.value.length) future.value = [];
    }

    function undo() {
        if (!past.value.length) return;
        const prev = past.value.pop()!;
        future.value.push(store.snapshot());
        applying = true;
        store.replaceAll(cloneState(prev));
        // micro-task release; replaceAll is synchronous
        Promise.resolve().then(() => { applying = false; });
    }

    function redo() {
        if (!future.value.length) return;
        const next = future.value.pop()!;
        past.value.push(store.snapshot());
        applying = true;
        store.replaceAll(cloneState(next));
        Promise.resolve().then(() => { applying = false; });
    }

    function clear() {
        past.value = [];
        future.value = [];
    }

    const canUndo = computed(() => past.value.length > 0);
    const canRedo = computed(() => future.value.length > 0);

    return { record, undo, redo, clear, canUndo, canRedo };
}
