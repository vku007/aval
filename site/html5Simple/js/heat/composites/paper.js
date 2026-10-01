/**
 * Paper config. Sheets stack by stackGap.
 * Shared ball, glisten, and shape clocks are gone: on add, each sheet
 * copies the lead sheet's cycles, and the ball cycle takes the index shift.
 */
function copyPaperCycles(sheet, lead, shift) {
    if (!sheet || !lead || sheet === lead || !sheet.emitter || !lead.emitter) {
        return;
    }
    const src = lead.emitter;
    const dst = sheet.emitter;
    dst.glisten = src.glisten;
    dst.glistenPhase = src.glistenPhase;
    dst.glistenWait = src.glistenWait;
    dst.phase = src.phase;
    dst.waitLeft = src.waitLeft;
    dst.current = sheetHeatPose(src.current);
    let ball = (src.ball + (shift || 0)) % 1;
    if (ball < 0) {
        ball += 1;
    }
    dst.ball = ball;
}

function alignPaperStack(group) {
    const sheets = group.sheetList();
    const lead = sheets[0];
    sheets.forEach((sheet, index) => {
        copyPaperCycles(sheet, lead, index * HOT_MAP_PAPER_BALL_SHIFT);
    });
}

function layoutPaperItems(group) {
    const sheets = group.sheetList();
    const gap = group.addMotion.stackGap;
    const count = sheets.length;
    const anchor = group.layoutAnchor || group.center;
    sheets.forEach((sheet, index) => {
        const emitter = sheet.emitter;
        emitter.travel = null;
        emitter.glistenHold = false;
        setSheetGlistenOn(emitter, group.sheetInit.glistenOn !== false);
        const row = anchor.row + (index - (count - 1) / 2) * gap;
        emitter.target.col = anchor.col;
        emitter.target.row = row;
        emitter.center.col = anchor.col;
        emitter.center.row = row;
    });
    if (typeof group.fitStack === 'function') {
        group.fitStack();
    }
    alignPaperStack(group);
}

function paperExit() {
    return sequence([
        fade({ duration: 0.4, from: 1, to: 0 }),
        call('detach')
    ], { slot: 'life', policy: 'replace', fill: 'hold' });
}
