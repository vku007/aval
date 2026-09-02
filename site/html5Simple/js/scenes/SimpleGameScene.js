/**
 * SimpleGameScene
 * Main game scene with layout presets from UI.layout
 */
class SimpleGameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'SimpleGameScene' });
    }
    
    initializeSceneState(data) {
        console.log('[SimpleGameScene] initializeSceneState() started');
        
        this.currentGameId = data.gameId || null;
        this.gameData = null;
        this.layout = UI.layout;
        
        this.sceneState = {
            currentAction: null,
            isActionReady: false
        };
        this.roundKeys = null;
        this.lastPlayerScore = undefined;
        this.lastEnemyScore = undefined;
        
        console.log('[SimpleGameScene] Scene state initialized:', this.sceneState);
    }
    
    setCurrentAction(action) {
        console.log('[SimpleGameScene] setCurrentAction() called with:', action);
        
        this.sceneState.currentAction = action;
        this.sceneState.isActionReady = action !== null;
        
        if (this.sceneState.isActionReady) {
            this.enableGoButton();
        } else {
            this.disableGoButton();
        }

        this.updateMoveSelection();
        this.updateCurrentActionDisplay();
        
        console.log('[SimpleGameScene] Scene state updated:', this.sceneState);
    }
    
    clearCurrentAction() {
        console.log('[SimpleGameScene] clearCurrentAction() called');
        this.setCurrentAction(null);
    }
    
    updateCurrentActionDisplay() {
        if (!this.currentMoveText) return;
        
        if (this.sceneState.currentAction) {
            const moveType = this.sceneState.currentAction.context?.move?.context?.moveType || 'Unknown';
            fxFadeText(this, this.currentMoveText, `${moveType} ready — tap GO`);
        } else if (SimpleGameSceneUtil.isGameFinished(this.gameData)) {
            fxFadeText(this, this.currentMoveText, 'Match over');
        } else {
            fxFadeText(this, this.currentMoveText, 'Pick Stone, Scissors, or Paper');
        }
    }

    updateMoveSelection() {
        if (!this.actionButtons) return;
        const moveType = this.sceneState.currentAction?.context?.move?.context?.moveType;
        this.actionButtons.forEach((btn) => {
            if (btn.moveType) {
                fxSelectMove(btn, !!moveType && btn.moveType === moveType);
            }
        });
    }

    create(data) {
        console.log('[SimpleGameScene] create() started with data:', data);
        
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        console.log('[SimpleGameScene] Canvas size:', width, 'x', height);
        
        this.initializeSceneState(data);
        fxEnter(this);
        
        console.log('[SimpleGameScene] Received gameId:', this.currentGameId);
        console.log('[SimpleGameScene] Layout:', this.layout.id);
        
        switch (this.layout.structure) {
            case 'hud-status-play':
                this.createThumbLayout(width, height);
                break;
            case 'hud-arena-grid':
                this.createArenaLayout(width, height);
                break;
            default:
                this.createBalancedLayout(width, height);
                break;
        }
        
        this.initializeGame();
    }

    createThumbLayout(width, height) {
        const hudH = height * this.layout.hud;
        const statusH = height * this.layout.status;
        const playH = height * this.layout.play;
        let y = 0;

        this.createHudPanel(0, y, width, hudH, false);
        y += hudH;
        this.createStatusCard(0, y, width, statusH);
        y += statusH;
        this.createThumbPlayPanel(0, y, width, playH);
    }

    createBalancedLayout(width, height) {
        const charactersHeight = height * this.layout.characters;
        const gameResultsHeight = height * this.layout.results;
        const currentMoveHeight = height * this.layout.currentMove;
        const actionPanelHeight = height * this.layout.actions;
        let y = 0;

        this.createCharactersPanel(0, y, width, charactersHeight, true);
        y += charactersHeight;
        this.createGameResultsPanel(0, y, width, gameResultsHeight);
        y += gameResultsHeight;
        this.createCurrentMovePanel(0, y, width, currentMoveHeight);
        y += currentMoveHeight;
        this.createTwoRowActionPanel(0, y, width, actionPanelHeight);
    }

    createArenaLayout(width, height) {
        const hudH = height * this.layout.hud;
        const arenaH = height * this.layout.arena;
        const actionsH = height * this.layout.actions;
        let y = 0;

        this.createHudPanel(0, y, width, hudH, true);
        y += hudH;
        this.createCurrentMovePanel(0, y, width, arenaH);
        y += arenaH;
        this.createGridActionPanel(0, y, width, actionsH);
    }
    
    async initializeGame() {
        console.log('[SimpleGameScene] initializeGame() started');
        
        try {
            if (typeof gameClient === 'undefined') {
                console.error('[SimpleGameScene] gameClient not available');
                this.showError('Game client not initialized');
                return;
            }
            
            if (this.currentGameId) {
                console.log('[SimpleGameScene] Loading existing game:', this.currentGameId);
                this.updateGameStatus('Loading match...');
                await this.loadGame(this.currentGameId);
            } else {
                console.error('[SimpleGameScene] No gameId provided');
                this.showError('No game ID provided. Please create a game first.');
            }
            
        } catch (error) {
            console.error('[SimpleGameScene] Failed to initialize game:', error);
            this.showError(`Failed to load game: ${error.message}`);
        }
    }
    
    async loadGame(gameId) {
        console.log('[SimpleGameScene] loadGame() called with gameId:', gameId);
        
        try {
            const response = await gameClient.getGame(gameId);
            console.log('[SimpleGameScene] Game loaded:', response);
            
            this.gameData = response;
            this.updateGameDisplay();
            
        } catch (error) {
            console.error('[SimpleGameScene] Failed to load game:', error);
            this.showError(`Failed to load game: ${error.message}`);
        }
    }
    
    updateGameDisplay() {
        console.log('[SimpleGameScene] updateGameDisplay() called');
        
        if (!this.gameData) {
            console.warn('[SimpleGameScene] No game data to display');
            return;
        }
        
        if (SimpleGameSceneUtil.isGameFinished(this.gameData)) {
            this.updateGameStatus('Match over');
        } else if (this.sceneState.currentAction) {
            this.updateCurrentActionDisplay();
        } else {
            this.updateGameStatus('Pick Stone, Scissors, or Paper');
        }
        
        const enemyName = SimpleGameSceneUtil.getEnemyName(this.gameData);
        if (this.enemyNameText) {
            this.enemyNameText.setText(enemyName);
        }
        
        this.updateScore();
        this.updateRoundsDisplay();
        this.updateActionButtons();
    }
    
    updateScore() {
        console.log('[SimpleGameScene] updateScore() called');
        
        if (!this.gameData || !this.playerScoreText || !this.enemyScoreText) {
            return;
        }
        
        const user = this.registry.get('currentUser');
        const userId = user?.id;
        
        if (!userId) {
            console.warn('[SimpleGameScene] No userId available for score calculation');
            this.playerScoreText.setText('0');
            this.enemyScoreText.setText('0');
            return;
        }
        
        const { playerScore, enemyScore } = SimpleGameSceneUtil.calculateScore(this.gameData, userId);
        
        this.playerScoreText.setText(String(playerScore));
        this.enemyScoreText.setText(String(enemyScore));
        if (this.lastPlayerScore !== undefined && this.lastPlayerScore !== playerScore) {
            fxStress(this, this.playerScoreText, { origColor: '#0066cc', flashColor: '#ffffff' });
        }
        if (this.lastEnemyScore !== undefined && this.lastEnemyScore !== enemyScore) {
            fxStress(this, this.enemyScoreText, { origColor: '#cc0000', flashColor: '#ffffff' });
        }
        this.lastPlayerScore = playerScore;
        this.lastEnemyScore = enemyScore;
    }
    
    updateRoundsDisplay() {
        console.log('[SimpleGameScene] updateRoundsDisplay() called');
        
        if (!this.gameData || !this.roundsContainer) {
            return;
        }
        
        this.roundsContainer.removeAll(true);
        
        const roundsLength = this.gameData.payload?.gameContext?.initGameContext?.rounds;
        const totalRounds = this.getRoundsAmount(roundsLength);
        
        console.log('[SimpleGameScene] Rounds length:', roundsLength, 'Total rounds:', totalRounds);
        
        if (totalRounds === 0) {
            console.warn('[SimpleGameScene] Could not determine total rounds');
            return;
        }
        
        const roundStates = this.gameData.payload?.playerContext?.roundStates || [];
        
        const user = this.registry.get('currentUser');
        const userId = user?.id;
        
        const roundSize = this.layout.roundSize;
        const roundSpacing = 5;
        const totalWidth = (totalRounds * roundSize) + ((totalRounds - 1) * roundSpacing);
        const startX = -totalWidth / 2 + roundSize / 2;
        const prevKeys = this.roundKeys;
        const isInitial = !prevKeys;
        const nextKeys = new Set();
        
        for (let i = 0; i < totalRounds; i++) {
            const roundX = startX + (i * (roundSize + roundSpacing));
            const roundNum = i + 1;
            
            if (i < roundStates.length) {
                const roundData = roundStates[i];
                const key = `${i}:${roundData.status}:${roundData.winnerId}`;
                nextKeys.add(key);
                const shouldAnimate = !isInitial && prevKeys && !prevKeys.has(key);
                this.createRoundResultPanel(roundX, 0, roundSize, roundData, roundNum, userId, shouldAnimate);
            } else {
                this.createPlaceholderRoundPanel(roundX, 0, roundSize, roundNum);
            }
        }
        this.roundKeys = nextKeys;
    }
    
    getRoundsAmount(roundsLength) {
        const roundsMap = {
            'BO1': 1,
            'BO3': 3,
            'BO7': 7
        };
        
        return roundsMap[roundsLength] || 0;
    }
    
    createRoundResultPanel(x, y, size, roundData, roundNum, userId, shouldAnimate) {
        console.log('[SimpleGameScene] Creating round result panel:', roundNum);
        
        const roundContainer = this.add.container(x, y);
        
        let bgColor, borderColor, iconType;
        
        const isFinished = roundData.status && roundData.status.toLowerCase() === 'finished';
        
        if (isFinished) {
            const winnerIdStr = String(roundData.winnerId);
            const userIdStr = String(userId);
            
            if (winnerIdStr === userIdStr) {
                bgColor = 0xe6ffe6;
                borderColor = 0x00cc00;
                iconType = 'check';
            } else {
                bgColor = 0xffe6e6;
                borderColor = 0xcc0000;
                iconType = 'cross';
            }
        } else {
            bgColor = 0xffffe6;
            borderColor = 0xcccc00;
            iconType = 'circle';
        }
        
        const bg = this.add.graphics();
        bg.fillStyle(bgColor, 1);
        bg.fillRect(-size / 2, -size / 2, size, size);
        bg.lineStyle(1, borderColor, 1);
        bg.strokeRect(-size / 2, -size / 2, size, size);
        
        roundContainer.add(bg);
        
        const iconGraphics = this.add.graphics();
        const centerX = 0;
        const centerY = -4;
        const iconSize = size * 0.5;
        
        if (iconType === 'check') {
            iconGraphics.lineStyle(2, 0x00cc00, 1);
            iconGraphics.beginPath();
            iconGraphics.moveTo(centerX - iconSize/2, centerY);
            iconGraphics.lineTo(centerX - iconSize/6, centerY + iconSize/2);
            iconGraphics.lineTo(centerX + iconSize/2, centerY - iconSize/2);
            iconGraphics.strokePath();
        } else if (iconType === 'cross') {
            iconGraphics.lineStyle(2, 0xcc0000, 1);
            iconGraphics.beginPath();
            iconGraphics.moveTo(centerX - iconSize/2, centerY - iconSize/2);
            iconGraphics.lineTo(centerX + iconSize/2, centerY + iconSize/2);
            iconGraphics.strokePath();
            
            iconGraphics.beginPath();
            iconGraphics.moveTo(centerX + iconSize/2, centerY - iconSize/2);
            iconGraphics.lineTo(centerX - iconSize/2, centerY + iconSize/2);
            iconGraphics.strokePath();
        } else if (iconType === 'circle') {
            iconGraphics.lineStyle(2, 0xcccc00, 1);
            iconGraphics.strokeCircle(centerX, centerY, iconSize/2);
        }
        
        roundContainer.add(iconGraphics);
        
        const numText = this.add.text(0, size / 2 - 3, `${roundNum}`, {
            font: `bold ${UI.small}px monospace`,
            fill: '#666666'
        }).setOrigin(0.5, 1);
        
        roundContainer.add(numText);
        
        this.roundsContainer.add(roundContainer);

        if (shouldAnimate && isFinished) {
            fxPop(this, roundContainer);
            const wx = this.roundsContainer.x + roundContainer.x;
            const wy = this.roundsContainer.y + roundContainer.y;
            fxFallingStars(this, wx, wy, UI.fx.stressStars);
            if (iconType === 'check' && UI.fx.winBurst) {
                fxBurstDots(this, wx, wy, 10);
            }
            if (iconType === 'cross') {
                fxShake(this);
            }
        }
    }
    
    createPlaceholderRoundPanel(x, y, size, roundNum) {
        console.log('[SimpleGameScene] Creating placeholder round panel:', roundNum);
        
        const roundContainer = this.add.container(x, y);
        
        const bgColor = 0xf0f0f0;
        const borderColor = 0x999999;
        
        const bg = this.add.graphics();
        bg.fillStyle(bgColor, 1);
        bg.fillRect(-size / 2, -size / 2, size, size);
        bg.lineStyle(1, borderColor, 1);
        bg.strokeRect(-size / 2, -size / 2, size, size);
        
        roundContainer.add(bg);
        
        const iconGraphics = this.add.graphics();
        const centerX = 0;
        const centerY = -4;
        const dashWidth = size * 0.5;
        
        iconGraphics.lineStyle(2, 0x999999, 1);
        iconGraphics.beginPath();
        iconGraphics.moveTo(centerX - dashWidth/2, centerY);
        iconGraphics.lineTo(centerX + dashWidth/2, centerY);
        iconGraphics.strokePath();
        
        roundContainer.add(iconGraphics);
        
        const numText = this.add.text(0, size / 2 - 3, `${roundNum}`, {
            font: `bold ${UI.small}px monospace`,
            fill: '#999999'
        }).setOrigin(0.5, 1);
        
        roundContainer.add(numText);
        
        this.roundsContainer.add(roundContainer);
    }
    
    updateActionButtons() {
        console.log('[SimpleGameScene] updateActionButtons() called');
        
        if (!this.actionButtons || !this.gameData) {
            return;
        }
        
        const isFinished = SimpleGameSceneUtil.isGameFinished(this.gameData);
        console.log('[SimpleGameScene] Game finished?', isFinished);
        
        this.actionButtons.forEach(btn => {
            if (isFinished) {
                this.disableButton(btn);
            } else {
                this.enableButton(btn);
            }
        });
    }
    
    disableButton(btn) {
        if (!btn.isEnabled) return;
        
        btn.isEnabled = false;
        fxStopIdle(this, btn);
        redrawWireButton(btn, 'disabled');
        btn.disableInteractive();
        
        console.log('[SimpleGameScene] Button disabled:', btn.buttonText.text);
    }
    
    enableButton(btn) {
        if (btn.isEnabled) return;
        
        btn.isEnabled = true;
        fxSelectMove(btn, !!btn.isSelected);
        btn.setInteractive();
        
        console.log('[SimpleGameScene] Button enabled:', btn.buttonText.text);
    }
    
    updateGameStatus(text) {
        fxFadeText(this, this.currentMoveText, text);
    }
    
    showError(message) {
        console.error('[SimpleGameScene] Error:', message);
        fxFadeText(this, this.currentMoveText, `ERROR: ${message}`);
    }

    strokePanel(x, y, width, height) {
        const bg = this.add.graphics();
        bg.lineStyle(2, 0x000000, 1);
        bg.strokeRect(x, y, width, height);
        return bg;
    }

    createHudPanel(x, y, width, height, includeBack) {
        console.log('[SimpleGameScene] Creating HUD panel:', x, y, width, height);
        
        this.strokePanel(x, y, width, height);
        
        const nameRowH = Math.min(44, Math.floor(height * 0.42));
        let nameLeft = x + 10;
        
        if (includeBack && this.layout.backPlacement === 'hud') {
            this.createBackButton(x + this.layout.backW / 2 + 6, y + nameRowH / 2);
            nameLeft = x + this.layout.backW + 14;
        }
        
        const user = this.registry.get('currentUser');
        const playerName = user?.name || 'Player';
        const nameMaxW = Math.floor(width / 2) - 56;
        
        this.playerNameText = this.add.text(nameLeft, y + nameRowH / 2, playerName, {
            font: `${UI.body}px monospace`,
            fill: '#000000',
            wordWrap: { width: nameMaxW }
        }).setOrigin(0, 0.5);
        
        this.add.text(x + width / 2, y + nameRowH / 2, 'VS', {
            font: `${UI.small}px monospace`,
            fill: '#666666'
        }).setOrigin(0.5);
        
        this.enemyNameText = this.add.text(x + width - 10, y + nameRowH / 2, 'Enemy', {
            font: `${UI.body}px monospace`,
            fill: '#000000',
            wordWrap: { width: nameMaxW },
            align: 'right'
        }).setOrigin(1, 0.5);
        
        this.createGameResultsContent(x, y + nameRowH, width, height - nameRowH);
    }

    createCharactersPanel(x, y, width, height, includeBack) {
        console.log('[SimpleGameScene] Creating Characters panel:', x, y, width, height);
        
        this.strokePanel(x, y, width, height);
        
        let nameLeft = x + 10;
        if (includeBack && this.layout.backPlacement === 'top-left') {
            this.createBackButton(x + this.layout.backW / 2 + 6, y + height / 2);
            nameLeft = x + this.layout.backW + 14;
        }
        
        const user = this.registry.get('currentUser');
        const playerName = user?.name || 'Player';
        const nameMaxW = Math.floor(width / 2) - 56;
        
        this.playerNameText = this.add.text(nameLeft, y + height / 2, playerName, {
            font: `${UI.body}px monospace`,
            fill: '#000000',
            wordWrap: { width: nameMaxW }
        }).setOrigin(0, 0.5);
        
        this.add.text(x + width / 2, y + height / 2, 'VS', {
            font: `${UI.small}px monospace`,
            fill: '#666666'
        }).setOrigin(0.5);
        
        this.enemyNameText = this.add.text(x + width - 10, y + height / 2, 'Enemy', {
            font: `${UI.body}px monospace`,
            fill: '#000000',
            wordWrap: { width: nameMaxW },
            align: 'right'
        }).setOrigin(1, 0.5);
    }

    createGameResultsPanel(x, y, width, height) {
        console.log('[SimpleGameScene] Creating Game Results panel:', x, y, width, height);
        
        this.resultsPanelX = x;
        this.resultsPanelY = y;
        this.resultsPanelWidth = width;
        this.resultsPanelHeight = height;
        
        this.strokePanel(x, y, width, height);
        this.createGameResultsContent(x, y, width, height);
    }

    createGameResultsContent(x, y, width, height) {
        const scorePanelSize = Math.min(height - 8, 64);
        const scorePanelY = y + (height - scorePanelSize) / 2;
        
        const playerPanelX = x + 10;
        this.createPlayerScorePanel(playerPanelX, scorePanelY, scorePanelSize, scorePanelSize);
        
        const enemyPanelX = x + width - scorePanelSize - 10;
        this.createEnemyScorePanel(enemyPanelX, scorePanelY, scorePanelSize, scorePanelSize);
        
        const roundsPanelX = playerPanelX + scorePanelSize + 10;
        const roundsPanelWidth = enemyPanelX - roundsPanelX - 10;
        this.createRoundsResultPanel(roundsPanelX, y + 4, roundsPanelWidth, height - 8);
    }
    
    createPlayerScorePanel(x, y, width, height) {
        console.log('[SimpleGameScene] Creating Player Score panel:', x, y, width, height);
        
        const bg = this.add.graphics();
        bg.fillStyle(0xe6f2ff, 1);
        bg.fillRect(x, y, width, height);
        bg.lineStyle(2, 0x0066cc, 1);
        bg.strokeRect(x, y, width, height);
        
        this.add.text(x + width / 2, y + 6, 'PLAYER', {
            font: `bold ${UI.small}px monospace`,
            fill: '#0066cc'
        }).setOrigin(0.5, 0);
        
        this.playerScoreText = this.add.text(x + width / 2, y + height / 2 + 4, '0', {
            font: `bold ${UI.title}px monospace`,
            fill: '#0066cc'
        }).setOrigin(0.5);
    }
    
    createEnemyScorePanel(x, y, width, height) {
        console.log('[SimpleGameScene] Creating Enemy Score panel:', x, y, width, height);
        
        const bg = this.add.graphics();
        bg.fillStyle(0xffe6e6, 1);
        bg.fillRect(x, y, width, height);
        bg.lineStyle(2, 0xcc0000, 1);
        bg.strokeRect(x, y, width, height);
        
        this.add.text(x + width / 2, y + 6, 'ENEMY', {
            font: `bold ${UI.small}px monospace`,
            fill: '#cc0000'
        }).setOrigin(0.5, 0);
        
        this.enemyScoreText = this.add.text(x + width / 2, y + height / 2 + 4, '0', {
            font: `bold ${UI.title}px monospace`,
            fill: '#cc0000'
        }).setOrigin(0.5);
    }
    
    createRoundsResultPanel(x, y, width, height) {
        console.log('[SimpleGameScene] Creating Rounds Result panel:', x, y, width, height);
        
        const bg = this.add.graphics();
        bg.fillStyle(0xf5f5f5, 1);
        bg.fillRect(x, y, width, height);
        bg.lineStyle(2, 0x666666, 1);
        bg.strokeRect(x, y, width, height);
        
        this.add.text(x + width / 2, y + 5, 'ROUNDS', {
            font: `bold ${UI.small}px monospace`,
            fill: '#333333'
        }).setOrigin(0.5, 0);
        
        this.roundsContainer = this.add.container(x + width / 2, y + height / 2 + 4);
    }

    createStatusCard(x, y, width, height) {
        console.log('[SimpleGameScene] Creating status card:', x, y, width, height);
        
        this.strokePanel(x, y, width, height);
        
        const pad = 10;
        this.createMainPanel(x + pad, y + pad, width - pad * 2, height - pad * 2);
    }

    createCurrentMovePanel(x, y, width, height) {
        console.log('[SimpleGameScene] Creating Current Move panel:', x, y, width, height);
        
        this.currentMovePanelX = x;
        this.currentMovePanelY = y;
        this.currentMovePanelWidth = width;
        this.currentMovePanelHeight = height;
        
        this.strokePanel(x, y, width, height);
        
        const panelContentY = y + 8;
        const panelContentHeight = height - 16;
        
        const sideRatio = this.layout.sideColumnRatio || 0.22;
        const sidePanelWidth = Math.max(64, Math.floor(width * sideRatio));
        const sidePanelHeight = panelContentHeight;
        const sidePanelY = panelContentY;
        
        const leftPanelX = x + 10;
        this.createSidePlaceholder(leftPanelX, sidePanelY, sidePanelWidth, sidePanelHeight, 'PLAYER', 'leftPanelText');
        
        const enemyPanelX = x + width - sidePanelWidth - 10;
        this.createSidePlaceholder(enemyPanelX, sidePanelY, sidePanelWidth, sidePanelHeight, 'ENEMY', 'enemyPanelText');
        
        const movePanelX = leftPanelX + sidePanelWidth + 10;
        const movePanelWidth = enemyPanelX - movePanelX - 10;
        this.createMainPanel(movePanelX, sidePanelY, movePanelWidth, sidePanelHeight);
    }
    
    createSidePlaceholder(x, y, width, height, label, textKey) {
        const bg = this.add.graphics();
        bg.fillStyle(0xf0f0f0, 1);
        bg.fillRect(x, y, width, height);
        bg.lineStyle(1, 0x666666, 1);
        bg.strokeRect(x, y, width, height);
        
        this.add.text(x + width / 2, y + 10, label, {
            font: `bold ${UI.small}px monospace`,
            fill: '#666666'
        }).setOrigin(0.5, 0);
        
        this[textKey] = this.add.text(x + width / 2, y + height / 2, '', {
            font: `${UI.body}px monospace`,
            fill: '#000000'
        }).setOrigin(0.5);
    }

    createMainPanel(x, y, width, height) {
        console.log('[SimpleGameScene] Creating Main panel:', x, y, width, height);
        
        const bg = this.add.graphics();
        bg.fillStyle(0xfafafa, 1);
        bg.fillRect(x, y, width, height);
        bg.lineStyle(1, 0xcccccc, 1);
        bg.strokeRect(x, y, width, height);
        
        const statusFont = this.layout.statusFont === 'heading' ? UI.heading : UI.body;
        
        this.currentMoveText = this.add.text(x + width / 2, y + height / 2, 'Loading match...', {
            font: `${statusFont}px monospace`,
            fill: '#666666',
            wordWrap: { width: width - 20 },
            align: 'center'
        }).setOrigin(0.5);
    }

    createThumbPlayPanel(x, y, width, height) {
        console.log('[SimpleGameScene] Creating thumb play panel:', x, y, width, height);
        
        this.strokePanel(x, y, width, height);
        
        const pad = 10;
        const gap = 10;
        const goH = this.layout.goH;
        const moveH = this.layout.moveH;
        const cancelH = this.layout.cancelH;
        const stackH = goH + gap + moveH + gap + cancelH;
        const stackTop = y + height - pad - stackH;
        
        const goW = width - pad * 2;
        this.createGoButton(x + width / 2, stackTop + goH / 2, goW, goH);
        
        const n = 3;
        const btnW = Math.floor((width - pad * 2 - gap * (n - 1)) / n);
        const startX = x + pad + btnW / 2;
        const moveY = stackTop + goH + gap + moveH / 2;
        
        this.actionButtons = [];
        this.actionButtons.push(this.createActionButton(startX, moveY, 'STONE', () => this.onPrepareMove('Stone'), btnW, moveH, 'Stone'));
        this.actionButtons.push(this.createActionButton(startX + btnW + gap, moveY, 'SCISSORS', () => this.onPrepareMove('Scissors'), btnW, moveH, 'Scissors'));
        this.actionButtons.push(this.createActionButton(startX + (btnW + gap) * 2, moveY, 'PAPER', () => this.onPrepareMove('Paper'), btnW, moveH, 'Paper'));
        
        const rowY = stackTop + goH + gap + moveH + gap + cancelH / 2;
        const halfW = Math.floor((width - pad * 2 - gap) / 2);
        const cancelX = x + pad + halfW / 2;
        const backX = x + width - pad - halfW / 2;
        
        this.actionButtons.push(this.createActionButton(cancelX, rowY, 'CANCEL', () => this.onCancelAction(), halfW, cancelH));
        this.createBackButton(backX, rowY, halfW, cancelH);
    }

    createTwoRowActionPanel(x, y, width, height) {
        console.log('[SimpleGameScene] Creating two-row action panel:', x, y, width, height);
        
        this.strokePanel(x, y, width, height);
        
        const pad = 10;
        const gap = 8;
        const goH = this.layout.goH;
        const goW = this.layout.goW;
        const moveH = this.layout.moveH;
        const cancelH = this.layout.cancelH;
        const stackH = Math.max(goH, cancelH) + gap + moveH;
        const stackTop = y + height - pad - stackH;
        
        const topY = stackTop + Math.max(goH, cancelH) / 2;
        const cancelW = width - pad * 2 - gap - goW;
        
        this.actionButtons = [];
        this.actionButtons.push(this.createActionButton(
            x + pad + cancelW / 2,
            topY,
            'CANCEL',
            () => this.onCancelAction(),
            cancelW,
            cancelH
        ));
        this.createGoButton(x + width - pad - goW / 2, topY, goW, goH);
        
        const n = 3;
        const btnW = Math.floor((width - pad * 2 - gap * (n - 1)) / n);
        const startX = x + pad + btnW / 2;
        const moveY = stackTop + Math.max(goH, cancelH) + gap + moveH / 2;
        
        this.actionButtons.push(this.createActionButton(startX, moveY, 'STONE', () => this.onPrepareMove('Stone'), btnW, moveH, 'Stone'));
        this.actionButtons.push(this.createActionButton(startX + btnW + gap, moveY, 'SCISSORS', () => this.onPrepareMove('Scissors'), btnW, moveH, 'Scissors'));
        this.actionButtons.push(this.createActionButton(startX + (btnW + gap) * 2, moveY, 'PAPER', () => this.onPrepareMove('Paper'), btnW, moveH, 'Paper'));
    }

    createGridActionPanel(x, y, width, height) {
        console.log('[SimpleGameScene] Creating grid action panel:', x, y, width, height);
        
        this.strokePanel(x, y, width, height);
        
        const pad = 10;
        const gap = 10;
        const tile = this.layout.moveH;
        const cancelH = this.layout.cancelH;
        const gridW = tile * 2 + gap;
        const gridH = tile * 2 + gap;
        const stackH = gridH + gap + cancelH;
        const stackTop = y + height - pad - stackH;
        const gridLeft = x + (width - gridW) / 2;
        
        const col1 = gridLeft + tile / 2;
        const col2 = gridLeft + tile + gap + tile / 2;
        const row1 = stackTop + tile / 2;
        const row2 = stackTop + tile + gap + tile / 2;
        
        this.actionButtons = [];
        this.actionButtons.push(this.createActionButton(col1, row1, 'STONE', () => this.onPrepareMove('Stone'), tile, tile, 'Stone'));
        this.actionButtons.push(this.createActionButton(col2, row1, 'SCISSORS', () => this.onPrepareMove('Scissors'), tile, tile, 'Scissors'));
        this.actionButtons.push(this.createActionButton(col1, row2, 'PAPER', () => this.onPrepareMove('Paper'), tile, tile, 'Paper'));
        this.createGoButton(col2, row2, tile, tile);
        
        this.actionButtons.push(this.createActionButton(
            x + width / 2,
            stackTop + gridH + gap + cancelH / 2,
            'CANCEL',
            () => this.onCancelAction(),
            Math.min(220, width - pad * 2),
            cancelH
        ));
    }
    
    createGoButton(x, y, btnWidth = 72, btnHeight = 64) {
        console.log('[SimpleGameScene] Creating GO button at:', x, y, btnWidth, btnHeight);
        
        const btn = this.add.container(x, y);
        
        const bg = this.add.graphics();
        bg.lineStyle(2, 0x000000, 1);
        bg.strokeRect(-btnWidth/2, -btnHeight/2, btnWidth, btnHeight);
        
        const text = this.add.text(0, 0, 'GO', {
            font: `bold ${UI.heading}px monospace`,
            fill: '#000000'
        }).setOrigin(0.5);
        
        btn.add([bg, text]);
        
        btn.buttonBg = bg;
        btn.buttonText = text;
        btn.buttonWidth = btnWidth;
        btn.buttonHeight = btnHeight;
        btn.isEnabled = false;
        
        const hitArea = new Phaser.Geom.Rectangle(-btnWidth/2, -btnHeight/2, btnWidth, btnHeight);
        btn.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);

        bindPress(this, btn, {
            isEnabled: () => btn.isEnabled,
            idleKind: 'go',
            tapFx: 'ring',
            ghostLabel: 'GO',
            ringColor: 0x00cc00,
            onClick: () => this.onGoButtonClick()
        });
        
        this.goButton = btn;
        this.disableGoButton();
        
        return btn;
    }
    
    enableGoButton() {
        if (!this.goButton || this.goButton.isEnabled) return;
        
        this.goButton.isEnabled = true;
        redrawWireButton(this.goButton, 'goOn');
        fxStartIdle(this, this.goButton, 'go');
        
        console.log('[SimpleGameScene] GO button enabled');
    }
    
    disableGoButton() {
        if (!this.goButton) return;
        
        this.goButton.isEnabled = false;
        fxStopIdle(this, this.goButton);
        redrawWireButton(this.goButton, 'goOff');
        
        console.log('[SimpleGameScene] GO button disabled');
    }

    createActionButton(x, y, label, callback, btnWidth = 82, btnHeight = 64, moveType = null) {
        const btn = this.add.container(x, y);

        const bg = this.add.graphics();
        bg.lineStyle(2, 0x000000, 1);
        bg.strokeRect(-btnWidth/2, -btnHeight/2, btnWidth, btnHeight);
        
        const text = this.add.text(0, 0, label, {
            font: `${UI.body}px monospace`,
            fill: '#000000'
        }).setOrigin(0.5);
        
        btn.add([bg, text]);
        
        btn.buttonBg = bg;
        btn.buttonText = text;
        btn.buttonWidth = btnWidth;
        btn.buttonHeight = btnHeight;
        btn.buttonCallback = callback;
        btn.isEnabled = true;
        btn.isSelected = false;
        btn.moveType = moveType;
        
        const hitArea = new Phaser.Geom.Rectangle(-btnWidth/2, -btnHeight/2, btnWidth, btnHeight);
        btn.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);

        bindPress(this, btn, {
            isEnabled: () => btn.isEnabled,
            tapFx: moveType ? 'ring' : 'none',
            ghostLabel: moveType ? label : null,
            onClick: () => callback()
        });
        
        return btn;
    }

    createBackButton(x, y, btnWidth, btnHeight) {
        const width = btnWidth || this.layout.backW;
        const height = btnHeight || this.layout.backH;
        const btn = this.add.container(x, y);
        
        const bg = this.add.graphics();
        bg.lineStyle(2, 0x000000, 1);
        bg.strokeRect(-width/2, -height/2, width, height);
        
        const label = width < 56 ? '<' : 'BACK';
        const text = this.add.text(0, 0, label, {
            font: `${width < 56 ? UI.heading : UI.body}px monospace`,
            fill: '#000000'
        }).setOrigin(0.5);
        
        btn.add([bg, text]);
        
        const hitArea = new Phaser.Geom.Rectangle(-width/2, -height/2, width, height);
        btn.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);

        bindPress(this, btn, {
            tapFx: 'none',
            onClick: () => {
                console.log('[SimpleGameScene] Back button clicked');
                fxGoTo(this, 'MenuScene');
            }
        });
        
        return btn;
    }
    
    onCancelAction() {
        console.log('[SimpleGameScene] onCancelAction() called');
        this.clearCurrentAction();
        console.log('[SimpleGameScene] Action cancelled, state cleared');
    }
    
    onPrepareMove(moveType) {
        console.log('[SimpleGameScene] onPrepareMove() called with:', moveType);
        
        if (!this.currentGameId) {
            this.showErrorModal('No Active Game', 'Please start a new game first.');
            return;
        }
        
        const user = this.registry.get('currentUser');
        const userId = user?.id;
        
        if (!userId) {
            this.showErrorModal('User Not Found', 'Could not find user ID. Please try logging in again.');
            return;
        }
        
        const actionContext = {
            type: 'Move',
            context: {
                move: {
                    userId: userId,
                    context: {
                        moveType: moveType,
                        size: 0,
                        decorId: 0
                    },
                    time: Date.now()
                }
            }
        };
        
        console.log('[SimpleGameScene] Action prepared:', actionContext);
        this.setCurrentAction(actionContext);
    }
    
    async onGoButtonClick() {
        console.log('[SimpleGameScene] onGoButtonClick() called');
        
        if (!this.sceneState.isActionReady || !this.sceneState.currentAction) {
            console.warn('[SimpleGameScene] No action ready to send');
            return;
        }
        
        if (!this.currentGameId) {
            this.showErrorModal('No Active Game', 'Please start a new game first.');
            return;
        }
        
        try {
            const actionContext = this.sceneState.currentAction;
            const moveType = actionContext.context?.move?.context?.moveType || 'Unknown';
            
            this.updateGameStatus(`Sending ${moveType}...`);
            this.goButton.isEnabled = false;
            fxStopIdle(this, this.goButton);
            redrawWireButton(this.goButton, 'goFlash');
            this.time.delayedCall(100, () => {
                if (this.goButton) {
                    this.disableGoButton();
                }
            });
            
            console.log('[SimpleGameScene] Sending move action:', actionContext);
            
            const response = await gameClient.updateGame(this.currentGameId, actionContext);
            console.log('[SimpleGameScene] Move response:', response);
            
            const statusLower = response.status?.toLowerCase();
            if (statusLower === 'failed' || statusLower === 'error') {
                const errorMsg = response.message || response.detail || 'The move could not be processed.';
                this.showErrorModal('Move Failed', errorMsg);
                this.clearCurrentAction();
                return;
            }
            
            if (response.message && response.message.toLowerCase().includes('error')) {
                this.showErrorModal('Move Failed', response.message);
                this.clearCurrentAction();
                return;
            }
            
            this.gameData = response;
            this.clearCurrentAction();
            await this.loadGame(this.currentGameId);
            
            console.log('[SimpleGameScene] Game reloaded after successful move');
            
        } catch (error) {
            console.error('[SimpleGameScene] Failed to send move:', error);
            
            let errorMessage = 'An unexpected error occurred.';
            let errorTitle = 'Move Failed';
            
            if (error.statusCode) {
                errorTitle = `Error ${error.statusCode}`;
            }
            
            if (error.message) {
                errorMessage = error.message;
            }
            
            if (error.data) {
                if (error.data.detail) {
                    errorMessage = error.data.detail;
                } else if (error.data.message) {
                    errorMessage = error.data.message;
                }
            }
            
            this.showErrorModal(errorTitle, errorMessage);
            this.clearCurrentAction();
        }
    }
    
    showErrorModal(title, message) {
        console.log('[SimpleGameScene] showErrorModal():', title, message);
        
        this.scene.launch('ErrorModalScene', {
            errorTitle: title,
            errorMessage: message
        });
    }
}
