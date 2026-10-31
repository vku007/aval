/**
 * Layout for the amount indicators.
 * Width and height are the outer size in heat cells. Horizontal splits the
 * width; vertical splits the height. The gap aims at 10 cells so diffusion
 * leaves a darker band between neighbors. It shrinks when a slot would be
 * thinner than 4 cells.
 * Index 0 is the start (left, or the end named by direction). Later indexes
 * run toward the other end. Vertical `asc` begins at the top. `desc` begins
 * at the bottom.
 * Slot heat is half of the full ramp: dispensed 0.02, stored 0.225, selected 0.5.
 */
const AMOUNT_INDICATOR_CAP = 64;
const AMOUNT_INDICATOR_GAP_AIM = 10;
const AMOUNT_INDICATOR_PIECE_MIN = 4;
const AMOUNT_INDICATOR_HEAT_DURATION = 0.4;
const AMOUNT_INDICATOR_COLD = 0.02;
const AMOUNT_INDICATOR_HOT = 0.225;
const AMOUNT_INDICATOR_HOTTEST = 0.5;

function amountIndicatorCount(value, fallback, limit) {
    const raw = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback;
    const cap = typeof limit === 'number' && Number.isFinite(limit) ? limit : raw;
    if (!Number.isFinite(raw)) {
        return 0;
    }
    return Math.max(0, Math.min(cap, raw));
}

function amountIndicatorColumns(value, fallback, limit) {
    const cap = Math.max(1, typeof limit === 'number' && Number.isFinite(limit) ? Math.round(limit) : 1);
    return Math.max(1, amountIndicatorCount(value, fallback, cap));
}

function amountIndicatorSpan(value, fallback) {
    const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
    return Math.max(1, n);
}

function amountIndicatorRole(index, stored, selected) {
    const held = Math.max(0, stored | 0);
    const picked = Math.max(0, Math.min(held, selected | 0));
    if (index < held - picked) {
        return 'stored';
    }
    if (index < held) {
        return 'selected';
    }
    return 'dispensed';
}

function amountIndicatorDirection(value) {
    return String(value || '').toLowerCase() === 'desc' ? 'desc' : 'asc';
}

function amountIndicatorShape(value) {
    return String(value || '').toLowerCase() === 'round' ? 'round' : 'rectangle';
}

function amountIndicatorPose(width, height, shape) {
    if (amountIndicatorShape(shape) === 'round') {
        return {
            width: 0,
            height: 0,
            angle: 0,
            skew: 0,
            radius: Math.max(0.5, Math.min(width, height) / 2),
            heat: 1
        };
    }
    return { width: width, height: height, angle: 0, skew: 0, heat: 1 };
}

function amountIndicatorHeat(role) {
    if (role === 'selected') {
        return AMOUNT_INDICATOR_HOTTEST;
    }
    if (role === 'stored') {
        return AMOUNT_INDICATOR_HOT;
    }
    return AMOUNT_INDICATOR_COLD;
}

function amountIndicatorMeasure(width, height, count, axis) {
    const n = Math.max(0, Math.round(Number(count) || 0));
    const w = Math.max(0, Number(width) || 0);
    const h = Math.max(0, Number(height) || 0);
    const horizontal = axis !== 'vertical';
    const span = horizontal ? w : h;
    const thick = horizontal ? h : w;
    const offsets = [];
    if (!n || span <= 0) {
        return {
            horizontal: horizontal,
            count: 0,
            piece: 0,
            thick: thick,
            gap: 0,
            offsets: offsets,
            span: span
        };
    }
    const pitch = span / n;
    let gap = 0;
    if (n > 1) {
        const maxGap = (span - n * AMOUNT_INDICATOR_PIECE_MIN) / (n - 1);
        if (maxGap >= 1) {
            gap = Math.min(AMOUNT_INDICATOR_GAP_AIM, maxGap);
        } else {
            const thinGap = (span - n) / (n - 1);
            gap = Math.max(0, Math.min(2, thinGap));
        }
    }
    let piece = (span - gap * (n - 1)) / n;
    if (!(piece > 0)) {
        gap = 0;
        piece = pitch;
    }
    const step = piece + gap;
    const first = -span / 2 + piece / 2;
    for (let index = 0; index < n; index += 1) {
        offsets.push(first + index * step);
    }
    return {
        horizontal: horizontal,
        count: n,
        piece: piece,
        thick: thick,
        gap: gap,
        offsets: offsets,
        span: span
    };
}

function layoutAmountIndicator(group) {
    const axis = group && group.amountAxis === 'vertical' ? 'vertical' : 'horizontal';
    const measure = amountIndicatorMeasure(group.width, group.height, group.parts.length, axis);
    const origin = group.center;
    group.parts.forEach((part, index) => {
        const item = part.object;
        const emitter = item && item.emitter;
        if (!emitter) {
            return;
        }
        const descending = axis === 'vertical' && group.direction === 'desc';
        const slot = descending ? measure.count - 1 - index : index;
        const along = measure.offsets[slot] || 0;
        const pose = measure.horizontal
            ? amountIndicatorPose(measure.piece, measure.thick, group.shape)
            : amountIndicatorPose(measure.thick, measure.piece, group.shape);
        emitter.from = copyBackHighlightPose(pose);
        emitter.to = copyBackHighlightPose(pose);
        emitter.current = copyBackHighlightPose(pose);
        emitter.cycling = false;
        emitter.center.col = origin.col + (measure.horizontal ? along : 0);
        emitter.center.row = origin.row + (measure.horizontal ? 0 : along);
        emitter.target.col = emitter.center.col;
        emitter.target.row = emitter.center.row;
        if (typeof group.captureLocal === 'function') {
            part.local = group.captureLocal(item);
        }
    });
    return measure;
}

/**
 * Split a vertical amount indicator into columns, left to right.
 * Index 0 fills the left column. The next indexes continue down that column,
 * then the column to its right. `direction` still chooses the vertical start.
 */
function layoutAmountTable(group) {
    const count = group.parts.length;
    const columns = Math.max(1, Math.min(count || 1, group.columns || 1));
    const rows = Math.max(1, Math.ceil(count / columns) || 1);
    const across = amountIndicatorMeasure(group.width, group.height, columns, 'horizontal');
    const down = amountIndicatorMeasure(group.width, group.height, rows, 'vertical');
    const descending = group.direction === 'desc';
    const origin = group.center;
    group.parts.forEach((part, index) => {
        const item = part.object;
        const emitter = item && item.emitter;
        if (!emitter) {
            return;
        }
        const column = Math.floor(index / rows);
        const rowIndex = index % rows;
        const visualRow = descending ? rows - 1 - rowIndex : rowIndex;
        const pose = amountIndicatorPose(across.piece, down.piece, group.shape);
        emitter.from = copyBackHighlightPose(pose);
        emitter.to = copyBackHighlightPose(pose);
        emitter.current = copyBackHighlightPose(pose);
        emitter.cycling = false;
        emitter.center.col = origin.col + (across.offsets[column] || 0);
        emitter.center.row = origin.row + (down.offsets[visualRow] || 0);
        emitter.target.col = emitter.center.col;
        emitter.target.row = emitter.center.row;
        if (typeof group.captureLocal === 'function') {
            part.local = group.captureLocal(item);
        }
    });
    return { columns: columns, rows: rows, across: across, down: down };
}
