/**
 * Hot annulus for UiCircle.
 * OUTER and INNER share a center. INNER cannot exceed OUTER.
 * HEAT fills the ring between them. A glisten sweeps around that ring.
 */
const CIRCLE_FIELD_SPECS = {
    speed: { min: 0.2, max: 8, step: 0.2 },
    delay: { min: 0, max: 4, step: 0.1 },
    gap: { min: 0, max: 4, step: 0.1 },
    glistenSpeed: { min: 0.2, max: 8, step: 0.2 },
    glistenDelay: { min: 0, max: 4, step: 0.1 },
    glistenPower: { min: 0, max: 3, step: 0.1 }
};

const CIRCLE_POSE_SPECS = {
    outer: { min: 4, max: 160, step: 2 },
    inner: { min: 0, max: 160, step: 2 },
    heat: { min: 0, max: 3, step: 0.01 }
};

const CIRCLE_POSE_KEYS = {
    fromOuter: { group: 'from', prop: 'outer' },
    fromInner: { group: 'from', prop: 'inner' },
    fromHeat: { group: 'from', prop: 'heat' },
    toOuter: { group: 'to', prop: 'outer' },
    toInner: { group: 'to', prop: 'inner' },
    toHeat: { group: 'to', prop: 'heat' }
};

function defaultCirclePose(which) {
    if (which === 'to') {
        return { width: 0, height: 0, angle: 0, skew: 0, outer: 64, inner: 36, heat: 0.75 };
    }
    return { width: 0, height: 0, angle: 0, skew: 0, outer: 36, inner: 16, heat: 0.4 };
}

function fitCircleRadii(pose) {
    if (pose && pose.inner > pose.outer) {
        pose.inner = pose.outer;
    }
    return pose;
}

function mergeCirclePose(base, extra) {
    const pose = copyBackHighlightPose(base);
    const raw = extra || {};
    Object.keys(CIRCLE_POSE_SPECS).forEach((key) => {
        if (raw[key] != null) {
            pose[key] = clampBackHighlightSpec(CIRCLE_POSE_SPECS, key, raw[key]);
        }
    });
    return fitCircleRadii(pose);
}

function circleGlistenBand(angle, phase01, spin) {
    const center = phase01 * Math.PI * 2 + (spin || 0);
    const turn = angle - center;
    const delta = Math.atan2(Math.sin(turn), Math.cos(turn));
    const sigma = Math.PI * 2 * 0.14;
    return Math.exp(-(delta * delta) / (2 * sigma * sigma));
}

function stampCircle(grid, cols, rows, center, pose, shine) {
    const energy = Math.max(0, pose.heat || 0);
    const outer = Math.max(0.5, pose.outer || 0);
    let inner = Math.max(0, pose.inner || 0);
    if (inner > outer) {
        inner = outer;
    }
    const power = shine && shine.glisten != null ? Math.max(0, shine.power || 0) : 0;
    if (energy <= 0 && power <= 0) {
        return;
    }
    const edge = BACK_HIGHLIGHT_EDGE;
    const reach = outer + edge + 1;
    const x0 = Math.max(0, Math.floor(center.col - reach));
    const x1 = Math.min(cols - 1, Math.ceil(center.col + reach));
    const y0 = Math.max(0, Math.floor(center.row - reach));
    const y1 = Math.min(rows - 1, Math.ceil(center.row + reach));
    const phase = power > 0 ? Math.max(0, Math.min(100, shine.glisten)) / 100 : 0;
    const spin = power > 0 && shine.spin ? shine.spin * Math.PI / 180 : 0;
    for (let y = y0; y <= y1; y++) {
        const dy = y - center.row;
        const base = y * cols;
        for (let x = x0; x <= x1; x++) {
            const dx = x - center.col;
            const radius = Math.hypot(dx, dy);
            const outside = Math.max(0, Math.max(radius - outer, inner - radius));
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
            if (power > 0 && radius > 0.5) {
                const amount = circleGlistenBand(Math.atan2(dy, dx), phase, spin) * w * power;
                if (amount > 0) {
                    grid[i] = Math.min(1, grid[i] + amount * (1 - grid[i]));
                }
            }
        }
    }
}

