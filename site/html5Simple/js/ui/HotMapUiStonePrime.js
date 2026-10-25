/**
 * HotMapUiStonePrime
 * A stone with one hot ball, plus a circle and a cycling round on that same center.
 * The circle and the round take Prime's defaults. A second ball is refused.
 * Removing the ball leaves the circle and the round.
 */
class HotMapUiStonePrime extends HotMapUiStone {
    static PROP_TABS = HotMapUiStone.PROP_TABS.concat([
        coreItemTab('circle_', 'CIRCLE', UiCircle.PROP_TABS, ['centerX', 'centerY']),
        coreItemTab('round_', 'ROUND', UiRound.PROP_TABS, ['centerX', 'centerY'])
    ]);

    constructor(heatMap, options) {
        const opts = options || {};
        super(heatMap, {
            name: opts.name || 'Stone Prime',
            center: opts.center,
            spawn: opts.spawn
        });
        this.kind = 'hot-map-stone-prime';
        this.scene = heatMap.scene;
        this.circle = null;
        this.round = null;
        this.ensureShell();
        if (!this.ballCount()) {
            this.addItem({ animate: opts.animate !== false });
        }
    }

    get params() {
        const values = Object.getOwnPropertyDescriptor(HotMapUiStone.prototype, 'params').get.call(this);
        copyPrefixedParams(values, 'circle_', this.circle);
        copyPrefixedParams(values, 'round_', this.round);
        return values;
    }

    nudgeParam(key, dir) {
        const routed = stonePrimeRoute(key);
        if (!routed) {
            return HotMapUiStone.prototype.nudgeParam.call(this, key, dir);
        }
        const item = routed.prefix === 'circle_' ? this.circle : this.round;
        if (!item) {
            return 0;
        }
        return item.nudgeParam(routed.key, dir);
    }

    setParam(key, value) {
        const routed = stonePrimeRoute(key);
        if (!routed) {
            if (typeof HotMapUiStone.prototype.setParam === 'function') {
                return HotMapUiStone.prototype.setParam.call(this, key, value);
            }
            return this.params[key];
        }
        const item = routed.prefix === 'circle_' ? this.circle : this.round;
        coreWriteItem(item, routed.key, value);
        return this.params[key];
    }

    setCenter(cell) {
        const center = HotMapUiComposite.prototype.setCenter.call(this, cell);
        this.placeShell();
        return center;
    }

    layoutItems() {
        HotMapUiStone.prototype.layoutItems.call(this);
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
        if (this.ballCount()) {
            return null;
        }
        const ball = HotMapUiStone.prototype.addItem.call(this, opts);
        scalePrimeBall(ball);
        this.placeShell();
        return ball;
    }

    ballCount() {
        let count = 0;
        this.parts.forEach((part) => {
            const object = part.object;
            if (object && object.kind === 'hot-ball' && !object._stoneShard) {
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
        HotMapUiStone.prototype.reset.call(this, opts);
        this.ensureShell();
        if (!this.ballCount()) {
            HotMapUiStone.prototype.addItem.call(this, { animate: false });
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

HotMapUiStonePrime.ADD_TABS = HotMapUiStone.ADD_TABS;
HotMapUiStonePrime.REMOVE_TABS = HotMapUiStone.REMOVE_TABS;

function stonePrimeRoute(key) {
    if (key.indexOf('circle_') === 0) {
        return { prefix: 'circle_', key: key.slice('circle_'.length) };
    }
    if (key.indexOf('round_') === 0) {
        return { prefix: 'round_', key: key.slice('round_'.length) };
    }
    return null;
}

heatRegisterComposite('stonePrime', {
    create(heatMap, overrides) {
        return new HotMapUiStonePrime(heatMap, overrides);
    }
});
