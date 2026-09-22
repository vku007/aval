/**
 * UIEditorScene
 * Stage canvas only. Same logical size and scale as the main scene.
 * Effects, props, and objects live on a second Phaser canvas.
 */
class UIEditorScene extends Phaser.Scene {
    constructor() {
        super({ key: 'UIEditorScene' });
        console.log('[UIEditorScene] Constructor called');
    }

    init() {
        exitTestsCanvas(this);
    }

    create() {
        exitTestsCanvas(this);
        console.log('[UIEditorScene] create() started');
        fxEnter(this);
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        this._left = false;

        this.heatMap = new UiHeatMap(this, {
            x: 0,
            y: 0,
            width: width,
            height: height
        });
        this.add.text(12, 12, 'STAGE', {
            font: `bold ${UI.small}px monospace`,
            fill: '#c8c8c8',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0, 0);
        this.heatMap.onTap = (cell) => {
            if (this.selectedObject && typeof this.selectedObject.retarget === 'function') {
                this.selectedObject.retarget(cell);
            }
        };

        this.balls = [
            new UiHotBall(this.heatMap, {
                name: 'Hot Ball 1',
                params: { phase: 0, tiltX: 0, tiltY: 0, tiltZ: 0, orbitRadius: 16 }
            }),
            new UiHotBall(this.heatMap, {
                name: 'Hot Ball 2',
                params: { phase: 90, tiltX: 90, tiltY: 0, tiltZ: 0, orbitRadius: 16 }
            }),
            new UiHotBall(this.heatMap, {
                name: 'Hot Ball 3',
                params: { phase: 180, tiltX: 0, tiltY: 90, tiltZ: 0, orbitRadius: 16 }
            })
        ];
        this.rods = [
            new UiHotRod(this.heatMap, {
                name: 'Hot Rod 1',
                params: { energy: 1.5, thickness: 4, delay: 0.4, startAngle: 0, endAngle: 40 }
            }),
            new UiHotRod(this.heatMap, {
                name: 'Hot Rod 2',
                params: { energy: 1.2, thickness: 3, delay: 0.6, startAngle: 60, endAngle: 120 }
            }),
            new UiHotRod(this.heatMap, {
                name: 'Hot Rod 3',
                params: { energy: 1.8, thickness: 5, delay: 0.2, startAngle: 120, endAngle: 20 }
            })
        ];
        this.highlighters = [
            new UiBackHighlighter(this.heatMap, {
                name: 'Back Highlight 1',
                centerX: 32,
                centerY: 42,
                to: { width: 72, height: 28, angle: 18, heat: 1.8 }
            }),
            new UiBackHighlighter(this.heatMap, {
                name: 'Back Highlight 2',
                centerX: 68,
                centerY: 62,
                from: { width: 24, height: 18, angle: 12, heat: 0.7 },
                to: { width: 64, height: 36, angle: -20, heat: 1.5 }
            })
        ];
        this.objects = this.balls.concat(this.rods, this.highlighters);
        this.selectedObject = this.balls[0];
        this.stageMarkup = createUiStageMarkup(this, width, height);
        this.menuMarkup = createUiMenuMarkup(this, width, height);
        this.events.once('shutdown', () => closeEditorTools());
        openEditorTools(this);
    }

    update(time, delta) {
        if (this.heatMap && typeof this.heatMap.update === 'function') {
            this.heatMap.update(time, delta);
        }
    }

    leave() {
        if (this._left) {
            return;
        }
        this._left = true;
        closeEditorTools();
        fxGoTo(this, 'TestsScene');
    }
}

function openEditorTools(host) {
    const tools = document.getElementById('editor-tools');
    if (!tools || !host) {
        return;
    }
    document.body.classList.add('ui-editor');
    tools.hidden = false;
    syncEditorToolsBox();
    window.requestAnimationFrame(() => {
        if (!host.scene || !host.scene.isActive() || host._left) {
            return;
        }
        const parent = document.getElementById('phaser-tools');
        const width = Math.max(640, parent.clientWidth || tools.clientWidth || 640);
        const height = Math.max(480, parent.clientHeight || tools.clientHeight || 480);
        closeEditorToolsGame();
        window.editorToolsGame = new Phaser.Game({
            type: Phaser.AUTO,
            parent: 'phaser-tools',
            width: width,
            height: height,
            backgroundColor: '#ffffff',
            scale: {
                mode: Phaser.Scale.FIT,
                autoCenter: Phaser.Scale.CENTER_BOTH,
                width: width,
                height: height
            },
            callbacks: {
                preBoot: (game) => {
                    game.registry.set('editorHost', host);
                }
            },
            scene: [UIEditorToolsScene]
        });
    });
}

function closeEditorToolsGame() {
    if (!window.editorToolsGame) {
        return;
    }
    const toolsGame = window.editorToolsGame;
    window.editorToolsGame = null;
    toolsGame.destroy(true);
}

function closeEditorTools() {
    document.body.classList.remove('ui-editor');
    const tools = document.getElementById('editor-tools');
    if (tools) {
        tools.hidden = true;
    }
    closeEditorToolsGame();
}

function syncEditorToolsBox() {
    if (!document.body.classList.contains('ui-editor')) {
        return;
    }
    const tools = document.getElementById('editor-tools');
    if (!tools) {
        return;
    }
    const frameH = getComputedStyle(document.documentElement).getPropertyValue('--game-frame-h').trim();
    if (frameH) {
        tools.style.height = frameH;
    }
    if (window.editorToolsGame && window.editorToolsGame.scale) {
        window.editorToolsGame.scale.refresh();
    }
}

function uiObjectTypeLabel(object) {
    const kind = object && object.kind;
    if (kind === 'hot-ball') {
        return 'Ball';
    }
    if (kind === 'hot-rod') {
        return 'Rod';
    }
    if (kind === 'back-highlight') {
        return 'Highlight';
    }
    return kind ? String(kind) : '';
}

function uiObjectCopyName(name) {
    const base = String(name || 'Object').trim();
    return base + ' copy';
}

function shiftUiObjectPoint(field, point) {
    if (!field || !point || typeof point.col !== 'number' || typeof point.row !== 'number') {
        return point;
    }
    const dx = Math.max(2, (field.cols - 1) * 0.08);
    const dy = Math.max(2, (field.rows - 1) * 0.08);
    return {
        col: Math.max(0, Math.min(field.cols - 1, point.col + dx)),
        row: Math.max(0, Math.min(field.rows - 1, point.row + dy))
    };
}

function shiftUiObjectCopy(kind, data, field) {
    if (!data) {
        return;
    }
    if (kind === 'hot-rod') {
        data.start = shiftUiObjectPoint(field, data.start);
        return;
    }
    if (kind === 'hot-ball') {
        data.orbitCenter = shiftUiObjectPoint(field, data.orbitCenter);
        if (data.orbitTarget) {
            data.orbitTarget = shiftUiObjectPoint(field, data.orbitTarget);
        }
        return;
    }
    if (kind === 'back-highlight') {
        data.center = shiftUiObjectPoint(field, data.center);
        data.target = shiftUiObjectPoint(field, data.target || data.center);
    }
}
