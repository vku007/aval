/**
 * HotMapUiNewPaper
 * Holder for UiNewSheet items. Its props are the values used when a sheet is added.
 * Each added sheet is its own instance and keeps that state.
 * Balls share one spin. SPEED on the holder turns that spin. PHASE on a sheet is only its offset.
 * Three percents step up for each sheet already there: HEAT % on disk heat, DISK % on disk radius, BALL % on ball radius.
 * DISTANCE is the Z step for the next sheet. Tilt turns that depth into view.
 * SPAWN X and SPAWN Y are an untilted field offset. Balls leave that point and move to their tilted phase on the disk.
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
        this.sheetInit = defaultHotMapNewPaperSheetInit();
        this.ballSpin = 0;
        this._spinEpoch = -1;
        if (typeof heatMap.addHighlighter === 'function') {
            heatMap.addHighlighter(this);
        }
    }

    afterAdd(object) {
        if (object && object.kind === 'new-sheet') {
            object.spinHost = this;
        }
    }

    afterRemove(object) {
        if (object && object.spinHost === this) {
            object.spinHost = null;
        }
    }

    advance(delta) {
        const field = this.heatMap && this.heatMap.field;
        const epoch = field ? (field.sheetEpoch || 0) : -1;
        if (epoch >= 0 && this._spinEpoch === epoch) {
            return;
        }
        this._spinEpoch = epoch;
        const dt = Math.min(Math.max(0, delta || 0) / 1000, 0.05);
        const speed = this.sheetInit.ballSpeed || 0;
        this.ballSpin = wrapNewSheetAngle(this.ballSpin + speed * dt);
    }

    sheetList() {
        return this.parts
            .map((part) => part.object)
            .filter((object) => object && object.kind === 'new-sheet');
    }

    addItem() {
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
        sheet.beginBallTravel(this.spawn);
        this.add(sheet);
        if (typeof this.onPartAdded === 'function') {
            this.onPartAdded(sheet);
        }
        return sheet;
    }

    removeItem() {
        const object = this.takeLast('new-sheet');
        if (!object) {
            return null;
        }
        if (this.heatMap && typeof this.heatMap.removeHighlighter === 'function') {
            this.heatMap.removeHighlighter(object);
        }
        if (typeof this.onPartRemoved === 'function') {
            this.onPartRemoved(object);
        }
        return object;
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
            ballHeat: init.ballHeat
        });
    }

    nudgeParam(key, dir) {
        const placed = this.nudgePlace(key, dir);
        if (placed !== undefined) {
            return placed;
        }
        if (key === 'isVisible') {
            this.sheetInit.isVisible = !this.sheetInit.isVisible;
            return this.sheetInit.isVisible;
        }
        if (key === 'distance') {
            return this.nudgeDistance(dir);
        }
        if (key === 'heatGain' || key === 'diskGain' || key === 'radiusGain') {
            return this.nudgeGain(key, dir);
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
            return this.sheetInit[key];
        }
        this.sheetInit[key] = clampNewSheetSpec(key, this.sheetInit[key] + dir * spec.step);
        return this.sheetInit[key];
    }

    nudgeDistance(dir) {
        const spec = HOT_MAP_NEW_PAPER_DISTANCE;
        const next = this.distance + dir * spec.step;
        this.distance = Math.max(spec.min, Math.min(spec.max, next));
        return this.distance;
    }

    nudgeGain(key, dir) {
        const spec = HOT_MAP_NEW_PAPER_GAIN;
        const next = this[key] + dir * spec.step;
        this[key] = Math.max(spec.min, Math.min(spec.max, next));
        return this[key];
    }

    extendSerialized(data) {
        data.distance = this.distance;
        data.heatGain = this.heatGain;
        data.diskGain = this.diskGain;
        data.radiusGain = this.radiusGain;
        data.ballSpin = this.ballSpin;
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
        if (typeof data.ballSpin === 'number') {
            this.ballSpin = wrapNewSheetAngle(data.ballSpin);
        }
    }
}

let HOT_MAP_NEW_PAPER_SHEET_SEQ = 0;

HotMapUiNewPaper.REMOVE_TABS = [
    {
        id: 'remove',
        rows: [
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

function clampHotMapNewPaperGain(value) {
    const spec = HOT_MAP_NEW_PAPER_GAIN;
    return Math.max(spec.min, Math.min(spec.max, value));
}

function hotMapNewPaperScaled(specName, base, index, gain) {
    const spec = UI_NEW_SHEET_SPECS[specName];
    const scale = 1 + (Number(gain) || 0) / 100 * index;
    const next = (Number(base) || 0) * scale;
    return Math.max(spec.min, Math.min(spec.max, next));
}

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
