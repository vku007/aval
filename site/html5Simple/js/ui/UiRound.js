/**
 * UiRound
 * Filled hot disk that stamps into a shared UiHeatMap.
 * RADIUS and HEAT ease FROM → TO, pause DELAY, ease back when CYCLING
 * is on, pause GAP, then repeat.
 */
let UI_ROUND_SEQ = 0;
const UI_EDITOR_ROUND_PARAM_KEYS = ['speed', 'delay', 'gap'];
const UI_EDITOR_ROUND_POSE_KEYS = ['radius', 'heat'];

class UiRound extends HeatItem {
    static PROP_TABS = [
        {
            id: 'field',
            label: 'FIELD',
            rows: [
                { key: 'isVisible', label: 'VISIBLE', type: 'bool' },
                { key: 'cycling', label: 'CYCLING', type: 'bool' },
                { key: 'speed', label: 'SPEED', decimals: 1 },
                { key: 'delay', label: 'DELAY', decimals: 1 },
                { key: 'gap', label: 'GAP', decimals: 1 },
                { key: 'centerX', label: 'CENTER X%', decimals: 0 },
                { key: 'centerY', label: 'CENTER Y%', decimals: 0 }
            ]
        },
        {
            id: 'from',
            label: 'FROM',
            rows: [
                { key: 'fromRadius', label: 'RADIUS', decimals: 0 },
                { key: 'fromHeat', label: 'HEAT', decimals: 2 }
            ]
        },
        {
            id: 'to',
            label: 'TO',
            rows: [
                { key: 'toRadius', label: 'RADIUS', decimals: 0 },
                { key: 'toHeat', label: 'HEAT', decimals: 2 }
            ]
        }
    ];

    constructor(heatMap, options) {
        const opts = options || {};
        UI_ROUND_SEQ += 1;
        super({
            kind: 'round',
            name: opts.name || `Round ${UI_ROUND_SEQ}`,
            field: heatMap.field
        });
        this.heatMap = heatMap;
        this.scene = heatMap.scene;
        this.emitter = createRoundEmitterState(heatMap.field, opts);
        this.bindBehaviour('highlighters', this.emitter);
        this.loops = this.emitter.loops;
        heatMap.addHighlighter(this.emitter);
    }

    get isVisible() {
        return this.emitter.isVisible !== false;
    }

    set isVisible(value) {
        this.emitter.isVisible = !!value;
    }

    get params() {
        const emitter = this.emitter;
        const target = emitter.target;
        return Object.assign({}, emitter.params, {
            isVisible: this.isVisible,
            cycling: emitter.cycling !== false,
            centerX: hotRodCoordToPct(emitter, 'col', target.col),
            centerY: hotRodCoordToPct(emitter, 'row', target.row),
            fromRadius: emitter.from.radius,
            fromHeat: emitter.from.heat,
            toRadius: emitter.to.radius,
            toHeat: emitter.to.heat
        });
    }

    nudgeParam(key, dir) {
        if (key === 'isVisible') {
            this.isVisible = !this.isVisible;
            return this.isVisible;
        }
        if (key === 'centerX' || key === 'centerY') {
            return this.nudgeCenter(key === 'centerX' ? 'col' : 'row', dir);
        }
        return this.emitter.nudgeParam(key, dir);
    }

    nudgeCenter(axis, dir) {
        const point = this.emitter.target;
        const pct = hotRodCoordToPct(this.emitter, axis, point[axis]);
        const nextPct = Math.max(
            HOT_ROD_PATH_PCT_MIN,
            Math.min(HOT_ROD_PATH_PCT_MAX, pct + dir * HOT_ROD_PATH_PCT_STEP)
        );
        const next = { col: point.col, row: point.row };
        next[axis] = hotRodPctToCoord(this.emitter, axis, nextPct);
        this.emitter.setCenter(next);
        return nextPct;
    }

    serialize() {
        const emitter = this.emitter;
        return {
            name: this.name,
            isVisible: this.isVisible,
            cycling: emitter.cycling !== false,
            params: {
                speed: emitter.params.speed,
                delay: emitter.params.delay,
                gap: emitter.params.gap
            },
            from: {
                radius: emitter.from.radius,
                heat: emitter.from.heat
            },
            to: {
                radius: emitter.to.radius,
                heat: emitter.to.heat
            },
            center: copyOrbitPoint(emitter.center),
            target: copyOrbitPoint(emitter.target)
        };
    }

    applySerialized(data) {
        if (!data) {
            return;
        }
        if (data.name) {
            this.name = data.name;
        }
        this.isVisible = data.isVisible !== false;
        const emitter = this.emitter;
        emitter.cycling = data.cycling !== false;
        const params = data.params || {};
        UI_EDITOR_ROUND_PARAM_KEYS.forEach((key) => {
            if (params[key] != null) {
                emitter.setParam(key, params[key]);
            }
        });
        UI_EDITOR_ROUND_POSE_KEYS.forEach((key) => {
            const label = key.charAt(0).toUpperCase() + key.slice(1);
            if (data.from && data.from[key] != null) {
                emitter.setParam('from' + label, data.from[key]);
            }
            if (data.to && data.to[key] != null) {
                emitter.setParam('to' + label, data.to[key]);
            }
        });
        const target = copyOrbitPoint(data.target) || copyOrbitPoint(data.center);
        if (target) {
            emitter.setCenter(target);
            emitter.center.col = target.col;
            emitter.center.row = target.row;
        }
        emitter.current = copyBackHighlightPose(emitter.from);
        emitter.phase = 'toEnd';
        emitter.waitLeft = 0;
    }

    retarget(cell) {
        this.emitter.retarget(cell);
    }

    armHover() {
        armBackHighlightHover(this.emitter);
    }

    setHovered(on) {
        setBackHighlightHovered(this.emitter, !!on);
    }
}
