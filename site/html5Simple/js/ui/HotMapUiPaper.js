/**
 * HotMapUiPaper
 * Heat-map group with a center. Sheets keep offsets from that center.
 * Setting the center moves every sheet by the same amount.
 * ITEM holds the props used when a new UiSheet is created.
 * Each new sheet keeps that phase and slides in 10 points under the previous
 * one. The slide is two parts: a close pair of double-size balls covers 70%
 * of the way to the previous sheet's bottom, then the balls shrink to the
 * setting size and move into their oscillation spots. The shape and glisten
 * appear 2 seconds after both balls are there. Every sheet shares one ball cycle,
 * shifted a little from the sheet above, and one shape ease and glisten sweep.
 */
class HotMapUiPaper extends HotMapUiComposite {
    static PROP_TABS = [
        {
            id: 'place',
            label: 'PLACE',
            rows: [
                { key: 'centerX', label: 'CENTER X', decimals: 1 },
                { key: 'centerY', label: 'CENTER Y', decimals: 1 },
                { key: 'radius', label: 'DOT SIZE', decimals: 1 },
                { key: 'energy', label: 'DOT HEAT', decimals: 1 },
                { key: 'ballSpeed', label: 'SPEED', decimals: 2 },
                { key: 'ballDelta', label: 'DELTA', decimals: 0 },
                { key: 'spawnX', label: 'SPAWN X', decimals: 1 },
                { key: 'spawnY', label: 'SPAWN Y', decimals: 1 },
                { key: 'addItem', label: 'SHEET', button: 'ADD', type: 'action' },
                { key: 'removeItem', label: 'SHEET', button: 'RMV', type: 'action' }
            ]
        },
        {
            id: 'field',
            label: 'FIELD',
            rows: [
                { key: 'cycling', label: 'CYCLING', type: 'bool' },
                { key: 'speed', label: 'SPEED', decimals: 1 },
                { key: 'delay', label: 'DELAY', decimals: 1 },
                { key: 'gap', label: 'GAP', decimals: 1 },
                { key: 'glistenOn', label: 'GLISTEN', type: 'bool' },
                { key: 'glistenSpeed', label: 'GL SPEED', decimals: 1 },
                { key: 'glistenDelay', label: 'GL DELAY', decimals: 1 },
                { key: 'glistenPower', label: 'GL POWER', decimals: 1 }
            ]
        },
        {
            id: 'from',
            label: 'FROM',
            rows: [
                { key: 'fromWidth', label: 'WIDTH', decimals: 0 },
                { key: 'fromHeight', label: 'HEIGHT', decimals: 0 },
                { key: 'fromSkew', label: 'SKEW', decimals: 0 },
                { key: 'fromBend', label: 'BEND', decimals: 0 },
                { key: 'fromCosine', label: 'PHASE', decimals: 0 },
                { key: 'fromHeat', label: 'HEAT', decimals: 1 }
            ]
        },
        {
            id: 'to',
            label: 'TO',
            rows: [
                { key: 'toWidth', label: 'WIDTH', decimals: 0 },
                { key: 'toHeight', label: 'HEIGHT', decimals: 0 },
                { key: 'toSkew', label: 'SKEW', decimals: 0 },
                { key: 'toBend', label: 'BEND', decimals: 0 },
                { key: 'toCosine', label: 'PHASE', decimals: 0 },
                { key: 'toHeat', label: 'HEAT', decimals: 1 }
            ]
        }
    ];

    constructor(heatMap, options) {
        const opts = options || {};
        const preset = HOT_MAP_PAPER_PRESET;
        super(heatMap, {
            kind: 'hot-map-paper',
            name: opts.name || preset.name,
            center: opts.center || preset.center,
            spawn: opts.spawn || preset.spawn
        });
        this.sheetInit = defaultHotMapPaperSheetInit();
        this.addMotion = {
            pairSpan: HOT_MAP_PAPER_TRAVEL_SPAN,
            pairGap: HOT_MAP_PAPER_TRAVEL_BALL_GAP,
            pairSize: HOT_MAP_PAPER_TRAVEL_RADIUS,
            splitDelay: HOT_MAP_PAPER_REVEAL_DELAY,
            stackGap: HOT_MAP_PAPER_STACK_GAP
        };
        this.layoutAnchor = { col: this.center.col, row: this.center.row };
    }

