/**
 * TestsScene
 * Hub for UI effect sandboxes.
 */
class TestsScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TestsScene' });
        console.log('[TestsScene] Constructor called');
    }

    init() {
        enterTestsCanvas(this);
    }

    create() {
        enterTestsCanvas(this);
        console.log('[TestsScene] create() started');
        fxEnter(this);
        this._starting = false;
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        this.add.text(width / 2, 56, 'Tests', {
            font: `${UI.title}px monospace`,
            fill: '#000000'
        }).setOrigin(0.5);

        this.add.text(width / 2, 88, 'Pick a sandbox', {
            font: `${UI.body}px monospace`,
            fill: '#666666'
        }).setOrigin(0.5);

        const buttons = [
            { label: 'SIMPLE GAME', onClick: (btn) => this.onSelectKind('classic', btn), height: UI.menuPrimaryH, strong: true },
            { label: 'EXTENDED GAME', onClick: (btn) => this.onSelectKind('extended', btn), height: UI.menuPrimaryH, strong: true },
            { label: 'RESULTS', onClick: () => this.onResultsClick(), height: UI.menuBtnH, strong: false },
            { label: 'OLD UI TESTS', onClick: () => this.onOldUiTestsClick(), height: UI.menuPrimaryH, strong: true },
            { label: 'BUTTONS', onClick: () => this.onButtonsClick(), height: UI.menuPrimaryH, strong: true },
            { label: 'SKINNED BUTTON', onClick: () => this.onSkinnedButtonClick(), height: UI.menuPrimaryH, strong: true },
            { label: 'COMPOSITE UI EDITOR', onClick: () => this.onCompositeUiEditorClick(), height: UI.menuPrimaryH, strong: true },
            { label: 'MOVE HOT ROD', onClick: () => this.onMoveHotRodClick(), height: UI.menuPrimaryH, strong: true },
            { label: 'BACK HIGHLIGHT', onClick: () => this.onBackHighlightClick(), height: UI.menuPrimaryH, strong: true },
            { label: 'SHARD', onClick: () => this.onShardClick(), height: UI.menuPrimaryH, strong: true },
            { label: 'ALTER SHEET', onClick: () => this.onAlterSheetClick(), height: UI.menuPrimaryH, strong: true },
            { label: 'MOVE HOT CIRCLE', onClick: () => this.onMoveHotCircleClick(), height: UI.menuPrimaryH, strong: true },
            { label: 'BACK', onClick: () => this.onBackClick(), height: UI.menuBtnH, strong: false }
        ];
        const gap = 16;
        const mid = Math.ceil(buttons.length / 2);
        const columns = [buttons.slice(0, mid), buttons.slice(mid)];
        const columnHeight = (list) => list.reduce((sum, btn) => sum + btn.height, 0) + gap * Math.max(0, list.length - 1);
        const blockHeight = Math.max(...columns.map(columnHeight));
        const btnWidth = UI.menuBtnW;
        const blockWidth = btnWidth * 2 + gap;
        const leftX = (width - blockWidth) / 2 + btnWidth / 2;
        const xs = [leftX, leftX + btnWidth + gap];
        const top = 140 + (height - 140 - 24 - blockHeight) / 2;

        columns.forEach((column, index) => {
            let y = top;
            column.forEach((btn) => {
                const made = this.createMenuButton(
                    xs[index],
                    y + btn.height / 2,
                    btn.label,
                    () => btn.onClick(made),
                    btn.height,
                    {
                        strong: btn.strong,
                        idleKind: btn.strong && UI.fx.menuPrimaryPulse ? 'pulse' : null,
                        particles: true
                    }
                );
                y += btn.height + gap;
            });
        });
    }

    onResultsClick() {
        if (this._starting) {
            return;
        }
        const user = this.registry.get('currentUser');
        const playerId = user && user.id ? user.id : 'you';
        fxGoTo(this, 'AdvancedGameResultsScene', {
            gameData: SimpleGameSceneUtil.finishedAdvancedGameStub(playerId),
            returnTo: 'TestsScene'
        }, { flash: true });
    }

    async onSelectKind(kind, clickedBtn) {
        console.log('[TestsScene] Selected kind:', kind);
        if (this._starting) {
            return;
        }
        this._starting = true;
        if (clickedBtn && clickedBtn.buttonText) {
            clickedBtn.buttonText.setText('STARTING...');
        }

        try {
            if (typeof gameClient === 'undefined') {
                console.error('[TestsScene] gameClient not available');
                this.resetStarting(clickedBtn);
                this.showErrorModal('Game client not initialized', 'Please reload and try again.');
                return;
            }

            const gameContext = {
                gameType: 'PVE',
                rounds: 'BO3',
                kind,
                level: {
                    name: 'Level1'
                },
                episode: {
                    name: 'Episode1'
                }
            };

            console.log('[TestsScene] Creating new game...', gameContext);
            const response = await gameClient.createGame(gameContext);
            console.log('[TestsScene] Game created:', response);

            if (response.gameId) {
                this.registry.set('currentGameKind', kind);
                const sceneKey = kind === 'extended' ? 'ExtendedGameScene' : 'ClassicGameScene';
                fxGoTo(this, sceneKey, { gameId: response.gameId }, { flash: true });
            } else {
                console.error('[TestsScene] No gameId in response');
                this.resetStarting(clickedBtn);
                this.showErrorModal('Failed to create game', 'No game ID returned');
            }
        } catch (error) {
            console.error('[TestsScene] Failed to create game:', error);
            this.resetStarting(clickedBtn);
            this.showErrorModal('Failed to create game', error.message || 'An unexpected error occurred.');
        }
    }

    resetStarting(clickedBtn) {
        this._starting = false;
        if (clickedBtn && clickedBtn.buttonText) {
            clickedBtn.buttonText.setText(clickedBtn.baseLabel || 'SIMPLE GAME');
        }
    }

    showErrorModal(title, message) {
        this.scene.launch('ErrorModalScene', {
            errorTitle: title,
            errorMessage: message
        });
    }

    onOldUiTestsClick() {
        console.log('[TestsScene] Old UI tests clicked');
        fxGoTo(this, 'OldUiScenes');
    }

    onButtonsClick() {
        console.log('[TestsScene] Buttons clicked');
        fxGoTo(this, 'ButtonsScene');
    }

    onSkinnedButtonClick() {
        console.log('[TestsScene] Skinned button clicked');
        fxGoTo(this, 'SkinnedButtonScene');
    }

    onCompositeUiEditorClick() {
        console.log('[TestsScene] Composite UI Editor clicked');
        fxGoTo(this, 'CompositeUIEditorScene');
    }

    onMoveHotRodClick() {
        console.log('[TestsScene] Move hot rod clicked');
        fxGoTo(this, 'MoveHotRodScene');
    }

    onBackHighlightClick() {
        console.log('[TestsScene] Back highlight clicked');
        fxGoTo(this, 'BackHighlightScene');
    }

    onShardClick() {
        console.log('[TestsScene] Shard clicked');
        fxGoTo(this, 'ShardScene');
    }

    onAlterSheetClick() {
        console.log('[TestsScene] Alter sheet clicked');
        fxGoTo(this, 'AlterSheetScene');
    }

    onMoveHotCircleClick() {
        console.log('[TestsScene] Move hot circle clicked');
        fxGoTo(this, 'MoveHotCircleScene');
    }

    onBackClick() {
        console.log('[TestsScene] Back clicked');
        fxGoTo(this, 'MenuScene');
    }

    createMenuButton(x, y, label, callback, btnHeight = UI.menuBtnH, options = {}) {
        const btn = this.add.container(x, y);
        const btnWidth = UI.menuBtnW;

        const bg = this.add.graphics();
        bg.lineStyle(2, 0x000000, 1);
        bg.strokeRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight);

        const text = this.add.text(0, 0, label, {
            font: `${UI.heading}px monospace`,
            fill: '#000000'
        }).setOrigin(0.5);

        btn.add([bg, text]);
        btn.buttonText = text;
        btn.baseLabel = label;

        const hitArea = new Phaser.Geom.Rectangle(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight);
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
