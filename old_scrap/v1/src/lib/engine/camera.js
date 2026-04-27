/**
 * Convert world-space coordinates to screen-space coordinates.
 *
 * @param {number} wx - World X
 * @param {number} wy - World Y
 * @param {{ x: number, y: number, zoom: number }} camera
 * @param {number} width - Viewport/canvas width in CSS pixels
 * @param {number} height - Viewport/canvas height in CSS pixels
 * @returns {{ x: number, y: number }}
 */
export function projectToScreen(wx, wy, camera, width, height) {
    return {
        x: (wx - camera.x) * camera.zoom + width * 0.5,
        y: (wy - camera.y) * camera.zoom + height * 0.5,
    };
}

/**
 * Convert screen-space coordinates to world-space coordinates.
 *
 * @param {number} sx - Screen X
 * @param {number} sy - Screen Y
 * @param {{ x: number, y: number, zoom: number }} camera
 * @param {number} width - Viewport/canvas width in CSS pixels
 * @param {number} height - Viewport/canvas height in CSS pixels
 * @returns {{ x: number, y: number }}
 */
export function screenToWorld(sx, sy, camera, width, height) {
    return {
        x: (sx - width * 0.5) / camera.zoom + camera.x,
        y: (sy - height * 0.5) / camera.zoom + camera.y,
    };
}
