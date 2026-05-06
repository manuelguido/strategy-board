<script setup lang="ts">
/**
 * Inspector — context-sensitive right side panel.
 *
 * • Single node selected  → editable form for its fields and metadata.
 * • Single edge selected  → edge type + edge metadata.
 * • Multi node selection  → bulk actions (align / distribute / delete).
 * • Empty                 → board summary + shortcut cheat sheet.
 */
import { computed } from 'vue';
import { Trash2, AlignVerticalJustifyCenter, AlignHorizontalJustifyCenter } from 'lucide-vue-next';
import type { EdgeType, NodeMetadata, NodeType } from '@/types/board';
import { EDGE_TYPES, NODE_TYPE_MAP } from '@/types/board';
import { useBoardStore } from '@/composables/board/useBoardStore';
import { useBoardActions } from '@/composables/board/useBoardActions';

const store    = useBoardStore();
const actions  = useBoardActions();

const node = store.singleSelectedNode;
const edge = store.singleSelectedEdge;

const multi = computed(() => store.selectedNodes.value.length > 1);

function csvSet(value: string): string[] {
    return value.split(',').map((s) => s.trim()).filter(Boolean);
}

function setMetadata(patch: Partial<NodeMetadata>) {
    if (!node.value) return;
    actions.patchNode(node.value.id, { metadata: { ...node.value.metadata, ...patch } });
}

function changeType(t: NodeType) {
    if (!node.value) return;
    actions.patchNode(node.value.id, { type: t });
}

function alignHorizontal() {
    const ns = store.selectedNodes.value;
    if (ns.length < 2) return;
    const avgY = Math.round(ns.reduce((s, n) => s + n.position.y, 0) / ns.length);
    actions.moveNodes(ns.map((n) => ({ id: n.id, position: { x: n.position.x, y: avgY } })));
}
function alignVertical() {
    const ns = store.selectedNodes.value;
    if (ns.length < 2) return;
    const avgX = Math.round(ns.reduce((s, n) => s + n.position.x, 0) / ns.length);
    actions.moveNodes(ns.map((n) => ({ id: n.id, position: { x: avgX, y: n.position.y } })));
}

const edgeTypeOptions = EDGE_TYPES;
</script>

