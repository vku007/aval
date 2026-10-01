/**
 * VerticalPulse
 * A vertical hot rod used as a one-shot delimiter.
 * It starts on a panel edge and slides off the heat map on the field clock.
 * The line is clipped to that panel, from its top to its bottom.
 */
const VERTICAL_PULSE_MS = 3000;
const VERTICAL_PULSE_EXIT = -0.3;

class VerticalPulse {
    constructor(heatMap, options) {
        const opts = options || {};
        this.heatMap = heatMap;
        this.name = opts.name || 'enemyPostMortemPulse';
        this.removed = false;
        const bounds = heatMap.bounds;
        const panel = opts.panel;
        const fromLeft = opts.from === 'left';
        const exit = typeof opts.exit === 'number' ? opts.exit : VERTICAL_PULSE_EXIT;
        const startX = fromLeft ? panel.x : panel.x + panel.width;
        const top = pulseCellAt(heatMap, startX, panel.y);
        const bottom = pulseCellAt(heatMap, startX, panel.y + panel.height);
        const rowMin = Math.min(top.row, bottom.row);
        const rowMax = Math.max(top.row, bottom.row);
        const startY = panel.y + panel.height / 2;
        const start = pulseCellAt(heatMap, startX, startY);
        const endX = bounds.x + bounds.width * exit;
        const end = pulseCellAt(heatMap, endX, startY);
        this.from = {
            col: start.col - end.col,
            row: start.row - end.row
        };
        this.duration = VERTICAL_PULSE_MS / 1000;
        this.rod = new UiHotRod(heatMap, {
            name: this.name,
            loopOn: false,
            startAngle: 90,
            endAngle: 90,
            start: { col: end.col, row: end.row },
            end: { col: end.col, row: end.row },
            params: {
                thickness: 10,
                noiseAmt: 0,
                followSpeed: 0,
                delay: 0,
                gap: 0
            }
        });
        const emitter = this.rod.emitter;
        emitter.params.angle = 90;
        pinPulseRod(this.rod, end.col, end.row);
        armPulseStamp(emitter, () => ({ rowMin: rowMin, rowMax: rowMax }));
    }

    play() {
        return startPulseSweep(this);
    }

    remove() {
        releasePulseRod(this);
    }
}
