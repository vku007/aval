/**
 * HeatComposite
 * Ordered items, a layout, and named transitions.
 * Group channels (offset, rotate, scale, heat) shake and flash the whole set.
 * The field ticks this node so those runs share the field clock.
 */
const HEAT_COMPOSITE_CLEAR_GAP = 0.32;

class HeatComposite extends HeatNode {
    constructor(heatMap, options) {
        const opts = options || {};
        const field = heatMap && heatMap.field;
        super({
            kind: opts.kind || '',
            name: opts.name || 'Group',
            field: field || null
        });
        this.heatMap = heatMap || null;
        this.center = {
            col: opts.center && typeof opts.center.col === 'number'
                ? opts.center.col
                : (field ? (field.cols - 1) * 0.5 : 0),
            row: opts.center && typeof opts.center.row === 'number'
                ? opts.center.row
                : (field ? (field.rows - 1) * 0.5 : 0)
        };
        this.spawn = {
            col: opts.spawn && typeof opts.spawn.col === 'number' ? opts.spawn.col : 0,
            row: opts.spawn && typeof opts.spawn.row === 'number' ? opts.spawn.row : 0
        };
        this.parts = [];
        this.channels = new HeatChannels('group');
        this._listeners = { added: [], removed: [], transition: [] };
        this.exitInstant = !!opts.exitInstant;
        this.specCount = typeof opts.count === 'number' ? opts.count : null;
        this.attached = false;
        this.detached = false;
        if (field && typeof field.addRoot === 'function') {
            field.addRoot(this);
        }
    }

    get items() {
        return this.parts.map((part) => part.object);
    }

    on(name, fn) {
        if (!this._listeners[name]) {
            this._listeners[name] = [];
        }
        this._listeners[name].push(fn);
        return this;
    }

    emit(name, payload) {
        (this._listeners[name] || []).slice().forEach((fn) => fn(payload));
        return this;
    }

    play(name, ctx) {
        const run = HeatNode.prototype.play.call(this, name, ctx);
        this.emit('transition', { name: name, run: run });
        return run;
    }

    advanceState(delta) {
        if (typeof this.pump === 'function') {
            this.pump(delta);
        }
        this.advanceRuns(delta);
    }

    exitDefinition() {
        return sequence([
            fade({ duration: 0.4, from: 1, to: 0 }),
            call('detach')
        ], {
            slot: 'life',
            policy: 'replace',
            fill: 'hold'
        });
    }

    writeField(item, key, value) {
        if (!item) {
            return value;
        }
        if (typeof item.setParam === 'function') {
            return item.setParam(key, value);
        }
        const motion = item.motion || item.emitter;
        if (motion && typeof motion.setParam === 'function') {
            return motion.setParam(key, value);
        }
        item[key] = value;
        return value;
    }

    set(key, value) {
        if (typeof this.keepTemplate === 'function') {
            this.keepTemplate(key, value);
        }
        this.items.forEach((item) => this.writeField(item, key, value));
        if (typeof this.onFieldSet === 'function') {
            this.onFieldSet(key, value);
        }
        return value;
    }

    moveTo(cell) {
        if (typeof this.setCenter === 'function') {
            return this.setCenter(cell);
        }
        if (cell && typeof cell.col === 'number' && typeof cell.row === 'number') {
            this.center = { col: cell.col, row: cell.row };
        }
        return this.center;
    }

    noteDetached(object) {
        const index = this.parts.findIndex((part) => part.object === object);
        if (index < 0) {
            return;
        }
        this.parts.splice(index, 1);
        if (object && object.parent === this) {
            object.parent = null;
        }
        this.afterRemove(object);
        if (typeof this.onPartRemoved === 'function') {
            this.onPartRemoved(object);
        }
        this.emit('removed', object);
    }

