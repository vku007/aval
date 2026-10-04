/**
 * ButtonsToolsScene
 * UI editor tools, with a Buttons panel under the object list.
 * The BTN tab edits stage buttons: position inside the stage panel, size, and label.
 */
class ButtonsToolsScene extends UIEditorToolsScene {
    constructor() {
        super({ key: 'ButtonsToolsScene' });
    }

    editorTitle() {
        return 'Buttons';
    }

    layoutObjectsColumn(objX, objW, height) {
        const gap = 10;
        const buttonsH = Math.max(310, Math.round(height * 0.42));
        const objectsH = height - gap - buttonsH;
        this.objectsPanel = this.createEditorPanel(objX, 0, objW, objectsH, 'OBJECTS');
        this.buttonsPanel = this.createEditorPanel(objX, objectsH + gap, objW, buttonsH, 'BUTTONS');
    }

    onToolsReady() {
        this.labelFocus = false;
        this.buildButtonsPanel(this.buttonsPanel);
        this._onLabelKey = (event) => this.onLabelKey(event);
        window.addEventListener('keydown', this._onLabelKey);
        this.events.once('shutdown', () => {
            window.removeEventListener('keydown', this._onLabelKey);
        });
        this.input.on('pointerdown', (pointer) => {
            this.labelFocus = this.pointerInLabelField(pointer) && !!this.selectedStageButton();
            this.redrawLabelField();
        });
    }

    update() {
        super.update();
        this.refreshStageButtonProps();
    }

    selectedStageButton() {
        return this.host && this.host.selectedStageButton;
    }

    buildButtonsPanel(panel) {
        const tabW = 56;
        const tabH = 26;
        const tab = this.createSolidTab(panel.x + 12 + tabW / 2, panel.y + 36, tabW, tabH, 'BTN');
        this.btnTab = tab;

        const addH = 32;
        const inset = 8;
        const propsX = panel.x + inset;
        const propsY = panel.y + 36 + tabH / 2 + 10;
        const propsW = panel.width - inset * 2;
        const propsH = panel.height - (propsY - panel.y) - addH - 16;
        this.btnPropsPanel = this.createEditorPanel(propsX, propsY, propsW, propsH, 'PROPS');
        this.createButtonPropRows(this.btnPropsPanel);

        const addW = Math.min(120, propsW);
        this.createFileButton(
            propsX + propsW / 2,
            panel.y + panel.height - 8 - addH / 2,
            addW,
            addH,
            'ADD',
            () => this.onAddStageButton()
        );
    }

    createSolidTab(x, y, width, height, label) {
        const btn = this.add.container(x, y);
        const bg = this.add.graphics();
        bg.fillStyle(0x000000, 1);
        bg.fillRect(-width / 2, -height / 2, width, height);
        const text = this.add.text(0, 0, label, {
            font: `${UI.small}px monospace`,
            fill: '#ffffff'
        }).setOrigin(0.5);
        btn.add([bg, text]);
        return btn;
    }

    createButtonPropRows(panel) {
        const keys = [
            { key: 'x', label: 'X' },
            { key: 'y', label: 'Y' },
            { key: 'width', label: 'WIDTH' },
            { key: 'height', label: 'HEIGHT' }
        ];
        const top = panel.y + 28;
        const bottom = panel.y + panel.height - 8;
        const rowCount = keys.length + 2;
        const rowH = Math.max(22, Math.floor((bottom - top) / rowCount));
        this.btnPropValues = {};
        keys.forEach((row, index) => {
            this.createStepperRow(panel.x + 8, top + index * rowH, panel.width - 16, rowH, row);
        });
        this.createLabelRow(panel.x + 8, top + keys.length * rowH, panel.width - 16, rowH);
        this.createPictureRow(panel.x + 8, top + (keys.length + 1) * rowH, panel.width - 16, rowH);
    }