function createCircleEmitterState(field, options) {
    const opts = options || {};
    const raw = opts.params || {};
    const params = {
        speed: clampBackHighlightSpec(CIRCLE_FIELD_SPECS, 'speed', raw.speed != null ? raw.speed : 1.2),
        delay: clampBackHighlightSpec(CIRCLE_FIELD_SPECS, 'delay', raw.delay != null ? raw.delay : 0.5),
        gap: clampBackHighlightSpec(CIRCLE_FIELD_SPECS, 'gap', raw.gap != null ? raw.gap : 0.4),
        glistenSpeed: clampBackHighlightSpec(
            CIRCLE_FIELD_SPECS,
            'glistenSpeed',
            raw.glistenSpeed != null ? raw.glistenSpeed : 0.8
        ),
        glistenDelay: clampBackHighlightSpec(
            CIRCLE_FIELD_SPECS,
            'glistenDelay',
            raw.glistenDelay != null ? raw.glistenDelay : 0.4
        ),
        glistenPower: clampBackHighlightSpec(
            CIRCLE_FIELD_SPECS,
            'glistenPower',
            raw.glistenPower != null ? raw.glistenPower : 1
        )
    };
    const from = mergeCirclePose(defaultCirclePose('from'), opts.from);
    const to = mergeCirclePose(defaultCirclePose('to'), opts.to);
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
        kind: 'circle',
        field,
        cols: field.cols,
        rows: field.rows,
        isVisible: opts.isVisible !== false,
        cycling: opts.cycling !== false,
        glistenOn: opts.glistenOn !== false,
        glisten: typeof opts.glisten === 'number' ? opts.glisten : 0,
        glistenPhase: opts.glistenPhase === 'gap' ? 'gap' : 'run',
        glistenWait: typeof opts.glistenWait === 'number' ? opts.glistenWait : 0,
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
            if (name === 'glistenOn') {
                emitter.glistenOn = !!value;
                return emitter.glistenOn;
            }
            const poseKey = CIRCLE_POSE_KEYS[name];
            if (poseKey) {
                const next = clampBackHighlightSpec(CIRCLE_POSE_SPECS, poseKey.prop, value);
                emitter[poseKey.group][poseKey.prop] = next;
                fitCircleRadii(emitter[poseKey.group]);
                return emitter[poseKey.group][poseKey.prop];
            }
            if (!CIRCLE_FIELD_SPECS[name]) {
                return params[name];
            }
            params[name] = clampBackHighlightSpec(CIRCLE_FIELD_SPECS, name, value);
            return params[name];
        },
        nudgeParam: (name, dir) => {
            if (name === 'cycling') {
                return emitter.setParam(name, !emitter.cycling);
            }
            if (name === 'glistenOn') {
                return emitter.setParam(name, !emitter.glistenOn);
            }
            const poseKey = CIRCLE_POSE_KEYS[name];
            if (poseKey) {
                const spec = CIRCLE_POSE_SPECS[poseKey.prop];
                return emitter.setParam(name, emitter[poseKey.group][poseKey.prop] + dir * spec.step);
            }
            const spec = CIRCLE_FIELD_SPECS[name];
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
            if (emitter.glistenOn !== false) {
                emitter.glistenLoop.advance(delta);
            }
            return emitter.current;
        },
        stamp: (grid) => {
            const frame = heatFrame(heatNodeOf(emitter));
            const resting = heatRest(frame);
            const pose = resting
                ? emitter.current
                : heatPresentPose(frame, emitter.current, emitter.from, emitter.to);
            const at = resting
                ? emitter.center
                : heatPlace(frame, emitter.center.col, emitter.center.row);
            const gain = frame.own['glisten.gain'] == null ? 1 : frame.own['glisten.gain'];
            const power = heatMul(heatHeat(frame, emitter.params.glistenPower), gain);
            const spin = resting ? 0 : (frame.own.rotate || 0) + (frame.group ? frame.group.rotate || 0 : 0);
            const sweeping = emitter.glistenOn !== false && emitter.glistenPhase !== 'gap';
            stampCircle(grid, emitter.cols, emitter.rows, at, pose, {
                glisten: sweeping ? emitter.glisten : null,
                power: power,
                spin: spin
            });
        },
        retarget: (cell) => emitter.setCenter(cell)
    };
    emitter.pose = new PoseCycle(emitter);
    emitter.glistenLoop = new Glisten(emitter);
    emitter.loops = [emitter.pose, emitter.glistenLoop];
    return emitter;
}
