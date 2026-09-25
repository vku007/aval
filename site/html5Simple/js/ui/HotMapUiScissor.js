/**
 * HotMapUiScissor
 * Heat-map group with a center. Parts keep offsets from that center.
 * Setting the center moves every part by the same amount.
 */
class HotMapUiScissor {
    static PROP_TABS = [
        {
            id: 'place',
            label: 'PLACE',
            rows: [
                { key: 'centerX', label: 'CENTER X', decimals: 1 },
                { key: 'centerY', label: 'CENTER Y', decimals: 1 }
            ]
        }
    ];

    constructor(heatMap, options) {
        const opts = options || {};
        const field = heatMap.field;
        this.heatMap = heatMap;
        this.kind = 'hot-map-scissor';
        this.name = opts.name || 'Scissor';
        this.center = {
            col: opts.center && typeof opts.center.col === 'number'
                ? opts.center.col
                : (field.cols - 1) * 0.5,
            row: opts.center && typeof opts.center.row === 'number'
                ? opts.center.row
                : (field.rows - 1) * 0.5
        };
        this.parts = [];
    }

    add(object) {
        if (!object || this.parts.some((part) => part.object === object)) {
            return object;
        }
        const part = { object: object, local: null };
        this.parts.push(part);
        part.local = this.captureLocal(object);
        return object;
    }

    remove(object) {
        const index = this.parts.findIndex((part) => part.object === object);
        if (index >= 0) {
            this.parts.splice(index, 1);
        }
    }

    get params() {
        return {
            centerX: this.center.col,
            centerY: this.center.row
        };
    }

    nudgeParam(key, dir) {
        const next = { col: this.center.col, row: this.center.row };
        if (key === 'centerX') {
            next.col += dir;
        } else if (key === 'centerY') {
            next.row += dir;
        }
        this.setCenter(next);
        return this.params[key];
    }

    retarget(cell) {
        this.setCenter(cell);
    }

    setCenter(cell) {
        if (!cell || typeof cell.col !== 'number' || typeof cell.row !== 'number') {
            return this.center;
        }
        this.parts.forEach((part) => {
            part.local = this.captureLocal(part.object);
        });
        this.center = { col: cell.col, row: cell.row };
        this.parts.forEach((part) => this.applyLocal(part));
        return this.center;
    }

    captureLocal(object) {
        const origin = this.center;
        if (object.kind === 'hot-ball') {
            const motion = object.motion;
            return {
                orbitCenter: hotMapStoneDelta(origin, motion.orbitCenter),
                orbitTarget: motion.orbitTarget ? hotMapStoneDelta(origin, motion.orbitTarget) : null
            };
        }
        if (object.kind === 'hot-rod') {
            const emitter = object.emitter;
            return {
                start: hotMapStoneDelta(origin, emitter.start),
                end: hotMapStoneDelta(origin, emitter.end),
                center: hotMapStoneDelta(origin, emitter.center),
                target: hotMapStoneDelta(origin, emitter.target)
            };
        }
        if (object.kind === 'back-highlight') {
            const emitter = object.emitter;
            return {
                center: hotMapStoneDelta(origin, emitter.center),
                target: hotMapStoneDelta(origin, emitter.target)
            };
        }
        return null;
    }

    applyLocal(part) {
        const origin = this.center;
        const local = part.local;
        const object = part.object;
        if (!local) {
            return;
        }
        if (object.kind === 'hot-ball') {
            hotMapStonePlace(object.motion.orbitCenter, origin, local.orbitCenter);
            if (local.orbitTarget && object.motion.orbitTarget) {
                hotMapStonePlace(object.motion.orbitTarget, origin, local.orbitTarget);
            }
            return;
        }
        if (object.kind === 'hot-rod') {
            const emitter = object.emitter;
            hotMapStonePlace(emitter.start, origin, local.start);
            hotMapStonePlace(emitter.end, origin, local.end);
            hotMapStonePlace(emitter.center, origin, local.center);
            hotMapStonePlace(emitter.target, origin, local.target);
            return;
        }
        if (object.kind === 'back-highlight') {
            hotMapStonePlace(object.emitter.center, origin, local.center);
            hotMapStonePlace(object.emitter.target, origin, local.target);
        }
    }

    serialize() {
        this.parts.forEach((part) => {
            part.local = this.captureLocal(part.object);
        });
        return {
            name: this.name,
            center: { col: this.center.col, row: this.center.row },
            parts: this.parts.map((part) => ({
                kind: part.object.kind,
                object: hotMapStoneWithLocalPoints(part.object.serialize(), part.local)
            }))
        };
    }

    applySerialized(data) {
        if (!data) {
            return;
        }
        if (data.name) {
            this.name = data.name;
        }
        if (data.center && typeof data.center.col === 'number' && typeof data.center.row === 'number') {
            this.center = { col: data.center.col, row: data.center.row };
        }
        (data.parts || []).forEach((entry, index) => {
            const part = this.parts[index];
            if (!part || !entry || !entry.object || typeof part.object.applySerialized !== 'function') {
                return;
            }
            part.object.applySerialized(hotMapStoneWithAbsolutePoints(this.center, entry.object));
            part.local = this.captureLocal(part.object);
        });
    }
}
