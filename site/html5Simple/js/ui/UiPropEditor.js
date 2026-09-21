/**
 * Settings-style tabbed − / + steppers bound to a live target.
 * getTarget() must return { params, nudgeParam }.
 */
class UiPropEditor {
    constructor(scene, panel, config) {
        this.scene = scene;
        this.panel = panel;
        this.getTarget = config.getTarget;
        this.tabs = config.tabs || [];
        this.propValues = {};
        this.tabBodies = {};
        this.tabBtns = {};
        this.activeTab = this.tabs[0] ? this.tabs[0].id : null;

        const showTabs = this.tabs.length > 1 || (this.tabs[0] && this.tabs[0].label);
        const tabW = 72;
        const tabH = 28;
        const tabY = panel.y + 18;

        if (showTabs) {
            this.tabs.forEach((tab, index) => {
                const fromRight = this.tabs.length - 1 - index;
                const tabX = panel.x + panel.width - 12 - tabW / 2 - fromRight * (tabW + 8);
                this.tabBtns[tab.id] = this.createTabButton(tabX, tabY, tabW, tabH, tab.label || tab.id, () => {
                    this.setTab(tab.id);
                });
            });
        }

        const rowH = config.rowH || 32;
        const rowTop = panel.y + (showTabs ? 38 : 32);
        const rowWidth = panel.width - 16;
        this.tabs.forEach((tab) => {
            const body = scene.add.container(0, 0);
            tab.rows.forEach((row, index) => {
                if (row.type === 'bool') {
                    this.createBoolRow(body, panel.x + 8, rowTop + index * rowH, rowWidth, rowH, row);
                } else {
                    this.createStepperRow(body, panel.x + 8, rowTop + index * rowH, rowWidth, rowH, row);
                }
            });
            this.tabBodies[tab.id] = body;
        });

        if (this.activeTab) {
            this.setTab(this.activeTab);
        }
        this.setActive(config.active !== false);
    }

    setActive(on) {
        this.active = !!on;
        Object.keys(this.tabBtns).forEach((id) => {
            const btn = this.tabBtns[id];
            btn.setVisible(this.active);
            if (btn.input) {
                btn.input.enabled = this.active;
            }
        });
        Object.keys(this.tabBodies).forEach((id) => {
            const show = this.active && id === this.activeTab;
            const body = this.tabBodies[id];
            body.setVisible(show);
            this.setTreeInputEnabled(body, show);
        });
        if (this.active) {
            this.refreshValues();
        }
    }

    refreshValues() {
        const target = this.getTarget();
        Object.keys(this.propValues).forEach((key) => {
            const slot = this.propValues[key];
            const value = target && target.params ? target.params[key] : 0;
            if (slot.type === 'bool') {
                this.redrawBoolToggle(slot.toggle, !!value);
            } else {
                slot.text.setText(Number(value).toFixed(slot.decimals));
            }
        });
    }

    setTab(tab) {
        this.activeTab = tab;
        const editorOn = this.active !== false;
        Object.keys(this.tabBodies).forEach((id) => {
            const on = editorOn && id === tab;
            const body = this.tabBodies[id];
            body.setVisible(on);
            this.setTreeInputEnabled(body, on);
            if (this.tabBtns[id]) {
                this.tabBtns[id].setVisible(editorOn);
                this.redrawTabButton(this.tabBtns[id], editorOn && id === tab);
            }
        });
    }

    setTreeInputEnabled(node, enabled) {
        if (node.input) {
            node.input.enabled = enabled;
        }
        if (node.list) {
            node.list.forEach((child) => this.setTreeInputEnabled(child, enabled));
        }
    }

