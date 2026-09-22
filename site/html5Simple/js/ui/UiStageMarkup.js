/**
 * UiStageMarkup
 * Non-interactive green frames on the UI editor stage.
 * Positions match the main-scene panels and buttons for the active layout,
 * including the extended Effects row, and the menu buttons and chips.
 */
const UI_STAGE_MARKUP_EFFECTS = ['NEG', 'OVER', 'PROT', 'SIZE'];

function uiStageMarkupBoxes(width, height, layout) {
    const boxes = [];
    const structure = layout && layout.structure;
    if (structure === 'hud-status-play') {
        pushThumbMarkup(boxes, width, height, layout);
    } else if (structure === 'hud-arena-grid') {
        pushArenaMarkup(boxes, width, height, layout);
    } else {
        pushBalancedMarkup(boxes, width, height, layout);
    }
    return boxes;
}

function pushThumbMarkup(boxes, width, height, layout) {
    const hudH = height * layout.hud;
    const stageH = height * layout.stage;
    const statusH = height * layout.status;
    const playH = height * layout.play;
    let y = 0;

    pushHudMarkup(boxes, 0, y, width, hudH, layout, false);
    y += hudH;
    pushStageMarkup(boxes, 0, y, width, stageH);
    y += stageH;
    pushStatusMarkup(boxes, 0, y, width, statusH);
    y += statusH;
    pushThumbPlayMarkup(boxes, 0, y, width, playH, layout);
}

function pushBalancedMarkup(boxes, width, height, layout) {
    const charactersHeight = height * layout.characters;
    const gameResultsHeight = height * layout.results;
    const stageH = height * layout.stage;
    const currentMoveHeight = height * layout.currentMove;
    const actionPanelHeight = height * layout.actions;
    let y = 0;

    pushCharactersMarkup(boxes, 0, y, width, charactersHeight, layout, true);
    y += charactersHeight;
    pushResultsMarkup(boxes, 0, y, width, gameResultsHeight);
    y += gameResultsHeight;
    pushStageMarkup(boxes, 0, y, width, stageH);
    y += stageH;
    pushCurrentMoveMarkup(boxes, 0, y, width, currentMoveHeight, layout);
    y += currentMoveHeight;
    pushTwoRowMarkup(boxes, 0, y, width, actionPanelHeight, layout);
}

function pushArenaMarkup(boxes, width, height, layout) {
    const hudH = height * layout.hud;
    const stageH = height * layout.stage;
    const arenaH = height * layout.arena;
    const actionsH = height * layout.actions;
    let y = 0;

    pushHudMarkup(boxes, 0, y, width, hudH, layout, true);
    y += hudH;
    pushStageMarkup(boxes, 0, y, width, stageH);
    y += stageH;
    pushCurrentMoveMarkup(boxes, 0, y, width, arenaH, layout);
    y += arenaH;
    pushGridMarkup(boxes, 0, y, width, actionsH, layout);
}

function pushHudMarkup(boxes, x, y, width, height, layout, includeBack) {
    pushBox(boxes, x, y, width, height, 'HUD');
    const nameRowH = Math.min(44, Math.floor(height * 0.42));
    if (includeBack && layout.backPlacement === 'hud') {
        pushCentered(
            boxes,
            x + layout.backW / 2 + 6,
            y + nameRowH / 2,
            layout.backW,
            layout.backH,
            'BACK'
        );
    }
    pushScoreRowMarkup(boxes, x, y + nameRowH, width, height - nameRowH);
}

function pushCharactersMarkup(boxes, x, y, width, height, layout, includeBack) {
    pushBox(boxes, x, y, width, height, 'NAMES');
    if (includeBack && layout.backPlacement === 'top-left') {
        pushCentered(
            boxes,
            x + layout.backW / 2 + 6,
            y + height / 2,
            layout.backW,
            layout.backH,
            'BACK'
        );
    }
}

