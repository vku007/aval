/**
 * HotMapUiStone
 * One heat-map group. Parts keep offsets from the stone center.
 * Setting the center moves every part by the same amount.
 */
class HotMapUiStone {
    static PROP_TABS = [
        {
            id: 'place',
            label: 'PLACE',
            rows: [
                { key: 'centerX', label: 'CENTER X', decimals: 1 },
                { key: 'centerY', label: 'CENTER Y', decimals: 1 }
            ]
        },
        {
            id: 'ball',
            label: 'BALL',
            rows: [
                { key: 'newBallInit_radius', label: 'DOT SIZE', decimals: 1 },
                { key: 'newBallInit_energy', label: 'DOT HEAT', decimals: 1 },
                { key: 'newBallInit_angleSpeed', label: 'ANG SPEED', decimals: 1 },
                { key: 'newBallInit_phase', label: 'PHASE', decimals: 0 },
                { key: 'newBallInit_orbitRadius', label: 'RADIUS', decimals: 0 },
                { key: 'newBallInit_tiltX', label: 'TILT X', decimals: 0 },
                { key: 'newBallInit_tiltY', label: 'TILT Y', decimals: 0 },
                { key: 'newBallInit_tiltZ', label: 'TILT Z', decimals: 0 },
                { key: 'spawnX', label: 'SPAWN X', decimals: 1 },
                { key: 'spawnY', label: 'SPAWN Y', decimals: 1 },
                { key: 'spawnSpeed', label: 'SPAWN SPEED', decimals: 1 },
                { key: 'addBall', label: 'BALL', button: 'ADD', type: 'action' },
                { key: 'removeBall', label: 'BALL', button: 'RMV', type: 'action' }
            ]
        }
    ];

    constructor(heatMap, options) {
        const opts = options || {};
        const field = heatMap.field;
        this.heatMap = heatMap;
        this.kind = 'hot-map-stone';
        this.name = opts.name || 'Stone';
        this.center = {
            col: opts.center && typeof opts.center.col === 'number'
                ? opts.center.col
                : (field.cols - 1) * 0.5,
            row: opts.center && typeof opts.center.row === 'number'
                ? opts.center.row
                : (field.rows - 1) * 0.5
        };
        this.parts = [];
        this.ballInit = defaultRotatedHotBallParams();
        this.spawn = { col: 36, row: 0 };
        this.spawnSpeed = 1.2;
    }

    add(object) {
        if (!object || this.parts.some((part) => part.object === object)) {
            return object;
        }
        const part = { object: object, local: null };
        this.parts.push(part);
        part.local = this.captureLocal(object);
        return object;
    }

    remove(object) {
        const index = this.parts.findIndex((part) => part.object === object);
        if (index >= 0) {
            this.parts.splice(index, 1);
        }
    }

    get params() {
        const values = {
            centerX: this.center.col,
            centerY: this.center.row,
            spawnX: this.center.col + this.spawn.col,
            spawnY: this.center.row + this.spawn.row,
            spawnSpeed: this.spawnSpeed
        };
        HOT_MAP_STONE_BALL_INIT_KEYS.forEach((key) => {
            values['newBallInit_' + key] = this.ballInit[key];
        });
        return values;
    }

    nudgeParam(key, dir) {
        if (key === 'spawnX' || key === 'spawnY') {
            const axis = key === 'spawnX' ? 'col' : 'row';
            this.spawn[axis] += dir;
            return this.params[key];
        }
        if (key === 'spawnSpeed') {
            const spec = HOT_MAP_STONE_SPAWN_SPEED;
            const next = this.spawnSpeed + dir * spec.step;
            this.spawnSpeed = Math.max(spec.min, Math.min(spec.max, next));
            return this.spawnSpeed;
        }
        if (key.indexOf('newBallInit_') === 0) {
            return this.nudgeBallInit(key.slice('newBallInit_'.length), dir);
        }
        const next = { col: this.center.col, row: this.center.row };
        if (key === 'centerX') {
            next.col += dir;
        } else if (key === 'centerY') {
            next.row += dir;
        }
        this.setCenter(next);
        return this.params[key];
    }

    nudgeBallInit(key, dir) {
        const spec = key === 'phase'
            ? { min: 0, max: 355, step: 5 }
            : ROTATED_HOT_BALL_SPECS[key];
        if (!spec) {
            return this.ballInit[key];
        }
        const next = this.ballInit[key] + dir * spec.step;
        const clamped = Math.max(spec.min, Math.min(spec.max, next));
        this.ballInit[key] = key === 'phase' ? wrapPhaseDeg(clamped) : clamped;
        return this.ballInit[key];
    }

