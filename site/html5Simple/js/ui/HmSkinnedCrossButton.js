/**
 * HmSkinnedCrossButton
 * A skinned button whose heat map holds a Cross.
 * Cross params come from resources/cross.json.
 */
const HM_CROSS_BUTTON_JSON_KEY = 'hmCrossButton';
const HM_CROSS_BUTTON_JSON_PATH = 'resources/cross.json?v=1';

function preloadHmCrossButton(scene) {
    if (!scene || !scene.load || scene.cache.json.exists(HM_CROSS_BUTTON_JSON_KEY)) {
        return;
    }
    scene.load.json(HM_CROSS_BUTTON_JSON_KEY, HM_CROSS_BUTTON_JSON_PATH);
}

function hmCrossButtonPreset(scene) {
    if (!scene || !scene.cache || !scene.cache.json.exists(HM_CROSS_BUTTON_JSON_KEY)) {
        return null;
    }
    const raw = scene.cache.json.get(HM_CROSS_BUTTON_JSON_KEY);
    return raw && raw.cross ? raw.cross : null;
}

class HmSkinnedCrossButton extends HmSkinnedButton {
    installComposite() {
        const field = this.heatMap.field;
        const center = {
            col: (field.cols - 1) / 2,
            row: (field.rows - 1) / 2
        };
        this.cross = createComposite('cross', this.heatMap, {
            name: 'Cross',
            center: center
        });
        const preset = hmCrossButtonPreset(this.scene);
        if (!preset) {
            console.warn('[HmSkinnedCrossButton] cross.json is not loaded');
            return;
        }
        this.cross.applySerialized(Object.assign({}, preset, { center: center }));
        this.cross.layoutItems();
    }
}