    dropItem(object) {
        if (!object) {
            return null;
        }
        const index = this.parts.findIndex((part) => part.object === object);
        if (index >= 0) {
            this.parts.splice(index, 1);
        }
        if (object.parent === this) {
            object.parent = null;
        }
        if (typeof object.cancelAll === 'function') {
            object.cancelAll();
        }
        const heatMap = this.heatMap;
        if (heatMap) {
            if (object.kind === 'hot-ball' && object.motion && typeof heatMap.removeBall === 'function') {
                heatMap.removeBall(object.motion);
            } else if (object.kind === 'hot-rod' && object.emitter && typeof heatMap.removeRod === 'function') {
                heatMap.removeRod(object.emitter);
            } else if (object.emitter && typeof heatMap.removeHighlighter === 'function') {
                heatMap.removeHighlighter(object.emitter);
            } else if (typeof heatMap.removeHighlighter === 'function') {
                heatMap.removeHighlighter(object);
            }
        }
        this.afterRemove(object);
        if (typeof this.onPartRemoved === 'function') {
            this.onPartRemoved(object);
        }
        this.emit('removed', object);
        return object;
    }

    remove(object, opts) {
        if (!object) {
            return null;
        }
        const instant = (opts && opts.instant) || this.exitInstant;
        if (instant) {
            this.dropItem(object);
            return null;
        }
        if (!object.definitions || !object.definitions.exit) {
            object.define('exit', this.exitDefinition());
        }
        const run = object.play('exit');
        if (run && run.finished && typeof run.finished.then === 'function') {
            run.finished.then((result) => {
                if (result && result.status === 'finished') {
                    this.noteDetached(object);
                }
            });
        }
        return run;
    }

    reveal(count) {
        const total = Math.max(0, count | 0);
        if (this.detached || !this.attached) {
            return heatDeadRun();
        }
        if (!total) {
            return heatDoneRun();
        }
        const parts = [];
        for (let index = 0; index < total; index += 1) {
            if (index) {
                parts.push(wait(HEAT_COMPOSITE_CLEAR_GAP));
            }
            parts.push(call('reveal-add'));
        }
        this.define('reveal', sequence(parts, { slot: 'life', policy: 'replace', fill: 'none' }));
        return this.play('reveal', {
            hooks: {
                'reveal-add': () => {
                    if (typeof this.addItem === 'function') {
                        this.addItem();
                    }
                }
            }
        });
    }

    clear(opts) {
        const items = this.parts.map((part) => part.object);
        if (this.detached || !this.attached) {
            return heatDeadRun();
        }
        if (opts && opts.instant) {
            items.forEach((item) => this.dropItem(item));
            return heatDoneRun();
        }
        if (!items.length) {
            return heatDoneRun();
        }
        const queue = items.slice();
        const parts = [];
        queue.forEach((item, index) => {
            if (index) {
                parts.push(wait(HEAT_COMPOSITE_CLEAR_GAP));
            }
            parts.push(call('clear-one'));
        });
        this.define('clear', sequence(parts, { slot: 'life', policy: 'replace', fill: 'none' }));
        return this.play('clear', {
            hooks: {
                'clear-one': () => {
                    const item = queue.shift();
                    if (item && this.parts.some((part) => part.object === item)) {
                        this.remove(item);
                    }
                }
            }
        });
    }

    hit() {
        this.define('hit', shake({ slot: 'react' }));
        return this.play('hit');
    }

    break() {
        this.define('break', flash({ slot: 'react' }));
        return this.play('break');
    }

    reset(opts) {
        heatCancelAll(this);
        if (opts && opts.items === 'spec') {
            const count = typeof this.specCount === 'number' ? this.specCount : this.parts.length;
            this.parts.map((part) => part.object).forEach((item) => this.dropItem(item));
            for (let index = 0; index < count; index += 1) {
                if (typeof this.addItem === 'function') {
                    this.addItem({ animate: false });
                }
            }
            return this;
        }
        this.parts.forEach((part) => {
            const item = part.object;
            if (item && typeof item.cancelAll === 'function') {
                item.cancelAll();
            }
            if (item && typeof item.reset === 'function') {
                item.reset();
            }
        });
        if (typeof this.layoutItems === 'function') {
            this.layoutItems();
        }
        if (typeof this.resyncCycles === 'function') {
            this.resyncCycles();
        }
        return this;
    }
}
