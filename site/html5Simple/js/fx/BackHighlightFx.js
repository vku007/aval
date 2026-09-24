/**
 * Filled hot rectangle for BackHighlightScene.
 * Width, height, angle, and heat ease FROM → TO, pause DELAY, then either
 * ease back (CYCLING) or snap to FROM, pause GAP, and repeat.
 */
const BACK_HIGHLIGHT_CELL_PX = 3;
const BACK_HIGHLIGHT_TEX_KEY = 'back-highlight-panel';
const BACK_HIGHLIGHT_EDGE = 2;

const BACK_HIGHLIGHT_FIELD_SPECS = {
    diffusion: { min: 0, max: 20, step: 0.5 },
    cooling: { min: 0, max: 4, step: 0.08 },
    speed: { min: 0.2, max: 8, step: 0.2 },
    delay: { min: 0, max: 4, step: 0.1 },
    gap: { min: 0, max: 4, step: 0.1 }
};

const BACK_HIGHLIGHT_POSE_SPECS = {
    width: { min: 4, max: 240, step: 2 },
    height: { min: 4, max: 180, step: 2 },
    angle: { min: -180, max: 180, step: 5 },
    heat: { min: 0, max: 3, step: 0.1 }
};

function defaultBackHighlightField() {
    return {
        diffusion: 9,
        cooling: 0.08,
        speed: 1.2,
        delay: 0.5,
        gap: 0.4
    };
}

function defaultBackHighlightPose(which) {
    if (which === 'to') {
        return { width: 140, height: 48, angle: 18, heat: 1.8 };
    }
    return { width: 36, height: 16, angle: -18, heat: 0.45 };
}

function clampBackHighlightSpec(specs, name, value) {
    const spec = specs[name];
    if (!spec) {
        return value;
    }
    const stepped = Math.round(value / spec.step) * spec.step;
    const clamped = Math.max(spec.min, Math.min(spec.max, stepped));
    const decimals = spec.step < 0.1 ? 2 : spec.step < 1 ? 1 : 0;
    return Number(clamped.toFixed(decimals));
}

function copyBackHighlightPose(pose) {
    return {
        width: pose.width,
        height: pose.height,
        angle: pose.angle,
        heat: pose.heat
    };
}

function posesMatch(a, b) {
    return Math.abs(a.width - b.width) <= 1 &&
        Math.abs(a.height - b.height) <= 1 &&
        Math.abs(a.angle - b.angle) <= 1 &&
        Math.abs(a.heat - b.heat) <= 0.05;
}

function easeBackHighlightPose(current, target, k) {
    current.width += (target.width - current.width) * k;
    current.height += (target.height - current.height) * k;
    current.angle += (target.angle - current.angle) * k;
    current.heat += (target.heat - current.heat) * k;
}

function stampBackHighlightRect(grid, cols, rows, center, pose) {
    const energy = Math.max(0, pose.heat || 0);
    if (energy <= 0) {
        return;
    }
    const hw = Math.max(0.5, pose.width * 0.5);
    const hh = Math.max(0.5, pose.height * 0.5);
    const edge = BACK_HIGHLIGHT_EDGE;
    const ang = ((pose.angle || 0) * Math.PI) / 180;
    const cosA = Math.cos(ang);
    const sinA = Math.sin(ang);
    const reach = Math.hypot(hw, hh) + edge + 1;
    const x0 = Math.max(0, Math.floor(center.col - reach));
    const x1 = Math.min(cols - 1, Math.ceil(center.col + reach));
    const y0 = Math.max(0, Math.floor(center.row - reach));
    const y1 = Math.min(rows - 1, Math.ceil(center.row + reach));
    for (let y = y0; y <= y1; y++) {
        const dy = y - center.row;
        const base = y * cols;
        for (let x = x0; x <= x1; x++) {
            const dx = x - center.col;
            const u = dx * cosA + dy * sinA;
            const v = -dx * sinA + dy * cosA;
            const ou = Math.max(0, Math.abs(u) - hw);
            const ov = Math.max(0, Math.abs(v) - hh);
            const outside = Math.hypot(ou, ov);
            if (outside > edge) {
                continue;
            }
            let w = 1;
            if (outside > 0) {
                const fall = outside / edge;
                w = Math.exp(-fall * fall * 3);
            }
            const i = base + x;
            const heat = energy * w;
            if (heat > grid[i]) {
                grid[i] = Math.min(1, heat);
            }
        }
    }
}

