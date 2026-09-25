/**
 * Sheet hot map for SheetScene.
 * Heat is the back-highlight / shard parallelogram: width, height, angle,
 * skew, and heat ease FROM → TO on SPEED, pause DELAY, then cycle or snap
 * back through GAP.
 * Glisten is a separate bright band on that same shape. It sweeps left to
 * right on GL SPEED, pauses GL DELAY, and repeats. It is not a FROM/TO pose.
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
    glistenDelay: { min: 0, max: 4, step: 0.1 }
};

function defaultSheetField() {
    return {
        diffusion: 9,
        cooling: 1.6,
        speed: 1.2,
        delay: 0.5,
        gap: 0.4,
        glistenSpeed: 0.4,
        glistenDelay: 0.4
    };
}

function defaultSheetPose(which) {
    if (which === 'to') {
        return { width: 140, height: 48, angle: 18, skew: 40, heat: 0.6 };
    }
    return { width: 36, height: 16, angle: -18, skew: 0, heat: 0.4 };
}

function sheetHeatPose(pose) {
    return {
        width: pose.width,
        height: pose.height,
        angle: pose.angle,
        skew: pose.skew || 0,
        heat: pose.heat
    };
}

function stepSheetGlisten(state, delta) {
    const dt = Math.min(delta / 1000, 0.05);
    if (state.glistenPhase === 'gap') {
        state.glisten = 0;
        state.glistenWait -= dt;
        if (state.glistenWait <= 0) {
            state.glistenPhase = 'run';
        }
        return;
    }
    const speed = Math.max(0.2, state.params.glistenSpeed || 0.4);
    state.glisten += speed * 100 * dt;
    if (state.glisten < 100) {
        return;
    }
    state.glisten = 0;
    const gap = Math.max(0, state.params.glistenDelay || 0);
    if (gap > 0) {
        state.glistenPhase = 'gap';
        state.glistenWait = gap;
    }
}

function stepSheetPose(state, delta) {
    const pose = stepBackHighlightPose(state, delta);
    stepSheetGlisten(state, delta);
    return pose;
}

function stampSheetGlisten(grid, cols, rows, center, pose, glisten) {
    const hw = Math.max(0.5, pose.width * 0.5);
    const hh = Math.max(0.5, pose.height * 0.5);
    const edge = BACK_HIGHLIGHT_EDGE;
    const ang = ((pose.angle || 0) * Math.PI) / 180;
    const cosA = Math.cos(ang);
    const sinA = Math.sin(ang);
    const shear = Math.tan(((pose.skew || 0) * Math.PI) / 180);
    const lean = Math.abs(shear) * hh;
    const phase = Math.max(0, Math.min(100, glisten)) / 100;
    const reach = Math.hypot(hw + lean, hh) + edge + 1;
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
            const along = u - v * shear;
            const ou = Math.max(0, Math.abs(along) - hw);
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
            const shine = backHighlightGlistenBand(along, hw, phase) * w;
            if (shine <= 0) {
                continue;
            }
            const i = base + x;
            grid[i] = Math.min(1, grid[i] + shine * (1 - grid[i]));
        }
    }
}

function stampSheet(grid, cols, rows, center, pose, glisten) {
    const heatPose = sheetHeatPose(pose);
    stampBackHighlightRect(grid, cols, rows, center, heatPose);
    if (glisten == null) {
        return;
    }
    stampSheetGlisten(grid, cols, rows, center, heatPose, glisten);
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
        center: { col: startCol, row: startRow },
        target: { col: startCol, row: startRow },
        from,
        to,
        current: sheetHeatPose(from),
        phase: 'toEnd',
        waitLeft: 0,
        cycling: true,
        glisten: 0,
        glistenPhase: 'run',
        glistenWait: 0,
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
            if (group === 'from' || group === 'to') {
                if (name === 'glisten' || !BACK_HIGHLIGHT_POSE_SPECS[name]) {
                    return state[group][name];
                }
                state[group][name] = clampBackHighlightSpec(BACK_HIGHLIGHT_POSE_SPECS, name, value);
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
            const specs = group === 'field' ? SHEET_FIELD_SPECS : BACK_HIGHLIGHT_POSE_SPECS;
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
            const pose = stepSheetPose(state, delta);
            stampSheet(state.src, cols, rows, state.center, pose, state.glisten);
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
