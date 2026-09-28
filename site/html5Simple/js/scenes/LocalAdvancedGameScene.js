/**
 * LocalAdvancedGameScene
 * Full-scene heat map with four stacked green frames.
 * Starts an extended best-of-5 match and sends the current stack as the move.
 * Item count is the extended size. Effect toggles match ExtendedGameScene.
 */
class LocalAdvancedGameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'LocalAdvancedGameScene' });
    }

    init() {
        exitTestsCanvas(this);
    }

    create() {
        exitTestsCanvas(this);
        console.log('[LocalAdvancedGameScene] create() started');
        fxEnter(this);
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        this.heatMap = new UiHeatMap(this, {
            x: 0,
            y: 0,
            width: width,
            height: height
        }, { interactive: false });
        const boxes = localAdvancedPanelBoxes(width, height);
        this.stageMarkup = createMarkupLayer(this, boxes);
        const currentTitle = this.stageMarkup.list.find((item) => item.text === 'current turn');
        if (currentTitle) {
            currentTitle.setOrigin(1, 0);
            currentTitle.setPosition(width - 4, currentTitle.y);
        }
        applyCompositeHeatMapDefault(this);
        const inventory = boxes.find((box) => box.label === 'inventory');
        const inventoryBottom = inventory.y + inventory.height;
        const inventoryRight = inventory.x + inventory.width;
        this.stone = createLocalAdvancedComposite(HotMapUiStone, this.heatMap, boxes, {
            x: inventoryRight,
            y: inventoryBottom
        });
        this.scissor = createLocalAdvancedComposite(HotMapUiScissor, this.heatMap, boxes, {
            x: inventory.x + inventory.width / 2,
            y: inventoryBottom
        });
        this.paper = createLocalAdvancedComposite(HotMapUiPaper, this.heatMap, boxes, {
            x: inventoryRight,
            y: inventoryBottom
        });
        const enemyBox = boxes.find((box) => box.label === 'enemy_data');
        const enemySpawn = {
            x: enemyBox.x + enemyBox.width / 2,
            y: enemyBox.y + 4
        };
        this.enemyStone = createLocalAdvancedComposite(HotMapUiStone, this.heatMap, boxes, enemySpawn, enemyBox);
        this.enemyScissor = createLocalAdvancedComposite(HotMapUiScissor, this.heatMap, boxes, enemySpawn, enemyBox);
        this.enemyPaper = createLocalAdvancedComposite(HotMapUiPaper, this.heatMap, boxes, enemySpawn, enemyBox);
        this.playerByType = {
            Stone: this.stone,
            Scissors: this.scissor,
            Paper: this.paper
        };
        this.enemyByType = {
            Stone: this.enemyStone,
            Scissors: this.enemyScissor,
            Paper: this.enemyPaper
        };
        this.panelBoxes = boxes;
        this.resultRods = [];
        this.createBackButton(width - UI.pad - UI.backW / 2, UI.pad + UI.backH / 2);
        this.selectedEffects = [];
        this.currentGameId = null;
        this.gameData = null;
        this._sending = false;
        this._deferHealth = false;
        this.createMatchReadout(boxes);
        this.createLocalAdvancedButtons(boxes);
        this.startMatch();
    }

    effectDefs() {
        return [
            { kind: 'NegateSize', label: 'NEG', category: 'size' },
            { kind: 'Overpower', label: 'OVER', category: 'size' },
            { kind: 'Protection', label: 'PROT', category: 'type' },
            { kind: 'SizeOnly', label: 'SIZE', category: 'type' }
        ];
    }

    async startMatch() {
        this.setStatus('Starting match...');
        try {
            if (typeof gameClient === 'undefined') {
                throw new Error('Game client not initialized');
            }
            const response = await gameClient.createGame({
                gameType: 'PVE',
                rounds: 'BO5',
                kind: 'extended',
                level: { name: 'Level1' },
                episode: { name: 'Episode1' }
            });
            if (!response.gameId) {
                throw new Error('No game ID returned');
            }
            this.currentGameId = response.gameId;
            this.gameData = await gameClient.getGame(response.gameId);
            this.refreshMatchReadout();
        } catch (error) {
            console.error('[LocalAdvancedGameScene] Failed to create game:', error);
            this.setStatus('Could not start match');
            this.showErrorModal('Failed to create game', error.message || 'An unexpected error occurred.');
        }
    }

    currentSelection() {
        const stacks = [
            { composite: this.stone, moveType: 'Stone' },
            { composite: this.scissor, moveType: 'Scissors' },
            { composite: this.paper, moveType: 'Paper' }
        ];
        const selected = stacks.find((stack) => stack.composite && stack.composite.parts.length > 0);
        if (!selected) {
            return null;
        }
        return {
            composite: selected.composite,
            moveType: selected.moveType,
            size: selected.composite.parts.length
        };
    }

    buildMoveAction(userId, moveType, size) {
        return {
            type: 'Move',
            context: {
                move: {
                    userId: userId,
                    context: {
                        moveType: moveType,
                        size: size,
                        decorId: 0,
                        effects: (this.selectedEffects || []).map((kind) => ({ kind }))
                    },
                    time: Date.now()
                }
            }
        };
    }

    async onGoPress() {
        if (this._sending || !this.goButton || !this.goButton.isEnabled) {
            return;
        }
        const selection = this.currentSelection();
        const user = this.registry.get('currentUser');
        if (!selection || !user?.id || !this.currentGameId) {
            this.showErrorModal('No Active Game', 'Please wait for the match to start.');
            return;
        }
        if (this.isMatchOver()) {
            return;
        }

        this._sending = true;
        this.refreshMoveButtons();
        this.setStatus(`Sending ${selection.moveType} ${selection.size}...`);
        try {
            const response = await gameClient.updateGame(
                this.currentGameId,
                this.buildMoveAction(user.id, selection.moveType, selection.size)
            );
            const statusLower = String(response.status || '').toLowerCase();
            if (statusLower === 'failed' || statusLower === 'error') {
                throw new Error(response.message || response.detail || 'The move could not be processed.');
            }
            this.gameData = response;
            this._deferHealth = true;
            this.refreshMatchReadout();
            await this.playMoveResult(user.id);
        } catch (error) {
            console.error('[LocalAdvancedGameScene] Failed to send move:', error);
            this.setStatus('Move failed');
            this.showErrorModal('Move Failed', error.message || 'An unexpected error occurred.');
            this.refreshMoveButtons();
        } finally {
            this._sending = false;
            if (this._deferHealth) {
                this._deferHealth = false;
                this.syncHealthBars();
            }
            this.refreshMoveButtons();
            this.refreshEffectButtons();
        }
    }

    latestExchange(userId) {
        const sub = SimpleGameSceneUtil.getLastCompletedSubRound(this.gameData);
        if (!sub) {
            return null;
        }
        const moves = sub.moves || [];
        const player = moves.find((move) => String(move.userId) === String(userId));
        const enemy = moves.find((move) => String(move.userId) !== String(userId));
        if (!player || !enemy) {
            return null;
        }
        return {
            playerType: player.context && player.context.moveType,
            enemyType: enemy.context && enemy.context.moveType,
            enemySize: enemy.context && typeof enemy.context.size === 'number' ? enemy.context.size : 0,
            winnerId: sub.winnerId || null
        };
    }

    async playMoveResult(userId) {
        const exchange = this.latestExchange(userId);
        if (!exchange || !exchange.enemyType) {
            this.placeResultRod();
            return;
        }
        const playerComposite = this.playerByType[exchange.playerType];
        const enemyComposite = this.enemyByType[exchange.enemyType];
        this.revealEnemyMove(exchange.enemyType, exchange.enemySize);
        await this.pause(LOCAL_ADVANCED_REVEAL_PAUSE);
        await Promise.all([
            this.playHorisontalPulse(),
            this.playUserFightPulse()
        ]);
        await this.pause(LOCAL_ADVANCED_CLASH_PAUSE);
        const playerWon = exchange.winnerId && String(exchange.winnerId) === String(userId);
        const enemyWon = exchange.winnerId && !playerWon;
        if (exchange.winnerId) {
            const loser = playerWon ? enemyComposite : playerComposite;
            await this.playRemoveAll(loser);
        }
        if (playerWon) {
            await this.playVerticalPulse('enemyPostMortemPulse');
            this.clearCompositeItems(playerComposite);
            await this.playPlayerVictoryPulse();
        } else if (enemyWon) {
            await this.playUserPostMortemPulse();
            this.clearCompositeItems(enemyComposite);
            await this.playEnemyVictoryPulse();
        }
    }

    playHorisontalPulse(name) {
        const enemy = (this.panelBoxes || []).find((box) => box.label === 'enemy_data');
        if (!enemy || !this.heatMap) {
            return Promise.resolve();
        }
        return new HorisontalPulse(this.heatMap, {
            panel: enemy,
            name: name || 'enemyBeginFightPulse'
        }).play();
    }

    playVerticalPulse(name) {
        const enemy = (this.panelBoxes || []).find((box) => box.label === 'enemy_data');
        if (!enemy || !this.heatMap) {
            return Promise.resolve();
        }
        return new VerticalPulse(this.heatMap, {
            panel: enemy,
            name: name || 'enemyPostMortemPulse'
        }).play();
    }

    playPlayerVictoryPulse() {
        const panel = (this.panelBoxes || []).find((box) => box.label === 'current turn');
        const target = hotHealthBarPoint(this.heatMap, this.enemyHealthBars, 'left');
        if (!panel || !target || !this.heatMap) {
            return Promise.resolve();
        }
        return new VictoryPulse(this.heatMap, {
            name: 'playerVictoryPulse',
            start: {
                x: panel.x + panel.width / 2,
                y: panel.y + panel.height
            },
            end: { x: target.x, y: target.y },
            startWidth: panel.width,
            endWidth: target.width
        }).play();
    }

    playEnemyVictoryPulse() {
        const panel = (this.panelBoxes || []).find((box) => box.label === 'enemy_data');
        const target = hotHealthBarPoint(this.heatMap, this.healthBars, 'right');
        if (!panel || !target || !this.heatMap) {
            return Promise.resolve();
        }
        return new VictoryPulse(this.heatMap, {
            name: 'enemyVictoryPulse',
            start: {
                x: panel.x + panel.width / 2,
                y: panel.y + panel.height
            },
            end: { x: target.x, y: target.y },
            startWidth: panel.width,
            endWidth: target.width
        }).play();
    }

    playUserFightPulse() {
        const panel = (this.panelBoxes || []).find((box) => box.label === 'current turn');
        if (!panel || !this.heatMap) {
            return Promise.resolve();
        }
        return new HorisontalPulse(this.heatMap, {
            panel: panel,
            name: 'userBeginFightPulse',
            from: 'top',
            exit: 1.3
        }).play();
    }

    playUserPostMortemPulse() {
        const panel = (this.panelBoxes || []).find((box) => box.label === 'current turn');
        if (!panel || !this.heatMap) {
            return Promise.resolve();
        }
        return new VerticalPulse(this.heatMap, {
            panel: panel,
            name: 'userPostMortemPulse',
            from: 'left',
            exit: 1.3
        }).play();
    }

    revealEnemyMove(moveType, size) {
        const composite = this.enemyByType[moveType];
        if (!composite) {
            return;
        }
        while (composite.parts.length > 0) {
            composite.removeItem();
        }
        const shown = Math.min(Math.max(0, size), localAdvancedMax(moveType));
        for (let index = 0; index < shown; index += 1) {
            composite.addItem();
        }
    }

    clearCompositeItems(composite) {
        if (!composite) {
            return;
        }
        while (composite.parts.length > 0) {
            composite.removeItem();
        }
    }

    async playRemoveAll(composite) {
        while (composite && composite.parts.length > 0) {
            composite.removeItem();
            await this.pause(LOCAL_ADVANCED_REMOVE_PAUSE);
        }
    }

    placeResultRod() {
        const enemy = (this.panelBoxes || []).find((box) => box.label === 'enemy_data');
        if (!enemy || !this.heatMap) {
            return;
        }
        const inset = 12;
        const step = 14;
        const maxOffset = Math.max(0, enemy.height - inset * 2 - 20);
        const offset = Math.min(this.resultRods.length * step, maxOffset);
        const y = enemy.y + enemy.height - inset - offset;
        const cell = heatMapCellAt(this.heatMap, enemy.x + enemy.width / 2, y);
        const rod = new UiHotRod(this.heatMap, {
            name: `Result ${this.resultRods.length + 1}`,
            start: { col: cell.col, row: cell.row },
            end: { col: cell.col, row: cell.row },
            startAngle: 0,
            endAngle: 0,
            loopOn: false
        });
        this.resultRods.push(rod);
    }

    pause(ms) {
        return new Promise((resolve) => {
            if (!this.sys || !this.sys.isActive()) {
                resolve();
                return;
            }
            this.time.delayedCall(ms, resolve);
        });
    }

    clearSelection(composite) {
        if (!composite) {
            return;
        }
        while (composite.parts.length > 0) {
            composite.removeItem();
        }
    }

    isMatchOver() {
        return typeof SimpleGameSceneUtil !== 'undefined'
            && SimpleGameSceneUtil.isGameFinished(this.gameData);
    }

    onSelectEffect(kind, category) {
        if (this.isMatchOver() || this._sending) {
            return;
        }
        const selected = this.selectedEffects || [];
        if (selected.includes(kind)) {
            this.selectedEffects = selected.filter((item) => item !== kind);
        } else {
            const defs = this.effectDefs();
            this.selectedEffects = selected.filter((item) => {
                const def = defs.find((entry) => entry.kind === item);
                return def && def.category !== category;
            });
            this.selectedEffects.push(kind);
        }
        this.refreshEffectButtons();
    }

    refreshEffectButtons() {
        const selected = this.selectedEffects || [];
        const over = this.isMatchOver() || this._sending;
        (this.effectButtons || []).forEach((btn) => {
            this.setGreenButtonEnabled(btn, !over);
            this.setGreenButtonSelected(btn, selected.includes(btn.effectKind));
        });
    }

    setStatus(text) {
        if (this.statusText) {
            this.statusText.setText(text);
        }
    }

    refreshMatchReadout() {
        const user = this.registry.get('currentUser');
        const userId = user?.id;
        const scores = SimpleGameSceneUtil.calculateScore(this.gameData, userId);
        const over = this.isMatchOver();
        if (this.scoreText) {
            const suffix = over ? '  ·  match over' : '';
            this.scoreText.setText(`you ${scores.playerScore}  —  enemy ${scores.enemyScore}${suffix}`);
        }
        const stage = SimpleGameSceneUtil.getLastSubRoundStage(this.gameData, userId);
        if (this.enemyReadout) {
            this.enemyReadout.setText(`you  ${stage.playerMove}\nenemy  ${stage.enemyMove}\n${stage.result}`);
        }
        const selection = this.currentSelection();
        if (this._sending) {
            if (stage.result && stage.result !== 'WAIT') {
                this.setStatus(stage.result);
            } else if (selection) {
                this.setStatus(`Sending ${selection.moveType} ${selection.size}...`);
            }
        } else if (over) {
            this.setStatus('Match over');
        } else if (selection) {
            this.setStatus(`${selection.moveType} ${selection.size} ready — tap go`);
        } else if (this.currentGameId) {
            this.setStatus('Pick stone, scissors, or paper');
        }
        this.refreshMoveButtons();
        this.refreshEffectButtons();
        this.syncHealthBars();
    }

    gameRounds() {
        const context = this.gameData
            && this.gameData.payload
            && this.gameData.payload.gameContext
            && this.gameData.payload.gameContext.initGameContext;
        return (context && context.rounds) || 'BO5';
    }

    clearHealthBars() {
        this.removeHealthBars(this.healthBars);
        this.removeHealthBars(this.enemyHealthBars);
        this.healthBars = [];
        this.enemyHealthBars = [];
    }

    removeHealthBars(bars) {
        (bars || []).forEach((bar) => {
            if (bar && bar.emitter && this.heatMap) {
                this.heatMap.removeHighlighter(bar.emitter);
            }
        });
    }

    syncHealthBars() {
        const score = (this.panelBoxes || []).find((box) => box.label === 'score');
        if (!score) {
            return;
        }
        const count = localAdvancedLossBars(this.gameRounds());
        const playerReady = this.healthBars && this.healthBars.length === count;
        const enemyReady = this.enemyHealthBars && this.enemyHealthBars.length === count;
        if (!playerReady || !enemyReady) {
            this.clearHealthBars();
            this.createHealthBars(score, count);
        }
        if (this._deferHealth) {
            return;
        }
        this.updateHealthBar();
    }

    createHealthBars(score, count) {
        const layout = localAdvancedHealthLayout(score, count, this.heatMap);
        this.healthBars = this.placeHealthBars(layout, 'Health', false);
        this.enemyHealthBars = this.placeHealthBars(layout, 'Enemy health', true);
    }

    placeHealthBars(layout, name, mirrored) {
        const bars = [];
        for (let index = 0; index < layout.count; index += 1) {
            const t = layout.count === 1 ? 0 : index / (layout.count - 1);
            const heat = layout.hot - (layout.hot - layout.cool) * t;
            const lit = { width: layout.cellW, height: layout.cellH, angle: 0, skew: 0, heat: heat };
            const dim = { width: layout.cellW, height: layout.cellH, angle: 0, skew: 0, heat: 0 };
            const step = index * (layout.barW + layout.gap);
            const x = mirrored
                ? layout.right - layout.barW / 2 - step
                : layout.left + layout.barW / 2 + step;
            const cell = heatMapCellAt(this.heatMap, x, layout.y);
            const bar = new UiBackHighlighter(this.heatMap, {
                name: `${name} ${index + 1}`,
                center: cell,
                target: cell,
                cycling: false,
                from: lit,
                to: dim,
                params: { speed: 2.4, delay: 0.2, gap: 0 }
            });
            bar.armHover();
            bar._faded = false;
            bars.push(bar);
        }
        return bars;
    }

    updateHealthBar() {
        const user = this.registry.get('currentUser');
        const scores = SimpleGameSceneUtil.calculateScore(this.gameData, user && user.id);
        this.fadeHealthBars(this.healthBars, scores.enemyScore);
        this.fadeHealthBars(this.enemyHealthBars, scores.playerScore);
    }

    fadeHealthBars(bars, losses) {
        if (!bars || !bars.length) {
            return;
        }
        const alive = Math.max(0, bars.length - losses);
        bars.forEach((bar, index) => {
            if (index < alive || bar._faded) {
                return;
            }
            bar.setHovered(true);
            bar._faded = true;
        });
    }

    showErrorModal(title, message) {
        this.scene.launch('ErrorModalScene', {
            errorTitle: title,
            errorMessage: message
        });
    }

    createMatchReadout(boxes) {
        const score = boxes.find((box) => box.label === 'score');
        const enemy = boxes.find((box) => box.label === 'enemy_data');
        this.syncHealthBars();
        const textStyle = {
            font: `${UI.body}px monospace`,
            fill: '#00ff66',
            wordWrap: { width: score.width - 16 }
        };
        this.scoreText = this.add.text(score.x + 8, score.y + 46, 'you 0  —  enemy 0', textStyle).setOrigin(0, 0);
        this.scoreText.setDepth(1100);
        this.statusText = this.add.text(score.x + 8, score.y + 46 + UI.body + 8, 'Starting match...', {
            font: `${UI.small}px monospace`,
            fill: '#00ff66',
            wordWrap: { width: score.width - 16 }
        }).setOrigin(0, 0);
        this.statusText.setDepth(1100);

        const defs = this.effectDefs();
        const gap = 8;
        const inset = 8;
        const btnH = 28;
        const btnW = Math.floor((score.width - inset * 2 - gap * (defs.length - 1)) / defs.length);
        const btnY = score.y + score.height - inset - btnH / 2;
        this.effectButtons = defs.map((def, index) => {
            const btn = this.createGreenButton(
                score.x + inset + btnW / 2 + index * (btnW + gap),
                btnY,
                btnW,
                btnH,
                def.label,
                () => this.onSelectEffect(def.kind, def.category)
            );
            btn.effectKind = def.kind;
            btn.effectCategory = def.category;
            return btn;
        });

        this.enemyReadout = this.add.text(enemy.x + 8, enemy.y + 22, 'you  —\nenemy  —\nWAIT', {
            font: `${UI.body}px monospace`,
            fill: '#00ff66',
            wordWrap: { width: enemy.width - 16 }
        }).setOrigin(0, 0);
        this.enemyReadout.setDepth(1100);
    }

    onStonePress() {
        this.addCompositeItem(this.stone, LOCAL_ADVANCED_STONE_MAX);
    }

    onScissorsPress() {
        this.addCompositeItem(this.scissor, LOCAL_ADVANCED_SCISSOR_MAX);
    }

    onPaperPress() {
        this.addCompositeItem(this.paper, LOCAL_ADVANCED_PAPER_MAX);
    }

    addCompositeItem(composite, maxItems) {
        if (!composite || composite.parts.length >= maxItems) {
            return;
        }
        composite.addItem();
        this.refreshMatchReadout();
    }

    onCancelPress() {
        const composite = [this.stone, this.scissor, this.paper].find((item) => item && item.parts.length > 0);
        if (!composite) {
            return;
        }
        composite.removeItem();
        this.refreshMatchReadout();
    }

    refreshMoveButtons() {
        const counts = {
            stone: this.stone ? this.stone.parts.length : 0,
            scissors: this.scissor ? this.scissor.parts.length : 0,
            paper: this.paper ? this.paper.parts.length : 0
        };
        const limits = {
            stone: LOCAL_ADVANCED_STONE_MAX,
            scissors: LOCAL_ADVANCED_SCISSOR_MAX,
            paper: LOCAL_ADVANCED_PAPER_MAX
        };
        Object.keys(this.moveButtons || {}).forEach((key) => {
            const othersHaveItems = Object.keys(counts).some((other) => other !== key && counts[other] > 0);
            const atLimit = counts[key] >= limits[key];
            this.setGreenButtonEnabled(this.moveButtons[key], !othersHaveItems && !atLimit);
        });
        const anyItems = counts.stone + counts.scissors + counts.paper > 0;
        const locked = this.isMatchOver() || this._sending || !this.currentGameId;
        Object.keys(this.moveButtons || {}).forEach((key) => {
            if (locked) {
                this.setGreenButtonEnabled(this.moveButtons[key], false);
            }
        });
        this.setGreenButtonEnabled(this.cancelButton, anyItems && !locked);
        this.setGreenButtonEnabled(this.goButton, anyItems && !locked);
    }

    setGreenButtonEnabled(btn, enabled) {
        if (!btn) {
            return;
        }
        btn.isEnabled = enabled;
        this.paintGreenButton(btn);
        btn.buttonText.setColor(enabled ? (btn.isSelected ? '#ffffff' : '#00ff66') : '#3a5a48');
        if (btn.input) {
            btn.input.cursor = enabled ? 'pointer' : 'default';
        }
    }

    setGreenButtonSelected(btn, selected) {
        if (!btn) {
            return;
        }
        btn.isSelected = selected;
        this.paintGreenButton(btn);
        if (btn.isEnabled) {
            btn.buttonText.setColor(selected ? '#ffffff' : '#00ff66');
        }
    }

    paintGreenButton(btn) {
        const bg = btn.buttonBg;
        bg.clear();
        if (btn.isSelected && btn.isEnabled) {
            bg.fillStyle(0x00ff66, 0.28);
            bg.fillRect(-btn.buttonWidth / 2, -btn.buttonHeight / 2, btn.buttonWidth, btn.buttonHeight);
        }
        bg.lineStyle(2, btn.isEnabled ? 0x00ff66 : 0x3a5a48, 1);
        bg.strokeRect(-btn.buttonWidth / 2, -btn.buttonHeight / 2, btn.buttonWidth, btn.buttonHeight);
    }

    createLocalAdvancedButtons(boxes) {
        const control = boxes.find((box) => box.label === 'control');
        const selection = boxes.find((box) => box.label === 'selection');
        if (control) {
            const row = panelButtonRow(control);
            const goW = 72;
            const cancelW = 108;
            this.goButton = this.createGreenButton(
                control.x + row.inset + goW / 2,
                row.y,
                goW,
                row.height,
                'go',
                () => this.onGoPress()
            );
            this.setGreenButtonEnabled(this.goButton, false);
            this.cancelButton = this.createGreenButton(
                control.x + control.width - row.inset - cancelW / 2,
                row.y,
                cancelW,
                row.height,
                'cancel',
                () => this.onCancelPress()
            );
            this.setGreenButtonEnabled(this.cancelButton, false);
        }
        if (selection) {
            const row = panelButtonRow(selection);
            const labels = ['stone', 'scissors', 'paper'];
            const presses = {
                stone: () => this.onStonePress(),
                scissors: () => this.onScissorsPress(),
                paper: () => this.onPaperPress()
            };
            const gap = 8;
            const btnW = Math.floor((selection.width - row.inset * 2 - gap * (labels.length - 1)) / labels.length);
            this.moveButtons = {};
            labels.forEach((label, index) => {
                this.moveButtons[label] = this.createGreenButton(
                    selection.x + row.inset + btnW / 2 + index * (btnW + gap),
                    row.y,
                    btnW,
                    row.height,
                    label,
                    presses[label]
                );
            });
            this.refreshMoveButtons();
        }
    }

    createGreenButton(x, y, width, height, label, onClick) {
        const btn = this.add.container(x, y);
        btn.setDepth(1100);
        const bg = this.add.graphics();
        bg.lineStyle(2, 0x00ff66, 1);
        bg.strokeRect(-width / 2, -height / 2, width, height);
        const text = this.add.text(0, 0, label, {
            font: `${UI.body}px monospace`,
            fill: '#00ff66'
        }).setOrigin(0.5);
        btn.add([bg, text]);
        btn.buttonText = text;
        btn.buttonBg = bg;
        btn.buttonWidth = width;
        btn.buttonHeight = height;
        btn.isEnabled = true;

        const hitArea = new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height);
        btn.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains, { useHandCursor: true });
        bindPress(this, btn, {
            tapFx: 'none',
            isEnabled: () => btn.isEnabled,
            onClick: onClick
        });
        return btn;
    }

    update(time, delta) {
        if (this.heatMap && typeof this.heatMap.update === 'function') {
            this.heatMap.update(time, delta);
        }
    }

    createBackButton(x, y) {
        const width = UI.backW;
        const height = UI.backH;
        const btn = this.add.container(x, y);
        btn.setDepth(1100);
        const bg = this.add.graphics();
        bg.lineStyle(2, 0x00ff66, 1);
        bg.strokeRect(-width / 2, -height / 2, width, height);
        const text = this.add.text(0, 0, 'BACK', {
            font: `${UI.body}px monospace`,
            fill: '#00ff66'
        }).setOrigin(0.5);
        btn.add([bg, text]);

        const hitArea = new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height);
        btn.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains, { useHandCursor: true });
        bindPress(this, btn, {
            tapFx: 'none',
            onClick: () => fxGoTo(this, 'GameSelectScene')
        });
        return btn;
    }
}

