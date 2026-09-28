/**
 * VerticalPulse
 * A vertical hot rod used as a one-shot delimiter.
 * It starts on the right edge and slides left, off the heat map, then is removed.
 * The line spans only the given panel, from its top to its bottom.
 */
const VERTICAL_PULSE_MS = 3000;
const VERTICAL_PULSE_EXIT = -0.3;

class VerticalPulse {
    constructor(heatMap, options) {
        const opts = options || {};
        this.heatMap = heatMap;
        this.scene = heatMap.scene;
        this.name = opts.name || 'enemyPostMortemPulse';
        this.removed = false;
        const bounds = heatMap.bounds;
        const panel = opts.panel;
        const fromLeft = opts.from === 'left';
        const exit = typeof opts.exit === 'number' ? opts.exit : VERTICAL_PULSE_EXIT;
        const startX = fromLeft ? panel.x : panel.x + panel.width;
        const top = verticalPulseCellAt(heatMap, startX, panel.y);
        const bottom = verticalPulseCellAt(heatMap, startX, panel.y + panel.height);
        this.rowMin = Math.min(top.row, bottom.row);
        this.rowMax = Math.max(top.row, bottom.row);
        const startY = panel.y + panel.height / 2;
        const start = verticalPulseCellAt(heatMap, startX, startY);
        const endX = bounds.x + bounds.width * exit;
        const end = verticalPulseCellAt(heatMap, endX, startY);
        this.row = start.row;
        this.startCol = start.col;
        this.endCol = end.col;
        this.rod = new UiHotRod(heatMap, {
            name: this.name,
            loopOn: false,
            startAngle: 90,
            endAngle: 90,
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
        emitter.params.angle = 90;
        emitter.advance = (delta) => {
            emitter.t += Math.min((delta || 0) / 1000, 0.05);
            return emitter.center;
        };
        const rowMin = this.rowMin;
        const rowMax = this.rowMax;
        emitter.stamp = (grid) => stampHotRodLine(
            grid,
            emitter.cols,
            emitter.rows,
            emitter.center,
            emitter.params,
            emitter.t,
            { rowMin: rowMin, rowMax: rowMax }
        );
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
            const state = { col: this.startCol };
            scene.tweens.add({
                targets: state,
                col: this.endCol,
                duration: VERTICAL_PULSE_MS,
                ease: 'Sine.easeInOut',
                onUpdate: () => {
                    emitter.center.col = state.col;
                    emitter.center.row = this.row;
                    emitter.target.col = state.col;
                    emitter.target.row = this.row;
                    emitter.params.angle = 90;
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

function verticalPulseCellAt(heatMap, x, y) {
    const field = heatMap.field;
    const bounds = heatMap.bounds;
    return {
        col: ((x - bounds.x) / Math.max(bounds.width, 1)) * (field.cols - 1),
        row: ((y - bounds.y) / Math.max(bounds.height, 1)) * (field.rows - 1)
    };
}
