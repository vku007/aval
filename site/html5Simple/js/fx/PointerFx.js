/**
 * Hot triangle for UiPointer.
 * Width, height, angle, skew, shape, and heat ease FROM → TO the same way a
 * shard does. SHAPE fills the triangle. HEAT is the glisten bands.
 * Three bands each run from one side to the opposite corner:
 * apex from the base upward, left from the right side to the left corner,
 * right from the left side to the right corner. A band with its flag off
 * does not stamp and does not advance.
 */
const POINTER_FIELD_SPECS = {
    speed: { min: 0.2, max: 8, step: 0.2 },
    delay: { min: 0, max: 4, step: 0.1 },
    gap: { min: 0, max: 4, step: 0.1 },
    glistenSpeed: { min: 0.2, max: 8, step: 0.2 },
    glistenDelay: { min: 0, max: 4, step: 0.1 }
};

const POINTER_POSE_PROPS = ['width', 'height', 'angle', 'skew', 'shapeHeat', 'heat'];

const POINTER_POSE_KEYS = {
    fromWidth: { group: 'from', prop: 'width' },
    fromHeight: { group: 'from', prop: 'height' },
    fromAngle: { group: 'from', prop: 'angle' },
    fromSkew: { group: 'from', prop: 'skew' },
    fromShapeHeat: { group: 'from', prop: 'shapeHeat' },
    fromHeat: { group: 'from', prop: 'heat' },
    toWidth: { group: 'to', prop: 'width' },
    toHeight: { group: 'to', prop: 'height' },
    toAngle: { group: 'to', prop: 'angle' },
    toSkew: { group: 'to', prop: 'skew' },
    toShapeHeat: { group: 'to', prop: 'shapeHeat' },
    toHeat: { group: 'to', prop: 'heat' }
};

function defaultPointerPose(which) {
    if (which === 'to') {
        return { width: 72, height: 120, angle: 16, skew: 0, heat: 1.7, shapeHeat: 0.35 };
    }
    return { width: 40, height: 72, angle: -16, skew: 0, heat: 0.55, shapeHeat: 0.18 };
}

function mergePointerPose(base, extra) {
    const pose = copyBackHighlightPose(base);
    delete pose.glisten;
    const raw = extra || {};
    POINTER_POSE_PROPS.forEach((key) => {
        if (raw[key] != null) {
            pose[key] = clampBackHighlightSpec(BACK_HIGHLIGHT_POSE_SPECS, key, raw[key]);
        }
    });
    return pose;
}

function pointerGlistenState(id, on, phase, params) {
    return {
        id: id,
        on: on !== false,
        glisten: phase,
        glistenPhase: 'run',
        glistenWait: 0,
        params: params
    };
}

function pointerGlistenBand(dist, altitude, phase01) {
    const half = Math.max(0.5, altitude * 0.5);
    const span = Math.max(1, half * 2);
    const sigma = Math.max(0.8, span * 0.14);
    const pad = sigma * 2.4;
    const travel = span + pad * 2;
    const onSide = pad / travel;
    const onCorner = (span + pad) / travel;
    const phase = onSide + phase01 * (onCorner - onSide);
    return backHighlightGlistenBand(dist - half, half, phase);
}

function pointerCross(ax, ay, bx, by) {
    return ax * by - ay * bx;
}

function stampPointerTriangle(grid, cols, rows, center, pose, glistens) {
    const glistenEnergy = Math.max(0, pose.heat || 0);
    const shapeEnergy = Math.max(0, pose.shapeHeat || 0);
    if (glistenEnergy <= 0 && shapeEnergy <= 0) {
        return;
    }
    const hw = Math.max(0.5, pose.width * 0.5);
    const h = Math.max(1, pose.height);
    const ax = 0;
    const ay = -h * 2 / 3;
    const bx = -hw;
    const by = h / 3;
    const cx = hw;
    const cy = h / 3;
    const area = pointerCross(bx - ax, by - ay, cx - ax, cy - ay);
    if (Math.abs(area) < 1e-3) {
        return;
    }
    const edge = BACK_HIGHLIGHT_EDGE;
    const ang = ((pose.angle || 0) * Math.PI) / 180;
    const cosA = Math.cos(ang);
    const sinA = Math.sin(ang);
    const shear = Math.tan(((pose.skew || 0) * Math.PI) / 180);
    const lean = Math.abs(shear) * (h * 2 / 3);
    const reach = Math.hypot(hw + lean, h * 2 / 3) + edge + 1;
    const x0 = Math.max(0, Math.floor(center.col - reach));
    const x1 = Math.min(cols - 1, Math.ceil(center.col + reach));
    const y0 = Math.max(0, Math.floor(center.row - reach));
    const y1 = Math.min(rows - 1, Math.ceil(center.row + reach));
    const span = Math.abs(area);
    const altA = span / Math.max(1e-3, Math.hypot(cx - bx, cy - by));
    const altB = span / Math.max(1e-3, Math.hypot(cx - ax, cy - ay));
    const altC = span / Math.max(1e-3, Math.hypot(bx - ax, by - ay));
    const bands = (glistens || []).map((state) => {
        if (!state || state.on === false || state.glistenPhase === 'gap') {
            return null;
        }
        const phase = Math.max(0, Math.min(100, state.glisten || 0)) / 100;
        if (state.id === 'left') {
            return { phase: phase, alt: altB, which: 'left' };
        }
        if (state.id === 'right') {
            return { phase: phase, alt: altC, which: 'right' };
        }
        return { phase: phase, alt: altA, which: 'apex' };
    }).filter(Boolean);
    for (let y = y0; y <= y1; y++) {
        const dy = y - center.row;
        const base = y * cols;
        for (let x = x0; x <= x1; x++) {
            const dx = x - center.col;
            const u = dx * cosA + dy * sinA;
            const v = -dx * sinA + dy * cosA;
            const along = u - v * shear;
            const b0 = pointerCross(bx - along, by - v, cx - along, cy - v) / area;
            const b1 = pointerCross(cx - along, cy - v, ax - along, ay - v) / area;
            const b2 = pointerCross(ax - along, ay - v, bx - along, by - v) / area;
            const sd = Math.min(b0 * altA, b1 * altB, b2 * altC);
            if (sd < -edge) {
                continue;
            }
            let w = 1;
            if (sd < 0) {
                const fall = -sd / edge;
                w = Math.exp(-fall * fall * 3);
            }
            const i = base + x;
            let heat = shapeEnergy * w;
            bands.forEach((band) => {
                const dist = band.which === 'left' ? b1 * altB : band.which === 'right' ? b2 * altC : b0 * altA;
                const shine = pointerGlistenBand(dist, band.alt, band.phase);
                heat = Math.max(heat, glistenEnergy * w * shine);
            });
            if (heat > grid[i]) {
                grid[i] = Math.min(1, heat);
            }
        }
    }
}

