/**
 * UiCore
 * A composite on one center: one round, one circle, and up to nine balls.
 * An empty core gains the round, the circle, and one ball on the center.
 * The round's radius matches the circle's inner radius. The round is shown, then fades.
 * The ball keeps the preset orbit and rotates.
 * Two balls sit on the upper-left and lower-right of the square. Three balls share
 * the composite's row. Four balls take the square's corners: upper left, upper right,
 * lower left, and lower right. The fifth ball appears at the center and moves to the
 * upper left. The first ball takes the second ball's corner, the second takes the
 * third's, the third takes the fourth's, and the fourth moves to the center.
 * The sixth ball appears at the center and moves to the upper left. The fifth
 * moves to the lower left, the second to the middle of the upper edge, the third
 * to the upper right, the fourth to the lower right, and the first to the middle
 * of the lower edge. The seventh ball appears at the center and stays there.
 * The fourth moves to the middle of the lower edge, the sixth to the middle of
 * the upper edge, the second to the upper right, the third to the lower right,
 * the first to the lower left, and the fifth to the upper left. The eighth ball
 * appears at the center and moves to the middle of the left edge. The second
 * moves to the lower left, the first to the upper right, the fifth to the lower
 * right, the sixth to the middle of the lower edge, the third to the upper left,
 * the fourth to the middle of the upper edge, and the seventh to the middle of
 * the right edge. The ninth ball appears at the center and moves to the upper
 * left. The eighth moves to the center, the sixth to the lower left, the fourth
 * to the upper right, the seventh to the lower right, the fifth to the middle of
 * the lower edge, the third to the middle of the upper edge, the first to the
 * middle of the right edge, and the second to the middle of the left edge.
 * A tenth ball is refused. Removing the last ball also drops the round and the circle.
 * Part defaults are the Core entry in resources/core2.json.
 */
let UI_CORE_SEQ = 0;
const CORE_BALL_LIMIT = 9;
const CORE_BALL_RING = 0.8;
const CORE_SQUARE_SCALE = 0.8;
const CORE_BALL_SLIDE = 0.6;
const CORE_ROUND_FADE = 0.6;
const CORE_PRESET = {
    round: {
        isVisible: true,
        cycling: false,
        params: { speed: 1.2, delay: 0.5, gap: 0.4 },
        from: { radius: 56, heat: 0.45 },
        to: { radius: 60, heat: 1.8 }
    },
    circle: {
        isVisible: true,
        cycling: true,
        glistenOn: true,
        params: {
            speed: 1.2,
            delay: 0.5,
            gap: 0.4,
            glistenSpeed: 0.6,
            glistenDelay: 0.4,
            glistenPower: 0.1
        },
        from: { outer: 60, inner: 56, heat: 0 },
        to: { outer: 60, inner: 60, heat: 0.6 },
        glisten: 0,
        glistenPhase: 'gap',
        glistenWait: 0
    },
    ball: {
        isVisible: true,
        params: {
            radius: 4,
            energy: 3,
            angleSpeed: 8,
            orbitRadius: 3,
            tiltX: 30,
            tiltY: 0,
            tiltZ: 0,
            phase: 135
        },
        orbitOn: true
    }
};

class UiCore extends HeatComposite {
    static PROP_TABS = [
        coreItemTab('circle_', 'CIRCLE', UiCircle.PROP_TABS, ['centerX', 'centerY']),
        coreItemTab('round_', 'ROUND', UiRound.PROP_TABS, ['centerX', 'centerY']),
        coreItemTab('ball_', 'BALL', UiHotBall.PROP_TABS),
        {
            id: 'place',
            label: 'PLACE',
            rows: [
                { key: 'centerX', label: 'CENTER X%', decimals: 0 },
                { key: 'centerY', label: 'CENTER Y%', decimals: 0 },
                { key: 'addItem', label: 'ADD', button: 'ADD', type: 'action' },
                { key: 'removeItem', label: 'BALL', button: 'RMV', type: 'action' }
            ]
        }
    ];