function setBackHighlightCycling(state, value) {
    state.cycling = !!value;
    if (!state.cycling && state.phase === 'toStart') {
        beginBackHighlightHold(state);
    }
    return state.cycling;
}

function armBackHighlightHover(state) {
    state.drive = 'hover';
    state.hover = false;
    state.current = copyBackHighlightPose(state.from);
    state.phase = 'parkStart';
    state.waitLeft = 0;
}

function setBackHighlightHovered(state, hovered) {
    state.drive = 'hover';
    state.hover = !!hovered;
}

function stepBackHighlightHover(state, delta) {
    const dt = Math.min(delta / 1000, 0.05);
    const toward = state.hover ? state.to : state.from;
    if (posesMatch(state.current, toward)) {
        state.current = copyBackHighlightPose(toward);
        state.phase = state.hover ? 'parkEnd' : 'parkStart';
        return state.current;
    }
    state.phase = state.hover ? 'toEnd' : 'toStart';
    const k = 1 - Math.exp(-state.params.speed * dt);
    easeBackHighlightPose(state.current, toward, k);
    if (posesMatch(state.current, toward)) {
        state.current = copyBackHighlightPose(toward);
        state.phase = state.hover ? 'parkEnd' : 'parkStart';
    }
    return state.current;
}

function beginBackHighlightHold(state) {
    state.current = copyBackHighlightPose(state.from);
    state.waitLeft = Math.max(0, state.params.gap || 0);
    state.phase = state.waitLeft > 0 ? 'hold' : 'toEnd';
}

function arriveBackHighlightEnd(state) {
    state.current = copyBackHighlightPose(state.to);
    state.waitLeft = Math.max(0, state.params.delay || 0);
    if (state.waitLeft > 0) {
        state.phase = 'wait';
        return;
    }
    if (state.cycling) {
        state.phase = 'toStart';
        return;
    }
    beginBackHighlightHold(state);
}

function stepBackHighlightPose(state, delta) {
    if (state.drive === 'hover') {
        return stepBackHighlightHover(state, delta);
    }
    const dt = Math.min(delta / 1000, 0.05);
    if (posesMatch(state.from, state.to)) {
        state.current = copyBackHighlightPose(state.from);
        return state.current;
    }
    if (state.phase === 'wait') {
        state.waitLeft -= dt;
        state.current = copyBackHighlightPose(state.to);
        if (state.waitLeft <= 0) {
            if (state.cycling) {
                state.phase = 'toStart';
            } else {
                beginBackHighlightHold(state);
            }
        }
        return state.current;
    }
    if (state.phase === 'hold') {
        state.waitLeft -= dt;
        state.current = copyBackHighlightPose(state.from);
        if (state.waitLeft <= 0) {
            state.phase = 'toEnd';
        }
        return state.current;
    }
    if (state.phase === 'toStart' && !state.cycling) {
        beginBackHighlightHold(state);
        return state.current;
    }
    const toward = state.phase === 'toStart' ? state.from : state.to;
    const k = 1 - Math.exp(-state.params.speed * dt);
    easeBackHighlightPose(state.current, toward, k);
    if (posesMatch(state.current, toward)) {
        if (state.phase === 'toStart') {
            beginBackHighlightHold(state);
        } else {
            arriveBackHighlightEnd(state);
        }
    }
    return state.current;
}

