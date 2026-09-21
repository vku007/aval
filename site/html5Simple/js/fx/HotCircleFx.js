/**
 * Hot circle (ring) for MoveHotCircleScene.
 * Circle sits in a plane; GEO Euler tilts (X/Y/Z) rotate that plane (Rx→Ry→Rz).
 * Wind is a mean flow plus curl-noise eddies, drifting vortices, and a uniform X scroll.
 */
const HOT_CIRCLE_CELL_PX = 3;
const HOT_CIRCLE_DIFFUSION = 9;
const HOT_CIRCLE_COOLING = 0.08;
const HOT_CIRCLE_THICKNESS = 4;
const HOT_CIRCLE_RADIUS = 22;
const HOT_CIRCLE_ENERGY = 1.5;
const HOT_CIRCLE_FOLLOW = 3.2;
const HOT_CIRCLE_NOISE = 0.7;
const HOT_CIRCLE_GRAIN = 4;
const HOT_CIRCLE_FLICKER = 1.6;
const HOT_CIRCLE_TILT_X_DEG = 0;
const HOT_CIRCLE_TILT_Y_DEG = 0;
const HOT_CIRCLE_TILT_Z_DEG = 0;
const HOT_CIRCLE_WIND_FORCE = 16;
const HOT_CIRCLE_WIND_DIR = 0;
const HOT_CIRCLE_WIND_GUST = 1.8;
const HOT_CIRCLE_WIND_SPEED = 10;
const HOT_CIRCLE_TEX_KEY = 'hot-circle-panel';

const HOT_CIRCLE_PARAM_SPECS = {
    diffusion: { min: 0, max: 20, step: 0.5 },
    cooling: { min: 0, max: 4, step: 0.08 },
    thickness: { min: 1, max: 24, step: 0.5 },
    radius: { min: 4, max: 60, step: 1 },
    energy: { min: 0.2, max: 3, step: 0.1 },
    followSpeed: { min: 0.4, max: 12, step: 0.4 },
    tiltX: { min: 0, max: 80, step: 5 },
    tiltY: { min: 0, max: 80, step: 5 },
    tiltZ: { min: 0, max: 180, step: 5 },
    noiseAmt: { min: 0, max: 1.5, step: 0.1 },
    noiseGrain: { min: 0.5, max: 12, step: 0.5 },
    noiseFlicker: { min: 0, max: 8, step: 0.2 },
    windForce: { min: 0, max: 80, step: 1 },
    windDir: { min: 0, max: 360, step: 15 },
    windGust: { min: 0, max: 4, step: 0.1 },
    windSpeed: { min: -80, max: 80, step: 2 }
};

function defaultHotCircleParams() {
    return {
        diffusion: HOT_CIRCLE_DIFFUSION,
        cooling: HOT_CIRCLE_COOLING,
        thickness: HOT_CIRCLE_THICKNESS,
        radius: HOT_CIRCLE_RADIUS,
        energy: HOT_CIRCLE_ENERGY,
        followSpeed: HOT_CIRCLE_FOLLOW,
        tiltX: HOT_CIRCLE_TILT_X_DEG,
        tiltY: HOT_CIRCLE_TILT_Y_DEG,
        tiltZ: HOT_CIRCLE_TILT_Z_DEG,
        noiseAmt: HOT_CIRCLE_NOISE,
        noiseGrain: HOT_CIRCLE_GRAIN,
        noiseFlicker: HOT_CIRCLE_FLICKER,
        windForce: HOT_CIRCLE_WIND_FORCE,
        windDir: HOT_CIRCLE_WIND_DIR,
        windGust: HOT_CIRCLE_WIND_GUST,
        windSpeed: HOT_CIRCLE_WIND_SPEED
    };
}

function clampHotCircleParam(name, value) {
    const spec = HOT_CIRCLE_PARAM_SPECS[name];
    if (!spec) {
        return value;
    }
    if (name === 'windDir') {
        const stepped = Math.round(value / spec.step) * spec.step;
        return ((stepped % 360) + 360) % 360;
    }
    const stepped = Math.round(value / spec.step) * spec.step;
    const clamped = Math.max(spec.min, Math.min(spec.max, stepped));
    const decimals = spec.step < 0.1 ? 2 : spec.step < 1 ? 1 : 0;
    return Number(clamped.toFixed(decimals));
}

