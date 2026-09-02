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
        this._fxClosing = false;
    }

    create() {
        console.log('[ErrorModalScene] create() started');

        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 1);
        overlay.setOrigin(0, 0);
        overlay.setInteractive();
        overlay._fxTargetAlpha = 0.7;

        const modalWidth = Math.min(500, width - 40);
        const modalHeight = Math.min(300, height - 40);

        const card = this.add.container(width / 2, height / 2);

        const modalBg = this.add.graphics();
        modalBg.fillStyle(0xffffff, 1);
        modalBg.fillRect(-modalWidth / 2, -modalHeight / 2, modalWidth, modalHeight);
        modalBg.lineStyle(3, 0xff0000, 1);
        modalBg.strokeRect(-modalWidth / 2, -modalHeight / 2, modalWidth, modalHeight);
        card.add(modalBg);

        const title = this.add.text(0, -modalHeight / 2 + 28, this.errorTitle, {
            font: `bold ${UI.heading}px monospace`,
            fill: '#ff0000',
            wordWrap: { width: modalWidth - 32 }
        }).setOrigin(0.5);
        card.add(title);

        const message = this.add.text(0, -modalHeight / 2 + 80, this.errorMessage, {
            font: `${UI.body}px monospace`,
            fill: '#000000',
            wordWrap: { width: modalWidth - 40, useAdvancedWrap: true },
            align: 'center'
        }).setOrigin(0.5, 0);
        card.add(message);

        const okBtn = this.createOkButton(0, modalHeight / 2 - 28 - UI.touchMin / 2);
        card.add(okBtn);

        fxOpenModal(this, overlay, card);

        console.log('[ErrorModalScene] Modal created');
    }

    createOkButton(x, y) {
        const btn = this.add.container(x, y);

        const btnWidth = 160;
        const btnHeight = UI.touchMin;

        const bg = this.add.graphics();
        bg.fillStyle(0xff0000, 1);
        bg.fillRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight);
        bg.lineStyle(2, 0x000000, 1);
        bg.strokeRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight);

        const text = this.add.text(0, 0, 'OK', {
            font: `bold ${UI.heading}px monospace`,
            fill: '#ffffff'
        }).setOrigin(0.5);

        btn.add([bg, text]);

        const hitArea = new Phaser.Geom.Rectangle(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight);
        btn.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);
        bindPress(this, btn, {
            onClick: () => {
                console.log('[ErrorModalScene] OK button clicked, closing modal');
                this.close();
            }
        });

        return btn;
    }

    close() {
        console.log('[ErrorModalScene] Closing modal');
        fxCloseModal(this);
    }

    shutdown() {
        fxResumeOtherScenes(this);
    }
}