    constructor(heatMap, options) {
        const opts = options || {};
        UI_CORE_SEQ += 1;
        const name = opts.name || `Core ${UI_CORE_SEQ}`;
        const cell = coreCell(heatMap.field, opts);
        super(heatMap, {
            kind: 'core',
            name: name,
            center: { col: cell.col, row: cell.row },
            exitInstant: true
        });
        this.scene = heatMap.scene;
        this._visible = opts.isVisible !== false;
        this.round = null;
        this.circle = null;
        this.ball = null;
        this.addItem();
    }

    get isVisible() {
        return this._visible !== false;
    }

    set isVisible(value) {
        this._visible = !!value;
        this.items.forEach((item) => {
            item.isVisible = this._visible;
        });
    }

    balls() {
        return this.items.filter((item) => item && item.kind === 'hot-ball');
    }

    afterAdd() {}

    afterRemove() {}

    get params() {
        const stub = coreFieldStub(this.heatMap.field);
        const values = {
            centerX: hotRodCoordToPct(stub, 'col', this.center.col),
            centerY: hotRodCoordToPct(stub, 'row', this.center.row)
        };
        copyPrefixedParams(values, 'circle_', this.circle);
        copyPrefixedParams(values, 'round_', this.round);
        copyPrefixedParams(values, 'ball_', this.ball);
        return values;
    }

    nudgeParam(key, dir) {
        if (key === 'centerX' || key === 'centerY') {
            return this.nudgeCenter(key === 'centerX' ? 'col' : 'row', dir);
        }
        const routed = coreRoute(key);
        if (!routed) {
            return this.params[key];
        }
        const items = this.routedItems(routed.prefix);
        if (!items.length) {
            return 0;
        }
        if (routed.prefix === 'ball_' && routed.key !== 'phase') {
            let value = 0;
            items.forEach((item) => {
                value = item.nudgeParam(routed.key, dir);
            });
            return value;
        }
        return items[0].nudgeParam(routed.key, dir);
    }

    setParam(key, value) {
        if (key === 'centerX' || key === 'centerY') {
            const axis = key === 'centerX' ? 'col' : 'row';
            const stub = coreFieldStub(this.heatMap.field);
            const next = { col: this.center.col, row: this.center.row };
            next[axis] = hotRodPctToCoord(stub, axis, value);
            this.setCenter(next);
            return this.params[key];
        }
        const routed = coreRoute(key);
        if (!routed) {
            return this.params[key];
        }
        this.routedItems(routed.prefix).forEach((item) => {
            coreWriteItem(item, routed.key, value);
        });
        return this.params[key];
    }

    nudgeCenter(axis, dir) {
        const stub = coreFieldStub(this.heatMap.field);
        const pct = hotRodCoordToPct(stub, axis, this.center[axis]);
        const nextPct = Math.max(
            HOT_ROD_PATH_PCT_MIN,
            Math.min(HOT_ROD_PATH_PCT_MAX, pct + dir * HOT_ROD_PATH_PCT_STEP)
        );
        const next = { col: this.center.col, row: this.center.row };
        next[axis] = hotRodPctToCoord(stub, axis, nextPct);
        this.setCenter(next);
        return nextPct;
    }

    setCenter(point) {
        const stub = coreFieldStub(this.heatMap.field);
        const cell = clampHotRodPoint(stub, point || this.center);
        this.center.col = cell.col;
        this.center.row = cell.row;
        if (this.round) {
            corePlaceEmitter(this.round.emitter, cell);
        }
        if (this.circle) {
            corePlaceEmitter(this.circle.emitter, cell);
        }
        this.balls().forEach((ball) => corePlaceBall(ball, cell));
        return this.center;
    }

    retarget(cell) {
        return this.setCenter(cell);
    }

