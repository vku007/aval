/**
 * UiNewSheet
 * One loop-animated hot disk. TILT X, Y, and Z turn the disk and its balls together.
 * BALLS is how many hot dots orbit the disk center. Their phases start at PHASE
 * and are spaced the same way HotMapUiStone spaces its balls.
 * The pivot starts at the disk center. Tap the field to move it.
 */
const UI_NEW_SHEET_SPECS = {
    loopSpeed: { min: 0, max: 360, step: 5 },
    radFrom: { min: 4, max: 120, step: 1 },
    radTo: { min: 4, max: 120, step: 1 },
    heatFrom: { min: 0, max: 3, step: 0.02 },
    heatTo: { min: 0, max: 3, step: 0.02 },
    speed: { min: -360, max: 360, step: 5 },
    angle: { min: -180, max: 180, step: 5 },
    tiltX: { min: -180, max: 180, step: 5 },
    tiltY: { min: -180, max: 180, step: 5 },
    tiltZ: { min: -180, max: 180, step: 5 },
    depth: { min: -120, max: 120, step: 2 },
    pivotX: { min: -160, max: 160, step: 1 },
    pivotY: { min: -160, max: 160, step: 1 },
    ballCount: { min: 1, max: 12, step: 1 },
    ballSpeed: { min: -360, max: 360, step: 5 },
    ballPhase: { min: -180, max: 180, step: 5 },
    ballRadius: { min: 0, max: 140, step: 1 },
    ballSize: { min: 1, max: 10, step: 0.2 },
    ballHeat: { min: 0, max: 3, step: 0.02 }
};

function newSheetDecimals(step) {
    if (step >= 1) {
        return 0;
    }
    const parts = String(step).split('.');
    return parts[1] ? parts[1].length : 0;
}

function wrapNewSheetAngle(deg) {
    let turns = ((Number(deg) + 180) % 360 + 360) % 360 - 180;
    if (turns <= -179.5) {
        return 180;
    }
    return turns;
}

function newSheetRotate(x, y, deg) {
    const rad = deg * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return {
        x: x * cos - y * sin,
        y: x * sin + y * cos
    };
}

function diskHeatBuffer(field, grid) {
    if (!field.diskHeat || field.diskHeat.length !== grid.length) {
        field.diskHeat = new Float32Array(grid.length);
    }
    return field.diskHeat;
}

function clampNewSheetSpec(name, value) {
    const spec = UI_NEW_SHEET_SPECS[name];
    if (!spec) {
        return value;
    }
    const stepped = Math.round(value / spec.step) * spec.step;
    const clamped = Math.max(spec.min, Math.min(spec.max, stepped));
    return Number(clamped.toFixed(newSheetDecimals(spec.step)));
}

class UiNewSheet extends HeatItem {
    static PROP_TABS = [
        {
            id: 'loop',
            label: 'LOOP',
            rows: [
                { key: 'loopSpeed', label: 'SPEED', decimals: 0 },
                { key: 'radFrom', label: 'RAD FROM', decimals: 0 },
                { key: 'radTo', label: 'RAD TO', decimals: 0 },
                { key: 'heatFrom', label: 'HEAT FROM', decimals: 2 },
                { key: 'heatTo', label: 'HEAT TO', decimals: 2 }
            ]
        },
        {
            id: 'spin',
            label: 'SPIN',
            rows: [
                { key: 'speed', label: 'SPEED', decimals: 0 },
                { key: 'angle', label: 'ANGLE', decimals: 0 },
                { key: 'pivotX', label: 'PIVOT X', decimals: 0 },
                { key: 'pivotY', label: 'PIVOT Y', decimals: 0 }
            ]
        },
        {
            id: 'tilt',
            label: 'TILT',
            rows: [
                { key: 'tiltX', label: 'TILT X', decimals: 0 },
                { key: 'tiltY', label: 'TILT Y', decimals: 0 },
                { key: 'tiltZ', label: 'TILT Z', decimals: 0 },
                { key: 'depth', label: 'DISTANCE', decimals: 0 }
            ]
        },
        {
            id: 'ball',
            label: 'BALL',
            rows: [
                { key: 'ballCount', label: 'BALLS', decimals: 0 },
                { key: 'ballSpeed', label: 'SPEED', decimals: 0 },
                { key: 'ballPhase', label: 'PHASE', decimals: 0 },
                { key: 'ballRadius', label: 'RADIUS', decimals: 0 },
                { key: 'ballSize', label: 'DOT SIZE', decimals: 1 },
                { key: 'ballHeat', label: 'DOT HEAT', decimals: 2 }
            ]
        },
        {
            id: 'field',
            label: 'FIELD',
            rows: [
                { key: 'isVisible', label: 'VISIBLE', type: 'bool' },
                { key: 'diffusion', label: 'DIFFUSE', decimals: 1 },
                { key: 'cooling', label: 'COOL', decimals: 2 }
            ]
        }
    ];

