/**
 * UiPrime
 * A composite on one center: one circle, one round, and exactly one round item.
 * The circle, the round, and the item take their defaults from the Prime entry
 * in resources/prime-1.json. The round fills that circle and cycles.
 * The item is a smaller round on that same center, and it cycles too.
 * A second item is refused. Removing the item leaves the circle and the round.
 */
let UI_PRIME_SEQ = 0;
const PRIME_ITEM_FADE = 0.6;
const PRIME_BODY_SCALE = 0.8;
const PRIME_PRESET_JSON_KEY = 'primePreset';
const PRIME_PRESET_JSON_PATH = 'resources/prime-1.json?v=4';
const PRIME_ITEM_PRESET = {
    isVisible: true,
    cycling: true,
    params: { speed: 1.2, delay: 0.5, gap: 0.4 },
    from: { radius: 18, heat: 0.8 },
    to: { radius: 26, heat: 2.4 }
};

class UiPrime extends HeatComposite {
    static PROP_TABS = [
        coreItemTab('circle_', 'CIRCLE', UiCircle.PROP_TABS, ['centerX', 'centerY']),
        coreItemTab('round_', 'ROUND', UiRound.PROP_TABS, ['centerX', 'centerY']),
        coreItemTab('item_', 'ITEM', UiRound.PROP_TABS, ['centerX', 'centerY']),
        {
            id: 'place',
            label: 'PLACE',
            rows: [
                { key: 'centerX', label: 'CENTER X%', decimals: 0 },
                { key: 'centerY', label: 'CENTER Y%', decimals: 0 }
            ]
        }
    ];

    constructor(heatMap, options) {
        const opts = options || {};
        UI_PRIME_SEQ += 1;
        const name = opts.name || `Prime ${UI_PRIME_SEQ}`;
        const cell = coreCell(heatMap.field, opts);
        super(heatMap, {
            kind: 'prime',
            name: name,
            center: { col: cell.col, row: cell.row },
            exitInstant: false
        });
        this.scene = heatMap.scene;
        this._visible = opts.isVisible !== false;
        this.round = null;
        this.circle = null;
        this.item = null;
        this.itemSpec = null;
        this.ensureShell();
        this.addItem({ animate: opts.animate !== false });
    }

    get isVisible() {
        return this._visible !== false;
    }

    set isVisible(value) {
        this._visible = !!value;
        this.items.forEach((item) => {
            item.isVisible = this._visible;
        });
    }

    afterAdd() {}

    afterRemove(object) {
        if (this.round === object) {
            this.round = null;
        }
        if (this.circle === object) {
            this.circle = null;
        }
        if (this.item === object) {
            this.item = null;
        }
    }

    get params() {
        const stub = coreFieldStub(this.heatMap.field);
        const values = {
            centerX: hotRodCoordToPct(stub, 'col', this.center.col),
            centerY: hotRodCoordToPct(stub, 'row', this.center.row)
        };
        copyPrefixedParams(values, 'circle_', this.circle);
        copyPrefixedParams(values, 'round_', this.round);
        if (this.item) {
            copyPrefixedParams(values, 'item_', this.item);
        } else {
            primeFillItemParams(values, this.itemSpec, values.centerX, values.centerY);
        }
        return values;
    }

    nudgeParam(key, dir) {
        if (key === 'centerX' || key === 'centerY') {
            return this.nudgeCenter(key === 'centerX' ? 'col' : 'row', dir);
        }
        const routed = primeRoute(key);
        if (!routed) {
            return this.params[key];
        }
        const items = this.routedItems(routed.prefix);
        if (!items.length) {
            if (routed.prefix === 'item_' && this.itemSpec) {
                const value = primeNudgeSpec(this.itemSpec, routed.key, dir);
                return value;
            }
            return 0;
        }
        const value = items[0].nudgeParam(routed.key, dir);
        if (routed.prefix === 'item_') {
            this.rememberItem();
        }
        return value;
    }

    setParam(key, value) {
        if (key === 'centerX' || key === 'centerY') {
            const axis = key === 'centerX' ? 'col' : 'row';
            const stub = coreFieldStub(this.heatMap.field);
            const next = { col: this.center.col, row: this.center.row };
            next[axis] = hotRodPctToCoord(stub, axis, value);
            this.setCenter(next);
            return this.params[key];
        }
        const routed = primeRoute(key);
        if (!routed) {
            return this.params[key];
        }
        const items = this.routedItems(routed.prefix);
        if (!items.length && routed.prefix === 'item_' && this.itemSpec) {
            primeWriteSpec(this.itemSpec, routed.key, value);
            return this.params[key];
        }
        items.forEach((item) => {
            coreWriteItem(item, routed.key, value);
        });
        if (routed.prefix === 'item_') {
            this.rememberItem();
        }
        return this.params[key];
    }

