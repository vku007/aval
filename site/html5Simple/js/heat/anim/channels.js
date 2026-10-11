/**
 * Heat channels
 * Each run stores its own contribution. The combiner adds offsets and angles,
 * multiplies scales and heats, and keeps the latest started pose or gather.
 * Identity is a no-op on the stamp: add 0, multiply by 1.
 */
const HEAT_CHANNEL_SPEC = {
    offset: { combine: 'add', shape: 'point' },
    rotate: { combine: 'add', shape: 'number', identity: 0 },
    scale: { combine: 'mul', shape: 'number', identity: 1 },
    heat: { combine: 'mul', shape: 'number', identity: 1 },
    phase: { combine: 'add', shape: 'number', identity: 0 },
    clip: { combine: 'mul', shape: 'number', identity: 1 },
    pose: { combine: 'latest', shape: 'number', identity: 0 },
    'shape.heat': { combine: 'mul', shape: 'number', identity: 1 },
    'glisten.gain': { combine: 'mul', shape: 'number', identity: 1 },
    'disk.heat': { combine: 'mul', shape: 'number', identity: 1 },
    'disk.scale': { combine: 'mul', shape: 'number', identity: 1 },
    'balls.heat': { combine: 'mul', shape: 'number', identity: 1 },
    'balls.scale': { combine: 'mul', shape: 'number', identity: 1 },
    'balls.offset': { combine: 'add', shape: 'point' },
    'balls.gather': { combine: 'latest', shape: 'number', identity: 0 },
    'balls.gatherAt': { combine: 'latest', shape: 'point' },
    tiltX: { combine: 'add', shape: 'number', identity: 0 },
    tiltY: { combine: 'add', shape: 'number', identity: 0 }
};

const HEAT_STANDARD_CHANNELS = ['offset', 'rotate', 'scale', 'heat'];

function heatChannelNames(kind) {
    const names = HEAT_STANDARD_CHANNELS.slice();
    if (kind === 'hot-ball') {
        names.push('phase');
    } else if (kind === 'hot-rod') {
        names.push('clip');
    } else if (kind === 'back-highlight' || kind === 'pointer') {
        names.push('pose');
    } else if (kind === 'shard') {
        names.push('pose', 'tiltX', 'tiltY');
    } else if (kind === 'sheet') {
        names.push(
            'shape.heat', 'glisten.gain',
            'balls.heat', 'balls.scale', 'balls.offset', 'balls.gather', 'balls.gatherAt'
        );
    } else if (kind === 'new-sheet') {
        names.push(
            'disk.heat', 'disk.scale',
            'balls.heat', 'balls.scale', 'balls.offset', 'balls.gather', 'balls.gatherAt'
        );
    } else if (kind === 'circle') {
        names.push('glisten.gain');
    }
    return names;
}

function heatIdentity(name) {
    const spec = HEAT_CHANNEL_SPEC[name];
    if (!spec || spec.shape === 'point') {
        return { col: 0, row: 0 };
    }
    return spec.identity;
}

function heatCleanValues(names, values) {
    const clean = {};
    names.forEach((name) => {
        if (values && Object.prototype.hasOwnProperty.call(values, name)) {
            clean[name] = cloneHeatValue(name, values[name]);
        }
    });
    return clean;
}

function cloneHeatValue(name, value) {
    const spec = HEAT_CHANNEL_SPEC[name];
    if (!spec) {
        return value;
    }
    if (spec.shape === 'point') {
        const point = value || {};
        return {
            col: typeof point.col === 'number' ? point.col : 0,
            row: typeof point.row === 'number' ? point.row : 0
        };
    }
    return typeof value === 'number' ? value : spec.identity;
}

function combineHeatChannel(name, runs) {
    const spec = HEAT_CHANNEL_SPEC[name];
    const hits = [];
    runs.forEach((run) => {
        if (Object.prototype.hasOwnProperty.call(run.values, name)) {
            hits.push(run);
        }
    });
    if (!hits.length) {
        return heatIdentity(name);
    }
    if (spec.combine === 'add' && spec.shape === 'point') {
        let col = 0;
        let row = 0;
        hits.forEach((run) => {
            col += run.values[name].col;
            row += run.values[name].row;
        });
        return { col: col, row: row };
    }
    if (spec.combine === 'add') {
        let sum = 0;
        hits.forEach((run) => {
            sum += run.values[name];
        });
        return sum;
    }
    if (spec.combine === 'mul') {
        let product = 1;
        hits.forEach((run) => {
            product *= run.values[name];
        });
        return product;
    }
    let best = hits[0];
    for (let index = 1; index < hits.length; index += 1) {
        const run = hits[index];
        if (run.started > best.started || (run.started === best.started && run.order > best.order)) {
            best = run;
        }
    }
    const picked = best.values[name];
    if (spec.shape === 'point') {
        return { col: picked.col, row: picked.row };
    }
    return picked;
}

