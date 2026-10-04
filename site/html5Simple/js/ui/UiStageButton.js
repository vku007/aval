/**
 * UiStageButton
 * A round button on the stage canvas.
 * x and y are the top-left inside the STAGE markup box.
 * Equal width and height make a circle; a wider button is a capsule.
 * A picture replaces the caption. Its transparent pixels mask the button.
 */
let UI_STAGE_BUTTON_SEQ = 0;

class UiStageButton {
    constructor(scene, options) {
        const opts = options || {};
        this.scene = scene;
        this.localX = opts.x != null ? opts.x : 8;
        this.localY = opts.y != null ? opts.y : 8;
        this.width = opts.width != null ? opts.width : 128;
        this.height = opts.height != null ? opts.height : 40;
        this.label = opts.label != null ? String(opts.label) : 'Button';
        this.pictureImage = null;
        this.pictureName = '';
        UI_STAGE_BUTTON_SEQ += 1;
        this.faceKey = 'ui-stage-button-face-' + UI_STAGE_BUTTON_SEQ;
        this.onSelect = opts.onSelect || null;
        this.selected = false;
        this.root = scene.add.container(0, 0);
        this.root.setDepth(1200);
        this.bg = scene.add.graphics();
        this.frame = scene.add.graphics();
        this.image = null;
        this.text = scene.add.text(0, 0, this.label, {
            font: `${UI.body}px monospace`,
            fill: '#000000'
        }).setOrigin(0.5);
        this.root.add([this.bg, this.frame, this.text]);
        this.root.on('pointerdown', () => {
            if (typeof this.onSelect === 'function') {
                this.onSelect(this);
            }
        });
        this.clamp();
        this.redraw();
    }

    get params() {
        return {
            x: this.localX,
            y: this.localY,
            width: this.width,
            height: this.height,
            label: this.label
        };
    }

    stageBox() {
        const cam = this.scene.cameras.main;
        const layout = (typeof UI !== 'undefined' && UI.layout) ? UI.layout : null;
        const boxes = layout ? uiStageMarkupBoxes(cam.width, cam.height, layout) : [];
        const stage = boxes.find((box) => box.label === 'STAGE');
        if (stage) {
            return stage;
        }
        return { x: 0, y: 0, width: cam.width, height: cam.height };
    }

    nudgeParam(key, dir) {
        const step = dir < 0 ? -1 : 1;
        if (key === 'x') {
            this.localX += step;
        } else if (key === 'y') {
            this.localY += step;
        } else if (key === 'width') {
            this.width += step;
        } else if (key === 'height') {
            this.height += step;
        }
        this.clamp();
        this.redraw();
    }

    setLabel(value) {
        this.label = String(value || '');
        this.text.setText(this.label);
        this.redraw();
    }

    setPicture(image, name) {
        this.pictureImage = image || null;
        this.pictureName = image ? String(name || 'picture') : '';
        this.redraw();
    }

    clearPicture() {
        this.setPicture(null, '');
    }

    setSelected(on) {
        this.selected = !!on;
        this.redraw();
    }

    clamp() {
        const box = this.stageBox();
        const min = 24;
        this.width = Math.max(min, Math.min(box.width, Math.round(this.width)));
        this.height = Math.max(min, Math.min(box.height, Math.round(this.height)));
        const maxX = Math.max(0, box.width - this.width);
        const maxY = Math.max(0, box.height - this.height);
        this.localX = Math.max(0, Math.min(maxX, Math.round(this.localX)));
        this.localY = Math.max(0, Math.min(maxY, Math.round(this.localY)));
    }

