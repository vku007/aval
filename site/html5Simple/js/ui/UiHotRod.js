/**
 * UiHotRod
 * Infinite hot-line emitter that stamps into a shared UiHeatMap.
 * Loops start pose → end pose, waits DELAY, snaps back, waits GAP, repeats.
 */
let UI_HOT_ROD_SEQ = 0;
const UI_EDITOR_ROD_PARAM_KEYS = [
    'thickness', 'energy', 'followSpeed', 'delay', 'gap',
    'noiseAmt', 'noiseGrain', 'noiseFlicker'
];
const UI_EDITOR_ROD_PATH_KEYS = {
    startX: { key: 'start', axis: 'col' },
    startY: { key: 'start', axis: 'row' },
    endX: { key: 'end', axis: 'col' },
    endY: { key: 'end', axis: 'row' }
};

class UiHotRod {
    static PROP_TABS = [
        {
            id: 'heat',
            label: 'HEAT',
            rows: [
                { key: 'isVisible', label: 'VISIBLE', type: 'bool' },
                { key: 'energy', label: 'LINE HEAT', decimals: 1 }
            ]
        },
        {
            id: 'geo',
            label: 'GEO',
            rows: [
                { key: 'thickness', label: 'THICKNESS', decimals: 1 },
                { key: 'noiseAmt', label: 'NOISE', decimals: 1 },
                { key: 'noiseGrain', label: 'GRAIN', decimals: 1 },
                { key: 'noiseFlicker', label: 'FLICKER', decimals: 1 }
            ]
        },
        {
            id: 'move',
            label: 'MOVE',
            rows: [
                { key: 'followSpeed', label: 'SPEED', decimals: 1 },
                { key: 'delay', label: 'DELAY', decimals: 1 },
                { key: 'gap', label: 'GAP', decimals: 1 },
                { key: 'startX', label: 'START X%', decimals: 0 },
                { key: 'startY', label: 'START Y%', decimals: 0 },
                { key: 'endX', label: 'END X%', decimals: 0 },
                { key: 'endY', label: 'END Y%', decimals: 0 },
                { key: 'startAngle', label: 'START ANG', decimals: 0 },
                { key: 'endAngle', label: 'END ANG', decimals: 0 }
            ]
        }
    ];

    constructor(heatMap, options) {
        const opts = options || {};
        this.heatMap = heatMap;
        this.scene = heatMap.scene;
        this.kind = 'hot-rod';
        UI_HOT_ROD_SEQ += 1;
        this.name = opts.name || `Hot Rod ${UI_HOT_ROD_SEQ}`;
        this.emitter = createHotRodEmitterState(heatMap.field, Object.assign({
            isVisible: true,
            loopOn: true
        }, opts));
        heatMap.addRod(this.emitter);
    }

    get isVisible() {
        return this.emitter.isVisible !== false;
    }

    set isVisible(value) {
        this.emitter.isVisible = !!value;
    }

    get params() {
        const start = this.emitter.start;
        const end = this.emitter.end;
        return Object.assign({}, this.emitter.params, {
            isVisible: this.isVisible,
            startX: hotRodCoordToPct(this.emitter, 'col', start.col),
            startY: hotRodCoordToPct(this.emitter, 'row', start.row),
            endX: hotRodCoordToPct(this.emitter, 'col', end.col),
            endY: hotRodCoordToPct(this.emitter, 'row', end.row),
            startAngle: this.emitter.startAngle,
            endAngle: this.emitter.endAngle
        });
    }

    nudgeParam(key, dir) {
        if (key === 'isVisible') {
            this.isVisible = !this.isVisible;
            return this.isVisible;
        }
        const path = UI_EDITOR_ROD_PATH_KEYS[key];
        if (path) {
            return this.nudgePath(path.key, path.axis, dir);
        }
        return this.emitter.nudgeParam(key, dir);
    }

    nudgePath(which, axis, dir) {
        const point = which === 'start' ? this.emitter.start : this.emitter.end;
        const pct = hotRodCoordToPct(this.emitter, axis, point[axis]);
        const nextPct = Math.max(
            HOT_ROD_PATH_PCT_MIN,
            Math.min(HOT_ROD_PATH_PCT_MAX, pct + dir * HOT_ROD_PATH_PCT_STEP)
        );
        const next = { col: point.col, row: point.row };
        next[axis] = hotRodPctToCoord(this.emitter, axis, nextPct);
        this.emitter.setPathPoint(which, next);
        return nextPct;
    }

    serialize() {
        const emitter = this.emitter;
        return {
            name: this.name,
            isVisible: this.isVisible,
            params: Object.assign({}, emitter.params),
            startAngle: emitter.startAngle,
            endAngle: emitter.endAngle,
            start: copyOrbitPoint(emitter.start),
            end: copyOrbitPoint(emitter.end),
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
        const params = data.params || {};
        UI_EDITOR_ROD_PARAM_KEYS.forEach((key) => {
            if (params[key] != null) {
                this.emitter.setParam(key, params[key]);
            }
        });
        const start = copyOrbitPoint(data.start);
        if (start) {
            this.emitter.setPathPoint('start', start);
        }
        const end = copyOrbitPoint(data.end);
        if (end) {
            this.emitter.setPathPoint('end', end);
        }
        const startAngle = data.startAngle != null ? data.startAngle : params.startAngle;
        const endAngle = data.endAngle != null ? data.endAngle : params.endAngle;
        if (startAngle != null) {
            this.emitter.setParam('startAngle', startAngle);
        }
        if (endAngle != null) {
            this.emitter.setParam('endAngle', endAngle);
        }
        this.emitter.phase = 'toEnd';
        this.emitter.waitLeft = 0;
        const liveStart = copyOrbitPoint(this.emitter.start);
        const liveEnd = copyOrbitPoint(this.emitter.end);
        if (liveStart) {
            this.emitter.center = liveStart;
        }
        if (liveEnd) {
            this.emitter.target = liveEnd;
        }
        this.emitter.params.angle = this.emitter.startAngle;
    }

    retarget(cell) {
        this.emitter.retarget(cell);
    }
}