    constructor(heatMap, options) {
        const opts = options || {};
        super({
            kind: 'new-sheet',
            name: opts.name || 'New Sheet',
            field: heatMap.field
        });
        this.heatMap = heatMap;
        this.scene = heatMap.scene;
        this.loopSpeed = 90;
        this.loopAngle = 0;
        this.radFrom = 14;
        this.radTo = 32;
        this.heatFrom = 0.04;
        this.heatTo = 0.18;
        this.radius = this.radFrom;
        this.heat = this.heatFrom;
        this.angle = 0;
        this.speed = 40;
        this.tiltX = 0;
        this.tiltY = 0;
        this.tiltZ = 0;
        this.ballPhase = 0;
        this.ballSpin = 0;
        this.ballSpeed = 70;
        this.ballRadius = 40;
        this.ballSize = 3.4;
        this.ballHeat = 1.6;
        this.ballCount = 4;
        this.ballOffsets = [];
        this._visible = opts.isVisible !== false;
        const home = this.homeCenter();
        this.pivotCol = home.col;
        this.pivotRow = home.row;
        this.armX = 0;
        this.armY = 0;
        this.depth = 0;
        this.applyOptions(opts);
        this.rebuildBallOffsets();

        if (opts.ownField !== false) {
            const field = heatMap.field;
            field.setParam('diffusion', 9);
            field.params.cooling = 3;
            field.setParam('viewX', 0);
            field.setParam('viewY', 0);
            field.setParam('viewZ', 0);
        }
        this.bindBehaviour('highlighters', this);
        this.spin = new Spin(this);
        this.diskLoop = new DiskLoop(this);
        this.loops = [this.spin, this.diskLoop];
        if (typeof heatMap.addHighlighter === 'function') {
            heatMap.addHighlighter(this);
        }
    }

    applyOptions(opts) {
        const keys = [
            'loopSpeed', 'radFrom', 'radTo', 'heatFrom', 'heatTo',
            'speed', 'angle', 'tiltX', 'tiltY', 'tiltZ',
            'ballSpeed', 'ballRadius', 'ballSize', 'ballHeat', 'ballCount',
            'armX', 'armY', 'depth'
        ];
        keys.forEach((key) => {
            if (typeof opts[key] === 'number') {
                this[key] = opts[key];
            }
        });
        if (typeof opts.ballPhase === 'number') {
            this.ballPhase = opts.ballPhase;
        }
        if (typeof opts.loopAngle === 'number') {
            this.loopAngle = opts.loopAngle;
        }
        if (typeof opts.ballSpin === 'number') {
            this.ballSpin = opts.ballSpin;
        }
        if (opts.center && typeof opts.center.col === 'number' && typeof opts.center.row === 'number') {
            this.pivotCol = opts.center.col;
            this.pivotRow = opts.center.row;
        }
        this.ballCount = clampNewSheetSpec('ballCount', this.ballCount);
        this.radius = this.radFrom;
        this.heat = this.heatFrom;
    }

    homeCenter() {
        const field = this.heatMap.field;
        return {
            col: (field.cols - 1) * 0.5,
            row: (field.rows - 1) * 0.5
        };
    }

    tiltPoint(x, y, z) {
        return eulerRotatePoint(x, y, z || 0, this.tiltX, this.tiltY, this.tiltZ);
    }

    unproject(dx, dy) {
        const ex = this.tiltPoint(1, 0);
        const ey = this.tiltPoint(0, 1);
        const det = ex.x * ey.y - ey.x * ex.y;
        if (Math.abs(det) < 0.05) {
            return { x: dx, y: dy };
        }
        return {
            x: (ey.y * dx - ey.x * dy) / det,
            y: (ex.x * dy - ex.y * dx) / det
        };
    }

    diskCenter(z) {
        const spun = newSheetRotate(this.armX, this.armY, this.angle);
        const tilted = this.tiltPoint(spun.x, spun.y, z);
        return {
            col: this.pivotCol + tilted.x,
            row: this.pivotRow + tilted.y
        };
    }

