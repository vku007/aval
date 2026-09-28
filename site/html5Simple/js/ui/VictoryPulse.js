/**
 * VictoryPulse
 * A horizontal hot rod, like HorisontalPulse, used as a one-shot victory strike.
 * It starts on the bottom of a panel at that panel's width, slides to a target
 * point, and arrives with the given end width.
 */
const VICTORY_PULSE_MS = 1500;

class VictoryPulse {
    constructor(heatMap, options) {
        const opts = options || {};
        this.heatMap = heatMap;
        this.scene = heatMap.scene;
        this.name = opts.name || 'playerVictoryPulse';
        this.removed = false;
        const start = opts.start || { x: 0, y: 0 };
        const end = opts.end || start;
        this.start = victoryPulseCellAt(heatMap, start.x, start.y);
        this.end = victoryPulseCellAt(heatMap, end.x, end.y);
        this.startHalf = victoryPulseCellSpan(heatMap, opts.startWidth) * 0.5;
        this.endHalf = victoryPulseCellSpan(heatMap, opts.endWidth) * 0.5;
        this.clip = { colMin: 0, colMax: 0 };
        this.rod = new UiHotRod(heatMap, {
            name: this.name,
            loopOn: false,
            startAngle: 0,
            endAngle: 0,
            start: { col: this.start.col, row: this.start.row },
            end: { col: this.start.col, row: this.start.row },
            params: {
                thickness: 10,
                noiseAmt: 0,
                followSpeed: 0,
                delay: 0,
                gap: 0
            }
        });
        const emitter = this.rod.emitter;
        const pulse = this;
        emitter.advance = (delta) => {
            emitter.t += Math.min((delta || 0) / 1000, 0.05);
            return emitter.center;
        };
        emitter.stamp = (grid) => stampHotRodLine(
            grid,
            emitter.cols,
            emitter.rows,
            emitter.center,
            emitter.params,
            emitter.t,
            pulse.clip
        );
        this.applyPose(0);
    }

    applyPose(t) {
        const col = this.start.col + (this.end.col - this.start.col) * t;
        const row = this.start.row + (this.end.row - this.start.row) * t;
        const half = this.startHalf + (this.endHalf - this.startHalf) * t;
        this.clip.colMin = col - half;
        this.clip.colMax = col + half;
        const emitter = this.rod && this.rod.emitter;
        if (!emitter) {
            return;
        }
        emitter.center.col = col;
        emitter.center.row = row;
        emitter.target.col = col;
        emitter.target.row = row;
        emitter.params.angle = 0;
    }

    play() {
        const scene = this.scene;
        const emitter = this.rod && this.rod.emitter;
        return new Promise((resolve) => {
            if (!emitter || !scene || !scene.sys || !scene.sys.isActive()) {
                this.remove();
                resolve();
                return;
            }
            const state = { t: 0 };
            scene.tweens.add({
                targets: state,
                t: 1,
                duration: VICTORY_PULSE_MS,
                ease: 'Sine.easeInOut',
                onUpdate: () => {
                    this.applyPose(state.t);
                },
                onComplete: () => {
                    this.remove();
                    resolve();
                },
                onStop: () => {
                    this.remove();
                    resolve();
                }
            });
        });
    }

    remove() {
        if (this.removed) {
            return;
        }
        this.removed = true;
        if (this.rod && this.heatMap) {
            this.heatMap.removeRod(this.rod.emitter);
        }
        this.rod = null;
    }
}

function victoryPulseCellAt(heatMap, x, y) {
    const field = heatMap.field;
    const bounds = heatMap.bounds;
    return {
        col: ((x - bounds.x) / Math.max(bounds.width, 1)) * (field.cols - 1),
        row: ((y - bounds.y) / Math.max(bounds.height, 1)) * (field.rows - 1)
    };
}

function victoryPulseCellSpan(heatMap, pixels) {
    const field = heatMap.field;
    const bounds = heatMap.bounds;
    return (Math.max(0, pixels || 0) / Math.max(bounds.width, 1)) * (field.cols - 1);
}