<template>
    <aside class="inspector">
        <!-- ── Multi selection ───────────────────────────────────── -->
        <template v-if="multi">
            <div class="inspector__head">
                <div>{{ store.selectedNodes.value.length }} nodes selected</div>
            </div>
            <div class="inspector__group">
                <button class="inspector__btn" @click="alignHorizontal">
                    <AlignHorizontalJustifyCenter :size="14" /> Align top
                </button>
                <button class="inspector__btn" @click="alignVertical">
                    <AlignVerticalJustifyCenter :size="14" /> Align left
                </button>
                <button class="inspector__btn inspector__btn--danger" @click="actions.deleteSelection()">
                    <Trash2 :size="14" /> Delete all
                </button>
            </div>
        </template>

        <!-- ── Node ──────────────────────────────────────────────── -->
        <template v-else-if="node">
            <div class="inspector__head">
                <span
                    class="inspector__chip"
                    :style="{ background: NODE_TYPE_MAP[node.type].accent }"
                />
                <div class="inspector__title">{{ node.name }}</div>
                <button class="inspector__icon-btn" title="Delete node" @click="actions.deleteSelection()">
                    <Trash2 :size="14" />
                </button>
            </div>

            <div class="field">
                <label>Name</label>
                <input
                    :value="node.name"
                    @input="(e) => actions.renameNode(node!.id, (e.target as HTMLInputElement).value)"
                />
            </div>

            <div class="field">
                <label>Type</label>
                <select :value="node.type" @change="(e) => changeType((e.target as HTMLSelectElement).value as NodeType)">
                    <option v-for="d in Object.values(NODE_TYPE_MAP)" :key="d.type" :value="d.type">{{ d.label }}</option>
                </select>
            </div>

            <div class="field">
                <label>Domain</label>
                <input
                    :value="node.domain ?? ''"
                    placeholder="checkout, billing, …"
                    @input="(e) => actions.patchNode(node!.id, { domain: (e.target as HTMLInputElement).value || null })"
                />
            </div>

            <div class="field">
                <label>Tags</label>
                <input
                    :value="node.tags.join(', ')"
                    placeholder="comma-separated"
                    @change="(e) => actions.patchNode(node!.id, { tags: csvSet((e.target as HTMLInputElement).value) })"
                />
            </div>

            <div class="field">
                <label>Description</label>
                <textarea
                    :value="node.metadata.description ?? ''"
                    rows="2"
                    @change="(e) => setMetadata({ description: (e.target as HTMLTextAreaElement).value })"
                />
            </div>

            <!-- Type-specific fields -->
            <template v-if="node.type === 'api'">
                <div class="field">
                    <label>Endpoints</label>
                    <input
                        :value="node.metadata.endpoints?.join(', ') ?? ''"
                        placeholder="GET /x, POST /y"
                        @change="(e) => setMetadata({ endpoints: csvSet((e.target as HTMLInputElement).value) })"
                    />
                </div>
                <div class="field">
                    <label>Auth</label>
                    <select
                        :value="node.metadata.auth ?? 'none'"
                        @change="(e) => setMetadata({ auth: (e.target as HTMLSelectElement).value as 'none' | 'apiKey' | 'oauth' | 'jwt' })"
                    >
                        <option value="none">none</option>
                        <option value="apiKey">apiKey</option>
                        <option value="oauth">oauth</option>
                        <option value="jwt">jwt</option>
                    </select>
                </div>
            </template>
            <template v-if="node.type === 'service'">
                <div class="field">
                    <label>Runtime</label>
                    <input :value="node.metadata.runtime ?? ''"
                        @change="(e) => setMetadata({ runtime: (e.target as HTMLInputElement).value })"
                    />
                </div>
                <div class="field">
                    <label>Repo</label>
                    <input :value="node.metadata.repo ?? ''"
                        @change="(e) => setMetadata({ repo: (e.target as HTMLInputElement).value })"
                    />
                </div>
            </template>
            <template v-if="node.type === 'database'">
                <div class="field">
                    <label>Engine</label>
                    <input :value="node.metadata.engine ?? ''"
                        @change="(e) => setMetadata({ engine: (e.target as HTMLInputElement).value })"
                    />
                </div>
                <div class="field">
                    <label>Tables</label>
                    <input :value="node.metadata.tables?.join(', ') ?? ''"
                        @change="(e) => setMetadata({ tables: csvSet((e.target as HTMLInputElement).value) })"
                    />
                </div>
            </template>
            <template v-if="node.type === 'queue'">
                <div class="field">
                    <label>Broker</label>
                    <input :value="node.metadata.broker ?? ''"
                        @change="(e) => setMetadata({ broker: (e.target as HTMLInputElement).value })"
                    />
                </div>
                <div class="field">
                    <label>Topics</label>
                    <input :value="node.metadata.topics?.join(', ') ?? ''"
                        @change="(e) => setMetadata({ topics: csvSet((e.target as HTMLInputElement).value) })"
                    />
                </div>
            </template>
            <template v-if="node.type === 'worker'">
                <div class="field">
                    <label>Schedule</label>
                    <input :value="node.metadata.schedule ?? ''"
                        @change="(e) => setMetadata({ schedule: (e.target as HTMLInputElement).value })"
                    />
                </div>
            </template>
            <template v-if="node.type === 'external'">
                <div class="field">
                    <label>Vendor</label>
                    <input :value="node.metadata.vendor ?? ''"
                        @change="(e) => setMetadata({ vendor: (e.target as HTMLInputElement).value })"
                    />
                </div>
                <div class="field">
                    <label>URL</label>
                    <input :value="node.metadata.url ?? ''"
                        @change="(e) => setMetadata({ url: (e.target as HTMLInputElement).value })"
                    />
                </div>
            </template>
        </template>

        <!-- ── Edge ──────────────────────────────────────────────── -->
        <template v-else-if="edge">
            <div class="inspector__head">
                <div class="inspector__title">Connection</div>
                <button class="inspector__icon-btn" title="Delete edge" @click="actions.deleteSelection()">
                    <Trash2 :size="14" />
                </button>
            </div>
            <div class="field">
                <label>Source → Target</label>
                <div class="inspector__path">
                    {{ store.findNode(edge.source)?.name ?? edge.source }}
                    <span class="inspector__arrow">→</span>
                    {{ store.findNode(edge.target)?.name ?? edge.target }}
                </div>
            </div>
            <div class="field">
                <label>Type</label>
                <select
                    :value="edge.type"
                    @change="(e) => actions.patchEdge(edge!.id, { type: (e.target as HTMLSelectElement).value as EdgeType })"
                >
                    <option v-for="d in edgeTypeOptions" :key="d.type" :value="d.type">{{ d.label }}</option>
                </select>
            </div>
            <div class="field">
                <label>Label</label>
                <input
                    :value="edge.label ?? ''"
                    @change="(e) => actions.patchEdge(edge!.id, { label: (e.target as HTMLInputElement).value || undefined })"
                />
            </div>
            <div class="field">
                <label>Latency (ms)</label>
                <input
                    type="number"
                    :value="edge.metadata.latencyMs ?? ''"
                    @change="(e) => {
                        const v = (e.target as HTMLInputElement).value;
                        actions.patchEdge(edge!.id, { metadata: { latencyMs: v === '' ? undefined : Number(v) } });
                    }"
                />
            </div>
            <div class="field">
                <label>Retry</label>
                <select
                    :value="edge.metadata.retry ?? 'none'"
                    @change="(e) => actions.patchEdge(edge!.id, { metadata: { retry: (e.target as HTMLSelectElement).value as 'none' | 'fixed' | 'exponential' } })"
                >
                    <option value="none">none</option>
                    <option value="fixed">fixed</option>
                    <option value="exponential">exponential</option>
                </select>
            </div>
            <div v-if="edge.metadata.retry && edge.metadata.retry !== 'none'" class="field">
                <label>Retry max</label>
                <input
                    type="number"
                    :value="edge.metadata.retryMax ?? ''"
                    @change="(e) => {
                        const v = (e.target as HTMLInputElement).value;
                        actions.patchEdge(edge!.id, { metadata: { retryMax: v === '' ? undefined : Number(v) } });
                    }"
                />
            </div>
        </template>

        <!-- ── Empty ─────────────────────────────────────────────── -->
        <template v-else>
            <div class="inspector__head">
                <div class="inspector__title">{{ store.name.value }}</div>
            </div>
            <div class="inspector__stats">
                <div><span>{{ store.nodes.value.length }}</span> nodes</div>
                <div><span>{{ store.edges.value.length }}</span> edges</div>
            </div>
            <div class="inspector__hint">
                Pick a node from the palette, drag it to position. Drag from the right port of any node onto another to connect them.
            </div>
        </template>
    </aside>
