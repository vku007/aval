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
class HotMapUiPaper {
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
        const field = heatMap.field;
        this.heatMap = heatMap;
        this.kind = 'hot-map-paper';
        this.name = opts.name || 'Paper';
        this.center = {
            col: opts.center && typeof opts.center.col === 'number'
                ? opts.center.col
                : (field.cols - 1) * 0.5,
            row: opts.center && typeof opts.center.row === 'number'
                ? opts.center.row
                : (field.rows - 1) * 0.5
        };
        this.parts = [];
        this.sheetInit = defaultHotMapPaperSheetInit();
        this.spawn = { col: 24, row: 0 };
        this.ballClock = { phase: 0, speed: 0, epoch: -1 };
        this.glistenClock = {
            glisten: 0,
            glistenPhase: 'run',
            glistenWait: 0,
            epoch: -1,
            params: { glistenSpeed: 0.4, glistenDelay: 0.4 }
        };
        this.shapeClock = createSheetShapeClock();
    }

    add(object) {
        if (!object || this.parts.some((part) => part.object === object)) {
            return object;
        }
        const part = { object: object, local: null };
        this.parts.push(part);
        part.local = this.captureLocal(object);
        this.syncBalls();
        return object;
    }

    remove(object) {
        const index = this.parts.findIndex((part) => part.object === object);
        if (index >= 0) {
            this.parts.splice(index, 1);
            if (object.emitter) {
                object.emitter.ballClock = null;
                object.emitter.ballLead = false;
                object.emitter.glistenClock = null;
                object.emitter.shapeClock = null;
            }
            this.syncBalls();
        }
    }

    get params() {
        const init = this.sheetInit;
        const from = init.from;
        const to = init.to;
        return {
            centerX: this.center.col,
            centerY: this.center.row,
            spawnX: this.center.col + this.spawn.col,
            spawnY: this.center.row + this.spawn.row,
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
            toHeat: to.heat
        };
    }

    nudgeParam(key, dir) {
        if (key === 'spawnX' || key === 'spawnY') {
            const axis = key === 'spawnX' ? 'col' : 'row';
            this.spawn[axis] += dir;
            return this.params[key];
        }
        if (key === 'cycling') {
            this.sheetInit.cycling = !this.sheetInit.cycling;
            return this.sheetInit.cycling;
        }
        if (key === 'glistenOn') {
            this.sheetInit.glistenOn = !this.sheetInit.glistenOn;
            return this.sheetInit.glistenOn;
        }
        if (HOT_MAP_PAPER_FIELD_KEYS[key] || HOT_MAP_PAPER_BALL_KEYS[key]) {
            return this.nudgeSheetField(key, dir);
        }
        if (HOT_MAP_PAPER_POSE_KEYS[key]) {
            return this.nudgeSheetPose(HOT_MAP_PAPER_POSE_KEYS[key], dir);
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
        return pose[prop];
    }

    addItem() {
        const init = this.sheetInit;
        const last = this.lastSheet();
        const place = last && last.emitter
            ? {
                col: last.emitter.target.col,
                row: last.emitter.target.row + HOT_MAP_PAPER_STACK_GAP
            }
            : { col: this.center.col, row: this.center.row };
        const spawn = {
            col: this.center.col + this.spawn.col,
            row: this.center.row + this.spawn.row
        };
        const aim = last && last.emitter ? hotMapPaperSheetBottom(last.emitter) : place;
        const waypoint = hotMapPaperTravelPoint(spawn, aim, HOT_MAP_PAPER_TRAVEL_SPAN);
        const sheet = new UiSheet(this.heatMap, {
            cycling: init.cycling !== false,
            glistenOn: init.glistenOn !== false,
            glistenHold: true,
            travelBallGap: HOT_MAP_PAPER_TRAVEL_BALL_GAP,
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
            center: spawn,
            target: place
        });
        sheet.emitter.travel = {
            stage: 'pair',
            u: 0,
            radiusScale: HOT_MAP_PAPER_TRAVEL_RADIUS,
            spawnLocal: {
                col: spawn.col - place.col,
                row: spawn.row - place.row
            },
            waypointLocal: {
                col: waypoint.col - place.col,
                row: waypoint.row - place.row
            },
            revealDelay: HOT_MAP_PAPER_REVEAL_DELAY,
            pair: { col: spawn.col, row: spawn.row },
            upper: null,
            lower: null,
            upperFrom: null,
            lowerFrom: null
        };
        this.add(sheet);
        this.fitStack();
        if (typeof this.onPartAdded === 'function') {
            this.onPartAdded(sheet);
        }
        return sheet;
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

    syncBalls() {
        const sheets = this.sheetList();
        if (sheets.length) {
            const lead = sheets[0].emitter.params;
            this.ballClock.speed = Math.max(0, lead.ballSpeed || 0);
            this.glistenClock.params.glistenSpeed = lead.glistenSpeed;
            this.glistenClock.params.glistenDelay = lead.glistenDelay;
            this.shapeClock.params.speed = lead.speed;
            this.shapeClock.params.delay = lead.delay;
            this.shapeClock.params.gap = lead.gap;
            this.shapeClock.cycling = sheets[0].emitter.cycling !== false;
        }
        sheets.forEach((sheet, index) => {
            const emitter = sheet.emitter;
            emitter.ballClock = this.ballClock;
            emitter.ballLead = index === 0;
            emitter.ballShift = index * HOT_MAP_PAPER_BALL_SHIFT;
            emitter.glistenClock = this.glistenClock;
            emitter.shapeClock = this.shapeClock;
        });
    }

    lastSheet() {
        for (let index = this.parts.length - 1; index >= 0; index -= 1) {
            const object = this.parts[index].object;
            if (object && object.kind === 'sheet') {
                return object;
            }
        }
        return null;
    }

    removeItem() {
        for (let index = this.parts.length - 1; index >= 0; index -= 1) {
            const object = this.parts[index].object;
            if (!object || object.kind !== 'sheet') {
                continue;
            }
            this.parts.splice(index, 1);
            if (object.emitter) {
                object.emitter.ballClock = null;
                object.emitter.ballLead = false;
                object.emitter.glistenClock = null;
                object.emitter.shapeClock = null;
            }
            if (this.heatMap && typeof this.heatMap.removeHighlighter === 'function') {
                this.heatMap.removeHighlighter(object.emitter);
            }
            this.syncBalls();
            this.fitStack();
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
        if (object.kind === 'sheet') {
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
        if (!local || !object || object.kind !== 'sheet') {
            return;
        }
        hotMapStonePlace(object.emitter.center, origin, local.center);
        hotMapStonePlace(object.emitter.target, origin, local.target);
    }

    serialize() {
        this.parts.forEach((part) => {
            part.local = this.captureLocal(part.object);
        });
        return {
            name: this.name,
            center: { col: this.center.col, row: this.center.row },
            spawn: { col: this.spawn.col, row: this.spawn.row },
            sheetInit: copyHotMapPaperSheetInit(this.sheetInit),
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
        if (data.sheetInit) {
            this.sheetInit = copyHotMapPaperSheetInit(data.sheetInit);
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

function defaultHotMapPaperSheetInit() {
    const params = defaultSheetEmitterParams();
    return {
        cycling: true,
        glistenOn: true,
        speed: params.speed,
        delay: params.delay,
        gap: params.gap,
        glistenSpeed: params.glistenSpeed,
        glistenDelay: params.glistenDelay,
        glistenPower: params.glistenPower,
        radius: params.radius,
        energy: params.energy,
        ballSpeed: params.ballSpeed,
        ballDelta: params.ballDelta,
        from: defaultSheetPose('from'),
        to: defaultSheetPose('to')
    };
}

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
