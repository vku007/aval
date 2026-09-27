/**
 * HotMapUiStone
 * One heat-map group. Parts keep offsets from the stone center.
 * Setting the center moves every part by the same amount.
 */
class HotMapUiStone extends HotMapUiComposite {
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
            id: 'item',
            label: 'ITEM',
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
                { key: 'spawnSpeed', label: 'SPAWN SPEED', decimals: 1 }
            ]
        },
        {
            id: 'trans',
            label: 'TRANS',
            rows: [
                { key: 'addItem', label: 'BALL', button: 'ADD', type: 'action' },
                { key: 'removeItem', label: 'BALL', button: 'RMV', type: 'action' }
            ]
        }
    ];

    constructor(heatMap, options) {
        const opts = options || {};
        const preset = HOT_MAP_STONE_PRESET;
        super(heatMap, {
            kind: 'hot-map-stone',
            name: opts.name || preset.name,
            center: opts.center || preset.center,
            spawn: opts.spawn || preset.spawn
        });
        this.ballInit = defaultRotatedHotBallParams(preset.ballInit);
        this.spawnSpeed = preset.spawnSpeed;
    }

    get params() {
        const values = this.placeParams();
        values.spawnSpeed = this.spawnSpeed;
        HOT_MAP_STONE_BALL_INIT_KEYS.forEach((key) => {
            values['newBallInit_' + key] = this.ballInit[key];
        });
        return values;
    }

    nudgeParam(key, dir) {
        const placed = this.nudgePlace(key, dir);
        if (placed !== undefined) {
            return placed;
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

    addItem() {
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

    removeItem() {
        const object = this.takeLast('hot-ball');
        if (!object) {
            return null;
        }
        if (this.heatMap && typeof this.heatMap.removeBall === 'function') {
            this.heatMap.removeBall(object.motion);
        }
        if (typeof this.onPartRemoved === 'function') {
            this.onPartRemoved(object);
        }
        return object;
    }

    extendSerialized(data) {
        const ballInit = {};
        HOT_MAP_STONE_BALL_INIT_KEYS.forEach((key) => {
            ballInit[key] = this.ballInit[key];
        });
        data.spawnSpeed = this.spawnSpeed;
        data.ballInit = ballInit;
        return data;
    }

    applySerializedExtras(data) {
        if (typeof data.spawnSpeed === 'number') {
            this.spawnSpeed = data.spawnSpeed;
        }
        if (data.ballInit) {
            HOT_MAP_STONE_BALL_INIT_KEYS.forEach((key) => {
                if (typeof data.ballInit[key] === 'number') {
                    this.ballInit[key] = data.ballInit[key];
                }
            });
        }
    }
}

HotMapUiStone.ADD_TABS = [
    {
        id: 'add',
        rows: [
            { key: 'spawnX', label: 'SPAWN X', decimals: 1 },
            { key: 'spawnY', label: 'SPAWN Y', decimals: 1 },
            { key: 'spawnSpeed', label: 'SPEED', decimals: 1 },
            { key: 'addItem', label: 'BALL', button: 'ADD', type: 'action' }
        ]
    }
];

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

const HOT_MAP_STONE_PRESET = {
    name: 'Stone',
    center: { col: 54.5, row: 178 },
    spawn: { col: 36, row: 0 },
    spawnSpeed: 1.2,
    ballInit: {
        radius: 3.4,
        energy: 1.5,
        angleSpeed: 1.6,
        phase: 0,
        orbitRadius: 40,
        tiltX: 40,
        tiltY: 0,
        tiltZ: 0
    }
};

const HOT_MAP_STONE_SPAWN_SPEED = { min: 0.2, max: 8, step: 0.2 };
const HOT_MAP_STONE_BALL_INIT_KEYS = [
    'radius', 'energy', 'angleSpeed', 'phase', 'orbitRadius', 'tiltX', 'tiltY', 'tiltZ'
];
