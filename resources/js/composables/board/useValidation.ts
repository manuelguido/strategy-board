/**
 * useValidation — derives a list of {@link Issue} from the current model.
 *
 * Rules implemented:
 *   1. invalid-edge        — connection rule violation (per `isEdgeAllowed`)
 *   2. orphan-node         — node has no connected edges
 *   3. multi-writer        — a database receives writes from > 1 service
 *   4. circular-dependency — a cycle exists in `dependency` or `sync` edges
 *   5. self-loop           — an edge has the same source and target
 *
 * Each issue carries the affected node / edge ids so the canvas can highlight
 * them and the side panel can deep-link.
 */
import { computed } from 'vue';
import type { BoardEdge, BoardNode, Issue } from '@/types/board';
import { NODE_TYPE_MAP, isEdgeAllowed } from '@/types/board';
import { useBoardStore } from './useBoardStore';

function detectCycle(nodes: BoardNode[], edges: BoardEdge[]): string[][] {
    // Restrict cycle detection to edges that imply runtime coupling.
    const relevant = edges.filter((e) => e.type === 'sync' || e.type === 'dependency');
    const adj = new Map<string, string[]>();
    for (const n of nodes) adj.set(n.id, []);
    for (const e of relevant) adj.get(e.source)?.push(e.target);

    const cycles: string[][] = [];
    const stack: string[] = [];
    const inStack = new Set<string>();
    const visited = new Set<string>();

    function dfs(u: string) {
        visited.add(u);
        inStack.add(u);
        stack.push(u);
        for (const v of adj.get(u) || []) {
            if (!visited.has(v)) {
                dfs(v);
            } else if (inStack.has(v)) {
                const i = stack.indexOf(v);
                if (i >= 0) cycles.push(stack.slice(i));
            }
        }
        stack.pop();
        inStack.delete(u);
    }

    for (const n of nodes) if (!visited.has(n.id)) dfs(n.id);
    return cycles;
}

export function useValidation() {
    const { nodes, edges } = useBoardStore();

    const issues = computed<Issue[]>(() => {
        const out: Issue[] = [];
        const ns = nodes.value;
        const es = edges.value;
        const byId = new Map(ns.map((n) => [n.id, n] as const));

        // ── 1. invalid-edge / 5. self-loop ─────────────────────────
        es.forEach((e, i) => {
            if (e.source === e.target) {
                out.push({
                    id: `self-loop:${e.id}`,
                    severity: 'error',
                    rule: 'self-loop',
                    message: `Edge "${e.type}" connects a node to itself.`,
                    nodeIds: [e.source],
                    edgeIds: [e.id],
                });
                return;
            }
            const src = byId.get(e.source);
            const tgt = byId.get(e.target);
            if (!src || !tgt) return;
            if (!isEdgeAllowed(src.type, tgt.type, e.type)) {
                out.push({
                    id: `invalid-edge:${e.id}`,
                    severity: 'error',
                    rule: 'invalid-edge',
                    message: `${NODE_TYPE_MAP[src.type].label} → ${NODE_TYPE_MAP[tgt.type].label} cannot use a "${e.type}" edge.`,
                    nodeIds: [src.id, tgt.id],
                    edgeIds: [e.id],
                });
            }
            void i;
        });

        // ── 2. orphan-node ─────────────────────────────────────────
        const connected = new Set<string>();
        es.forEach((e) => {
            connected.add(e.source);
            connected.add(e.target);
        });
        ns.forEach((n) => {
            if (!connected.has(n.id)) {
                out.push({
                    id: `orphan:${n.id}`,
                    severity: 'warning',
                    rule: 'orphan-node',
                    message: `${n.name} has no connections.`,
                    nodeIds: [n.id],
                    edgeIds: [],
                });
            }
        });

        // ── 3. multi-writer ────────────────────────────────────────
        const writersByDb = new Map<string, Set<string>>();
        es.forEach((e) => {
            if (e.type !== 'write') return;
            const tgt = byId.get(e.target);
            if (!tgt || tgt.type !== 'database') return;
            const set = writersByDb.get(e.target) ?? new Set<string>();
            set.add(e.source);
            writersByDb.set(e.target, set);
        });
        writersByDb.forEach((writers, dbId) => {
            if (writers.size <= 1) return;
            const db = byId.get(dbId)!;
            const services = [...writers].map((id) => byId.get(id)).filter(Boolean) as BoardNode[];
            // If all writers share a domain, downgrade to info; otherwise warning.
            const domains = new Set(services.map((s) => s.domain ?? '∅'));
            const sharedDomain = domains.size === 1 && db.domain && domains.has(db.domain);
            out.push({
                id: `multi-writer:${dbId}`,
                severity: sharedDomain ? 'info' : 'warning',
                rule: 'multi-writer',
                message: `${db.name} is written to by ${services.length} services (${services.map((s) => s.name).join(', ')}).`,
                nodeIds: [dbId, ...services.map((s) => s.id)],
                edgeIds: es.filter((e) => e.type === 'write' && e.target === dbId).map((e) => e.id),
            });
        });

        // ── 4. circular-dependency ─────────────────────────────────
        const cycles = detectCycle(ns, es);
        cycles.forEach((cycle, i) => {
            out.push({
                id: `cycle:${i}:${cycle.join('>')}`,
                severity: 'error',
                rule: 'circular-dependency',
                message: `Cycle: ${cycle.map((id) => byId.get(id)?.name ?? id).join(' → ')} → …`,
                nodeIds: cycle,
                edgeIds: es
                    .filter((e) => (e.type === 'sync' || e.type === 'dependency')
                        && cycle.includes(e.source)
                        && cycle.includes(e.target))
                    .map((e) => e.id),
            });
        });

        return out;
    });

    const issueByEdge = computed(() => {
        const map = new Map<string, Issue[]>();
        issues.value.forEach((iss) => {
            iss.edgeIds.forEach((id) => {
                if (!map.has(id)) map.set(id, []);
                map.get(id)!.push(iss);
            });
        });
        return map;
    });

    const issueByNode = computed(() => {
        const map = new Map<string, Issue[]>();
        issues.value.forEach((iss) => {
            iss.nodeIds.forEach((id) => {
                if (!map.has(id)) map.set(id, []);
                map.get(id)!.push(iss);
            });
        });
        return map;
    });

    const errorCount   = computed(() => issues.value.filter((i) => i.severity === 'error').length);
    const warningCount = computed(() => issues.value.filter((i) => i.severity === 'warning').length);

    return { issues, issueByEdge, issueByNode, errorCount, warningCount };
}
