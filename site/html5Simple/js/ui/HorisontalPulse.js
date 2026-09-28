/**
 * HorisontalPulse
 * A thin horizontal hot rod used as a one-shot delimiter.
 * It starts on a panel edge, slides to a point above the heat map, then is removed.
 */
const HORISONTAL_PULSE_MS = 3000;
const HORISONTAL_PULSE_EXIT = -0.3;

class HorisontalPulse {
    constructor(heatMap, options) {
        const opts = options || {};
        this.heatMap = heatMap;
        this.scene = heatMap.scene;
        this.name = opts.name || 'enemyBeginFightPulse';
        this.removed = false;
        const bounds = heatMap.bounds;
        const panel = opts.panel;
        const fromTop = opts.from === 'top';
        const startY = fromTop ? panel.y : panel.y + panel.height;
        const exit = typeof opts.exit === 'number' ? opts.exit : HORISONTAL_PULSE_EXIT;
        const start = horisontalPulseCellAt(heatMap, panel.x + panel.width / 2, startY);
        const endY = bounds.y + bounds.height * exit;
        const end = horisontalPulseCellAt(heatMap, bounds.x + bounds.width / 2, endY);
        this.col = start.col;
        this.startRow = start.row;
        this.endRow = end.row;
        this.rod = new UiHotRod(heatMap, {
            name: this.name,
            loopOn: false,
            startAngle: 0,
            endAngle: 0,
            start: { col: start.col, row: start.row },
            end: { col: start.col, row: start.row },
            params: {
                thickness: 10,
                noiseAmt: 0,
                followSpeed: 0,
                delay: 0,
                gap: 0
            }
        });
        const emitter = this.rod.emitter;
        emitter.center.col = start.col;
        emitter.center.row = start.row;
        emitter.target.col = start.col;
        emitter.target.row = start.row;
        emitter.advance = (delta) => {
            emitter.t += Math.min((delta || 0) / 1000, 0.05);
            return emitter.center;
        };
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
            const state = { row: this.startRow };
            scene.tweens.add({
                targets: state,
                row: this.endRow,
                duration: HORISONTAL_PULSE_MS,
                ease: 'Sine.easeInOut',
                onUpdate: () => {
                    emitter.center.col = this.col;
                    emitter.center.row = state.row;
                    emitter.target.col = this.col;
                    emitter.target.row = state.row;
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

function horisontalPulseCellAt(heatMap, x, y) {
    const field = heatMap.field;
    const bounds = heatMap.bounds;
    return {
        col: ((x - bounds.x) / Math.max(bounds.width, 1)) * (field.cols - 1),
        row: ((y - bounds.y) / Math.max(bounds.height, 1)) * (field.rows - 1)
    };
}