function localAdvancedPanelBoxes(width, height) {
    const panels = [
        { label: 'score', share: 0.25 },
        { label: 'enemy_data', share: 0.25 },
        { label: 'current turn', share: 0.35 },
        { label: 'inventory', share: 0.15 }
    ];
    const boxes = [];
    let y = 0;
    panels.forEach((panel) => {
        const panelH = height * panel.share;
        const box = {
            x: 0,
            y: y,
            width: width,
            height: panelH,
            label: panel.label
        };
        boxes.push(box);
        if (panel.label === 'current turn') {
            const innerH = panelH * 0.2;
            const pad = 8;
            boxes.push({
                x: pad,
                y: y + pad,
                width: width - pad * 2,
                height: innerH,
                label: 'control'
            });
            boxes.push({
                x: pad,
                y: y + panelH - pad - innerH,
                width: width - pad * 2,
                height: innerH,
                label: 'selection'
            });
        }
        y += panelH;
    });
    return boxes;
}

const LOCAL_ADVANCED_STONE_MAX = 9;
const LOCAL_ADVANCED_SCISSOR_MAX = 4;
const LOCAL_ADVANCED_PAPER_MAX = 8;
const LOCAL_ADVANCED_REVEAL_PAUSE = 5000;
const LOCAL_ADVANCED_CLASH_PAUSE = 2000;
const LOCAL_ADVANCED_REMOVE_PAUSE = 320;