    highlightCenter() {
        return this.diskCenter(0);
    }

    sharedBallSpin() {
        return this.ballSpin;
    }

    sharedBallSpeed() {
        return this.ballSpeed;
    }

    ballPlace(index) {
        const arm = newSheetRotate(this.armX, this.armY, this.angle);
        const rad = (this.ballPhase + this.sharedBallSpin()) * Math.PI / 180 + (this.ballOffsets[index] || 0);
        const tilted = this.tiltPoint(
            arm.x + Math.cos(rad) * this.ballRadius,
            arm.y + Math.sin(rad) * this.ballRadius,
            this.depth
        );
        return {
            col: this.pivotCol + tilted.x,
            row: this.pivotRow + tilted.y,
            depth: tilted.z
        };
    }

    beginBallTravel(spawnLocal) {
        const local = spawnLocal || {};
        this.ballTravel = {
            u: 0,
            duration: 1,
            spawnLocal: {
                col: typeof local.col === 'number' ? local.col : 0,
                row: typeof local.row === 'number' ? local.row : 0
            }
        };
    }

    beginRemoveDrama(options) {
        const opts = options || {};
        const speeds = opts.speeds || [400, 900, 160];
        const hot = Math.max(this.heat, this.heatFrom, this.heatTo);
        const heatScale = opts.heatScale > 0 ? opts.heatScale : 3;
        const radiusScale = opts.radiusScale > 0 ? opts.radiusScale : 3;
        this.ballTravel = null;
        this.drama = {
            step: 1,
            u: 0,
            done: false,
            jump: Math.max(0, opts.jump || 0),
            drop: Math.max(0, opts.drop || 0),
            speeds: speeds.map((speed) => Math.max(1, Number(speed) || 0)),
            heat0: this.heat,
            heat1: hot * heatScale,
            radius0: this.radius,
            radius1: this.radius * radiusScale,
            onDone: opts.onDone || null,
            ballFrom: null,
            ballTo: null
        };
        this.applyDramaPose();
    }

    ballAt(index) {
        if (this.drama && this.drama.step >= 2) {
            return this.dramaBall(index);
        }
        const dest = this.ballPlace(index);
        const travel = this.ballTravel;
        if (!travel || travel.u >= 1) {
            return dest;
        }
        const u = travel.u;
        const spawnCol = this.pivotCol + travel.spawnLocal.col;
        const spawnRow = this.pivotRow + travel.spawnLocal.row;
        return {
            col: spawnCol + (dest.col - spawnCol) * u,
            row: spawnRow + (dest.row - spawnRow) * u,
            depth: dest.depth * u
        };
    }

    ballCenter() {
        return this.ballAt(0);
    }

    rebuildBallOffsets() {
        const count = Math.max(0, this.ballCount | 0);
        if (count <= 1) {
            this.ballOffsets = count === 1 ? [0] : [];
            return this.ballOffsets;
        }
        const seeds = [];
        for (let index = 0; index < count; index += 1) {
            seeds.push(0);
        }
        this.ballOffsets = hotMapStoneEvenPhaseGoals(seeds);
        return this.ballOffsets;
    }

    setPivot(cell) {
        const current = this.highlightCenter();
        const plane = this.unproject(current.col - cell.col, current.row - cell.row);
        const local = newSheetRotate(plane.x, plane.y, -this.angle);
        this.pivotCol = cell.col;
        this.pivotRow = cell.row;
        this.armX = local.x;
        this.armY = local.y;
    }

    step(delta) {
        const dt = Math.min(Math.max(0, delta || 0) / 1000, 0.05);
        this.spin.advance(dt);
        if (this.drama) {
            this.advanceDrama(dt);
            return;
        }
        if (this.ballTravel && this.ballTravel.u < 1) {
            const duration = Math.max(0.05, this.ballTravel.duration || 1);
            this.ballTravel.u = Math.min(1, this.ballTravel.u + dt / duration);
            if (this.ballTravel.u >= 1) {
                this.ballTravel = null;
            }
        }
        this.diskLoop.advance(dt);
    }

    advance(delta) {
        this.step(delta);
    }

    get isVisible() {
        return this._visible;
    }

    set isVisible(value) {
        this._visible = !!value;
    }