    createTabButton(x, y, btnWidth, btnHeight, label, callback) {
        const scene = this.scene;
        const btn = scene.add.container(x, y);
        const bg = scene.add.graphics();
        const text = scene.add.text(0, 0, label, {
            font: `${UI.small}px monospace`,
            fill: '#000000'
        }).setOrigin(0.5);
        btn.add([bg, text]);
        btn.buttonBg = bg;
        btn.buttonText = text;
        btn.tabWidth = btnWidth;
        btn.tabHeight = btnHeight;
        const hitArea = new Phaser.Geom.Rectangle(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight);
        btn.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains, { useHandCursor: true });
        bindPress(scene, btn, { onClick: callback });
        this.redrawTabButton(btn, false);
        return btn;
    }

    redrawTabButton(btn, selected) {
        const w = btn.tabWidth;
        const h = btn.tabHeight;
        const bg = btn.buttonBg;
        bg.clear();
        if (selected) {
            bg.fillStyle(0x000000, 1);
            bg.fillRect(-w / 2, -h / 2, w, h);
            btn.buttonText.setColor('#ffffff');
        } else {
            bg.lineStyle(2, 0x000000, 1);
            bg.strokeRect(-w / 2, -h / 2, w, h);
            btn.buttonText.setColor('#000000');
        }
    }

    createBoolRow(parent, x, y, width, height, row) {
        const scene = this.scene;
        const btnW = 72;
        const btnH = 28;
        const toggleX = x + width - btnW / 2;

        const label = scene.add.text(x + 4, y + height / 2, row.label, {
            font: `${UI.body}px monospace`,
            fill: '#000000'
        }).setOrigin(0, 0.5);

        const toggle = this.createBoolToggle(toggleX, y + height / 2, btnW, btnH, () => {
            this.nudgeParam(row.key, 1);
        });
        this.propValues[row.key] = { type: 'bool', toggle };
        this.redrawBoolToggle(toggle, this.readBool(row.key));
        parent.add([label, toggle]);
    }

    readBool(key) {
        const target = this.getTarget();
        return !!(target && target.params && target.params[key]);
    }

    createBoolToggle(x, y, btnWidth, btnHeight, callback) {
        const scene = this.scene;
        const btn = scene.add.container(x, y);
        const bg = scene.add.graphics();
        const text = scene.add.text(0, 0, 'ON', {
            font: `${UI.small}px monospace`,
            fill: '#000000'
        }).setOrigin(0.5);
        btn.add([bg, text]);
        btn.buttonBg = bg;
        btn.buttonText = text;
        btn.tabWidth = btnWidth;
        btn.tabHeight = btnHeight;
        const hitArea = new Phaser.Geom.Rectangle(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight);
        btn.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains, { useHandCursor: true });
        bindPress(scene, btn, { onClick: callback });
        return btn;
    }

    redrawBoolToggle(btn, on) {
        if (!btn) {
            return;
        }
        const w = btn.tabWidth;
        const h = btn.tabHeight;
        const bg = btn.buttonBg;
        bg.clear();
        if (on) {
            bg.fillStyle(0x000000, 1);
            bg.fillRect(-w / 2, -h / 2, w, h);
            btn.buttonText.setColor('#ffffff');
            btn.buttonText.setText('ON');
        } else {
            bg.lineStyle(2, 0x000000, 1);
            bg.strokeRect(-w / 2, -h / 2, w, h);
            btn.buttonText.setColor('#000000');
            btn.buttonText.setText('OFF');
        }
    }

    createStepperRow(parent, x, y, width, height, row) {
        const scene = this.scene;
        const btnW = 40;
        const btnH = 28;
        const btnGap = 6;
        const plusX = x + width - btnW / 2;
        const minusX = plusX - btnW - btnGap;
        const valueX = minusX - btnW / 2 - 8;

        const label = scene.add.text(x + 4, y + height / 2, row.label, {
            font: `${UI.body}px monospace`,
            fill: '#000000'
        }).setOrigin(0, 0.5);

        const value = scene.add.text(valueX, y + height / 2, this.formatParam(row), {
            font: `${UI.body}px monospace`,
            fill: '#000000'
        }).setOrigin(1, 0.5);
        this.propValues[row.key] = { text: value, decimals: row.decimals };

        const minus = this.createStepButton(minusX, y + height / 2, btnW, btnH, '−', () => {
            this.nudgeParam(row.key, -1);
        });
        const plus = this.createStepButton(plusX, y + height / 2, btnW, btnH, '+', () => {
            this.nudgeParam(row.key, 1);
        });
        parent.add([label, value, minus, plus]);
    }

    formatParam(row) {
        const target = this.getTarget();
        const value = target && target.params ? target.params[row.key] : 0;
        return Number(value).toFixed(row.decimals);
    }

    nudgeParam(key, dir) {
        const target = this.getTarget();
        if (!target || typeof target.nudgeParam !== 'function') {
            return;
        }
        target.nudgeParam(key, dir);
        const slot = this.propValues[key];
        if (!slot || !target.params) {
            return;
        }
        if (slot.type === 'bool') {
            this.redrawBoolToggle(slot.toggle, !!target.params[key]);
        } else {
            slot.text.setText(Number(target.params[key]).toFixed(slot.decimals));
        }
    }

    createStepButton(x, y, btnWidth, btnHeight, label, callback) {
        const scene = this.scene;
        const btn = scene.add.container(x, y);
        const bg = scene.add.graphics();
        bg.lineStyle(2, 0x000000, 1);
        bg.strokeRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight);

        const text = scene.add.text(0, 0, label, {
            font: `${UI.heading}px monospace`,
            fill: '#000000'
        }).setOrigin(0.5);

        btn.add([bg, text]);
        btn.buttonText = text;

        const hitArea = new Phaser.Geom.Rectangle(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight);
        btn.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains, { useHandCursor: true });
        bindPress(scene, btn, { onClick: callback });
        return btn;
    }
}