    addItem(opts) {
        const animate = !opts || opts.animate !== false;
        if (!this.parts.length) {
            const name = this.name;
            this.round = new UiRound(this.heatMap, {
                name: `${name} Round`,
                isVisible: this._visible
            });
            this.circle = new UiCircle(this.heatMap, {
                name: `${name} Circle`,
                isVisible: this._visible
            });
            this.ball = new UiHotBall(this.heatMap, {
                name: `${name} Ball`,
                isVisible: this._visible
            });
            this.adopt(this.round);
            this.adopt(this.circle);
            this.adopt(this.ball);
            this.paintDefaults();
            this.setCenter(this.center);
            if (animate) {
                this.fadeRound(this.round);
            }
            return this.ball;
        }
        const existing = this.balls();
        if (existing.length >= CORE_BALL_LIMIT) {
            return null;
        }
        const lead = this.ball || existing[0];
        const ball = new UiHotBall(this.heatMap, {
            name: `${this.name} Ball ${existing.length + 1}`,
            isVisible: this._visible
        });
        if (lead) {
            const data = lead.serialize();
            data.name = ball.name;
            ball.applySerialized(data);
            ball.copyBehaviourState(lead);
        }
        this.adopt(ball);
        this.balls().forEach((item) => corePlaceBall(item, this.center));
        if (animate) {
            this.placeBalls();
        }
        return ball;
    }

    placeBalls() {
        const balls = this.balls();
        this.ballTargets(balls.length).forEach((to, index) => {
            this.slideBall(balls[index], to);
        });
    }

    ballTargets(count) {
        const span = this.ballSpan();
        if (count === 1) {
            return [{ col: 0, row: 0 }];
        }
        if (count === 2) {
            return [
                { col: -span, row: -span },
                { col: span, row: span }
            ];
        }
        if (count === 3) {
            return [
                { col: -span, row: 0 },
                { col: span, row: 0 },
                { col: 0, row: 0 }
            ];
        }
        if (count === 4) {
            return [
                { col: -span, row: -span },
                { col: span, row: -span },
                { col: -span, row: span },
                { col: span, row: span }
            ];
        }
        if (count === 5) {
            return [
                { col: span, row: -span },
                { col: -span, row: span },
                { col: span, row: span },
                { col: 0, row: 0 },
                { col: -span, row: -span }
            ];
        }
        if (count === 6) {
            return [
                { col: 0, row: span },
                { col: 0, row: -span },
                { col: span, row: -span },
                { col: span, row: span },
                { col: -span, row: span },
                { col: -span, row: -span }
            ];
        }
        if (count === 7) {
            return [
                { col: -span, row: span },
                { col: span, row: -span },
                { col: span, row: span },
                { col: 0, row: span },
                { col: -span, row: -span },
                { col: 0, row: -span },
                { col: 0, row: 0 }
            ];
        }
        if (count === 8) {
            return [
                { col: span, row: -span },
                { col: -span, row: span },
                { col: -span, row: -span },
                { col: 0, row: -span },
                { col: span, row: span },
                { col: 0, row: span },
                { col: span, row: 0 },
                { col: -span, row: 0 }
            ];
        }
        if (count === 9) {
            return [
                { col: span, row: 0 },
                { col: -span, row: 0 },
                { col: 0, row: -span },
                { col: span, row: -span },
                { col: 0, row: span },
                { col: -span, row: span },
                { col: span, row: span },
                { col: 0, row: 0 },
                { col: -span, row: -span }
            ];
        }
        return [];
    }

    paintDefaults() {
        if (this.circle) {
            const circle = coreCopyPreset(CORE_PRESET.circle);
            circle.name = this.circle.name;
            this.circle.applySerialized(circle);
            this.circle.isVisible = this._visible && circle.isVisible !== false;
        }
        if (this.round) {
            const round = coreCopyPreset(CORE_PRESET.round);
            round.name = this.round.name;
            if (this.circle && this.circle.emitter) {
                round.from.radius = this.circle.emitter.from.inner;
                round.to.radius = this.circle.emitter.to.inner;
            }
            this.round.applySerialized(round);
            this.round.isVisible = this._visible;
        }
        this.balls().forEach((ball) => {
            const preset = coreCopyPreset(CORE_PRESET.ball);
            preset.name = ball.name;
            ball.applySerialized(preset);
            ball.isVisible = this._visible && preset.isVisible !== false;
            corePlaceBall(ball, this.center);
        });
    }

    fadeRound(round) {
        if (!round || typeof round.play !== 'function') {
            return null;
        }
        round.isVisible = true;
        round.define('enter', fade({
            from: 1,
            to: 0,
            duration: CORE_ROUND_FADE,
            ease: 'sine',
            slot: 'life',
            fill: 'hold'
        }));
        return round.play('enter');
    }

