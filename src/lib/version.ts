/** Compare semver-like versions. Returns negative if a < b, positive if a > b, 0 if equal. */
export function compareVersions(a: string, b: string): number {
    const parse = (v: string) =>
        (v || '').replace(/^v/, '').split('+')[0].split('.').map(Number);
    const p1 = parse(a);
    const p2 = parse(b);
    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
        const n1 = p1[i] || 0;
        const n2 = p2[i] || 0;
        if (n1 > n2) return 1;
        if (n2 > n1) return -1;
    }
    return 0;
}

/** True when `candidate` is a newer release than `current`. */
export function isVersionNewer(candidate: string, current: string): boolean {
    return compareVersions(candidate, current) > 0;
}