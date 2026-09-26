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
        },
        {
            id: 'item',
            label: 'ITEM',
            rows: [
                { key: 'spawnX', label: 'SPAWN X', decimals: 1 },
                { key: 'spawnY', label: 'SPAWN Y', decimals: 1 },
                { key: 'shardCycling', label: 'CYCLING', type: 'bool' },
                { key: 'shardSpeed', label: 'SPEED', decimals: 1 },
                { key: 'shardDelay', label: 'DELAY', decimals: 1 },
                { key: 'shardGap', label: 'GAP', decimals: 1 },
                { key: 'addItem', label: 'SHARD', button: 'ADD', type: 'action' },
                { key: 'removeItem', label: 'SHARD', button: 'RMV', type: 'action' }
            ]
        },
        {
            id: 'from',
            label: 'FROM',
            rows: [
                { key: 'fromWidth', label: 'WIDTH', decimals: 0 },
                { key: 'fromHeight', label: 'HEIGHT', decimals: 0 },
                { key: 'fromAngle', label: 'ANGLE', decimals: 0 },
                { key: 'fromSkew', label: 'SKEW', decimals: 0 },
                { key: 'fromShapeHeat', label: 'SHAPE', decimals: 1 },
                { key: 'fromHeat', label: 'HEAT', decimals: 1 },
                { key: 'fromGlisten', label: 'GLISTEN', decimals: 0 }
            ]
        },
        {
            id: 'to',
            label: 'TO',
            rows: [
                { key: 'toWidth', label: 'WIDTH', decimals: 0 },
                { key: 'toHeight', label: 'HEIGHT', decimals: 0 },
                { key: 'toAngle', label: 'ANGLE', decimals: 0 },
                { key: 'toSkew', label: 'SKEW', decimals: 0 },
                { key: 'toShapeHeat', label: 'SHAPE', decimals: 1 },
                { key: 'toHeat', label: 'HEAT', decimals: 1 },
                { key: 'toGlisten', label: 'GLISTEN', decimals: 0 }
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
        this.shardInit = defaultHotMapScissorShardInit();
        this.spawn = { col: 0, row: 0 };
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
        const from = this.shardInit.from;
        const to = this.shardInit.to;
        return {
            centerX: this.center.col,
            centerY: this.center.row,
            spawnX: this.center.col + this.spawn.col,
            spawnY: this.center.row + this.spawn.row,
            shardCycling: this.shardInit.cycling !== false,
            shardSpeed: this.shardInit.speed,
            shardDelay: this.shardInit.delay,
            shardGap: this.shardInit.gap,
            fromWidth: from.width,
            fromHeight: from.height,
            fromAngle: from.angle,
            fromSkew: from.skew,
            fromShapeHeat: from.shapeHeat,
            fromHeat: from.heat,
            fromGlisten: from.glisten,
            toWidth: to.width,
            toHeight: to.height,
            toAngle: to.angle,
            toSkew: to.skew,
            toShapeHeat: to.shapeHeat,
            toHeat: to.heat,
            toGlisten: to.glisten
        };
    }

    nudgeParam(key, dir) {
        if (key === 'spawnX' || key === 'spawnY') {
            const axis = key === 'spawnX' ? 'col' : 'row';
            this.spawn[axis] += dir;
            return this.params[key];
        }
        if (key === 'shardCycling') {
            this.shardInit.cycling = !this.shardInit.cycling;
            return this.shardInit.cycling;
        }
        if (HOT_MAP_SCISSOR_SHARD_FIELD_KEYS[key]) {
            return this.nudgeShardField(HOT_MAP_SCISSOR_SHARD_FIELD_KEYS[key], dir);
        }
        if (HOT_MAP_SCISSOR_SHARD_POSE_KEYS[key]) {
            return this.nudgeShardPose(HOT_MAP_SCISSOR_SHARD_POSE_KEYS[key], dir);
        }
        const next = { col: this.center.col, row: this.center.row };
        if (key === 'centerX') {
            next.col += dir;
        } else if (key === 'centerY') {
            next.row += dir;
        }
        this.setCenter(next);
        return this.params[key];
    }

    nudgeShardField(name, dir) {
        const spec = BACK_HIGHLIGHT_FIELD_SPECS[name];
        if (!spec) {
            return this.shardInit[name];
        }
        this.shardInit[name] = clampBackHighlightSpec(
            BACK_HIGHLIGHT_FIELD_SPECS,
            name,
            this.shardInit[name] + dir * spec.step
        );
        return this.shardInit[name];
    }

    nudgeShardPose(pair, dir) {
        const group = pair[0];
        const prop = pair[1];
        const spec = BACK_HIGHLIGHT_POSE_SPECS[prop];
        const pose = this.shardInit[group];
        if (!spec || !pose) {
            return pose ? pose[prop] : 0;
        }
        pose[prop] = clampBackHighlightSpec(
            BACK_HIGHLIGHT_POSE_SPECS,
            prop,
            (pose[prop] || 0) + dir * spec.step
        );
        return pose[prop];
    }

    addItem() {
        const init = this.shardInit;
        const spawn = {
            col: this.center.col + this.spawn.col,
            row: this.center.row + this.spawn.row
        };
        const from = copyBackHighlightPose(init.from);
        const to = copyBackHighlightPose(init.to);
        const last = this.lastShard();
        if (last && last.emitter) {
            from.angle = wrapHotMapScissorAngle(last.emitter.from.angle + 45);
            to.angle = wrapHotMapScissorAngle(last.emitter.to.angle + 45);
        }
        const shard = new UiShard(this.heatMap, {
            cycling: init.cycling !== false,
            params: {
                speed: init.speed,
                delay: init.delay,
                gap: init.gap
            },
            from: from,
            to: to,
            center: spawn,
            target: { col: this.center.col, row: this.center.row }
        });
        this.add(shard);
        if (typeof this.onPartAdded === 'function') {
            this.onPartAdded(shard);
        }
        return shard;
    }

    lastShard() {
        for (let index = this.parts.length - 1; index >= 0; index -= 1) {
            const object = this.parts[index].object;
            if (object && object.kind === 'shard') {
                return object;
            }
        }
        return null;
    }

    removeItem() {
        for (let index = this.parts.length - 1; index >= 0; index -= 1) {
            const object = this.parts[index].object;
            if (!object || object.kind !== 'shard') {
                continue;
            }
            this.parts.splice(index, 1);
            if (this.heatMap && typeof this.heatMap.removeHighlighter === 'function') {
                this.heatMap.removeHighlighter(object.emitter);
            }
            if (typeof this.onPartRemoved === 'function') {
                this.onPartRemoved(object);
            }
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
        if (object.kind === 'back-highlight' || object.kind === 'shard') {
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
        if (object.kind === 'back-highlight' || object.kind === 'shard') {
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
            spawn: { col: this.spawn.col, row: this.spawn.row },
            shardInit: copyHotMapScissorShardInit(this.shardInit),
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
        if (data.spawn && typeof data.spawn.col === 'number' && typeof data.spawn.row === 'number') {
            this.spawn = { col: data.spawn.col, row: data.spawn.row };
        }
        if (data.shardInit) {
            this.shardInit = copyHotMapScissorShardInit(data.shardInit);
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

const HOT_MAP_SCISSOR_SHARD_FIELD_KEYS = {
    shardSpeed: 'speed',
    shardDelay: 'delay',
    shardGap: 'gap'
};

const HOT_MAP_SCISSOR_SHARD_POSE_KEYS = {
    fromWidth: ['from', 'width'],
    fromHeight: ['from', 'height'],
    fromAngle: ['from', 'angle'],
    fromSkew: ['from', 'skew'],
    fromShapeHeat: ['from', 'shapeHeat'],
    fromHeat: ['from', 'heat'],
    fromGlisten: ['from', 'glisten'],
    toWidth: ['to', 'width'],
    toHeight: ['to', 'height'],
    toAngle: ['to', 'angle'],
    toSkew: ['to', 'skew'],
    toShapeHeat: ['to', 'shapeHeat'],
    toHeat: ['to', 'heat'],
    toGlisten: ['to', 'glisten']
};

function wrapHotMapScissorAngle(deg) {
    const turn = 360;
    let value = ((deg + 180) % turn + turn) % turn - 180;
    if (value === -180) {
        return 180;
    }
    return value;
}

function defaultHotMapScissorShardInit() {
    const from = defaultBackHighlightPose('from');
    const to = defaultBackHighlightPose('to');
    from.skew = 0;
    from.shapeHeat = 0.5;
    from.glisten = 0;
    to.skew = 40;
    to.shapeHeat = 0.9;
    to.glisten = 100;
    return {
        cycling: true,
        speed: 1.2,
        delay: 0.5,
        gap: 0.4,
        from: from,
        to: to
    };
}

function copyHotMapScissorShardInit(raw) {
    const base = defaultHotMapScissorShardInit();
    const data = raw || {};
    if (typeof data.cycling === 'boolean') {
        base.cycling = data.cycling;
    }
    ['speed', 'delay', 'gap'].forEach((key) => {
        if (typeof data[key] === 'number') {
            base[key] = data[key];
        }
    });
    ['from', 'to'].forEach((group) => {
        const pose = data[group];
        if (!pose) {
            return;
        }
        Object.keys(BACK_HIGHLIGHT_POSE_SPECS).forEach((key) => {
            if (typeof pose[key] === 'number') {
                base[group][key] = pose[key];
            }
        });
    });
    return base;
}