function hotCircleRgb(t) {
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

function hotCircleHash(ix, iy) {
    const n = Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453123;
    return n - Math.floor(n);
}

function hotCircleValueNoise(x, y) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const u = fx * fx * (3 - 2 * fx);
    const v = fy * fy * (3 - 2 * fy);
    const a = hotCircleHash(x0, y0);
    const b = hotCircleHash(x0 + 1, y0);
    const c = hotCircleHash(x0, y0 + 1);
    const d = hotCircleHash(x0 + 1, y0 + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function hotCirclePlane(params) {
    const ax = (params.tiltX || 0) * Math.PI / 180;
    const ay = (params.tiltY || 0) * Math.PI / 180;
    const az = (params.tiltZ || 0) * Math.PI / 180;
    const cx = Math.cos(ax);
    const sx = Math.sin(ax);
    const cy = Math.cos(ay);
    const sy = Math.sin(ay);
    const cz = Math.cos(az);
    const sz = Math.sin(az);
    const A = cy * cz;
    const B = sx * sy * cz - cx * sz;
    const C = cy * sz;
    const D = sx * sy * sz + cx * cz;
    return {
        A,
        B,
        C,
        D,
        det: A * D - B * C,
        zU: -sy,
        zV: sx * cy
    };
}

function stampHotCircle(grid, cols, rows, center, params, time) {
    const halfT = Math.max(0.5, params.thickness * 0.5);
    const edge = Math.max(0.7, halfT * 0.35);
    const radius = Math.max(1, params.radius);
    const plane = hotCirclePlane(params);
    if (Math.abs(plane.det) < 1e-4) {
        return;
    }
    const invDet = 1 / plane.det;
    const centerCol = center.col;
    const centerRow = center.row;
    const pad = radius + halfT + edge + 2;
    const x0 = Math.max(0, Math.floor(centerCol - pad));
    const x1 = Math.min(cols - 1, Math.ceil(centerCol + pad));
    const y0 = Math.max(0, Math.floor(centerRow - pad));
    const y1 = Math.min(rows - 1, Math.ceil(centerRow + pad));
    const amt = Math.max(0, params.noiseAmt || 0);
    const freq = Math.max(0.04, (params.noiseGrain || 1) * 0.14);
    const flicker = params.noiseFlicker || 0;
    const t = time || 0;
    const depthRef = Math.max(radius, 1);
    for (let y = y0; y <= y1; y++) {
        const dy = y - centerRow;
        const base = y * cols;
        for (let x = x0; x <= x1; x++) {
            const dx = x - centerCol;
            const u = (plane.D * dx - plane.B * dy) * invDet;
            const v = (-plane.C * dx + plane.A * dy) * invDet;
            const r = Math.hypot(u, v);
            const depth = plane.zU * u + plane.zV * v;
            const depthN = Math.max(-1, Math.min(1, depth / depthRef));
            const scale = 1 + 0.24 * depthN;
            const reach = (halfT + edge) * Math.max(0.45, scale);
            const dist = Math.abs(r - radius);
            if (dist > reach) {
                continue;
            }
            const core = halfT * Math.max(0.45, scale);
            let w = 1;
            if (dist > core) {
                const fall = (dist - core) / Math.max(0.35, reach - core);
                w = Math.exp(-fall * fall * 3);
            }
            let heat = params.energy * w;
            if (amt > 0) {
                const n = hotCircleValueNoise(
                    u * freq + t * flicker * 0.37,
                    v * freq - t * flicker * 0.55
                ) * 2 - 1;
                heat *= Math.max(0, 1 + amt * n);
            }
            const i = base + x;
            grid[i] = Math.min(1, Math.max(grid[i], heat));
        }
    }
}

function stepHotCircleHeat(src, dst, cols, rows, delta, params) {
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

function sampleHotCircleField(grid, cols, rows, x, y) {
    const maxY = rows - 1.001;
    const sy = Math.max(0, Math.min(maxY, y));
    let wx = x % cols;
    if (wx < 0) {
        wx += cols;
    }
    const x0 = Math.floor(wx) % cols;
    const x1 = (x0 + 1) % cols;
    const fx = wx - Math.floor(wx);
    const y0 = Math.floor(sy);
    const y1 = Math.min(rows - 1, y0 + 1);
    const fy = sy - y0;
    const a = grid[y0 * cols + x0];
    const b = grid[y0 * cols + x1];
    const c = grid[y1 * cols + x0];
    const d = grid[y1 * cols + x1];
    return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
}

function hotCircleCurl(x, y, t, freq, amp) {
    const e = 0.9;
    const nL = hotCircleValueNoise((x - e) * freq + t, y * freq);
    const nR = hotCircleValueNoise((x + e) * freq + t, y * freq);
    const nD = hotCircleValueNoise(x * freq, (y - e) * freq + t * 0.65);
    const nU = hotCircleValueNoise(x * freq, (y + e) * freq + t * 0.65);
    return {
        x: (nU - nD) * amp * 10,
        y: (nL - nR) * amp * 10
    };
}

function hotCircleVortex(px, py, cx, cy, strength, radius) {
    const dx = px - cx;
    const dy = py - cy;
    const d2 = dx * dx + dy * dy + 2.2;
    const fall = Math.exp(-d2 / (radius * radius));
    const inv = strength * fall / Math.sqrt(d2);
    return { x: -dy * inv, y: dx * inv };
}

function hotCircleWindVel(x, y, cols, rows, params, t) {
    const force = params.windForce || 0;
    const gust = Math.max(0, params.windGust || 0);
    const speed = params.windSpeed || 0;
    const ang = ((params.windDir || 0) * Math.PI) / 180;
    const ax = Math.cos(ang);
    const ay = Math.sin(ang);
    let vx = ax * force + speed;
    let vy = ay * force;
    if (gust <= 0.001 || force <= 0.001) {
        return { x: vx, y: vy };
    }
    const amp = force * gust * 0.38;
    const c1 = hotCircleCurl(x, y, t * 2.1, 0.038, amp);
    const c2 = hotCircleCurl(x + 37, y - 21, t * 3.8, 0.12, amp * 0.5);
    vx += c1.x + c2.x;
    vy += c1.y + c2.y;

    const nx = -ay;
    const ny = ax;
    const span = cols + rows;
    const drift = (t * (24 + force * 1.6 + Math.abs(speed) * 0.35)) % span;
    const ox = cols * 0.5 - ax * span * 0.5;
    const oy = rows * 0.5 - ay * span * 0.5;
    const spin = force * gust * 0.95;
    const rEddy = 15 + gust * 3.5;
    for (let k = 0; k < 3; k++) {
        const d = (drift + k * span / 3) % span;
        const side = (k % 2 === 0 ? 1 : -1) * (9 + k * 6);
        const sign = k % 2 === 0 ? 1 : -1;
        const cx = ox + ax * d + nx * side;
        const cy = oy + ay * d + ny * side;
        const v = hotCircleVortex(x, y, cx, cy, sign * spin, rEddy);
        vx += v.x;
        vy += v.y;
    }
    return { x: vx, y: vy };
}

function stepHotCircleWind(src, dst, cols, rows, delta, params, time) {
    const force = params.windForce || 0;
    const speed = params.windSpeed || 0;
    if (force <= 0.001 && Math.abs(speed) <= 0.001) {
        return false;
    }
    const dt = Math.min(delta / 1000, 0.05);
    const t = time || 0;
    for (let y = 0; y < rows; y++) {
        const row = y * cols;
        for (let x = 0; x < cols; x++) {
            const v0 = hotCircleWindVel(x, y, cols, rows, params, t);
            const mx = x - v0.x * dt * 0.5;
            const my = y - v0.y * dt * 0.5;
            const v1 = hotCircleWindVel(mx, my, cols, rows, params, t);
            dst[row + x] = sampleHotCircleField(src, cols, rows, x - v1.x * dt, y - v1.y * dt);
        }
    }
    return true;
}

function paintHotCircleHeat(imageData, grid, cols, rows) {
    const data = imageData.data;
    for (let i = 0, n = cols * rows; i < n; i++) {
        const rgb = hotCircleRgb(grid[i]);
        const p = i * 4;
        data[p] = rgb[0];
        data[p + 1] = rgb[1];
        data[p + 2] = rgb[2];
        data[p + 3] = 255;
    }
}

function pointerToHotCircleCell(pointer, x, y, width, height, cols, rows) {
    const localX = Phaser.Math.Clamp(pointer.worldX - x, 0, width);
    const localY = Phaser.Math.Clamp(pointer.worldY - y, 0, height);
    return {
        col: (localX / Math.max(width, 1)) * (cols - 1),
        row: (localY / Math.max(height, 1)) * (rows - 1)
    };
}

function retargetHotCircle(state, click) {
    state.target.col = Math.max(0, Math.min(state.cols - 1, click.col));
    state.target.row = Math.max(0, Math.min(state.rows - 1, click.row));
}

function stepHotCircleMotion(state, delta) {
    const dt = Math.min(delta / 1000, 0.05);
    const k = 1 - Math.exp(-state.params.followSpeed * dt);
    state.center.col += (state.target.col - state.center.col) * k;
    state.center.row += (state.target.row - state.center.row) * k;
    state.center.col = Math.max(0, Math.min(state.cols - 1, state.center.col));
    state.center.row = Math.max(0, Math.min(state.rows - 1, state.center.row));
    return state.center;
}

function attachHotCircle(scene, x, y, width, height) {
    const cols = Math.max(48, Math.round(width / HOT_CIRCLE_CELL_PX));
    const rows = Math.max(64, Math.round(height / HOT_CIRCLE_CELL_PX));
    const src = new Float32Array(cols * rows);
    const dst = new Float32Array(cols * rows);
    const startCol = (cols - 1) * 0.5;
    const startRow = rows * 0.5;

    if (scene.textures.exists(HOT_CIRCLE_TEX_KEY)) {
        scene.textures.remove(HOT_CIRCLE_TEX_KEY);
    }
    const tex = scene.textures.createCanvas(HOT_CIRCLE_TEX_KEY, cols, rows);
    const ctx = tex.getContext();
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, cols, rows);
    tex.refresh();

    const view = scene.add.image(x + width / 2, y + height / 2, HOT_CIRCLE_TEX_KEY);
    view.setDisplaySize(width, height);

    const imageData = ctx.createImageData(cols, rows);
    paintHotCircleHeat(imageData, src, cols, rows);
    ctx.putImageData(imageData, 0, 0);
    tex.refresh();

    const state = {
        kind: 'hot-circle',
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
        params: defaultHotCircleParams(),
        paint: () => {
            paintHotCircleHeat(state.imageData, state.src, cols, rows);
            state.ctx.putImageData(state.imageData, 0, 0);
            state.tex.refresh();
        },
        setParam: (name, value) => {
            if (!HOT_CIRCLE_PARAM_SPECS[name]) {
                return state.params[name];
            }
            state.params[name] = clampHotCircleParam(name, value);
            return state.params[name];
        },
        nudgeParam: (name, dir) => {
            const spec = HOT_CIRCLE_PARAM_SPECS[name];
            if (!spec) {
                return state.params[name];
            }
            return state.setParam(name, state.params[name] + dir * spec.step);
        },
        update: (_, delta) => {
            state.t += Math.min(delta / 1000, 0.05);
            stepHotCircleHeat(state.src, state.dst, cols, rows, delta, state.params);
            let swap = state.src;
            state.src = state.dst;
            state.dst = swap;
            if (stepHotCircleWind(state.src, state.dst, cols, rows, delta, state.params, state.t)) {
                swap = state.src;
                state.src = state.dst;
                state.dst = swap;
            }
            const center = stepHotCircleMotion(state, delta);
            stampHotCircle(state.src, cols, rows, center, state.params, state.t);
            state.paint();
        }
    };

    const hit = scene.add.zone(x, y, width, height).setOrigin(0);
    hit.setInteractive({ useHandCursor: true });
    hit.on('pointerdown', (pointer) => {
        retargetHotCircle(state, pointerToHotCircleCell(pointer, x, y, width, height, cols, rows));
    });
    state.hit = hit;

    scene.events.once('shutdown', () => {
        if (state.hit) {
            state.hit.destroy();
        }
        if (state.view) {
            state.view.destroy();
        }
        if (scene.textures.exists(HOT_CIRCLE_TEX_KEY)) {
            scene.textures.remove(HOT_CIRCLE_TEX_KEY);
        }
    });

    return state;
}
