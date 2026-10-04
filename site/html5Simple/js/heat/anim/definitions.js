/**
 * Transition blocks. A definition is { slot, policy, fill, block }.
 * Sample is a pure function of the frozen block and time, in seconds.
 */
function transition(block, options) {
    const opts = options || {};
    return {
        slot: opts.slot || 'life',
        policy: opts.policy || 'replace',
        fill: opts.fill || 'none',
        block: block
    };
}

function unwrapBlock(part) {
    if (part && part.block && part.block.type) {
        return part.block;
    }
    return part;
}

function blockOptions(parts, options) {
    const first = (parts && parts[0]) || {};
    const opts = options || {};
    return {
        slot: opts.slot || first.slot || 'life',
        policy: opts.policy || first.policy || 'replace',
        fill: opts.fill || first.fill || 'none'
    };
}

function tracks(options) {
    const opts = options || {};
    return {
        type: 'tracks',
        duration: opts.duration,
        ease: opts.ease || 'linear',
        channels: opts.channels || {}
    };
}

function wait(duration, options) {
    return transition({
        type: 'wait',
        duration: duration
    }, options || {});
}

function set(values, options) {
    const raw = values || {};
    const explicit = raw.channels || raw.fields;
    return transition({
        type: 'set',
        channels: explicit ? (raw.channels || {}) : raw,
        fields: raw.fields || null
    }, options || {});
}

function call(name, options) {
    return transition({
        type: 'call',
        name: name
    }, options || {});
}

function sequence(parts, options) {
    return transition({
        type: 'sequence',
        children: (parts || []).map(unwrapBlock)
    }, blockOptions(parts, options));
}

function parallel(parts, options) {
    return transition({
        type: 'parallel',
        children: (parts || []).map(unwrapBlock)
    }, blockOptions(parts, options));
}

function stagger(definition, options) {
    const opts = options || {};
    return transition({
        type: 'stagger',
        each: typeof opts.each === 'number' ? opts.each : 0.32,
        child: definition
    }, {
        slot: opts.slot || 'life',
        policy: opts.policy || 'replace',
        fill: opts.fill || 'none'
    });
}

function heatResolveNumber(value, ctx) {
    if (typeof value === 'string' && value.charAt(0) === '$') {
        const raw = ctx ? ctx[value.slice(1)] : undefined;
        return typeof raw === 'number' ? raw : 0;
    }
    return typeof value === 'number' ? value : 0;
}

function heatResolveValue(value, channel, ctx, current) {
    if (value === 'current') {
        if (current && Object.prototype.hasOwnProperty.call(current, channel)) {
            return cloneHeatValue(channel, current[channel]);
        }
        return heatIdentity(channel);
    }
    if (typeof value === 'string' && value.charAt(0) === '$') {
        const raw = ctx ? ctx[value.slice(1)] : undefined;
        if (raw == null) {
            return heatIdentity(channel);
        }
        return cloneHeatValue(channel, raw);
    }
    if (value == null) {
        return heatIdentity(channel);
    }
    return cloneHeatValue(channel, value);
}

function heatResolveRaw(value, ctx) {
    if (typeof value === 'string' && value.charAt(0) === '$') {
        return ctx ? ctx[value.slice(1)] : undefined;
    }
    if (value && typeof value.col === 'number') {
        return { col: value.col, row: value.row };
    }
    return value;
}

