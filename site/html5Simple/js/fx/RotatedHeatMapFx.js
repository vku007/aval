/**
 * Shared heat field plus orbiting hot-ball emitters.
 * attachRotatedHeatField owns the grid. createRotatedHotBallState stamps into it.
 * attachRotatedHeatMap keeps the old one-field-one-ball sandbox API.
 */
const ROTATED_HEAT_CELL_PX = 3;
const ROTATED_HEAT_DIFFUSION = 9;
const ROTATED_HEAT_COOLING = 0.08;
const ROTATED_HEAT_DOT_RADIUS = 3.4;
const ROTATED_HEAT_DOT_ENERGY = 1.5;
const ROTATED_HEAT_ANGLE_SPEED = 1.6;
const ROTATED_HEAT_ORBIT_RADIUS = 10;
const ROTATED_HEAT_CENTER_FOLLOW = 3.2;
const ROTATED_HEAT_TILT_X_DEG = 30;
const ROTATED_HEAT_TILT_Y_DEG = 0;
const ROTATED_HEAT_TILT_Z_DEG = 0;
const ROTATED_HEAT_TEX_KEY = 'rotated-heatmap-panel';

const ROTATED_HEAT_FIELD_SPECS = {
    diffusion: { min: 0, max: 20, step: 0.5 },
    cooling: { min: 0, max: 4, step: 0.08 },
    viewX: { min: -180, max: 180, step: 5 },
    viewY: { min: -180, max: 180, step: 5 },
    viewZ: { min: -180, max: 180, step: 5 }
};

const ROTATED_HOT_BALL_SPECS = {
    radius: { min: 1, max: 10, step: 0.2 },
    energy: { min: 0.2, max: 3, step: 0.1 },
    angleSpeed: { min: 0, max: 8, step: 0.2 },
    orbitRadius: { min: 1, max: 80, step: 1 },
    tiltX: { min: -180, max: 180, step: 5 },
    tiltY: { min: -180, max: 180, step: 5 },
    tiltZ: { min: -180, max: 180, step: 5 }
};

const ROTATED_HEAT_PARAM_SPECS = Object.assign({}, ROTATED_HEAT_FIELD_SPECS, ROTATED_HOT_BALL_SPECS);

function defaultRotatedHeatFieldParams() {
    return {
        diffusion: ROTATED_HEAT_DIFFUSION,
        cooling: ROTATED_HEAT_COOLING,
        viewX: 0,
        viewY: 0,
        viewZ: 0
    };
}

function defaultRotatedHotBallParams(overrides) {
    return Object.assign({
        radius: ROTATED_HEAT_DOT_RADIUS,
        energy: ROTATED_HEAT_DOT_ENERGY,
        angleSpeed: ROTATED_HEAT_ANGLE_SPEED,
        orbitRadius: ROTATED_HEAT_ORBIT_RADIUS,
        tiltX: ROTATED_HEAT_TILT_X_DEG,
        tiltY: ROTATED_HEAT_TILT_Y_DEG,
        tiltZ: ROTATED_HEAT_TILT_Z_DEG,
        phase: 0
    }, overrides || {});
}

function wrapPhaseDeg(deg) {
    let x = ((Number(deg) % 360) + 360) % 360;
    if (x >= 359.5) {
        return 0;
    }
    return Number(x.toFixed(0));
}

function defaultRotatedHeatParams() {
    return Object.assign(defaultRotatedHeatFieldParams(), defaultRotatedHotBallParams());
}

function clampNamedParam(specs, name, value) {
    const spec = specs[name];
    if (!spec) {
        return value;
    }
    const stepped = Math.round(value / spec.step) * spec.step;
    const clamped = Math.max(spec.min, Math.min(spec.max, stepped));
    const decimals = spec.step < 0.1 ? 2 : spec.step < 1 ? 1 : 0;
    return Number(clamped.toFixed(decimals));
}

function clampRotatedHeatParam(name, value) {
    return clampNamedParam(ROTATED_HEAT_PARAM_SPECS, name, value);
}

function makeParamApi(params, specs) {
    const api = {
        setParam: (name, value) => {
            if (!specs[name]) {
                return params[name];
            }
            params[name] = clampNamedParam(specs, name, value);
            return params[name];
        },
        nudgeParam: (name, dir) => {
            const spec = specs[name];
            if (!spec) {
                return params[name];
            }
            return api.setParam(name, params[name] + dir * spec.step);
        }
    };
    return api;
}

function rotatedHeatRgb(t) {
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

function stampRotatedHotBall(grid, cols, rows, cx, cy, params, depth) {
    const orbitR = Math.max(0.5, params.orbitRadius);
    const depthN = Math.max(-1, Math.min(1, (depth || 0) / orbitR));
    const scale = 1 + 0.24 * depthN;
    const r = Math.max(0.6, params.radius * scale);
    const r2 = r * r;
    const x0 = Math.max(0, Math.floor(cx - r - 1));
    const x1 = Math.min(cols - 1, Math.ceil(cx + r + 1));
    const y0 = Math.max(0, Math.floor(cy - r - 1));
    const y1 = Math.min(rows - 1, Math.ceil(cy + r + 1));
    for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
            const dx = x - cx;
            const dy = y - cy;
            const d2 = dx * dx + dy * dy;
            if (d2 > r2) {
                continue;
            }
            const w = Math.exp(-d2 / (r2 * 0.42));
            const i = y * cols + x;
            grid[i] = Math.min(1, Math.max(grid[i], params.energy * w));
        }
    }
}

