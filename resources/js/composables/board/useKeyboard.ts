/**
 * useKeyboard — global shortcut binding for the StrategyBoard editor.
 *
 * Mounted once from the page root. Inputs / contenteditable elements are
 * detected so we never steal Cmd+Z, copy, etc. while the user is typing.
 */
import { onMounted, onUnmounted } from 'vue';
import { useBoardStore } from './useBoardStore';
import { useBoardActions } from './useBoardActions';
import { useHistory } from './useHistory';
import { useClipboard } from './useClipboard';

const TEXT_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

function isInTextField(): boolean {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return false;
    if (TEXT_TAGS.has(el.tagName.toUpperCase())) return true;
    if (el.isContentEditable) return true;
    return false;
}

export function useKeyboard() {
    const store = useBoardStore();
    const { undo, redo } = useHistory();
    const { copySelection, paste } = useClipboard();
    const { deleteSelection } = useBoardActions();

    function onKey(e: KeyboardEvent) {
        const meta = e.metaKey || e.ctrlKey;
        const inText = isInTextField();

        if (e.key === 'Escape') {
            if (inText) {
                e.preventDefault();
                (document.activeElement as HTMLElement).blur();
                return;
            }
            if (store.focusActive.value) {
                e.preventDefault();
                store.clearFocus();
                return;
            }
            if (store.selection.nodes.size || store.selection.edges.size) {
                e.preventDefault();
                store.clearSelection();
            }
            return;
        }

        if (inText) return;

        if (meta && (e.key === 'z' || e.key === 'Z')) {
            e.preventDefault();
            if (e.shiftKey) redo(); else undo();
            return;
        }
        if (meta && (e.key === 'y' || e.key === 'Y')) {
            e.preventDefault();
            redo();
            return;
        }
        if (meta && (e.key === 'c' || e.key === 'C')) {
            if (store.selection.nodes.size) {
                e.preventDefault();
                copySelection();
            }
            return;
        }
        if (meta && (e.key === 'd' || e.key === 'D')) {
            // Duplicate in place (copy + paste).
            if (store.selection.nodes.size) {
                e.preventDefault();
                copySelection();
                paste();
            }
            return;
        }
        if (meta && (e.key === 'v' || e.key === 'V')) {
            e.preventDefault();
            paste();
            return;
        }
        if (meta && (e.key === 'a' || e.key === 'A')) {
            e.preventDefault();
            store.setNodeSelection(store.nodes.value.map((n) => n.id));
            return;
        }

        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (store.selection.nodes.size || store.selection.edges.size) {
                e.preventDefault();
                deleteSelection();
            }
            return;
        }

        if (!meta && (e.key === 'f' || e.key === 'F')) {
            if (store.focusActive.value || store.selection.nodes.size === 1) {
                e.preventDefault();
                store.toggleFocusOnSelection();
            }
        }
    }

    onMounted(() => window.addEventListener('keydown', onKey));
    onUnmounted(() => window.removeEventListener('keydown', onKey));
}
