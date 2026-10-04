/**
 * HorisontalPulse
 * A thin horizontal hot rod used as a one-shot delimiter.
 * The rod sits on the end cell. A sweep run carries it in from the start
 * edge on the field clock, then detaches it.
 */
const HORISONTAL_PULSE_MS = 1500;
const HORISONTAL_PULSE_EXIT = -0.3;

class HorisontalPulse {
    constructor(heatMap, options) {
        const opts = options || {};
        this.heatMap = heatMap;
        this.name = opts.name || 'enemyBeginFightPulse';
        this.removed = false;
        const bounds = heatMap.bounds;
        const panel = opts.panel;
        const fromTop = opts.from === 'top';
        const startY = fromTop ? panel.y : panel.y + panel.height;
        const exit = typeof opts.exit === 'number' ? opts.exit : HORISONTAL_PULSE_EXIT;
        const start = pulseCellAt(heatMap, panel.x + panel.width / 2, startY);
        const endY = bounds.y + bounds.height * exit;
        const end = pulseCellAt(heatMap, bounds.x + bounds.width / 2, endY);
        this.from = {
            col: start.col - end.col,
            row: start.row - end.row
        };
        this.duration = HORISONTAL_PULSE_MS / 1000;
        this.rod = new UiHotRod(heatMap, {
            name: this.name,
            loopOn: false,
            startAngle: 0,
            endAngle: 0,
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
        pinPulseRod(this.rod, end.col, end.row);
    }

    play() {
        return startPulseSweep(this);
    }

    remove() {
        releasePulseRod(this);
    }
}

function pulseCellAt(heatMap, x, y) {
    const field = heatMap.field;
    const bounds = heatMap.bounds;
    return {
        col: ((x - bounds.x) / Math.max(bounds.width, 1)) * (field.cols - 1),
        row: ((y - bounds.y) / Math.max(bounds.height, 1)) * (field.rows - 1)
    };
}

function pulseCellSpan(heatMap, pixels) {
    const field = heatMap.field;
    const bounds = heatMap.bounds;
    return (Math.max(0, pixels || 0) / Math.max(bounds.width, 1)) * (field.cols - 1);
}

function pinPulseRod(rod, col, row) {
    const emitter = rod && rod.emitter;
    if (!emitter) {
        return;
    }
    emitter.loopOn = false;
    emitter.center.col = col;
    emitter.center.row = row;
    emitter.target.col = col;
    emitter.target.row = row;
    emitter.advance = (delta) => {
        emitter.t += Math.min((delta || 0) / 1000, 0.05);
        return emitter.center;
    };
}

function armPulseStamp(emitter, clipFor) {
    emitter.stamp = (grid) => {
        const frame = heatFrame(heatNodeOf(emitter));
        const placed = heatPlace(frame, emitter.center.col, emitter.center.row);
        const clip = clipFor ? clipFor(placed, frame) : null;
        stampHotRodLine(
            grid,
            emitter.cols,
            emitter.rows,
            placed,
            heatRodParams(frame, emitter.params),
            emitter.t,
            clip
        );
    };
}

function startPulseSweep(pulse) {
    const rod = pulse && pulse.rod;
    if (!rod || !rod.attached) {
        if (pulse) {
            pulse.remove();
        }
        return heatDeadRun();
    }
    const run = playPulseSweep(rod, {
        from: pulse.from,
        duration: pulse.duration,
        clipFrom: pulse.clipFrom
    });
    pulse.run = run;
    run.finished.then(() => pulse.remove());
    return run;
}

function playPulseSweep(rod, options) {
    const opts = options || {};
    rod.define('sweep', sweep({
        from: opts.from,
        duration: opts.duration,
        ease: 'sine',
        clipFrom: opts.clipFrom
    }));
    return rod.play('sweep');
}

function releasePulseRod(pulse) {
    if (!pulse || pulse.removed) {
        return;
    }
    pulse.removed = true;
    const rod = pulse.rod;
    pulse.rod = null;
    if (rod && rod.attached && typeof rod.detach === 'function') {
        rod.detach();
    }
}