    redraw() {
        const box = this.stageBox();
        const w = this.width;
        const h = this.height;
        this.root.setPosition(box.x + this.localX + w / 2, box.y + this.localY + h / 2);
        const radius = Math.min(w, h) / 2;
        const hasPicture = !!this.pictureImage;
        this.bg.clear();
        this.frame.clear();
        this.text.setVisible(!hasPicture);
        if (hasPicture) {
            this.paintPicture(w, h);
            this.image.setVisible(true);
        } else {
            if (this.image) {
                this.image.setVisible(false);
            }
            if (this.selected) {
                this.bg.fillStyle(0x000000, 1);
                this.bg.fillRoundedRect(-w / 2, -h / 2, w, h, radius);
                this.frame.lineStyle(2, 0xffffff, 1);
                this.frame.strokeRoundedRect(-w / 2, -h / 2, w, h, radius);
                this.text.setColor('#ffffff');
            } else {
                this.bg.fillStyle(0xffffff, 1);
                this.bg.fillRoundedRect(-w / 2, -h / 2, w, h, radius);
                this.frame.lineStyle(2, 0x000000, 1);
                this.frame.strokeRoundedRect(-w / 2, -h / 2, w, h, radius);
                this.text.setColor('#000000');
            }
        }
        const shape = {
            width: w,
            height: h,
            picture: hasPicture,
            pixels: this.facePixels,
            pixelW: this.facePixelW,
            pixelH: this.facePixelH
        };
        if (this.root.input) {
            this.root.input.hitArea = shape;
            this.root.input.hitAreaCallback = uiStageButtonHit;
        } else {
            this.root.setInteractive(shape, uiStageButtonHit);
        }
    }

    paintPicture(w, h) {
        const px = Math.max(1, Math.round(w));
        const py = Math.max(1, Math.round(h));
        const canvas = uiStageButtonFaceCanvas(this.scene, this.faceKey, px, py);
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, px, py);
        ctx.drawImage(this.pictureImage, 0, 0, px, py);
        const pixels = ctx.getImageData(0, 0, px, py);
        this.facePixels = pixels.data;
        this.facePixelW = px;
        this.facePixelH = py;
        const texture = this.scene.textures.get(this.faceKey);
        if (texture && typeof texture.refresh === 'function') {
            texture.refresh();
        }
        if (!this.image) {
            this.image = this.scene.add.image(0, 0, this.faceKey);
            this.root.addAt(this.image, 1);
        } else {
            this.image.setTexture(this.faceKey);
        }
        this.image.setDisplaySize(w, h);
    }
}

function uiStageButtonFaceCanvas(scene, key, width, height) {
    if (scene.textures.exists(key)) {
        const current = scene.textures.get(key).getSourceImage();
        if (current && current.width === width && current.height === height) {
            return current;
        }
        scene.textures.remove(key);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    scene.textures.addCanvas(key, canvas);
    return canvas;
}

function uiStageButtonHit(shape, x, y) {
    if (shape.picture) {
        return uiStageButtonAlphaHit(shape, x, y);
    }
    return uiStageButtonContains(shape, x, y);
}

function uiStageButtonAlphaHit(shape, x, y) {
    const data = shape.pixels;
    const pw = shape.pixelW;
    const ph = shape.pixelH;
    if (!data || !pw || !ph || !shape.width || !shape.height) {
        return false;
    }
    const px = Math.floor((x + shape.width / 2) * pw / shape.width);
    const py = Math.floor((y + shape.height / 2) * ph / shape.height);
    if (px < 0 || py < 0 || px >= pw || py >= ph) {
        return false;
    }
    return data[(py * pw + px) * 4 + 3] > 16;
}

function uiStageButtonContains(shape, x, y) {
    const w = shape.width;
    const h = shape.height;
    const radius = Math.min(w, h) / 2;
    if (w >= h) {
        const limit = w / 2 - radius;
        if (Math.abs(x) <= limit && Math.abs(y) <= h / 2) {
            return true;
        }
        const cx = x < 0 ? -limit : limit;
        const dx = x - cx;
        const dy = y;
        return dx * dx + dy * dy <= radius * radius;
    }
    const limit = h / 2 - radius;
    if (Math.abs(y) <= limit && Math.abs(x) <= w / 2) {
        return true;
    }
    const cy = y < 0 ? -limit : limit;
    const dx = x;
    const dy = y - cy;
    return dx * dx + dy * dy <= radius * radius;
}
