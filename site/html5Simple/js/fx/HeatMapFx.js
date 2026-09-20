/**
 * Click-to-heat field for HotMapBallScene.
 * Panel starts black. Taps drop a hot dot; heat diffuses into neighbors
 * and brightness follows temperature (black → red → yellow → white).
 */
const HEAT_CELL_PX = 3;
const HEAT_DIFFUSION = 9;
const HEAT_COOLING = 0.08;
const HEAT_DOT_RADIUS = 3.4;
const HEAT_DOT_ENERGY = 1.5;
const HEAT_TEX_KEY = 'heatmap-panel';

const HEAT_PARAM_SPECS = {
    diffusion: { min: 0, max: 20, step: 0.5 },
    cooling: { min: 0, max: 4, step: 0.08 },
    radius: { min: 1, max: 10, step: 0.2 },
    energy: { min: 0.2, max: 3, step: 0.1 }
};

function defaultHeatParams() {
    return {
        diffusion: HEAT_DIFFUSION,
        cooling: HEAT_COOLING,
        radius: HEAT_DOT_RADIUS,
        energy: HEAT_DOT_ENERGY
    };
}

function clampHeatParam(name, value) {
    const spec = HEAT_PARAM_SPECS[name];
    if (!spec) {
        return value;
    }
    const stepped = Math.round(value / spec.step) * spec.step;
    const clamped = Math.max(spec.min, Math.min(spec.max, stepped));
    const decimals = spec.step < 0.1 ? 2 : 1;
    return Number(clamped.toFixed(decimals));
}

function heatRgb(t) {
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

function addHotDot(grid, cols, rows, cx, cy, params) {
    const r = params.radius;
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
            grid[i] = Math.min(1, grid[i] + params.energy * w);
        }
    }
}

function stepHeat(src, dst, cols, rows, delta, params) {
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

function paintHeat(imageData, grid, cols, rows) {
    const data = imageData.data;
    for (let i = 0, n = cols * rows; i < n; i++) {
        const rgb = heatRgb(grid[i]);
        const p = i * 4;
        data[p] = rgb[0];
        data[p + 1] = rgb[1];
        data[p + 2] = rgb[2];
        data[p + 3] = 255;
    }
}

function pointerToHeatCell(pointer, x, y, width, height, cols, rows) {
    const localX = Phaser.Math.Clamp(pointer.worldX - x, 0, width);
    const localY = Phaser.Math.Clamp(pointer.worldY - y, 0, height);
    return {
        col: (localX / Math.max(width, 1)) * (cols - 1),
        row: (localY / Math.max(height, 1)) * (rows - 1)
    };
}

function attachHeatMap(scene, x, y, width, height) {
    const cols = Math.max(48, Math.round(width / HEAT_CELL_PX));
    const rows = Math.max(64, Math.round(height / HEAT_CELL_PX));
    const src = new Float32Array(cols * rows);
    const dst = new Float32Array(cols * rows);

    if (scene.textures.exists(HEAT_TEX_KEY)) {
        scene.textures.remove(HEAT_TEX_KEY);
    }
    const tex = scene.textures.createCanvas(HEAT_TEX_KEY, cols, rows);
    const ctx = tex.getContext();
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, cols, rows);
    tex.refresh();

    const view = scene.add.image(x + width / 2, y + height / 2, HEAT_TEX_KEY);
    view.setDisplaySize(width, height);

    const imageData = ctx.createImageData(cols, rows);
    paintHeat(imageData, src, cols, rows);
    ctx.putImageData(imageData, 0, 0);
    tex.refresh();

    const state = {
        kind: 'heatmap',
        view,
        cols,
        rows,
        src,
        dst,
        tex,
        ctx,
        imageData,
        params: defaultHeatParams(),
        paint: () => {
            paintHeat(state.imageData, state.src, cols, rows);
            state.ctx.putImageData(state.imageData, 0, 0);
            state.tex.refresh();
        },
        dropDot: (pointer) => {
            const cell = pointerToHeatCell(pointer, x, y, width, height, cols, rows);
            addHotDot(state.src, cols, rows, cell.col, cell.row, state.params);
            state.paint();
        },
        setParam: (name, value) => {
            if (!HEAT_PARAM_SPECS[name]) {
                return state.params[name];
            }
            state.params[name] = clampHeatParam(name, value);
            return state.params[name];
        },
        nudgeParam: (name, dir) => {
            const spec = HEAT_PARAM_SPECS[name];
            if (!spec) {
                return state.params[name];
            }
            return state.setParam(name, state.params[name] + dir * spec.step);
        },
        update: (_, delta) => {
            stepHeat(state.src, state.dst, cols, rows, delta, state.params);
            const swap = state.src;
            state.src = state.dst;
            state.dst = swap;
            state.paint();
        }
    };

    const hit = scene.add.zone(x, y, width, height).setOrigin(0);
    hit.setInteractive({ useHandCursor: true });
    hit.on('pointerdown', (pointer) => state.dropDot(pointer));
    state.hit = hit;

    scene.events.once('shutdown', () => {
        if (state.hit) {
            state.hit.destroy();
        }
        if (state.view) {
            state.view.destroy();
        }
        if (scene.textures.exists(HEAT_TEX_KEY)) {
            scene.textures.remove(HEAT_TEX_KEY);
        }
    });

    return state;
}
