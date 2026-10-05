/**
 * HeatItem
 * One stampable object. The motion or emitter object remains the behaviour
 * state. tick() runs that same advance-then-stamp the field used inline.
 */
class HeatItem extends HeatNode {
    constructor(options) {
        super(options);
        this.behaviour = null;
        this.listKey = null;
        this.listItem = null;
    }

    bindBehaviour(listKey, behaviour) {
        this.behaviour = behaviour;
        this.listKey = listKey;
        this.listItem = behaviour === this ? this : behaviour;
        if (behaviour && behaviour !== this) {
            behaviour.root = this;
        }
        return this;
    }

    advanceState(delta) {
        const target = this.behaviour || this;
        const field = this.field || target.field;
        this._liveTarget = target;
        this._liveField = field;
        if (!field || field.destroyed) {
            this._skipStamp = true;
            return;
        }
        this._skipStamp = false;
        if (this.kind === 'hot-ball') {
            this._ballPos = target.advance(delta);
        } else if (typeof target.advance === 'function') {
            target.advance(delta);
        }
        this.advanceRuns(delta);
    }

    stampNow() {
        // Detach clears the channels before this stamp. Drawing then flashes
        // the rest pose back at the original position.
        if (this._skipStamp || this.detached) {
            return;
        }
        const target = this._liveTarget;
        const field = this._liveField;
        if (!target || !field || field.destroyed || target.isVisible === false) {
            return;
        }
        if (this.kind === 'hot-ball') {
            const frame = heatFrame(this);
            const orbiting = heatBallPhasePos(target, frame, this._ballPos);
            if (heatRest(frame)) {
                stampRotatedHotBall(
                    field.src,
                    field.cols,
                    field.rows,
                    orbiting.col,
                    orbiting.row,
                    target.params,
                    orbiting.depth
                );
                return;
            }
            const placed = heatPlace(frame, orbiting.col, orbiting.row);
            stampRotatedHotBall(
                field.src,
                field.cols,
                field.rows,
                placed.col,
                placed.row,
                heatDotParams(frame, target.params),
                orbiting.depth
            );
            return;
        }
        if (typeof target.stamp === 'function') {
            target.stamp(field.src);
        }
    }

    reset() {
        HeatNode.prototype.reset.call(this);
        const loops = this.loops || [];
        loops.forEach((loop) => {
            if (typeof loop.reset === 'function') {
                loop.reset();
            }
        });
        return this;
    }

    copyBehaviourState(other, options) {
        const shift = options && typeof options.shift === 'number' ? options.shift : 0;
        const theirs = (other && other.loops) || [];
        (this.loops || []).forEach((loop) => {
            const source = theirs.find((item) => item.constructor === loop.constructor);
            if (source && typeof loop.copyStateFrom === 'function') {
                loop.copyStateFrom(source, shift);
            }
        });
        return this;
    }
}

/**
 * Orbit position after this tick's runs. Spread commits phase onto the angle
 * after advance() stored the old point, so the stamp must read the angle now.
 * Phase still in the channel is added before tilt.
 */
function heatBallPhasePos(state, frame, pos) {
    if (!state || !state.orbitOn || !state.orbitCenter) {
        return pos;
    }
    const phase = frame && frame.own ? frame.own.phase || 0 : 0;
    return rotatedBallPosAt(state, state.angle + phase * Math.PI / 180);
}