function localAdvancedRoundCount(rounds) {
    const match = String(rounds || '').match(/(\d+)/);
    return match ? Number(match[1]) : 5;
}

function localAdvancedLossBars(rounds) {
    return Math.max(1, Math.trunc(localAdvancedRoundCount(rounds) / 2) + 1);
}

function localAdvancedHealthLayout(score, count, heatMap) {
    const inset = 8;
    const backReserve = UI.pad + UI.backW + inset;
    const middleGap = 48;
    const available = Math.max(0, score.width - inset - backReserve - middleGap);
    const total = Math.min(score.width * 0.4, available / 2);
    const gapRatio = 0.55;
    const barW = total / (count + Math.max(0, count - 1) * gapRatio);
    const gap = barW * gapRatio;
    return {
        count: count,
        barW: barW,
        gap: gap,
        y: score.y + 20,
        cellW: heatMapCellSpan(heatMap, barW, 'col'),
        cellH: Math.max(4, heatMapCellSpan(heatMap, Math.min(12, barW * 0.4), 'row')),
        hot: 3,
        cool: 0.8,
        left: score.x + inset,
        right: score.x + score.width - backReserve
    };
}

function heatMapCellSpan(heatMap, pixels, axis) {
    const field = heatMap.field;
    const bounds = heatMap.bounds;
    const vertical = axis === 'row';
    const span = vertical ? field.rows - 1 : field.cols - 1;
    const size = vertical ? bounds.height : bounds.width;
    return (pixels / Math.max(size, 1)) * span;
}