function attachBackHighlight(scene, x, y, width, height) {
    const cols = Math.max(48, Math.round(width / BACK_HIGHLIGHT_CELL_PX));
    const rows = Math.max(48, Math.round(height / BACK_HIGHLIGHT_CELL_PX));
    const src = new Float32Array(cols * rows);
    const dst = new Float32Array(cols * rows);
    const startCol = (cols - 1) * 0.5;
    const startRow = (rows - 1) * 0.5;

    if (scene.textures.exists(BACK_HIGHLIGHT_TEX_KEY)) {
        scene.textures.remove(BACK_HIGHLIGHT_TEX_KEY);
    }
    const tex = scene.textures.createCanvas(BACK_HIGHLIGHT_TEX_KEY, cols, rows);
    const ctx = tex.getContext();
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, cols, rows);
    tex.refresh();

    const view = scene.add.image(x + width / 2, y + height / 2, BACK_HIGHLIGHT_TEX_KEY);
    view.setDisplaySize(width, height);
    const imageData = ctx.createImageData(cols, rows);

    const state = {
        kind: 'back-highlight',
        view,
        cols,
        rows,
        src,
        dst,
        tex,
        ctx,
        imageData,
        center: { col: startCol, row: startRow },
        target: { col: startCol, row: startRow },
        from: defaultBackHighlightPose('from'),
        to: defaultBackHighlightPose('to'),
        current: defaultBackHighlightPose('from'),
        phase: 'toEnd',
        waitLeft: 0,
        cycling: true,
        params: defaultBackHighlightField(),
        paint: () => {
            paintHotRodHeat(state.imageData, state.src, cols, rows);
            state.ctx.putImageData(state.imageData, 0, 0);
            state.tex.refresh();
        },
        setParam: (group, name, value) => {
            if (group === 'field' && name === 'cycling') {
                return setBackHighlightCycling(state, value);
            }
            if (group === 'from' || group === 'to') {
                if (!BACK_HIGHLIGHT_POSE_SPECS[name]) {
                    return state[group][name];
                }
                state[group][name] = clampBackHighlightSpec(BACK_HIGHLIGHT_POSE_SPECS, name, value);
                return state[group][name];
            }
            if (!BACK_HIGHLIGHT_FIELD_SPECS[name]) {
                return state.params[name];
            }
            state.params[name] = clampBackHighlightSpec(BACK_HIGHLIGHT_FIELD_SPECS, name, value);
            return state.params[name];
        },
        nudgeParam: (group, name, dir) => {
            if (group === 'field' && name === 'cycling') {
                return state.setParam(group, name, !state.cycling);
            }
            const specs = group === 'field' ? BACK_HIGHLIGHT_FIELD_SPECS : BACK_HIGHLIGHT_POSE_SPECS;
            const spec = specs[name];
            const bucket = group === 'field' ? state.params : state[group];
            if (!spec || !bucket) {
                return 0;
            }
            return state.setParam(group, name, bucket[name] + dir * spec.step);
        },
        update: (_, delta) => {
            const dt = Math.min(delta / 1000, 0.05);
            stepHotRodHeat(state.src, state.dst, cols, rows, delta, state.params);
            const swap = state.src;
            state.src = state.dst;
            state.dst = swap;
            const k = 1 - Math.exp(-state.params.speed * dt);
            state.center.col += (state.target.col - state.center.col) * k;
            state.center.row += (state.target.row - state.center.row) * k;
            const pose = stepBackHighlightPose(state, delta);
            stampBackHighlightRect(state.src, cols, rows, state.center, pose);
            state.paint();
        }
    };

    state.paint();

    const hit = scene.add.zone(x, y, width, height).setOrigin(0);
    hit.setInteractive({ useHandCursor: true });
    hit.on('pointerdown', (pointer) => {
        const cell = pointerToHotRodCell(pointer, x, y, width, height, cols, rows);
        state.target.col = cell.col;
        state.target.row = cell.row;
    });
    state.hit = hit;

    scene.events.once('shutdown', () => {
        if (state.hit) {
            state.hit.destroy();
        }
        if (state.view) {
            state.view.destroy();
        }
        if (scene.textures.exists(BACK_HIGHLIGHT_TEX_KEY)) {
            scene.textures.remove(BACK_HIGHLIGHT_TEX_KEY);
        }
    });

    return state;
}

const BACK_HIGHLIGHT_POSE_KEYS = {
    fromWidth: { group: 'from', prop: 'width' },
    fromHeight: { group: 'from', prop: 'height' },
    fromAngle: { group: 'from', prop: 'angle' },
    fromHeat: { group: 'from', prop: 'heat' },
    toWidth: { group: 'to', prop: 'width' },
    toHeight: { group: 'to', prop: 'height' },
    toAngle: { group: 'to', prop: 'angle' },
    toHeat: { group: 'to', prop: 'heat' }
};

function mergeBackHighlightPose(base, extra) {
    const pose = copyBackHighlightPose(base);
    const raw = extra || {};
    Object.keys(BACK_HIGHLIGHT_POSE_SPECS).forEach((key) => {
        if (raw[key] != null) {
            pose[key] = clampBackHighlightSpec(BACK_HIGHLIGHT_POSE_SPECS, key, raw[key]);
        }
    });
    return pose;
}

