/**
 * HeatNode
 * A heat object on a field: an item or, later, a composite.
 * Phaser stays in the field. Nodes only attach, detach, and tick.
 */
let HEAT_NODE_SEQ = 0;

class HeatNode {
    constructor(options) {
        const opts = options || {};
        HEAT_NODE_SEQ += 1;
        this.id = opts.id || ('heat-' + HEAT_NODE_SEQ);
        this.name = opts.name || '';
        this.kind = opts.kind || '';
        this.parent = null;
        this.field = opts.field || null;
        this.attached = false;
        this.detached = false;
        this.isHeatNode = true;
        this.fields = Object.assign({}, opts.fields || {});
        this.definitions = {};
        this._slots = {};
        this._runs = [];
        this.channels = new HeatChannels(this.kind);
    }

    define(name, definition) {
        return heatDefine(this, name, definition);
    }

    play(name, ctx) {
        return heatPlay(this, name, ctx);
    }

    cancelAll() {
        return heatCancelAll(this);
    }

    reset() {
        heatCancelAll(this);
        return this;
    }

    advanceRuns(delta) {
        heatAdvanceRuns(this, delta);
    }

    advanceState(delta) {
        this.advanceRuns(delta);
    }

    stampNow() {}

    tick(delta) {
        const outer = HEAT_TICK_DEPTH === 0;
        if (outer) {
            heatEnterTick();
        }
        try {
            this.advanceState(delta);
            this.stampNow();
        } finally {
            if (outer) {
                heatLeaveTick();
            }
        }
    }

    attach(field) {
        this.detached = false;
        if (!field || field.destroyed) {
            return this;
        }
        if (this.attached && this.field === field) {
            return this;
        }
        if (this.attached) {
            this.detach();
        }
        this.field = field;
        const item = this.listItem || this;
        if (this.listKey === 'balls' && typeof field.addBall === 'function') {
            field.addBall(item);
        } else if (this.listKey === 'rods' && typeof field.addRod === 'function') {
            field.addRod(item);
        } else if (this.listKey === 'highlighters' && typeof field.addHighlighter === 'function') {
            field.addHighlighter(item);
        } else if (typeof field.addRoot === 'function') {
            field.addRoot(this);
        }
        return this;
    }

    detach() {
        heatCancelAll(this);
        this.detached = true;
        const field = this.field;
        const parent = this.parent;
        if (!field) {
            this.attached = false;
        } else {
            const item = this.listItem || this;
            if (this.listKey === 'balls' && typeof field.removeBall === 'function') {
                field.removeBall(item);
            } else if (this.listKey === 'rods' && typeof field.removeRod === 'function') {
                field.removeRod(item);
            } else if (this.listKey === 'highlighters' && typeof field.removeHighlighter === 'function') {
                field.removeHighlighter(item);
            } else if (typeof field.removeRoot === 'function') {
                field.removeRoot(this);
            }
        }
        if (parent && typeof parent.noteDetached === 'function') {
            parent.noteDetached(this);
        }
        return this;
    }

    serialize() {
        return {
            id: this.id,
            name: this.name,
            kind: this.kind
        };
    }
}
