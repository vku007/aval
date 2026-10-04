/**
 * ButtonsScene
 * Same stage as UIEditorScene. Tools add a Buttons panel under Objects.
 */
class ButtonsScene extends UIEditorScene {
    constructor() {
        super({ key: 'ButtonsScene' });
    }

    toolsSceneClass() {
        return ButtonsToolsScene;
    }

    seedObjects() {
        this.balls = [];
        this.rods = [];
        this.highlighters = createUiEditorHighlights(this.heatMap);
        this.objects = this.highlighters.slice();
        this.selectedObject = this.highlighters[0] || null;
    }

    applyEditorDefaults() {
        applyCompositeHeatMapDefault(this);
        this.stageButtons = [];
        this.selectedStageButton = null;
    }

    addStageButton() {
        const box = this.stagePanelBox();
        const width = Math.min(128, box.width);
        const height = Math.min(40, box.height);
        const slot = this.nextStageButtonSlot(box, width, height);
        const button = new UiStageButton(this, {
            x: slot.x,
            y: slot.y,
            width: width,
            height: height,
            label: 'Button',
            onSelect: (item) => this.selectStageButton(item)
        });
        this.stageButtons.push(button);
        this.selectStageButton(button);
        return button;
    }

    selectStageButton(button) {
        this.selectedStageButton = button || null;
        this.stageButtons.forEach((item) => item.setSelected(item === button));
        const toolsGame = window.editorToolsGame;
        const tools = toolsGame && toolsGame.scene && toolsGame.scene.getScene('ButtonsToolsScene');
        if (tools && typeof tools.refreshStageButtonProps === 'function') {
            tools.refreshStageButtonProps();
        }
    }

    stagePanelBox() {
        const cam = this.cameras.main;
        const boxes = uiStageMarkupBoxes(cam.width, cam.height, UI.layout);
        return boxes.find((box) => box.label === 'STAGE') || {
            x: 0,
            y: 0,
            width: cam.width,
            height: cam.height
        };
    }

    nextStageButtonSlot(box, width, height) {
        const step = 12;
        let x = 8;
        let y = 8;
        for (let i = 0; i < 40; i++) {
            const taken = this.stageButtons.some((item) => item.localX === x && item.localY === y);
            if (!taken && x + width <= box.width && y + height <= box.height) {
                return { x: x, y: y };
            }
            x += step;
            if (x + width > box.width) {
                x = 8;
                y += step;
            }
            if (y + height > box.height) {
                break;
            }
        }
        return { x: 8, y: 8 };
    }
}
