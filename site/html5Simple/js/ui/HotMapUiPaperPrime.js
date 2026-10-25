/**
 * HotMapUiPaperPrime
 * A New Paper with one disk, plus a circle and a cycling round on that same center.
 * The circle and the round take Prime's defaults. A second disk is refused.
 * Removing the disk leaves the circle and the round.
 * The disk is always index 0, so the circle and the round do not step its gains.
 */
class HotMapUiPaperPrime extends HotMapUiNewPaper {
    static PROP_TABS = HotMapUiNewPaper.PROP_TABS.concat([
        coreItemTab('circle_', 'CIRCLE', UiCircle.PROP_TABS, ['centerX', 'centerY']),
        coreItemTab('round_', 'ROUND', UiRound.PROP_TABS, ['centerX', 'centerY'])
    ]);

    constructor(heatMap, options) {
        const opts = options || {};
        super(heatMap, {
            name: opts.name || 'Paper Prime',
            center: opts.center,
            spawn: opts.spawn
        });
        this.kind = 'hot-map-paper-prime';
        this.scene = heatMap.scene;
        this.circle = null;
        this.round = null;
        this.ensureShell();
        if (!this.sheetCount()) {
            this.addItem({ animate: opts.animate !== false });
        }
    }

    get params() {
        const values = Object.getOwnPropertyDescriptor(HotMapUiNewPaper.prototype, 'params').get.call(this);
        copyPrefixedParams(values, 'circle_', this.circle);
        copyPrefixedParams(values, 'round_', this.round);
        return values;
    }

    nudgeParam(key, dir) {
        const routed = paperPrimeRoute(key);
        if (!routed) {
            return HotMapUiNewPaper.prototype.nudgeParam.call(this, key, dir);
        }
        const item = routed.prefix === 'circle_' ? this.circle : this.round;
        if (!item) {
            return 0;
        }
        return item.nudgeParam(routed.key, dir);
    }

    setParam(key, value) {
        const routed = paperPrimeRoute(key);
        if (!routed) {
            if (typeof HotMapUiNewPaper.prototype.setParam === 'function') {
                return HotMapUiNewPaper.prototype.setParam.call(this, key, value);
            }
            return this.params[key];
        }
        const item = routed.prefix === 'circle_' ? this.circle : this.round;
        coreWriteItem(item, routed.key, value);
        return this.params[key];
    }

    writeField(item, key, value) {
        if (item && (item.kind === 'circle' || item.kind === 'round') && key !== 'isVisible') {
            return value;
        }
        return HotMapUiNewPaper.prototype.writeField.call(this, item, key, value);
    }

    afterAdd(object) {
        if (!object || object.kind !== 'new-sheet') {
            return;
        }
        HotMapUiNewPaper.prototype.afterAdd.call(this, object);
    }

    setCenter(cell) {
        const center = HotMapUiComposite.prototype.setCenter.call(this, cell);
        this.placeShell();
        return center;
    }

    layoutItems() {
        HotMapUiNewPaper.prototype.layoutItems.call(this);
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
        if (this.sheetCount()) {
            return null;
        }
        const sheet = this.spawnSheet(opts);
        this.placeShell();
        return sheet;
    }

    spawnSheet(opts) {
        const animate = !opts || opts.animate !== false;
        const init = this.sheetInit;
        const index = this.sheetList().length;
        HOT_MAP_NEW_PAPER_SHEET_SEQ += 1;
        const sheet = new UiNewSheet(this.heatMap, {
            ownField: false,
            name: 'New Sheet ' + HOT_MAP_NEW_PAPER_SHEET_SEQ,
            isVisible: init.isVisible !== false,
            center: { col: this.center.col, row: this.center.row },
            depth: index * this.distance,
            loopSpeed: init.loopSpeed,
            radFrom: hotMapNewPaperScaled('radFrom', init.radFrom, index, this.diskGain),
            radTo: hotMapNewPaperScaled('radTo', init.radTo, index, this.diskGain),
            heatFrom: hotMapNewPaperScaled('heatFrom', init.heatFrom, index, this.heatGain),
            heatTo: hotMapNewPaperScaled('heatTo', init.heatTo, index, this.heatGain),
            tiltX: init.tiltX,
            tiltY: init.tiltY,
            tiltZ: init.tiltZ,
            ballCount: init.ballCount,
            ballPhase: init.ballPhase,
            ballSpeed: init.ballSpeed,
            ballRadius: hotMapNewPaperScaled('ballRadius', init.ballRadius, index, this.radiusGain),
            ballSize: init.ballSize,
            ballHeat: init.ballHeat
        });
        if (animate) {
            sheet.beginBallTravel(this.spawn);
        }
        this.add(sheet);
        if (!animate) {
            this.layoutItems();
        }
        if (typeof this.onPartAdded === 'function') {
            this.onPartAdded(sheet);
        }
        this.emit('added', sheet);
        scalePrimeDisk(sheet);
        return sheet;
    }

    sheetCount() {
        return this.sheetList().length;
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
        HotMapUiNewPaper.prototype.reset.call(this, opts);
        this.ensureShell();
        if (!this.sheetCount()) {
            this.spawnSheet({ animate: false });
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

HotMapUiPaperPrime.ADD_TABS = HotMapUiNewPaper.ADD_TABS;
HotMapUiPaperPrime.REMOVE_TABS = HotMapUiNewPaper.REMOVE_TABS;

function paperPrimeRoute(key) {
    if (key.indexOf('circle_') === 0) {
        return { prefix: 'circle_', key: key.slice('circle_'.length) };
    }
    if (key.indexOf('round_') === 0) {
        return { prefix: 'round_', key: key.slice('round_'.length) };
    }
    return null;
}

heatRegisterComposite('paperPrime', {
    create(heatMap, overrides) {
        return new HotMapUiPaperPrime(heatMap, overrides);
    }
});