class HeatChannels {
    constructor(kind) {
        this.kind = kind || '';
        this.names = heatChannelNames(kind);
        this._runs = [];
        this._seq = 0;
    }

    set(id, values, started) {
        const clean = heatCleanValues(this.names, values);
        this._seq += 1;
        const at = typeof started === 'number' ? started : this._seq;
        const order = this._seq;
        const existing = this._runs.find((run) => run.id === id);
        if (existing) {
            existing.values = clean;
            existing.started = at;
            existing.order = order;
            return this;
        }
        this._runs.push({ id: id, values: clean, started: at, order: order });
        return this;
    }

    update(id, values) {
        const existing = this._runs.find((run) => run.id === id);
        if (!existing) {
            return this.set(id, values);
        }
        existing.values = heatCleanValues(this.names, values);
        return this;
    }

    clear(id) {
        if (id == null) {
            this._runs = [];
            return this;
        }
        this._runs = this._runs.filter((run) => run.id !== id);
        return this;
    }

    held(name) {
        return this._runs.some((run) => Object.prototype.hasOwnProperty.call(run.values, name));
    }

    combined() {
        const out = {};
        this.names.forEach((name) => {
            out[name] = combineHeatChannel(name, this._runs);
        });
        return out;
    }
}

function heatNodeOf(target) {
    if (!target) {
        return null;
    }
    if (target.channels) {
        return target;
    }
    if (target.root && target.root.channels) {
        return target.root;
    }
    return null;
}

function heatFrame(node) {
    const ownNode = node && node.channels ? node : null;
    const own = ownNode ? ownNode.channels.combined() : {
        offset: { col: 0, row: 0 },
        rotate: 0,
        scale: 1,
        heat: 1
    };
    const parent = ownNode && ownNode.parent;
    const group = parent && parent.channels ? parent.channels.combined() : null;
    const origin = parent && parent.center ? parent.center : null;
    return {
        own: own,
        group: group,
        origin: origin,
        poseHeld: !!(ownNode && ownNode.channels.held('pose'))
    };
}

function heatValuesRest(values) {
    const names = Object.keys(values);
    for (let index = 0; index < names.length; index += 1) {
        const name = names[index];
        const spec = HEAT_CHANNEL_SPEC[name];
        const value = values[name];
        if (!spec) {
            continue;
        }
        if (spec.shape === 'point') {
            if (!value || value.col !== 0 || value.row !== 0) {
                return false;
            }
        } else if (value !== spec.identity) {
            return false;
        }
    }
    return true;
}

function heatRest(frame) {
    if (!frame || frame.poseHeld) {
        return false;
    }
    if (!heatValuesRest(frame.own)) {
        return false;
    }
    if (frame.group && !heatValuesRest(frame.group)) {
        return false;
    }
    return true;
}

function heatMul(value, factor) {
    if (typeof value !== 'number' || factor === 1) {
        return value;
    }
    return value * factor;
}

function heatScale(frame, value) {
    let factor = frame.own.scale == null ? 1 : frame.own.scale;
    if (frame.group) {
        factor *= frame.group.scale;
    }
    return heatMul(value, factor);
}

function heatHeat(frame, value) {
    let factor = frame.own.heat == null ? 1 : frame.own.heat;
    if (frame.group) {
        factor *= frame.group.heat;
    }
    return heatMul(value, factor);
}

function heatAngle(frame, value) {
    if (typeof value !== 'number') {
        return value;
    }
    let delta = frame.own.rotate || 0;
    if (frame.group) {
        delta += frame.group.rotate || 0;
    }
    if (delta === 0) {
        return value;
    }
    return value + delta;
}

function heatGroupPoint(frame, col, row) {
    const group = frame.group;
    const origin = frame.origin;
    if (!group || !origin) {
        return { col: col, row: row };
    }
    let c = col;
    let r = row;
    if (group.scale !== 1 || group.rotate !== 0) {
        const rad = group.rotate * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const dx = (col - origin.col) * group.scale;
        const dy = (row - origin.row) * group.scale;
        c = origin.col + dx * cos - dy * sin;
        r = origin.row + dx * sin + dy * cos;
    }
    c += group.offset.col;
    r += group.offset.row;
    return { col: c, row: r };
}

function heatPlace(frame, col, row) {
    const localCol = col + frame.own.offset.col;
    const localRow = row + frame.own.offset.row;
    return heatGroupPoint(frame, localCol, localRow);
}

