/**
 * UiHeatMap
 * One shared heat field for the UI editor Stage. Balls stamp into it.
 * DIFFUSE / COOL are edited on the EFFECTS panel.
 */
let UI_HEAT_MAP_SEQ = 0;

class UiHeatMap {
    static PROP_TABS = [
        {
            id: 'heat',
            label: 'HEAT',
            rows: [
                { key: 'showFrames', label: 'FRAMES', type: 'bool' },
                { key: 'showMenuFrames', label: 'MENU', type: 'bool' },
                { key: 'diffusion', label: 'DIFFUSE', decimals: 1 },
                { key: 'cooling', label: 'COOL', decimals: 2 }
            ]
        },
        {
            id: 'view',
            label: 'VIEW',
            rows: [
                { key: 'viewX', label: 'VIEW X', decimals: 0 },
                { key: 'viewY', label: 'VIEW Y', decimals: 0 },
                { key: 'viewZ', label: 'VIEW Z', decimals: 0 }
            ]
        }
    ];

    constructor(scene, bounds, options) {
        this.scene = scene;
        this.bounds = bounds;
        this.name = 'Heat Map';
        this.onTap = null;
        this.showFrames = true;
        this.showMenuFrames = false;
        this.playing = true;
        this.pendingSteps = 0;
        this.transportBtns = {};
        UI_HEAT_MAP_SEQ += 1;
        this.field = attachRotatedHeatField(
            scene,
            bounds.x,
            bounds.y,
            bounds.width,
            bounds.height,
            Object.assign({
                texKey: `ui-heatmap-${UI_HEAT_MAP_SEQ}`
            }, options || {})
        );
        this.field.onTap = (cell) => {
            if (typeof this.onTap === 'function') {
                this.onTap(cell);
            }
        };
        this.field.setParam('viewX', 30);
        this.field.setParam('viewY', 35);
        this.field.setParam('viewZ', 0);
    }

    get params() {
        return Object.assign({}, this.field.params, {
            showFrames: this.showFrames,
            showMenuFrames: this.showMenuFrames
        });
    }

    addBall(motion) {
        return this.field.addBall(motion);
    }

    addRod(emitter) {
        return this.field.addRod(emitter);
    }

    addHighlighter(emitter) {
        return this.field.addHighlighter(emitter);
    }

    removeBall(motion) {
        if (this.field && typeof this.field.removeBall === 'function') {
            this.field.removeBall(motion);
        }
    }

    removeRod(emitter) {
        if (this.field && typeof this.field.removeRod === 'function') {
            this.field.removeRod(emitter);
        }
    }

    removeHighlighter(emitter) {
        if (this.field && typeof this.field.removeHighlighter === 'function') {
            this.field.removeHighlighter(emitter);
        }
    }

    nudgeParam(key, dir) {
        if (key === 'showFrames') {
            this.setShowFrames(!this.showFrames);
            return this.showFrames;
        }
        if (key === 'showMenuFrames') {
            this.setShowMenuFrames(!this.showMenuFrames);
            return this.showMenuFrames;
        }
        return this.field.nudgeParam(key, dir);
    }

    setShowFrames(on) {
        this.showFrames = !!on;
        const layer = this.scene && this.scene.stageMarkup;
        if (layer && typeof layer.setVisible === 'function') {
            layer.setVisible(this.showFrames);
        }
    }

    setShowMenuFrames(on) {
        this.showMenuFrames = !!on;
        const layer = this.scene && this.scene.menuMarkup;
        if (layer && typeof layer.setVisible === 'function') {
            layer.setVisible(this.showMenuFrames);
        }
    }

    serialize() {
        return {
            diffusion: this.params.diffusion,
            cooling: this.params.cooling,
            viewX: this.params.viewX,
            viewY: this.params.viewY,
            viewZ: this.params.viewZ
        };
    }

    applySerialized(data) {
        if (!data) {
            return;
        }
        ['diffusion', 'cooling', 'viewX', 'viewY', 'viewZ'].forEach((key) => {
            if (data[key] != null) {
                this.field.setParam(key, data[key]);
            }
        });
        if (this.effectsEditor) {
            this.effectsEditor.refreshValues();
        }
    }

    play() {
        this.playing = true;
        this.pendingSteps = 0;
        this.refreshTransport();
    }

    stop() {
        this.playing = false;
        this.pendingSteps = 0;
        this.refreshTransport();
    }

    step() {
        this.playing = false;
        this.pendingSteps += 1;
        this.refreshTransport();
    }

    update(time, delta) {
        if (this.pendingSteps > 0) {
            this.pendingSteps -= 1;
            this.field.update(time, 1000 / 60);
            return;
        }
        if (!this.playing) {
            return;
        }
        this.field.update(time, delta);
    }

    createEffectsEditor(panel, scene) {
        const uiScene = scene || this.scene;
        this.effectsEditor = new UiPropEditor(uiScene, panel, {
            getTarget: () => this,
            tabs: UiHeatMap.PROP_TABS
        });
        this.createTransportBar(panel, uiScene);
        return this.effectsEditor;
    }

    createTransportBar(panel, scene) {
        const uiScene = scene || this.scene;
        const btnH = 36;
        const gap = 8;
        const inset = 8;
        const y = panel.y + panel.height - inset - btnH / 2;
        const innerW = panel.width - inset * 2;
        const btnW = Math.floor((innerW - gap * 2) / 3);
        const startX = panel.x + inset + btnW / 2;
        const specs = [
            { id: 'play', label: 'PLAY', onClick: () => this.play() },
            { id: 'step', label: 'STEP', onClick: () => this.step() },
            { id: 'stop', label: 'STOP', onClick: () => this.stop() }
        ];
        specs.forEach((spec, index) => {
            this.transportBtns[spec.id] = this.createTransportButton(
                uiScene,
                startX + index * (btnW + gap),
                y,
                btnW,
                btnH,
                spec.label,
                spec.onClick
            );
        });
        this.refreshTransport();
    }

    createTransportButton(scene, x, y, btnWidth, btnHeight, label, callback) {
        const btn = scene.add.container(x, y);
        const bg = scene.add.graphics();
        const text = scene.add.text(0, 0, label, {
            font: `${UI.body}px monospace`,
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

    refreshTransport() {
        const playing = this.playing;
        this.redrawTransportButton(this.transportBtns.play, playing);
        this.redrawTransportButton(this.transportBtns.step, false);
        this.redrawTransportButton(this.transportBtns.stop, !playing);
    }

    redrawTransportButton(btn, selected) {
        if (!btn) {
            return;
        }
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
}