    ballSpan() {
        const emitter = this.circle && this.circle.emitter;
        const pose = emitter && (emitter.current || emitter.from);
        const inner = pose && typeof pose.inner === 'number' ? pose.inner : 0;
        return Math.max(0, inner) * CORE_BALL_RING * CORE_SQUARE_SCALE / Math.SQRT2;
    }

    slideBall(ball, to) {
        if (!ball || typeof ball.play !== 'function') {
            return null;
        }
        ball.define('place', move({
            from: 'current',
            to: to,
            duration: CORE_BALL_SLIDE,
            ease: 'sine',
            slot: 'move',
            fill: 'hold'
        }));
        return ball.play('place');
    }

    removeItem() {
        const list = this.balls();
        if (!list.length) {
            return null;
        }
        const ball = list[list.length - 1];
        const last = list.length === 1;
        this.dropOwned(ball);
        if (last) {
            this.dropOwned(this.round);
            this.dropOwned(this.circle);
        } else {
            const left = this.balls();
            this.ballTargets(left.length).forEach((to, index) => {
                this.slideBall(left[index], to);
            });
        }
        return ball;
    }

    adopt(object) {
        if (!object || this.parts.some((part) => part.object === object)) {
            return object;
        }
        this.parts.push({ object: object });
        object.parent = this;
        if (typeof this.onPartAdded === 'function') {
            this.onPartAdded(object);
        }
        this.emit('added', object);
        return object;
    }

    dropOwned(object) {
        if (!object) {
            return;
        }
        this.dropItem(object);
        if (this.round === object) {
            this.round = null;
        }
        if (this.circle === object) {
            this.circle = null;
        }
        if (this.ball === object) {
            const left = this.balls();
            this.ball = left.length ? left[0] : null;
        }
    }

    releaseContents() {
        const parts = this.parts.map((part) => part.object);
        parts.forEach((object) => this.dropOwned(object));
    }

    routedItems(prefix) {
        if (prefix === 'circle_') {
            return this.circle ? [this.circle] : [];
        }
        if (prefix === 'round_') {
            return this.round ? [this.round] : [];
        }
        if (prefix === 'ball_') {
            return this.balls();
        }
        return [];
    }

    serialize() {
        return {
            name: this.name,
            isVisible: this.isVisible,
            center: copyOrbitPoint(this.center),
            target: copyOrbitPoint(this.center),
            round: this.round ? this.round.serialize() : null,
            circle: this.circle ? this.circle.serialize() : null,
            ball: this.ball ? this.ball.serialize() : null,
            balls: this.balls().map((ball) => ball.serialize())
        };
    }

    applySerialized(data) {
        if (!data) {
            return;
        }
        if (data.name) {
            this.name = data.name;
        }
        if (data.isVisible != null) {
            this._visible = data.isVisible !== false;
        }
        const specs = Array.isArray(data.balls)
            ? data.balls
            : (data.ball ? [data.ball] : null);
        if (this.round && typeof this.round.cancelAll === 'function') {
            this.round.cancelAll();
        }
        this.balls().forEach((ball) => {
            if (typeof ball.cancelAll === 'function') {
                ball.cancelAll();
            }
        });
        const quiet = { animate: false };
        if (specs) {
            if (!this.parts.length && specs.length) {
                this.addItem(quiet);
            }
            while (this.balls().length > specs.length) {
                this.removeItem();
            }
            while (this.balls().length < specs.length) {
                if (!this.addItem(quiet)) {
                    break;
                }
            }
        }
        if ((data.round || data.circle) && !this.parts.length) {
            this.addItem(quiet);
        }
        this.isVisible = this._visible;
        if (this.round && data.round) {
            this.round.applySerialized(data.round);
        }
        if (this.circle && data.circle) {
            this.circle.applySerialized(data.circle);
        }
        if (specs) {
            this.balls().forEach((ball, index) => {
                if (specs[index]) {
                    ball.applySerialized(specs[index]);
                }
            });
            this.ball = this.balls()[0] || null;
        } else if (this.ball && data.ball) {
            this.ball.applySerialized(data.ball);
        }
        const center = copyOrbitPoint(data.target) || copyOrbitPoint(data.center);
        if (center) {
            this.setCenter(center);
        } else {
            this.setCenter(this.center);
        }
    }
}