    createStepperRow(x, y, width, height, row) {
        const btnW = 28;
        const btnH = Math.min(24, height - 2);
        const plusX = x + width - btnW / 2;
        const minusX = plusX - btnW - 4;
        const valueX = minusX - btnW / 2 - 6;
        const label = this.add.text(x, y + height / 2, row.label, {
            font: `${UI.small}px monospace`,
            fill: '#000000'
        }).setOrigin(0, 0.5);
        const value = this.add.text(valueX, y + height / 2, '—', {
            font: `${UI.small}px monospace`,
            fill: '#000000'
        }).setOrigin(1, 0.5);
        this.btnPropValues[row.key] = value;
        this.createStepButton(minusX, y + height / 2, btnW, btnH, '−', () => {
            this.nudgeStageButton(row.key, -1);
        });
        this.createStepButton(plusX, y + height / 2, btnW, btnH, '+', () => {
            this.nudgeStageButton(row.key, 1);
        });
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

    createLabelRow(x, y, width, height) {
        this.add.text(x, y + height / 2, 'LABEL', {
            font: `${UI.small}px monospace`,
            fill: '#000000'
        }).setOrigin(0, 0.5);
        const fieldW = Math.max(80, width - 72);
        const fieldH = Math.min(24, height - 2);
        const fieldX = x + width - fieldW / 2;
        const fieldY = y + height / 2;
        const bg = this.add.graphics();
        const text = this.add.text(fieldX - fieldW / 2 + 6, fieldY, '', {
            font: `${UI.small}px monospace`,
            fill: '#000000'
        }).setOrigin(0, 0.5);
        const caret = this.add.rectangle(fieldX - fieldW / 2 + 6, fieldY, 1, fieldH - 8, 0x000000);
        caret.setOrigin(0, 0.5);
        this.labelField = {
            x: fieldX,
            y: fieldY,
            w: fieldW,
            h: fieldH,
            bg: bg,
            text: text,
            caret: caret
        };
        this.redrawLabelField();
    }

    createPictureRow(x, y, width, height) {
        this.add.text(x, y + height / 2, 'PICTURE', {
            font: `${UI.small}px monospace`,
            fill: '#000000'
        }).setOrigin(0, 0.5);
        const btnW = 44;
        const btnH = Math.min(24, height - 2);
        const setX = x + width - btnW / 2;
        const clearX = setX - btnW - 4;
        this.pictureNameText = this.add.text(clearX - btnW / 2 - 6, y + height / 2, '—', {
            font: `${UI.small}px monospace`,
            fill: '#000000'
        }).setOrigin(1, 0.5);
        this.createStepButton(clearX, y + height / 2, btnW, btnH, 'OFF', () => {
            this.onClearPicture();
        });
        this.createStepButton(setX, y + height / 2, btnW, btnH, 'SET', () => {
            this.onSetPicture();
        });
    }

    pointerInLabelField(pointer) {
        const field = this.labelField;
        if (!field || !pointer) {
            return false;
        }
        const left = field.x - field.w / 2;
        const top = field.y - field.h / 2;
        return pointer.worldX >= left && pointer.worldX <= left + field.w &&
            pointer.worldY >= top && pointer.worldY <= top + field.h;
    }

    redrawLabelField() {
        const field = this.labelField;
        if (!field) {
            return;
        }
        const button = this.selectedStageButton();
        const value = button ? button.label : '';
        field.bg.clear();
        field.bg.lineStyle(this.labelFocus ? 2 : 1, 0x000000, 1);
        field.bg.strokeRect(field.x - field.w / 2, field.y - field.h / 2, field.w, field.h);
        field.text.setText(value);
        const caretX = field.x - field.w / 2 + 6 + field.text.width + 1;
        field.caret.setPosition(caretX, field.y);
        const blink = Math.floor(this.time.now / 480) % 2 === 0;
        field.caret.setVisible(this.labelFocus && !!button && blink);
    }

    refreshStageButtonProps() {
        const button = this.selectedStageButton();
        if (this.btnPropValues) {
            ['x', 'y', 'width', 'height'].forEach((key) => {
                const text = this.btnPropValues[key];
                if (!text) {
                    return;
                }
                text.setText(button ? String(button.params[key]) : '—');
            });
        }
        this.redrawLabelField();
        if (this.pictureNameText) {
            const name = button && button.pictureName ? button.pictureName : '—';
            this.pictureNameText.setText(name.length > 12 ? name.slice(0, 11) + '…' : name);
        }
    }

    onSetPicture() {
        const button = this.selectedStageButton();
        if (!button) {
            return;
        }
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.style.display = 'none';
        const done = () => {
            input.remove();
        };
        input.addEventListener('change', () => {
            const file = input.files && input.files[0];
            done();
            if (!file) {
                return;
            }
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
                URL.revokeObjectURL(url);
                button.setPicture(img, file.name);
                this.refreshStageButtonProps();
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
            };
            img.src = url;
        });
        input.addEventListener('cancel', done);
        document.body.appendChild(input);
        input.click();
    }

    onClearPicture() {
        const button = this.selectedStageButton();
        if (!button) {
            return;
        }
        button.clearPicture();
        this.refreshStageButtonProps();
    }

    nudgeStageButton(key, dir) {
        const button = this.selectedStageButton();
        if (!button) {
            return;
        }
        button.nudgeParam(key, dir);
        this.refreshStageButtonProps();
    }

    onAddStageButton() {
        if (this.host && typeof this.host.addStageButton === 'function') {
            this.host.addStageButton();
        }
        this.labelFocus = false;
        this.refreshStageButtonProps();
    }

    onLabelKey(event) {
        if (!this.labelFocus) {
            return;
        }
        const button = this.selectedStageButton();
        if (!button || !event) {
            return;
        }
        if (event.key === 'Backspace') {
            event.preventDefault();
            button.setLabel(button.label.slice(0, -1));
        } else if (event.key === 'Enter' || event.key === 'Escape') {
            event.preventDefault();
            this.labelFocus = false;
        } else if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
            event.preventDefault();
            if (button.label.length < 32) {
                button.setLabel(button.label + event.key);
            }
        } else {
            return;
        }
        this.refreshStageButtonProps();
    }
}