    afterAdd(object) {
        const sheets = this.sheetList();
        const lead = sheets[0];
        const index = sheets.indexOf(object);
        if (index > 0) {
            copyPaperCycles(object, lead, index * HOT_MAP_PAPER_BALL_SHIFT);
        }
        if (object && object.kind === 'sheet') {
            object.define('exit', paperExit());
        }
    }

    afterRemove() {}

    get params() {
        const init = this.sheetInit;
        const from = init.from;
        const to = init.to;
        return Object.assign(this.placeParams(), {
            cycling: init.cycling !== false,
            speed: init.speed,
            delay: init.delay,
            gap: init.gap,
            glistenOn: init.glistenOn !== false,
            glistenSpeed: init.glistenSpeed,
            glistenDelay: init.glistenDelay,
            glistenPower: init.glistenPower,
            radius: init.radius,
            energy: init.energy,
            ballSpeed: init.ballSpeed,
            ballDelta: init.ballDelta,
            fromWidth: from.width,
            fromHeight: from.height,
            fromSkew: from.skew,
            fromBend: from.bend,
            fromCosine: from.cosine,
            fromHeat: from.heat,
            toWidth: to.width,
            toHeight: to.height,
            toSkew: to.skew,
            toBend: to.bend,
            toCosine: to.cosine,
            toHeat: to.heat,
            pairSpan: this.addMotion.pairSpan,
            pairGap: this.addMotion.pairGap,
            pairSize: this.addMotion.pairSize,
            splitDelay: this.addMotion.splitDelay,
            stackGap: this.addMotion.stackGap
        });
    }

    nudgeParam(key, dir) {
        const placed = this.nudgePlace(key, dir);
        if (placed !== undefined) {
            return placed;
        }
        if (key === 'cycling') {
            return this.set('cycling', !this.sheetInit.cycling);
        }
        if (key === 'glistenOn') {
            return this.set('glistenOn', !this.sheetInit.glistenOn);
        }
        if (HOT_MAP_PAPER_ADD_SPECS[key]) {
            return this.nudgeAddMotion(key, dir);
        }
        if (HOT_MAP_PAPER_FIELD_KEYS[key] || HOT_MAP_PAPER_BALL_KEYS[key]) {
            return this.nudgeSheetField(key, dir);
        }
        if (HOT_MAP_PAPER_POSE_KEYS[key]) {
            return this.nudgeSheetPose(HOT_MAP_PAPER_POSE_KEYS[key], dir);
        }
        return this.params[key];
    }

    nudgeAddMotion(key, dir) {
        const spec = HOT_MAP_PAPER_ADD_SPECS[key];
        const next = this.addMotion[key] + dir * spec.step;
        const clamped = Math.max(spec.min, Math.min(spec.max, next));
        const decimals = spec.step < 0.1 ? 2 : spec.step < 1 ? 1 : 0;
        this.addMotion[key] = Number(clamped.toFixed(decimals));
        if (key === 'stackGap') {
            this.layoutItems();
        }
        return this.addMotion[key];
    }

    nudgeSheetField(name, dir) {
        const specs = SHEET_BALL_SPECS[name] ? SHEET_BALL_SPECS : SHEET_FIELD_SPECS;
        const spec = specs[name];
        if (!spec) {
            return this.sheetInit[name];
        }
        this.sheetInit[name] = clampBackHighlightSpec(
            specs,
            name,
            this.sheetInit[name] + dir * spec.step
        );
        this.items.forEach((item) => this.writeField(item, name, this.sheetInit[name]));
        return this.sheetInit[name];
    }

