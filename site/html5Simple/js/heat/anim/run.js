/**
 * One playing transition. Time is seconds on the field clock.
 * finished resolves { status: 'finished' | 'cancelled' } and never rejects.
 */
let HEAT_RUN_SEQ = 0;
let HEAT_RUN_ORDER = 0;

class HeatRun {
    constructor(node, definition, ctx) {
        HEAT_RUN_SEQ += 1;
        this.id = 'run-' + HEAT_RUN_SEQ;
        this.node = node;
        this.def = definition;
        this.ctx = ctx || {};
        this.slotName = definition.slot || 'life';
        this.fill = definition.fill || 'none';
        this.status = 'queued';
        this.time = 0;
        this.duration = 0;
        this.started = 0;
        this.bornGen = 0;
        this.lastValues = {};
        this.block = null;
        this._firedUntil = -1;
        this._settled = false;
        this._seeded = false;
        this._pendingDone = false;
        this._stagger = false;
        this._children = [];
        this._childStarted = [];
        this._finishOnStart = false;
        this._pauseOnStart = false;
        const settle = {};
        this.finished = new Promise((resolve) => {
            settle.resolve = resolve;
        });
        this._resolve = settle.resolve;
    }

    pause() {
        if (this.status === 'running') {
            this.status = 'paused';
        } else if (this.status === 'queued') {
            this._pauseOnStart = true;
        }
        return this;
    }

    resume() {
        if (this.status === 'paused') {
            this.status = 'running';
        }
        this._pauseOnStart = false;
        return this;
    }

    seek(t) {
        if (this.status !== 'running' && this.status !== 'paused') {
            return this;
        }
        const cap = Math.max(0, this.duration);
        const next = Math.max(0, Math.min(cap, t));
        const prev = this.time;
        this.time = next;
        this._applySample();
        if (next > prev) {
            this._fireBetween(prev, next);
        }
        if (this._stagger) {
            this._syncStagger(true);
        }
        return this;
    }

    finish() {
        if (this._settled) {
            return this;
        }
        if (this.status === 'queued') {
            this._finishOnStart = true;
            return this;
        }
        this._completing = true;
        this.bornGen = 0;
        this.seek(this.duration);
        this._complete();
        return this;
    }

    cancel() {
        if (this._settled) {
            return this;
        }
        const slot = this.node && this.node._slots[this.slotName];
        const wasActive = slot && slot.active === this;
        this._drop();
        if (!slot) {
            return this;
        }
        if (wasActive) {
            slot.queue.slice().forEach((run) => run._drop());
            slot.queue = [];
            slot.active = null;
        } else {
            slot.queue = slot.queue.filter((run) => run !== this);
        }
        return this;
    }

    _begin(current) {
        this.status = 'running';
        HEAT_RUN_ORDER += 1;
        this.started = HEAT_RUN_ORDER;
        const ctx = this.ctx;
        let block = heatFreeze(this.def.block, ctx, current || {});
        if (block.type === 'stagger') {
            this._stagger = true;
            this._targets = (ctx.targets || []).slice();
            this._each = block.each || 0;
            this._childDef = block.child;
            this._childCtx = Object.assign({}, ctx);
            delete this._childCtx.targets;
            const count = this._targets.length;
            const childDur = count ? heatDefDuration(block.child, ctx) : 0;
            this.duration = count === 0 ? 0 : Math.max(0, count - 1) * this._each + childDur;
            block = { type: 'wait', duration: this.duration };
        } else {
            this.duration = heatDuration(block);
        }
        this.block = block;
        this.time = 0;
        this.bornGen = HEAT_TICK_DEPTH > 0 ? HEAT_TICK_GEN : 0;
        this._firedUntil = -1;
        if (this._finishOnStart) {
            this.time = this.duration;
            this._applySample();
            this._syncStagger(true);
            this._complete();
            return;
        }
        this._applySample();
        this._syncStagger(false);
        if (this.duration <= 1e-12) {
            this.time = this.duration;
            this._complete();
            return;
        }
        this._fireBetween(-1, 0);
        if (this._pauseOnStart) {
            this.status = 'paused';
        }
    }

