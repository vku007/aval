/**
 * CompositeUIEditorScene
 * Copy of UIEditorScene. Stage canvas only. Same logical size and scale as the main scene.
 * Effects, props, and objects live on a second Phaser canvas.
 */
class CompositeUIEditorScene extends Phaser.Scene {
    constructor() {
        super({ key: 'CompositeUIEditorScene' });
        console.log('[CompositeUIEditorScene] Constructor called');
    }

    init() {
        exitTestsCanvas(this);
    }

    create() {
        exitTestsCanvas(this);
        console.log('[CompositeUIEditorScene] create() started');
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
        this.stone = new HotMapUiStone(this.heatMap, { name: 'Stone' });
        this.scissor = new HotMapUiScissor(this.heatMap, { name: 'Scissor' });
        this.balls.concat(this.rods, this.highlighters).forEach((object) => {
            this.stone.add(object);
        });
        this.objects = [this.stone, this.scissor].concat(this.balls, this.rods, this.highlighters);
        this.selectedObject = this.balls[0];
        this.stageMarkup = createUiStageMarkup(this, width, height);
        this.menuMarkup = createUiMenuMarkup(this, width, height);
        this.events.once('shutdown', () => closeEditorTools());
        openEditorTools(this, CompositeUIEditorToolsScene);
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
