/**
 * Sheet hot map for SheetScene.
 * Heat is a ribbon eased FROM → TO on SPEED, pause DELAY, then cycle or snap
 * back through GAP. Its centerline is cos from 0 to 2π. BEND is the wave
 * height. WIDTH is the length of that turn, HEIGHT the thickness. The wave
 * stays horizontal. PHASE shifts the cosine, and SKEW leans the
 * cross-section. PHASE eases FROM → TO with the other pose values.
 * Glisten is a hot band that sweeps along the same curve on GL SPEED,
 * pauses GL DELAY, and repeats. GL POWER sets how much heat that band
 * stamps into the field.
 * Two hot balls follow that centerline and repeat. One sits DELTA cells
 * below and runs start to end. The other sits DELTA cells above and runs
 * end to start. DOT SIZE and DOT HEAT match a hot ball.
 */
const SHEET_CELL_PX = 3;
const SHEET_TEX_KEY = 'sheet-panel';

const SHEET_FIELD_SPECS = {
    diffusion: { min: 0, max: 20, step: 0.5 },
    cooling: { min: 0, max: 4, step: 0.08 },
    speed: { min: 0.2, max: 8, step: 0.2 },
    delay: { min: 0, max: 4, step: 0.1 },
    gap: { min: 0, max: 4, step: 0.1 },
    glistenSpeed: { min: 0.2, max: 8, step: 0.2 },
    glistenDelay: { min: 0, max: 4, step: 0.1 },
    glistenPower: { min: 0, max: 3, step: 0.1 }
};

const SHEET_BALL_SPECS = {
    radius: { min: 1, max: 10, step: 0.2 },
    energy: { min: 0.2, max: 3, step: 0.1 },
    ballSpeed: { min: 0, max: 2, step: 0.05 },
    ballDelta: { min: 0, max: 40, step: 1 }
};

function defaultSheetField() {
    return {
        diffusion: 9,
        cooling: 1.6,
        speed: 1.2,
        delay: 0.5,
        gap: 0.4,
        glistenSpeed: 0.4,
        glistenDelay: 0.4,
        glistenPower: 1,
        radius: HEAT_DOT_RADIUS,
        energy: HEAT_DOT_ENERGY,
        ballSpeed: 0.35,
        ballDelta: 8
    };
}

const SHEET_POSE_SPECS = Object.assign({
    bend: { min: 0, max: 80, step: 2 },
    cosine: { min: -360, max: 360, step: 15 }
}, BACK_HIGHLIGHT_POSE_SPECS);
delete SHEET_POSE_SPECS.angle;

function defaultSheetPose(which) {
    if (which === 'to') {
        return { width: 150, height: 16, angle: 0, skew: 0, heat: 0.6, bend: 26, cosine: 180 };
    }
    return { width: 120, height: 12, angle: 0, skew: 0, heat: 0.45, bend: 16, cosine: 0 };
}

function sheetHeatPose(pose) {
    return {
        width: pose.width,
        height: pose.height,
        angle: 0,
        skew: pose.skew || 0,
        heat: pose.heat,
        bend: pose.bend || 0,
        cosine: pose.cosine || 0
    };
}

function stepSheetGlisten(state, delta) {
    let dt = Math.min(Math.max(0, delta) / 1000, 0.05);
    const speed = Math.max(0.2, state.params.glistenSpeed || 0.4);
    const rate = speed * 100;
    if (state.glistenPhase === 'gap') {
        state.glistenWait -= dt;
        if (state.glistenWait > 0) {
            return;
        }
        dt = -state.glistenWait;
        state.glistenWait = 0;
        state.glisten = 0;
        state.glistenPhase = 'run';
    }
    let dist = rate * dt;
    const gap = Math.max(0, state.params.glistenDelay || 0);
    while (dist > 0) {
        if (state.glisten >= 100) {
            state.glisten = 0;
        }
        const room = 100 - state.glisten;
        if (dist < room) {
            state.glisten += dist;
            return;
        }
        dist -= room;
        state.glisten = 0;
        if (gap <= 0) {
            continue;
        }
        const gapDist = gap * rate;
        if (dist < gapDist) {
            state.glistenPhase = 'gap';
            state.glistenWait = gap - dist / rate;
            return;
        }
        dist -= gapDist;
    }
}

function setSheetGlistenOn(state, value) {
    state.glistenOn = !!value;
    return state.glistenOn;
}

