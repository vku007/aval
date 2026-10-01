/**
 * HotMapUiNewPaper
 * Holder for UiNewSheet items. Its props are the values used when a sheet is added.
 * Each added sheet is its own instance and keeps that state.
 * Balls share one spin. SPEED on the holder turns that spin. PHASE on a sheet is only its offset.
 * Three percents step up for each sheet already there: HEAT % on disk heat, DISK % on disk radius, BALL % on ball radius.
 * DISTANCE is the Z step for the next sheet. Tilt turns that depth into view.
 * SPAWN X and SPAWN Y are an untilted field offset. Balls leave that point and move to their tilted phase on the disk.
 * DRAMA removes the last sheet in three speeds. Heat rises to 300%, the disk then grows to 300% radius while heat falls and the balls hop by JUMP, then the balls move to the center plus DROP and fade out.
 * HEAT SPD, BURST SPD, and FALL SPD are percent of that step per second. 100 lasts one second.
 */
class HotMapUiNewPaper extends HotMapUiComposite {
    static PROP_TABS = [
        {
            id: 'place',
            label: 'PLACE',
            rows: [
                { key: 'centerX', label: 'CENTER X', decimals: 1 },
                { key: 'centerY', label: 'CENTER Y', decimals: 1 },
                { key: 'isVisible', label: 'VISIBLE', type: 'bool' }
            ]
        },
        {
            id: 'loop',
            label: 'LOOP',
            rows: [
                { key: 'loopSpeed', label: 'SPEED', decimals: 0 },
                { key: 'radFrom', label: 'RAD FROM', decimals: 0 },
                { key: 'radTo', label: 'RAD TO', decimals: 0 },
                { key: 'diskGain', label: 'DISK %', decimals: 0 },
                { key: 'heatFrom', label: 'HEAT FROM', decimals: 2 },
                { key: 'heatTo', label: 'HEAT TO', decimals: 2 },
                { key: 'heatGain', label: 'HEAT %', decimals: 0 }
            ]
        },
        {
            id: 'tilt',
            label: 'TILT',
            rows: [
                { key: 'tiltX', label: 'TILT X', decimals: 0 },
                { key: 'tiltY', label: 'TILT Y', decimals: 0 },
                { key: 'tiltZ', label: 'TILT Z', decimals: 0 },
                { key: 'distance', label: 'DISTANCE', decimals: 0 }
            ]
        },
        {
            id: 'ball',
            label: 'BALL',
            rows: [
                { key: 'ballCount', label: 'BALLS', decimals: 0 },
                { key: 'ballPhase', label: 'PHASE', decimals: 0 },
                { key: 'ballSpeed', label: 'SPEED', decimals: 0 },
                { key: 'ballRadius', label: 'RADIUS', decimals: 0 },
                { key: 'radiusGain', label: 'BALL %', decimals: 0 },
                { key: 'ballSize', label: 'DOT SIZE', decimals: 1 },
                { key: 'ballHeat', label: 'DOT HEAT', decimals: 2 }
            ]
        }
    ];

    constructor(heatMap, options) {
        const opts = options || {};
        const preset = HOT_MAP_NEW_PAPER_PRESET;
        super(heatMap, {
            kind: 'hot-map-new-paper',
            name: opts.name || preset.name,
            center: opts.center || preset.center,
            spawn: opts.spawn || preset.spawn
        });
        this.distance = preset.distance;
        this.heatGain = preset.heatGain;
        this.diskGain = preset.diskGain;
        this.radiusGain = preset.radiusGain;
        this.dramaHeatSpeed = preset.dramaHeatSpeed;
        this.dramaBurstSpeed = preset.dramaBurstSpeed;
        this.dramaFallSpeed = preset.dramaFallSpeed;
        this.dramaJump = preset.dramaJump;
        this.dramaDrop = preset.dramaDrop;
        this.sheetInit = defaultHotMapNewPaperSheetInit();
        this.exitInstant = true;
        if (typeof heatMap.addHighlighter === 'function') {
            heatMap.addHighlighter(this);
        }
    }

