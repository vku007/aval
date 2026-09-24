/**
 * Menu heat-map skin loaded from resources/ui-editor-init.json.
 * Off = current blank background. On = full-panel heat field + UI objects.
 */
const UI_SKIN_STORAGE_KEY = 'uiSkin';
const UI_SKIN_JSON_KEY = 'uiSkinInit';
const UI_SKIN_JSON_PATH = 'resources/ui-editor-init.json?v=132';

function isUiSkinOn() {
    try {
        return localStorage.getItem(UI_SKIN_STORAGE_KEY) === 'on';
    } catch (e) {
        return false;
    }
}

function setUiSkinOn(on) {
    try {
        localStorage.setItem(UI_SKIN_STORAGE_KEY, on ? 'on' : 'off');
    } catch (e) {
        // ignore
    }
}

function preloadUiSkin(scene) {
    if (!scene || !scene.load || scene.cache.json.exists(UI_SKIN_JSON_KEY)) {
        return;
    }
    scene.load.json(UI_SKIN_JSON_KEY, UI_SKIN_JSON_PATH);
}

function mountUiSkin(scene, bounds) {
    if (!scene || !scene.cache.json.exists(UI_SKIN_JSON_KEY)) {
        return null;
    }
    const heatMap = new UiHeatMap(scene, bounds, { interactive: false });
    if (heatMap.field.view) {
        heatMap.field.view.setDepth(-1000);
    }
    const balls = [
        new UiHotBall(heatMap, { name: 'Hot Ball 1' }),
        new UiHotBall(heatMap, { name: 'Hot Ball 2' }),
        new UiHotBall(heatMap, { name: 'Hot Ball 3' })
    ];
    const rods = [
        new UiHotRod(heatMap, { name: 'Hot Rod 1' }),
        new UiHotRod(heatMap, { name: 'Hot Rod 2' }),
        new UiHotRod(heatMap, { name: 'Hot Rod 3' })
    ];
    const raw = scene.cache.json.get(UI_SKIN_JSON_KEY);
    const highlightList = (raw && raw.highlighters) || [];
    const highlighters = highlightList.map((item, index) => new UiBackHighlighter(heatMap, {
        name: (item && item.name) || `Back Highlight ${index + 1}`
    }));
    try {
        // Same cell coordinates as the editor stage. Both use the 390×844 grid.
        applyUiEditorPreset(heatMap, balls, raw, rods, highlighters);
    } catch (error) {
        console.warn('[UiSkin] Failed to apply preset', error);
    }
    return {
        heatMap,
        balls,
        rods,
        highlighters,
        setVisible(on) {
            heatMap.playing = !!on;
            if (heatMap.field.view) {
                heatMap.field.view.setVisible(!!on);
            }
        },
        update(time, delta) {
            if (heatMap.playing) {
                heatMap.update(time, delta);
            }
        }
    };
}

function styleUiSkinText(text, on) {
    if (!text) {
        return;
    }
    if (on) {
        text.setColor('#ffffff');
        if (typeof text.setStroke === 'function') {
            text.setStroke('#000000', 4);
        }
    } else {
        text.setColor('#000000');
        if (typeof text.setStroke === 'function') {
            text.setStroke('#000000', 0);
        }
    }
}

function styleUiSkinMenuButton(scene, btn, on) {
    if (!btn || !btn.buttonText) {
        return;
    }
    const w = btn.buttonWidth;
    const h = btn.buttonHeight;
    const bg = btn.buttonBg;
    if (on) {
        drawUiSkinKnockoutButton(scene, btn);
        btn.buttonText.setVisible(false);
        if (btn.knockoutRt) {
            btn.knockoutRt.setVisible(true);
        }
        if (bg && w && h) {
            bg.clear();
            bg.lineStyle(2, 0xffffff, 1);
            bg.strokeRect(-w / 2, -h / 2, w, h);
        }
        return;
    }
    if (btn.knockoutRt) {
        btn.knockoutRt.setVisible(false);
    }
    btn.buttonText.setVisible(true);
    styleUiSkinText(btn.buttonText, false);
    if (bg && w && h) {
        bg.clear();
        bg.lineStyle(2, 0x000000, 1);
        bg.strokeRect(-w / 2, -h / 2, w, h);
    }
}

