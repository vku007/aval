/**
 * Hot line for MoveHotRodScene: infinite strip clipped to the panel.
 * Tap slides it along the normal to ANGLE. Neighbors diffuse and fade.
 */
const HOT_ROD_CELL_PX = 3;
const HOT_ROD_DIFFUSION = 9;
const HOT_ROD_COOLING = 0.08;
const HOT_ROD_THICKNESS = 4;
const HOT_ROD_LINE_ENERGY = 1.5;
const HOT_ROD_FOLLOW = 3.2;
const HOT_ROD_NOISE = 0.7;
const HOT_ROD_GRAIN = 4;
const HOT_ROD_FLICKER = 1.6;
const HOT_ROD_ANGLE_DEG = 0;
const HOT_ROD_DELAY = 0.4;
const HOT_ROD_GAP = 0;
const HOT_ROD_PATH_PCT_MIN = -200;
const HOT_ROD_PATH_PCT_MAX = 200;
const HOT_ROD_PATH_PCT_STEP = 5;
const HOT_ROD_TEX_KEY = 'hot-rod-panel';

const HOT_ROD_EMITTER_SPECS = {
    thickness: { min: 1, max: 24, step: 0.5 },
    energy: { min: 0.2, max: 3, step: 0.1 },
    followSpeed: { min: 0.4, max: 12, step: 0.4 },
    angle: { min: 0, max: 180, step: 5 },
    delay: { min: 0, max: 4, step: 0.1 },
    gap: { min: 0, max: 4, step: 0.1 },
    noiseAmt: { min: 0, max: 1.5, step: 0.1 },
    noiseGrain: { min: 0.5, max: 12, step: 0.5 },
    noiseFlicker: { min: 0, max: 8, step: 0.2 }
};

const HOT_ROD_PARAM_SPECS = Object.assign({
    diffusion: { min: 0, max: 20, step: 0.5 },
    cooling: { min: 0, max: 4, step: 0.08 }
}, HOT_ROD_EMITTER_SPECS);

function defaultHotRodEmitterParams(overrides) {
    return Object.assign({
        thickness: HOT_ROD_THICKNESS,
        energy: HOT_ROD_LINE_ENERGY,
        followSpeed: HOT_ROD_FOLLOW,
        angle: HOT_ROD_ANGLE_DEG,
        delay: HOT_ROD_DELAY,
        gap: HOT_ROD_GAP,
        noiseAmt: HOT_ROD_NOISE,
        noiseGrain: HOT_ROD_GRAIN,
        noiseFlicker: HOT_ROD_FLICKER
    }, overrides || {});
}

function defaultHotRodParams() {
    return Object.assign({
        diffusion: HOT_ROD_DIFFUSION,
        cooling: HOT_ROD_COOLING
    }, defaultHotRodEmitterParams());
}

function clampHotRodParam(name, value) {
    const spec = HOT_ROD_PARAM_SPECS[name];
    if (!spec) {
        return value;
    }
    const stepped = Math.round(value / spec.step) * spec.step;
    const clamped = Math.max(spec.min, Math.min(spec.max, stepped));
    const decimals = spec.step < 0.1 ? 2 : spec.step < 1 ? 1 : 0;
    return Number(clamped.toFixed(decimals));
}

function hotRodRgb(t) {
    const clamped = Math.max(0, Math.min(1, t));
    const u = Math.pow(clamped, 0.48);
    if (u <= 0.015) {
        const k = u / 0.015;
        return [Math.round(28 * k), 0, 0];
    }
    if (u < 0.22) {
        const k = (u - 0.015) / 0.205;
        return [28 + Math.round(200 * k), Math.round(16 * k), 0];
    }
    if (u < 0.48) {
        const k = (u - 0.22) / 0.26;
        return [228 + Math.round(27 * k), 16 + Math.round(150 * k), 0];
    }
    if (u < 0.75) {
        const k = (u - 0.48) / 0.27;
        return [255, 166 + Math.round(70 * k), Math.round(50 * k)];
    }
    const k = (u - 0.75) / 0.25;
    return [255, 236 + Math.round(19 * k), 50 + Math.round(205 * k)];
}