    pump() {
        this.finishDramas();
    }

    afterAdd(object) {
        const disks = this.sheetList();
        const lead = disks[0];
        if (lead && object && object !== lead) {
            copyDiskCycles(object, lead);
        }
    }

    afterRemove() {}

    sheetList() {
        return this.parts
            .map((part) => part.object)
            .filter((object) => object && object.kind === 'new-sheet');
    }

    addItem(opts) {
        const animate = !opts || opts.animate !== false;
        const init = this.sheetInit;
        const index = this.parts.length;
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
        return sheet;
    }

    layoutItems() {
        layoutDiskItems(this);
    }

    resyncCycles() {
        alignDiskStack(this);
    }

    writeField(item, key, value) {
        if (key === 'isVisible' && item) {
            item.isVisible = !!value;
            return item.isVisible;
        }
        return HeatComposite.prototype.writeField.call(this, item, key, value);
    }

    keepTemplate(key, value) {
        if (key === 'distance' && typeof value === 'number') {
            this.distance = value;
            return;
        }
        if (key === 'heatGain' || key === 'diskGain' || key === 'radiusGain') {
            this[key] = value;
            return;
        }
        if (this.sheetInit && (typeof this.sheetInit[key] === 'number' || typeof this.sheetInit[key] === 'boolean')) {
            this.sheetInit[key] = value;
        }
    }

    onFieldSet(key) {
        if (key === 'distance' || key === 'heatGain' || key === 'diskGain' || key === 'radiusGain') {
            this.layoutItems();
        }
    }

    removeItem(object) {
        const target = this.takeSheet(object);
        if (!target) {
            return null;
        }
        target.drama = null;
        if (this.heatMap && typeof this.heatMap.removeHighlighter === 'function') {
            this.heatMap.removeHighlighter(target);
        }
        if (typeof this.onPartRemoved === 'function') {
            this.onPartRemoved(target);
        }
        return target;
    }

    takeSheet(object) {
        if (!object) {
            return this.takeLast('new-sheet');
        }
        const index = this.parts.findIndex((part) => part.object === object);
        if (index < 0) {
            return null;
        }
        this.parts.splice(index, 1);
        return object;
    }

    removeItemWithDrama() {
        const sheet = this.lastPart('new-sheet');
        if (!sheet || sheet.drama) {
            return null;
        }
        sheet.beginRemoveDrama({
            heatScale: HOT_MAP_NEW_PAPER_DRAMA_SCALE,
            radiusScale: HOT_MAP_NEW_PAPER_DRAMA_SCALE,
            jump: this.dramaJump,
            drop: this.dramaDrop,
            speeds: [this.dramaHeatSpeed, this.dramaBurstSpeed, this.dramaFallSpeed],
            onDone: () => this.removeItem(sheet)
        });
        return sheet;
    }

    finishDramas() {
        this.sheetList().forEach((sheet) => {
            if (!sheet.drama || !sheet.drama.done) {
                return;
            }
            const done = sheet.drama.onDone;
            sheet.drama = null;
            if (typeof done === 'function') {
                done();
            }
        });
    }

    get params() {
        const init = this.sheetInit;
        return Object.assign(this.placeParams(), {
            isVisible: init.isVisible !== false,
            distance: this.distance,
            loopSpeed: init.loopSpeed,
            radFrom: init.radFrom,
            radTo: init.radTo,
            diskGain: this.diskGain,
            heatFrom: init.heatFrom,
            heatTo: init.heatTo,
            heatGain: this.heatGain,
            tiltX: init.tiltX,
            tiltY: init.tiltY,
            tiltZ: init.tiltZ,
            ballCount: init.ballCount,
            ballPhase: init.ballPhase,
            ballSpeed: init.ballSpeed,
            ballRadius: init.ballRadius,
            radiusGain: this.radiusGain,
            ballSize: init.ballSize,
            ballHeat: init.ballHeat,
            dramaHeatSpeed: this.dramaHeatSpeed,
            dramaBurstSpeed: this.dramaBurstSpeed,
            dramaFallSpeed: this.dramaFallSpeed,
            dramaJump: this.dramaJump,
            dramaDrop: this.dramaDrop
        });
    }