function pushResultsMarkup(boxes, x, y, width, height) {
    pushBox(boxes, x, y, width, height, 'RESULTS');
    pushScoreRowMarkup(boxes, x, y, width, height);
}

function pushScoreRowMarkup(boxes, x, y, width, height) {
    const scorePanelSize = Math.min(height - 8, 64);
    const scorePanelY = y + (height - scorePanelSize) / 2;
    const playerPanelX = x + 10;
    pushBox(boxes, playerPanelX, scorePanelY, scorePanelSize, scorePanelSize, 'PLAYER');
    const enemyPanelX = x + width - scorePanelSize - 10;
    pushBox(boxes, enemyPanelX, scorePanelY, scorePanelSize, scorePanelSize, 'ENEMY');
    const roundsPanelX = playerPanelX + scorePanelSize + 10;
    const roundsPanelWidth = enemyPanelX - roundsPanelX - 10;
    pushBox(boxes, roundsPanelX, y + 4, roundsPanelWidth, height - 8, 'ROUNDS');
}

function pushStageMarkup(boxes, x, y, width, height) {
    pushBox(boxes, x, y, width, height, 'STAGE');
    const pad = 8;
    const gap = 8;
    const innerY = y + pad;
    const innerH = height - pad * 2;
    const sideW = Math.max(88, Math.floor(width * 0.28));
    const leftX = x + pad;
    const rightX = x + width - pad - sideW;
    const midX = leftX + sideW + gap;
    const midW = Math.max(72, rightX - midX - gap);
    pushBox(boxes, leftX, innerY, sideW, innerH, 'YOU');
    pushBox(boxes, midX, innerY, midW, innerH, 'RESULT');
    pushBox(boxes, rightX, innerY, sideW, innerH, 'ENEMY');
}

function pushStatusMarkup(boxes, x, y, width, height) {
    pushBox(boxes, x, y, width, height, 'STATUS');
    const pad = 10;
    const gap = 8;
    const innerX = x + pad;
    const innerY = y + pad;
    const innerW = width - pad * 2;
    const innerH = height - pad * 2;
    const effectsH = markupEffectsHeight(innerH);
    const mainH = innerH - effectsH - gap;
    pushBox(boxes, innerX, innerY, innerW, mainH, 'MAIN');
    pushEffectsMarkup(boxes, innerX, innerY + mainH + gap, innerW, effectsH);
}

function pushCurrentMoveMarkup(boxes, x, y, width, height, layout) {
    pushBox(boxes, x, y, width, height, 'MOVE');
    const pad = 8;
    const gap = 8;
    const panelContentY = y + pad;
    const panelContentHeight = height - pad * 2;
    const effectsH = markupEffectsHeight(panelContentHeight);
    const topH = panelContentHeight - effectsH - gap;
    const sideRatio = layout.sideColumnRatio || 0.22;
    const sidePanelWidth = Math.max(64, Math.floor(width * sideRatio));
    const leftPanelX = x + 10;
    pushBox(boxes, leftPanelX, panelContentY, sidePanelWidth, topH, 'READY');
    const enemyPanelX = x + width - sidePanelWidth - 10;
    pushBox(boxes, enemyPanelX, panelContentY, sidePanelWidth, topH, 'NEXT');
    const movePanelX = leftPanelX + sidePanelWidth + 10;
    const movePanelWidth = enemyPanelX - movePanelX - 10;
    pushBox(boxes, movePanelX, panelContentY, movePanelWidth, topH, 'MAIN');
    pushEffectsMarkup(boxes, x + 10, panelContentY + topH + gap, width - 20, effectsH);
}

