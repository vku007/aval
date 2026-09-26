/**
 * UiShard
 * Skewed hot parallelogram that stamps into a shared UiHeatMap.
 * WIDTH, HEIGHT, ANGLE, SKEW, SHAPE, HEAT, and GLISTEN ease FROM → TO.
 * SHAPE is heat the parallelogram emits. HEAT is the glisten band.
 * SKEW 0 is a rectangle. GLISTEN 0 is the left edge and 100 is the right.
 */
let UI_SHARD_SEQ = 0;
const UI_EDITOR_SHARD_PARAM_KEYS = ['speed', 'delay', 'gap'];
const UI_EDITOR_SHARD_POSE_KEYS = ['width', 'height', 'angle', 'skew', 'shapeHeat', 'heat', 'glisten'];

class UiShard {
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
                { key: 'fromWidth', label: 'WIDTH', decimals: 0 },
                { key: 'fromHeight', label: 'HEIGHT', decimals: 0 },
                { key: 'fromAngle', label: 'ANGLE', decimals: 0 },
                { key: 'fromSkew', label: 'SKEW', decimals: 0 },
                { key: 'fromShapeHeat', label: 'SHAPE', decimals: 1 },
                { key: 'fromHeat', label: 'HEAT', decimals: 1 },
                { key: 'fromGlisten', label: 'GLISTEN', decimals: 0 }
            ]
        },
        {
            id: 'to',
            label: 'TO',
            rows: [
                { key: 'toWidth', label: 'WIDTH', decimals: 0 },
                { key: 'toHeight', label: 'HEIGHT', decimals: 0 },
                { key: 'toAngle', label: 'ANGLE', decimals: 0 },
                { key: 'toSkew', label: 'SKEW', decimals: 0 },
                { key: 'toShapeHeat', label: 'SHAPE', decimals: 1 },
                { key: 'toHeat', label: 'HEAT', decimals: 1 },
                { key: 'toGlisten', label: 'GLISTEN', decimals: 0 }
            ]
        }
    ];

    constructor(heatMap, options) {
        const opts = options || {};
        this.heatMap = heatMap;
        this.scene = heatMap.scene;
        this.kind = 'shard';
        UI_SHARD_SEQ += 1;
        this.name = opts.name || `Shard ${UI_SHARD_SEQ}`;
        this.emitter = createBackHighlightEmitterState(heatMap.field, opts);
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
            fromWidth: emitter.from.width,
            fromHeight: emitter.from.height,
            fromAngle: emitter.from.angle,
            fromSkew: emitter.from.skew,
            fromShapeHeat: emitter.from.shapeHeat,
            fromHeat: emitter.from.heat,
            fromGlisten: emitter.from.glisten,
            toWidth: emitter.to.width,
            toHeight: emitter.to.height,
            toAngle: emitter.to.angle,
            toSkew: emitter.to.skew,
            toShapeHeat: emitter.to.shapeHeat,
            toHeat: emitter.to.heat,
            toGlisten: emitter.to.glisten
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
            from: copyBackHighlightPose(emitter.from),
            to: copyBackHighlightPose(emitter.to),
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
        UI_EDITOR_SHARD_PARAM_KEYS.forEach((key) => {
            if (params[key] != null) {
                emitter.setParam(key, params[key]);
            }
        });
        UI_EDITOR_SHARD_POSE_KEYS.forEach((key) => {
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
}