UiCore.ADD_TABS = [
    {
        id: 'add',
        rows: [
            { key: 'addItem', label: 'ADD', button: 'ADD', type: 'action' }
        ]
    }
];

UiCore.REMOVE_TABS = [
    {
        id: 'remove',
        rows: [
            { key: 'removeItem', label: 'BALL', button: 'RMV', type: 'action' }
        ]
    }
];

function coreItemTab(prefix, label, tabs, skip) {
    const omit = skip || [];
    const rows = [];
    (tabs || []).forEach((tab) => {
        (tab.rows || []).forEach((row) => {
            if (omit.indexOf(row.key) >= 0) {
                return;
            }
            rows.push(Object.assign({}, row, { key: prefix + row.key }));
        });
    });
    return { id: prefix + 'props', label: label, rows: rows };
}

function coreRoute(key) {
    if (key.indexOf('circle_') === 0) {
        return { prefix: 'circle_', key: key.slice('circle_'.length) };
    }
    if (key.indexOf('round_') === 0) {
        return { prefix: 'round_', key: key.slice('round_'.length) };
    }
    if (key.indexOf('ball_') === 0) {
        return { prefix: 'ball_', key: key.slice('ball_'.length) };
    }
    return null;
}

function copyPrefixedParams(values, prefix, item) {
    if (!item || !item.params) {
        return;
    }
    const source = item.params;
    Object.keys(source).forEach((key) => {
        values[prefix + key] = source[key];
    });
}

function coreWriteItem(item, key, value) {
    if (!item) {
        return;
    }
    if (key === 'isVisible' || key === 'cycling' || key === 'glistenOn') {
        if (key === 'isVisible') {
            item.isVisible = !!value;
            return;
        }
        if (item.emitter) {
            item.emitter[key] = !!value;
        }
        return;
    }
    if ((key === 'centerX' || key === 'centerY') && item.emitter && typeof item.emitter.setCenter === 'function') {
        const axis = key === 'centerX' ? 'col' : 'row';
        const next = {
            col: item.emitter.target.col,
            row: item.emitter.target.row
        };
        next[axis] = hotRodPctToCoord(item.emitter, axis, value);
        item.emitter.setCenter(next);
        item.emitter.center.col = next.col;
        item.emitter.center.row = next.row;
        return;
    }
    if (item.emitter && typeof item.emitter.setParam === 'function') {
        item.emitter.setParam(key, value);
        return;
    }
    if (item.motion && typeof item.motion.setParam === 'function') {
        item.motion.setParam(key, value);
    }
}

function corePlaceEmitter(emitter, cell) {
    if (!emitter) {
        return;
    }
    emitter.center.col = cell.col;
    emitter.center.row = cell.row;
    emitter.target.col = cell.col;
    emitter.target.row = cell.row;
}

function corePlaceBall(ball, cell) {
    if (!ball || !ball.motion) {
        return;
    }
    const motion = ball.motion;
    motion.orbitCenter.col = cell.col;
    motion.orbitCenter.row = cell.row;
    if (!motion.orbitTarget) {
        motion.orbitTarget = { col: cell.col, row: cell.row };
    } else {
        motion.orbitTarget.col = cell.col;
        motion.orbitTarget.row = cell.row;
    }
}

function coreCopyPreset(value) {
    return JSON.parse(JSON.stringify(value));
}

function coreFieldStub(field) {
    return { cols: field.cols, rows: field.rows };
}

function coreCell(field, opts) {
    const stub = coreFieldStub(field);
    const cell = {
        col: (field.cols - 1) * 0.5,
        row: (field.rows - 1) * 0.5
    };
    if (opts.center && typeof opts.center.col === 'number' && typeof opts.center.row === 'number') {
        cell.col = opts.center.col;
        cell.row = opts.center.row;
        return cell;
    }
    if (opts.centerX != null) {
        cell.col = hotRodPctToCoord(stub, 'col', opts.centerX);
    }
    if (opts.centerY != null) {
        cell.row = hotRodPctToCoord(stub, 'row', opts.centerY);
    }
    return cell;
}