function hotRodHash(ix, iy) {
    const n = Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453123;
    return n - Math.floor(n);
}

function hotRodValueNoise(x, y) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const u = fx * fx * (3 - 2 * fx);
    const v = fy * fy * (3 - 2 * fy);
    const a = hotRodHash(x0, y0);
    const b = hotRodHash(x0 + 1, y0);
    const c = hotRodHash(x0, y0 + 1);
    const d = hotRodHash(x0 + 1, y0 + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function stampHotRodLine(grid, cols, rows, center, params, time) {
    const halfT = Math.max(0.5, params.thickness * 0.5);
    const edge = Math.max(0.7, halfT * 0.35);
    const centerCol = center.col;
    const centerRow = center.row;
    const ang = ((params.angle || 0) * Math.PI) / 180;
    const cosA = Math.cos(ang);
    const sinA = Math.sin(ang);
    const reachT = halfT + edge;
    const amt = Math.max(0, params.noiseAmt || 0);
    const freq = Math.max(0.04, (params.noiseGrain || 1) * 0.14);
    const flicker = params.noiseFlicker || 0;
    const t = time || 0;
    const lastX = cols - 1;
    for (let y = 0; y < rows; y++) {
        const dy = y - centerRow;
        const vLeft = centerCol * sinA + dy * cosA;
        const vRight = -(lastX - centerCol) * sinA + dy * cosA;
        const vMin = Math.min(vLeft, vRight);
        const vMax = Math.max(vLeft, vRight);
        if (vMax < -reachT || vMin > reachT) {
            continue;
        }
        const base = y * cols;
        for (let x = 0; x < cols; x++) {
            const dx = x - centerCol;
            const localU = dx * cosA + dy * sinA;
            const localV = -dx * sinA + dy * cosA;
            const av = Math.abs(localV);
            if (av > reachT) {
                continue;
            }
            let w = 1;
            if (av > halfT) {
                const fall = (av - halfT) / edge;
                w = Math.exp(-fall * fall * 3);
            }
            let heat = params.energy * w;
            if (amt > 0) {
                const n = hotRodValueNoise(
                    localU * freq + t * flicker * 0.37,
                    localV * freq - t * flicker * 0.55
                ) * 2 - 1;
                heat *= Math.max(0, 1 + amt * n);
            }
            const i = base + x;
            grid[i] = Math.min(1, Math.max(grid[i], heat));
        }
    }
}

function stepHotRodHeat(src, dst, cols, rows, delta, params) {
    const dt = Math.min(delta / 1000, 0.05);
    const k = Math.min(0.18, params.diffusion * dt);
    const cool = Math.exp(-params.cooling * dt);
    const lastX = cols - 1;
    const lastY = rows - 1;
    for (let y = 0; y < rows; y++) {
        const row = y * cols;
        const nRow = (y > 0 ? y - 1 : y) * cols;
        const sRow = (y < lastY ? y + 1 : y) * cols;
        for (let x = 0; x < cols; x++) {
            const west = x > 0 ? x - 1 : x;
            const east = x < lastX ? x + 1 : x;
            const avg = (
                src[nRow + west] + src[nRow + x] + src[nRow + east] +
                src[row + west] + src[row + east] +
                src[sRow + west] + src[sRow + x] + src[sRow + east]
            ) / 8;
            const i = row + x;
            dst[i] = Math.max(0, Math.min(1, (src[i] + k * (avg - src[i])) * cool));
        }
    }
}

function paintHotRodHeat(imageData, grid, cols, rows) {
    const data = imageData.data;
    for (let i = 0, n = cols * rows; i < n; i++) {
        const rgb = hotRodRgb(grid[i]);
        const p = i * 4;
        data[p] = rgb[0];
        data[p + 1] = rgb[1];
        data[p + 2] = rgb[2];
        data[p + 3] = 255;
    }
}

function pointerToHotRodCell(pointer, x, y, width, height, cols, rows) {
    const localX = Phaser.Math.Clamp(pointer.worldX - x, 0, width);
    const localY = Phaser.Math.Clamp(pointer.worldY - y, 0, height);
    return {
        col: (localX / Math.max(width, 1)) * (cols - 1),
        row: (localY / Math.max(height, 1)) * (rows - 1)
    };
}

function hotRodNormal(params) {
    const a = ((params.angle || 0) * Math.PI) / 180;
    return { x: -Math.sin(a), y: Math.cos(a) };
}

function hotRodAxisSpan(state, axis) {
    return axis === 'col' ? Math.max(1, state.cols - 1) : Math.max(1, state.rows - 1);
}

function hotRodCoordToPct(state, axis, coord) {
    const span = hotRodAxisSpan(state, axis);
    const pct = (Number(coord) / span) * 100;
    const stepped = Math.round(pct / HOT_ROD_PATH_PCT_STEP) * HOT_ROD_PATH_PCT_STEP;
    return Math.max(HOT_ROD_PATH_PCT_MIN, Math.min(HOT_ROD_PATH_PCT_MAX, Number(stepped.toFixed(0))));
}

function hotRodPctToCoord(state, axis, pct) {
    const span = hotRodAxisSpan(state, axis);
    const clamped = Math.max(HOT_ROD_PATH_PCT_MIN, Math.min(HOT_ROD_PATH_PCT_MAX, Number(pct)));
    return (clamped / 100) * span;
}

function clampHotRodPoint(state, point) {
    const minCol = hotRodPctToCoord(state, 'col', HOT_ROD_PATH_PCT_MIN);
    const maxCol = hotRodPctToCoord(state, 'col', HOT_ROD_PATH_PCT_MAX);
    const minRow = hotRodPctToCoord(state, 'row', HOT_ROD_PATH_PCT_MIN);
    const maxRow = hotRodPctToCoord(state, 'row', HOT_ROD_PATH_PCT_MAX);
    return {
        col: Math.max(minCol, Math.min(maxCol, point.col)),
        row: Math.max(minRow, Math.min(maxRow, point.row))
    };
}

function copyHotRodPoint(point, fallback) {
    if (point && typeof point.col === 'number' && typeof point.row === 'number') {
        return { col: point.col, row: point.row };
    }
    return { col: fallback.col, row: fallback.row };
}

function defaultHotRodPath(field, angleDeg) {
    const n = hotRodNormal({ angle: angleDeg || 0 });
    const cx = (field.cols - 1) * 0.5;
    const cy = (field.rows - 1) * 0.5;
    const span = Math.min(field.cols, field.rows) * 0.28;
    return {
        start: { col: cx - n.x * span, row: cy - n.y * span },
        end: { col: cx + n.x * span, row: cy + n.y * span }
    };
}

function snapHotRodTo(state, point, angle) {
    const next = clampHotRodPoint(state, point);
    state.center.col = next.col;
    state.center.row = next.row;
    state.target.col = next.col;
    state.target.row = next.row;
    if (typeof angle === 'number') {
        state.params.angle = clampHotRodParam('angle', angle);
    }
    return next;
}

function hotRodArrived(a, b, eps) {
    const dx = a.col - b.col;
    const dy = a.row - b.row;
    return dx * dx + dy * dy <= eps * eps;
}

function hotRodAngleArrived(a, b, eps) {
    return Math.abs((a || 0) - (b || 0)) <= eps;
}

function hotRodPoseArrived(state, point, angle, posEps, angEps) {
    return hotRodArrived(state.center, point, posEps) &&
        hotRodAngleArrived(state.params.angle, angle, angEps);
}

function hotRodLoopIdle(state) {
    return hotRodArrived(state.start, state.end, 0.5) &&
        hotRodAngleArrived(state.startAngle, state.endAngle, 0.5);
}

function retargetHotRod(state, click) {
    const n = hotRodNormal(state.params);
    const origin = state.start || state.center;
    const d = (click.col - origin.col) * n.x + (click.row - origin.row) * n.y;
    const next = clampHotRodPoint(state, {
        col: origin.col + d * n.x,
        row: origin.row + d * n.y
    });
    if (state.loopOn) {
        state.end.col = next.col;
        state.end.row = next.row;
        state.phase = 'toEnd';
        state.waitLeft = 0;
        state.target.col = next.col;
        state.target.row = next.row;
        return;
    }
    state.target.col = next.col;
    state.target.row = next.row;
}

function hotRodFollowK(state, delta) {
    const dt = Math.min(delta / 1000, 0.05);
    return 1 - Math.exp(-state.params.followSpeed * dt);
}

function stepHotRodMotion(state, delta) {
    const k = hotRodFollowK(state, delta);
    state.center.col += (state.target.col - state.center.col) * k;
    state.center.row += (state.target.row - state.center.row) * k;
    if (state.loopOn) {
        const next = clampHotRodPoint(state, state.center);
        state.center.col = next.col;
        state.center.row = next.row;
    } else {
        state.center.col = Math.max(0, Math.min(state.cols - 1, state.center.col));
        state.center.row = Math.max(0, Math.min(state.rows - 1, state.center.row));
    }
    return state.center;
}

function beginHotRodStartHold(state) {
    snapHotRodTo(state, state.start, state.startAngle);
    state.waitLeft = Math.max(0, state.params.gap || 0);
    state.phase = state.waitLeft > 0 ? 'hold' : 'toEnd';
}

function stepHotRodLoop(state, delta) {
    const dt = Math.min(delta / 1000, 0.05);
    const start = state.start;
    const end = state.end;
    const startAngle = state.startAngle;
    const endAngle = state.endAngle;
    if (hotRodLoopIdle(state)) {
        snapHotRodTo(state, start, startAngle);
        return state.center;
    }
    if (state.phase === 'wait') {
        state.waitLeft -= dt;
        snapHotRodTo(state, end, endAngle);
        if (state.waitLeft <= 0) {
            beginHotRodStartHold(state);
        }
        return state.center;
    }
    if (state.phase === 'hold') {
        state.waitLeft -= dt;
        snapHotRodTo(state, start, startAngle);
        if (state.waitLeft <= 0) {
            state.phase = 'toEnd';
        }
        return state.center;
    }
    state.target.col = end.col;
    state.target.row = end.row;
    const k = hotRodFollowK(state, delta);
    stepHotRodMotion(state, delta);
    state.params.angle += (endAngle - state.params.angle) * k;
    if (hotRodPoseArrived(state, end, endAngle, 0.6, 1)) {
        snapHotRodTo(state, end, endAngle);
        state.waitLeft = Math.max(0, state.params.delay || 0);
        if (state.waitLeft <= 0) {
            beginHotRodStartHold(state);
        } else {
            state.phase = 'wait';
        }
    }
    return state.center;
}

function createHotRodEmitterState(field, options) {
    const opts = options || {};
    const raw = opts.params || {};
    const params = defaultHotRodEmitterParams(raw);
    const startAngle = clampHotRodParam(
        'angle',
        opts.startAngle != null ? opts.startAngle : (raw.startAngle != null ? raw.startAngle : params.angle)
    );
    const endAngle = clampHotRodParam(
        'angle',
        opts.endAngle != null ? opts.endAngle : (raw.endAngle != null ? raw.endAngle : params.angle)
    );
    params.angle = startAngle;
    const path = defaultHotRodPath(field, startAngle);
    const bounds = { cols: field.cols, rows: field.rows };
    const start = clampHotRodPoint(bounds, copyHotRodPoint(opts.start, path.start));
    const end = clampHotRodPoint(bounds, copyHotRodPoint(opts.end, path.end));
    const rod = {
        kind: 'hot-rod',
        field,
        cols: field.cols,
        rows: field.rows,
        t: opts.t || 0,
        isVisible: opts.isVisible !== false,
        loopOn: opts.loopOn !== false,
        phase: 'toEnd',
        waitLeft: 0,
        start,
        end,
        startAngle,
        endAngle,
        center: copyHotRodPoint(opts.center, start),
        target: copyHotRodPoint(opts.target, end),
        params,
        setParam: (name, value) => {
            if (name === 'startAngle' || name === 'endAngle') {
                const next = clampHotRodParam('angle', value);
                rod[name] = next;
                return next;
            }
            if (!HOT_ROD_EMITTER_SPECS[name]) {
                return params[name];
            }
            params[name] = clampHotRodParam(name, value);
            return params[name];
        },
        nudgeParam: (name, dir) => {
            if (name === 'startAngle' || name === 'endAngle') {
                const spec = HOT_ROD_PARAM_SPECS.angle;
                return rod.setParam(name, rod[name] + dir * spec.step);
            }
            const spec = HOT_ROD_EMITTER_SPECS[name];
            if (!spec) {
                return params[name];
            }
            return rod.setParam(name, params[name] + dir * spec.step);
        },
        setPathPoint: (key, point) => {
            const next = clampHotRodPoint(rod, point);
            if (key === 'start') {
                rod.start.col = next.col;
                rod.start.row = next.row;
            } else {
                rod.end.col = next.col;
                rod.end.row = next.row;
                if (rod.phase !== 'wait') {
                    rod.target.col = next.col;
                    rod.target.row = next.row;
                }
            }
            return next;
        },
        advance: (delta) => {
            rod.t += Math.min(delta / 1000, 0.05);
            if (rod.loopOn) {
                return stepHotRodLoop(rod, delta);
            }
            return stepHotRodMotion(rod, delta);
        },
        retarget: (cell) => retargetHotRod(rod, cell),
        stamp: (grid) => stampHotRodLine(grid, rod.cols, rod.rows, rod.center, rod.params, rod.t)
    };
    return rod;
}

function attachHotRod(scene, x, y, width, height) {
    const cols = Math.max(48, Math.round(width / HOT_ROD_CELL_PX));
    const rows = Math.max(64, Math.round(height / HOT_ROD_CELL_PX));
    const src = new Float32Array(cols * rows);
    const dst = new Float32Array(cols * rows);
    const startCol = (cols - 1) * 0.5;
    const startRow = rows * 0.5;

    if (scene.textures.exists(HOT_ROD_TEX_KEY)) {
        scene.textures.remove(HOT_ROD_TEX_KEY);
    }
    const tex = scene.textures.createCanvas(HOT_ROD_TEX_KEY, cols, rows);
    const ctx = tex.getContext();
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, cols, rows);
    tex.refresh();

    const view = scene.add.image(x + width / 2, y + height / 2, HOT_ROD_TEX_KEY);
    view.setDisplaySize(width, height);

    const imageData = ctx.createImageData(cols, rows);
    paintHotRodHeat(imageData, src, cols, rows);
    ctx.putImageData(imageData, 0, 0);
    tex.refresh();

    const state = {
        kind: 'hot-rod',
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
        t: 0,
        params: defaultHotRodParams(),
        paint: () => {
            paintHotRodHeat(state.imageData, state.src, cols, rows);
            state.ctx.putImageData(state.imageData, 0, 0);
            state.tex.refresh();
        },
        setParam: (name, value) => {
            if (!HOT_ROD_PARAM_SPECS[name]) {
                return state.params[name];
            }
            state.params[name] = clampHotRodParam(name, value);
            return state.params[name];
        },
        nudgeParam: (name, dir) => {
            const spec = HOT_ROD_PARAM_SPECS[name];
            if (!spec) {
                return state.params[name];
            }
            return state.setParam(name, state.params[name] + dir * spec.step);
        },
        update: (_, delta) => {
            state.t += Math.min(delta / 1000, 0.05);
            stepHotRodHeat(state.src, state.dst, cols, rows, delta, state.params);
            const swap = state.src;
            state.src = state.dst;
            state.dst = swap;
            const center = stepHotRodMotion(state, delta);
            stampHotRodLine(state.src, cols, rows, center, state.params, state.t);
            state.paint();
        }
    };

    const hit = scene.add.zone(x, y, width, height).setOrigin(0);
    hit.setInteractive({ useHandCursor: true });
    hit.on('pointerdown', (pointer) => {
        retargetHotRod(state, pointerToHotRodCell(pointer, x, y, width, height, cols, rows));
    });
    state.hit = hit;

    scene.events.once('shutdown', () => {
        if (state.hit) {
            state.hit.destroy();
        }
        if (state.view) {
            state.view.destroy();
        }
        if (scene.textures.exists(HOT_ROD_TEX_KEY)) {
            scene.textures.remove(HOT_ROD_TEX_KEY);
        }
    });

    return state;
}