function pushEffectsMarkup(boxes, x, y, width, height) {
    pushBox(boxes, x, y, width, height, 'EFFECTS');
    const labelW = 72;
    const pad = 6;
    const gap = 6;
    const count = UI_STAGE_MARKUP_EFFECTS.length;
    const areaX = x + labelW;
    const areaW = width - labelW - pad;
    const btnH = Math.max(28, height - pad * 2);
    const btnW = Math.max(28, Math.floor((areaW - gap * (count - 1)) / count));
    const startX = areaX + btnW / 2;
    const btnY = y + height / 2;
    UI_STAGE_MARKUP_EFFECTS.forEach((label, index) => {
        pushCentered(boxes, startX + (btnW + gap) * index, btnY, btnW, btnH, label);
    });
}

function pushThumbPlayMarkup(boxes, x, y, width, height, layout) {
    pushBox(boxes, x, y, width, height, 'PLAY');
    const pad = 10;
    const gap = 10;
    const goH = layout.goH;
    const moveH = layout.moveH;
    const cancelH = layout.cancelH;
    const stackH = goH + gap + moveH + gap + cancelH;
    const stackTop = y + height - pad - stackH;
    const goW = width - pad * 2;
    pushCentered(boxes, x + width / 2, stackTop + goH / 2, goW, goH, 'GO');

    const n = 3;
    const btnW = Math.floor((width - pad * 2 - gap * (n - 1)) / n);
    const startX = x + pad + btnW / 2;
    const moveY = stackTop + goH + gap + moveH / 2;
    pushCentered(boxes, startX, moveY, btnW, moveH, 'STONE');
    pushCentered(boxes, startX + btnW + gap, moveY, btnW, moveH, 'SCISSORS');
    pushCentered(boxes, startX + (btnW + gap) * 2, moveY, btnW, moveH, 'PAPER');

    const rowY = stackTop + goH + gap + moveH + gap + cancelH / 2;
    const halfW = Math.floor((width - pad * 2 - gap) / 2);
    pushCentered(boxes, x + pad + halfW / 2, rowY, halfW, cancelH, 'CANCEL');
    pushCentered(boxes, x + width - pad - halfW / 2, rowY, halfW, cancelH, 'BACK');
}

function pushTwoRowMarkup(boxes, x, y, width, height, layout) {
    pushBox(boxes, x, y, width, height, 'ACTIONS');
    const pad = 10;
    const gap = 8;
    const goH = layout.goH;
    const goW = layout.goW;
    const moveH = layout.moveH;
    const cancelH = layout.cancelH;
    const stackH = Math.max(goH, cancelH) + gap + moveH;
    const stackTop = y + height - pad - stackH;
    const topY = stackTop + Math.max(goH, cancelH) / 2;
    const cancelW = width - pad * 2 - gap - goW;
    pushCentered(boxes, x + pad + cancelW / 2, topY, cancelW, cancelH, 'CANCEL');
    pushCentered(boxes, x + width - pad - goW / 2, topY, goW, goH, 'GO');

    const n = 3;
    const btnW = Math.floor((width - pad * 2 - gap * (n - 1)) / n);
    const startX = x + pad + btnW / 2;
    const moveY = stackTop + Math.max(goH, cancelH) + gap + moveH / 2;
    pushCentered(boxes, startX, moveY, btnW, moveH, 'STONE');
    pushCentered(boxes, startX + btnW + gap, moveY, btnW, moveH, 'SCISSORS');
    pushCentered(boxes, startX + (btnW + gap) * 2, moveY, btnW, moveH, 'PAPER');
}

function pushGridMarkup(boxes, x, y, width, height, layout) {
    pushBox(boxes, x, y, width, height, 'ACTIONS');
    const pad = 10;
    const gap = 10;
    const tile = layout.moveH;
    const cancelH = layout.cancelH;
    const gridW = tile * 2 + gap;
    const gridH = tile * 2 + gap;
    const stackH = gridH + gap + cancelH;
    const stackTop = y + height - pad - stackH;
    const gridLeft = x + (width - gridW) / 2;
    const col1 = gridLeft + tile / 2;
    const col2 = gridLeft + tile + gap + tile / 2;
    const row1 = stackTop + tile / 2;
    const row2 = stackTop + tile + gap + tile / 2;
    pushCentered(boxes, col1, row1, tile, tile, 'STONE');
    pushCentered(boxes, col2, row1, tile, tile, 'SCISSORS');
    pushCentered(boxes, col1, row2, tile, tile, 'PAPER');
    pushCentered(boxes, col2, row2, tile, tile, 'GO');
    pushCentered(
        boxes,
        x + width / 2,
        stackTop + gridH + gap + cancelH / 2,
        Math.min(220, width - pad * 2),
        cancelH,
        'CANCEL'
    );
}