    nudgeParam(key, dir) {
        const placed = this.nudgePlace(key, dir);
        if (placed !== undefined) {
            return placed;
        }
        if (key === 'isVisible') {
            return this.set('isVisible', !this.sheetInit.isVisible);
        }
        if (key === 'distance') {
            return this.nudgeDistance(dir);
        }
        if (key === 'heatGain' || key === 'diskGain' || key === 'radiusGain') {
            return this.nudgeGain(key, dir);
        }
        if (HOT_MAP_NEW_PAPER_DRAMA_KEYS[key]) {
            return this.nudgeDrama(key, dir);
        }
        if (HOT_MAP_NEW_PAPER_KEYS.indexOf(key) >= 0) {
            return this.nudgeInit(key, dir);
        }
        return this.params[key];
    }

    nudgeInit(key, dir) {
        const spec = UI_NEW_SHEET_SPECS[key];
        if (!spec) {
            return this.sheetInit[key];
        }
        if (key === 'ballPhase') {
            this.sheetInit[key] = wrapNewSheetAngle(this.sheetInit[key] + dir * spec.step);
            this.items.forEach((item) => this.writeField(item, key, this.sheetInit[key]));
            return this.sheetInit[key];
        }
        this.sheetInit[key] = clampNewSheetSpec(key, this.sheetInit[key] + dir * spec.step);
        this.items.forEach((item) => this.writeField(item, key, this.sheetInit[key]));
        return this.sheetInit[key];
    }

    nudgeDistance(dir) {
        const spec = HOT_MAP_NEW_PAPER_DISTANCE;
        const next = this.distance + dir * spec.step;
        this.distance = Math.max(spec.min, Math.min(spec.max, next));
        this.layoutItems();
        return this.distance;
    }

    nudgeGain(key, dir) {
        const spec = HOT_MAP_NEW_PAPER_GAIN;
        const next = this[key] + dir * spec.step;
        this[key] = Math.max(spec.min, Math.min(spec.max, next));
        this.layoutItems();
        return this[key];
    }

    nudgeDrama(key, dir) {
        const spec = HOT_MAP_NEW_PAPER_DRAMA_KEYS[key];
        const next = this[key] + dir * spec.step;
        this[key] = Math.max(spec.min, Math.min(spec.max, next));
        return this[key];
    }

    extendSerialized(data) {
        data.distance = this.distance;
        data.heatGain = this.heatGain;
        data.diskGain = this.diskGain;
        data.radiusGain = this.radiusGain;
        data.dramaHeatSpeed = this.dramaHeatSpeed;
        data.dramaBurstSpeed = this.dramaBurstSpeed;
        data.dramaFallSpeed = this.dramaFallSpeed;
        data.dramaJump = this.dramaJump;
        data.dramaDrop = this.dramaDrop;
        const lead = this.sheetList()[0];
        data.ballSpin = lead ? lead.ballSpin : 0;
        data.sheetInit = copyHotMapNewPaperSheetInit(this.sheetInit);
        return data;
    }

