/**
 * Continuous item loops. The step functions call these, so the math stays
 * the one copy. centerFollow, travel, ballTravel, drama, and shared clocks
 * stay in the FX files until those animations become transitions.
 */
class Orbit {
    constructor(state) {
        this.state = state;
    }

    advance(dt) {
        advanceOrbit(this.state, dt);
    }

    reset() {
        const state = this.state;
        state.t = 0;
        state.angle = wrapPhaseDeg(state.params.phase) * Math.PI / 180;
        state.phaseGoal = null;
        state.phaseFollow = null;
    }

    copyStateFrom(other, shift) {
        const extra = typeof shift === 'number' ? shift : 0;
        this.state.t = other.state.t;
        this.state.angle = other.state.angle + extra;
    }
}

function advanceOrbit(state, dt) {
    state.angle += dt * state.params.angleSpeed;
}

class Follow {
    constructor(state) {
        this.state = state;
        this.homeCenter = { col: state.orbitCenter.col, row: state.orbitCenter.row };
        this.homeTarget = state.orbitTarget
            ? { col: state.orbitTarget.col, row: state.orbitTarget.row }
            : { col: state.orbitCenter.col, row: state.orbitCenter.row };
    }

    advance(dt) {
        advanceFollow(this.state, dt);
    }

    reset() {
        const state = this.state;
        state.orbitCenter.col = this.homeCenter.col;
        state.orbitCenter.row = this.homeCenter.row;
        if (!state.orbitTarget) {
            state.orbitTarget = { col: this.homeTarget.col, row: this.homeTarget.row };
        } else {
            state.orbitTarget.col = this.homeTarget.col;
            state.orbitTarget.row = this.homeTarget.row;
        }
        state.centerFollow = null;
    }

    copyStateFrom(other) {
        this.state.orbitCenter.col = other.state.orbitCenter.col;
        this.state.orbitCenter.row = other.state.orbitCenter.row;
        if (other.state.orbitTarget) {
            if (!this.state.orbitTarget) {
                this.state.orbitTarget = { col: 0, row: 0 };
            }
            this.state.orbitTarget.col = other.state.orbitTarget.col;
            this.state.orbitTarget.row = other.state.orbitTarget.row;
        }
        this.state.centerFollow = other.state.centerFollow;
    }
}

function advanceFollow(state, dt) {
    const follow = state.centerFollow != null ? state.centerFollow : ROTATED_HEAT_CENTER_FOLLOW;
    const k = 1 - Math.exp(-follow * dt);
    state.orbitCenter.col += (state.orbitTarget.col - state.orbitCenter.col) * k;
    state.orbitCenter.row += (state.orbitTarget.row - state.orbitCenter.row) * k;
    if (state.centerFollow != null) {
        const dx = state.orbitTarget.col - state.orbitCenter.col;
        const dy = state.orbitTarget.row - state.orbitCenter.row;
        if (dx * dx + dy * dy <= 0.25) {
            state.orbitCenter.col = state.orbitTarget.col;
            state.orbitCenter.row = state.orbitTarget.row;
            state.centerFollow = null;
        }
    }
}

class PathLoop {
    constructor(state) {
        this.state = state;
    }

    advance(delta) {
        advancePathLoop(this.state, delta);
    }

    reset() {
        const state = this.state;
        state.t = 0;
        state.phase = 'toEnd';
        state.waitLeft = 0;
        state.params.angle = state.startAngle;
        state.center.col = state.start.col;
        state.center.row = state.start.row;
        state.target.col = state.end.col;
        state.target.row = state.end.row;
    }

    copyStateFrom(other) {
        const src = other.state;
        const state = this.state;
        state.t = src.t;
        state.phase = src.phase;
        state.waitLeft = src.waitLeft;
        state.params.angle = src.params.angle;
        state.center.col = src.center.col;
        state.center.row = src.center.row;
        state.target.col = src.target.col;
        state.target.row = src.target.row;
    }
}

function advancePathLoop(state, delta) {
    const dt = Math.min(delta / 1000, 0.05);
    const start = state.start;
    const end = state.end;
    const startAngle = state.startAngle;
    const endAngle = state.endAngle;
    if (hotRodLoopIdle(state)) {
        snapHotRodTo(state, start, startAngle);
        return state.center;
    }
    if (state.phase === 'wait') {
        state.waitLeft -= dt;
        snapHotRodTo(state, end, endAngle);
        if (state.waitLeft <= 0) {
            beginHotRodStartHold(state);
        }
        return state.center;
    }
    if (state.phase === 'hold') {
        state.waitLeft -= dt;
        snapHotRodTo(state, start, startAngle);
        if (state.waitLeft <= 0) {
            state.phase = 'toEnd';
        }
        return state.center;
    }
    state.target.col = end.col;
    state.target.row = end.row;
    const k = hotRodFollowK(state, delta);
    stepHotRodMotion(state, delta);
    state.params.angle += (endAngle - state.params.angle) * k;
    if (hotRodPoseArrived(state, end, endAngle, 0.6, 1)) {
        snapHotRodTo(state, end, endAngle);
        state.waitLeft = Math.max(0, state.params.delay || 0);
        if (state.waitLeft <= 0) {
            beginHotRodStartHold(state);
        } else {
            state.phase = 'wait';
        }
    }
    return state.center;
}

class PoseCycle {
    constructor(state, options) {
        this.state = state;
        this.sheet = !!(options && options.sheet);
        this.homeCenter = state.center
            ? { col: state.center.col, row: state.center.row }
            : null;
    }

    advance(delta) {
        return advancePoseCycle(this.state, delta);
    }

