/**
 * MenuScene
 * Candy style menu with Game, Inventory, Start Game, and Exit buttons
 */
class MenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MenuScene' });
        console.log('[MenuScene] Constructor called');
    }

    create() {
        console.log('[MenuScene] create() started');
        fxEnter(this);
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        this._starting = false;

        // Get user from registry
        const user = this.registry.get('currentUser');
        console.log('[MenuScene] User from registry:', user);
        const displayName = user?.name || 'Not Logged In';
        console.log('[MenuScene] Display name:', displayName);
        
        // User panel (upper left corner)
        this.playerText = this.add.text(UI.pad, UI.pad, `Player: ${displayName}`, {
            font: `${UI.body}px monospace`,
            fill: '#000000',
            wordWrap: { width: width - UI.pad * 2 }
        }).setOrigin(0, 0);

        this.currentDisplayName = displayName;

        this.add.text(width / 2, 56, 'Sweet Adventure', {
            font: `${UI.title}px monospace`,
            fill: '#000000'
        }).setOrigin(0.5);

        this.add.text(width / 2, 88, 'Pick a match', {
            font: `${UI.body}px monospace`,
            fill: '#666666'
        }).setOrigin(0.5);

        if (isUiDebug()) {
            this.add.text(width / 2, 108, `${width}x${height}`, {
                font: `${UI.small}px monospace`,
                fill: '#666666'
            }).setOrigin(0.5);
        }

        const buttons = [
            { label: 'LOGIN', onClick: () => this.onGameClick(), height: UI.menuBtnH },
            { label: 'REGISTER', onClick: () => this.onRegisterClick(), height: UI.menuBtnH },
            { label: 'LOGOUT', onClick: () => this.onLogoutClick(), height: UI.menuBtnH },
            { label: 'INVENTORY', onClick: () => console.log('Inventory Clicked'), height: UI.menuBtnH },
            { label: 'START GAME', onClick: () => this.onStartGameClick(), height: UI.menuPrimaryH },
            { label: 'EXIT', onClick: () => console.log('Exit Clicked'), height: UI.menuBtnH },
        ];
        const gap = 16;
        const totalHeight = buttons.reduce((sum, btn) => sum + btn.height, 0) + gap * (buttons.length - 1);
        const switcherH = UI.touchMin;
        const buttonYStart = 120 + (height - 120 - switcherH - 24 - totalHeight) / 2;

        let y = buttonYStart;
        buttons.forEach((btn) => {
            const isPrimary = btn.label === 'START GAME';
            const made = this.createMenuButton(width / 2, y + btn.height / 2, btn.label, btn.onClick, btn.height, {
                strong: isPrimary,
                idleKind: isPrimary && UI.fx.menuPrimaryPulse ? 'pulse' : null,
                particles: true
            });
            if (isPrimary) {
                this.startGameBtn = made;
            }
            y += btn.height + gap;
        });

        const chipW = 170;
        const chipGap = 8;
        const chipY = height - 16 - switcherH / 2;
        this.createDebugChip(
            width / 2 - chipW / 2 - chipGap / 2,
            chipY,
            chipW,
            `Layout: ${UI.layout.label}`,
            () => {
                cycleUiLayout();
                writeUiQueryParams();
                this.scene.restart();
            }
        );
        this.createDebugChip(
            width / 2 + chipW / 2 + chipGap / 2,
            chipY,
            chipW,
            `FX: ${UI.fx.label}`,
            () => {
                cycleUiFx();
                writeUiQueryParams();
                this.scene.restart();
            }
        );
    }

    /**
     * Handle LOGIN button click - show in-canvas login modal
     */
    onGameClick(x, y) {
        console.log('Login button clicked');
        
        // Launch login modal scene as overlay
        this.scene.launch('LoginModalScene', {
            onLoginSuccess: (user) => this.updatePlayerPanel(user)
        });
    }

    onRegisterClick() {
        console.log('[MenuScene] onRegisterClick() called');
        
        // Check if user is already a regular user
        // Guest users have the name "Guest User"
        const user = this.registry.get('currentUser');
        console.log('[MenuScene] Current user:', user);
        console.log('[MenuScene] User name:', user?.name);
        console.log('[MenuScene] Is guest?', user?.name === 'Guest User');
        
        if (user && user.name !== 'Guest User') {
            // Already a regular user
            console.log('[MenuScene] User is already registered, not showing modal');
            // Could show a message or do nothing
            return;
        }
        
        console.log('[MenuScene] Launching RegisterModalScene...');
        // Launch register modal scene as overlay
        this.scene.launch('RegisterModalScene', {
            onRegisterSuccess: (user) => this.updatePlayerPanel(user)
        });
        console.log('[MenuScene] RegisterModalScene launch command sent');
    }

    onLogoutClick() {
        console.log('[MenuScene] Logout button clicked');
        
        // Clear the token from localStorage
        localStorage.removeItem('idToken');
        console.log('[MenuScene] Token cleared from localStorage');
        
        // Clear the current user from registry
        this.registry.set('currentUser', null);
        
        // Reload the page to start fresh as a new guest user
        console.log('[MenuScene] Reloading page...');
        window.location.reload();
    }

    async onStartGameClick() {
        console.log('[MenuScene] Start Game button clicked');
        if (this._starting) return;
        this._starting = true;
        if (this.startGameBtn && this.startGameBtn.buttonText) {
            this.startGameBtn.buttonText.setText('STARTING...');
        }
        
        try {
            if (typeof gameClient === 'undefined') {
                console.error('[MenuScene] gameClient not available');
                this.resetStartGame();
                alert('Game client not initialized');
                return;
            }
            
            console.log('[MenuScene] Creating new game...');
            
            const gameContext = {
                gameType: 'PVE',
                rounds: 'BO3',
                kind: 'classic',
                level: {
                    name: 'Level1'
                },
                episode: {
                    name: 'Episode1'
                }
            };
            
            const response = await gameClient.createGame(gameContext);
            console.log('[MenuScene] Game created:', response);
            
            if (response.gameId) {
                console.log('[MenuScene] Starting SimpleGameScene with gameId:', response.gameId);
                fxGoTo(this, 'SimpleGameScene', { gameId: response.gameId }, { flash: true });
            } else {
                console.error('[MenuScene] No gameId in response');
                this.resetStartGame();
                alert('Failed to create game: No game ID returned');
            }
            
        } catch (error) {
            console.error('[MenuScene] Failed to create game:', error);
            this.resetStartGame();
            alert(`Failed to create game: ${error.message}`);
        }
    }

    resetStartGame() {
        this._starting = false;
        if (this.startGameBtn && this.startGameBtn.buttonText) {
            this.startGameBtn.buttonText.setText('START GAME');
        }
    }

    updatePlayerPanel(user) {
        // Update the player text
        if (this.playerText && user?.name) {
            this.playerText.setText(`Player: ${user.name}`);
            this.currentDisplayName = user.name;
            this.registry.set('currentUser', user);
            console.log('[MenuScene] Player panel updated to:', user.name);
        }
    }

    createDebugChip(x, y, btnWidth, label, onClick) {
        const btn = this.add.container(x, y);
        const btnHeight = UI.touchMin;

        const bg = this.add.graphics();
        bg.lineStyle(2, 0x000000, 1);
        bg.strokeRect(-btnWidth/2, -btnHeight/2, btnWidth, btnHeight);

        const text = this.add.text(0, 0, label, {
            font: `${UI.body}px monospace`,
            fill: '#000000'
        }).setOrigin(0.5);

        btn.add([bg, text]);

        const hitArea = new Phaser.Geom.Rectangle(-btnWidth/2, -btnHeight/2, btnWidth, btnHeight);
        btn.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains, { useHandCursor: true });
        bindPress(this, btn, { onClick });
        return btn;
    }

    createMenuButton(x, y, label, callback, btnHeight = UI.menuBtnH, options = {}) {
        const btn = this.add.container(x, y);
        
        const btnWidth = UI.menuBtnW;

        const bg = this.add.graphics();
        bg.lineStyle(2, 0x000000, 1);
        bg.strokeRect(-btnWidth/2, -btnHeight/2, btnWidth, btnHeight);
        
        const text = this.add.text(0, 0, label, {
            font: `${UI.heading}px monospace`,
            fill: '#000000'
        }).setOrigin(0.5);
        
        btn.add([bg, text]);
        btn.buttonText = text;
        
        const hitArea = new Phaser.Geom.Rectangle(-btnWidth/2, -btnHeight/2, btnWidth, btnHeight);
        btn.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains, { useHandCursor: true });

        bindPress(this, btn, {
            onClick: callback,
            strong: !!options.strong,
            particles: !!options.particles,
            idleKind: options.idleKind || null
        });

        if (options.idleKind) {
            fxStartIdle(this, btn, options.idleKind);
        }
        return btn;
    }
}