    nudgeSheetPose(pair, dir) {
        const group = pair[0];
        const prop = pair[1];
        const spec = SHEET_POSE_SPECS[prop];
        const pose = this.sheetInit[group];
        if (!spec || !pose) {
            return pose ? pose[prop] : 0;
        }
        pose[prop] = clampBackHighlightSpec(
            SHEET_POSE_SPECS,
            prop,
            (pose[prop] || 0) + dir * spec.step
        );
        pose.angle = 0;
        const label = prop.charAt(0).toUpperCase() + prop.slice(1);
        const param = group + label;
        this.items.forEach((item) => this.writeField(item, param, pose[prop]));
        return pose[prop];
    }

    addItem(opts) {
        const animate = !opts || opts.animate !== false;
        const init = this.sheetInit;
        const last = this.lastPart('sheet');
        const motion = this.addMotion;
        const place = last && last.emitter
            ? {
                col: last.emitter.target.col,
                row: last.emitter.target.row + motion.stackGap
            }
            : { col: this.center.col, row: this.center.row };
        const spawn = {
            col: this.center.col + this.spawn.col,
            row: this.center.row + this.spawn.row
        };
        const aim = last && last.emitter ? hotMapPaperSheetBottom(last.emitter) : place;
        const waypoint = hotMapPaperTravelPoint(spawn, aim, motion.pairSpan);
        const sheet = new UiSheet(this.heatMap, {
            cycling: init.cycling !== false,
            glistenOn: init.glistenOn !== false,
            glistenHold: true,
            travelBallGap: motion.pairGap,
            params: {
                speed: init.speed,
                delay: init.delay,
                gap: init.gap,
                glistenSpeed: init.glistenSpeed,
                glistenDelay: init.glistenDelay,
                glistenPower: init.glistenPower,
                radius: init.radius,
                energy: init.energy,
                ballSpeed: init.ballSpeed,
                ballDelta: init.ballDelta
            },
            from: mergeSheetPose(init.from),
            to: mergeSheetPose(init.to),
            center: animate ? spawn : place,
            target: place
        });
        if (animate) {
            sheet.emitter.travel = {
                stage: 'pair',
                u: 0,
                radiusScale: motion.pairSize,
                spawnLocal: {
                    col: spawn.col - place.col,
                    row: spawn.row - place.row
                },
                waypointLocal: {
                    col: waypoint.col - place.col,
                    row: waypoint.row - place.row
                },
                revealDelay: motion.splitDelay,
                pair: { col: spawn.col, row: spawn.row },
                upper: null,
                lower: null,
                upperFrom: null,
                lowerFrom: null
            };
        }
        this.add(sheet);
        if (animate) {
            this.fitStack();
        } else {
            this.layoutItems();
        }
        if (typeof this.onPartAdded === 'function') {
            this.onPartAdded(sheet);
        }
        this.emit('added', sheet);
        return sheet;
    }

    layoutItems() {
        layoutPaperItems(this);
    }

    resyncCycles() {
        alignPaperStack(this);
    }

    keepTemplate(key, value) {
        const pose = HOT_MAP_PAPER_POSE_KEYS[key];
        if (pose && this.sheetInit && this.sheetInit[pose[0]]) {
            this.sheetInit[pose[0]][pose[1]] = value;
            return;
        }
        if (this.addMotion && typeof this.addMotion[key] === 'number') {
            this.addMotion[key] = value;
            return;
        }
        if (this.sheetInit && (typeof this.sheetInit[key] === 'number' || typeof this.sheetInit[key] === 'boolean')) {
            this.sheetInit[key] = value;
        }
    }

    onFieldSet(key) {
        if (key === 'stackGap') {
            this.layoutItems();
        }
    }