function sheetCenterPoint(pose, center, progress) {
    const hw = Math.max(0.5, pose.width * 0.5);
    const amp = Math.max(0, pose.bend || 0);
    const t = Math.max(0, Math.min(1, progress));
    const theta = t * Math.PI * 2;
    const wave = theta + ((pose.cosine || 0) * Math.PI) / 180;
    const along = -hw + t * hw * 2;
    const ly = amp * Math.cos(wave);
    return {
        col: center.col + along,
        row: center.row + ly
    };
}

function stepSheetBall(state, delta) {
    const dt = Math.min(Math.max(0, delta) / 1000, 0.05);
    const speed = Math.max(0, state.params.ballSpeed || 0);
    if (speed <= 0) {
        return;
    }
    state.ball = (state.ball + speed * dt) % 1;
}

function stampSheetBall(grid, cols, rows, center, pose, state) {
    const delta = state.params.ballDelta || 0;
    const dot = {
        radius: state.params.radius,
        energy: state.params.energy
    };
    const lower = sheetCenterPoint(pose, center, state.ball);
    const upperProgress = state.ball <= 0 ? 1 : 1 - state.ball;
    const upper = sheetCenterPoint(pose, center, upperProgress);
    addHotDot(grid, cols, rows, lower.col, lower.row + delta, dot);
    addHotDot(grid, cols, rows, upper.col, upper.row - delta, dot);
}

function stepSheetPose(state, delta) {
    const pose = stepBackHighlightPose(state, delta);
    if (state.glistenOn !== false) {
        stepSheetGlisten(state, delta);
    }
    return pose;
}

function forEachSheetSample(pose, center, cols, rows, visit) {
    const hw = Math.max(0.5, pose.width * 0.5);
    const hh = Math.max(0.5, pose.height * 0.5);
    const amp = Math.max(0, pose.bend || 0);
    const edge = BACK_HIGHLIGHT_EDGE;
    const shear = Math.tan(((pose.skew || 0) * Math.PI) / 180);
    const dXdTheta = hw / Math.PI;
    const thetaSteps = Math.max(32, Math.ceil(Math.hypot(dXdTheta, amp) * Math.PI * 2 / 0.35));
    const vSteps = Math.max(4, Math.ceil((hh + edge) * 2 / 0.35));
    const span = hh + edge;
    for (let i = 0; i <= thetaSteps; i++) {
        const theta = (i / thetaSteps) * Math.PI * 2;
        const wave = theta + ((pose.cosine || 0) * Math.PI) / 180;
        const along = -hw + (theta / (Math.PI * 2)) * hw * 2;
        const cy = amp * Math.cos(wave);
        const dy = -amp * Math.sin(wave);
        const len = Math.hypot(dXdTheta, dy) || 1;
        const tx = dXdTheta / len;
        const ty = dy / len;
        const nx = -ty;
        const ny = tx;
        for (let j = 0; j <= vSteps; j++) {
            const v = -span + (j / vSteps) * span * 2;
            const outside = Math.max(0, Math.abs(v) - hh);
            if (outside > edge) {
                continue;
            }
            let w = 1;
            if (outside > 0) {
                const fall = outside / edge;
                w = Math.exp(-fall * fall * 3);
            }
            const shift = v * shear;
            const lx = along + tx * shift + nx * v;
            const ly = cy + ty * shift + ny * v;
            const col = center.col + lx;
            const row = center.row + ly;
            const x = Math.round(col);
            const y = Math.round(row);
            if (x < 0 || y < 0 || x >= cols || y >= rows) {
                continue;
            }
            visit(y * cols + x, along, w);
        }
    }
}

function stampSheetGlisten(grid, shine, cols, rows, center, pose, glisten, power) {
    if (glisten == null || !pose) {
        return;
    }
    const heat = Math.max(0, power || 0);
    if (heat <= 0) {
        return;
    }
    shine.fill(0);
    const hw = Math.max(0.5, pose.width * 0.5);
    const t = Math.max(0, Math.min(100, glisten)) / 100;
    const phase = -0.2 + t * 1.4;
    forEachSheetSample(pose, center, cols, rows, (index, along, w) => {
        const band = backHighlightGlistenBand(along, hw, phase) * w;
        if (band > shine[index]) {
            shine[index] = band;
        }
    });
    for (let i = 0; i < shine.length; i++) {
        const amount = shine[i] * heat;
        if (amount <= 0) {
            continue;
        }
        grid[i] = Math.min(1, grid[i] + amount * (1 - grid[i]));
    }
}