</template>

<style scoped>
.inspector {
    width: 320px;
    border-left: 1px solid var(--color-border);
    background: var(--color-card);
    padding: 14px 14px 18px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
    font-size: 12.5px;
}
.inspector__head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--color-border);
}
.inspector__chip { width: 10px; height: 10px; border-radius: 3px; }
.inspector__title { font-weight: 600; font-size: 13px; flex: 1; }
.inspector__icon-btn {
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: 5px;
    padding: 4px;
    color: var(--color-muted-foreground);
    cursor: pointer;
}
.inspector__icon-btn:hover { color: hsl(0 70% 60%); border-color: hsl(0 70% 55%); }

.field { display: flex; flex-direction: column; gap: 4px; }
.field label {
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-muted-foreground);
    font-weight: 600;
}
.field input,
.field select,
.field textarea {
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    padding: 6px 8px;
    font: inherit;
    font-size: 12.5px;
    color: var(--color-foreground);
    outline: none;
    transition: border-color 80ms, box-shadow 80ms;
    resize: vertical;
}
.field input:focus,
.field select:focus,
.field textarea:focus {
    border-color: var(--color-ring);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-ring) 18%, transparent);
}

.inspector__stats {
    display: flex;
    gap: 18px;
    color: var(--color-muted-foreground);
}
.inspector__stats span { color: var(--color-foreground); font-weight: 600; font-size: 14px; }

.inspector__hint { color: var(--color-muted-foreground); line-height: 1.5; }

.inspector__group {
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.inspector__btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 9px;
    font: inherit;
    font-size: 12.5px;
    color: var(--color-foreground);
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    cursor: pointer;
}
.inspector__btn:hover { background: var(--color-surface-2); border-color: var(--color-border-strong); }
.inspector__btn--danger:hover {
    background: color-mix(in srgb, hsl(0 65% 50%) 14%, transparent);
    border-color: color-mix(in srgb, hsl(0 65% 50%) 60%, var(--color-border));
    color: hsl(0 65% 65%);
}

.inspector__path {
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    padding: 6px 8px;
    color: var(--color-foreground);
    font-size: 12px;
}
.inspector__arrow { margin: 0 6px; color: var(--color-muted-foreground); }
</style>
