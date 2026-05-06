/**
 * useViewport — coordinate transforms and pan/zoom math for the canvas.
 *
 * The canvas applies `translate(offsetX, offsetY) scale(zoom)` to its world
 * layer. World ↔ screen conversions go through this composable so the rest of
 * the code never touches raw transform math.
 */
import { useBoardStore } from './useBoardStore';
import type { Point } from '@/types/board';

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2.5;

export function useViewport() {
    const { viewport, setViewport, nodes } = useBoardStore();

    function clampZoom(z: number): number {
        return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
    }

    /** Convert a screen-relative point (relative to canvas root) to world coords. */
    function toWorld(screen: Point): Point {
        return {
            x: (screen.x - viewport.offset.x) / viewport.zoom,
            y: (screen.y - viewport.offset.y) / viewport.zoom,
        };
    }

    /** Convert world coords to screen coords (relative to canvas root). */
    function toScreen(world: Point): Point {
        return {
            x: world.x * viewport.zoom + viewport.offset.x,
            y: world.y * viewport.zoom + viewport.offset.y,
        };
    }

    function panBy(dx: number, dy: number) {
        viewport.offset = { x: viewport.offset.x + dx, y: viewport.offset.y + dy };
    }

    /**
     * Zoom by a delta keeping the world point at `anchorScreen` stationary on
     * screen — same model as Figma / tldraw.
     */
    function zoomAt(anchorScreen: Point, factor: number) {
        const nextZoom = clampZoom(viewport.zoom * factor);
        if (nextZoom === viewport.zoom) return;
        const worldBefore = toWorld(anchorScreen);
        viewport.zoom = nextZoom;
        const worldAfterScreen = toScreen(worldBefore);
        viewport.offset = {
            x: viewport.offset.x + (anchorScreen.x - worldAfterScreen.x),
            y: viewport.offset.y + (anchorScreen.y - worldAfterScreen.y),
        };
    }

    function setZoom(z: number, anchorScreen?: Point) {
        const factor = clampZoom(z) / viewport.zoom;
        if (anchorScreen) zoomAt(anchorScreen, factor);
        else viewport.zoom = clampZoom(z);
    }

    function reset() {
        setViewport({ offset: { x: 0, y: 0 }, zoom: 1 });
    }

    /** Fit all nodes inside `viewportSize` with a margin. */
    function fit(viewportSize: { width: number; height: number }, margin = 64) {
        const ns = nodes.value;
        if (!ns.length) {
            reset();
            return;
        }
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const n of ns) {
            minX = Math.min(minX, n.position.x);
            minY = Math.min(minY, n.position.y);
            maxX = Math.max(maxX, n.position.x + n.width);
            maxY = Math.max(maxY, n.position.y + n.height);
        }
        const w = maxX - minX;
        const h = maxY - minY;
        const zx = (viewportSize.width - margin * 2) / w;
        const zy = (viewportSize.height - margin * 2) / h;
        const z = clampZoom(Math.min(zx, zy, 1));
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        viewport.zoom = z;
        viewport.offset = {
            x: viewportSize.width / 2 - cx * z,
            y: viewportSize.height / 2 - cy * z,
        };
    }

    return { toWorld, toScreen, panBy, zoomAt, setZoom, reset, fit, MIN_ZOOM, MAX_ZOOM };
}
