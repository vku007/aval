/**
 * Filled hot disk for UiRound.
 * RADIUS and HEAT ease FROM → TO the same way a back highlight eases
 * its rectangle. The disk is round: radius is the only size.
 */
const ROUND_FIELD_SPECS = {
    speed: { min: 0.2, max: 8, step: 0.2 },
    delay: { min: 0, max: 4, step: 0.1 },
    gap: { min: 0, max: 4, step: 0.1 }
};

const ROUND_POSE_SPECS = {
    radius: { min: 4, max: 160, step: 2 },
    heat: { min: 0, max: 3, step: 0.01 }
};

const ROUND_POSE_KEYS = {
    fromRadius: { group: 'from', prop: 'radius' },
    fromHeat: { group: 'from', prop: 'heat' },
    toRadius: { group: 'to', prop: 'radius' },
    toHeat: { group: 'to', prop: 'heat' }
};

function defaultRoundPose(which) {
    if (which === 'to') {
        return { width: 0, height: 0, angle: 0, skew: 0, radius: 56, heat: 1.8 };
    }
    return { width: 0, height: 0, angle: 0, skew: 0, radius: 18, heat: 0.45 };
}

function mergeRoundPose(base, extra) {
    const pose = copyBackHighlightPose(base);
    const raw = extra || {};
    Object.keys(ROUND_POSE_SPECS).forEach((key) => {
        if (raw[key] != null) {
            pose[key] = clampBackHighlightSpec(ROUND_POSE_SPECS, key, raw[key]);
        }
    });
    return pose;
}

function stampRoundDisk(grid, cols, rows, center, pose) {
    const energy = Math.max(0, pose.heat || 0);
    if (energy <= 0) {
        return;
    }
    const radius = Math.max(0.5, pose.radius || 0);
    const edge = BACK_HIGHLIGHT_EDGE;
    const reach = radius + edge + 1;
    const x0 = Math.max(0, Math.floor(center.col - reach));
    const x1 = Math.min(cols - 1, Math.ceil(center.col + reach));
    const y0 = Math.max(0, Math.floor(center.row - reach));
    const y1 = Math.min(rows - 1, Math.ceil(center.row + reach));
    for (let y = y0; y <= y1; y++) {
        const dy = y - center.row;
        const base = y * cols;
        for (let x = x0; x <= x1; x++) {
            const dx = x - center.col;
            const d2 = dx * dx + dy * dy;
            const reach = radius + edge + 1;
            if (d2 > reach * reach) {
                continue;
            }
            let w = 1;
            const inner = radius > 1 ? radius - 1 : 0;
            if (!(inner > 0) || d2 >= inner * inner) {
                const outside = Math.max(0, Math.hypot(dx, dy) - radius);
                if (outside > edge) {
                    continue;
                }
                if (outside > 0) {
                    const fall = outside / edge;
                    w = Math.exp(-fall * fall * 3);
                }
            }
            const heat = energy * w;
            if (heat <= 0) {
                continue;
            }
            const i = base + x;
            if (heat > grid[i]) {
                grid[i] = Math.min(1, heat);
            }
        }
    }
}

function createRoundEmitterState(field, options) {
    const opts = options || {};
    const raw = opts.params || {};
    const params = {
        speed: clampBackHighlightSpec(ROUND_FIELD_SPECS, 'speed', raw.speed != null ? raw.speed : 1.2),
        delay: clampBackHighlightSpec(ROUND_FIELD_SPECS, 'delay', raw.delay != null ? raw.delay : 0.5),
        gap: clampBackHighlightSpec(ROUND_FIELD_SPECS, 'gap', raw.gap != null ? raw.gap : 0.4)
    };
    const from = mergeRoundPose(defaultRoundPose('from'), opts.from);
    const to = mergeRoundPose(defaultRoundPose('to'), opts.to);
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
        kind: 'round',
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
            const poseKey = ROUND_POSE_KEYS[name];
            if (poseKey) {
                const next = clampBackHighlightSpec(ROUND_POSE_SPECS, poseKey.prop, value);
                emitter[poseKey.group][poseKey.prop] = next;
                return next;
            }
            if (!ROUND_FIELD_SPECS[name]) {
                return params[name];
            }
            params[name] = clampBackHighlightSpec(ROUND_FIELD_SPECS, name, value);
            return params[name];
        },
        nudgeParam: (name, dir) => {
            if (name === 'cycling') {
                return emitter.setParam(name, !emitter.cycling);
            }
            const poseKey = ROUND_POSE_KEYS[name];
            if (poseKey) {
                const spec = ROUND_POSE_SPECS[poseKey.prop];
                return emitter.setParam(name, emitter[poseKey.group][poseKey.prop] + dir * spec.step);
            }
            const spec = ROUND_FIELD_SPECS[name];
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
        stamp: (grid) => {
            const frame = heatFrame(heatNodeOf(emitter));
            if (heatRest(frame)) {
                stampRoundDisk(grid, emitter.cols, emitter.rows, emitter.center, emitter.current);
                return;
            }
            stampRoundDisk(
                grid,
                emitter.cols,
                emitter.rows,
                heatPlace(frame, emitter.center.col, emitter.center.row),
                heatPresentPose(frame, emitter.current, emitter.from, emitter.to)
            );
        },
        retarget: (cell) => emitter.setCenter(cell)
    };
    emitter.pose = new PoseCycle(emitter);
    emitter.loops = [emitter.pose];
    return emitter;
}