function localAdvancedMax(moveType) {
    if (moveType === 'Scissors') {
        return LOCAL_ADVANCED_SCISSOR_MAX;
    }
    if (moveType === 'Paper') {
        return LOCAL_ADVANCED_PAPER_MAX;
    }
    return LOCAL_ADVANCED_STONE_MAX;
}

function createLocalAdvancedComposite(Ctor, heatMap, boxes, spawnPixel, centerBox) {
    const current = centerBox || boxes.find((box) => box.label === 'current turn');
    const center = heatMapCellAt(
        heatMap,
        current.x + current.width / 2,
        current.y + current.height / 2
    );
    const spawnPoint = heatMapCellAt(heatMap, spawnPixel.x, spawnPixel.y);
    return new Ctor(heatMap, {
        center: center,
        spawn: {
            col: spawnPoint.col - center.col,
            row: spawnPoint.row - center.row
        }
    });
}

function hotHealthBarPoint(heatMap, bars, edge) {
    if (!heatMap || !bars || !bars.length) {
        return null;
    }
    const pickLeft = edge !== 'right';
    const field = heatMap.field;
    const bounds = heatMap.bounds;
    const colSpan = Math.max(field.cols - 1, 1);
    const rowSpan = Math.max(field.rows - 1, 1);
    let best = null;
    bars.forEach((bar) => {
        if (!bar || bar._faded) {
            return;
        }
        const cell = bar.emitter && bar.emitter.target;
        const pose = bar.emitter && bar.emitter.from;
        if (!cell || !pose) {
            return;
        }
        const point = {
            x: bounds.x + (cell.col / colSpan) * bounds.width,
            y: bounds.y + (cell.row / rowSpan) * bounds.height,
            width: (pose.width / colSpan) * bounds.width
        };
        if (!best || (pickLeft ? point.x < best.x : point.x > best.x)) {
            best = point;
        }
    });
    return best;
}

function heatMapCellAt(heatMap, x, y) {
    const field = heatMap.field;
    const bounds = heatMap.bounds;
    const localX = x - bounds.x;
    const localY = y - bounds.y;
    return {
        col: (localX / Math.max(bounds.width, 1)) * (field.cols - 1),
        row: (localY / Math.max(bounds.height, 1)) * (field.rows - 1)
    };
}

function panelButtonRow(panel) {
    const labelH = 16;
    const inset = 6;
    const height = Math.max(24, panel.height - labelH - inset);
    return {
        inset: inset,
        height: height,
        y: panel.y + labelH + height / 2
    };
}
