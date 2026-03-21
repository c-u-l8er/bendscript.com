export const clamp = (value, min, max) =>
    Math.max(min, Math.min(max, value));

export const rand = (min, max) => min + Math.random() * (max - min);

export const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);

export const now = () =>
    typeof performance !== "undefined" ? performance.now() : Date.now();

export function uid(prefix = "id") {
    const entropy = Math.random().toString(36).slice(2, 8);
    const ts = Date.now().toString(36).slice(-6);
    return `${prefix}_${entropy}${ts}`;
}

export function trimText(input, maxLen) {
    const text = String(input ?? "");
    const n = Math.max(1, Number(maxLen) || 1);
    return text.length > n ? `${text.slice(0, n - 1)}…` : text;
}