function heatFreeze(block, ctx, current) {
    if (!block) {
        return { type: 'wait', duration: 0 };
    }
    if (block.type === 'tracks') {
        const channels = {};
        const source = block.channels || {};
        Object.keys(source).forEach((name) => {
            const spec = source[name] || {};
            channels[name] = {
                from: heatResolveValue(spec.from, name, ctx, current),
                to: heatResolveValue(spec.to, name, ctx, current)
            };
        });
        return {
            type: 'tracks',
            duration: heatResolveNumber(block.duration, ctx),
            ease: block.ease || 'linear',
            channels: channels
        };
    }
    if (block.type === 'sequence' || block.type === 'parallel') {
        return {
            type: block.type,
            children: (block.children || []).map((child) => heatFreeze(child, ctx, current))
        };
    }
    if (block.type === 'wait') {
        return { type: 'wait', duration: heatResolveNumber(block.duration, ctx) };
    }
    if (block.type === 'set') {
        const channels = {};
        const source = block.channels || {};
        Object.keys(source).forEach((name) => {
            channels[name] = heatResolveValue(source[name], name, ctx, current);
        });
        const fields = {};
        const rawFields = block.fields || {};
        Object.keys(rawFields).forEach((key) => {
            fields[key] = heatResolveRaw(rawFields[key], ctx);
        });
        return { type: 'set', channels: channels, fields: fields };
    }
    if (block.type === 'call') {
        return { type: 'call', name: block.name };
    }
    if (block.type === 'shake') {
        return {
            type: 'shake',
            duration: heatResolveNumber(block.duration, ctx),
            amp: heatResolveNumber(block.amp, ctx),
            cycles: heatResolveNumber(block.cycles == null ? 1 : block.cycles, ctx)
        };
    }
    if (block.type === 'arc') {
        const frozen = {
            type: 'arc',
            duration: heatResolveNumber(block.duration, ctx),
            dir: heatResolveValue(block.dir, 'offset', ctx, current),
            distance: heatResolveNumber(block.distance, ctx),
            drop: heatResolveNumber(block.drop, ctx)
        };
        if (block.end != null) {
            frozen.end = heatResolveValue(block.end, 'offset', ctx, current);
            frozen.kick = heatResolveNumber(block.kick, ctx);
        }
        return frozen;
    }
    if (block.type === 'stagger') {
        return {
            type: 'stagger',
            each: heatResolveNumber(block.each, ctx),
            child: block.child
        };
    }
    return { type: 'wait', duration: 0 };
}

function heatDuration(block) {
    if (!block) {
        return 0;
    }
    if (block.type === 'sequence') {
        return (block.children || []).reduce((sum, child) => sum + heatDuration(child), 0);
    }
    if (block.type === 'parallel') {
        return (block.children || []).reduce((max, child) => Math.max(max, heatDuration(child)), 0);
    }
    if (block.type === 'stagger') {
        const count = block.count || 1;
        const each = block.each || 0;
        const child = block.child && (block.child.block || block.child);
        return Math.max(0, count - 1) * each + heatDuration(child);
    }
    return heatResolveNumber(block.duration, null);
}

function heatDefDuration(definition, ctx) {
    if (!definition) {
        return 0;
    }
    const frozen = heatFreeze(definition.block || definition, ctx || {}, {});
    return heatDuration(frozen);
}

function heatLerp(name, from, to, u) {
    const spec = HEAT_CHANNEL_SPEC[name];
    if (!spec || spec.shape === 'point') {
        const a = from || { col: 0, row: 0 };
        const b = to || { col: 0, row: 0 };
        return {
            col: a.col + (b.col - a.col) * u,
            row: a.row + (b.row - a.row) * u
        };
    }
    const a = typeof from === 'number' ? from : spec.identity;
    const b = typeof to === 'number' ? to : spec.identity;
    return a + (b - a) * u;
}

function heatOverlay(base, extra) {
    const out = {};
    Object.keys(base).forEach((name) => {
        out[name] = base[name];
    });
    Object.keys(extra).forEach((name) => {
        out[name] = extra[name];
    });
    return out;
}

function heatMergeOne(name, a, b) {
    const spec = HEAT_CHANNEL_SPEC[name];
    if (!spec || spec.combine === 'latest') {
        return b;
    }
    if (spec.shape === 'point') {
        return { col: a.col + b.col, row: a.row + b.row };
    }
    if (spec.combine === 'add') {
        return a + b;
    }
    if (spec.combine === 'mul') {
        return a * b;
    }
    return b;
}

