/**
 * HotMapUiScissor
 * Heat-map group with a center. Parts keep offsets from that center.
 * Setting the center moves every part by the same amount.
 * A new shard's field position is the landing cell. Enter moves from the
 * spawn offset, grows from nearly nothing, and spins through 360° plus TURN.
 * Spawn and turn are frozen when that run starts.
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
        this.dramaHeat = preset.dramaHeat;
        this.dramaGravity = preset.dramaGravity;
        this.dramaTime = preset.dramaTime;
        this.dramaSpinX = preset.dramaSpinX;
        this.dramaSpinY = preset.dramaSpinY;
        this.dramaSpinZ = preset.dramaSpinZ;
        this.dramaFade = preset.dramaFade;
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
            angleStep: this.angleStep,
            dramaHeat: this.dramaHeat,
            dramaGravity: this.dramaGravity,
            dramaTime: this.dramaTime,
            dramaSpinX: this.dramaSpinX,
            dramaSpinY: this.dramaSpinY,
            dramaSpinZ: this.dramaSpinZ,
            dramaFade: this.dramaFade
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
            this.layoutItems();
            return this.angleStep;
        }
        if (key === 'shardCycling') {
            this.shardInit.cycling = !this.shardInit.cycling;
            return this.shardInit.cycling;
        }
        if (HOT_MAP_SCISSOR_DRAMA_KEYS[key]) {
            return this.nudgeDrama(key, dir);
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
        this.items.forEach((item) => this.writeField(item, name, this.shardInit[name]));
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
        const label = prop.charAt(0).toUpperCase() + prop.slice(1);
        this.items.forEach((item) => this.writeField(item, group + label, pose[prop]));
        return pose[prop];
    }

    addItem(opts) {
        const animate = !opts || opts.animate !== false;
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
        const landing = { col: this.center.col, row: this.center.row };
        const shard = new UiShard(this.heatMap, {
            cycling: init.cycling !== false,
            params: {
                speed: init.speed,
                delay: init.delay,
                gap: init.gap
            },
            from: from,
            to: to,
            center: landing,
            target: { col: landing.col, row: landing.row }
        });
        this.add(shard);
        shard.define('exit', scissorExit());
        if (animate) {
            this.playShardEnter(shard, spawn, landing);
        } else {
            this.layoutItems();
        }
        if (typeof this.onPartAdded === 'function') {
            this.onPartAdded(shard);
        }
        this.emit('added', shard);
        return shard;
    }

    layoutItems() {
        layoutScissorItems(this);
    }

    keepTemplate(key, value) {
        const field = HOT_MAP_SCISSOR_SHARD_FIELD_KEYS[key];
        if (field && this.shardInit) {
            this.shardInit[field] = value;
            return;
        }
        const pose = HOT_MAP_SCISSOR_SHARD_POSE_KEYS[key];
        if (pose && this.shardInit && this.shardInit[pose[0]]) {
            this.shardInit[pose[0]][pose[1]] = value;
            return;
        }
        if (key === 'angleStep' && typeof value === 'number') {
            this.angleStep = value;
        }
    }

    writeField(item, key, value) {
        const field = HOT_MAP_SCISSOR_SHARD_FIELD_KEYS[key] || key;
        return HeatComposite.prototype.writeField.call(this, item, field, value);
    }

    onFieldSet(key) {
        if (key === 'angleStep') {
            this.layoutItems();
        }
    }

    playShardEnter(shard, spawn, landing) {
        const turn = this.angleStep;
        const speed = shard.emitter.params.speed;
        shard.define('enter', scissorEnter());
        return shard.play('enter', {
            spawn: {
                col: spawn.col - landing.col,
                row: spawn.row - landing.row
            },
            turn: turn,
            spin: -(HOT_MAP_SCISSOR_FLIGHT_SPIN + turn),
            duration: 3 / speed
        });
    }

    nudgeDrama(key, dir) {
        const spec = HOT_MAP_SCISSOR_DRAMA_KEYS[key];
        const next = this[key] + dir * spec.step;
        this[key] = clampHotMapScissorDrama(key, next);
        return this[key];
    }

    lastScissorShard() {
        for (let index = this.parts.length - 1; index >= 0; index -= 1) {
            const object = this.parts[index].object;
            if (object && object.kind === 'shard' && !object._scissorLeaving) {
                return object;
            }
        }
        return null;
    }

    removeItem() {
        const object = this.lastPart('shard');
        if (!object) {
            return null;
        }
        this.remove(object, { instant: true });
        return object;
    }

    playScissorDrama(shard) {
        if (!shard || !shard.emitter || shard._scissorLeaving) {
            return null;
        }
        shard._scissorLeaving = true;
        shard.cancelAll();
        const shown = copyBackHighlightPose(shard.emitter.current);
        shard.emitter.from = shown;
        shard.emitter.to = copyBackHighlightPose(shown);
        shard.emitter.current = copyBackHighlightPose(shown);
        const time = Math.max(0.05, this.dramaTime);
        const fade = Math.max(0, Math.min(this.dramaFade, time));
        shard.define('exit', scissorDrama());
        return this.remove(shard, {
            ctx: {
                heat: this.dramaHeat,
                drop: 0.5 * Math.max(0, this.dramaGravity) * time * time,
                duration: time,
                hold: time - fade,
                fade: fade,
                spinX: this.dramaSpinX * time,
                spinY: this.dramaSpinY * time,
                spinZ: this.dramaSpinZ * time
            }
        });
    }

    removeItemWithDrama() {
        const shard = this.lastScissorShard();
        if (!shard || !shard.emitter) {
            return null;
        }
        this.playScissorDrama(shard);
        return shard;
    }

    removeWithDrama(count) {
        const all = count == null;
        const limit = all ? Infinity : Math.max(0, count | 0);
        const shards = [];
        for (let index = this.parts.length - 1; index >= 0 && shards.length < limit; index -= 1) {
            const object = this.parts[index].object;
            if (object && object.kind === 'shard' && !object._scissorLeaving && object.emitter) {
                shards.push(object);
            }
        }
        return heatStaggerDramas(this, shards.map((shard) => () => this.playScissorDrama(shard)));
    }

    extendSerialized(data) {
        data.shardInit = copyHotMapScissorShardInit(this.shardInit);
        data.angleStep = this.angleStep;
        Object.keys(HOT_MAP_SCISSOR_DRAMA_KEYS).forEach((key) => {
            data[key] = this[key];
        });
        return data;
    }

    applySerializedExtras(data) {
        if (data.shardInit) {
            this.shardInit = copyHotMapScissorShardInit(data.shardInit);
        }
        if (typeof data.angleStep === 'number') {
            this.angleStep = data.angleStep;
        }
        Object.keys(HOT_MAP_SCISSOR_DRAMA_KEYS).forEach((key) => {
            if (typeof data[key] === 'number') {
                this[key] = clampHotMapScissorDrama(key, data[key]);
            }
        });
    }
}

HotMapUiScissor.REMOVE_TABS = [
    {
        id: 'remove',
        rows: [
            { key: 'dramaHeat', label: 'HEAT', decimals: 1 },
            { key: 'dramaGravity', label: 'GRAV', decimals: 0 },
            { key: 'dramaTime', label: 'TIME', decimals: 2 },
            { key: 'dramaSpinX', label: 'SPIN X', decimals: 0 },
            { key: 'dramaSpinY', label: 'SPIN Y', decimals: 0 },
            { key: 'dramaSpinZ', label: 'SPIN Z', decimals: 0 },
            { key: 'dramaFade', label: 'FADE', decimals: 2 },
            { key: 'removeItemWithDrama', label: 'DRAMA', button: 'POP', type: 'action' },
            { key: 'removeItem', label: 'SHARD', button: 'RMV', type: 'action' }
        ]
    }
];

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
const HOT_MAP_SCISSOR_FLIGHT_SPIN = 360;

const HOT_MAP_SCISSOR_DRAMA_KEYS = {
    dramaHeat: { min: 0, max: 8, step: 0.1 },
    dramaGravity: { min: 0, max: 800, step: 10 },
    dramaTime: { min: 0.1, max: 4, step: 0.05 },
    dramaSpinX: { min: -720, max: 720, step: 10 },
    dramaSpinY: { min: -720, max: 720, step: 10 },
    dramaSpinZ: { min: -720, max: 720, step: 10 },
    dramaFade: { min: 0, max: 4, step: 0.05 }
};

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

function clampHotMapScissorDrama(key, value) {
    const spec = HOT_MAP_SCISSOR_DRAMA_KEYS[key];
    const stepped = Math.round(value / spec.step) * spec.step;
    const clamped = Math.max(spec.min, Math.min(spec.max, stepped));
    const decimals = spec.step < 0.1 ? 2 : spec.step < 1 ? 1 : 0;
    return Number(clamped.toFixed(decimals));
}

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
    dramaHeat: 3,
    dramaGravity: 60,
    dramaTime: 1.5,
    dramaSpinX: 40,
    dramaSpinY: -20,
    dramaSpinZ: 70,
    dramaFade: 0.45,
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

heatRegisterComposite('scissor', {
    create(heatMap, overrides) {
        return new HotMapUiScissor(heatMap, overrides);
    }
});

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
