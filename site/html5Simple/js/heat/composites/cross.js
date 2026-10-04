/**
 * Cross config. Two highlighters make a plus, two shards make an X.
 * HIGH TURN and SHARD TURN are the step between the pair.
 * SHARD OFF is added to both shard angles so they sit on the diagonals.
 */
function layoutCrossItems(group) {
    layoutCrossKind(group, 'back-highlight', group.highlightInit, group.highlightTurn || 0, 0);
    layoutCrossKind(group, 'shard', group.shardInit, group.shardTurn || 0, group.shardOffset || 0);
    group.parts.forEach((part) => {
        part.local = group.captureLocal(part.object);
    });
}

function layoutCrossKind(group, kind, init, turn, offset) {
    const items = group.parts
        .map((part) => part.object)
        .filter((object) => object && object.kind === kind && object.emitter);
    const center = group.center;
    items.forEach((item, index) => {
        const emitter = item.emitter;
        if (init && init.from && init.to) {
            const fromAngle = wrapHotMapCrossAngle(init.from.angle + offset + index * turn);
            const toAngle = wrapHotMapCrossAngle(init.to.angle + offset + index * turn);
            emitter.from.angle = fromAngle;
            emitter.to.angle = toAngle;
            if (emitter.current) {
                emitter.current.angle = fromAngle;
            }
        }
        emitter.center.col = center.col;
        emitter.center.row = center.row;
        emitter.target.col = center.col;
        emitter.target.row = center.row;
    });
}

function wrapHotMapCrossAngle(deg) {
    const turn = 360;
    let value = ((deg + 180) % turn + turn) % turn - 180;
    if (value === -180) {
        return 180;
    }
    return value;
}

function crossExit() {
    return sequence([
        fade({ duration: 0.4, from: 1, to: 0 }),
        call('detach')
    ], { slot: 'life', policy: 'replace', fill: 'hold' });
}

const HOT_MAP_CROSS_LAYOUT = {
    highlightTurn: { min: 0, max: 180, step: 5 },
    shardTurn: { min: 0, max: 180, step: 5 },
    shardOffset: { min: -180, max: 180, step: 5 }
};

const HOT_MAP_CROSS_HL_FIELD = {
    hlCycling: 'cycling',
    hlSpeed: 'speed',
    hlDelay: 'delay',
    hlGap: 'gap'
};

const HOT_MAP_CROSS_SH_FIELD = {
    shCycling: 'cycling',
    shSpeed: 'speed',
    shDelay: 'delay',
    shGap: 'gap'
};

const HOT_MAP_CROSS_HL_POSE = {
    hlFromWidth: ['from', 'width'],
    hlFromHeight: ['from', 'height'],
    hlFromAngle: ['from', 'angle'],
    hlFromHeat: ['from', 'heat'],
    hlToWidth: ['to', 'width'],
    hlToHeight: ['to', 'height'],
    hlToAngle: ['to', 'angle'],
    hlToHeat: ['to', 'heat']
};

const HOT_MAP_CROSS_SH_POSE = {
    shFromWidth: ['from', 'width'],
    shFromHeight: ['from', 'height'],
    shFromAngle: ['from', 'angle'],
    shFromSkew: ['from', 'skew'],
    shFromShapeHeat: ['from', 'shapeHeat'],
    shFromHeat: ['from', 'heat'],
    shFromGlisten: ['from', 'glisten'],
    shToWidth: ['to', 'width'],
    shToHeight: ['to', 'height'],
    shToAngle: ['to', 'angle'],
    shToSkew: ['to', 'skew'],
    shToShapeHeat: ['to', 'shapeHeat'],
    shToHeat: ['to', 'heat'],
    shToGlisten: ['to', 'glisten']
};

const HOT_MAP_CROSS_PRESET = {
    name: 'Cross',
    center: { col: 96, row: 210 },
    spawn: { col: 0, row: 0 },
    highlightTurn: 90,
    shardTurn: 90,
    shardOffset: 45,
    highlightInit: {
        visible: true,
        cycling: true,
        speed: 1.2,
        delay: 0.4,
        gap: 0.3,
        from: { width: 72, height: 10, angle: 0, heat: 0.6 },
        to: { width: 110, height: 16, angle: 0, heat: 1.6 }
    },
    shardInit: {
        visible: true,
        cycling: true,
        speed: 1.2,
        delay: 0.4,
        gap: 0.3,
        from: {
            width: 64,
            height: 8,
            angle: 0,
            skew: -40,
            heat: 0.4,
            shapeHeat: 0.1,
            glisten: 0
        },
        to: {
            width: 88,
            height: 6,
            angle: 0,
            skew: 40,
            heat: 1.6,
            shapeHeat: 0.2,
            glisten: 100
        }
    }
};

function hotMapCrossRoute(key) {
    if (HOT_MAP_CROSS_HL_FIELD[key]) {
        return {
            kind: 'back-highlight',
            name: HOT_MAP_CROSS_HL_FIELD[key],
            field: true
        };
    }
    if (HOT_MAP_CROSS_SH_FIELD[key]) {
        return {
            kind: 'shard',
            name: HOT_MAP_CROSS_SH_FIELD[key],
            field: true
        };
    }
    const highlight = HOT_MAP_CROSS_HL_POSE[key];
    if (highlight) {
        return {
            kind: 'back-highlight',
            group: highlight[0],
            prop: highlight[1],
            name: hotMapCrossPoseName(highlight),
            angle: highlight[1] === 'angle',
            field: false
        };
    }
    const shard = HOT_MAP_CROSS_SH_POSE[key];
    if (shard) {
        return {
            kind: 'shard',
            group: shard[0],
            prop: shard[1],
            name: hotMapCrossPoseName(shard),
            angle: shard[1] === 'angle',
            field: false
        };
    }
    return null;
}

function hotMapCrossPoseName(pair) {
    return pair[0] + pair[1].charAt(0).toUpperCase() + pair[1].slice(1);
}

function fillHotMapCrossKindParams(values, prefix, init) {
    values[prefix + 'Visible'] = init.visible !== false;
    values[prefix + 'Cycling'] = init.cycling !== false;
    values[prefix + 'Speed'] = init.speed;
    values[prefix + 'Delay'] = init.delay;
    values[prefix + 'Gap'] = init.gap;
    const poses = prefix === 'hl' ? HOT_MAP_CROSS_HL_POSE : HOT_MAP_CROSS_SH_POSE;
    Object.keys(poses).forEach((key) => {
        const pair = poses[key];
        const pose = init[pair[0]];
        values[key] = pose ? pose[pair[1]] : 0;
    });
}

function defaultHotMapCrossInit(raw) {
    const data = raw || {};
    const from = defaultBackHighlightPose('from');
    const to = defaultBackHighlightPose('to');
    Object.assign(from, data.from);
    Object.assign(to, data.to);
    return {
        visible: data.visible !== false,
        cycling: data.cycling !== false,
        speed: data.speed,
        delay: data.delay,
        gap: data.gap,
        from: from,
        to: to
    };
}

function copyHotMapCrossInit(raw) {
    const base = defaultHotMapCrossInit(HOT_MAP_CROSS_PRESET.highlightInit);
    const data = raw || {};
    if (typeof data.visible === 'boolean') {
        base.visible = data.visible;
    }
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

function syncHotMapCrossCycle(item, lead) {
    if (!item || !lead || item === lead || !item.emitter || !lead.emitter) {
        return;
    }
    item.emitter.phase = lead.emitter.phase;
    item.emitter.waitLeft = lead.emitter.waitLeft;
}
