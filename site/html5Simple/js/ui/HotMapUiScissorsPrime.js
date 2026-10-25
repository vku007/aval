/**
 * HotMapUiScissorsPrime
 * A scissor with one shard, plus a circle and a cycling round on that same center.
 * The circle and the round take Prime's defaults. A second shard is refused.
 * Removing the shard leaves the circle and the round.
 */
class HotMapUiScissorsPrime extends HotMapUiScissor {
    static PROP_TABS = HotMapUiScissor.PROP_TABS.concat([
        coreItemTab('circle_', 'CIRCLE', UiCircle.PROP_TABS, ['centerX', 'centerY']),
        coreItemTab('round_', 'ROUND', UiRound.PROP_TABS, ['centerX', 'centerY'])
    ]);

    constructor(heatMap, options) {
        const opts = options || {};
        super(heatMap, {
            name: opts.name || 'Scissors Prime',
            center: opts.center,
            spawn: opts.spawn
        });
        this.kind = 'hot-map-scissors-prime';
        this.scene = heatMap.scene;
        this.circle = null;
        this.round = null;
        this.ensureShell();
        if (!this.shardCount()) {
            this.addItem({ animate: opts.animate !== false });
        }
    }

    get params() {
        const values = Object.getOwnPropertyDescriptor(HotMapUiScissor.prototype, 'params').get.call(this);
        copyPrefixedParams(values, 'circle_', this.circle);
        copyPrefixedParams(values, 'round_', this.round);
        return values;
    }

    nudgeParam(key, dir) {
        const routed = scissorsPrimeRoute(key);
        if (!routed) {
            return HotMapUiScissor.prototype.nudgeParam.call(this, key, dir);
        }
        const item = routed.prefix === 'circle_' ? this.circle : this.round;
        if (!item) {
            return 0;
        }
        return item.nudgeParam(routed.key, dir);
    }

    setParam(key, value) {
        const routed = scissorsPrimeRoute(key);
        if (!routed) {
            if (typeof HotMapUiScissor.prototype.setParam === 'function') {
                return HotMapUiScissor.prototype.setParam.call(this, key, value);
            }
            return this.params[key];
        }
        const item = routed.prefix === 'circle_' ? this.circle : this.round;
        coreWriteItem(item, routed.key, value);
        return this.params[key];
    }

    writeField(item, key, value) {
        if (item && (item.kind === 'circle' || item.kind === 'round')) {
            return value;
        }
        return HotMapUiScissor.prototype.writeField.call(this, item, key, value);
    }

    setCenter(cell) {
        const center = HotMapUiComposite.prototype.setCenter.call(this, cell);
        this.placeShell();
        return center;
    }

    layoutItems() {
        HotMapUiScissor.prototype.layoutItems.call(this);
        this.placeShell();
    }

    captureLocal(object) {
        if (object && (object.kind === 'circle' || object.kind === 'round')) {
            return {
                center: { col: 0, row: 0 },
                target: { col: 0, row: 0 }
            };
        }
        return HotMapUiComposite.prototype.captureLocal.call(this, object);
    }

    applyLocal(part) {
        const object = part && part.object;
        if (object && (object.kind === 'circle' || object.kind === 'round')) {
            corePlaceEmitter(object.emitter, this.center);
            return;
        }
        HotMapUiComposite.prototype.applyLocal.call(this, part);
    }

    afterRemove(object) {
        if (this.circle === object) {
            this.circle = null;
        }
        if (this.round === object) {
            this.round = null;
        }
    }

    addItem(opts) {
        if (this.shardCount()) {
            return null;
        }
        const shard = HotMapUiScissor.prototype.addItem.call(this, opts);
        scalePrimeShard(shard);
        this.placeShell();
        return shard;
    }

    shardCount() {
        let count = 0;
        this.parts.forEach((part) => {
            const object = part.object;
            if (object && object.kind === 'shard') {
                count += 1;
            }
        });
        return count;
    }

    ensureShell() {
        if (this.circle && this.round) {
            this.placeShell();
            return;
        }
        const name = this.name;
        if (!this.circle) {
            this.circle = new UiCircle(this.heatMap, {
                name: `${name} Circle`,
                isVisible: true
            });
            this.add(this.circle);
        }
        if (!this.round) {
            this.round = new UiRound(this.heatMap, {
                name: `${name} Round`,
                isVisible: true
            });
            this.add(this.round);
        }
        this.paintShell();
        this.placeShell();
    }

    paintShell() {
        const defaults = primeDefaults(this.scene);
        if (this.circle) {
            const circle = applyCoreCircleSize(coreCopyPreset((defaults && defaults.circle) || CORE_PRESET.circle));
            circle.name = this.circle.name;
            this.circle.applySerialized(circle);
        }
        if (this.round) {
            const round = coreCopyPreset((defaults && defaults.round) || CORE_PRESET.round);
            if (!defaults) {
                round.cycling = true;
            }
            applyCoreRoundRadius(round, this.circle && this.circle.emitter);
            round.name = this.round.name;
            this.round.applySerialized(round);
        }
    }

    placeShell() {
        [this.circle, this.round].forEach((item) => {
            if (!item) {
                return;
            }
            corePlaceEmitter(item.emitter, this.center);
            const part = this.parts.find((entry) => entry.object === item);
            if (part) {
                part.local = this.captureLocal(item);
            }
        });
    }

    releaseContents() {
        const parts = this.parts.map((part) => part.object);
        parts.forEach((object) => this.dropItem(object));
    }

    reset(opts) {
        HotMapUiScissor.prototype.reset.call(this, opts);
        this.ensureShell();
        if (!this.shardCount()) {
            HotMapUiScissor.prototype.addItem.call(this, { animate: false });
        }
        this.placeShell();
        return this;
    }

    applySerialized(data) {
        HotMapUiComposite.prototype.applySerialized.call(this, data);
        this.specCount = 1;
        this.placeShell();
    }
}

HotMapUiScissorsPrime.ADD_TABS = HotMapUiScissor.ADD_TABS;
HotMapUiScissorsPrime.REMOVE_TABS = HotMapUiScissor.REMOVE_TABS;

function scissorsPrimeRoute(key) {
    if (key.indexOf('circle_') === 0) {
        return { prefix: 'circle_', key: key.slice('circle_'.length) };
    }
    if (key.indexOf('round_') === 0) {
        return { prefix: 'round_', key: key.slice('round_'.length) };
    }
    return null;
}

heatRegisterComposite('scissorsPrime', {
    create(heatMap, overrides) {
        return new HotMapUiScissorsPrime(heatMap, overrides);
    }
});
