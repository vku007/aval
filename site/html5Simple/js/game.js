/**
 * Game Configuration
 * Sharp, bright, candy style
 */

console.log('[game.js] Initializing game with scenes:', [BootScene, MenuScene, LoginModalScene, RegisterModalScene]);

const config = {
    type: Phaser.AUTO,
    parent: 'phaser-game',
    width: window.innerWidth * 0.75,
    height: window.innerHeight * 0.75,
    backgroundColor: '#ffffff',
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: [BootScene, MenuScene, LoginModalScene, RegisterModalScene]
};

console.log('[game.js] Creating Phaser.Game with config:', config);
const game = new Phaser.Game(config);
console.log('[game.js] Phaser.Game created');

