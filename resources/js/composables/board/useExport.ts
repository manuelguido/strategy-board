/**
 * useExport — convert the live board to JSON or human-readable Markdown,
 * trigger a download, and import a JSON file back into the store.
 */
import type { BoardState } from '@/types/board';
import { NODE_TYPES } from '@/types/board';
import { useBoardStore } from './useBoardStore';
import { useHistory } from './useHistory';

function download(filename: string, content: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function slugify(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'board';
}

export function useExport() {
    const store = useBoardStore();
    const { record } = useHistory();

    function toJSON(): BoardState {
        return store.snapshot();
    }

    function downloadJSON() {
        const data = toJSON();
        download(`${slugify(data.name)}.json`, JSON.stringify(data, null, 2), 'application/json');
    }

    function toMarkdown(): string {
        const state = store.snapshot();
        const lines: string[] = [];
        const nodesById = new Map(state.nodes.map((n) => [n.id, n] as const));

        lines.push(`# ${state.name}`);
        lines.push('');
        lines.push(`_${state.nodes.length} nodes · ${state.edges.length} edges_`);
        lines.push('');

        for (const def of NODE_TYPES) {
            const group = state.nodes.filter((n) => n.type === def.type);
            if (!group.length) continue;
            lines.push(`## ${def.label}s`);
            lines.push('');
            for (const n of group) {
                lines.push(`### ${n.name}`);
                if (n.domain) lines.push(`- **Domain:** ${n.domain}`);
                if (n.tags.length) lines.push(`- **Tags:** ${n.tags.join(', ')}`);
                if (n.metadata.description) lines.push(`- ${n.metadata.description}`);
                const md = n.metadata;
                if (md.endpoints?.length) lines.push(`- **Endpoints:** ${md.endpoints.join(', ')}`);
                if (md.auth) lines.push(`- **Auth:** ${md.auth}`);
                if (md.runtime) lines.push(`- **Runtime:** ${md.runtime}`);
                if (md.repo) lines.push(`- **Repo:** ${md.repo}`);
                if (md.engine) lines.push(`- **Engine:** ${md.engine}`);
                if (md.tables?.length) lines.push(`- **Tables:** ${md.tables.join(', ')}`);
                if (md.broker) lines.push(`- **Broker:** ${md.broker}`);
                if (md.topics?.length) lines.push(`- **Topics:** ${md.topics.join(', ')}`);
                if (md.schedule) lines.push(`- **Schedule:** ${md.schedule}`);
                if (md.vendor) lines.push(`- **Vendor:** ${md.vendor}`);
                if (md.url) lines.push(`- **URL:** ${md.url}`);
                lines.push('');
            }
        }

        lines.push(`## Connections`);
        lines.push('');
        for (const e of state.edges) {
            const s = nodesById.get(e.source)?.name ?? e.source;
            const t = nodesById.get(e.target)?.name ?? e.target;
            const tail: string[] = [];
            if (e.label) tail.push(`"${e.label}"`);
            if (e.metadata.latencyMs != null) tail.push(`~${e.metadata.latencyMs}ms`);
            if (e.metadata.retry && e.metadata.retry !== 'none') {
                tail.push(`retry:${e.metadata.retry}${e.metadata.retryMax ? `(${e.metadata.retryMax})` : ''}`);
            }
            const suffix = tail.length ? ` — ${tail.join(' · ')}` : '';
            lines.push(`- \`${s}\` —[**${e.type}**]→ \`${t}\`${suffix}`);
        }
        lines.push('');
        return lines.join('\n');
    }

    function downloadMarkdown() {
        download(`${slugify(store.name.value)}.md`, toMarkdown(), 'text/markdown');
    }

    async function importFromFile(file: File): Promise<{ ok: boolean; error?: string }> {
        try {
            const text = await file.text();
            const parsed = JSON.parse(text) as BoardState;
            if (!parsed || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
                return { ok: false, error: 'File is not a valid StrategyBoard JSON.' };
            }
            record();
            store.replaceAll({
                name: parsed.name ?? 'Imported board',
                nodes: parsed.nodes,
                edges: parsed.edges,
                viewport: parsed.viewport ?? { offset: { x: 0, y: 0 }, zoom: 1 },
            });
            return { ok: true };
        } catch (err) {
            return { ok: false, error: (err as Error).message };
        }
    }

    return { toJSON, toMarkdown, downloadJSON, downloadMarkdown, importFromFile };
}
