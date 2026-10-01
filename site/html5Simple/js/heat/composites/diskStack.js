/**
 * New Paper config. Depth and radius/heat gains step by index.
 * Spin is each disk's own. On add it copies the lead disk's phase
 * so the stack stays in step without a shared host.
 * Exit is instant. Drama is still the three-step remove.
 */
function copyDiskCycles(disk, lead) {
    if (!disk || !lead || disk === lead) {
        return;
    }
    disk.angle = lead.angle;
    disk.ballSpin = lead.ballSpin;
    disk.loopAngle = lead.loopAngle;
}

function alignDiskStack(group) {
    const disks = group.sheetList();
    const lead = disks[0];
    disks.forEach((disk) => copyDiskCycles(disk, lead));
}

function layoutDiskItems(group) {
    const disks = group.sheetList();
    const init = group.sheetInit;
    disks.forEach((disk, index) => {
        disk.depth = index * group.distance;
        disk.pivotCol = group.center.col;
        disk.pivotRow = group.center.row;
        disk.radFrom = hotMapNewPaperScaled('radFrom', init.radFrom, index, group.diskGain);
        disk.radTo = hotMapNewPaperScaled('radTo', init.radTo, index, group.diskGain);
        disk.heatFrom = hotMapNewPaperScaled('heatFrom', init.heatFrom, index, group.heatGain);
        disk.heatTo = hotMapNewPaperScaled('heatTo', init.heatTo, index, group.heatGain);
        disk.ballRadius = hotMapNewPaperScaled('ballRadius', init.ballRadius, index, group.radiusGain);
        disk.ballTravel = null;
        disk.drama = null;
    });
    alignDiskStack(group);
    group.parts.forEach((part) => {
        part.local = group.captureLocal(part.object);
    });
}