    addBall() {
        const params = {};
        HOT_MAP_STONE_BALL_INIT_KEYS.forEach((key) => {
            params[key] = this.ballInit[key];
        });
        const ball = new UiHotBall(this.heatMap, {
            params: params
        });
        const motion = ball.motion;
        const spawn = {
            col: this.center.col + this.spawn.col,
            row: this.center.row + this.spawn.row
        };
        const off = rotatedOrbitOffset(motion, motion.angle);
        motion.orbitCenter.col = spawn.col - off.col;
        motion.orbitCenter.row = spawn.row - off.row;
        motion.orbitTarget.col = this.center.col;
        motion.orbitTarget.row = this.center.row;
        motion.centerFollow = this.spawnSpeed;
        this.add(ball);
        this.spreadBallPhases();
        if (typeof this.onPartAdded === 'function') {
            this.onPartAdded(ball);
        }
        return ball;
    }

    spreadBallPhases() {
        const balls = this.parts
            .map((part) => part.object)
            .filter((object) => object && object.kind === 'hot-ball' && object.motion);
        if (balls.length < 2) {
            return;
        }
        const goals = hotMapStoneEvenPhaseGoals(balls.map((ball) => ball.motion.angle));
        balls.forEach((ball, index) => {
            ball.motion.phaseGoal = goals[index];
            ball.motion.phaseFollow = this.spawnSpeed;
        });
    }

    removeBall() {
        for (let index = this.parts.length - 1; index >= 0; index -= 1) {
            const object = this.parts[index].object;
            if (!object || object.kind !== 'hot-ball') {
                continue;
            }
            this.parts.splice(index, 1);
            if (this.heatMap && typeof this.heatMap.removeBall === 'function') {
                this.heatMap.removeBall(object.motion);
            }
            if (typeof this.onPartRemoved === 'function') {
                this.onPartRemoved(object);
            }
            return object;
        }
        return null;
    }

    retarget(cell) {
        this.setCenter(cell);
    }

    setCenter(cell) {
        if (!cell || typeof cell.col !== 'number' || typeof cell.row !== 'number') {
            return this.center;
        }
        this.parts.forEach((part) => {
            part.local = this.captureLocal(part.object);
        });
        this.center = { col: cell.col, row: cell.row };
        this.parts.forEach((part) => this.applyLocal(part));
        return this.center;
    }

    captureLocal(object) {
        const origin = this.center;
        if (object.kind === 'hot-ball') {
            const motion = object.motion;
            return {
                orbitCenter: hotMapStoneDelta(origin, motion.orbitCenter),
                orbitTarget: motion.orbitTarget ? hotMapStoneDelta(origin, motion.orbitTarget) : null
            };
        }
        if (object.kind === 'hot-rod') {
            const emitter = object.emitter;
            return {
                start: hotMapStoneDelta(origin, emitter.start),
                end: hotMapStoneDelta(origin, emitter.end),
                center: hotMapStoneDelta(origin, emitter.center),
                target: hotMapStoneDelta(origin, emitter.target)
            };
        }
        if (object.kind === 'back-highlight') {
            const emitter = object.emitter;
            return {
                center: hotMapStoneDelta(origin, emitter.center),
                target: hotMapStoneDelta(origin, emitter.target)
            };
        }
        return null;
    }

    applyLocal(part) {
        const origin = this.center;
        const local = part.local;
        const object = part.object;
        if (!local) {
            return;
        }
        if (object.kind === 'hot-ball') {
            hotMapStonePlace(object.motion.orbitCenter, origin, local.orbitCenter);
            if (local.orbitTarget && object.motion.orbitTarget) {
                hotMapStonePlace(object.motion.orbitTarget, origin, local.orbitTarget);
            }
            return;
        }
        if (object.kind === 'hot-rod') {
            const emitter = object.emitter;
            hotMapStonePlace(emitter.start, origin, local.start);
            hotMapStonePlace(emitter.end, origin, local.end);
            hotMapStonePlace(emitter.center, origin, local.center);
            hotMapStonePlace(emitter.target, origin, local.target);
            return;
        }
        if (object.kind === 'back-highlight') {
            const emitter = object.emitter;
            hotMapStonePlace(emitter.center, origin, local.center);
            hotMapStonePlace(emitter.target, origin, local.target);
        }
    }

