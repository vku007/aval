/**
 * HmSkinnedPointerButton
 * A skinned button whose heat map holds one UiPointer.
 * Pointer props come from resources/pointer.json.
 * UiPointer stays a HeatItem: it is one triangle, not a group of parts.
 * The button places that item on the 60×60 field and scales lengths
 * that were drawn for a 100-cell field.
 */
const HM_POINTER_BUTTON_JSON_KEY = 'hmPointerButton';
const HM_POINTER_BUTTON_JSON_PATH = 'resources/pointer.json?v=1';

function preloadHmPointerButton(scene) {
    if (!scene || !scene.load || scene.cache.json.exists(HM_POINTER_BUTTON_JSON_KEY)) {
        return;
    }
    scene.load.json(HM_POINTER_BUTTON_JSON_KEY, HM_POINTER_BUTTON_JSON_PATH);
}

function hmPointerButtonFile(scene) {
    if (!scene || !scene.cache || !scene.cache.json.exists(HM_POINTER_BUTTON_JSON_KEY)) {
        return null;
    }
    return scene.cache.json.get(HM_POINTER_BUTTON_JSON_KEY);
}

function hmScalePointerPose(pose, scale) {
    if (!pose) {
        return;
    }
    if (typeof pose.width === 'number') {
        pose.width *= scale;
    }
    if (typeof pose.height === 'number') {
        pose.height *= scale;
    }
}

function hmScaledPointerPreset(preset) {
    const copy = JSON.parse(JSON.stringify(preset));
    const scale = HM_SKINNED_LENGTH_SCALE;
    hmScalePointerPose(copy.from, scale);
    hmScalePointerPose(copy.to, scale);
    delete copy.center;
    delete copy.target;
    return copy;
}

class HmSkinnedPointerButton extends HmSkinnedButton {
    installComposite() {
        const field = this.heatMap.field;
        const center = {
            col: (field.cols - 1) / 2,
            row: (field.rows - 1) / 2
        };
        const file = hmPointerButtonFile(this.scene);
        if (file && file.heatMap && typeof this.heatMap.applySerialized === 'function') {
            this.heatMap.applySerialized(file.heatMap);
        }
        this.pointer = new UiPointer(this.heatMap, {
            name: 'Pointer',
            center: center,
            target: center
        });
        const preset = file && file.pointers && file.pointers[0];
        if (!preset) {
            console.warn('[HmSkinnedPointerButton] pointer.json is not loaded');
            return;
        }
        this.pointer.applySerialized(hmScaledPointerPreset(preset));
        this.pointer.emitter.setCenter(center);
        this.pointer.emitter.center.col = center.col;
        this.pointer.emitter.center.row = center.row;
    }
}
