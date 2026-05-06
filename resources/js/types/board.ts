/**
 * StrategyBoard — domain model.
 *
 * The model is fully serializable: every field is JSON-safe so the entire
 * board can be exported as JSON and re-imported with no information loss.
 */

export type NodeType = 'api' | 'service' | 'database' | 'queue' | 'worker' | 'external';

export type EdgeType = 'sync' | 'async' | 'read' | 'write' | 'dependency';

export type IssueSeverity = 'error' | 'warning' | 'info';

/** Coordinates are stored in WORLD space (canvas units), not screen pixels. */
export interface Point {
    x: number;
    y: number;
}

/** Per-type dynamic metadata. Kept loose on purpose so each type can extend. */
export interface NodeMetadata {
    description?: string;

    // api
    endpoints?: string[];
    auth?: 'none' | 'apiKey' | 'oauth' | 'jwt';

    // service
    runtime?: string; // e.g. "node 20", "python 3.12"
    repo?: string;

    // database
    engine?: string; // e.g. "postgres 16"
    tables?: string[];

    // queue
    broker?: string; // e.g. "rabbitmq", "kafka", "sqs"
    topics?: string[];

    // worker
    schedule?: string; // cron-ish

    // external
    vendor?: string;
    url?: string;
}

export interface BoardNode {
    id: string;
    type: NodeType;
    name: string;
    position: Point;
    width: number;
    height: number;
    metadata: NodeMetadata;
    /** Free-form labels e.g. "checkout", "domain:billing". */
    tags: string[];
    /** Optional logical grouping (domain). */
    domain?: string | null;
}

export interface EdgeMetadata {
    description?: string;
    latencyMs?: number;
    retry?: 'none' | 'fixed' | 'exponential';
    retryMax?: number;
}

export interface BoardEdge {
    id: string;
    type: EdgeType;
    source: string;       // node id
    target: string;       // node id
    label?: string;
    metadata: EdgeMetadata;
}

export interface Viewport {
    /** World-space offset of the origin, in pixels. */
    offset: Point;
    /** Zoom factor: 1 = 100%. */
    zoom: number;
}

export interface BoardState {
    name: string;
    nodes: BoardNode[];
    edges: BoardEdge[];
    viewport: Viewport;
}

/* ── Issue (validation result) ───────────────────────────────────── */

export interface Issue {
    id: string;
    severity: IssueSeverity;
    rule: string;
    message: string;
    nodeIds: string[];
    edgeIds: string[];
}

/* ── Type catalog ────────────────────────────────────────────────── */

export interface NodeTypeDef {
    type: NodeType;
    label: string;
    /** lucide-vue-next icon name */
    icon: string;
    /** A muted accent color (HSL); intentionally subtle. */
    accent: string;
}

export const NODE_TYPES: NodeTypeDef[] = [
    { type: 'api',      label: 'API',      icon: 'Globe',      accent: 'hsl(225 65% 70%)' },
    { type: 'service',  label: 'Service',  icon: 'Box',        accent: 'hsl(265 40% 70%)' },
    { type: 'database', label: 'Database', icon: 'Database',   accent: 'hsl(160 35% 60%)' },
    { type: 'queue',    label: 'Queue',    icon: 'Layers',     accent: 'hsl(35 55% 62%)'  },
    { type: 'worker',   label: 'Worker',   icon: 'Cpu',        accent: 'hsl(185 38% 60%)' },
    { type: 'external', label: 'External', icon: 'CloudOff',   accent: 'hsl(220 8% 60%)'  },
];

export const NODE_TYPE_MAP: Record<NodeType, NodeTypeDef> =
    Object.fromEntries(NODE_TYPES.map((d) => [d.type, d])) as Record<NodeType, NodeTypeDef>;

export interface EdgeTypeDef {
    type: EdgeType;
    label: string;
    /** SVG dasharray; '' = solid. */
    dash: string;
    /** Stroke weight. */
    width: number;
    /** Subtle accent color. */
    color: string;
    /** Short description shown in inspector. */
    description: string;
}

export const EDGE_TYPES: EdgeTypeDef[] = [
    { type: 'sync',       label: 'Sync request',  dash: '',       width: 1.5,  color: 'hsl(225 45% 62%)', description: 'Blocking request/response.' },
    { type: 'async',      label: 'Async event',   dash: '5 4',    width: 1.5,  color: 'hsl(265 35% 65%)', description: 'Fire-and-forget message.' },
    { type: 'read',       label: 'Read',          dash: '',       width: 1.25, color: 'hsl(160 30% 55%)', description: 'Reads from data store.' },
    { type: 'write',      label: 'Write',         dash: '',       width: 2,    color: 'hsl(35 50% 58%)',  description: 'Writes to data store.' },
    { type: 'dependency', label: 'Dependency',    dash: '2 4',    width: 1,    color: 'hsl(220 8% 50%)',  description: 'Hard structural dependency.' },
];

