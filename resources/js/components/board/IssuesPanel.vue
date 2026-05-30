<script setup lang="ts">
/**
 * IssuesPanel — quiet status badge in the bottom-right of the canvas.
 *
 * Default state: a single small pill showing counts (or "All clear"). Clicking
 * expands an inline list of issues; clicking an issue selects + centers its
 * primary node. Designed to never steal canvas attention until the user
 * deliberately opens it.
 */
import {
    AlertCircle,
    AlertTriangle,
    Info,
    ChevronDown,
    Check,
} from 'lucide-vue-next';
import { computed, ref } from 'vue';
import { useBoardStore } from '@/composables/board/useBoardStore';
import { useValidation } from '@/composables/board/useValidation';
import type { Issue, IssueSeverity } from '@/types/board';

const props = defineProps<{
    viewportSize: { width: number; height: number };
}>();

const validation = useValidation();
const store = useBoardStore();
const open = ref(false);

const sorted = computed(() => {
    const order: Record<IssueSeverity, number> = {
        error: 0,
        warning: 1,
        info: 2,
    };

    return [...validation.issues.value].sort(
        (a, b) => order[a.severity] - order[b.severity],
    );
});

function focusIssue(iss: Issue) {
    if (iss.nodeIds.length) {
        const id = iss.nodeIds[0];
        store.selectNode(id);
        const n = store.findNode(id);

        if (n) {
            const cx = n.position.x + n.width / 2;
            const cy = n.position.y + n.height / 2;
            store.viewport.offset = {
                x: props.viewportSize.width / 2 - cx * store.viewport.zoom,
                y: props.viewportSize.height / 2 - cy * store.viewport.zoom,
            };
        }
    } else if (iss.edgeIds.length) {
        store.selectEdge(iss.edgeIds[0]);
    }
}

const ICONS: Record<IssueSeverity, typeof AlertCircle> = {
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
};

const summaryClass = computed(() => {
    if (validation.errorCount.value) {
        return 'is-error';
    }

    if (validation.warningCount.value) {
        return 'is-warning';
    }

    return 'is-ok';
});
</script>

<template>
    <div class="issues" :class="{ 'is-open': open }">
        <button
            class="issues__pill"
            :class="summaryClass"
            @click="open = !open"
        >
            <template v-if="validation.errorCount.value">
                <AlertCircle :size="12" /> {{ validation.errorCount.value }}
            </template>
            <template v-if="validation.warningCount.value">
                <AlertTriangle :size="12" /> {{ validation.warningCount.value }}
            </template>
            <template v-if="!validation.issues.value.length">
                <Check :size="12" /> All clear
            </template>
            <ChevronDown
                :size="11"
                class="issues__chev"
                :class="{ 'is-open': open }"
            />
        </button>
        <div v-if="open" class="issues__panel">
            <div class="issues__head">Validation</div>
            <div class="issues__list">
                <button
                    v-for="iss in sorted"
                    :key="iss.id"
                    class="issues__item"
                    :class="`is-${iss.severity}`"
                    @click="focusIssue(iss)"
                >
                    <component
                        :is="ICONS[iss.severity]"
                        :size="12"
                        class="issues__item-icon"
                    />
                    <span class="issues__item-rule">{{ iss.rule }}</span>
                    <span class="issues__item-msg">{{ iss.message }}</span>
                </button>
                <div v-if="!sorted.length" class="issues__empty">
                    Model is consistent.
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.issues {
    position: absolute;
    bottom: 14px;
    right: 14px;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
    z-index: 10;
    font-size: 12px;
}
.issues__pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 9px;
    border-radius: 999px;
    border: 1px solid var(--color-border);
    background: var(--color-surface-2);
    color: var(--color-foreground);
    font: inherit;
    font-size: 11.5px;
    font-weight: 500;
    cursor: pointer;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
    transition:
        background-color 100ms ease,
        border-color 100ms ease;
}
.issues__pill:hover {
    background: var(--color-surface-3);
    border-color: var(--color-border-strong);
}
.issues__pill.is-error {
    color: hsl(0 65% 65%);
    border-color: color-mix(in srgb, hsl(0 60% 50%) 35%, var(--color-border));
}
.issues__pill.is-warning {
    color: hsl(35 70% 62%);
    border-color: color-mix(in srgb, hsl(35 60% 50%) 35%, var(--color-border));
}
.issues__pill.is-ok {
    color: var(--color-text-secondary);
}

.issues__chev {
    transition: transform 160ms ease;
    opacity: 0.6;
}
.issues__chev.is-open {
    transform: rotate(180deg);
}

.issues__panel {
    width: 320px;
    background: var(--color-popover);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    overflow: hidden;
    box-shadow:
        0 16px 40px rgba(0, 0, 0, 0.5),
        0 1px 0 rgba(255, 255, 255, 0.04) inset;
    animation: issues-fade 140ms ease;
}
@keyframes issues-fade {
    from {
        opacity: 0;
        transform: translateY(4px);
    }
    to {
        opacity: 1;
        transform: none;
    }
}

.issues__head {
    padding: 9px 12px;
    font-size: 10.5px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-muted-foreground);
    border-bottom: 1px solid var(--color-border);
}
.issues__list {
    max-height: 240px;
    overflow-y: auto;
}
.issues__item {
    display: grid;
    grid-template-columns: auto auto 1fr;
    gap: 6px 8px;
    align-items: start;
    width: 100%;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--color-border);
    padding: 8px 12px;
    text-align: left;
    color: var(--color-foreground);
    cursor: pointer;
    font: inherit;
    font-size: 11.5px;
}
.issues__item:hover {
    background: color-mix(in srgb, var(--color-foreground) 5%, transparent);
}
.issues__item:last-child {
    border-bottom: none;
}
.issues__item-icon {
    margin-top: 1px;
}
.issues__item-icon {
    color: var(--color-muted-foreground);
}
.issues__item.is-error .issues__item-icon {
    color: hsl(0 65% 65%);
}
.issues__item.is-warning .issues__item-icon {
    color: hsl(35 70% 62%);
}
.issues__item-rule {
    font-weight: 600;
    color: var(--color-muted-foreground);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-size: 10px;
    grid-column: 2;
}
.issues__item-msg {
    color: var(--color-foreground);
    grid-column: 3;
    line-height: 1.4;
}
.issues__empty {
    padding: 16px 12px;
    color: var(--color-muted-foreground);
    text-align: center;
}
</style>
