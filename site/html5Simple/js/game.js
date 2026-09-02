/**
 * Game configuration — logical size 390×844, Scale.FIT into the viewport.
 */

console.log('[game.js] Initializing game with scenes:', [BootScene, MenuScene, LoginModalScene, RegisterModalScene, SimpleGameScene, ErrorModalScene]);

applyGameFrame(fitGameFrame());

const config = {
    type: Phaser.AUTO,
    parent: 'phaser-game',
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#ffffff',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: GAME_WIDTH,
        height: GAME_HEIGHT
    },
    scene: [BootScene, MenuScene, LoginModalScene, RegisterModalScene, SimpleGameScene, ErrorModalScene]
};

console.log('[game.js] Creating Phaser.Game', GAME_WIDTH + 'x' + GAME_HEIGHT);
const game = new Phaser.Game(config);
window.game = game;

let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        applyGameFrame(fitGameFrame());
        game.scale.refresh();
    }, 120);
});