function createPointerEmitterState(field, options) {
    const opts = options || {};
    const raw = opts.params || {};
    const params = {
        speed: clampBackHighlightSpec(POINTER_FIELD_SPECS, 'speed', raw.speed != null ? raw.speed : 1.2),
        delay: clampBackHighlightSpec(POINTER_FIELD_SPECS, 'delay', raw.delay != null ? raw.delay : 0.5),
        gap: clampBackHighlightSpec(POINTER_FIELD_SPECS, 'gap', raw.gap != null ? raw.gap : 0.4),
        glistenSpeed: clampBackHighlightSpec(
            POINTER_FIELD_SPECS,
            'glistenSpeed',
            raw.glistenSpeed != null ? raw.glistenSpeed : 0.7
        ),
        glistenDelay: clampBackHighlightSpec(
            POINTER_FIELD_SPECS,
            'glistenDelay',
            raw.glistenDelay != null ? raw.glistenDelay : 0.25
        )
    };
    const from = mergePointerPose(defaultPointerPose('from'), opts.from);
    const to = mergePointerPose(defaultPointerPose('to'), opts.to);
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
    const glistens = [
        pointerGlistenState('apex', opts.apexOn, 0, params),
        pointerGlistenState('left', opts.leftOn, 33, params),
        pointerGlistenState('right', opts.rightOn, 66, params)
    ];
    const emitter = {
        kind: 'pointer',
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
        glistens,
        glistenById: (id) => glistens.find((state) => state.id === id) || null,
        setParam: (name, value) => {
            if (name === 'cycling') {
                return setBackHighlightCycling(emitter, value);
            }
            const flag = name === 'apexOn' ? 'apex' : name === 'leftOn' ? 'left' : name === 'rightOn' ? 'right' : null;
            if (flag) {
                const state = emitter.glistenById(flag);
                state.on = !!value;
                return state.on;
            }
            const poseKey = POINTER_POSE_KEYS[name];
            if (poseKey) {
                const next = clampBackHighlightSpec(BACK_HIGHLIGHT_POSE_SPECS, poseKey.prop, value);
                emitter[poseKey.group][poseKey.prop] = next;
                return next;
            }
            if (!POINTER_FIELD_SPECS[name]) {
                return params[name];
            }
            params[name] = clampBackHighlightSpec(POINTER_FIELD_SPECS, name, value);
            return params[name];
        },
        nudgeParam: (name, dir) => {
            if (name === 'cycling') {
                return emitter.setParam(name, !emitter.cycling);
            }
            if (name === 'apexOn' || name === 'leftOn' || name === 'rightOn') {
                const state = emitter.glistenById(name.replace(/On$/, ''));
                return emitter.setParam(name, !(state && state.on));
            }
            const poseKey = POINTER_POSE_KEYS[name];
            if (poseKey) {
                const spec = BACK_HIGHLIGHT_POSE_SPECS[poseKey.prop];
                return emitter.setParam(name, emitter[poseKey.group][poseKey.prop] + dir * spec.step);
            }
            const spec = POINTER_FIELD_SPECS[name];
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
            stepBackHighlightPose(emitter, delta);
            emitter.corner.advance(delta);
            return emitter.current;
        },
        stamp: (grid) => {
            const frame = heatFrame(heatNodeOf(emitter));
            if (heatRest(frame)) {
                stampPointerTriangle(grid, emitter.cols, emitter.rows, emitter.center, emitter.current, emitter.glistens);
                return;
            }
            stampPointerTriangle(
                grid,
                emitter.cols,
                emitter.rows,
                heatPlace(frame, emitter.center.col, emitter.center.row),
                heatPresentPose(frame, emitter.current, emitter.from, emitter.to),
                emitter.glistens
            );
        },
        retarget: (cell) => emitter.setCenter(cell)
    };
    emitter.current.glisten = undefined;
    emitter.pose = new PoseCycle(emitter);
    emitter.corner = new CornerGlisten(glistens);
    emitter.loops = [emitter.pose, emitter.corner];
    return emitter;
}