function stepRotatedHeat(src, dst, cols, rows, delta, params) {
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

function paintRotatedHeat(imageData, grid, cols, rows) {
    const data = imageData.data;
    for (let i = 0, n = cols * rows; i < n; i++) {
        const rgb = rotatedHeatRgb(grid[i]);
        const p = i * 4;
        data[p] = rgb[0];
        data[p + 1] = rgb[1];
        data[p + 2] = rgb[2];
        data[p + 3] = 255;
    }
}

function pointerToRotatedHeatCell(pointer, x, y, width, height, cols, rows) {
    const localX = Phaser.Math.Clamp(pointer.worldX - x, 0, width);
    const localY = Phaser.Math.Clamp(pointer.worldY - y, 0, height);
    return {
        col: (localX / Math.max(width, 1)) * (cols - 1),
        row: (localY / Math.max(height, 1)) * (rows - 1)
    };
}

function eulerRotatePoint(x, y, z, tiltX, tiltY, tiltZ) {
    const ax = (tiltX || 0) * Math.PI / 180;
    const ay = (tiltY || 0) * Math.PI / 180;
    const az = (tiltZ || 0) * Math.PI / 180;

    const y1 = y * Math.cos(ax) - z * Math.sin(ax);
    const z1 = y * Math.sin(ax) + z * Math.cos(ax);
    const x1 = x;

    const x2 = x1 * Math.cos(ay) + z1 * Math.sin(ay);
    const y2 = y1;
    const z2 = -x1 * Math.sin(ay) + z1 * Math.cos(ay);

    return {
        x: x2 * Math.cos(az) - y2 * Math.sin(az),
        y: x2 * Math.sin(az) + y2 * Math.cos(az),
        z: z2
    };
}

function rotatedOrbitOffset(state, angle) {
    const r = Math.max(0.5, state.params.orbitRadius);
    const local = eulerRotatePoint(
        Math.cos(angle) * r,
        Math.sin(angle) * r,
        0,
        state.params.tiltX,
        state.params.tiltY,
        state.params.tiltZ
    );
    const view = state.field && state.field.params ? state.field.params : {};
    const world = eulerRotatePoint(
        local.x,
        local.y,
        local.z,
        view.viewX,
        view.viewY,
        view.viewZ
    );
    return {
        col: world.x,
        row: world.y,
        depth: world.z
    };
}

function wanderRotatedBall(state) {
    const phase = state.wanderPhase || 0;
    return {
        col: state.cols * 0.5 + state.cols * 0.24 * Math.sin(state.t * 0.92 + phase),
        row: state.rows * 0.5 + state.rows * 0.27 * Math.sin(state.t * 1.18 + 0.9 + phase * 1.3),
        depth: 0
    };
}

function rotatedBallPos(state) {
    if (!state.orbitOn) {
        return wanderRotatedBall(state);
    }
    const off = rotatedOrbitOffset(state, state.angle);
    return {
        col: state.orbitCenter.col + off.col,
        row: state.orbitCenter.row + off.row,
        depth: off.depth
    };
}

function beginOrRetargetRotatedOrbit(state, target) {
    const ball = rotatedBallPos(state);
    if (!state.orbitOn) {
        state.orbitOn = true;
        if (!state.keepPhaseOnOrbit) {
            let ang = Math.atan2(ball.row - target.row, ball.col - target.col);
            if (!Number.isFinite(ang)) {
                ang = 0;
            }
            state.angle = ang;
        }
        const off = rotatedOrbitOffset(state, state.angle);
        state.orbitCenter = {
            col: ball.col - off.col,
            row: ball.row - off.row
        };
    }
    state.orbitTarget = { col: target.col, row: target.row };
}

function stepRotatedMotion(state, delta) {
    state.t += delta / 1000;
    if (state.orbitOn && state.orbitTarget) {
        state.angle += (delta / 1000) * state.params.angleSpeed;
        const k = 1 - Math.exp(-ROTATED_HEAT_CENTER_FOLLOW * (delta / 1000));
        state.orbitCenter.col += (state.orbitTarget.col - state.orbitCenter.col) * k;
        state.orbitCenter.row += (state.orbitTarget.row - state.orbitCenter.row) * k;
    }
    return rotatedBallPos(state);
}

function createRotatedHotBallState(field, options) {
    const opts = options || {};
    const params = defaultRotatedHotBallParams(opts.params);
    const api = makeParamApi(params, ROTATED_HOT_BALL_SPECS);
    const orbitOn = !!opts.orbitOn;
    const centerCol = field.cols * 0.5;
    const centerRow = field.rows * 0.5;
    const ball = {
        field,
        cols: field.cols,
        rows: field.rows,
        t: opts.t || 0,
        wanderPhase: opts.wanderPhase || 0,
        keepPhaseOnOrbit: !!opts.keepPhaseOnOrbit,
        isVisible: opts.isVisible !== false,
        orbitOn,
        orbitCenter: { col: centerCol, row: centerRow },
        orbitTarget: orbitOn ? { col: centerCol, row: centerRow } : null,
        angle: wrapPhaseDeg(params.phase) * Math.PI / 180,
        params,
        setParam: api.setParam,
        nudgeParam: api.nudgeParam,
        position: () => rotatedBallPos(ball),
        advance: (delta) => stepRotatedMotion(ball, delta),
        retarget: (cell) => beginOrRetargetRotatedOrbit(ball, cell)
    };
    return ball;
}

function attachRotatedHeatField(scene, x, y, width, height, options) {
    const texKey = (options && options.texKey) || ROTATED_HEAT_TEX_KEY;
    const cols = Math.max(48, Math.round(width / ROTATED_HEAT_CELL_PX));
    const rows = Math.max(64, Math.round(height / ROTATED_HEAT_CELL_PX));
    const src = new Float32Array(cols * rows);
    const dst = new Float32Array(cols * rows);

    if (scene.textures.exists(texKey)) {
        scene.textures.remove(texKey);
    }
    const tex = scene.textures.createCanvas(texKey, cols, rows);
    const ctx = tex.getContext();
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, cols, rows);
    tex.refresh();

    const view = scene.add.image(x + width / 2, y + height / 2, texKey);
    view.setDisplaySize(width, height);

    const imageData = ctx.createImageData(cols, rows);
    paintRotatedHeat(imageData, src, cols, rows);
    ctx.putImageData(imageData, 0, 0);
    tex.refresh();

    const params = defaultRotatedHeatFieldParams();
    const api = makeParamApi(params, ROTATED_HEAT_FIELD_SPECS);
    const field = {
        kind: 'rotated-heat-field',
        scene,
        x,
        y,
        width,
        height,
        view,
        cols,
        rows,
        src,
        dst,
        tex,
        ctx,
        imageData,
        balls: [],
        rods: [],
        params,
        onTap: (options && options.onTap) || null,
        setParam: api.setParam,
        nudgeParam: api.nudgeParam,
        paint: () => {
            paintRotatedHeat(field.imageData, field.src, cols, rows);
            field.ctx.putImageData(field.imageData, 0, 0);
            field.tex.refresh();
        },
        addBall: (ball) => {
            field.balls.push(ball);
            return ball;
        },
        addRod: (rod) => {
            field.rods.push(rod);
            return rod;
        },
        pointerToCell: (pointer) => pointerToRotatedHeatCell(pointer, x, y, width, height, cols, rows),
        update: (_, delta) => {
            stepRotatedHeat(field.src, field.dst, cols, rows, delta, field.params);
            const swap = field.src;
            field.src = field.dst;
            field.dst = swap;
            field.balls.forEach((ball) => {
                const pos = ball.advance(delta);
                if (ball.isVisible === false) {
                    return;
                }
                stampRotatedHotBall(field.src, cols, rows, pos.col, pos.row, ball.params, pos.depth);
            });
            field.rods.forEach((rod) => {
                rod.advance(delta);
                if (rod.isVisible === false) {
                    return;
                }
                if (typeof rod.stamp === 'function') {
                    rod.stamp(field.src);
                }
            });
            field.paint();
        }
    };

    const hit = scene.add.zone(x, y, width, height).setOrigin(0);
    hit.setInteractive({ useHandCursor: true });
    hit.on('pointerdown', (pointer) => {
        if (typeof field.onTap === 'function') {
            field.onTap(field.pointerToCell(pointer));
        }
    });
    field.hit = hit;

    scene.events.once('shutdown', () => {
        if (field.hit) {
            field.hit.destroy();
        }
        if (field.view) {
            field.view.destroy();
        }
        if (scene.textures.exists(texKey)) {
            scene.textures.remove(texKey);
        }
    });

    return field;
}

function attachRotatedHeatMap(scene, x, y, width, height, options) {
    const field = attachRotatedHeatField(scene, x, y, width, height, options);
    const ball = createRotatedHotBallState(field, options);
    field.addBall(ball);
    field.onTap = (cell) => ball.retarget(cell);

    const params = defaultRotatedHeatParams();
    Object.assign(params, field.params, ball.params);

    return {
        kind: 'rotated-heatmap',
        view: field.view,
        params,
        setParam: (name, value) => {
            const next = ROTATED_HEAT_FIELD_SPECS[name]
                ? field.setParam(name, value)
                : ball.setParam(name, value);
            params[name] = next;
            return next;
        },
        nudgeParam: (name, dir) => {
            const spec = ROTATED_HEAT_PARAM_SPECS[name];
            if (!spec) {
                return params[name];
            }
            return ROTATED_HEAT_FIELD_SPECS[name]
                ? (params[name] = field.setParam(name, params[name] + dir * spec.step))
                : (params[name] = ball.setParam(name, params[name] + dir * spec.step));
        },
        update: (time, delta) => field.update(time, delta)
    };
}