function heatMergeValues(base, extra) {
    const out = heatOverlay(base, {});
    Object.keys(extra).forEach((name) => {
        if (!Object.prototype.hasOwnProperty.call(base, name)) {
            out[name] = extra[name];
            return;
        }
        out[name] = heatMergeOne(name, base[name], extra[name]);
    });
    return out;
}

function heatEmptySample() {
    return { values: {}, events: [] };
}

function heatSample(block, time) {
    if (!block) {
        return heatEmptySample();
    }
    if (block.type === 'tracks') {
        const dur = heatResolveNumber(block.duration, null);
        const u = dur <= 0 ? 1 : heatEase(block.ease, Math.max(0, Math.min(1, time / dur)));
        const values = {};
        const source = block.channels || {};
        Object.keys(source).forEach((name) => {
            const spec = source[name];
            values[name] = heatLerp(name, spec.from, spec.to, u);
        });
        return { values: values, events: [] };
    }
    if (block.type === 'shake') {
        const dur = heatResolveNumber(block.duration, null);
        const u = dur <= 0 ? 1 : Math.max(0, Math.min(1, time / dur));
        const amp = block.amp || 0;
        const cycles = block.cycles || 1;
        const mag = amp * Math.sin(u * cycles * Math.PI * 2) * (1 - u);
        return { values: { offset: { col: mag, row: 0 } }, events: [] };
    }
    if (block.type === 'arc') {
        const dur = heatResolveNumber(block.duration, null);
        const u = dur <= 0 ? 1 : Math.max(0, Math.min(1, time / dur));
        const dir = block.dir || { col: 0, row: 0 };
        const span = Math.hypot(dir.col, dir.row);
        if (block.end) {
            const aim = span > 1e-6
                ? { col: dir.col / span, row: dir.row / span }
                : { col: 1, row: 0 };
            const kick = block.kick || 0;
            const end = block.end;
            const leadCol = aim.col * kick;
            const leadRow = aim.row * kick;
            const uu = u * u;
            return {
                values: {
                    offset: {
                        col: leadCol * u + (end.col - leadCol) * uu,
                        row: leadRow * u + (end.row - leadRow) * uu
                    }
                },
                events: []
            };
        }
        const aim = span > 1e-6 ? dir : { col: 1, row: 0 };
        const distance = block.distance || 0;
        const drop = block.drop || 0;
        return {
            values: {
                offset: {
                    col: aim.col * distance * u,
                    row: aim.row * distance * u + drop * u * u
                }
            },
            events: []
        };
    }
    if (block.type === 'set') {
        const events = [];
        const fields = block.fields || {};
        Object.keys(fields).forEach((key) => {
            events.push({ type: 'field', time: 0, key: key, value: fields[key] });
        });
        return { values: block.channels || {}, events: events };
    }
    if (block.type === 'call') {
        return { values: {}, events: [{ type: 'call', time: 0, name: block.name }] };
    }
    if (block.type === 'sequence') {
        let values = {};
        let elapsed = 0;
        const events = [];
        const children = block.children || [];
        for (let index = 0; index < children.length; index += 1) {
            const child = children[index];
            const dur = heatDuration(child);
            if (time < elapsed) {
                break;
            }
            const local = Math.min(Math.max(0, time - elapsed), dur);
            const part = heatSample(child, local);
            values = heatOverlay(values, part.values);
            part.events.forEach((event) => {
                events.push({
                    type: event.type,
                    name: event.name,
                    key: event.key,
                    value: event.value,
                    time: event.time + elapsed
                });
            });
            elapsed += dur;
        }
        return { values: values, events: events };
    }
    if (block.type === 'parallel') {
        let values = {};
        const events = [];
        (block.children || []).forEach((child) => {
            const part = heatSample(child, time);
            values = heatMergeValues(values, part.values);
            part.events.forEach((event) => events.push(event));
        });
        return { values: values, events: events };
    }
    return heatEmptySample();
}
