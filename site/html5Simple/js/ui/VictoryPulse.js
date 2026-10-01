/**
 * VictoryPulse
 * A horizontal hot rod used as a one-shot victory strike.
 * It starts on the bottom of a panel at that panel's width, slides to a
 * target on the field clock, and arrives at the given end width.
 */
const VICTORY_PULSE_MS = 1500;

class VictoryPulse {
    constructor(heatMap, options) {
        const opts = options || {};
        this.heatMap = heatMap;
        this.name = opts.name || 'playerVictoryPulse';
        this.removed = false;
        const start = opts.start || { x: 0, y: 0 };
        const end = opts.end || start;
        const startCell = pulseCellAt(heatMap, start.x, start.y);
        const endCell = pulseCellAt(heatMap, end.x, end.y);
        const startHalf = pulseCellSpan(heatMap, opts.startWidth) * 0.5;
        const endHalf = pulseCellSpan(heatMap, opts.endWidth) * 0.5;
        this.from = {
            col: startCell.col - endCell.col,
            row: startCell.row - endCell.row
        };
        this.clipFrom = endHalf > 1e-6 ? startHalf / endHalf : 1;
        this.duration = VICTORY_PULSE_MS / 1000;
        this.rod = new UiHotRod(heatMap, {
            name: this.name,
            loopOn: false,
            startAngle: 0,
            endAngle: 0,
            start: { col: endCell.col, row: endCell.row },
            end: { col: endCell.col, row: endCell.row },
            params: {
                thickness: 10,
                noiseAmt: 0,
                followSpeed: 0,
                delay: 0,
                gap: 0
            }
        });
        const emitter = this.rod.emitter;
        pinPulseRod(this.rod, endCell.col, endCell.row);
        armPulseStamp(emitter, (placed, frame) => heatClip(frame, {
            colMin: placed.col - endHalf,
            colMax: placed.col + endHalf
        }));
    }

    play() {
        return startPulseSweep(this);
    }

    remove() {
        releasePulseRod(this);
    }
}
