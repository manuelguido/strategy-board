<script setup lang="ts">
/**
 * Toolbar — top bar: editable board name, undo/redo, fit, zoom %, export menu,
 * import button.
 */
import { computed, ref } from 'vue';
import { Undo2, Redo2, Maximize2, Download, Upload, ChevronDown, Focus } from 'lucide-vue-next';
import { useBoardStore } from '@/composables/board/useBoardStore';
import { useHistory } from '@/composables/board/useHistory';
import { useExport } from '@/composables/board/useExport';
import { useViewport } from '@/composables/board/useViewport';

const props = defineProps<{ viewportSize: { width: number; height: number } }>();

const store    = useBoardStore();
const history  = useHistory();
const exporter = useExport();
const vp       = useViewport();

const name = computed({
    get: () => store.name.value,
    set: (v: string) => store.rename(v),
});

const zoomPct = computed(() => Math.round(store.viewport.zoom * 100));

const fileInput = ref<HTMLInputElement | null>(null);
const exportOpen = ref(false);

async function onFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const result = await exporter.importFromFile(file);
    if (!result.ok) {
        // eslint-disable-next-line no-alert
        alert(result.error || 'Import failed.');
    }
    input.value = '';
}

function fit() {
    vp.fit(props.viewportSize);
}

function setZoom(z: number) {
    vp.setZoom(z);
}

function toggleFocus() {
    store.toggleFocusOnSelection();
}

const focusEnabled = computed(() => store.focusActive.value || store.selection.nodes.size === 1);
const focusLabel = computed(() => store.focusActive.value ? 'Exit focus' : 'Focus flow');
</script>

<template>
    <div class="toolbar">
        <div class="toolbar__brand">
            <span class="toolbar__dot" />
            <span class="toolbar__brand-text">StrategyBoard</span>
            <span class="toolbar__sep">/</span>
            <input
                v-model="name"
                class="toolbar__name"
                spellcheck="false"
                @keydown.enter="(e) => (e.target as HTMLInputElement).blur()"
            />
        </div>

        <div class="toolbar__group">
            <button
                class="toolbar__btn"
                :disabled="!history.canUndo.value"
                title="Undo (⌘Z)"
                @click="history.undo()"
            ><Undo2 :size="15" /></button>
            <button
                class="toolbar__btn"
                :disabled="!history.canRedo.value"
                title="Redo (⇧⌘Z)"
                @click="history.redo()"
            ><Redo2 :size="15" /></button>
        </div>

        <div class="toolbar__group">
            <button class="toolbar__btn" title="Fit to content" @click="fit">
                <Maximize2 :size="15" />
            </button>
            <button class="toolbar__btn toolbar__zoom" @click="setZoom(1)" title="Reset zoom">
                {{ zoomPct }}%
            </button>
            <button
                class="toolbar__btn"
                :class="{ 'is-active': store.focusActive.value }"
                :disabled="!focusEnabled"
                :title="`${focusLabel} (F)`"
                @click="toggleFocus"
            ><Focus :size="15" /></button>
        </div>

        <div class="toolbar__spacer" />

        <div class="toolbar__group">
            <input
                ref="fileInput"
                type="file"
                accept="application/json"
                style="display: none"
                @change="onFileChange"
            />
            <button class="toolbar__btn" title="Import JSON" @click="fileInput?.click()">
                <Upload :size="15" /> <span>Import</span>
            </button>

            <div class="toolbar__menu">
                <button class="toolbar__btn toolbar__btn--primary" @click="exportOpen = !exportOpen">
                    <Download :size="15" /> <span>Export</span> <ChevronDown :size="13" />
                </button>
                <div v-if="exportOpen" class="toolbar__menu-list" @click="exportOpen = false">
                    <button @click="exporter.downloadJSON()">JSON model (.json)</button>
                    <button @click="exporter.downloadMarkdown()">Markdown docs (.md)</button>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.toolbar {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 8px 14px;
    height: 48px;
    background: var(--color-card);
    border-bottom: 1px solid var(--color-border-subtle);
    box-shadow: 0 1px 0 var(--color-border);
    user-select: none;
}
.toolbar__brand {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 600;
}
.toolbar__dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color-primary);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 22%, transparent);
}
.toolbar__brand-text { letter-spacing: -0.01em; }
.toolbar__sep { color: var(--color-text-tertiary); font-weight: 400; }
.toolbar__name {
    background: transparent;
    border: 1px solid transparent;
    border-radius: 5px;
    padding: 3px 6px;
    font: inherit;
    font-weight: 500;
    color: var(--color-foreground);
    min-width: 80px;
    width: 220px;
    outline: none;
    transition: border-color 100ms;
}
.toolbar__name:hover { border-color: var(--color-border); background: var(--color-surface-2); }
.toolbar__name:focus {
    border-color: var(--color-ring);
    background: var(--color-surface-2);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-ring) 18%, transparent);
}

.toolbar__group { display: flex; align-items: center; gap: 4px; }
.toolbar__spacer { flex: 1; }

.toolbar__btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 9px;
    font-size: 12.5px;
    color: var(--color-foreground);
    background: transparent;
    border: 1px solid var(--color-border-subtle);
    border-radius: 6px;
    cursor: pointer;
    transition: background-color 80ms ease, border-color 80ms ease;
    height: 30px;
}
.toolbar__btn:hover:not(:disabled) {
    background: var(--color-surface-2);
    border-color: var(--color-border);
}
.toolbar__btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}
.toolbar__btn.is-active {
    background: color-mix(in srgb, var(--color-primary) 14%, transparent);
    border-color: color-mix(in srgb, var(--color-primary) 40%, transparent);
    color: var(--color-foreground);
}
.toolbar__btn--primary {
    background: var(--color-primary);
    color: var(--color-primary-foreground);
    border-color: color-mix(in srgb, var(--color-primary) 80%, transparent);
}
.toolbar__btn--primary:hover:not(:disabled) {
    background: color-mix(in srgb, var(--color-primary) 90%, var(--color-foreground));
}
.toolbar__zoom { width: 64px; justify-content: center; font-variant-numeric: tabular-nums; }

.toolbar__menu { position: relative; }
.toolbar__menu-list {
    position: absolute;
    right: 0;
    top: calc(100% + 6px);
    background: var(--color-popover);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    min-width: 200px;
    padding: 4px;
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.45), 0 1px 0 rgba(255, 255, 255, 0.04) inset;
    z-index: 50;
}
.toolbar__menu-list button {
    display: block;
    width: 100%;
    text-align: left;
    background: transparent;
    border: none;
    padding: 7px 10px;
    border-radius: 5px;
    font: inherit;
    font-size: 12.5px;
    color: var(--color-foreground);
    cursor: pointer;
}
.toolbar__menu-list button:hover {
    background: color-mix(in srgb, var(--color-foreground) 7%, transparent);
}
</style>