    nudgeCenter(axis, dir) {
        const stub = coreFieldStub(this.heatMap.field);
        const pct = hotRodCoordToPct(stub, axis, this.center[axis]);
        const nextPct = Math.max(
            HOT_ROD_PATH_PCT_MIN,
            Math.min(HOT_ROD_PATH_PCT_MAX, pct + dir * HOT_ROD_PATH_PCT_STEP)
        );
        const next = { col: this.center.col, row: this.center.row };
        next[axis] = hotRodPctToCoord(stub, axis, nextPct);
        this.setCenter(next);
        return nextPct;
    }

    setCenter(point) {
        const stub = coreFieldStub(this.heatMap.field);
        const cell = clampHotRodPoint(stub, point || this.center);
        this.center.col = cell.col;
        this.center.row = cell.row;
        if (this.circle) {
            corePlaceEmitter(this.circle.emitter, cell);
        }
        if (this.round) {
            corePlaceEmitter(this.round.emitter, cell);
        }
        if (this.item) {
            corePlaceEmitter(this.item.emitter, cell);
        }
        return this.center;
    }

    retarget(cell) {
        return this.setCenter(cell);
    }

    layoutItems() {
        this.setCenter(this.center);
    }

    ensureShell() {
        if (this.circle && this.round) {
            this.setCenter(this.center);
            return;
        }
        const name = this.name;
        if (!this.circle) {
            this.circle = new UiCircle(this.heatMap, {
                name: `${name} Circle`,
                isVisible: this._visible
            });
            this.adopt(this.circle);
        }
        if (!this.round) {
            this.round = new UiRound(this.heatMap, {
                name: `${name} Round`,
                isVisible: this._visible
            });
            this.adopt(this.round);
        }
        this.paintShell();
        this.setCenter(this.center);
    }

    addItem(opts) {
        const animate = !opts || opts.animate !== false;
        this.ensureShell();
        if (this.item) {
            return null;
        }
        const item = new UiRound(this.heatMap, {
            name: `${this.name} Item`,
            isVisible: this._visible
        });
        this.paintItem(item);
        this.adopt(item);
        this.item = item;
        item.define('exit', primeItemExit());
        if (animate) {
            this.playItemEnter(item);
        }
        return item;
    }

    playItemEnter(item) {
        if (!item || typeof item.play !== 'function') {
            return null;
        }
        item.define('enter', fade({
            from: 0,
            to: 1,
            duration: PRIME_ITEM_FADE,
            ease: 'sine',
            slot: 'life',
            fill: 'none'
        }));
        return item.play('enter');
    }

    rememberItem() {
        if (!this.item) {
            return;
        }
        const data = this.item.serialize();
        delete data.name;
        delete data.center;
        delete data.target;
        this.itemSpec = data;
    }

    removeItem() {
        const item = this.item;
        if (!item || item._primeLeaving) {
            return null;
        }
        this.rememberItem();
        item._primeLeaving = true;
        if (!item.definitions || !item.definitions.exit) {
            item.define('exit', primeItemExit());
        }
        this.remove(item);
        return item;
    }

    paintShell() {
        const defaults = primeDefaults(this.scene);
        if (this.circle) {
            const circle = applyCoreCircleSize(coreCopyPreset((defaults && defaults.circle) || CORE_PRESET.circle));
            circle.name = this.circle.name;
            this.circle.applySerialized(circle);
            this.circle.isVisible = this._visible && circle.isVisible !== false;
        }
        if (this.round) {
            const round = coreCopyPreset((defaults && defaults.round) || CORE_PRESET.round);
            if (!defaults) {
                round.cycling = true;
            }
            applyCoreRoundRadius(round, this.circle && this.circle.emitter);
            round.name = this.round.name;
            this.round.applySerialized(round);
            this.round.isVisible = this._visible;
        }
    }

    paintItem(item) {
        const defaults = primeDefaults(this.scene);
        const preset = coreCopyPreset(this.itemSpec || (defaults && defaults.item) || PRIME_ITEM_PRESET);
        preset.name = item.name;
        item.applySerialized(preset);
        item.isVisible = this._visible && preset.isVisible !== false;
        if (this.round && this.round.emitter) {
            const source = this.round.emitter;
            item.copyBehaviourState(this.round);
            const pose = source.phase === 'wait' ? item.emitter.to : item.emitter.from;
            item.emitter.current = copyBackHighlightPose(pose);
            item.emitter.phase = source.phase;
            item.emitter.waitLeft = source.waitLeft;
        }
        corePlaceEmitter(item.emitter, this.center);
    }

