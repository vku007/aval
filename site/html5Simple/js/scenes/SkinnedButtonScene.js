/**
 * SkinnedButtonScene
 * A button whose skin is a heat-map image.
 * The map holds a stone of three balls at its center. Each tick the map
 * paints a canvas, and that canvas is scaled to the button.
 * HOTMAP starts from resources/hotmap-1.json. STONE and BUTTON edit live props.
 */
class SkinnedButtonScene extends Phaser.Scene {
    constructor() {
        super({ key: 'SkinnedButtonScene' });
    }

    init() {
        enterTestsCanvas(this);
    }

    create() {
        enterTestsCanvas(this);
        fxEnter(this);
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        this.add.text(width / 2, 40, 'Skinned button', {
            font: `${UI.title}px monospace`,
            fill: '#000000'
        }).setOrigin(0.5);

        this.add.text(width / 2, 68, 'Stone heatmap, scaled onto the button', {
            font: `${UI.body}px monospace`,
            fill: '#666666'
        }).setOrigin(0.5);

        const pad = UI.pad;
        const gap = 10;
        const backH = UI.menuBtnH;
        const panelTop = 92;
        const sideW = 230;
        const rowH = 30;
        const leftX = pad;
        const rightX = width - pad - sideW;
        const midX = leftX + sideW + gap;
        const midW = rightX - gap - midX;
        this.buttonMax = Math.max(64, Math.floor(midW - 8));
        this.propValues = {};
        const buttonSize = Math.min(220, this.buttonMax);
        const stoneRowsForHeight = HotMapUiStone.PROP_TABS.reduce((count, tab) => {
            return count + tab.rows.filter((row) => row.type !== 'action').length;
        }, 0);
        const stoneH = 36 + stoneRowsForHeight * rowH;
        this.button = new HmSkinnedStoneButton(this, {
            x: midX + midW / 2 - buttonSize / 2,
            y: panelTop + stoneH / 2 - buttonSize / 2,
            size: buttonSize,
            minSize: 64,
            maxSize: this.buttonMax
        });
        this.heatMap = this.button.heatMap;
        this.stone = this.button.stone;

        const heatRows = [
            { key: 'diffusion', label: 'DIFFUSE', decimals: 1 },
            { key: 'cooling', label: 'COOL', decimals: 2 },
            { key: 'viewX', label: 'VIEW X', decimals: 0 },
            { key: 'viewY', label: 'VIEW Y', decimals: 0 },
            { key: 'viewZ', label: 'VIEW Z', decimals: 0 }
        ];
        const stoneRows = [];
        HotMapUiStone.PROP_TABS.forEach((tab) => {
            tab.rows.forEach((row) => {
                if (row.type === 'action') {
                    return;
                }
                stoneRows.push(row);
            });
        });
        const buttonRows = [
            { key: 'size', label: 'SIZE', decimals: 0 }
        ];

        const heatH = 36 + heatRows.length * rowH;
        const buttonH = 36 + buttonRows.length * rowH;
        this.createPropPanel(leftX, panelTop, sideW, heatH, 'HOTMAP', heatRows, 'heat', rowH);
        this.createPropPanel(leftX, panelTop + heatH + gap, sideW, buttonH, 'BUTTON', buttonRows, 'button', rowH);
        this.createPropPanel(rightX, panelTop, sideW, stoneH, 'STONE', stoneRows, 'stone', rowH);

        this.createMenuButton(
            width / 2,
            height - pad - backH / 2,
            'BACK',
            () => this.onBackClick(),
            backH
        );
    }

    update(time, delta) {
        if (this.button && typeof this.button.update === 'function') {
            this.button.update(time, delta);
        }
    }

    createPropPanel(x, y, width, height, title, rows, group, rowH) {
        const frame = this.add.graphics();
        frame.lineStyle(2, 0x000000, 1);
        frame.strokeRect(x, y, width, height);
        this.add.text(x + 10, y + 8, title, {
            font: `bold ${UI.small}px monospace`,
            fill: '#333333'
        }).setOrigin(0, 0);
        const top = y + 28;
        rows.forEach((row, index) => {
            this.createStepperRow(x + 8, top + index * rowH, width - 16, rowH, row, group);
        });
    }

    createStepperRow(x, y, width, height, row, group) {
        const btnW = 26;
        const btnH = Math.min(24, height - 4);
        const plusX = x + width - btnW / 2;
        const minusX = plusX - btnW - 4;
        const valueX = minusX - btnW / 2 - 6;
        this.add.text(x, y + height / 2, row.label, {
            font: `${UI.small}px monospace`,
            fill: '#000000'
        }).setOrigin(0, 0.5);
        const value = this.add.text(valueX, y + height / 2, this.formatProp(group, row), {
            font: `${UI.small}px monospace`,
            fill: '#000000'
        }).setOrigin(1, 0.5);
        if (!this.propValues[group]) {
            this.propValues[group] = {};
        }
        this.propValues[group][row.key] = { text: value, decimals: row.decimals };
        this.createStepButton(minusX, y + height / 2, btnW, btnH, '−', () => {
            this.nudgeProp(group, row.key, -1);
        });
        this.createStepButton(plusX, y + height / 2, btnW, btnH, '+', () => {
            this.nudgeProp(group, row.key, 1);
        });
    }

    formatProp(group, row) {
        if (group === 'button') {
            return String(this.button ? this.button.size : 0);
        }
        const target = group === 'heat' ? this.heatMap : this.stone;
        const value = target && target.params ? target.params[row.key] : 0;
        return Number(value).toFixed(row.decimals);
    }

    nudgeProp(group, key, dir) {
        if (group === 'heat' && this.heatMap) {
            this.heatMap.nudgeParam(key, dir);
        } else if (group === 'stone' && this.stone) {
            this.stone.nudgeParam(key, dir);
        } else if (group === 'button' && key === 'size' && this.button) {
            this.button.setSize(this.button.size + dir * 8);
        }
        const slot = this.propValues[group] && this.propValues[group][key];
        if (!slot) {
            return;
        }
        if (group === 'button') {
            slot.text.setText(String(this.button.size));
            return;
        }
        const target = group === 'heat' ? this.heatMap : this.stone;
        slot.text.setText(Number(target.params[key]).toFixed(slot.decimals));
    }

    onBackClick() {
        fxGoTo(this, 'TestsScene');
    }

    createMenuButton(x, y, label, callback, btnHeight = UI.menuBtnH) {
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
        const hitArea = new Phaser.Geom.Rectangle(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight);
        btn.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains, { useHandCursor: true });
        bindPress(this, btn, { onClick: callback });
        return btn;
    }

    createStepButton(x, y, btnWidth, btnHeight, label, onClick) {
        const btn = this.add.container(x, y);
        const bg = this.add.graphics();
        bg.lineStyle(2, 0x000000, 1);
        bg.strokeRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight);
        const text = this.add.text(0, 0, label, {
            font: `${UI.body}px monospace`,
            fill: '#000000'
        }).setOrigin(0.5);
        btn.add([bg, text]);
        const hit = new Phaser.Geom.Rectangle(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight);
        btn.setInteractive(hit, Phaser.Geom.Rectangle.Contains, { useHandCursor: true });
        bindPress(this, btn, { onClick: onClick });
        return btn;
    }
}
