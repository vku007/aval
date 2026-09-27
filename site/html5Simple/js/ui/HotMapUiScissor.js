/**
 * HotMapUiScissor
 * Heat-map group with a center. Parts keep offsets from that center.
 * Setting the center moves every part by the same amount.
 * A new shard flies in from the spawn point at 1×1, grows to its pose size,
 * and turns through 360° plus TURN so it lands on its final angle.
 */
class HotMapUiScissor extends HotMapUiComposite {
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
        const preset = HOT_MAP_SCISSOR_PRESET;
        super(heatMap, {
            kind: 'hot-map-scissor',
            name: opts.name || preset.name,
            center: opts.center || preset.center,
            spawn: opts.spawn || preset.spawn
        });
        this.shardInit = defaultHotMapScissorShardInit();
        this.angleStep = 45;
    }

    get params() {
        const from = this.shardInit.from;
        const to = this.shardInit.to;
        return Object.assign(this.placeParams(), {
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
            toGlisten: to.glisten,
            angleStep: this.angleStep
        });
    }

    nudgeParam(key, dir) {
        const placed = this.nudgePlace(key, dir);
        if (placed !== undefined) {
            return placed;
        }
        if (key === 'angleStep') {
            const spec = HOT_MAP_SCISSOR_ANGLE_STEP;
            const next = this.angleStep + dir * spec.step;
            const clamped = Math.max(spec.min, Math.min(spec.max, next));
            this.angleStep = clamped;
            return this.angleStep;
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
        const last = this.lastPart('shard');
        if (last && last.emitter) {
            from.angle = wrapHotMapScissorAngle(last.emitter.from.angle + this.angleStep);
            to.angle = wrapHotMapScissorAngle(last.emitter.to.angle + this.angleStep);
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
        this.armShardFlight(shard);
        this.add(shard);
        if (typeof this.onPartAdded === 'function') {
            this.onPartAdded(shard);
        }
        return shard;
    }

    armShardFlight(shard) {
        const emitter = shard.emitter;
        const dx = emitter.target.col - emitter.center.col;
        const dy = emitter.target.row - emitter.center.row;
        const span = Math.hypot(dx, dy);
        if (span < 0.5) {
            return;
        }
        emitter.travel = {
            span: span,
            spin: HOT_MAP_SCISSOR_FLIGHT_SPIN + this.angleStep
        };
        const restStamp = emitter.stamp;
        emitter.stamp = (grid) => {
            const pose = hotMapScissorFlightPose(emitter);
            if (!emitter.travel) {
                emitter.stamp = restStamp;
                restStamp(grid);
                return;
            }
            stampBackHighlightRect(grid, emitter.cols, emitter.rows, emitter.center, pose);
        };
    }

    removeItem() {
        const object = this.takeLast('shard');
        if (!object) {
            return null;
        }
        if (this.heatMap && typeof this.heatMap.removeHighlighter === 'function') {
            this.heatMap.removeHighlighter(object.emitter);
        }
        if (typeof this.onPartRemoved === 'function') {
            this.onPartRemoved(object);
        }
        return object;
    }

    extendSerialized(data) {
        data.shardInit = copyHotMapScissorShardInit(this.shardInit);
        data.angleStep = this.angleStep;
        return data;
    }

    applySerializedExtras(data) {
        if (data.shardInit) {
            this.shardInit = copyHotMapScissorShardInit(data.shardInit);
        }
        if (typeof data.angleStep === 'number') {
            this.angleStep = data.angleStep;
        }
    }
}

HotMapUiScissor.ADD_TABS = [
    {
        id: 'add',
        rows: [
            { key: 'spawnX', label: 'SPAWN X', decimals: 1 },
            { key: 'spawnY', label: 'SPAWN Y', decimals: 1 },
            { key: 'angleStep', label: 'TURN', decimals: 0 },
            { key: 'addItem', label: 'SHARD', button: 'ADD', type: 'action' }
        ]
    }
];

const HOT_MAP_SCISSOR_ANGLE_STEP = { min: 0, max: 180, step: 5 };
const HOT_MAP_SCISSOR_FLIGHT_SIZE = 1;
const HOT_MAP_SCISSOR_FLIGHT_SPIN = 360;

function hotMapScissorFlightPose(emitter) {
    const travel = emitter.travel;
    const pose = emitter.current;
    if (!travel) {
        return pose;
    }
    const dx = emitter.target.col - emitter.center.col;
    const dy = emitter.target.row - emitter.center.row;
    const remain = Math.hypot(dx, dy) / travel.span;
    if (remain <= 0.002) {
        emitter.travel = null;
        return pose;
    }
    const along = Math.max(0, Math.min(1, 1 - remain));
    const shown = copyBackHighlightPose(pose);
    const start = HOT_MAP_SCISSOR_FLIGHT_SIZE;
    shown.width = start + (shown.width - start) * along;
    shown.height = start + (shown.height - start) * along;
    shown.angle -= (1 - along) * travel.spin;
    return shown;
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

const HOT_MAP_SCISSOR_PRESET = {
    name: 'Scissor',
    center: { col: 64.5, row: 140 },
    spawn: { col: -30, row: 82 },
    shardInit: {
        cycling: true,
        speed: 1.2,
        delay: 0.5,
        gap: 0.4,
        from: {
            width: 56,
            height: 8,
            angle: 0,
            skew: -60,
            heat: 0.45,
            shapeHeat: 0.1,
            glisten: 0
        },
        to: {
            width: 70,
            height: 4,
            angle: 0,
            skew: 60,
            heat: 1.8,
            shapeHeat: 0.2,
            glisten: 100
        }
    }
};

function defaultHotMapScissorShardInit() {
    const init = HOT_MAP_SCISSOR_PRESET.shardInit;
    const from = defaultBackHighlightPose('from');
    const to = defaultBackHighlightPose('to');
    Object.assign(from, init.from);
    Object.assign(to, init.to);
    return {
        cycling: init.cycling,
        speed: init.speed,
        delay: init.delay,
        gap: init.gap,
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