    applySerializedExtras(data) {
        if (typeof data.distance === 'number') {
            const spec = HOT_MAP_NEW_PAPER_DISTANCE;
            this.distance = Math.max(spec.min, Math.min(spec.max, data.distance));
        }
        if (data.sheetInit) {
            this.sheetInit = copyHotMapNewPaperSheetInit(data.sheetInit);
        }
        if (typeof data.heatGain === 'number') {
            this.heatGain = clampHotMapNewPaperGain(data.heatGain);
        }
        if (typeof data.diskGain === 'number') {
            this.diskGain = clampHotMapNewPaperGain(data.diskGain);
        }
        if (typeof data.radiusGain === 'number') {
            this.radiusGain = clampHotMapNewPaperGain(data.radiusGain);
        }
        Object.keys(HOT_MAP_NEW_PAPER_DRAMA_KEYS).forEach((key) => {
            if (typeof data[key] === 'number') {
                this[key] = clampHotMapNewPaperDrama(key, data[key]);
            }
        });
        if (typeof data.ballSpin === 'number') {
            const spin = wrapNewSheetAngle(data.ballSpin);
            this.sheetList().forEach((sheet) => {
                sheet.ballSpin = spin;
            });
        }
    }
}

let HOT_MAP_NEW_PAPER_SHEET_SEQ = 0;

HotMapUiNewPaper.REMOVE_TABS = [
    {
        id: 'remove',
        rows: [
            { key: 'dramaHeatSpeed', label: 'HEAT SPD', decimals: 0 },
            { key: 'dramaBurstSpeed', label: 'BURST SPD', decimals: 0 },
            { key: 'dramaFallSpeed', label: 'FALL SPD', decimals: 0 },
            { key: 'dramaJump', label: 'JUMP', decimals: 0 },
            { key: 'dramaDrop', label: 'DROP', decimals: 0 },
            { key: 'removeItemWithDrama', label: 'DRAMA', button: 'POP', type: 'action' },
            { key: 'removeItem', label: 'SHEET', button: 'RMV', type: 'action' }
        ]
    }
];

HotMapUiNewPaper.ADD_TABS = [
    {
        id: 'offset',
        label: 'DIST',
            rows: [
            { key: 'spawnX', label: 'SPAWN X', decimals: 1 },
            { key: 'spawnY', label: 'SPAWN Y', decimals: 1 },
            { key: 'distance', label: 'DISTANCE', decimals: 0 },
            { key: 'addItem', label: 'SHEET', button: 'ADD', type: 'action' }
        ]
    },
    {
        id: 'tilt',
        label: 'TILT',
        rows: [
            { key: 'tiltX', label: 'TILT X', decimals: 0 },
            { key: 'tiltY', label: 'TILT Y', decimals: 0 },
            { key: 'tiltZ', label: 'TILT Z', decimals: 0 }
        ]
    },
    {
        id: 'loop',
        label: 'LOOP',
        rows: [
            { key: 'loopSpeed', label: 'SPEED', decimals: 0 },
            { key: 'radFrom', label: 'RAD FROM', decimals: 0 },
            { key: 'radTo', label: 'RAD TO', decimals: 0 },
            { key: 'diskGain', label: 'DISK %', decimals: 0 },
            { key: 'heatFrom', label: 'HEAT FROM', decimals: 2 },
            { key: 'heatTo', label: 'HEAT TO', decimals: 2 },
            { key: 'heatGain', label: 'HEAT %', decimals: 0 }
        ]
    },
    {
        id: 'ball',
        label: 'BALL',
        rows: [
            { key: 'ballCount', label: 'BALLS', decimals: 0 },
            { key: 'ballPhase', label: 'PHASE', decimals: 0 },
            { key: 'ballSpeed', label: 'SPEED', decimals: 0 },
            { key: 'ballRadius', label: 'RADIUS', decimals: 0 },
            { key: 'radiusGain', label: 'BALL %', decimals: 0 },
            { key: 'ballSize', label: 'DOT SIZE', decimals: 1 },
            { key: 'ballHeat', label: 'DOT HEAT', decimals: 2 }
        ]
    }
];

const HOT_MAP_NEW_PAPER_KEYS = [
    'loopSpeed', 'radFrom', 'radTo', 'heatFrom', 'heatTo',
    'tiltX', 'tiltY', 'tiltZ',
    'ballCount', 'ballPhase', 'ballSpeed', 'ballRadius', 'ballSize', 'ballHeat'
];