function heatBallPoint(frame, col, row) {
    const extra = frame.own['balls.offset'] || { col: 0, row: 0 };
    let c = col + frame.own.offset.col + extra.col;
    let r = row + frame.own.offset.row + extra.row;
    const gather = frame.own['balls.gather'] || 0;
    if (gather !== 0) {
        const at = frame.own['balls.gatherAt'] || { col: 0, row: 0 };
        c += (at.col - c) * gather;
        r += (at.row - r) * gather;
    }
    return heatGroupPoint(frame, c, r);
}

function heatDotParams(frame, params) {
    const radius = heatScale(frame, params.radius);
    const energy = heatHeat(frame, params.energy);
    if (radius === params.radius && energy === params.energy) {
        return params;
    }
    return Object.assign({}, params, { radius: radius, energy: energy });
}

function heatRodParams(frame, params) {
    const thickness = heatScale(frame, params.thickness);
    const energy = heatHeat(frame, params.energy);
    const angle = heatAngle(frame, params.angle || 0);
    if (thickness === params.thickness && energy === params.energy && angle === (params.angle || 0)) {
        return params;
    }
    return Object.assign({}, params, {
        thickness: thickness,
        energy: energy,
        angle: angle
    });
}

function heatClip(frame, clip) {
    const factor = frame.own.clip == null ? 1 : frame.own.clip;
    if (!clip || factor === 1) {
        return clip || null;
    }
    const next = {};
    if (clip.colMin != null && clip.colMax != null) {
        const mid = (clip.colMin + clip.colMax) * 0.5;
        const half = (clip.colMax - clip.colMin) * 0.5 * factor;
        next.colMin = mid - half;
        next.colMax = mid + half;
    }
    if (clip.rowMin != null && clip.rowMax != null) {
        const mid = (clip.rowMin + clip.rowMax) * 0.5;
        const half = (clip.rowMax - clip.rowMin) * 0.5 * factor;
        next.rowMin = mid - half;
        next.rowMax = mid + half;
    }
    return next;
}

function heatPresentPose(frame, pose, from, to) {
    const shape = frame.own['shape.heat'] == null ? 1 : frame.own['shape.heat'];
    const rot = (frame.own.rotate || 0) + (frame.group ? frame.group.rotate || 0 : 0);
    const scale = (frame.own.scale == null ? 1 : frame.own.scale) * (frame.group ? frame.group.scale : 1);
    const heat = (frame.own.heat == null ? 1 : frame.own.heat) * (frame.group ? frame.group.heat : 1);
    const tiltX = frame.own.tiltX || 0;
    const tiltY = frame.own.tiltY || 0;
    if (!frame.poseHeld && shape === 1 && rot === 0 && scale === 1 && heat === 1 && tiltX === 0 && tiltY === 0) {
        return pose;
    }
    const shown = frame.poseHeld && from && to
        ? heatBlendPose(from, to, frame.own.pose)
        : copyBackHighlightPose(pose);
    if (scale !== 1) {
        shown.width = heatMul(shown.width, scale);
        shown.height = heatMul(shown.height, scale);
        if (typeof shown.bend === 'number') {
            shown.bend = heatMul(shown.bend, scale);
        }
        if (typeof shown.radius === 'number') {
            shown.radius = heatMul(shown.radius, scale);
        }
        if (typeof shown.outer === 'number') {
            shown.outer = heatMul(shown.outer, scale);
        }
        if (typeof shown.inner === 'number') {
            shown.inner = heatMul(shown.inner, scale);
        }
    }
    if (rot !== 0) {
        shown.angle = (shown.angle || 0) + rot;
    }
    if (heat !== 1 || shape !== 1) {
        if (typeof shown.heat === 'number') {
            shown.heat *= heat * shape;
        }
        if (typeof shown.shapeHeat === 'number') {
            shown.shapeHeat *= heat;
        }
    }
    if (tiltX !== 0 || tiltY !== 0) {
        projectBackHighlightTilt(shown, tiltX, tiltY);
    }
    return shown;
}

function heatBlendPose(from, to, t) {
    const shown = copyBackHighlightPose(from);
    ['width', 'height', 'angle', 'skew', 'heat', 'shapeHeat', 'glisten', 'bend', 'cosine', 'radius', 'outer', 'inner'].forEach((key) => {
        const start = from && typeof from[key] === 'number' ? from[key] : null;
        const end = to && typeof to[key] === 'number' ? to[key] : null;
        if (start == null && end == null) {
            return;
        }
        const a = start == null ? 0 : start;
        const b = end == null ? a : end;
        shown[key] = a + (b - a) * t;
    });
    return shown;
}
