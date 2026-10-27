/**
 * LocalAdvancedGameScene
 * Full-scene heat map with four stacked green frames.
 * Starts an extended best-of-5 match and sends the current stack as the move.
 * Item count is the extended size. Paper is a New Paper stack. NEG and SIZE are one toggle.
 * Choosing an NA effect (NEG) drops that stack to one item, hides it, and shows its prime.
 * Clearing NEG removes the prime and shows the normal composite again. Adds stay blocked while NEG is on.
 * Choosing an NT effect (SIZE) hides that stack and shows a Core on the same center.
 * The Core has one ball for each stack item. Adds and removes change the hidden stack and the Core together.
 * That Core's round starts bright and fades once. Clearing SIZE removes the Core and shows the normal composite again.
 * Sending an NA turn keeps that prime up and the selected stack hidden. The result takes the gesture item off the prime.
 * Sending an NT turn keeps that Core up and the selected stack hidden. The result takes balls off the Core.
 * A finished match opens AdvancedGameResultsScene. OK there returns to the main menu.
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
        const enemyBox = boxes.find((box) => box.label === 'enemy_data');
        const enemySpawn = {
            x: enemyBox.x + enemyBox.width / 2,
            y: enemyBox.y + 4
        };
        this.panelBoxes = boxes;
        this.compositeSpecs = [
            { key: 'stone', Ctor: HotMapUiStone, spawn: { x: inventoryRight, y: inventoryBottom } },
            {
                key: 'scissor',
                Ctor: HotMapUiScissor,
                spawn: { x: inventory.x + inventory.width / 2, y: inventoryBottom }
            },
            { key: 'paper', Ctor: HotMapUiNewPaper, spawn: { x: inventoryRight, y: inventoryBottom } },
            { key: 'enemyStone', Ctor: HotMapUiStone, spawn: enemySpawn, centerBox: enemyBox },
            { key: 'enemyScissor', Ctor: HotMapUiScissor, spawn: enemySpawn, centerBox: enemyBox },
            { key: 'enemyPaper', Ctor: HotMapUiNewPaper, spawn: enemySpawn, centerBox: enemyBox }
        ];
        this.compositeSpecs.forEach((spec) => {
            this[spec.key] = createLocalAdvancedComposite(
                spec.Ctor,
                this.heatMap,
                this.panelBoxes,
                spec.spawn,
                spec.centerBox
            );
        });
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
        this.resultRods = [];
        this.createBackButton(width - UI.pad - UI.backW / 2, UI.pad + UI.backH / 2);
        this.selectedEffects = [];
        this.currentGameId = null;
        this.gameData = null;
        this._sending = false;
        this._deferHealth = false;
        this.healthBars = null;
        this.enemyHealthBars = null;
        this.createMatchReadout(boxes);
        this.createInventoryReadout(boxes);
        this.createLocalAdvancedButtons(boxes);
        this.startMatch();
    }

    effectDefs() {
        return [
            { kind: 'NegateSize', label: 'NEG', category: 'effect' },
            { kind: 'SizeOnly', label: 'SIZE', category: 'effect' }
        ];
    }

    async startMatch() {
        const field = this.heatMap && this.heatMap.field;
        const abort = this.abortOnShutdown();
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
            }, { signal: abort.signal });
            if (!this.fieldLive(field)) {
                return;
            }
            if (!response.gameId) {
                throw new Error('No game ID returned');
            }
            this.currentGameId = response.gameId;
            this.gameData = await gameClient.getGame(response.gameId, { signal: abort.signal });
            if (!this.fieldLive(field)) {
                return;
            }
            this.refreshMatchReadout();
        } catch (error) {
            if (!this.fieldLive(field)) {
                return;
            }
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
        const selected = stacks.find((stack) => activePartCount(stack.composite) > 0);
        if (!selected) {
            return null;
        }
        return {
            composite: selected.composite,
            moveType: selected.moveType,
            size: activePartCount(selected.composite)
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
        const cap = this.turnCap(selection.moveType);
        if (selection.size > cap) {
            this.showErrorModal('Move not allowed', `${selection.moveType} size ${selection.size} exceeds the turn cap ${cap}.`);
            return;
        }

        const field = this.heatMap && this.heatMap.field;
        const abort = this.abortOnShutdown();
        this._sending = true;
        this._openResults = false;
        this.refreshMoveButtons();
        this.setStatus(`Sending ${selection.moveType} ${selection.size}...`);
        try {
            const response = await gameClient.updateGame(
                this.currentGameId,
                this.buildMoveAction(user.id, selection.moveType, selection.size),
                { signal: abort.signal }
            );
            if (!this.fieldLive(field)) {
                return;
            }
            const statusLower = String(response.status || '').toLowerCase();
            if (statusLower === 'failed' || statusLower === 'error') {
                throw new Error(response.message || response.detail || 'The move could not be processed.');
            }
            this.gameData = response;
            this._deferHealth = true;
            this.refreshMatchReadout();
            await this.playMoveResult(user.id);
            if (!this.fieldLive(field)) {
                return;
            }
            this.selectedEffects = [];
            if (this.isMatchOver()) {
                this._openResults = true;
            }
        } catch (error) {
            if (!this.fieldLive(field)) {
                return;
            }
            console.error('[LocalAdvancedGameScene] Failed to send move:', error);
            this.setStatus('Move failed');
            this.showErrorModal('Move Failed', error.message || 'An unexpected error occurred.');
            this.refreshMoveButtons();
        } finally {
            if (!this.fieldLive(field)) {
                return;
            }
            this._sending = false;
            if (this._deferHealth) {
                this._deferHealth = false;
                this.syncHealthBars();
            }
            this.refreshMoveButtons();
            this.refreshEffectButtons();
            if (this._openResults) {
                this.openAdvancedResults();
            }
        }
    }

    openAdvancedResults() {
        fxGoTo(this, 'AdvancedGameResultsScene', { gameData: this.gameData }, { flash: true });
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

    fieldLive(field) {
        return !!(field && field.destroyed !== true && this.heatMap && this.heatMap.field === field);
    }

    abortOnShutdown() {
        const abort = new AbortController();
        this.events.once('shutdown', () => abort.abort());
        return abort;
    }

    fieldWait(ms) {
        const field = this.heatMap && this.heatMap.field;
        return heatFieldWait(field, ms / 1000);
    }

    async finishRun(run, field) {
        if (!this.fieldLive(field)) {
            return false;
        }
        if (!run || !run.finished) {
            return this.fieldLive(field);
        }
        const result = await run.finished;
        if (!this.fieldLive(field)) {
            return false;
        }
        return !!(result && result.status === 'finished');
    }

    async playMoveResult(userId) {
        this.holdNtCoreForTurn();
        const field = this.heatMap && this.heatMap.field;
        if (!this.fieldLive(field)) {
            return;
        }
        const exchange = this.latestExchange(userId);
        if (!exchange || !exchange.enemyType) {
            this.placeResultRod();
            return;
        }
        const playerComposite = this.playerByType[exchange.playerType];
        const enemyComposite = this.enemyByType[exchange.enemyType];
        this.resetEnemyBoards();
        const shown = Math.min(
            Math.max(0, exchange.enemySize),
            this.turnCap(exchange.enemyType)
        );
        let emptySweep = null;
        if (shown === 0 && enemyComposite) {
            this.setStatus(`Enemy ${exchange.enemyType} 0`);
            emptySweep = this.playHorisontalPulse('enemyEmptyPulse');
        } else if (enemyComposite && !(await this.finishRun(enemyComposite.reveal(shown), field))) {
            return;
        }
        if (!(await this.finishRun(this.fieldWait(LOCAL_ADVANCED_REVEAL_PAUSE), field))) {
            return;
        }
        if (emptySweep && !(await this.finishRun(emptySweep, field))) {
            return;
        }
        const fight = await Promise.all([
            this.finishRun(this.playHorisontalPulse(), field),
            this.finishRun(this.playUserFightPulse(), field)
        ]);
        if (fight.some((ok) => !ok)) {
            return;
        }
        if (!(await this.finishRun(this.fieldWait(LOCAL_ADVANCED_CLASH_PAUSE), field))) {
            return;
        }
        const playerWon = exchange.winnerId && String(exchange.winnerId) === String(userId);
        const enemyWon = exchange.winnerId && !playerWon;
        if (exchange.winnerId) {
            const loser = playerWon ? enemyComposite : playerComposite;
            const winner = playerWon ? playerComposite : enemyComposite;
            const sameType = exchange.playerType === exchange.enemyType;
            const loserExit = this.dramaticClear(loser);
            const winnerExit = sameType
                ? this.dramaticClear(winner, loserExit.removed)
                : heatDoneRun();
            const cleared = await Promise.all([
                this.finishRun(loserExit, field),
                this.finishRun(winnerExit, field)
            ]);
            if (cleared.some((ok) => !ok)) {
                return;
            }
        } else {
            const cleared = await Promise.all([
                this.finishRun(this.dramaticClear(playerComposite), field),
                this.finishRun(this.dramaticClear(enemyComposite), field)
            ]);
            if (cleared.some((ok) => !ok)) {
                return;
            }
        }
        if (playerWon) {
            if (!(await this.finishRun(this.playVerticalPulse('enemyPostMortemPulse'), field))) {
                return;
            }
            if (this.fieldLive(field) && playerComposite) {
                playerComposite.reset({ items: 'spec' });
                this.syncShownNtCore(playerComposite);
            }
            await this.finishRun(this.playPlayerVictoryPulse(), field);
        } else if (enemyWon) {
            if (!(await this.finishRun(this.playUserPostMortemPulse(), field))) {
                return;
            }
            if (this.fieldLive(field) && enemyComposite) {
                enemyComposite.reset({ items: 'spec' });
            }
            await this.finishRun(this.playEnemyVictoryPulse(), field);
        }
    }

    dramaticClear(composite, count) {
        if (this.ntCore && this.ntCoreSource === composite) {
            return this.clearShownStandIn(composite, this.ntCore, count);
        }
        if (this.naPrime && this.naPrimeSource === composite) {
            return this.clearShownStandIn(composite, this.naPrime, count);
        }
        if (!composite || typeof composite.removeWithDrama !== 'function') {
            const run = heatDoneRun();
            run.removed = 0;
            return run;
        }
        return composite.removeWithDrama(count);
    }

    clearShownStandIn(composite, standIn, count) {
        const available = activePartCount(composite);
        const limit = count == null ? available : Math.min(available, Math.max(0, count | 0));
        const starts = [];
        for (let index = 0; index < limit; index += 1) {
            starts.push(() => {
                if (composite && typeof composite.removeItem === 'function') {
                    composite.removeItem();
                }
                setCompositeShown(composite, false);
                if (standIn && typeof standIn.removeItem === 'function') {
                    standIn.removeItem();
                }
            });
        }
        if (!standIn) {
            const run = heatDoneRun();
            run.removed = 0;
            return run;
        }
        return heatStaggerDramas(standIn, starts);
    }

    holdNtCoreForTurn() {
        if (this._sending && this.ntCore) {
            this.removeNaPrime();
            setCompositeShown(this.ntCoreSource, false);
            return;
        }
        if (this._sending && this.naPrime) {
            setCompositeShown(this.naPrimeSource, false);
            return;
        }
        this.dismissNaPrime();
    }

    syncShownNtCore(composite) {
        if (this.ntCore && this.ntCoreSource === composite) {
            setCompositeShown(composite, false);
            syncNtCoreCount(this.ntCore, activePartCount(composite));
        }
        if (this.naPrime && this.naPrimeSource === composite) {
            setCompositeShown(composite, false);
            syncNaPrimeCount(this.naPrime, activePartCount(composite));
        }
    }

    resetEnemyBoards() {
        [this.enemyStone, this.enemyScissor, this.enemyPaper].forEach((group) => {
            if (group && typeof group.reset === 'function') {
                group.reset({ items: 'spec' });
            }
        });
    }

    playHorisontalPulse(name) {
        const enemy = (this.panelBoxes || []).find((box) => box.label === 'enemy_data');
        if (!enemy || !this.heatMap) {
            return heatDoneRun();
        }
        return new HorisontalPulse(this.heatMap, {
            panel: enemy,
            name: name || 'enemyBeginFightPulse'
        }).play();
    }

    playVerticalPulse(name) {
        const enemy = (this.panelBoxes || []).find((box) => box.label === 'enemy_data');
        if (!enemy || !this.heatMap) {
            return heatDoneRun();
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
            return heatDoneRun();
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
            return heatDoneRun();
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
            return heatDoneRun();
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
            return heatDoneRun();
        }
        return new VerticalPulse(this.heatMap, {
            panel: panel,
            name: 'userPostMortemPulse',
            from: 'left',
            exit: 1.3
        }).play();
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

    clearSelection(composite) {
        if (!composite) {
            return;
        }
        composite.clear({ instant: true });
    }

    isMatchOver() {
        return typeof SimpleGameSceneUtil !== 'undefined'
            && SimpleGameSceneUtil.isGameFinished(this.gameData);
    }

    hasStackItems() {
        return activePartCount(this.stone) + activePartCount(this.scissor) + activePartCount(this.paper) > 0;
    }

    onSelectEffect(kind, category) {
        if (this.isMatchOver() || this._sending || !this.hasStackItems()) {
            return;
        }
        const selected = this.selectedEffects || [];
        let choseNa = false;
        if (selected.includes(kind)) {
            this.selectedEffects = selected.filter((item) => item !== kind);
        } else if (this.canChooseEffect(kind)) {
            const defs = this.effectDefs();
            this.selectedEffects = selected.filter((item) => {
                const def = defs.find((entry) => entry.kind === item);
                return def && def.category !== category;
            });
            this.selectedEffects.push(kind);
            choseNa = naEffectKind(kind);
        }
        if (choseNa) {
            const selection = this.currentSelection();
            reduceCompositeToOne(selection && selection.composite);
        }
        this.syncNaPrime();
        this.refreshMatchReadout();
    }

    naEffectSelected() {
        return (this.selectedEffects || []).some((kind) => naEffectKind(kind));
    }

    ntEffectSelected() {
        return (this.selectedEffects || []).some((kind) => ntEffectKind(kind));
    }

    canChooseEffect(kind) {
        const selection = this.currentSelection();
        const items = readInventoryItems(this.gameData);
        return effectChoiceCovered(effectInventoryTotal(items, kind, selection && selection.moveType));
    }

    refreshEffectButtons() {
        const hasItems = this.hasStackItems();
        const selection = hasItems ? this.currentSelection() : null;
        const items = readInventoryItems(this.gameData);
        const moveType = selection && selection.moveType;
        if (!hasItems) {
            this.selectedEffects = [];
        } else {
            this.selectedEffects = (this.selectedEffects || []).filter((kind) => {
                return effectChoiceCovered(effectInventoryTotal(items, kind, moveType));
            });
        }
        const enabled = hasItems && !this.isMatchOver() && !this._sending && !!this.currentGameId;
        const selected = this.selectedEffects || [];
        (this.effectButtons || []).forEach((btn) => {
            const covered = effectChoiceCovered(effectInventoryTotal(items, btn.effectKind, moveType));
            const on = enabled && covered;
            this.setGreenButtonEnabled(btn, on);
            this.setGreenButtonSelected(btn, on && selected.includes(btn.effectKind));
        });
        this.refreshInventoryReadout();
        this.syncNaPrime();
    }

    syncNaPrime() {
        if (this._sending) {
            this.holdNtCoreForTurn();
            return;
        }
        const selection = this.currentSelection();
        if (!selection) {
            this.dismissNaPrime();
            return;
        }
        if (this.naEffectSelected()) {
            this.removeNtCore();
            if (this.naPrime && this.naPrimeSource === selection.composite) {
                setCompositeShown(selection.composite, false);
                return;
            }
            this.removeNaPrime();
            setCompositeShown(selection.composite, false);
            this.naPrimeSource = selection.composite;
            this.naPrime = createNaPrime(this.heatMap, selection);
            return;
        }
        if (this.ntEffectSelected()) {
            this.removeNaPrime();
            if (this.ntCore && this.ntCoreSource === selection.composite) {
                setCompositeShown(selection.composite, false);
                syncNtCoreCount(this.ntCore, activePartCount(selection.composite));
                return;
            }
            this.removeNtCore();
            setCompositeShown(selection.composite, false);
            this.ntCoreSource = selection.composite;
            this.ntCore = createNtCore(this.heatMap, selection);
            return;
        }
        this.dismissNaPrime();
    }

    dismissNaPrime() {
        setCompositeShown(this.stone, true);
        setCompositeShown(this.scissor, true);
        setCompositeShown(this.paper, true);
        this.removeNaPrime();
        this.removeNtCore();
    }

    removeNaPrime() {
        const prime = this.naPrime;
        this.naPrime = null;
        this.naPrimeSource = null;
        removeHeatStandIn(prime);
    }

    removeNtCore() {
        const core = this.ntCore;
        this.ntCore = null;
        this.ntCoreSource = null;
        removeHeatStandIn(core);
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
        const stage = SimpleGameSceneUtil.getLastSubRoundStage(this.gameData, userId, { showZero: true });
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
        this.refreshInventoryReadout();
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
        const playerReady = this.healthBarsLive(this.healthBars, count);
        const enemyReady = this.healthBarsLive(this.enemyHealthBars, count);
        if (!playerReady || !enemyReady) {
            this.clearHealthBars();
            this.createHealthBars(score, count);
        }
        if (this._deferHealth) {
            return;
        }
        this.updateHealthBar();
    }

    healthBarsLive(bars, count) {
        if (!bars || bars.length !== count) {
            return false;
        }
        const list = this.heatMap && this.heatMap.field && this.heatMap.field.highlighters;
        if (!list) {
            return false;
        }
        return bars.every((bar) => bar && bar.emitter && list.indexOf(bar.emitter) >= 0);
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

        this.enemyReadout = this.add.text(enemy.x + 8, enemy.y + 22, 'you  —\nenemy  —\nWAIT', {
            font: `${UI.body}px monospace`,
            fill: '#00ff66',
            wordWrap: { width: enemy.width - 16 }
        }).setOrigin(0, 0);
        this.enemyReadout.setDepth(1100);
    }

    createInventoryReadout(boxes) {
        const stone = boxes.find((box) => box.label === 'stone_storage_panel');
        const scissors = boxes.find((box) => box.label === 'scissors_storage_panel');
        const paper = boxes.find((box) => box.label === 'paper_storage_panel');
        const nt = boxes.find((box) => box.label === 'NT_effects_panel');
        const style = {
            font: `${UI.body}px monospace`,
            fill: '#00ff66'
        };
        this.stoneCountText = this.createInventorySideText(stone, 'left', style);
        this.stoneNaText = this.createInventorySideText(stone, 'right', style);
        this.stoneCountText.panelBox = stone;
        this.scissorsCountText = this.createInventorySideText(scissors, 'left', style);
        this.scissorsNaText = this.createInventorySideText(scissors, 'right', style);
        this.scissorsCountText.panelBox = scissors;
        this.paperCountText = this.createInventorySideText(paper, 'left', style);
        this.paperNaText = this.createInventorySideText(paper, 'right', style);
        this.paperCountText.panelBox = paper;
        this.ntEffectText = this.add.text(
            nt.x + nt.width / 2,
            nt.y + nt.height * 0.58,
            '—',
            {
                font: `${UI.small}px monospace`,
                fill: '#00ff66',
                align: 'center'
            }
        ).setOrigin(0.5).setDepth(1100);
        this.ntEffectText.panelBox = nt;
        this.fitInventoryPanelLabels(boxes);
        this.refreshInventoryReadout();
    }

    createInventorySideText(box, side, style) {
        const left = side === 'left';
        const text = this.add.text(
            left ? box.x + 6 : box.x + box.width - 6,
            box.y + box.height * 0.58,
            '—',
            style
        );
        text.setOrigin(left ? 0 : 1, 0.5);
        text.setDepth(1100);
        return text;
    }

    fitInventoryPanelLabels(boxes) {
        const layer = this.stageMarkup;
        if (!layer || !layer.list) {
            return;
        }
        const inventoryTitle = layer.list.find((item) => item.text === 'inventory');
        if (inventoryTitle) {
            inventoryTitle.setVisible(false);
        }
        ['stone_storage_panel', 'scissors_storage_panel', 'paper_storage_panel', 'NT_effects_panel'].forEach((label) => {
            const box = boxes.find((item) => item.label === label);
            const text = layer.list.find((item) => item.text === label);
            if (!box || !text || typeof text.setWordWrapWidth !== 'function') {
                return;
            }
            text.setWordWrapWidth(Math.max(8, box.width - 8), true);
        });
    }

    refreshInventoryReadout() {
        if (!this.stoneCountText) {
            return;
        }
        const items = readInventoryItems(this.gameData);
        const selection = this.currentSelection();
        const effects = this.selectedEffects;
        this.stoneCountText.setText(inventorySelectedCountText(items && items.stones, activePartCount(this.stone)));
        this.stoneNaText.setText(inventorySelectedCountText(items && items.NA_effect_stone, naEffectPicked('Stone', selection, effects)));
        this.scissorsCountText.setText(inventorySelectedCountText(items && items.scissors, activePartCount(this.scissor)));
        this.scissorsNaText.setText(inventorySelectedCountText(items && items.NA_effect_scissors, naEffectPicked('Scissors', selection, effects)));
        this.paperCountText.setText(inventorySelectedCountText(items && items.papers, activePartCount(this.paper)));
        this.paperNaText.setText(inventorySelectedCountText(items && items.NA_effect_papers, naEffectPicked('Paper', selection, effects)));
        this.ntEffectText.setText(inventorySelectedCountText(items && items.NT_effect, ntEffectPicked(effects)));
        fitInventoryCountPair(this.stoneCountText, this.stoneNaText);
        fitInventoryCountPair(this.scissorsCountText, this.scissorsNaText);
        fitInventoryCountPair(this.paperCountText, this.paperNaText);
        fitInventorySingleCount(this.ntEffectText);
    }

    turnCap(moveType) {
        return SimpleGameSceneUtil.turnCap(this.gameData, moveType);
    }

    onStonePress() {
        this.addStockedItem('stone', 'stones', 'Stone');
    }

    onScissorsPress() {
        this.addStockedItem('scissor', 'scissors', 'Scissors');
    }

    onPaperPress() {
        this.addStockedItem('paper', 'papers', 'Paper');
    }

    addStockedItem(compositeKey, itemKey, moveType) {
        if (this.naEffectSelected()) {
            return;
        }
        const items = readInventoryItems(this.gameData);
        const selected = activePartCount(this[compositeKey]);
        const left = inventoryRemaining(items && items[itemKey], selected);
        if (!(left > 0)) {
            return;
        }
        this.addCompositeItem(compositeKey, Math.min(this.turnCap(moveType), selected + left));
    }

    addCompositeItem(key, maxItems) {
        const composite = this[key];
        if (!composite || activePartCount(composite) >= maxItems) {
            return;
        }
        composite.addItem();
        if (composite._naHidden) {
            setCompositeShown(composite, false);
        }
        if (this.ntCore && this.ntCoreSource === composite) {
            syncNtCoreCount(this.ntCore, activePartCount(composite));
        }
        this.refreshMatchReadout();
    }

    onCancelPress() {
        const composite = [this.stone, this.scissor, this.paper].find((item) => activePartCount(item) > 0);
        if (!composite) {
            return;
        }
        composite.removeItem();
        if (this.ntCore && this.ntCoreSource === composite) {
            syncNtCoreCount(this.ntCore, activePartCount(composite));
        }
        this.refreshMatchReadout();
    }

    selectionSignature() {
        return [
            activePartCount(this.stone),
            activePartCount(this.scissor),
            activePartCount(this.paper)
        ].join(':');
    }

    syncSelectionButtons() {
        if (this._sending) {
            return;
        }
        const signature = this.selectionSignature();
        if (signature === this._selectionSignature) {
            return;
        }
        this.refreshMoveButtons();
        this.refreshEffectButtons();
    }

    refreshMoveButtons() {
        const counts = {
            stone: activePartCount(this.stone),
            scissors: activePartCount(this.scissor),
            paper: activePartCount(this.paper)
        };
        this._selectionSignature = counts.stone + ':' + counts.scissors + ':' + counts.paper;
        const limits = {
            stone: this.turnCap('Stone'),
            scissors: this.turnCap('Scissors'),
            paper: this.turnCap('Paper')
        };
        const items = readInventoryItems(this.gameData);
        const stockLeft = {
            stone: inventoryRemaining(items && items.stones, counts.stone),
            scissors: inventoryRemaining(items && items.scissors, counts.scissors),
            paper: inventoryRemaining(items && items.papers, counts.paper)
        };
        Object.keys(this.moveButtons || {}).forEach((key) => {
            const othersHaveItems = Object.keys(counts).some((other) => other !== key && counts[other] > 0);
            const cap = this.naEffectSelected() ? 1 : limits[key];
            const atLimit = counts[key] >= cap;
            const outOfStock = !(stockLeft[key] > 0);
            this.setGreenButtonEnabled(this.moveButtons[key], !othersHaveItems && !atLimit && !outOfStock);
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
        if (btn instanceof HmSkinnedButton) {
            btn.root.setAlpha(enabled ? 1 : 0.35);
            if (btn.root.input) {
                btn.root.input.cursor = enabled ? 'pointer' : 'default';
            }
            return;
        }
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
        if (btn instanceof HmSkinnedButton) {
            if (btn.round) {
                btn.round.setHovered(!!selected || pointerInsideStageButton(this, btn));
            }
            return;
        }
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
        const effects = boxes.find((box) => box.label === 'effects');
        const selection = boxes.find((box) => box.label === 'selection');
        if (control) {
            const row = panelButtonRow(control);
            const goSize = LOCAL_ADVANCED_CANCEL_BUTTON;
            const goX = control.x + row.inset + goSize / 2;
            this.goButton = this.createGoButton(goX, row.y);
            this.setGreenButtonEnabled(this.goButton, false);
            const size = LOCAL_ADVANCED_CANCEL_BUTTON;
            const cx = control.x + control.width - row.inset - size / 2;
            this.cancelButton = this.createCancelButton(cx, row.y);
        }
        if (effects) {
            const row = panelButtonRow(effects);
            const size = row.height;
            const leftX = effects.x + row.inset + size / 2;
            const rightX = effects.x + effects.width - row.inset - size / 2;
            this.effectButtons = this.effectDefs().map((def) => {
                const cx = def.kind === 'SizeOnly' ? rightX : leftX;
                if (def.kind === 'NegateSize') {
                    return this.createPrimeEffectButton(cx, row.y, size, def);
                }
                return this.createCoreEffectButton(cx, row.y, size, def);
            });
            this.refreshEffectButtons();
        }
        if (selection) {
            const row = panelButtonRow(selection);
            const labels = ['stone', 'scissors', 'paper'];
            const gap = 8;
            const btnW = Math.floor((selection.width - row.inset * 2 - gap * (labels.length - 1)) / labels.length);
            this.moveButtons = {};
            labels.forEach((label, index) => {
                const cx = selection.x + row.inset + btnW / 2 + index * (btnW + gap);
                if (label === 'stone') {
                    this.moveButtons.stone = this.createStoneMoveButton(cx, row.y);
                    return;
                }
                if (label === 'scissors') {
                    this.moveButtons.scissors = this.createScissorsMoveButton(cx, row.y);
                    return;
                }
                this.moveButtons.paper = this.createPaperMoveButton(cx, row.y);
            });
            this.refreshMoveButtons();
        }
    }

    createCoreEffectButton(cx, cy, size, def) {
        const button = new HmSkinnedCoreButton(this, {
            x: cx - size / 2,
            y: cy - size / 2,
            size: size,
            minSize: size,
            maxSize: size
        });
        button.effectKind = def.kind;
        button.effectCategory = def.category;
        button.isEnabled = true;
        bindPress(this, button.root, {
            tapFx: 'none',
            isEnabled: () => button.isEnabled,
            onClick: () => this.onSelectEffect(def.kind, def.category)
        });
        if (button.root.input) {
            button.root.input.cursor = 'pointer';
        }
        this.placeButtonRound(button, def.kind === 'NegateSize' ? 'Negate' : 'Size');
        return button;
    }

    createPrimeEffectButton(cx, cy, size, def) {
        const button = new HmSkinnedPrimeButton(this, {
            x: cx - size / 2,
            y: cy - size / 2,
            size: size,
            minSize: size,
            maxSize: size
        });
        button.effectKind = def.kind;
        button.effectCategory = def.category;
        button.isEnabled = true;
        bindPress(this, button.root, {
            tapFx: 'none',
            isEnabled: () => button.isEnabled,
            onClick: () => this.onSelectEffect(def.kind, def.category)
        });
        if (button.root.input) {
            button.root.input.cursor = 'pointer';
        }
        this.placeButtonRound(button, def.kind === 'NegateSize' ? 'Negate' : 'Size');
        return button;
    }

    createGoButton(cx, cy) {
        const size = LOCAL_ADVANCED_CANCEL_BUTTON;
        const button = new HmSkinnedPointerButton(this, {
            x: cx - size / 2,
            y: cy - size / 2,
            size: size,
            minSize: size,
            maxSize: size
        });
        button.isEnabled = false;
        bindPress(this, button.root, {
            tapFx: 'none',
            isEnabled: () => button.isEnabled,
            onClick: () => this.onGoPress()
        });
        this.setGreenButtonEnabled(button, false);
        this.placeButtonRound(button, 'Go');
        return button;
    }

    createCancelButton(cx, cy) {
        const size = LOCAL_ADVANCED_CANCEL_BUTTON;
        const button = new HmSkinnedCrossButton(this, {
            x: cx - size / 2,
            y: cy - size / 2,
            size: size,
            minSize: size,
            maxSize: size
        });
        button.isEnabled = false;
        bindPress(this, button.root, {
            tapFx: 'none',
            isEnabled: () => button.isEnabled,
            onClick: () => this.onCancelPress()
        });
        this.setGreenButtonEnabled(button, false);
        this.placeButtonRound(button, 'Cancel');
        return button;
    }

    createStoneMoveButton(cx, cy) {
        const size = LOCAL_ADVANCED_STONE_BUTTON;
        const button = new HmSkinnedStoneButton(this, {
            x: cx - size / 2,
            y: cy - size / 2,
            size: size,
            minSize: size,
            maxSize: size,
            ballRadius: LOCAL_ADVANCED_STONE_BALL_RADIUS,
            ballHeat: LOCAL_ADVANCED_STONE_BALL_HEAT
        });
        button.isEnabled = true;
        this.stoneButton = button;
        bindPress(this, button.root, {
            tapFx: 'none',
            isEnabled: () => button.isEnabled,
            onClick: () => this.onStonePress()
        });
        if (button.root.input) {
            button.root.input.cursor = 'pointer';
        }
        this.placeButtonRound(button, 'Stone');
        return button;
    }

    createScissorsMoveButton(cx, cy) {
        const size = LOCAL_ADVANCED_STONE_BUTTON;
        const button = new HmSkinnedScissorsButton(this, {
            x: cx - size / 2,
            y: cy - size / 2,
            size: size,
            minSize: size,
            maxSize: size
        });
        button.isEnabled = true;
        this.scissorsButton = button;
        bindPress(this, button.root, {
            tapFx: 'none',
            isEnabled: () => button.isEnabled,
            onClick: () => this.onScissorsPress()
        });
        if (button.root.input) {
            button.root.input.cursor = 'pointer';
        }
        this.placeButtonRound(button, 'Scissors');
        return button;
    }

    createPaperMoveButton(cx, cy) {
        const size = LOCAL_ADVANCED_STONE_BUTTON;
        const button = new HmSkinnedPaperButton(this, {
            x: cx - size / 2,
            y: cy - size / 2,
            size: size,
            minSize: size,
            maxSize: size
        });
        button.isEnabled = true;
        this.paperButton = button;
        bindPress(this, button.root, {
            tapFx: 'none',
            isEnabled: () => button.isEnabled,
            onClick: () => this.onPaperPress()
        });
        if (button.root.input) {
            button.root.input.cursor = 'pointer';
        }
        this.placeButtonRound(button, 'Paper');
        return button;
    }

    placeButtonRound(button, name) {
        const radius = heatMapCellSpan(this.heatMap, button.width / 2, 'col');
        const cell = heatMapCellAt(this.heatMap, button.root.x, button.root.y);
        const round = new UiRound(this.heatMap, {
            name: name,
            center: cell,
            target: cell,
            cycling: false,
            from: { radius: radius, heat: 0 },
            to: { radius: radius, heat: 0.1 },
            params: { speed: 6, delay: 0.5, gap: 0.4 }
        });
        round.armHover();
        button.round = round;
        button.root.on('pointerover', () => round.setHovered(true));
        button.root.on('pointerout', () => round.setHovered(!!button.isSelected));
        if (pointerInsideStageButton(this, button)) {
            round.setHovered(true);
        }
        return round;
    }

    update(time, delta) {
        if (this.heatMap && typeof this.heatMap.update === 'function') {
            this.heatMap.update(time, delta);
        }
        this.syncSelectionButtons();
        if (this.stoneButton && typeof this.stoneButton.update === 'function') {
            this.stoneButton.update(time, delta);
        }
        if (this.scissorsButton && typeof this.scissorsButton.update === 'function') {
            this.scissorsButton.update(time, delta);
        }
        if (this.paperButton && typeof this.paperButton.update === 'function') {
            this.paperButton.update(time, delta);
        }
        if (this.cancelButton && typeof this.cancelButton.update === 'function') {
            this.cancelButton.update(time, delta);
        }
        if (this.goButton && typeof this.goButton.update === 'function') {
            this.goButton.update(time, delta);
        }
        (this.effectButtons || []).forEach((btn) => {
            if (btn instanceof HmSkinnedButton && typeof btn.update === 'function') {
                btn.update(time, delta);
            }
        });
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
        { label: 'score', share: 0.215 },
        { label: 'enemy_data', share: 0.25 },
        { label: 'current turn', share: 0.385 },
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
        if (panel.label === 'inventory') {
            pushInventoryStoragePanels(boxes, box);
        }
        if (panel.label === 'current turn') {
            const innerH = panelH * 0.2;
            const pad = 8;
            const selectionH = Math.max(innerH, panelButtonRowHeight(LOCAL_ADVANCED_STONE_BUTTON));
            const controlH = Math.max(innerH, panelButtonRowHeight(LOCAL_ADVANCED_CANCEL_BUTTON));
            const effectsH = panelButtonRowHeight(LOCAL_ADVANCED_EFFECT_BUTTON);
            boxes.push({
                x: pad,
                y: y + pad,
                width: width - pad * 2,
                height: controlH,
                label: 'control'
            });
            boxes.push({
                x: pad,
                y: y + pad + controlH + pad,
                width: width - pad * 2,
                height: effectsH,
                label: 'effects'
            });
            boxes.push({
                x: pad,
                y: y + panelH - pad - selectionH,
                width: width - pad * 2,
                height: selectionH,
                label: 'selection'
            });
        }
        y += panelH;
    });
    return boxes;
}

const LOCAL_ADVANCED_STONE_BUTTON = 80;
const LOCAL_ADVANCED_CANCEL_BUTTON = 60;
const LOCAL_ADVANCED_EFFECT_BUTTON = 60;
const LOCAL_ADVANCED_STONE_BALL_RADIUS = 6.4;
const LOCAL_ADVANCED_STONE_BALL_HEAT = 2;
const LOCAL_ADVANCED_REVEAL_PAUSE = 5000;
const LOCAL_ADVANCED_CLASH_PAUSE = 2000;
const LOCAL_ADVANCED_REMOVE_PAUSE = 320;

function pushInventoryStoragePanels(boxes, inventory) {
    const specs = [
        { label: 'stone_storage_panel', share: 0.3 },
        { label: 'scissors_storage_panel', share: 0.3 },
        { label: 'paper_storage_panel', share: 0.3 },
        { label: 'NT_effects_panel', share: 0.1 }
    ];
    let x = inventory.x;
    specs.forEach((spec, index) => {
        const width = index === specs.length - 1
            ? (inventory.x + inventory.width) - x
            : inventory.width * spec.share;
        boxes.push({
            x: x,
            y: inventory.y,
            width: width,
            height: inventory.height,
            label: spec.label
        });
        x += width;
    });
}

function readInventoryItems(gameData) {
    const payload = gameData && gameData.payload;
    const player = payload && payload.playerContext;
    const inventory = player && player.inventory;
    const items = inventory && inventory.items;
    if (!items || typeof items !== 'object') {
        return null;
    }
    return items;
}

const NA_EFFECT_KINDS = ['NegateSize', 'Overpower'];

function naEffectKind(kind) {
    return NA_EFFECT_KINDS.indexOf(kind) !== -1;
}

function reduceCompositeToOne(composite) {
    if (!composite || typeof composite.removeItem !== 'function') {
        return;
    }
    while (activePartCount(composite) > 1) {
        if (!composite.removeItem()) {
            break;
        }
    }
}

function naPrimeConstructor(moveType) {
    if (moveType === 'Stone' && typeof HotMapUiStonePrime !== 'undefined') {
        return HotMapUiStonePrime;
    }
    if (moveType === 'Scissors' && typeof HotMapUiScissorsPrime !== 'undefined') {
        return HotMapUiScissorsPrime;
    }
    if (moveType === 'Paper' && typeof HotMapUiPaperPrime !== 'undefined') {
        return HotMapUiPaperPrime;
    }
    return null;
}

function createNaPrime(heatMap, selection) {
    const Ctor = naPrimeConstructor(selection && selection.moveType);
    const composite = selection && selection.composite;
    if (!Ctor || !composite || !heatMap) {
        return null;
    }
    return new Ctor(heatMap, {
        center: {
            col: composite.center.col,
            row: composite.center.row
        },
        spawn: {
            col: composite.spawn.col,
            row: composite.spawn.row
        },
        animate: false
    });
}

function createNtCore(heatMap, selection) {
    const composite = selection && selection.composite;
    if (!composite || !heatMap || typeof UiCore === 'undefined') {
        return null;
    }
    const core = new UiCore(heatMap, {
        name: 'NT Core',
        center: {
            col: composite.center.col,
            row: composite.center.row
        }
    });
    syncNtCoreCount(core, activePartCount(composite));
    return core;
}

function syncNaPrimeCount(prime, count) {
    if (!prime || typeof prime.removeItem !== 'function') {
        return;
    }
    const target = Math.max(0, count || 0);
    let guard = 0;
    while (naPrimeGestureCount(prime) > target && guard < 4) {
        guard += 1;
        if (!prime.removeItem()) {
            break;
        }
    }
}

function naPrimeGestureCount(prime) {
    if (!prime) {
        return 0;
    }
    if (typeof prime.ballCount === 'function') {
        return prime.ballCount();
    }
    if (typeof prime.shardCount === 'function') {
        return prime.shardCount();
    }
    if (typeof prime.sheetCount === 'function') {
        return prime.sheetCount();
    }
    return 0;
}

function syncNtCoreCount(core, count) {
    if (!core || typeof core.balls !== 'function') {
        return;
    }
    const target = Math.max(0, count || 0);
    while (core.balls().length < target) {
        if (!core.addItem()) {
            break;
        }
    }
    while (core.balls().length > target) {
        if (!core.removeItem()) {
            break;
        }
    }
}

function removeHeatStandIn(node) {
    if (!node) {
        return;
    }
    if (typeof node.releaseContents === 'function') {
        node.releaseContents();
    } else if (typeof node.clear === 'function') {
        node.clear({ instant: true });
    }
    if (typeof node.detach === 'function') {
        node.detach();
    }
}

function setCompositeShown(composite, shown) {
    if (!composite) {
        return;
    }
    if (shown) {
        if (!composite._naHidden) {
            return;
        }
        composite._naHidden = false;
    } else {
        composite._naHidden = true;
    }
    composite.items.forEach((item) => {
        if (item) {
            item.isVisible = !!shown;
        }
    });
}

const NT_EFFECT_KINDS = ['Protection', 'SizeOnly'];

function ntEffectKind(kind) {
    return NT_EFFECT_KINDS.indexOf(kind) !== -1;
}

function naEffectPicked(moveType, selection, selectedEffects) {
    if (!selection || selection.moveType !== moveType) {
        return 0;
    }
    const kinds = selectedEffects || [];
    return kinds.some((kind) => NA_EFFECT_KINDS.indexOf(kind) !== -1) ? 1 : 0;
}

function ntEffectPicked(selectedEffects) {
    const kinds = selectedEffects || [];
    return kinds.some((kind) => NT_EFFECT_KINDS.indexOf(kind) !== -1) ? 1 : 0;
}

function effectInventoryKey(kind, moveType) {
    if (NA_EFFECT_KINDS.indexOf(kind) !== -1) {
        if (moveType === 'Stone') {
            return 'NA_effect_stone';
        }
        if (moveType === 'Scissors') {
            return 'NA_effect_scissors';
        }
        if (moveType === 'Paper') {
            return 'NA_effect_papers';
        }
        return null;
    }
    if (NT_EFFECT_KINDS.indexOf(kind) !== -1) {
        return 'NT_effect';
    }
    return null;
}

function effectInventoryTotal(items, kind, moveType) {
    const key = effectInventoryKey(kind, moveType);
    return key && items ? items[key] : undefined;
}

function effectChoiceCovered(total) {
    const left = inventoryRemaining(total, 1);
    return left !== null && left >= 0;
}

function fitInventorySingleCount(text) {
    const box = text && text.panelBox;
    if (!box) {
        return;
    }
    const max = Math.max(8, box.width - 4);
    let size = UI.small;
    while (size >= 8) {
        text.setFont(`${size}px monospace`);
        if (text.width <= max) {
            return;
        }
        size -= 1;
    }
}

function fitInventoryCountPair(leftText, rightText) {
    const box = leftText && leftText.panelBox;
    if (!box) {
        return;
    }
    const gap = 8;
    const max = Math.max(8, box.width - 12 - gap);
    let size = UI.body;
    while (size >= 9) {
        const font = `${size}px monospace`;
        leftText.setFont(font);
        rightText.setFont(font);
        if (leftText.width + rightText.width <= max) {
            return;
        }
        size -= 1;
    }
}

function inventoryRemaining(total, selected) {
    if (!Number.isFinite(total)) {
        return null;
    }
    const picked = Number.isFinite(selected) ? Math.max(0, Math.trunc(selected)) : 0;
    return total - picked;
}

function inventorySelectedCountText(total, selected) {
    const left = inventoryRemaining(total, selected);
    if (left === null) {
        return '—';
    }
    const picked = Number.isFinite(selected) ? Math.max(0, Math.trunc(selected)) : 0;
    if (picked <= 0) {
        return String(total);
    }
    return `${left} + ${picked}`;
}

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

function createLocalAdvancedComposite(Ctor, heatMap, boxes, spawnPixel, centerBox) {
    const current = centerBox || boxes.find((box) => box.label === 'current turn');
    const center = heatMapCellAt(
        heatMap,
        current.x + current.width / 2,
        current.y + current.height / 2
    );
    const spawnPoint = heatMapCellAt(heatMap, spawnPixel.x, spawnPixel.y);
    const group = new Ctor(heatMap, {
        center: center,
        spawn: {
            col: spawnPoint.col - center.col,
            row: spawnPoint.row - center.row
        },
        count: 0
    });
    group.specCount = 0;
    group.reset({ items: 'spec' });
    return group;
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

function pointerInsideStageButton(scene, button) {
    const pointer = scene.input && scene.input.activePointer;
    const root = button && button.root;
    if (!pointer || !root || typeof root.getBounds !== 'function') {
        return false;
    }
    const bounds = root.getBounds();
    return Phaser.Geom.Rectangle.Contains(bounds, pointer.worldX, pointer.worldY);
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

function activePartCount(composite) {
    return hotMapActivePartCount(composite);
}

function panelButtonChrome() {
    return { labelH: 16, inset: 6 };
}

function panelButtonRowHeight(buttonSize) {
    const chrome = panelButtonChrome();
    return chrome.labelH + buttonSize + chrome.inset;
}

function panelButtonRow(panel) {
    const chrome = panelButtonChrome();
    const height = Math.max(24, panel.height - chrome.labelH - chrome.inset);
    return {
        inset: chrome.inset,
        height: height,
        y: panel.y + chrome.labelH + height / 2
    };
}
