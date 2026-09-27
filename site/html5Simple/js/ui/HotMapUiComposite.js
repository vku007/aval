/**
 * HotMapUiComposite
 * Heat-map group with a center. Parts keep offsets from that center.
 * Setting the center moves every part by the same amount.
 * Stone, Scissor, and Paper extend this and add their own items.
 */
class HotMapUiComposite {
    constructor(heatMap, options) {
        const opts = options || {};
        const field = heatMap.field;
        this.heatMap = heatMap;
        this.kind = opts.kind || '';
        this.name = opts.name || 'Group';
        this.center = {
            col: opts.center && typeof opts.center.col === 'number'
                ? opts.center.col
                : (field.cols - 1) * 0.5,
            row: opts.center && typeof opts.center.row === 'number'
                ? opts.center.row
                : (field.rows - 1) * 0.5
        };
        this.parts = [];
        const spawn = opts.spawn || {};
        this.spawn = {
            col: typeof spawn.col === 'number' ? spawn.col : 0,
            row: typeof spawn.row === 'number' ? spawn.row : 0
        };
    }

    add(object) {
        if (!object || this.parts.some((part) => part.object === object)) {
            return object;
        }
        const part = { object: object, local: null };
        this.parts.push(part);
        part.local = this.captureLocal(object);
        this.afterAdd(object);
        return object;
    }

    remove(object) {
        const index = this.parts.findIndex((part) => part.object === object);
        if (index >= 0) {
            this.parts.splice(index, 1);
            this.afterRemove(object);
        }
    }

    afterAdd() {}

    afterRemove() {}

    placeParams() {
        return {
            centerX: this.center.col,
            centerY: this.center.row,
            spawnX: this.center.col + this.spawn.col,
            spawnY: this.center.row + this.spawn.row
        };
    }

    nudgePlace(key, dir) {
        if (key === 'spawnX' || key === 'spawnY') {
            const axis = key === 'spawnX' ? 'col' : 'row';
            this.spawn[axis] += dir;
            return this.params[key];
        }
        if (key === 'centerX' || key === 'centerY') {
            const next = { col: this.center.col, row: this.center.row };
            if (key === 'centerX') {
                next.col += dir;
            } else {
                next.row += dir;
            }
            this.setCenter(next);
            return this.params[key];
        }
        return undefined;
    }

    lastPart(kind) {
        for (let index = this.parts.length - 1; index >= 0; index -= 1) {
            const object = this.parts[index].object;
            if (object && object.kind === kind) {
                return object;
            }
        }
        return null;
    }

    takeLast(kind) {
        for (let index = this.parts.length - 1; index >= 0; index -= 1) {
            const object = this.parts[index].object;
            if (!object || object.kind !== kind) {
                continue;
            }
            this.parts.splice(index, 1);
            return object;
        }
        return null;
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
        if (!object) {
            return null;
        }
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
        if (object.kind === 'back-highlight' || object.kind === 'shard' || object.kind === 'sheet') {
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
        if (!local || !object) {
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
        if (object.kind === 'back-highlight' || object.kind === 'shard' || object.kind === 'sheet') {
            hotMapStonePlace(object.emitter.center, origin, local.center);
            hotMapStonePlace(object.emitter.target, origin, local.target);
        }
    }

    serialize() {
        this.parts.forEach((part) => {
            part.local = this.captureLocal(part.object);
        });
        const data = {
            name: this.name,
            center: { col: this.center.col, row: this.center.row },
            spawn: { col: this.spawn.col, row: this.spawn.row },
            parts: this.parts.map((part) => ({
                kind: part.object.kind,
                object: hotMapStoneWithLocalPoints(part.object.serialize(), part.local)
            }))
        };
        return this.extendSerialized(data);
    }

    extendSerialized(data) {
        return data;
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
        if (data.spawn && typeof data.spawn.col === 'number' && typeof data.spawn.row === 'number') {
            this.spawn = { col: data.spawn.col, row: data.spawn.row };
        }
        this.applySerializedExtras(data);
        (data.parts || []).forEach((entry, index) => {
            const part = this.parts[index];
            if (!part || !entry || !entry.object || typeof part.object.applySerialized !== 'function') {
                return;
            }
            part.object.applySerialized(hotMapStoneWithAbsolutePoints(this.center, entry.object));
            part.local = this.captureLocal(part.object);
        });
    }

    applySerializedExtras() {}
}

const HOT_MAP_STONE_POINT_KEYS = ['orbitCenter', 'orbitTarget', 'start', 'end', 'center', 'target'];

function hotMapStoneDelta(origin, point) {
    if (!point) {
        return null;
    }
    return {
        col: point.col - origin.col,
        row: point.row - origin.row
    };
}

function hotMapStonePlace(point, origin, delta) {
    if (!point || !delta) {
        return;
    }
    point.col = origin.col + delta.col;
    point.row = origin.row + delta.row;
}

function hotMapStoneWithLocalPoints(raw, local) {
    const data = Object.assign({}, raw);
    HOT_MAP_STONE_POINT_KEYS.forEach((key) => {
        if (local && local[key]) {
            data[key] = { col: local[key].col, row: local[key].row };
        }
    });
    return data;
}

function hotMapStoneWithAbsolutePoints(origin, raw) {
    const data = Object.assign({}, raw);
    HOT_MAP_STONE_POINT_KEYS.forEach((key) => {
        const point = raw && raw[key];
        if (point && typeof point.col === 'number' && typeof point.row === 'number') {
            data[key] = {
                col: origin.col + point.col,
                row: origin.row + point.row
            };
        }
    });
    return data;
}