    serialize() {
        this.parts.forEach((part) => {
            part.local = this.captureLocal(part.object);
        });
        return {
            name: this.name,
            center: { col: this.center.col, row: this.center.row },
            parts: this.parts.map((part) => ({
                kind: part.object.kind,
                object: hotMapStoneWithLocalPoints(part.object.serialize(), part.local)
            }))
        };
    }

    applySerialized(data) {
        if (!data) {
            return;
        }
        if (data.name) {
            this.name = data.name;
        }
        if (data.center && typeof data.center.col === 'number' && typeof data.center.row === 'number') {
            this.center = { col: data.center.col, row: data.center.row };
        }
        (data.parts || []).forEach((entry, index) => {
            const part = this.parts[index];
            if (!part || !entry || !entry.object || typeof part.object.applySerialized !== 'function') {
                return;
            }
            part.object.applySerialized(hotMapStoneWithAbsolutePoints(this.center, entry.object));
            part.local = this.captureLocal(part.object);
        });
    }
}

function hotMapStoneDelta(origin, point) {
    if (!point) {
        return null;
    }
    return {
        col: point.col - origin.col,
        row: point.row - origin.row
    };
}

function hotMapStoneWrapRad(angle) {
    const turn = Math.PI * 2;
    let value = angle % turn;
    if (value < 0) {
        value += turn;
    }
    return value;
}

function hotMapStoneEvenPhaseGoals(angles) {
    const count = angles.length;
    const step = (Math.PI * 2) / count;
    const wrapped = angles.map((angle, index) => ({
        index: index,
        angle: hotMapStoneWrapRad(angle)
    }));
    wrapped.sort((a, b) => a.angle - b.angle);
    let widest = -1;
    let cut = 0;
    for (let index = 0; index < count; index += 1) {
        const next = (index + 1) % count;
        const gap = next === 0
            ? (wrapped[0].angle + Math.PI * 2) - wrapped[index].angle
            : wrapped[next].angle - wrapped[index].angle;
        if (gap > widest) {
            widest = gap;
            cut = next;
        }
    }
    const ordered = [];
    for (let index = 0; index < count; index += 1) {
        ordered.push(wrapped[(cut + index) % count]);
    }
    const unwrapped = [ordered[0].angle];
    for (let index = 1; index < count; index += 1) {
        let angle = ordered[index].angle;
        while (angle < unwrapped[index - 1]) {
            angle += Math.PI * 2;
        }
        unwrapped.push(angle);
    }
    const mergeLimit = Math.min(15 * Math.PI / 180, step * 0.35);
    let merged = false;
    for (let index = 1; index < count; index += 1) {
        if (unwrapped[index] - unwrapped[index - 1] < mergeLimit) {
            merged = true;
        }
    }
    let start = 0;
    if (merged) {
        for (let index = 0; index < count; index += 1) {
            start += unwrapped[index];
        }
        start = start / count - ((count - 1) / 2) * step;
    } else {
        for (let index = 0; index < count; index += 1) {
            start += unwrapped[index] - index * step;
        }
        start /= count;
    }
    const goals = new Array(count);
    ordered.forEach((item, index) => {
        const slot = start + index * step;
        const current = angles[item.index];
        const turn = Math.atan2(Math.sin(slot - current), Math.cos(slot - current));
        goals[item.index] = current + turn;
    });
    return goals;
}

function hotMapStonePlace(point, origin, delta) {
    if (!point || !delta) {
        return;
    }
    point.col = origin.col + delta.col;
    point.row = origin.row + delta.row;
}

const HOT_MAP_STONE_SPAWN_SPEED = { min: 0.2, max: 8, step: 0.2 };
const HOT_MAP_STONE_BALL_INIT_KEYS = [
    'radius', 'energy', 'angleSpeed', 'phase', 'orbitRadius', 'tiltX', 'tiltY', 'tiltZ'
];
const HOT_MAP_STONE_POINT_KEYS = ['orbitCenter', 'orbitTarget', 'start', 'end', 'center', 'target'];

function hotMapStoneWithLocalPoints(raw, local) {
    const data = Object.assign({}, raw);
    HOT_MAP_STONE_POINT_KEYS.forEach((key) => {
        if (local && local[key]) {
            data[key] = { col: local[key].col, row: local[key].row };
        }
    });
    return data;
}

function hotMapStoneWithAbsolutePoints(origin, raw) {
    const data = Object.assign({}, raw);
    HOT_MAP_STONE_POINT_KEYS.forEach((key) => {
        const point = raw && raw[key];
        if (point && typeof point.col === 'number' && typeof point.row === 'number') {
            data[key] = {
                col: origin.col + point.col,
                row: origin.row + point.row
            };
        }
    });
    return data;
}