    adopt(object) {
        if (!object || this.parts.some((part) => part.object === object)) {
            return object;
        }
        this.parts.push({ object: object });
        object.parent = this;
        if (typeof this.onPartAdded === 'function') {
            this.onPartAdded(object);
        }
        this.emit('added', object);
        return object;
    }

    dropOwned(object) {
        if (!object) {
            return;
        }
        this.dropItem(object);
    }

    releaseContents() {
        const parts = this.parts.map((part) => part.object);
        parts.forEach((object) => this.dropOwned(object));
    }

    routedItems(prefix) {
        if (prefix === 'circle_') {
            return this.circle ? [this.circle] : [];
        }
        if (prefix === 'round_') {
            return this.round ? [this.round] : [];
        }
        if (prefix === 'item_') {
            return this.item ? [this.item] : [];
        }
        return [];
    }

    serialize() {
        return {
            name: this.name,
            isVisible: this.isVisible,
            center: copyOrbitPoint(this.center),
            target: copyOrbitPoint(this.center),
            round: this.round ? this.round.serialize() : null,
            circle: this.circle ? this.circle.serialize() : null,
            item: this.item ? this.item.serialize() : null,
            itemSpec: this.itemSpec ? coreCopyPreset(this.itemSpec) : null
        };
    }

    applySerialized(data) {
        if (!data) {
            return;
        }
        if (data.name) {
            this.name = data.name;
        }
        if (data.isVisible != null) {
            this._visible = data.isVisible !== false;
        }
        if (this.item && typeof this.item.cancelAll === 'function') {
            this.item.cancelAll();
        }
        if ((data.round || data.circle || data.item) && (!this.circle || !this.round)) {
            this.ensureShell();
        }
        this.isVisible = this._visible;
        if (this.round && data.round) {
            this.round.applySerialized(data.round);
        }
        if (this.circle && data.circle) {
            this.circle.applySerialized(data.circle);
        }
        if (data.item) {
            if (!this.item) {
                this.addItem({ animate: false });
            }
            if (this.item) {
                this.item.applySerialized(data.item);
                this.rememberItem();
            }
        } else if (data.item === null && this.item) {
            this.dropOwned(this.item);
        }
        if (data.itemSpec) {
            this.itemSpec = coreCopyPreset(data.itemSpec);
        }
        const center = copyOrbitPoint(data.target) || copyOrbitPoint(data.center);
        if (center) {
            this.setCenter(center);
        } else {
            this.setCenter(this.center);
        }
    }
}

UiPrime.ADD_TABS = [
    {
        id: 'add',
        rows: [
            { key: 'addItem', label: 'ROUND', button: 'ADD', type: 'action' }
        ]
    }
];

UiPrime.REMOVE_TABS = [
    {
        id: 'remove',
        rows: [
            { key: 'removeItem', label: 'ROUND', button: 'RMV', type: 'action' }
        ]
    }
];

function preloadPrimePreset(scene) {
    if (!scene || !scene.load || !scene.cache || !scene.cache.json) {
        return;
    }
    if (scene.cache.json.exists(PRIME_PRESET_JSON_KEY)) {
        return;
    }
    scene.load.json(PRIME_PRESET_JSON_KEY, PRIME_PRESET_JSON_PATH);
}

function primePresetFile(scene) {
    if (!scene || !scene.cache || !scene.cache.json || !scene.cache.json.exists(PRIME_PRESET_JSON_KEY)) {
        return null;
    }
    return scene.cache.json.get(PRIME_PRESET_JSON_KEY);
}

function primePartPreset(entry) {
    if (!entry) {
        return null;
    }
    const copy = coreCopyPreset(entry);
    delete copy.name;
    delete copy.center;
    delete copy.target;
    return copy;
}

let primePresetWarned = false;

function primeDefaults(scene) {
    const file = primePresetFile(scene);
    const entry = file && Array.isArray(file.primes) ? file.primes[0] : null;
    if (!entry) {
        if (!primePresetWarned) {
            primePresetWarned = true;
            console.warn('[UiPrime] prime-1.json is not loaded');
        }
        return null;
    }
    return {
        circle: primePartPreset(entry.circle),
        round: primePartPreset(entry.round),
        item: primePartPreset(entry.item || entry.itemSpec)
    };
}