    sheetList() {
        return this.parts
            .map((part) => part.object)
            .filter((object) => object && object.kind === 'sheet' && object.emitter);
    }

    fitStack() {
        const sheets = this.sheetList();
        if (!sheets.length) {
            return this.center;
        }
        let minRow = sheets[0].emitter.target.row;
        let maxRow = minRow;
        let col = 0;
        sheets.forEach((sheet) => {
            const target = sheet.emitter.target;
            col += target.col;
            if (target.row < minRow) {
                minRow = target.row;
            }
            if (target.row > maxRow) {
                maxRow = target.row;
            }
        });
        this.center = {
            col: col / sheets.length,
            row: (minRow + maxRow) * 0.5
        };
        this.parts.forEach((part) => {
            part.local = this.captureLocal(part.object);
        });
        return this.center;
    }

    removeItem() {
        const object = this.lastPart('sheet');
        if (!object) {
            return null;
        }
        this.remove(object, { instant: true });
        this.fitStack();
        return object;
    }

    extendSerialized(data) {
        data.sheetInit = copyHotMapPaperSheetInit(this.sheetInit);
        data.addMotion = {
            pairSpan: this.addMotion.pairSpan,
            pairGap: this.addMotion.pairGap,
            pairSize: this.addMotion.pairSize,
            splitDelay: this.addMotion.splitDelay,
            stackGap: this.addMotion.stackGap
        };
        return data;
    }

    applySerializedExtras(data) {
        if (data.sheetInit) {
            this.sheetInit = copyHotMapPaperSheetInit(data.sheetInit);
        }
        if (data.addMotion) {
            Object.keys(HOT_MAP_PAPER_ADD_SPECS).forEach((key) => {
                if (typeof data.addMotion[key] === 'number') {
                    this.addMotion[key] = data.addMotion[key];
                }
            });
        }
    }
}

HotMapUiPaper.ADD_TABS = [
    {
        id: 'pair',
        label: 'PAIR',
        rows: [
            { key: 'spawnX', label: 'SPAWN X', decimals: 1 },
            { key: 'spawnY', label: 'SPAWN Y', decimals: 1 },
            { key: 'pairSpan', label: 'SPAN', decimals: 2 },
            { key: 'pairGap', label: 'GAP', decimals: 0 },
            { key: 'pairSize', label: 'SIZE', decimals: 1 },
            { key: 'addItem', label: 'SHEET', button: 'ADD', type: 'action' }
        ]
    },
    {
        id: 'split',
        label: 'SPLIT',
        rows: [
            { key: 'splitDelay', label: 'DELAY', decimals: 1 },
            { key: 'stackGap', label: 'DROP', decimals: 0 }
        ]
    }
];

const HOT_MAP_PAPER_ADD_SPECS = {
    pairSpan: { min: 0.1, max: 1, step: 0.05 },
    pairGap: { min: 0, max: 40, step: 1 },
    pairSize: { min: 1, max: 4, step: 0.1 },
    splitDelay: { min: 0, max: 8, step: 0.1 },
    stackGap: { min: 0, max: 80, step: 1 }
};

const HOT_MAP_PAPER_STACK_GAP = 10;
const HOT_MAP_PAPER_TRAVEL_BALL_GAP = 5;
const HOT_MAP_PAPER_TRAVEL_SPAN = 0.7;
const HOT_MAP_PAPER_REVEAL_DELAY = 2;
const HOT_MAP_PAPER_TRAVEL_RADIUS = 2;
const HOT_MAP_PAPER_BALL_SHIFT = 0.08;

function hotMapPaperSheetBottom(emitter) {
    const pose = emitter.current || emitter.to || emitter.from;
    const bend = Math.max(0, pose.bend || 0);
    const thick = Math.max(0, (pose.height || 0) * 0.5);
    const delta = Math.max(0, emitter.params.ballDelta || 0);
    const radius = Math.max(0, emitter.params.radius || 0);
    return {
        col: emitter.target.col,
        row: emitter.target.row + bend + thick + delta + radius
    };
}