export const EDGE_TYPE_MAP: Record<EdgeType, EdgeTypeDef> =
    Object.fromEntries(EDGE_TYPES.map((d) => [d.type, d])) as Record<EdgeType, EdgeTypeDef>;

/* ── Connection rules ────────────────────────────────────────────── */

/**
 * Returns whether an edge of `edgeType` is allowed between two node types.
 * Used both to block invalid connections at draw time AND to flag pre-existing
 * invalid edges as issues.
 */
export function isEdgeAllowed(
    sourceType: NodeType,
    targetType: NodeType,
    edgeType: EdgeType,
): boolean {
    // A database can never originate a request.
    if (sourceType === 'database' && (edgeType === 'sync' || edgeType === 'async' || edgeType === 'write' || edgeType === 'read')) {
        return false;
    }
    // A queue cannot directly write to a database.
    if (sourceType === 'queue' && targetType === 'database' && edgeType === 'write') {
        return false;
    }
    // read/write are only meaningful when the target is a data store.
    if ((edgeType === 'read' || edgeType === 'write') && targetType !== 'database') {
        return false;
    }
    // sync requests should target callable surfaces.
    if (edgeType === 'sync' && (targetType === 'queue' || targetType === 'database')) {
        return false;
    }
    // async events should target queues or workers.
    if (edgeType === 'async' && !(targetType === 'queue' || targetType === 'worker' || targetType === 'service')) {
        return false;
    }
    return true;
}

/* ── Sample model ────────────────────────────────────────────────── */

export const SAMPLE_BOARD: BoardState = {
    name: 'Checkout platform',
    viewport: { offset: { x: 0, y: 0 }, zoom: 1 },
    nodes: [
        {
            id: 'n_web',     type: 'api',      name: 'web-bff',         position: { x: 80,   y: 120 }, width: 184, height: 70,
            metadata: { endpoints: ['POST /checkout', 'GET /orders/:id'], auth: 'jwt' },
            tags: ['public'], domain: 'checkout',
        },
        {
            id: 'n_orders',  type: 'service',  name: 'orders-service',  position: { x: 360,  y: 80 },  width: 184, height: 70,
            metadata: { runtime: 'node 20', repo: 'github.com/acme/orders' },
            tags: [], domain: 'checkout',
        },
        {
            id: 'n_billing', type: 'service',  name: 'billing-service', position: { x: 360,  y: 220 }, width: 184, height: 70,
            metadata: { runtime: 'go 1.22', repo: 'github.com/acme/billing' },
            tags: [], domain: 'billing',
        },
        {
            id: 'n_db_o',    type: 'database', name: 'orders-db',       position: { x: 640,  y: 80 },  width: 168, height: 70,
            metadata: { engine: 'postgres 16', tables: ['orders', 'order_items'] },
            tags: [], domain: 'checkout',
        },
        {
            id: 'n_db_b',    type: 'database', name: 'billing-db',      position: { x: 640,  y: 220 }, width: 168, height: 70,
            metadata: { engine: 'postgres 16', tables: ['invoices', 'payments'] },
            tags: [], domain: 'billing',
        },
        {
            id: 'n_q',       type: 'queue',    name: 'events-bus',      position: { x: 360,  y: 380 }, width: 184, height: 70,
            metadata: { broker: 'kafka', topics: ['order.created', 'payment.settled'] },
            tags: [], domain: 'platform',
        },
        {
            id: 'n_worker',  type: 'worker',   name: 'fulfillment',     position: { x: 640,  y: 380 }, width: 168, height: 70,
            metadata: { schedule: 'event-driven' },
            tags: [], domain: 'fulfillment',
        },
        {
            id: 'n_stripe',  type: 'external', name: 'Stripe',          position: { x: 80,   y: 320 }, width: 168, height: 70,
            metadata: { vendor: 'Stripe', url: 'https://stripe.com' },
            tags: ['vendor'], domain: 'billing',
        },
    ],
    edges: [
        { id: 'e1', type: 'sync',  source: 'n_web',     target: 'n_orders',  metadata: { latencyMs: 50 } },
        { id: 'e2', type: 'sync',  source: 'n_web',     target: 'n_billing', metadata: { latencyMs: 80 } },
        { id: 'e3', type: 'write', source: 'n_orders',  target: 'n_db_o',    metadata: {} },
        { id: 'e4', type: 'read',  source: 'n_orders',  target: 'n_db_o',    metadata: {} },
        { id: 'e5', type: 'write', source: 'n_billing', target: 'n_db_b',    metadata: {} },
        { id: 'e6', type: 'async', source: 'n_orders',  target: 'n_q',       metadata: {} },
        { id: 'e7', type: 'async', source: 'n_q',       target: 'n_worker',  metadata: { retry: 'exponential', retryMax: 5 } },
        { id: 'e8', type: 'sync',  source: 'n_billing', target: 'n_stripe',  metadata: { latencyMs: 250 } },
    ],
};