function stampSheet(grid, cols, rows, center, pose) {
    const energy = Math.max(0, pose.heat || 0);
    if (energy <= 0) {
        return;
    }
    forEachSheetSample(pose, center, cols, rows, (index, along, w) => {
        const heat = Math.min(1, energy * w);
        if (heat > grid[index]) {
            grid[index] = heat;
        }
    });
}

function attachSheet(scene, x, y, width, height) {
    const cols = Math.max(48, Math.round(width / SHEET_CELL_PX));
    const rows = Math.max(48, Math.round(height / SHEET_CELL_PX));
    const src = new Float32Array(cols * rows);
    const dst = new Float32Array(cols * rows);
    const startCol = (cols - 1) * 0.5;
    const startRow = (rows - 1) * 0.5;

    if (scene.textures.exists(SHEET_TEX_KEY)) {
        scene.textures.remove(SHEET_TEX_KEY);
    }
    const tex = scene.textures.createCanvas(SHEET_TEX_KEY, cols, rows);
    const ctx = tex.getContext();
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, cols, rows);
    tex.refresh();

    const view = scene.add.image(x + width / 2, y + height / 2, SHEET_TEX_KEY);
    view.setDisplaySize(width, height);
    const imageData = ctx.createImageData(cols, rows);
    const params = defaultSheetField();
    const from = defaultSheetPose('from');
    const to = defaultSheetPose('to');

    const state = {
        kind: 'sheet',
        view,
        cols,
        rows,
        src,
        dst,
        tex,
        ctx,
        imageData,
        shine: new Float32Array(cols * rows),
        center: { col: startCol, row: startRow },
        target: { col: startCol, row: startRow },
        from,
        to,
        current: sheetHeatPose(from),
        phase: 'toEnd',
        waitLeft: 0,
        cycling: true,
        glistenOn: true,
        glisten: 0,
        glistenPhase: 'run',
        glistenWait: 0,
        ball: 0,
        params,
        paint: () => {
            paintHotRodHeat(state.imageData, state.src, cols, rows);
            state.ctx.putImageData(state.imageData, 0, 0);
            state.tex.refresh();
        },
        setParam: (group, name, value) => {
            if (group === 'field' && name === 'cycling') {
                return setBackHighlightCycling(state, value);
            }
            if (group === 'field' && name === 'glistenOn') {
                return setSheetGlistenOn(state, value);
            }
            if (group === 'ball') {
                if (!SHEET_BALL_SPECS[name]) {
                    return state.params[name];
                }
                state.params[name] = clampBackHighlightSpec(SHEET_BALL_SPECS, name, value);
                return state.params[name];
            }
            if (group === 'from' || group === 'to') {
                if (name === 'glisten' || !SHEET_POSE_SPECS[name]) {
                    return state[group][name];
                }
                state[group][name] = clampBackHighlightSpec(SHEET_POSE_SPECS, name, value);
                return state[group][name];
            }
            if (!SHEET_FIELD_SPECS[name]) {
                return state.params[name];
            }
            state.params[name] = clampBackHighlightSpec(SHEET_FIELD_SPECS, name, value);
            return state.params[name];
        },
        nudgeParam: (group, name, dir) => {
            if (group === 'field' && name === 'cycling') {
                return state.setParam(group, name, !state.cycling);
            }
            if (group === 'field' && name === 'glistenOn') {
                return state.setParam(group, name, !state.glistenOn);
            }
            const specs = group === 'field' ? SHEET_FIELD_SPECS : group === 'ball' ? SHEET_BALL_SPECS : SHEET_POSE_SPECS;
            const spec = specs[name];
            const bucket = group === 'from' || group === 'to' ? state[group] : state.params;
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
            const pose = stepSheetPose(state, delta);
            stepSheetBall(state, delta);
            stampSheet(state.src, cols, rows, state.center, pose);
            stampSheetBall(state.src, cols, rows, state.center, pose, state);
            if (state.glistenOn !== false && state.glistenPhase !== 'gap') {
                stampSheetGlisten(state.src, state.shine, cols, rows, state.center, pose, state.glisten, state.params.glistenPower);
            }
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
        if (scene.textures.exists(SHEET_TEX_KEY)) {
            scene.textures.remove(SHEET_TEX_KEY);
        }
    });

    return state;
}