const HOT_MAP_NEW_PAPER_DISTANCE = { min: -120, max: 120, step: 2 };

const HOT_MAP_NEW_PAPER_PRESET = {
    name: 'New Paper',
    center: { col: 64.5, row: 72 },
    spawn: { col: 0, row: 128 },
    distance: 6,
    heatGain: 25,
    diskGain: 5,
    radiusGain: 5,
    dramaHeatSpeed: 400,
    dramaBurstSpeed: 900,
    dramaFallSpeed: 160,
    dramaJump: 18,
    dramaDrop: 28,
    sheet: {
        isVisible: true,
        loopSpeed: 50,
        radFrom: 20,
        radTo: 30,
        heatFrom: 0.08,
        heatTo: 0.02,
        tiltX: 75,
        tiltY: 0,
        tiltZ: 0,
        ballCount: 2,
        ballPhase: 0,
        ballSpeed: 100,
        ballRadius: 32,
        ballSize: 2.6,
        ballHeat: 0.5
    }
};

const HOT_MAP_NEW_PAPER_GAIN = { min: 0, max: 100, step: 1 };

const HOT_MAP_NEW_PAPER_DRAMA_SCALE = 3;

const HOT_MAP_NEW_PAPER_DRAMA_SPEED = { min: 10, max: 2000, step: 10 };

const HOT_MAP_NEW_PAPER_DRAMA_SHIFT = { min: 0, max: 160, step: 1 };

const HOT_MAP_NEW_PAPER_DRAMA_KEYS = {
    dramaHeatSpeed: HOT_MAP_NEW_PAPER_DRAMA_SPEED,
    dramaBurstSpeed: HOT_MAP_NEW_PAPER_DRAMA_SPEED,
    dramaFallSpeed: HOT_MAP_NEW_PAPER_DRAMA_SPEED,
    dramaJump: HOT_MAP_NEW_PAPER_DRAMA_SHIFT,
    dramaDrop: HOT_MAP_NEW_PAPER_DRAMA_SHIFT
};

function clampHotMapNewPaperGain(value) {
    const spec = HOT_MAP_NEW_PAPER_GAIN;
    return Math.max(spec.min, Math.min(spec.max, value));
}

function clampHotMapNewPaperDrama(key, value) {
    const spec = HOT_MAP_NEW_PAPER_DRAMA_KEYS[key];
    return Math.max(spec.min, Math.min(spec.max, value));
}

function hotMapNewPaperScaled(specName, base, index, gain) {
    const spec = UI_NEW_SHEET_SPECS[specName];
    const scale = 1 + (Number(gain) || 0) / 100 * index;
    const next = (Number(base) || 0) * scale;
    return Math.max(spec.min, Math.min(spec.max, next));
}

heatRegisterComposite('diskStack', {
    create(heatMap, overrides) {
        return new HotMapUiNewPaper(heatMap, overrides);
    }
});

function defaultHotMapNewPaperSheetInit() {
    return copyHotMapNewPaperSheetInit(HOT_MAP_NEW_PAPER_PRESET.sheet);
}

function copyHotMapNewPaperSheetInit(raw) {
    const base = {
        isVisible: true,
        loopSpeed: 50,
        radFrom: 20,
        radTo: 30,
        heatFrom: 0.08,
        heatTo: 0.02,
        tiltX: 75,
        tiltY: 0,
        tiltZ: 0,
        ballCount: 2,
        ballPhase: 0,
        ballSpeed: 100,
        ballRadius: 32,
        ballSize: 2.6,
        ballHeat: 0.5
    };
    const data = raw || {};
    if (typeof data.isVisible === 'boolean') {
        base.isVisible = data.isVisible;
    }
    HOT_MAP_NEW_PAPER_KEYS.forEach((key) => {
        if (typeof data[key] === 'number') {
            base[key] = data[key];
        }
    });
    return base;
}
