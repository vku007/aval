/**
 * UiCircle
 * Hot ring that stamps into a shared UiHeatMap.
 * OUTER and INNER share a center. INNER cannot exceed OUTER.
 * HEAT fills the ring between them and eases FROM → TO.
 * A glisten sweeps around the ring.
 */
let UI_CIRCLE_SEQ = 0;
const UI_EDITOR_CIRCLE_PARAM_KEYS = [
    'speed', 'delay', 'gap',
    'glistenSpeed', 'glistenDelay', 'glistenPower'
];
const UI_EDITOR_CIRCLE_POSE_KEYS = ['outer', 'inner', 'heat'];

class UiCircle extends HeatItem {
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
                { key: 'glistenOn', label: 'GLISTEN', type: 'bool' },
                { key: 'glistenSpeed', label: 'GL SPEED', decimals: 1 },
                { key: 'glistenDelay', label: 'GL DELAY', decimals: 1 },
                { key: 'glistenPower', label: 'GL POWER', decimals: 1 },
                { key: 'centerX', label: 'CENTER X%', decimals: 0 },
                { key: 'centerY', label: 'CENTER Y%', decimals: 0 }
            ]
        },
        {
            id: 'from',
            label: 'FROM',
            rows: [
                { key: 'fromOuter', label: 'OUTER', decimals: 0 },
                { key: 'fromInner', label: 'INNER', decimals: 0 },
                { key: 'fromHeat', label: 'HEAT', decimals: 2 }
            ]
        },
        {
            id: 'to',
            label: 'TO',
            rows: [
                { key: 'toOuter', label: 'OUTER', decimals: 0 },
                { key: 'toInner', label: 'INNER', decimals: 0 },
                { key: 'toHeat', label: 'HEAT', decimals: 2 }
            ]
        }
    ];

    constructor(heatMap, options) {
        const opts = options || {};
        UI_CIRCLE_SEQ += 1;
        super({
            kind: 'circle',
            name: opts.name || `Circle ${UI_CIRCLE_SEQ}`,
            field: heatMap.field
        });
        this.heatMap = heatMap;
        this.scene = heatMap.scene;
        this.emitter = createCircleEmitterState(heatMap.field, opts);
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
            glistenOn: emitter.glistenOn !== false,
            centerX: hotRodCoordToPct(emitter, 'col', target.col),
            centerY: hotRodCoordToPct(emitter, 'row', target.row),
            fromOuter: emitter.from.outer,
            fromInner: emitter.from.inner,
            fromHeat: emitter.from.heat,
            toOuter: emitter.to.outer,
            toInner: emitter.to.inner,
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
            glistenOn: emitter.glistenOn !== false,
            params: {
                speed: emitter.params.speed,
                delay: emitter.params.delay,
                gap: emitter.params.gap,
                glistenSpeed: emitter.params.glistenSpeed,
                glistenDelay: emitter.params.glistenDelay,
                glistenPower: emitter.params.glistenPower
            },
            from: {
                outer: emitter.from.outer,
                inner: emitter.from.inner,
                heat: emitter.from.heat
            },
            to: {
                outer: emitter.to.outer,
                inner: emitter.to.inner,
                heat: emitter.to.heat
            },
            center: copyOrbitPoint(emitter.center),
            target: copyOrbitPoint(emitter.target),
            glisten: emitter.glisten,
            glistenPhase: emitter.glistenPhase,
            glistenWait: emitter.glistenWait
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
        emitter.glistenOn = data.glistenOn !== false;
        const params = data.params || {};
        UI_EDITOR_CIRCLE_PARAM_KEYS.forEach((key) => {
            if (params[key] != null) {
                emitter.setParam(key, params[key]);
            }
        });
        UI_EDITOR_CIRCLE_POSE_KEYS.forEach((key) => {
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
        emitter.glisten = typeof data.glisten === 'number' ? data.glisten : 0;
        emitter.glistenPhase = data.glistenPhase === 'gap' ? 'gap' : 'run';
        emitter.glistenWait = typeof data.glistenWait === 'number' ? data.glistenWait : 0;
    }

    retarget(cell) {
        this.emitter.retarget(cell);
    }
}
