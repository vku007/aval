/**
 * HmSkinnedButton
 * A stage button whose face is a heat-map image.
 * A subclass installs the composite. The map paints a canvas,
 * and that canvas is scaled to the button and clipped to the button shape.
 * The field is 60×60 cells. It advances on every scene frame.
 * Lengths that were drawn for a 100-cell field scale by HM_SKINNED_LENGTH_SCALE.
 */
const HM_SKINNED_HEAT_SIZE = 60;
const HM_SKINNED_LENGTH_SCALE = HM_SKINNED_HEAT_SIZE / 100;

class HmSkinnedButton extends UiStageButton {
    constructor(scene, options) {
        const opts = options || {};
        const size = opts.size != null ? opts.size : 220;
        super(scene, {
            x: opts.x != null ? opts.x : 0,
            y: opts.y != null ? opts.y : 0,
            width: size,
            height: size,
            label: ''
        });
        this.minSize = opts.minSize != null ? opts.minSize : 64;
        this.maxSize = opts.maxSize != null ? opts.maxSize : size;
        const source = HM_SKINNED_HEAT_SIZE;
        this.heatMap = new UiHeatMap(scene, {
            x: 0,
            y: 0,
            width: source,
            height: source
        }, {
            interactive: false,
            cellPx: 1,
            present: false,
            minCols: 1,
            minRows: 1
        });
        applyCompositeHeatMapDefault({
            heatMap: this.heatMap,
            cache: scene.cache
        });
        if (this.heatMap.field.view) {
            this.heatMap.field.view.setVisible(false);
        }
        this.installComposite(opts);
        const field = this.heatMap.field;
        this.pictureName = 'heat';
        this.pictureImage = field.ctx.canvas;
        this.redraw();
    }

    installComposite() {
    }

    get size() {
        return this.width;
    }

    stageBox() {
        const cam = this.scene.cameras.main;
        return { x: 0, y: 0, width: cam.width, height: cam.height };
    }

    setSize(size) {
        const next = Math.max(this.minSize, Math.min(this.maxSize, Math.round(size)));
        const cx = this.localX + this.width / 2;
        const cy = this.localY + this.height / 2;
        this.width = next;
        this.height = next;
        this.localX = Math.round(cx - next / 2);
        this.localY = Math.round(cy - next / 2);
        this.clamp();
        this.redraw();
        return this.width;
    }

    update(time, delta) {
        if (this.heatMap && typeof this.heatMap.update === 'function') {
            this.heatMap.update(time, delta);
        }
        const canvas = this.heatMap && this.heatMap.field && this.heatMap.field.ctx
            ? this.heatMap.field.ctx.canvas
            : null;
        if (!canvas) {
            return;
        }
        this.pictureImage = canvas;
        this.redraw();
    }

    paintPicture(w, h) {
        const px = Math.max(1, Math.round(w));
        const py = Math.max(1, Math.round(h));
        const canvas = uiStageButtonFaceCanvas(this.scene, this.faceKey, px, py);
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, px, py);
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(0, 0, px, py, Math.min(px, py) / 2);
        ctx.clip();
        if (this.pictureImage) {
            ctx.drawImage(this.pictureImage, 0, 0, px, py);
        }
        ctx.restore();
        const texture = this.scene.textures.get(this.faceKey);
        if (texture && typeof texture.refresh === 'function') {
            texture.refresh();
        }
        if (!this.image) {
            this.image = this.scene.add.image(0, 0, this.faceKey);
            this.root.addAt(this.image, 1);
        }
        this.image.setDisplaySize(w, h);
    }

    redraw() {
        super.redraw();
        if (this.root.input) {
            this.root.input.hitAreaCallback = uiStageButtonContains;
        }
    }
}