function drawUiSkinKnockoutButton(scene, btn) {
    const w = btn.buttonWidth;
    const h = btn.buttonHeight;
    if (!scene || !w || !h || !btn.buttonText) {
        return;
    }
    if (!btn.knockoutRt) {
        const rt = scene.add.renderTexture(0, 0, w, h);
        rt.setOrigin(0.5);
        btn.addAt(rt, 0);
        btn.knockoutRt = rt;
    }
    const rt = btn.knockoutRt;
    rt.clear();
    rt.fill(0x000000, 1, 0, 0, w, h);

    const font = (btn.buttonText.style && btn.buttonText.style.font) || `${UI.heading}px monospace`;
    const cutter = scene.make.text({
        x: 0,
        y: 0,
        text: btn.buttonText.text,
        add: false,
        style: {
            font,
            fill: '#ffffff',
            stroke: '#ffffff',
            strokeThickness: 3
        }
    });
    const x = Math.round((w - cutter.width) / 2);
    const y = Math.round((h - cutter.height) / 2);
    rt.erase(cutter, x, y);
    cutter.destroy();
}

function createUiSkinSwitch(scene, onToggle, options) {
    const opts = options || {};
    const width = scene.cameras.main.width;
    const height = scene.cameras.main.height;
    const btnW = 88;
    const btnH = 28;
    const y = opts.y != null ? opts.y : height - UI.pad - btnH / 2;
    const centerX = opts.x != null ? opts.x : width / 2;
    const label = scene.add.text(centerX - btnW / 2 - 8, y, 'SKIN', {
        font: `${UI.small}px monospace`,
        fill: '#000000'
    }).setOrigin(1, 0.5);
    const btn = scene.add.container(centerX + 20, y);
    const bg = scene.add.graphics();
    const text = scene.add.text(0, 0, 'OFF', {
        font: `${UI.small}px monospace`,
        fill: '#000000'
    }).setOrigin(0.5);
    btn.add([bg, text]);
    btn.buttonBg = bg;
    btn.buttonText = text;
    btn.tabWidth = btnW;
    btn.tabHeight = btnH;
    btn.skinLabel = label;
    const hitArea = new Phaser.Geom.Rectangle(-btnW / 2, -btnH / 2, btnW, btnH);
    btn.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains, { useHandCursor: true });
    bindPress(scene, btn, {
        onClick: () => {
            const next = !isUiSkinOn();
            setUiSkinOn(next);
            redrawUiSkinSwitch(btn, next);
            styleUiSkinText(label, next);
            if (typeof onToggle === 'function') {
                onToggle(next);
            }
        }
    });
    const on = isUiSkinOn();
    redrawUiSkinSwitch(btn, on);
    styleUiSkinText(label, on);
    return btn;
}

function redrawUiSkinSwitch(btn, on) {
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
        btn.buttonText.setText('IN');
    } else {
        bg.lineStyle(2, 0x000000, 1);
        bg.strokeRect(-w / 2, -h / 2, w, h);
        btn.buttonText.setColor('#000000');
        btn.buttonText.setText('OFF');
    }
}

function pointerHitsUiSkinSwitch(scene, pointer, btn) {
    if (!btn || !pointer) {
        return false;
    }
    const bounds = btn.getBounds();
    if (Phaser.Geom.Rectangle.Contains(bounds, pointer.worldX, pointer.worldY)) {
        return true;
    }
    if (btn.skinLabel) {
        const labelBounds = btn.skinLabel.getBounds();
        if (Phaser.Geom.Rectangle.Contains(labelBounds, pointer.worldX, pointer.worldY)) {
            return true;
        }
    }
    return false;
}
