/**
 * CampaignBattleResultScene
 * Who won, what was spent, and the victory reward. OK returns to the map.
 */
class CampaignBattleResultScene extends Phaser.Scene {
    constructor() {
        super({ key: 'CampaignBattleResultScene' });
    }

    init(data) {
        this.instanceId = data && data.instanceId;
        this.battleOutcome = data && data.battleOutcome;
        this.left = false;
    }

    create() {
        if (typeof exitTestsCanvas === 'function') exitTestsCanvas(this);
        if (!this.instanceId || !this.battleOutcome) {
            this.leave();
            return;
        }
        const width = this.scale.width;
        const height = this.scale.height;
        const lines = (typeof CampaignLabels !== 'undefined')
            ? CampaignLabels.resultLines(this.battleOutcome)
            : [];
        const size = (typeof UI !== 'undefined' && UI.body) ? UI.body : 16;
        let y = Math.max(120, (height - (lines.length * (size + 18) + 80)) / 2);
        lines.forEach((line) => {
            const text = this.add.text(width / 2, y, line, {
                font: `${size}px monospace`,
                fill: '#000000',
                align: 'center',
                wordWrap: { width: width - 48 }
            }).setOrigin(0.5, 0);
            y += text.height + 16;
        });
        this.okButton(width, y + 24);
    }

    okButton(width, y) {
        const w = Math.min(280, width - 48);
        const h = 44;
        const text = this.add.text(0, 0, 'OK', {
            font: '16px monospace',
            fill: '#000000'
        }).setOrigin(0.5);
        const bg = this.add.graphics();
        bg.lineStyle(2, 0x000000, 1);
        bg.strokeRect(-w / 2, -h / 2, w, h);
        const btn = this.add.container(width / 2, y + h / 2, [bg, text]);
        btn.setInteractive(
            new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h),
            Phaser.Geom.Rectangle.Contains
        );
        bindPress(this, btn, {
            isEnabled: () => !this.left,
            onClick: () => this.leave()
        });
    }

    leave() {
        if (this.left) return;
        this.left = true;
        if (this.instanceId) {
            fxGoTo(this, 'CampaignMapScene', { instanceId: this.instanceId });
            return;
        }
        fxGoTo(this, 'CampaignCatalogScene', {});
    }
}
