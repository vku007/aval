/**
 * Stone config. Even phases around the center.
 * Enter flies in from the spawn point. Spread commits the even phases.
 */
function layoutStoneItems(group) {
    const balls = group.parts
        .map((part) => part.object)
        .filter((object) => object && object.kind === 'hot-ball' && object.motion && !object._stoneShard);
    balls.forEach((ball) => {
        const motion = ball.motion;
        motion.orbitCenter.col = group.center.col;
        motion.orbitCenter.row = group.center.row;
        if (motion.orbitTarget) {
            motion.orbitTarget.col = group.center.col;
            motion.orbitTarget.row = group.center.row;
        }
        motion.centerFollow = null;
        motion.phaseGoal = null;
        motion.phaseFollow = null;
    });
    if (balls.length < 2) {
        return;
    }
    const base = wrapPhaseDeg(group.ballInit.phase) * Math.PI / 180;
    const step = (Math.PI * 2) / balls.length;
    balls.forEach((ball, index) => {
        const angle = base + index * step;
        ball.motion.angle = angle;
        ball.motion.params.phase = wrapPhaseDeg(angle * 180 / Math.PI);
    });
    group.parts.forEach((part) => {
        part.local = group.captureLocal(part.object);
    });
}

function stoneExit() {
    return sequence([
        fade({ duration: 0.4, from: 1, to: 0 }),
        call('detach')
    ], { slot: 'life', policy: 'replace', fill: 'hold' });
}

/**
 * Unit tangent of the orbit at `angle`, in the direction angleSpeed moves.
 */
function stoneTangent(motion, angle) {
    const speed = motion && motion.params ? motion.params.angleSpeed || 0 : 0;
    const eps = 1e-4;
    const from = rotatedOrbitOffset(motion, angle);
    const ahead = rotatedOrbitOffset(motion, angle + eps);
    let col = (ahead.col - from.col) / eps;
    let row = (ahead.row - from.row) / eps;
    if (speed < 0) {
        col = -col;
        row = -row;
    }
    const mag = Math.hypot(col, row);
    if (mag < 1e-6) {
        return { col: 1, row: 0 };
    }
    return { col: col / mag, row: row / mag };
}

/**
 * Three shards. Each keeps some of the orbit speed in the opposite
 * direction (`tangent` reversed), plus a sideways shove, then falls.
 * `random` in [0, 1) jitters the carry, the shove, the fall, and the time.
 */
const STONE_SHARD_CARRY = [22, 14, 30];
const STONE_SHARD_SIDES = [-12, 3, 16];
const STONE_SHARD_DROPS = [62, 78, 70];
const STONE_SHARD_TIMES = [0.86, 1.05, 0.94];

function stoneShardFlights(tangent, random) {
    const rng = typeof random === 'function' ? random : Math.random;
    const along = tangent && Math.hypot(tangent.col || 0, tangent.row || 0) > 1e-6
        ? tangent
        : { col: 0, row: 1 };
    const side = { col: -along.row, row: along.col };
    return STONE_SHARD_CARRY.map((carry, index) => {
        const forward = carry * (0.85 + rng() * 0.3);
        const across = STONE_SHARD_SIDES[index] * (0.82 + rng() * 0.36);
        return {
            flight: {
                col: -along.col * forward + side.col * across,
                row: -along.row * forward + side.row * across
            },
            kick: 1,
            drop: STONE_SHARD_DROPS[index] * (0.9 + rng() * 0.2),
            duration: STONE_SHARD_TIMES[index] * (0.88 + rng() * 0.24)
        };
    });
}