function backHighlightPoint(field, point, fallback) {
    const stub = { cols: field.cols, rows: field.rows };
    if (point && typeof point.col === 'number' && typeof point.row === 'number') {
        return clampHotRodPoint(stub, point);
    }
    return { col: fallback.col, row: fallback.row };
}

function createBackHighlightEmitterState(field, options) {
    const opts = options || {};
    const raw = opts.params || {};
    const params = {
        speed: clampBackHighlightSpec(BACK_HIGHLIGHT_FIELD_SPECS, 'speed', raw.speed != null ? raw.speed : 1.2),
        delay: clampBackHighlightSpec(BACK_HIGHLIGHT_FIELD_SPECS, 'delay', raw.delay != null ? raw.delay : 0.5),
        gap: clampBackHighlightSpec(BACK_HIGHLIGHT_FIELD_SPECS, 'gap', raw.gap != null ? raw.gap : 0.4)
    };
    const from = mergeBackHighlightPose(defaultBackHighlightPose('from'), opts.from);
    const to = mergeBackHighlightPose(defaultBackHighlightPose('to'), opts.to);
    const mid = {
        col: (field.cols - 1) * 0.5,
        row: (field.rows - 1) * 0.5
    };
    const stub = { cols: field.cols, rows: field.rows };
    if (opts.centerX != null) {
        mid.col = hotRodPctToCoord(stub, 'col', opts.centerX);
    }
    if (opts.centerY != null) {
        mid.row = hotRodPctToCoord(stub, 'row', opts.centerY);
    }
    const center = backHighlightPoint(field, opts.center, mid);
    const target = backHighlightPoint(field, opts.target, center);
    const emitter = {
        kind: 'back-highlight',
        field,
        cols: field.cols,
        rows: field.rows,
        isVisible: opts.isVisible !== false,
        cycling: opts.cycling !== false,
        from,
        to,
        current: copyBackHighlightPose(from),
        phase: 'toEnd',
        waitLeft: 0,
        center,
        target,
        params,
        setParam: (name, value) => {
            if (name === 'cycling') {
                return setBackHighlightCycling(emitter, value);
            }
            const poseKey = BACK_HIGHLIGHT_POSE_KEYS[name];
            if (poseKey) {
                const next = clampBackHighlightSpec(BACK_HIGHLIGHT_POSE_SPECS, poseKey.prop, value);
                emitter[poseKey.group][poseKey.prop] = next;
                return next;
            }
            if (!BACK_HIGHLIGHT_FIELD_SPECS[name]) {
                return params[name];
            }
            params[name] = clampBackHighlightSpec(BACK_HIGHLIGHT_FIELD_SPECS, name, value);
            return params[name];
        },
        nudgeParam: (name, dir) => {
            if (name === 'cycling') {
                return emitter.setParam(name, !emitter.cycling);
            }
            const poseKey = BACK_HIGHLIGHT_POSE_KEYS[name];
            if (poseKey) {
                const spec = BACK_HIGHLIGHT_POSE_SPECS[poseKey.prop];
                return emitter.setParam(name, emitter[poseKey.group][poseKey.prop] + dir * spec.step);
            }
            const spec = BACK_HIGHLIGHT_FIELD_SPECS[name];
            if (!spec) {
                return params[name];
            }
            return emitter.setParam(name, params[name] + dir * spec.step);
        },
        setCenter: (point) => {
            const next = clampHotRodPoint(emitter, point);
            emitter.target.col = next.col;
            emitter.target.row = next.row;
            return next;
        },
        advance: (delta) => {
            const dt = Math.min(delta / 1000, 0.05);
            const k = 1 - Math.exp(-emitter.params.speed * dt);
            emitter.center.col += (emitter.target.col - emitter.center.col) * k;
            emitter.center.row += (emitter.target.row - emitter.center.row) * k;
            return stepBackHighlightPose(emitter, delta);
        },
        stamp: (grid) => stampBackHighlightRect(grid, emitter.cols, emitter.rows, emitter.center, emitter.current),
        retarget: (cell) => emitter.setCenter(cell)
    };
    return emitter;
}