function hotMapPaperTravelPoint(from, to, span) {
    return {
        col: from.col + (to.col - from.col) * span,
        row: from.row + (to.row - from.row) * span
    };
}

const HOT_MAP_PAPER_FIELD_KEYS = {
    speed: 'speed',
    delay: 'delay',
    gap: 'gap',
    glistenSpeed: 'glistenSpeed',
    glistenDelay: 'glistenDelay',
    glistenPower: 'glistenPower'
};

const HOT_MAP_PAPER_BALL_KEYS = {
    radius: 'radius',
    energy: 'energy',
    ballSpeed: 'ballSpeed',
    ballDelta: 'ballDelta'
};

const HOT_MAP_PAPER_POSE_KEYS = {
    fromWidth: ['from', 'width'],
    fromHeight: ['from', 'height'],
    fromSkew: ['from', 'skew'],
    fromBend: ['from', 'bend'],
    fromCosine: ['from', 'cosine'],
    fromHeat: ['from', 'heat'],
    toWidth: ['to', 'width'],
    toHeight: ['to', 'height'],
    toSkew: ['to', 'skew'],
    toBend: ['to', 'bend'],
    toCosine: ['to', 'cosine'],
    toHeat: ['to', 'heat']
};

const HOT_MAP_PAPER_PRESET = {
    name: 'Paper',
    center: { col: 64.5, row: 140 },
    spawn: { col: 24, row: 117 },
    sheetInit: {
        cycling: true,
        glistenOn: true,
        speed: 1.2,
        delay: 0.5,
        gap: 0.4,
        glistenSpeed: 0.8,
        glistenDelay: 1,
        glistenPower: 0.1,
        radius: 1.5,
        energy: 1.5,
        ballSpeed: 0.5,
        ballDelta: 0,
        from: {
            width: 70,
            height: 3,
            angle: 0,
            skew: -60,
            heat: 0,
            bend: 6,
            cosine: 90
        },
        to: {
            width: 70,
            height: 3,
            angle: 0,
            skew: -60,
            heat: 0.1,
            bend: 6,
            cosine: 90
        }
    }
};

function defaultHotMapPaperSheetInit() {
    const init = HOT_MAP_PAPER_PRESET.sheetInit;
    const from = defaultSheetPose('from');
    const to = defaultSheetPose('to');
    Object.assign(from, init.from);
    Object.assign(to, init.to);
    return {
        cycling: init.cycling,
        glistenOn: init.glistenOn,
        speed: init.speed,
        delay: init.delay,
        gap: init.gap,
        glistenSpeed: init.glistenSpeed,
        glistenDelay: init.glistenDelay,
        glistenPower: init.glistenPower,
        radius: init.radius,
        energy: init.energy,
        ballSpeed: init.ballSpeed,
        ballDelta: init.ballDelta,
        from: from,
        to: to
    };
}

heatRegisterComposite('paper', {
    create(heatMap, overrides) {
        return new HotMapUiPaper(heatMap, overrides);
    }
});

function copyHotMapPaperSheetInit(raw) {
    const base = defaultHotMapPaperSheetInit();
    const data = raw || {};
    if (typeof data.cycling === 'boolean') {
        base.cycling = data.cycling;
    }
    if (typeof data.glistenOn === 'boolean') {
        base.glistenOn = data.glistenOn;
    }
    Object.keys(HOT_MAP_PAPER_FIELD_KEYS).forEach((key) => {
        if (typeof data[key] === 'number') {
            base[key] = data[key];
        }
    });
    Object.keys(HOT_MAP_PAPER_BALL_KEYS).forEach((key) => {
        if (typeof data[key] === 'number') {
            base[key] = data[key];
        }
    });
    base.from = mergeSheetPose(base.from, data.from);
    base.to = mergeSheetPose(base.to, data.to);
    return base;
}
