/**
 * Reusable transitions. Kind-specific enters are compositions of these.
 * Durations come from the caller. expOut is the default fly-in ease.
 */
function channelTransition(name, options, fallbackFrom, fallbackTo) {
    const opts = options || {};
    const from = opts.from != null ? opts.from : fallbackFrom;
    const to = opts.to != null ? opts.to : fallbackTo;
    const channels = {};
    channels[name] = { from: from, to: to };
    return transition(tracks({
        duration: opts.duration,
        ease: opts.ease || 'expOut',
        channels: channels
    }), {
        slot: opts.slot || 'move',
        policy: opts.policy || 'replace',
        fill: opts.fill || 'none'
    });
}

function move(options) {
    return channelTransition('offset', options, { col: 0, row: 0 }, { col: 0, row: 0 });
}

function grow(options) {
    const opts = options || {};
    const from = opts.from != null ? opts.from : 0.001;
    return channelTransition('scale', Object.assign({}, opts, { from: from }), from, 1);
}

function spin(options) {
    return channelTransition('rotate', options, 0, 0);
}

function fade(options) {
    const opts = options || {};
    const from = opts.from != null ? opts.from : 1;
    const to = opts.to != null ? opts.to : 0;
    return channelTransition('heat', Object.assign({}, opts, { from: from, to: to }), from, to);
}

function pose(options) {
    const opts = options || {};
    const from = opts.from != null ? opts.from : 0;
    const to = opts.to != null ? opts.to : 1;
    return channelTransition('pose', Object.assign({
        slot: 'hover',
        ease: 'sine'
    }, opts, { from: from, to: to }), from, to);
}

function flash(options) {
    const opts = options || {};
    const duration = typeof opts.duration === 'number' ? opts.duration : 0.4;
    const peak = typeof opts.peak === 'number' ? opts.peak : 3;
    const half = duration / 2;
    const ease = opts.ease || 'sine';
    const from = opts.from != null ? opts.from : 1;
    const to = opts.to != null ? opts.to : 1;
    return sequence([
        tracks({ duration: half, ease: ease, channels: { heat: { from: from, to: peak } } }),
        tracks({ duration: half, ease: ease, channels: { heat: { from: peak, to: to } } })
    ], {
        slot: opts.slot || 'react',
        policy: opts.policy || 'replace',
        fill: opts.fill || 'none'
    });
}

function shake(options) {
    const opts = options || {};
    return transition({
        type: 'shake',
        duration: typeof opts.duration === 'number' ? opts.duration : 0.4,
        amp: typeof opts.amp === 'number' ? opts.amp : 3,
        cycles: typeof opts.cycles === 'number' ? opts.cycles : 3
    }, {
        slot: opts.slot || 'react',
        policy: opts.policy || 'replace',
        fill: opts.fill || 'none'
    });
}

/**
 * Scissor fly-in, one life-slot run.
 * The composite passes $spawn (cells from the landing point), $spin
 * (−(360 + turn)), and $duration (3 / speed seconds). Those are frozen
 * when the run starts, so a later retarget does not rebuild the path.
 */
/**
 * Stone fly-in. The orbit center is already the landing cell.
 * $spawn is the offset that puts the dot on the spawn point at the first frame.
 * Duration is 3 / spawnSpeed seconds.
 */
function stoneEnter() {
    return move({
        from: '$spawn',
        to: { col: 0, row: 0 },
        duration: '$duration',
        ease: 'expOut',
        slot: 'life',
        fill: 'none'
    });
}

/**
 * Even-phase spread. $phase is the degree offset from the ball's own angle
 * to the goal, frozen at play. Fill commit writes that into the ball.
 */
function stoneSpread() {
    return transition(tracks({
        duration: '$duration',
        ease: 'expOut',
        channels: {
            phase: { from: 'current', to: '$phase' }
        }
    }), {
        slot: 'layout',
        policy: 'replace',
        fill: 'commit'
    });
}

function scissorEnter() {
    return parallel([
        move({
            from: '$spawn',
            to: { col: 0, row: 0 },
            duration: '$duration',
            ease: 'expOut',
            slot: 'life'
        }),
        grow({
            duration: '$duration',
            ease: 'expOut',
            slot: 'life'
        }),
        spin({
            from: '$spin',
            to: 0,
            duration: '$duration',
            ease: 'expOut',
            slot: 'life'
        })
    ], {
        slot: 'life',
        policy: 'replace',
        fill: 'none'
    });
}

/**
 * One-shot travel, then detach. Pulses park the rod on the end cell and
 * pass the start as an offset. clipFrom scales a victory strike's width.
 */
function sweep(options) {
    const opts = options || {};
    const duration = opts.duration;
    const ease = opts.ease || 'sine';
    const motion = move({
        from: opts.from != null ? opts.from : { col: 0, row: 0 },
        to: opts.to != null ? opts.to : { col: 0, row: 0 },
        duration: duration,
        ease: ease,
        slot: 'move'
    });
    const parts = [motion];
    if (opts.clipFrom != null) {
        parts.push(channelTransition('clip', {
            from: opts.clipFrom,
            to: opts.clipTo != null ? opts.clipTo : 1,
            duration: duration,
            ease: ease,
            slot: 'move'
        }, opts.clipFrom, 1));
    }
    const flight = parts.length === 1
        ? parts[0]
        : parallel(parts, { slot: 'move', policy: 'replace', fill: 'none' });
    return sequence([flight, call('detach')], {
        slot: opts.slot || 'move',
        policy: opts.policy || 'replace',
        fill: opts.fill || 'none'
    });
}

function gather(options) {
    const opts = options || {};
    const channels = {
        'balls.gather': {
            from: opts.from != null ? opts.from : 1,
            to: opts.to != null ? opts.to : 0
        }
    };
    if (opts.at != null) {
        channels['balls.gatherAt'] = { from: opts.at, to: opts.at };
    }
    return transition(tracks({
        duration: opts.duration,
        ease: opts.ease || 'expOut',
        channels: channels
    }), {
        slot: opts.slot || 'life',
        policy: opts.policy || 'replace',
        fill: opts.fill || 'none'
    });
}
