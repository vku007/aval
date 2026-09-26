/**
 * UiSheet
 * Cosine hot sheet that stamps into a shared UiHeatMap.
 * WIDTH, HEIGHT, SKEW, BEND, PHASE, and HEAT ease FROM → TO.
 * Glisten sweeps along the curve. Two hot dots run the centerline.
 * DIFFUSE and COOL stay on the shared heat field.
 */
let UI_SHEET_SEQ = 0;
const UI_EDITOR_SHEET_PARAM_KEYS = [
    'speed', 'delay', 'gap',
    'glistenSpeed', 'glistenDelay', 'glistenPower',
    'radius', 'energy', 'ballSpeed', 'ballDelta'
];

class UiSheet {
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
                { key: 'glistenPower', label: 'GL POWER', decimals: 1 }
            ]
        },
        {
            id: 'ball',
            label: 'BALL',
            rows: [
                { key: 'centerX', label: 'CENTER X%', decimals: 0 },
                { key: 'centerY', label: 'CENTER Y%', decimals: 0 },
                { key: 'radius', label: 'DOT SIZE', decimals: 1 },
                { key: 'energy', label: 'DOT HEAT', decimals: 1 },
                { key: 'ballSpeed', label: 'SPEED', decimals: 2 },
                { key: 'ballDelta', label: 'DELTA', decimals: 0 }
            ]
        },
        {
            id: 'from',
            label: 'FROM',
            rows: [
                { key: 'fromWidth', label: 'WIDTH', decimals: 0 },
                { key: 'fromHeight', label: 'HEIGHT', decimals: 0 },
                { key: 'fromSkew', label: 'SKEW', decimals: 0 },
                { key: 'fromBend', label: 'BEND', decimals: 0 },
                { key: 'fromCosine', label: 'PHASE', decimals: 0 },
                { key: 'fromHeat', label: 'HEAT', decimals: 1 }
            ]
        },
        {
            id: 'to',
            label: 'TO',
            rows: [
                { key: 'toWidth', label: 'WIDTH', decimals: 0 },
                { key: 'toHeight', label: 'HEIGHT', decimals: 0 },
                { key: 'toSkew', label: 'SKEW', decimals: 0 },
                { key: 'toBend', label: 'BEND', decimals: 0 },
                { key: 'toCosine', label: 'PHASE', decimals: 0 },
                { key: 'toHeat', label: 'HEAT', decimals: 1 }
            ]
        }
    ];

    constructor(heatMap, options) {
        const opts = options || {};
        this.heatMap = heatMap;
        this.scene = heatMap.scene;
        this.kind = 'sheet';
        UI_SHEET_SEQ += 1;
        this.name = opts.name || `Sheet ${UI_SHEET_SEQ}`;
        this.emitter = createSheetEmitterState(heatMap.field, opts);
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
            fromWidth: emitter.from.width,
            fromHeight: emitter.from.height,
            fromSkew: emitter.from.skew,
            fromBend: emitter.from.bend,
            fromCosine: emitter.from.cosine,
            fromHeat: emitter.from.heat,
            toWidth: emitter.to.width,
            toHeight: emitter.to.height,
            toSkew: emitter.to.skew,
            toBend: emitter.to.bend,
            toCosine: emitter.to.cosine,
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
            glistenOn: emitter.glistenHold
                ? emitter.glistenAfterMove !== false
                : emitter.glistenOn !== false,
            params: {
                speed: emitter.params.speed,
                delay: emitter.params.delay,
                gap: emitter.params.gap,
                glistenSpeed: emitter.params.glistenSpeed,
                glistenDelay: emitter.params.glistenDelay,
                glistenPower: emitter.params.glistenPower,
                radius: emitter.params.radius,
                energy: emitter.params.energy,
                ballSpeed: emitter.params.ballSpeed,
                ballDelta: emitter.params.ballDelta
            },
            from: mergeSheetPose(emitter.from),
            to: mergeSheetPose(emitter.to),
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
        emitter.glistenOn = data.glistenOn !== false;
        const params = data.params || {};
        UI_EDITOR_SHEET_PARAM_KEYS.forEach((key) => {
            if (params[key] != null) {
                emitter.setParam(key, params[key]);
            }
        });
        SHEET_EMITTER_POSE_PROPS.forEach((key) => {
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
        emitter.current = sheetHeatPose(emitter.from);
        emitter.phase = 'toEnd';
        emitter.waitLeft = 0;
        emitter.glisten = 0;
        emitter.glistenPhase = 'run';
        emitter.glistenWait = 0;
        emitter.ball = 0;
    }

    retarget(cell) {
        this.emitter.retarget(cell);
    }
}