    _step(dt) {
        if (this.status !== 'running') {
            return;
        }
        if (this.bornGen !== 0 && this.bornGen === HEAT_TICK_GEN) {
            return;
        }
        const prev = this.time;
        const next = this.time + dt;
        if (next >= this.duration - 1e-9) {
            this.time = this.duration;
            this._applySample();
            this._syncStagger(false);
            this._pendingDone = true;
            return;
        }
        this.time = next;
        this._applySample();
        this._fireBetween(prev, next);
        this._syncStagger(false);
    }

    _complete() {
        if (this._settled) {
            return;
        }
        this._settled = true;
        this._pendingDone = false;
        this.status = 'finished';
        if (this.time < this.duration) {
            this.time = this.duration;
            this._applySample();
        }
        if (this._stagger) {
            this._syncStagger(true);
        }
        const endValues = this.lastValues;
        this._fireBetween(this._firedUntil, this.time);
        if (this.fill === 'none') {
            this._clearOwn();
        } else if (this.fill === 'commit') {
            heatCommit(this.node, endValues || {});
            this._clearOwn();
        }
        if (this._stagger) {
            this._children.forEach((child) => {
                if (child && child.status !== 'finished' && child.status !== 'cancelled') {
                    child.finish();
                }
            });
        }
        this._resolve({ status: 'finished' });
        heatPromote(this.node, this, endValues || {});
    }

    _drop() {
        if (this._settled || this._completing) {
            return;
        }
        this._settled = true;
        this._pendingDone = false;
        this.status = 'cancelled';
        this._clearOwn();
        this._children.forEach((child) => child._drop());
        if (this.node && this.node._runs) {
            this.node._runs = this.node._runs.filter((run) => run !== this);
        }
        this._resolve({ status: 'cancelled' });
    }

    _clearOwn() {
        if (this.node && this.node.channels) {
            this.node.channels.clear(this.id);
        }
    }

    _applySample() {
        const sampled = heatSample(this.block, this.time);
        this.lastValues = sampled.values || {};
        if (!this.node || !this.node.channels) {
            return;
        }
        if (!this._seeded) {
            this.node.channels.set(this.id, this.lastValues, this.started);
            this._seeded = true;
            return;
        }
        this.node.channels.update(this.id, this.lastValues);
    }

    _fireBetween(from, to) {
        if (!this.block || to < from) {
            return;
        }
        const events = heatSample(this.block, to).events || [];
        events.forEach((event) => {
            if (event.time > from + 1e-12 && event.time <= to + 1e-12) {
                this._fire(event);
            }
        });
        if (to > this._firedUntil) {
            this._firedUntil = to;
        }
    }

    _fire(event) {
        if (event.type === 'field') {
            if (!this.node.fields) {
                this.node.fields = {};
            }
            const value = event.value;
            this.node.fields[event.key] = value && typeof value.col === 'number'
                ? { col: value.col, row: value.row }
                : value;
            return;
        }
        if (event.type === 'call') {
            heatInvoke(this.node, event.name, this.ctx);
        }
    }

    _syncStagger(force) {
        if (!this._stagger) {
            return;
        }
        const targets = this._targets || [];
        const each = this._each || 0;
        targets.forEach((target, index) => {
            const at = index * each;
            if (this.time < at - 1e-9) {
                return;
            }
            const local = Math.max(0, this.time - at);
            if (!this._childStarted[index]) {
                this._childStarted[index] = true;
                const run = heatPlay(target, this._childDef, this._childCtx);
                this._children[index] = run;
                if (local > 1e-9 && run && typeof run.seek === 'function' && !run._settled) {
                    run.seek(local);
                }
                if (run && HEAT_TICK_DEPTH > 0) {
                    run.bornGen = HEAT_TICK_GEN;
                }
                return;
            }
            const run = this._children[index];
            if (force && run && !run._settled && typeof run.seek === 'function') {
                run.seek(local);
                if (HEAT_TICK_DEPTH > 0) {
                    run.bornGen = HEAT_TICK_GEN;
                }
            }
        });
    }
}
