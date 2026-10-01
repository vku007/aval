/**
 * Easing for transition tracks. u is 0 at the start and 1 at the end.
 * expOut follows the old exponential chase: k = 3 is -ln(0.05), so the
 * un-normalized curve has covered 95% at u = 1. It is scaled to land on 1.
 */
function heatEase(name, u) {
    const t = u <= 0 ? 0 : (u >= 1 ? 1 : u);
    if (t === 0 || t === 1) {
        return t;
    }
    if (name === 'sine') {
        return -(Math.cos(Math.PI * t) - 1) / 2;
    }
    if (name === 'expOut') {
        if (t <= 0) {
            return 0;
        }
        if (t >= 1) {
            return 1;
        }
        const k = 3;
        return (1 - Math.exp(-k * t)) / (1 - Math.exp(-k));
    }
    return t;
}
