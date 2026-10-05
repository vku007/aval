/**
 * UiPointer
 * Hot triangle that stamps into a shared UiHeatMap, posed like a shard.
 * SHAPE is heat the triangle emits. HEAT is the glisten bands.
 * Three glistens run from a side to the opposite corner. Each has an on/off flag.
 */
let UI_POINTER_SEQ = 0;
const UI_EDITOR_POINTER_PARAM_KEYS = ['speed', 'delay', 'gap', 'glistenSpeed', 'glistenDelay'];
const UI_EDITOR_POINTER_POSE_KEYS = ['width', 'height', 'angle', 'skew', 'shapeHeat', 'heat'];
const UI_EDITOR_POINTER_FLAGS = ['apexOn', 'leftOn', 'rightOn'];

class UiPointer extends HeatItem {
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
                { key: 'apexOn', label: 'APEX', type: 'bool' },
                { key: 'leftOn', label: 'LEFT', type: 'bool' },
                { key: 'rightOn', label: 'RIGHT', type: 'bool' },
                { key: 'glistenSpeed', label: 'GL SPEED', decimals: 1 },
                { key: 'glistenDelay', label: 'GL DELAY', decimals: 1 },
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
                { key: 'fromHeat', label: 'HEAT', decimals: 1 }
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
                { key: 'toHeat', label: 'HEAT', decimals: 1 }
            ]
        }
    ];

    constructor(heatMap, options) {
        const opts = options || {};
        UI_POINTER_SEQ += 1;
        super({
            kind: 'pointer',
            name: opts.name || `Pointer ${UI_POINTER_SEQ}`,
            field: heatMap.field
        });
        this.heatMap = heatMap;
        this.scene = heatMap.scene;
        this.emitter = createPointerEmitterState(heatMap.field, opts);
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
        const apex = emitter.glistenById('apex');
        const left = emitter.glistenById('left');
        const right = emitter.glistenById('right');
        return Object.assign({}, emitter.params, {
            isVisible: this.isVisible,
            cycling: emitter.cycling !== false,
            apexOn: !!(apex && apex.on),
            leftOn: !!(left && left.on),
            rightOn: !!(right && right.on),
            centerX: hotRodCoordToPct(emitter, 'col', target.col),
            centerY: hotRodCoordToPct(emitter, 'row', target.row),
            fromWidth: emitter.from.width,
            fromHeight: emitter.from.height,
            fromAngle: emitter.from.angle,
            fromSkew: emitter.from.skew,
            fromShapeHeat: emitter.from.shapeHeat,
            fromHeat: emitter.from.heat,
            toWidth: emitter.to.width,
            toHeight: emitter.to.height,
            toAngle: emitter.to.angle,
            toSkew: emitter.to.skew,
            toShapeHeat: emitter.to.shapeHeat,
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
                gap: emitter.params.gap,
                glistenSpeed: emitter.params.glistenSpeed,
                glistenDelay: emitter.params.glistenDelay
            },
            from: copyBackHighlightPose(emitter.from),
            to: copyBackHighlightPose(emitter.to),
            center: copyOrbitPoint(emitter.center),
            target: copyOrbitPoint(emitter.target),
            glistens: emitter.glistens.map((state) => ({
                id: state.id,
                on: state.on !== false,
                glisten: state.glisten,
                phase: state.glistenPhase,
                wait: state.glistenWait
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
        this.isVisible = data.isVisible !== false;
        const emitter = this.emitter;
        emitter.cycling = data.cycling !== false;
        const params = data.params || {};
        UI_EDITOR_POINTER_PARAM_KEYS.forEach((key) => {
            if (params[key] != null) {
                emitter.setParam(key, params[key]);
            }
        });
        UI_EDITOR_POINTER_POSE_KEYS.forEach((key) => {
            const label = key.charAt(0).toUpperCase() + key.slice(1);
            if (data.from && data.from[key] != null) {
                emitter.setParam('from' + label, data.from[key]);
            }
            if (data.to && data.to[key] != null) {
                emitter.setParam('to' + label, data.to[key]);
            }
        });
        UI_EDITOR_POINTER_FLAGS.forEach((key) => {
            if (typeof data[key] === 'boolean') {
                emitter.setParam(key, data[key]);
            }
        });
        (data.glistens || []).forEach((entry) => {
            if (!entry || !entry.id) {
                return;
            }
            const state = emitter.glistenById(entry.id);
            if (!state) {
                return;
            }
            if (typeof entry.on === 'boolean') {
                state.on = entry.on;
            }
            if (typeof entry.glisten === 'number') {
                state.glisten = entry.glisten;
            }
            if (entry.phase) {
                state.glistenPhase = entry.phase;
            }
            if (typeof entry.wait === 'number') {
                state.glistenWait = entry.wait;
            }
        });
        const target = copyOrbitPoint(data.target) || copyOrbitPoint(data.center);
        if (target) {
            emitter.setCenter(target);
            emitter.center.col = target.col;
            emitter.center.row = target.row;
        }
        emitter.current = copyBackHighlightPose(emitter.from);
        delete emitter.current.glisten;
        emitter.phase = 'toEnd';
        emitter.waitLeft = 0;
    }

    retarget(cell) {
        this.emitter.retarget(cell);
    }
}
