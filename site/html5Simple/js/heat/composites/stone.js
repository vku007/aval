/**
 * Stone config. Even phases around the center.
 * Enter flies in from the spawn point. Spread commits the even phases.
 */
function layoutStoneItems(group) {
    const balls = group.parts
        .map((part) => part.object)
        .filter((object) => object && object.kind === 'hot-ball' && object.motion);
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
