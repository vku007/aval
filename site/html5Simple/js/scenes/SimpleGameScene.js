/**
 * SimpleGameScene
 * Main game scene with vertical layout
 */
class SimpleGameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'SimpleGameScene' });
    }
    
    initializeSceneState(data) {
        console.log('[SimpleGameScene] initializeSceneState() started');
        
        // Game data
        this.currentGameId = data.gameId || null;
        this.gameData = null;
        
        // Scene state for action management
        this.sceneState = {
            currentAction: null,  // Stores the prepared action before sending to backend
            isActionReady: false  // Flag to track if action is ready to be sent
        };
        
        console.log('[SimpleGameScene] Scene state initialized:', this.sceneState);
    }
    
    setCurrentAction(action) {
        console.log('[SimpleGameScene] setCurrentAction() called with:', action);
        
        this.sceneState.currentAction = action;
        this.sceneState.isActionReady = action !== null;
        
        // Update GO button state
        if (this.sceneState.isActionReady) {
            this.enableGoButton();
        } else {
            this.disableGoButton();
        }
        
        // Update UI to show current action
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
            this.currentMoveText.setText(`Action prepared: ${moveType}\n\nPress GO to confirm`);
        } else {
            const gameStatus = SimpleGameSceneUtil.getGameStatus(this.gameData);
            this.currentMoveText.setText(`Status: ${gameStatus}\n\nSelect an action`);
        }
    }

    create(data) {
        console.log('[SimpleGameScene] create() started with data:', data);
        
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        console.log('[SimpleGameScene] Canvas size:', width, 'x', height);
        
        // Initialize scene state
        this.initializeSceneState(data);
        
        console.log('[SimpleGameScene] Received gameId:', this.currentGameId);
        
        // Calculate panel heights (vertical layout)
        const charactersHeight = height * 0.15;  // 15%
        const gameResultsHeight = height * 0.15;  // 15%
        const currentMoveHeight = height * 0.40;  // 40%
        const actionPanelHeight = height * 0.30;  // 30%
        
        // Calculate Y positions
        let currentY = 0;
        
        // 1. Characters Panel (top 15%)
        this.createCharactersPanel(0, currentY, width, charactersHeight);
        currentY += charactersHeight;
        
        // 2. Game Results Panel (15%)
        this.createGameResultsPanel(0, currentY, width, gameResultsHeight);
        currentY += gameResultsHeight;
        
        // 3. Current Move Panel (40%)
        this.createCurrentMovePanel(0, currentY, width, currentMoveHeight);
        currentY += currentMoveHeight;
        
        // 4. Action Panel (30%)
        this.createActionPanel(0, currentY, width, actionPanelHeight);
        
        // Add back button in top-right corner
        this.createBackButton(width - 80, 20);
        
        // Initialize game (create new game or load existing)
        this.initializeGame();
    }
    
    async initializeGame() {
        console.log('[SimpleGameScene] initializeGame() started');
        
        try {
            // Check if gameClient is available
            if (typeof gameClient === 'undefined') {
                console.error('[SimpleGameScene] gameClient not available');
                this.showError('Game client not initialized');
                return;
            }
            
            // If we have a gameId, load it; otherwise show error
            if (this.currentGameId) {
                console.log('[SimpleGameScene] Loading existing game:', this.currentGameId);
                this.updateGameStatus(`Loading game: ${this.currentGameId}`);
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
        
        // Update the current move panel with game status using utility
        const gameStatus = SimpleGameSceneUtil.getGameStatus(this.gameData);
        this.updateGameStatus(`Status: ${gameStatus}`);
        
        // Update enemy name using utility
        const enemyName = SimpleGameSceneUtil.getEnemyName(this.gameData);
        if (this.enemyNameText) {
            this.enemyNameText.setText(enemyName);
        }
        
        // Update score from game data
        this.updateScore();
        
        // Update rounds display
        this.updateRoundsDisplay();
        
        // Update action buttons based on game status
        this.updateActionButtons();
    }
    
    updateScore() {
        console.log('[SimpleGameScene] updateScore() called');
        
        if (!this.gameData || !this.playerScoreText || !this.enemyScoreText) {
            return;
        }
        
        // Get current user ID
        const user = this.registry.get('currentUser');
        const userId = user?.id;
        
        if (!userId) {
            console.warn('[SimpleGameScene] No userId available for score calculation');
            this.playerScoreText.setText('0');
            this.enemyScoreText.setText('0');
            return;
        }
        
        // Calculate score using utility
        const { playerScore, enemyScore } = SimpleGameSceneUtil.calculateScore(this.gameData, userId);
        
        // Update the score texts in separate panels
        this.playerScoreText.setText(String(playerScore));
        this.enemyScoreText.setText(String(enemyScore));
    }
    
    updateRoundsDisplay() {
        console.log('[SimpleGameScene] updateRoundsDisplay() called');
        
        if (!this.gameData || !this.roundsContainer) {
            return;
        }
        
        // Clear existing round displays
        this.roundsContainer.removeAll(true);
        
        // Get total number of possible rounds from initGameContext
        const roundsLength = this.gameData.payload?.gameContext?.initGameContext?.rounds;
        const totalRounds = this.getRoundsAmount(roundsLength);
        
        console.log('[SimpleGameScene] Rounds length:', roundsLength, 'Total rounds:', totalRounds);
        
        if (totalRounds === 0) {
            console.warn('[SimpleGameScene] Could not determine total rounds');
            return;
        }
        
        // Get actual round states (only finished or current rounds)
        const roundStates = this.gameData.payload?.playerContext?.roundStates || [];
        
        // Get current user ID for winner comparison
        const user = this.registry.get('currentUser');
        const userId = user?.id;
        
        // Display rounds horizontally, center-aligned
        const roundSize = 25; // Square panels (50% smaller)
        const roundSpacing = 5;
        const totalWidth = (totalRounds * roundSize) + ((totalRounds - 1) * roundSpacing);
        const startX = -totalWidth / 2; // Center alignment (container is already centered)
        
        // Create panels for all possible rounds
        for (let i = 0; i < totalRounds; i++) {
            const roundX = startX + (i * (roundSize + roundSpacing));
            const roundNum = i + 1;
            
            // Check if we have data for this round
            if (i < roundStates.length) {
                // Round exists in roundStates - show actual result
                this.createRoundResultPanel(roundX, 0, roundSize, roundStates[i], roundNum, userId);
            } else {
                // Round doesn't exist yet - show placeholder
                this.createPlaceholderRoundPanel(roundX, 0, roundSize, roundNum);
            }
        }
    }
    
    getRoundsAmount(roundsLength) {
        // Map RoundsLength enum to actual number of rounds
        const roundsMap = {
            'BO1': 1,
            'BO3': 3,
            'BO7': 7
        };
        
        return roundsMap[roundsLength] || 0;
    }
    
    createRoundResultPanel(x, y, size, roundData, roundNum, userId) {
        console.log('[SimpleGameScene] Creating round result panel:', roundNum);
        console.log('[SimpleGameScene] Full roundData:', JSON.stringify(roundData, null, 2));
        console.log('[SimpleGameScene] roundData.status:', roundData.status);
        console.log('[SimpleGameScene] roundData.winnerId:', roundData.winnerId);
        
        // Round container
        const roundContainer = this.add.container(x, y);
        
        // Determine the result type and colors
        let bgColor, borderColor, iconType;
        
        // Check if round is finished (RoundStatus.Finished = 'finished')
        const isFinished = roundData.status && roundData.status.toLowerCase() === 'finished';
        console.log('[SimpleGameScene] isFinished:', isFinished);
        
        if (isFinished) {
            // Round is finished, check winner
            const winnerIdStr = String(roundData.winnerId);
            const userIdStr = String(userId);
            
            console.log('[SimpleGameScene] Comparing winnerId:', winnerIdStr, 'with userId:', userIdStr);
            
            if (winnerIdStr === userIdStr) {
                // Player won - green check
                bgColor = 0xe6ffe6;
                borderColor = 0x00cc00;
                iconType = 'check';
            } else {
                // Enemy won - red cross
                bgColor = 0xffe6e6;
                borderColor = 0xcc0000;
                iconType = 'cross';
            }
        } else {
            // Round not finished - yellow circle
            bgColor = 0xffffe6;
            borderColor = 0xcccc00;
            iconType = 'circle';
        }
        
        // Panel background
        const bg = this.add.graphics();
        bg.fillStyle(bgColor, 1);
        bg.fillRect(0, 0, size, size);
        
        // Panel border (thinner for smaller size)
        bg.lineStyle(1, borderColor, 1);
        bg.strokeRect(0, 0, size, size);
        
        roundContainer.add(bg);
        
        // Draw icon based on type
        const iconGraphics = this.add.graphics();
        const centerX = size / 2;
        const centerY = size / 2;
        const iconSize = size * 0.6; // Slightly larger relative to panel
        
        if (iconType === 'check') {
            // Draw green check mark (thinner line for smaller size)
            iconGraphics.lineStyle(2, 0x00cc00, 1);
            iconGraphics.beginPath();
            iconGraphics.moveTo(centerX - iconSize/2, centerY);
            iconGraphics.lineTo(centerX - iconSize/6, centerY + iconSize/2);
            iconGraphics.lineTo(centerX + iconSize/2, centerY - iconSize/2);
            iconGraphics.strokePath();
            
        } else if (iconType === 'cross') {
            // Draw red cross (X) (thinner line for smaller size)
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
            // Draw yellow circle (O) (thinner line for smaller size)
            iconGraphics.lineStyle(2, 0xcccc00, 1);
            iconGraphics.strokeCircle(centerX, centerY, iconSize/2);
        }
        
        roundContainer.add(iconGraphics);
        
        // Add round number at the bottom (smaller font)
        const numText = this.add.text(centerX, size - 3, `${roundNum}`, {
            font: 'bold 7px monospace',
            fill: '#666666'
        }).setOrigin(0.5, 1);
        
        roundContainer.add(numText);
        
        this.roundsContainer.add(roundContainer);
    }
    
    createPlaceholderRoundPanel(x, y, size, roundNum) {
        console.log('[SimpleGameScene] Creating placeholder round panel:', roundNum);
        
        // Round container
        const roundContainer = this.add.container(x, y);
        
        // Gray background for placeholder
        const bgColor = 0xf0f0f0;
        const borderColor = 0x999999;
        
        // Panel background
        const bg = this.add.graphics();
        bg.fillStyle(bgColor, 1);
        bg.fillRect(0, 0, size, size);
        
        // Panel border (thinner for smaller size)
        bg.lineStyle(1, borderColor, 1);
        bg.strokeRect(0, 0, size, size);
        
        roundContainer.add(bg);
        
        // Draw dash/minus icon
        const iconGraphics = this.add.graphics();
        const centerX = size / 2;
        const centerY = size / 2;
        const dashWidth = size * 0.5;
        
        // Draw horizontal dash (-)
        iconGraphics.lineStyle(2, 0x999999, 1);
        iconGraphics.beginPath();
        iconGraphics.moveTo(centerX - dashWidth/2, centerY);
        iconGraphics.lineTo(centerX + dashWidth/2, centerY);
        iconGraphics.strokePath();
        
        roundContainer.add(iconGraphics);
        
        // Add round number at the bottom (smaller font)
        const numText = this.add.text(centerX, size - 3, `${roundNum}`, {
            font: 'bold 7px monospace',
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
        
        // Check if game is finished using utility
        const isFinished = SimpleGameSceneUtil.isGameFinished(this.gameData);
        console.log('[SimpleGameScene] Game finished?', isFinished);
        
        // Enable or disable buttons based on game status
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
        
        // Update visual appearance
        btn.buttonBg.clear();
        btn.buttonBg.fillStyle(0xcccccc, 1);
        btn.buttonBg.fillRect(-btn.buttonWidth/2, -btn.buttonHeight/2, btn.buttonWidth, btn.buttonHeight);
        btn.buttonBg.lineStyle(2, 0x999999, 1);
        btn.buttonBg.strokeRect(-btn.buttonWidth/2, -btn.buttonHeight/2, btn.buttonWidth, btn.buttonHeight);
        
        btn.buttonText.setColor('#999999');
        btn.disableInteractive();
        
        console.log('[SimpleGameScene] Button disabled:', btn.buttonText.text);
    }
    
    enableButton(btn) {
        if (btn.isEnabled) return;
        
        btn.isEnabled = true;
        
        // Restore visual appearance
        btn.buttonBg.clear();
        btn.buttonBg.lineStyle(2, 0x000000, 1);
        btn.buttonBg.strokeRect(-btn.buttonWidth/2, -btn.buttonHeight/2, btn.buttonWidth, btn.buttonHeight);
        
        btn.buttonText.setColor('#000000');
        btn.setInteractive();
        
        console.log('[SimpleGameScene] Button enabled:', btn.buttonText.text);
    }
    
    updateGameStatus(text) {
        // Update the current move text if it exists
        if (this.currentMoveText) {
            this.currentMoveText.setText(text);
        }
    }
    
    showError(message) {
        console.error('[SimpleGameScene] Error:', message);
        // Display error in the current move panel
        if (this.currentMoveText) {
            this.currentMoveText.setText(`ERROR: ${message}`);
        }
    }

    createCharactersPanel(x, y, width, height) {
        console.log('[SimpleGameScene] Creating Characters panel:', x, y, width, height);
        
        // Panel background
        const bg = this.add.graphics();
        bg.lineStyle(2, 0x000000, 1);
        bg.strokeRect(x, y, width, height);
        
        // Panel label
        this.add.text(x + 10, y + 10, 'CHARACTERS', {
            font: '16px monospace',
            fill: '#000000'
        }).setOrigin(0, 0);
        
        // Get player name from registry
        const user = this.registry.get('currentUser');
        const playerName = user?.name || 'Player';
        
        // Player name (left corner)
        this.playerNameText = this.add.text(x + 20, y + height / 2, playerName, {
            font: '20px monospace',
            fill: '#000000'
        }).setOrigin(0, 0.5);
        
        // VS text (center)
        this.add.text(x + width / 2, y + height / 2, 'VS', {
            font: '18px monospace',
            fill: '#666666'
        }).setOrigin(0.5);
        
        // Enemy name (right corner)
        this.enemyNameText = this.add.text(x + width - 20, y + height / 2, 'Enemy', {
            font: '20px monospace',
            fill: '#000000'
        }).setOrigin(1, 0.5);
    }

    createGameResultsPanel(x, y, width, height) {
        console.log('[SimpleGameScene] Creating Game Results panel:', x, y, width, height);
        
        // Store panel dimensions for updates
        this.resultsPanelX = x;
        this.resultsPanelY = y;
        this.resultsPanelWidth = width;
        this.resultsPanelHeight = height;
        
        // Main panel background
        const bg = this.add.graphics();
        bg.lineStyle(2, 0x000000, 1);
        bg.strokeRect(x, y, width, height);
        
        // Panel label
        this.add.text(x + 10, y + 10, 'GAME RESULTS', {
            font: '16px monospace',
            fill: '#000000'
        }).setOrigin(0, 0);
        
        // Calculate sub-panel dimensions
        const panelContentY = y + 35;
        const panelContentHeight = height - 35;
        
        // Square panels for scores (left and right)
        const scorePanelSize = Math.min(panelContentHeight - 10, 80);
        const scorePanelY = panelContentY + (panelContentHeight - scorePanelSize) / 2;
        
        // Player score panel (left, square)
        const playerPanelX = x + 10;
        this.createPlayerScorePanel(playerPanelX, scorePanelY, scorePanelSize, scorePanelSize);
        
        // Enemy score panel (right, square)
        const enemyPanelX = x + width - scorePanelSize - 10;
        this.createEnemyScorePanel(enemyPanelX, scorePanelY, scorePanelSize, scorePanelSize);
        
        // Rounds result panel (center)
        const roundsPanelX = playerPanelX + scorePanelSize + 10;
        const roundsPanelWidth = enemyPanelX - roundsPanelX - 10;
        this.createRoundsResultPanel(roundsPanelX, panelContentY + 5, roundsPanelWidth, panelContentHeight - 10);
    }
    
    createPlayerScorePanel(x, y, width, height) {
        console.log('[SimpleGameScene] Creating Player Score panel:', x, y, width, height);
        
        // Panel background (light blue)
        const bg = this.add.graphics();
        bg.fillStyle(0xe6f2ff, 1);
        bg.fillRect(x, y, width, height);
        
        // Panel border (blue)
        bg.lineStyle(2, 0x0066cc, 1);
        bg.strokeRect(x, y, width, height);
        
        // Label
        this.add.text(x + width / 2, y + 10, 'PLAYER', {
            font: 'bold 12px monospace',
            fill: '#0066cc'
        }).setOrigin(0.5, 0);
        
        // Score text (store reference for updates)
        this.playerScoreText = this.add.text(x + width / 2, y + height / 2, '0', {
            font: 'bold 32px monospace',
            fill: '#0066cc'
        }).setOrigin(0.5);
    }
    
    createEnemyScorePanel(x, y, width, height) {
        console.log('[SimpleGameScene] Creating Enemy Score panel:', x, y, width, height);
        
        // Panel background (light red)
        const bg = this.add.graphics();
        bg.fillStyle(0xffe6e6, 1);
        bg.fillRect(x, y, width, height);
        
        // Panel border (red)
        bg.lineStyle(2, 0xcc0000, 1);
        bg.strokeRect(x, y, width, height);
        
        // Label
        this.add.text(x + width / 2, y + 10, 'ENEMY', {
            font: 'bold 12px monospace',
            fill: '#cc0000'
        }).setOrigin(0.5, 0);
        
        // Score text (store reference for updates)
        this.enemyScoreText = this.add.text(x + width / 2, y + height / 2, '0', {
            font: 'bold 32px monospace',
            fill: '#cc0000'
        }).setOrigin(0.5);
    }
    
    createRoundsResultPanel(x, y, width, height) {
        console.log('[SimpleGameScene] Creating Rounds Result panel:', x, y, width, height);
        
        // Panel background (light gray)
        const bg = this.add.graphics();
        bg.fillStyle(0xf5f5f5, 1);
        bg.fillRect(x, y, width, height);
        
        // Panel border (gray)
        bg.lineStyle(2, 0x666666, 1);
        bg.strokeRect(x, y, width, height);
        
        // Label
        this.add.text(x + width / 2, y + 5, 'ROUNDS', {
            font: 'bold 10px monospace',
            fill: '#333333'
        }).setOrigin(0.5, 0);
        
        // Container for round representations (will be populated dynamically)
        // Position it in the center of the panel
        this.roundsContainer = this.add.container(x + width / 2, y + height / 2);
    }

    createCurrentMovePanel(x, y, width, height) {
        console.log('[SimpleGameScene] Creating Current Move panel:', x, y, width, height);
        
        // Store panel dimensions
        this.currentMovePanelX = x;
        this.currentMovePanelY = y;
        this.currentMovePanelWidth = width;
        this.currentMovePanelHeight = height;
        
        // Main panel background
        const bg = this.add.graphics();
        bg.lineStyle(2, 0x000000, 1);
        bg.strokeRect(x, y, width, height);
        
        // Panel label
        this.add.text(x + 10, y + 10, 'CURRENT MOVE', {
            font: '16px monospace',
            fill: '#000000'
        }).setOrigin(0, 0);
        
        // Calculate sub-panel dimensions
        const panelContentY = y + 35;
        const panelContentHeight = height - 35;
        
        // Fixed size for left and enemy panels
        const sidePanelWidth = 150;
        const sidePanelHeight = panelContentHeight - 10;
        const sidePanelY = panelContentY + 5;
        
        // Left panel (aligned to left, fixed size)
        const leftPanelX = x + 10;
        this.createLeftPanel(leftPanelX, sidePanelY, sidePanelWidth, sidePanelHeight);
        
        // Enemy panel (aligned to right, fixed size)
        const enemyPanelX = x + width - sidePanelWidth - 10;
        this.createEnemyPanel(enemyPanelX, sidePanelY, sidePanelWidth, sidePanelHeight);
        
        // Move panel (center, stretched)
        const movePanelX = leftPanelX + sidePanelWidth + 10;
        const movePanelWidth = enemyPanelX - movePanelX - 10;
        this.createMovePanel(movePanelX, sidePanelY, movePanelWidth, sidePanelHeight);
    }
    
    createLeftPanel(x, y, width, height) {
        console.log('[SimpleGameScene] Creating Left panel:', x, y, width, height);
        
        // Panel background
        const bg = this.add.graphics();
        bg.fillStyle(0xf0f0f0, 1);
        bg.fillRect(x, y, width, height);
        
        // Panel border
        bg.lineStyle(1, 0x666666, 1);
        bg.strokeRect(x, y, width, height);
        
        // Label
        this.add.text(x + width / 2, y + 10, 'PLAYER', {
            font: 'bold 10px monospace',
            fill: '#666666'
        }).setOrigin(0.5, 0);
        
        // Placeholder text (can be updated later)
        this.leftPanelText = this.add.text(x + width / 2, y + height / 2, '', {
            font: '12px monospace',
            fill: '#000000'
        }).setOrigin(0.5);
    }
    
    createEnemyPanel(x, y, width, height) {
        console.log('[SimpleGameScene] Creating Enemy panel:', x, y, width, height);
        
        // Panel background
        const bg = this.add.graphics();
        bg.fillStyle(0xf0f0f0, 1);
        bg.fillRect(x, y, width, height);
        
        // Panel border
        bg.lineStyle(1, 0x666666, 1);
        bg.strokeRect(x, y, width, height);
        
        // Label
        this.add.text(x + width / 2, y + 10, 'ENEMY', {
            font: 'bold 10px monospace',
            fill: '#666666'
        }).setOrigin(0.5, 0);
        
        // Placeholder text (can be updated later)
        this.enemyPanelText = this.add.text(x + width / 2, y + height / 2, '', {
            font: '12px monospace',
            fill: '#000000'
        }).setOrigin(0.5);
    }

    createMovePanel(x, y, width, height) {
        console.log('[SimpleGameScene] Creating Move panel:', x, y, width, height);
        
        // Panel background
        const bg = this.add.graphics();
        bg.fillStyle(0xffffff, 1);
        bg.fillRect(x, y, width, height);
        
        // Panel border
        bg.lineStyle(1, 0x000000, 1);
        bg.strokeRect(x, y, width, height);
        
        // Calculate sub-panel dimensions
        const goActionPanelWidth = 80; // Fixed size for GO button panel
        const goActionPanelX = x + 5;
        const goActionPanelY = y + 5;
        const goActionPanelHeight = height - 10;
        
        // Main panel (stretched, fills remaining space)
        const mainPanelX = goActionPanelX + goActionPanelWidth + 5;
        const mainPanelY = y + 5;
        const mainPanelWidth = width - goActionPanelWidth - 15;
        const mainPanelHeight = height - 10;
        
        // Create goActionPanel (left, fixed size)
        this.createGoActionPanel(goActionPanelX, goActionPanelY, goActionPanelWidth, goActionPanelHeight);
        
        // Create mainPanel (stretched)
        this.createMainPanel(mainPanelX, mainPanelY, mainPanelWidth, mainPanelHeight);
    }
    
    createGoActionPanel(x, y, width, height) {
        console.log('[SimpleGameScene] Creating GoAction panel:', x, y, width, height);
        
        // Panel background
        const bg = this.add.graphics();
        bg.fillStyle(0xf5f5f5, 1);
        bg.fillRect(x, y, width, height);
        
        // Panel border
        bg.lineStyle(1, 0x999999, 1);
        bg.strokeRect(x, y, width, height);
        
        // Create GO button
        this.createGoButton(x + width / 2, y + height / 2);
    }
    
    createGoButton(x, y) {
        console.log('[SimpleGameScene] Creating GO button at:', x, y);
        
        const btn = this.add.container(x, y);
        
        const btnWidth = 60;
        const btnHeight = 50;
        
        // Button background
        const bg = this.add.graphics();
        bg.lineStyle(2, 0x000000, 1);
        bg.strokeRect(-btnWidth/2, -btnHeight/2, btnWidth, btnHeight);
        
        // Button text
        const text = this.add.text(0, 0, 'GO', {
            font: 'bold 16px monospace',
            fill: '#000000'
        }).setOrigin(0.5);
        
        btn.add([bg, text]);
        
        // Store references for enabling/disabling
        btn.buttonBg = bg;
        btn.buttonText = text;
        btn.buttonWidth = btnWidth;
        btn.buttonHeight = btnHeight;
        btn.isEnabled = false; // Start disabled
        
        // Make interactive
        const hitArea = new Phaser.Geom.Rectangle(-btnWidth/2, -btnHeight/2, btnWidth, btnHeight);
        btn.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);
        
        btn.on('pointerover', () => {
            if (!btn.isEnabled) return;
            bg.clear();
            bg.lineStyle(3, 0x00cc00, 1);
            bg.strokeRect(-btnWidth/2, -btnHeight/2, btnWidth, btnHeight);
        });
        
        btn.on('pointerout', () => {
            if (!btn.isEnabled) return;
            bg.clear();
            bg.lineStyle(2, 0x00cc00, 1);
            bg.strokeRect(-btnWidth/2, -btnHeight/2, btnWidth, btnHeight);
        });
        
        btn.on('pointerdown', () => {
            if (btn.isEnabled) {
                this.onGoButtonClick();
            }
        });
        
        // Store reference
        this.goButton = btn;
        
        // Set initial disabled state
        this.disableGoButton();
        
        return btn;
    }
    
    createMainPanel(x, y, width, height) {
        console.log('[SimpleGameScene] Creating Main panel:', x, y, width, height);
        
        // Panel background
        const bg = this.add.graphics();
        bg.fillStyle(0xfafafa, 1);
        bg.fillRect(x, y, width, height);
        
        // Panel border
        bg.lineStyle(1, 0xcccccc, 1);
        bg.strokeRect(x, y, width, height);
        
        // Store reference to the status text so we can update it
        this.currentMoveText = this.add.text(x + width / 2, y + height / 2, 'Initializing game...', {
            font: '18px monospace',
            fill: '#666666',
            wordWrap: { width: width - 20 }
        }).setOrigin(0.5);
    }
    
    enableGoButton() {
        if (!this.goButton || this.goButton.isEnabled) return;
        
        this.goButton.isEnabled = true;
        
        // Update visual appearance (green border for enabled)
        this.goButton.buttonBg.clear();
        this.goButton.buttonBg.lineStyle(2, 0x00cc00, 1);
        this.goButton.buttonBg.strokeRect(-this.goButton.buttonWidth/2, -this.goButton.buttonHeight/2, this.goButton.buttonWidth, this.goButton.buttonHeight);
        
        this.goButton.buttonText.setColor('#00cc00');
        
        console.log('[SimpleGameScene] GO button enabled');
    }
    
    disableGoButton() {
        if (!this.goButton) return;
        
        this.goButton.isEnabled = false;
        
        // Update visual appearance (gray for disabled)
        this.goButton.buttonBg.clear();
        this.goButton.buttonBg.fillStyle(0xcccccc, 1);
        this.goButton.buttonBg.fillRect(-this.goButton.buttonWidth/2, -this.goButton.buttonHeight/2, this.goButton.buttonWidth, this.goButton.buttonHeight);
        this.goButton.buttonBg.lineStyle(2, 0x999999, 1);
        this.goButton.buttonBg.strokeRect(-this.goButton.buttonWidth/2, -this.goButton.buttonHeight/2, this.goButton.buttonWidth, this.goButton.buttonHeight);
        
        this.goButton.buttonText.setColor('#999999');
        
        console.log('[SimpleGameScene] GO button disabled');
    }
    
    onGoButtonClick() {
        console.log('[SimpleGameScene] GO button clicked');
        // TODO: Implement GO button action
        this.updateGameStatus('GO button clicked!');
    }

    createActionPanel(x, y, width, height) {
        console.log('[SimpleGameScene] Creating Action panel:', x, y, width, height);
        
        // Panel background
        const bg = this.add.graphics();
        bg.lineStyle(2, 0x000000, 1);
        bg.strokeRect(x, y, width, height);
        
        // Panel label
        this.add.text(x + 10, y + 10, 'ACTIONS', {
            font: '16px monospace',
            fill: '#000000'
        }).setOrigin(0, 0);
        
        // Action buttons for game moves
        const buttonY = y + height / 2;
        const buttonSpacing = 120;
        const startX = width / 2 - buttonSpacing * 1.5; // Adjusted for 4 buttons
        
        // Store button references for enabling/disabling (all action buttons including CANCEL)
        this.actionButtons = [];
        
        // Create CANCEL button (first in row, should be disabled when game is finished)
        this.actionButtons.push(this.createActionButton(startX, buttonY, 'CANCEL', () => this.onCancelAction()));
        
        // Create game move buttons
        this.actionButtons.push(this.createActionButton(startX + buttonSpacing, buttonY, 'STONE', () => this.onPrepareMove('Stone')));
        this.actionButtons.push(this.createActionButton(startX + buttonSpacing * 2, buttonY, 'SCISSORS', () => this.onPrepareMove('Scissors')));
        this.actionButtons.push(this.createActionButton(startX + buttonSpacing * 3, buttonY, 'PAPER', () => this.onPrepareMove('Paper')));
    }

    createActionButton(x, y, label, callback) {
        const btn = this.add.container(x, y);
        
        const btnWidth = 100;
        const btnHeight = 40;

        // Button background
        const bg = this.add.graphics();
        bg.lineStyle(2, 0x000000, 1);
        bg.strokeRect(-btnWidth/2, -btnHeight/2, btnWidth, btnHeight);
        
        // Button text
        const text = this.add.text(0, 0, label, {
            font: '12px monospace',
            fill: '#000000'
        }).setOrigin(0.5);
        
        btn.add([bg, text]);
        
        // Store references for enabling/disabling
        btn.buttonBg = bg;
        btn.buttonText = text;
        btn.buttonWidth = btnWidth;
        btn.buttonHeight = btnHeight;
        btn.buttonCallback = callback;
        btn.isEnabled = true;
        
        // Make interactive
        const hitArea = new Phaser.Geom.Rectangle(-btnWidth/2, -btnHeight/2, btnWidth, btnHeight);
        btn.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);
        
        btn.on('pointerover', () => {
            if (!btn.isEnabled) return;
            bg.clear();
            bg.lineStyle(3, 0x000000, 1);
            bg.strokeRect(-btnWidth/2, -btnHeight/2, btnWidth, btnHeight);
        });
        
        btn.on('pointerout', () => {
            if (!btn.isEnabled) return;
            bg.clear();
            bg.lineStyle(2, 0x000000, 1);
            bg.strokeRect(-btnWidth/2, -btnHeight/2, btnWidth, btnHeight);
        });
        
        btn.on('pointerdown', () => {
            if (btn.isEnabled) {
                callback();
            }
        });
        
        return btn;
    }

    createBackButton(x, y) {
        const btn = this.add.container(x, y);
        
        const btnWidth = 70;
        const btnHeight = 30;
        
        // Button background
        const bg = this.add.graphics();
        bg.lineStyle(2, 0x000000, 1);
        bg.strokeRect(-btnWidth/2, -btnHeight/2, btnWidth, btnHeight);
        
        // Button text
        const text = this.add.text(0, 0, 'BACK', {
            font: '12px monospace',
            fill: '#000000'
        }).setOrigin(0.5);
        
        btn.add([bg, text]);
        
        // Make interactive
        const hitArea = new Phaser.Geom.Rectangle(-btnWidth/2, -btnHeight/2, btnWidth, btnHeight);
        btn.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);
        
        btn.on('pointerover', () => {
            bg.clear();
            bg.lineStyle(3, 0x000000, 1);
            bg.strokeRect(-btnWidth/2, -btnHeight/2, btnWidth, btnHeight);
        });
        
        btn.on('pointerout', () => {
            bg.clear();
            bg.lineStyle(2, 0x000000, 1);
            bg.strokeRect(-btnWidth/2, -btnHeight/2, btnWidth, btnHeight);
        });
        
        btn.on('pointerdown', () => {
            console.log('[SimpleGameScene] Back button clicked');
            this.scene.start('MenuScene');
        });
        
        return btn;
    }
    
    // ============ GAME ACTION HANDLERS ============
    
    onCancelAction() {
        console.log('[SimpleGameScene] onCancelAction() called');
        
        // Clear the current action from scene state
        this.clearCurrentAction();
        
        console.log('[SimpleGameScene] Action cancelled, state cleared');
    }
    
    onPrepareMove(moveType) {
        console.log('[SimpleGameScene] onPrepareMove() called with:', moveType);
        
        if (!this.currentGameId) {
            this.showErrorModal('No Active Game', 'Please start a new game first.');
            return;
        }
        
        // Get current user ID
        const user = this.registry.get('currentUser');
        const userId = user?.id;
        
        if (!userId) {
            this.showErrorModal('User Not Found', 'Could not find user ID. Please try logging in again.');
            return;
        }
        
        // Create move action matching the backend format
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
        
        // Store the action in scene state (don't send it yet)
        this.setCurrentAction(actionContext);
    }
    
    async onGoButtonClick() {
        console.log('[SimpleGameScene] onGoButtonClick() called');
        
        // Check if we have an action ready
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
            
            this.updateGameStatus(`Sending move: ${moveType}...`);
            
            // Disable GO button while processing
            this.disableGoButton();
            
            console.log('[SimpleGameScene] Sending move action:', actionContext);
            
            const response = await gameClient.updateGame(this.currentGameId, actionContext);
            console.log('[SimpleGameScene] Move response:', response);
            
            // Check if the response indicates failure (case-insensitive)
            const statusLower = response.status?.toLowerCase();
            if (statusLower === 'failed' || statusLower === 'error') {
                const errorMsg = response.message || response.detail || 'The move could not be processed.';
                this.showErrorModal('Move Failed', errorMsg);
                // Clear action on failure
                this.clearCurrentAction();
                return;
            }
            
            // Also check if there's an error message even with other status
            if (response.message && response.message.toLowerCase().includes('error')) {
                this.showErrorModal('Move Failed', response.message);
                // Clear action on failure
                this.clearCurrentAction();
                return;
            }
            
            // Update local game data with response
            this.gameData = response;
            
            // Clear the action after successful send
            this.clearCurrentAction();
            
            // Show success message
            this.updateGameStatus(`Move ${moveType} sent! Reloading game...`);
            
            // Reload fresh game data from server
            await this.loadGame(this.currentGameId);
            
            console.log('[SimpleGameScene] Game reloaded after successful move');
            
        } catch (error) {
            console.error('[SimpleGameScene] Failed to send move:', error);
            
            // Extract detailed error message
            let errorMessage = 'An unexpected error occurred.';
            let errorTitle = 'Move Failed';
            
            if (error.statusCode) {
                errorTitle = `Error ${error.statusCode}`;
            }
            
            if (error.message) {
                errorMessage = error.message;
            }
            
            // If there's additional error data, include it
            if (error.data) {
                if (error.data.detail) {
                    errorMessage = error.data.detail;
                } else if (error.data.message) {
                    errorMessage = error.data.message;
                }
            }
            
            this.showErrorModal(errorTitle, errorMessage);
            
            // Clear action on error
            this.clearCurrentAction();
        }
    }
    
    showErrorModal(title, message) {
        console.log('[SimpleGameScene] showErrorModal():', title, message);
        
        // Launch the error modal as an overlay
        this.scene.launch('ErrorModalScene', {
            errorTitle: title,
            errorMessage: message
        });
    }
}