    get params() {
        const field = this.heatMap.field.params;
        return {
            isVisible: this.isVisible,
            loopSpeed: this.loopSpeed,
            radFrom: this.radFrom,
            radTo: this.radTo,
            heatFrom: this.heatFrom,
            heatTo: this.heatTo,
            speed: this.speed,
            angle: this.angle,
            tiltX: this.tiltX,
            tiltY: this.tiltY,
            tiltZ: this.tiltZ,
            depth: this.depth,
            ballCount: this.ballCount,
            ballSpeed: this.sharedBallSpeed(),
            ballPhase: this.ballPhase,
            ballRadius: this.ballRadius,
            ballSize: this.ballSize,
            ballHeat: this.ballHeat,
            pivotX: this.pivotCol - this.homeCenter().col,
            pivotY: this.pivotRow - this.homeCenter().row,
            diffusion: field.diffusion,
            cooling: field.cooling
        };
    }

    nudgeParam(key, dir) {
        if (key === 'isVisible') {
            this.isVisible = !this.isVisible;
            return this.isVisible;
        }
        if (key === 'diffusion' || key === 'cooling') {
            return this.heatMap.field.nudgeParam(key, dir);
        }
        if (key === 'angle' || key === 'ballPhase') {
            this[key] = wrapNewSheetAngle(this[key] + dir * UI_NEW_SHEET_SPECS[key].step);
            return this.params[key];
        }
        if (key === 'pivotX' || key === 'pivotY') {
            const spec = UI_NEW_SHEET_SPECS[key];
            const next = clampNewSheetSpec(key, this.params[key] + dir * spec.step);
            const pivot = {
                x: key === 'pivotX' ? next : this.params.pivotX,
                y: key === 'pivotY' ? next : this.params.pivotY
            };
            const home = this.homeCenter();
            this.setPivot({ col: home.col + pivot.x, row: home.row + pivot.y });
            return this.params[key];
        }
        const spec = UI_NEW_SHEET_SPECS[key];
        if (!spec) {
            return this.params[key];
        }
        return this.setParam(key, clampNewSheetSpec(key, this.params[key] + dir * spec.step));
    }

    setParam(key, value) {
        if (key === 'diffusion' || key === 'cooling') {
            return this.heatMap.field.setParam(key, value);
        }
        if (key === 'angle' || key === 'ballPhase') {
            this[key] = wrapNewSheetAngle(value);
            return this.params[key];
        }
        if (key === 'ballCount') {
            this.ballCount = clampNewSheetSpec('ballCount', value);
            this.rebuildBallOffsets();
            return this.ballCount;
        }
        if (key === 'pivotX' || key === 'pivotY') {
            const next = clampNewSheetSpec(key, value);
            const pivot = {
                x: key === 'pivotX' ? next : this.params.pivotX,
                y: key === 'pivotY' ? next : this.params.pivotY
            };
            const home = this.homeCenter();
            this.setPivot({ col: home.col + pivot.x, row: home.row + pivot.y });
            return this.params[key];
        }
        if (!UI_NEW_SHEET_SPECS[key]) {
            return this.params[key];
        }
        this[key] = clampNewSheetSpec(key, value);
        return this[key];
    }

    serialize() {
        return {
            name: this.name,
            isVisible: this.isVisible,
            loopSpeed: this.loopSpeed,
            loopAngle: this.loopAngle,
            radFrom: this.radFrom,
            radTo: this.radTo,
            heatFrom: this.heatFrom,
            heatTo: this.heatTo,
            speed: this.speed,
            angle: this.angle,
            tiltX: this.tiltX,
            tiltY: this.tiltY,
            tiltZ: this.tiltZ,
            armX: this.armX,
            armY: this.armY,
            ballCount: this.ballCount,
            ballSpeed: this.ballSpeed,
            ballPhase: this.ballPhase,
            ballSpin: this.ballSpin,
            ballRadius: this.ballRadius,
            ballSize: this.ballSize,
            ballHeat: this.ballHeat,
            depth: this.depth,
            center: { col: this.pivotCol, row: this.pivotRow }
        };
    }

    applySerialized(data) {
        if (!data) {
            return;
        }
        this.applyOptions(data);
        if (typeof data.isVisible === 'boolean') {
            this.isVisible = data.isVisible;
        }
        if (data.name) {
            this.name = data.name;
        }
        this.rebuildBallOffsets();
    }

