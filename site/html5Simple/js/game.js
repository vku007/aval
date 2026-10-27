/**
 * Game configuration — logical size 390×844, Scale.FIT into the viewport.
 */

console.log('[game.js] Initializing game with scenes:', [BootScene, MenuScene, GameSelectScene, LoginModalScene, RegisterModalScene, ClassicGameScene, ExtendedGameScene, LocalAdvancedGameScene, AdvancedGameResultsScene, TestsScene, UIEditorScene, ButtonsScene, SkinnedButtonScene, CompositeUIEditorScene, UITestScene, HotMapBallScene, RotatedHotMapBallScene, MoveHotRodScene, BackHighlightScene, ShardScene, AlterSheetScene, SheetScene, MoveHotCircleScene, ErrorModalScene]);

applyGameFrame(fitGameFrame());

const config = {
    type: Phaser.AUTO,
    parent: 'phaser-game',
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#ffffff',
    render: {
        antialias: true,
        powerPreference: 'high-performance'
    },
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: GAME_WIDTH,
        height: GAME_HEIGHT
    },
    scene: [BootScene, MenuScene, GameSelectScene, LoginModalScene, RegisterModalScene, ClassicGameScene, ExtendedGameScene, LocalAdvancedGameScene, AdvancedGameResultsScene, TestsScene, UIEditorScene, ButtonsScene, SkinnedButtonScene, CompositeUIEditorScene, UITestScene, HotMapBallScene, RotatedHotMapBallScene, MoveHotRodScene, BackHighlightScene, ShardScene, AlterSheetScene, SheetScene, MoveHotCircleScene, ErrorModalScene]
};

console.log('[game.js] Creating Phaser.Game', GAME_WIDTH + 'x' + GAME_HEIGHT);
const game = new Phaser.Game(config);
window.game = game;
showGameFps(game);

function showGameFps(game) {
    const parent = document.getElementById('game-container');
    if (!parent) {
        return;
    }
    const label = document.createElement('div');
    label.id = 'game-fps';
    label.textContent = 'FPS 0';
    parent.appendChild(label);
    let shownAt = 0;
    game.events.on('poststep', () => {
        const now = performance.now();
        if (now - shownAt < 250) {
            return;
        }
        shownAt = now;
        const fps = game.loop && game.loop.actualFps;
        label.textContent = 'FPS ' + (fps ? Math.round(fps) : 0);
    });
}

let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        applyGameFrame(fitGameFrame());
        game.scale.refresh();
        if (typeof syncEditorToolsBox === 'function') {
            syncEditorToolsBox();
        }
    }, 120);
});
