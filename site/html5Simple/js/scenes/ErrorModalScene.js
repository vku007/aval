/**
 * ErrorModalScene
 * Floating modal window to display error messages
 */
class ErrorModalScene extends Phaser.Scene {
    constructor() {
        super({ key: 'ErrorModalScene' });
    }

    init(data) {
        console.log('[ErrorModalScene] init() called with data:', data);
        this.errorMessage = data.errorMessage || 'An unknown error occurred';
        this.errorTitle = data.errorTitle || 'Error';
    }

    create() {
        console.log('[ErrorModalScene] create() started');
        
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Semi-transparent overlay
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.7);
        overlay.fillRect(0, 0, width, height);
        overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains);
        
        // Modal dimensions
        const modalWidth = Math.min(500, width - 40);
        const modalHeight = Math.min(300, height - 40);
        const modalX = width / 2;
        const modalY = height / 2;
        
        // Modal background
        const modalBg = this.add.graphics();
        modalBg.fillStyle(0xffffff, 1);
        modalBg.fillRect(modalX - modalWidth/2, modalY - modalHeight/2, modalWidth, modalHeight);
        
        // Modal border
        modalBg.lineStyle(3, 0xff0000, 1);
        modalBg.strokeRect(modalX - modalWidth/2, modalY - modalHeight/2, modalWidth, modalHeight);
        
        // Error title
        this.add.text(modalX, modalY - modalHeight/2 + 30, this.errorTitle, {
            font: 'bold 24px monospace',
            fill: '#ff0000'
        }).setOrigin(0.5);
        
        // Error message (with word wrap)
        const messageY = modalY - modalHeight/2 + 80;
        const messageMaxWidth = modalWidth - 40;
        
        this.add.text(modalX, messageY, this.errorMessage, {
            font: '16px monospace',
            fill: '#000000',
            wordWrap: { width: messageMaxWidth, useAdvancedWrap: true },
            align: 'center'
        }).setOrigin(0.5, 0);
        
        // OK button
        const buttonY = modalY + modalHeight/2 - 50;
        this.createOkButton(modalX, buttonY);
        
        console.log('[ErrorModalScene] Modal created');
    }

    createOkButton(x, y) {
        const btn = this.add.container(x, y);
        
        const btnWidth = 100;
        const btnHeight = 40;

        // Button background
        const bg = this.add.graphics();
        bg.fillStyle(0xff0000, 1);
        bg.fillRect(-btnWidth/2, -btnHeight/2, btnWidth, btnHeight);
        
        // Button border
        bg.lineStyle(2, 0x000000, 1);
        bg.strokeRect(-btnWidth/2, -btnHeight/2, btnWidth, btnHeight);
        
        // Button text
        const text = this.add.text(0, 0, 'OK', {
            font: 'bold 18px monospace',
            fill: '#ffffff'
        }).setOrigin(0.5);
        
        btn.add([bg, text]);
        
        // Make interactive
        const hitArea = new Phaser.Geom.Rectangle(-btnWidth/2, -btnHeight/2, btnWidth, btnHeight);
        btn.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);
        
        btn.on('pointerover', () => {
            bg.clear();
            bg.fillStyle(0xcc0000, 1);
            bg.fillRect(-btnWidth/2, -btnHeight/2, btnWidth, btnHeight);
            bg.lineStyle(3, 0x000000, 1);
            bg.strokeRect(-btnWidth/2, -btnHeight/2, btnWidth, btnHeight);
        });
        
        btn.on('pointerout', () => {
            bg.clear();
            bg.fillStyle(0xff0000, 1);
            bg.fillRect(-btnWidth/2, -btnHeight/2, btnWidth, btnHeight);
            bg.lineStyle(2, 0x000000, 1);
            bg.strokeRect(-btnWidth/2, -btnHeight/2, btnWidth, btnHeight);
        });
        
        btn.on('pointerdown', () => {
            console.log('[ErrorModalScene] OK button clicked, closing modal');
            this.close();
        });
        
        return btn;
    }

    close() {
        console.log('[ErrorModalScene] Closing modal');
        this.scene.stop();
    }
}