function markupEffectsHeight(availableHeight) {
    return Math.max(48, Math.min(64, Math.floor(availableHeight * 0.35)));
}

function pushBox(boxes, x, y, width, height, label) {
    boxes.push({ x: x, y: y, width: width, height: height, label: label });
}

function pushCentered(boxes, cx, cy, width, height, label) {
    pushBox(boxes, cx - width / 2, cy - height / 2, width, height, label);
}

function uiMenuMarkupBoxes(width, height) {
    const boxes = [];
    const btnW = UI.menuBtnW;
    const gap = 16;
    const specs = [
        { label: 'LOGIN', height: UI.menuBtnH },
        { label: 'REGISTER', height: UI.menuBtnH },
        { label: 'LOGOUT', height: UI.menuBtnH },
        { label: 'INVENTORY', height: UI.menuBtnH },
        { label: 'START GAME', height: UI.menuPrimaryH },
        { label: 'UI TESTS', height: UI.menuBtnH },
        { label: 'EXIT', height: UI.menuBtnH }
    ];
    const switcherH = UI.touchMin;
    const skinH = 28;
    const totalHeight = specs.reduce((sum, btn) => sum + btn.height, 0) + gap * (specs.length - 1);
    const buttonYStart = 120 + (height - 120 - switcherH - 24 - skinH - 12 - totalHeight) / 2;
    let y = buttonYStart;
    specs.forEach((btn) => {
        pushCentered(boxes, width / 2, y + btn.height / 2, btnW, btn.height, btn.label);
        y += btn.height + gap;
    });

    const chipW = 170;
    const chipGap = 8;
    const chipY = height - 16 - switcherH / 2;
    const skinY = chipY - switcherH / 2 - 10 - skinH / 2;
    pushCentered(boxes, width / 2 + 20, skinY, 88, skinH, 'SKIN');
    pushCentered(boxes, width / 2 - chipW / 2 - chipGap / 2, chipY, chipW, switcherH, 'LAYOUT');
    pushCentered(boxes, width / 2 + chipW / 2 + chipGap / 2, chipY, chipW, switcherH, 'FX');
    return boxes;
}

function createMarkupLayer(scene, boxes) {
    const layer = scene.add.container(0, 0);
    layer.setDepth(1000);
    const gfx = scene.add.graphics();
    gfx.lineStyle(2, 0x00ff66, 1);
    boxes.forEach((box) => {
        gfx.strokeRect(box.x, box.y, box.width, box.height);
    });
    layer.add(gfx);
    boxes.forEach((box) => {
        const label = scene.add.text(box.x + 4, box.y + 3, box.label, {
            font: '10px monospace',
            fill: '#00ff66'
        }).setOrigin(0, 0);
        layer.add(label);
    });
    return layer;
}

function createUiStageMarkup(scene, width, height) {
    const layout = (typeof UI !== 'undefined' && UI.layout) ? UI.layout : null;
    if (!scene || !layout) {
        return null;
    }
    return createMarkupLayer(scene, uiStageMarkupBoxes(width, height, layout));
}

function createUiMenuMarkup(scene, width, height) {
    if (!scene || typeof UI === 'undefined') {
        return null;
    }
    const layer = createMarkupLayer(scene, uiMenuMarkupBoxes(width, height));
    layer.setVisible(false);
    return layer;
}