    stamp(grid) {
        const frame = heatFrame(this);
        if (!heatRest(frame)) {
            this.stampWithChannels(grid, frame);
            return;
        }
        const field = this.heatMap.field;
        if (!this.diskSum || this.diskSum.length !== grid.length) {
            this.diskSum = new Float32Array(grid.length);
        } else {
            this.diskSum.fill(0);
        }
        this.stampDisk(this.diskSum, field.cols, field.rows, this.diskCenter(this.depth), this.radius, this.heat);
        const sum = diskHeatBuffer(field, grid);
        for (let i = 0; i < grid.length; i++) {
            const add = this.diskSum[i];
            if (add <= 0) {
                continue;
            }
            sum[i] = Math.min(1, sum[i] + add);
            if (sum[i] > grid[i]) {
                grid[i] = sum[i];
            }
        }
        for (let index = 0; index < this.ballCount; index += 1) {
            this.stampBall(grid, field.cols, field.rows, this.ballAt(index));
        }
    }

    stampWithChannels(grid, frame) {
        const field = this.heatMap.field;
        const baseAngle = this.angle;
        const localRotate = frame.own.rotate || 0;
        if (localRotate !== 0) {
            this.angle = baseAngle + localRotate;
        }
        const rawCenter = this.diskCenter(this.depth);
        const rawBalls = [];
        for (let index = 0; index < this.ballCount; index += 1) {
            rawBalls.push(this.ballAt(index));
        }
        const groupRotate = frame.group ? frame.group.rotate : 0;
        if (groupRotate !== 0) {
            this.angle = baseAngle + localRotate + groupRotate;
        }
        try {
            if (!this.diskSum || this.diskSum.length !== grid.length) {
                this.diskSum = new Float32Array(grid.length);
            } else {
                this.diskSum.fill(0);
            }
            const diskScale = frame.own['disk.scale'] == null ? 1 : frame.own['disk.scale'];
            const diskHeat = frame.own['disk.heat'] == null ? 1 : frame.own['disk.heat'];
            const center = heatPlace(frame, rawCenter.col, rawCenter.row);
            const radius = heatMul(heatScale(frame, this.radius), diskScale);
            const heat = heatMul(heatHeat(frame, this.heat), diskHeat);
            this.stampDisk(this.diskSum, field.cols, field.rows, center, radius, heat);
            const sum = diskHeatBuffer(field, grid);
            for (let i = 0; i < grid.length; i++) {
                const add = this.diskSum[i];
                if (add <= 0) {
                    continue;
                }
                sum[i] = Math.min(1, sum[i] + add);
                if (sum[i] > grid[i]) {
                    grid[i] = sum[i];
                }
            }
            const ballScale = frame.own['balls.scale'] == null ? 1 : frame.own['balls.scale'];
            const ballHeat = frame.own['balls.heat'] == null ? 1 : frame.own['balls.heat'];
            const dot = {
                radius: heatMul(heatScale(frame, this.ballSize), ballScale),
                energy: heatMul(heatHeat(frame, this.ballHeat), ballHeat)
            };
            rawBalls.forEach((ball) => {
                const placed = heatBallPoint(frame, ball.col, ball.row);
                this.stampBall(grid, field.cols, field.rows, {
                    col: placed.col,
                    row: placed.row,
                    depth: ball.depth
                }, dot);
            });
        } finally {
            this.angle = baseAngle;
        }
    }

    stampBall(grid, cols, rows, ball, dot) {
        let energy = dot && typeof dot.energy === 'number' ? dot.energy : this.ballHeat;
        const radius = dot && typeof dot.radius === 'number' ? dot.radius : this.ballSize;
        if (this.drama && this.drama.step === 3) {
            energy *= 1 - this.drama.u;
        }
        stampRotatedHotBall(grid, cols, rows, ball.col, ball.row, {
            radius: radius,
            energy: energy,
            orbitRadius: Math.max(1, this.ballRadius)
        }, ball.depth);
    }

    dramaBall(index) {
        const drama = this.drama;
        if (drama.step === 3 && drama.ballFrom && drama.ballTo) {
            const from = drama.ballFrom[index] || drama.ballFrom[0];
            const to = drama.ballTo;
            const u = drama.u;
            return {
                col: from.col + (to.col - from.col) * u,
                row: from.row + (to.row - from.row) * u,
                depth: from.depth + (to.depth - from.depth) * u
            };
        }
        const orbit = this.ballPlace(index);
        const jump = drama.step === 2 ? drama.jump * drama.u : drama.jump;
        return {
            col: orbit.col,
            row: orbit.row - jump,
            depth: orbit.depth
        };
    }