    reset() {
        const state = this.state;
        state.current = this.sheet ? sheetHeatPose(state.from) : copyBackHighlightPose(state.from);
        state.phase = 'toEnd';
        state.waitLeft = 0;
        if (this.homeCenter && state.center) {
            state.center.col = this.homeCenter.col;
            state.center.row = this.homeCenter.row;
        }
    }

    copyStateFrom(other) {
        const src = other.state;
        const state = this.state;
        state.current = this.sheet ? sheetHeatPose(src.current) : copyBackHighlightPose(src.current);
        state.phase = src.phase;
        state.waitLeft = src.waitLeft;
        if (src.center && state.center) {
            state.center.col = src.center.col;
            state.center.row = src.center.row;
        }
    }
}

function advancePoseCycle(state, delta) {
    let dt = Math.min(Math.max(0, delta) / 1000, 0.05);
    if (posesMatch(state.from, state.to)) {
        state.current = copyBackHighlightPose(state.from);
        return state.current;
    }
    if (state.phase === 'wait') {
        state.waitLeft -= dt;
        state.current = copyBackHighlightPose(state.to);
        if (state.waitLeft > 0) {
            return state.current;
        }
        dt = -state.waitLeft;
        state.waitLeft = 0;
        if (state.cycling) {
            state.phase = 'toStart';
        } else {
            beginBackHighlightHold(state);
            if (state.phase === 'hold') {
                return state.current;
            }
        }
    }
    if (state.phase === 'hold') {
        state.waitLeft -= dt;
        state.current = copyBackHighlightPose(state.from);
        if (state.waitLeft > 0) {
            return state.current;
        }
        dt = -state.waitLeft;
        state.waitLeft = 0;
        state.phase = 'toEnd';
    }
    if (state.phase === 'toStart' && !state.cycling) {
        beginBackHighlightHold(state);
        return state.current;
    }
    if (dt <= 0) {
        return state.current;
    }
    const toward = state.phase === 'toStart' ? state.from : state.to;
    const k = 1 - Math.exp(-state.params.speed * dt);
    easeBackHighlightPose(state.current, toward, k);
    if (posesMatch(state.current, toward)) {
        if (state.phase === 'toStart') {
            beginBackHighlightHold(state);
        } else {
            arriveBackHighlightEnd(state);
        }
    }
    return state.current;
}

class Glisten {
    constructor(state) {
        this.state = state;
    }

    advance(delta) {
        advanceGlisten(this.state, delta);
    }

    reset() {
        this.state.glisten = 0;
        this.state.glistenPhase = 'run';
        this.state.glistenWait = 0;
    }

    copyStateFrom(other, shift) {
        const extra = typeof shift === 'number' ? shift : 0;
        this.state.glistenPhase = other.state.glistenPhase;
        this.state.glistenWait = other.state.glistenWait;
        this.state.glisten = other.state.glisten + extra;
    }
}

function advanceGlisten(state, delta) {
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

class BallRunner {
    constructor(state) {
        this.state = state;
    }

    advance(delta) {
        advanceBallRunner(this.state, delta);
    }

    reset() {
        this.state.ball = 0;
    }

    copyStateFrom(other, shift) {
        const extra = typeof shift === 'number' ? shift : 0;
        let ball = (other.state.ball + extra) % 1;
        if (ball < 0) {
            ball += 1;
        }
        this.state.ball = ball;
    }
}

function advanceBallRunner(state, delta) {
    const dt = Math.min(Math.max(0, delta) / 1000, 0.05);
    const speed = Math.max(0, state.params.ballSpeed || 0);
    if (speed <= 0) {
        return;
    }
    state.ball = (state.ball + speed * dt) % 1;
}

class DiskLoop {
    constructor(state) {
        this.state = state;
        this.homeLoop = state.loopAngle;
        this.homeRadius = state.radius;
        this.homeHeat = state.heat;
    }

    advance(dt) {
        advanceDiskLoop(this.state, dt);
    }

    reset() {
        const state = this.state;
        state.loopAngle = this.homeLoop;
        state.radius = this.homeRadius;
        state.heat = this.homeHeat;
        delete state.drama;
        delete state.ballTravel;
    }

    copyStateFrom(other, shift) {
        const extra = typeof shift === 'number' ? shift : 0;
        this.state.loopAngle = wrapNewSheetAngle(other.state.loopAngle + extra);
        const wave = 0.5 + 0.5 * Math.sin(this.state.loopAngle * Math.PI / 180);
        this.state.radius = this.state.radFrom + (this.state.radTo - this.state.radFrom) * wave;
        this.state.heat = this.state.heatFrom + (this.state.heatTo - this.state.heatFrom) * wave;
    }
}

function advanceDiskLoop(state, dt) {
    state.loopAngle = wrapNewSheetAngle(state.loopAngle + state.loopSpeed * dt);
    const wave = 0.5 + 0.5 * Math.sin(state.loopAngle * Math.PI / 180);
    state.radius = state.radFrom + (state.radTo - state.radFrom) * wave;
    state.heat = state.heatFrom + (state.heatTo - state.heatFrom) * wave;
}

class Spin {
    constructor(state) {
        this.state = state;
        this.homeAngle = state.angle;
        this.homeBallSpin = state.ballSpin;
    }

    advance(dt) {
        advanceSpin(this.state, dt);
    }

    reset() {
        this.state.angle = this.homeAngle;
        this.state.ballSpin = this.homeBallSpin;
    }

    copyStateFrom(other, shift) {
        const extra = typeof shift === 'number' ? shift : 0;
        this.state.angle = other.state.angle;
        this.state.ballSpin = wrapNewSheetAngle(other.state.ballSpin + extra);
    }
}

function advanceSpin(state, dt) {
    state.angle = wrapNewSheetAngle(state.angle + state.speed * dt);
    state.ballSpin = wrapNewSheetAngle(state.ballSpin + state.ballSpeed * dt);
}
