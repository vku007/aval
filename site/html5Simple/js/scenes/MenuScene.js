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
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // Get user from registry
        const user = this.registry.get('currentUser');
        console.log('[MenuScene] User from registry:', user);
        const displayName = user?.name || 'Not Logged In';
        console.log('[MenuScene] Display name:', displayName);
        
        // User panel (upper left corner)
        this.playerText = this.add.text(20, 20, `Player: ${displayName}`, {
            font: '24px monospace',
            fill: '#000000'
        }).setOrigin(0, 0);
        console.log('[MenuScene] Player text created at (20, 20):', this.playerText);
        
        // Store reference for updates
        this.currentDisplayName = displayName;

        // Debug info
        this.add.text(width / 2, 50, 'MENU SCENE', {
            font: '48px monospace',
            fill: '#000000'
        }).setOrigin(0.5);
        
        this.add.text(width / 2, 100, `Canvas: ${width}x${height}`, {
            font: '20px monospace',
            fill: '#666666'
        }).setOrigin(0.5);

        // Create the buttons
        // Calculate spacing to fit all 6 buttons
        const buttonHeight = 31;
        const totalButtons = 6;
        const buttonSpacing = 70; // Reduced spacing to fit all buttons
        const totalHeight = (totalButtons - 1) * buttonSpacing + buttonHeight;
        const buttonYStart = (height - totalHeight) / 2 + 100; // Start below the title

        this.createMenuButton(width / 2, buttonYStart, 'LOGIN', () => this.onGameClick(width / 2, buttonYStart));
        this.createMenuButton(width / 2, buttonYStart + buttonSpacing, 'REGISTER', () => this.onRegisterClick());
        this.createMenuButton(width / 2, buttonYStart + buttonSpacing * 2, 'LOGOUT', () => this.onLogoutClick());
        this.createMenuButton(width / 2, buttonYStart + buttonSpacing * 3, 'INVENTORY', () => console.log('Inventory Clicked'));
        this.createMenuButton(width / 2, buttonYStart + buttonSpacing * 4, 'START GAME', () => this.onStartGameClick());
        this.createMenuButton(width / 2, buttonYStart + buttonSpacing * 5, 'EXIT', () => console.log('Exit Clicked'));
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
        
        try {
            // Check if gameClient is available
            if (typeof gameClient === 'undefined') {
                console.error('[MenuScene] gameClient not available');
                alert('Game client not initialized');
                return;
            }
            
            console.log('[MenuScene] Creating new game...');
            
            // Create game with parameters (matching backend GameCreateContext)
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
                // Pass gameId to SimpleGameScene
                console.log('[MenuScene] Starting SimpleGameScene with gameId:', response.gameId);
                this.scene.start('SimpleGameScene', { gameId: response.gameId });
            } else {
                console.error('[MenuScene] No gameId in response');
                alert('Failed to create game: No game ID returned');
            }
            
        } catch (error) {
            console.error('[MenuScene] Failed to create game:', error);
            alert(`Failed to create game: ${error.message}`);
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

    /**
     * Create debug wireframe button
     */
    createMenuButton(x, y, label, callback) {
        const btn = this.add.container(x, y);
        
        const btnWidth = 350;
        const btnHeight = 31;

        // Wireframe rectangle
        const bg = this.add.graphics();
        bg.lineStyle(2, 0x000000, 1);
        bg.strokeRect(-btnWidth/2, -btnHeight/2, btnWidth, btnHeight);
        
        // Button label
        const text = this.add.text(0, 0, label, {
            font: '32px monospace',
            fill: '#000000'
        }).setOrigin(0.5);
        
        // Size label
        const sizeLabel = this.add.text(btnWidth/2 - 5, -btnHeight/2 + 5, `${btnWidth}x${btnHeight}`, {
            font: '12px monospace',
            fill: '#666666'
        }).setOrigin(1, 0);
        
        btn.add([bg, text, sizeLabel]);
        
        // Interactivity
        const hitArea = new Phaser.Geom.Rectangle(-btnWidth/2, -btnHeight/2, btnWidth, btnHeight);
        btn.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains, { useHandCursor: true });
        
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
            callback();
        });
    }
}