    advanceDrama(dt) {
        const drama = this.drama;
        if (!drama || drama.done) {
            this.applyDramaPose();
            return;
        }
        let remain = Math.max(0, dt || 0);
        while (remain > 0 && !drama.done) {
            const rate = Math.max(1, drama.speeds[drama.step - 1] || 1) / 100;
            const need = (1 - drama.u) / rate;
            if (remain < need) {
                drama.u += remain * rate;
                remain = 0;
                break;
            }
            remain -= need;
            drama.u = 1;
            if (drama.step < 3) {
                this.enterDramaStep(drama.step + 1);
            } else {
                drama.done = true;
            }
        }
        this.applyDramaPose();
    }

    enterDramaStep(step) {
        if (step === 3) {
            this.captureDramaFall();
        }
        this.drama.step = step;
        this.drama.u = 0;
    }

    captureDramaFall() {
        const drama = this.drama;
        const from = [];
        for (let index = 0; index < this.ballCount; index += 1) {
            const orbit = this.ballPlace(index);
            from.push({
                col: orbit.col,
                row: orbit.row - drama.jump,
                depth: orbit.depth
            });
        }
        const spun = newSheetRotate(this.armX, this.armY, this.angle);
        const tilted = this.tiltPoint(spun.x, spun.y, this.depth);
        drama.ballFrom = from;
        drama.ballTo = {
            col: this.pivotCol + tilted.x,
            row: this.pivotRow + tilted.y + drama.drop,
            depth: tilted.z
        };
    }

    applyDramaPose() {
        const drama = this.drama;
        if (!drama) {
            return;
        }
        const u = drama.u;
        if (drama.step === 1) {
            this.radius = drama.radius0;
            this.heat = drama.heat0 + (drama.heat1 - drama.heat0) * u;
            return;
        }
        this.radius = drama.step === 2
            ? drama.radius0 + (drama.radius1 - drama.radius0) * u
            : drama.radius1;
        this.heat = drama.step === 2 ? drama.heat1 * (1 - u) : 0;
    }

    stampDisk(grid, cols, rows, center, radius, heat) {
        radius = Math.max(1, radius);
        heat = Math.max(0, heat);
        if (heat <= 0) {
            return;
        }
        const ex = this.tiltPoint(radius, 0);
        const ey = this.tiltPoint(0, radius);
        const det = ex.x * ey.y - ey.x * ex.y;
        const pad = Math.hypot(ex.x, ex.y) + Math.hypot(ey.x, ey.y) + 3;
        const x0 = Math.max(0, Math.floor(center.col - pad));
        const x1 = Math.min(cols - 1, Math.ceil(center.col + pad));
        const y0 = Math.max(0, Math.floor(center.row - pad));
        const y1 = Math.min(rows - 1, Math.ceil(center.row + pad));
        const edge = 2 / radius;
        if (Math.abs(det) < 0.08) {
            this.stampDiskEdge(grid, cols, center, ex, ey, heat, x0, x1, y0, y1);
            return;
        }
        const inv = 1 / det;
        for (let y = y0; y <= y1; y++) {
            const dy = y - center.row;
            const base = y * cols;
            for (let x = x0; x <= x1; x++) {
                const dx = x - center.col;
                const s = (ey.y * dx - ey.x * dy) * inv;
                const t = (ex.x * dy - ex.y * dx) * inv;
                const dist = Math.hypot(s, t);
                if (dist > 1 + edge) {
                    continue;
                }
                let w = 1;
                if (dist > 1) {
                    const fall = (dist - 1) / edge;
                    w = Math.exp(-fall * fall * 3);
                }
                const i = base + x;
                grid[i] = Math.min(1, grid[i] + heat * w);
            }
        }
    }

    stampDiskEdge(grid, cols, center, ex, ey, heat, x0, x1, y0, y1) {
        const major = Math.hypot(ex.x, ex.y) >= Math.hypot(ey.x, ey.y) ? ex : ey;
        const len = Math.hypot(major.x, major.y);
        if (len < 0.25) {
            return;
        }
        const ux = major.x / len;
        const uy = major.y / len;
        for (let y = y0; y <= y1; y++) {
            const dy = y - center.row;
            const base = y * cols;
            for (let x = x0; x <= x1; x++) {
                const dx = x - center.col;
                const along = dx * ux + dy * uy;
                const side = Math.hypot(dx - along * ux, dy - along * uy);
                if (Math.abs(along) > len + 2 || side > 2.5) {
                    continue;
                }
                let w = 1;
                if (side > 0.8) {
                    const fall = (side - 0.8) / 1.7;
                    w = Math.exp(-fall * fall * 3);
                }
                const i = base + x;
                grid[i] = Math.min(1, grid[i] + heat * w);
            }
        }
    }
}