function scalePrimeBall(ball) {
    const motion = ball && ball.motion;
    if (!motion || typeof motion.setParam !== 'function' || !motion.params) {
        return;
    }
    motion.setParam('radius', motion.params.radius * PRIME_BODY_SCALE);
    motion.setParam('orbitRadius', motion.params.orbitRadius * PRIME_BODY_SCALE);
}

function scalePrimeShard(shard) {
    const emitter = shard && shard.emitter;
    if (!emitter || typeof emitter.setParam !== 'function' || !emitter.from || !emitter.to) {
        return;
    }
    emitter.setParam('fromWidth', emitter.from.width * PRIME_BODY_SCALE);
    emitter.setParam('fromHeight', emitter.from.height * PRIME_BODY_SCALE);
    emitter.setParam('toWidth', emitter.to.width * PRIME_BODY_SCALE);
    emitter.setParam('toHeight', emitter.to.height * PRIME_BODY_SCALE);
}

function scalePrimeDisk(sheet) {
    if (!sheet || typeof sheet.setParam !== 'function') {
        return;
    }
    sheet.setParam('radFrom', sheet.radFrom * PRIME_BODY_SCALE);
    sheet.setParam('radTo', sheet.radTo * PRIME_BODY_SCALE);
    sheet.setParam('ballRadius', sheet.ballRadius * PRIME_BODY_SCALE);
    sheet.setParam('ballSize', sheet.ballSize * PRIME_BODY_SCALE);
}

function primeItemExit() {
    return sequence([
        fade({
            from: 'current',
            to: 0,
            duration: PRIME_ITEM_FADE,
            ease: 'sine'
        }),
        call('detach')
    ], { slot: 'life', policy: 'replace', fill: 'hold' });
}

function primeFillItemParams(values, spec, centerX, centerY) {
    if (!spec) {
        return;
    }
    const params = spec.params || {};
    const from = spec.from || {};
    const to = spec.to || {};
    values.item_isVisible = spec.isVisible !== false;
    values.item_cycling = spec.cycling !== false;
    values.item_speed = params.speed;
    values.item_delay = params.delay;
    values.item_gap = params.gap;
    values.item_centerX = centerX;
    values.item_centerY = centerY;
    values.item_fromRadius = from.radius;
    values.item_fromHeat = from.heat;
    values.item_toRadius = to.radius;
    values.item_toHeat = to.heat;
}

function primeWriteSpec(spec, key, value) {
    if (!spec) {
        return;
    }
    if (key === 'isVisible') {
        spec.isVisible = !!value;
        return;
    }
    if (key === 'cycling') {
        spec.cycling = !!value;
        return;
    }
    const poseKey = ROUND_POSE_KEYS[key];
    if (poseKey) {
        if (!spec[poseKey.group]) {
            spec[poseKey.group] = {};
        }
        spec[poseKey.group][poseKey.prop] = clampBackHighlightSpec(
            ROUND_POSE_SPECS,
            poseKey.prop,
            value
        );
        return;
    }
    if (!ROUND_FIELD_SPECS[key]) {
        return;
    }
    if (!spec.params) {
        spec.params = {};
    }
    spec.params[key] = clampBackHighlightSpec(ROUND_FIELD_SPECS, key, value);
}

function primeNudgeSpec(spec, key, dir) {
    if (!spec) {
        return 0;
    }
    if (key === 'isVisible') {
        spec.isVisible = spec.isVisible === false;
        return spec.isVisible;
    }
    if (key === 'cycling') {
        spec.cycling = spec.cycling === false;
        return spec.cycling !== false;
    }
    const poseKey = ROUND_POSE_KEYS[key];
    if (poseKey) {
        const group = spec[poseKey.group] || {};
        const step = ROUND_POSE_SPECS[poseKey.prop].step;
        primeWriteSpec(spec, key, (group[poseKey.prop] || 0) + dir * step);
        return spec[poseKey.group][poseKey.prop];
    }
    const field = ROUND_FIELD_SPECS[key];
    if (!field) {
        return 0;
    }
    const params = spec.params || {};
    primeWriteSpec(spec, key, (params[key] || 0) + dir * field.step);
    return spec.params[key];
}

function primeRoute(key) {
    if (key.indexOf('item_') === 0) {
        return { prefix: 'item_', key: key.slice('item_'.length) };
    }
    return coreRoute(key);
}

heatRegisterComposite('prime', {
    create(heatMap, overrides) {
        return new UiPrime(heatMap, overrides);
    }
});
