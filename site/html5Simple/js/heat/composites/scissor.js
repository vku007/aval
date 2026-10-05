/**
 * Scissor config. Each shard steps its angle by the group's turn.
 * Enter is the parallel move / grow / spin. Clear fades, then detaches.
 * POP is scissorDrama: triple heat, a gravity fall, and a tumble.
 */
function layoutScissorItems(group) {
    const shards = group.parts
        .map((part) => part.object)
        .filter((object) => object && object.kind === 'shard' && object.emitter);
    const init = group.shardInit;
    shards.forEach((shard, index) => {
        const emitter = shard.emitter;
        if (init) {
            emitter.from.angle = wrapHotMapScissorAngle(init.from.angle + index * group.angleStep);
            emitter.to.angle = wrapHotMapScissorAngle(init.to.angle + index * group.angleStep);
            emitter.current = copyBackHighlightPose(emitter.from);
        }
        emitter.center.col = group.center.col;
        emitter.center.row = group.center.row;
        emitter.target.col = group.center.col;
        emitter.target.row = group.center.row;
    });
    group.parts.forEach((part) => {
        part.local = group.captureLocal(part.object);
    });
}

function scissorExit() {
    return sequence([
        fade({ duration: 0.4, from: 1, to: 0 }),
        call('detach')
    ], { slot: 'life', policy: 'replace', fill: 'hold' });
}
