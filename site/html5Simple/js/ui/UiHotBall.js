/**
 * UiHotBall
 * Orbiting hot-ball emitter that stamps into a shared UiHeatMap.
 * GEO / DOT props edit in PROPS for the selected instance.
 */
let UI_HOT_BALL_SEQ = 0;

class UiHotBall {
    static PROP_TABS = [
        {
            id: 'heat',
            label: 'HEAT',
            rows: [
                { key: 'isVisible', label: 'VISIBLE', type: 'bool' },
                { key: 'radius', label: 'DOT SIZE', decimals: 1 },
                { key: 'energy', label: 'DOT HEAT', decimals: 1 }
            ]
        },
        {
            id: 'geo',
            label: 'GEO',
            rows: [
                { key: 'angleSpeed', label: 'ANG SPEED', decimals: 1 },
                { key: 'phase', label: 'PHASE', decimals: 0 },
                { key: 'orbitRadius', label: 'RADIUS', decimals: 0 },
                { key: 'orbitX', label: 'CENTER X', decimals: 1 },
                { key: 'orbitY', label: 'CENTER Y', decimals: 1 },
                { key: 'tiltX', label: 'TILT X', decimals: 0 },
                { key: 'tiltY', label: 'TILT Y', decimals: 0 },
                { key: 'tiltZ', label: 'TILT Z', decimals: 0 }
            ]
        }
    ];

    constructor(heatMap, options) {
        const opts = options || {};
        this.heatMap = heatMap;
        this.scene = heatMap.scene;
        this.kind = 'hot-ball';
        UI_HOT_BALL_SEQ += 1;
        this.name = opts.name || `Hot Ball ${UI_HOT_BALL_SEQ}`;
        this.motion = createRotatedHotBallState(heatMap.field, Object.assign({
            keepPhaseOnOrbit: true,
            orbitOn: true,
            isVisible: true
        }, opts));
        heatMap.addBall(this.motion);
    }

    getOrbitPoint() {
        if (this.motion.orbitOn) {
            return this.motion.orbitCenter;
        }
        return this.motion.position();
    }

    getPhaseDeg() {
        return wrapPhaseDeg(this.motion.angle * 180 / Math.PI);
    }

    get isVisible() {
        return this.motion.isVisible !== false;
    }

    set isVisible(value) {
        this.motion.isVisible = !!value;
    }

    get params() {
        const point = this.getOrbitPoint();
        return Object.assign({}, this.motion.params, {
            orbitX: point.col,
            orbitY: point.row,
            phase: this.getPhaseDeg(),
            isVisible: this.isVisible
        });
    }

    nudgeParam(key, dir) {
        if (key === 'isVisible') {
            this.isVisible = !this.isVisible;
            return this.isVisible;
        }
        if (key === 'orbitX' || key === 'orbitY') {
            return this.nudgeOrbit(key, dir);
        }
        if (key === 'phase') {
            return this.nudgePhase(dir);
        }
        return this.motion.nudgeParam(key, dir);
    }

    nudgePhase(dir) {
        const step = 5;
        const snapped = Math.round(this.getPhaseDeg() / step) * step;
        const next = wrapPhaseDeg(snapped + dir * step);
        this.motion.angle = next * Math.PI / 180;
        this.motion.params.phase = next;
        if (!this.motion.orbitOn) {
            this.retarget(this.motion.orbitCenter);
        }
        return next;
    }

    nudgeOrbit(key, dir) {
        const field = this.heatMap.field;
        const step = 1;
        const point = this.getOrbitPoint();
        let col = point.col;
        let row = point.row;
        if (key === 'orbitX') {
            col += dir * step;
        } else {
            row += dir * step;
        }
        const maxCol = Math.max(0, field.cols - 1);
        const maxRow = Math.max(0, field.rows - 1);
        this.retarget({
            col: Math.max(0, Math.min(maxCol, col)),
            row: Math.max(0, Math.min(maxRow, row))
        });
        return this.params[key];
    }

    serialize() {
        const motion = this.motion;
        return {
            name: this.name,
            isVisible: this.isVisible,
            params: Object.assign({}, motion.params, { phase: this.getPhaseDeg() }),
            orbitOn: !!motion.orbitOn,
            orbitCenter: copyOrbitPoint(motion.orbitCenter),
            orbitTarget: copyOrbitPoint(motion.orbitTarget),
            angle: motion.angle,
            wanderPhase: motion.wanderPhase || 0
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
        UI_EDITOR_BALL_PARAM_KEYS.forEach((key) => {
            if (params[key] != null) {
                this.motion.setParam(key, params[key]);
            }
        });
        if (typeof data.angle === 'number') {
            this.motion.angle = data.angle;
            this.motion.params.phase = this.getPhaseDeg();
        } else if (params.phase != null) {
            this.motion.params.phase = params.phase;
            this.motion.angle = wrapPhaseDeg(params.phase) * Math.PI / 180;
        }
        if (typeof data.wanderPhase === 'number') {
            this.motion.wanderPhase = data.wanderPhase;
        }
        this.motion.orbitOn = data.orbitOn !== false;
        const center = copyOrbitPoint(data.orbitCenter);
        if (center) {
            this.motion.orbitCenter = center;
        }
        const target = copyOrbitPoint(data.orbitTarget);
        this.motion.orbitTarget = target || (this.motion.orbitOn
            ? copyOrbitPoint(this.motion.orbitCenter)
            : null);
    }

    retarget(cell) {
        this.motion.retarget(cell);
    }
}
