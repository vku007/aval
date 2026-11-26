/**
 * CampaignSetupScene
 * Upload an editor chapter file and start Chapter I from it.
 */
class CampaignSetupScene extends Phaser.Scene {
    constructor() {
        super({ key: 'CampaignSetupScene' });
    }

    create() {
        this.generation = (this.generation || 0) + 1;
        this.alive = true;
        this.left = false;
        this.etag = null;
        this.errorText = null;
        this.showReload = false;
        this.busy = false;
        this.catalogLoaded = false;
        this.uiObjects = [];
        const generation = this.generation;
        this.events.once('shutdown', () => {
            if (this.generation === generation) {
                this.alive = false;
                this.removeFileInput();
            }
        });
        this.removeFileInput();
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.style.display = 'none';
        input.addEventListener('change', () => {
            this.onFileChosen();
        });
        document.body.appendChild(input);
        this.fileInput = input;
        fxEnter(this);
        this.draw();
        this.loadCatalog(generation);
    }

    current(generation) {
        return this.alive && this.generation === generation;
    }

    async loadCatalog(generation) {
        const ticket = generation || this.generation;
        try {
            const result = await this.readWithRetry(() => campaignClient.catalog());
            if (!this.current(ticket)) return;
            this.etag = result.etag;
            this.catalogLoaded = true;
            this.errorText = null;
            this.showReload = false;
        } catch (error) {
            if (!this.current(ticket)) return;
            this.noteReadError(error);
        }
        if (this.current(ticket)) this.draw();
    }

    async readWithRetry(getter) {
        try {
            return await getter();
        } catch (error) {
            if (error.statusCode === 412 || error.message === 'Could not read the campaign') {
                return getter();
            }
            throw error;
        }
    }

    noteReadError(error) {
        if (error.statusCode === 412 || error.statusCode === 0 || error.message === 'Could not read the campaign') {
            this.showReload = true;
            this.errorText = 'Could not read the campaign';
            return;
        }
        this.errorText = (error.data && error.data.detail) || error.message;
    }

    pickFile() {
        if (this.busy || this.left || !this.fileInput) return;
        this.fileInput.click();
    }

    async onFileChosen() {
        const input = this.fileInput;
        const file = input && input.files && input.files[0];
        if (input) input.value = '';
        if (!file || !this.alive || this.left || this.busy) return;
        if (file.size > 65536) {
            this.errorText = 'Campaign file is too large';
            this.showReload = false;
            this.draw();
            return;
        }
        let settings;
        try {
            settings = JSON.parse(await file.text());
        } catch (error) {
            if (!this.alive || this.left) return;
            this.errorText = 'Invalid JSON';
            this.showReload = false;
            this.draw();
            return;
        }
        if (!this.etag) {
            this.errorText = 'Could not read the campaign';
            this.showReload = true;
            this.draw();
            return;
        }
        const generation = this.generation;
        this.busy = true;
        this.errorText = null;
        this.draw();
        try {
            const result = await campaignClient.startFromFile(settings, this.etag);
            if (!this.current(generation)) return;
            const id = result.body && result.body.campaign && result.body.campaign.id;
            if (!this.current(generation) || this.left) return;
            if (!id) {
                this.busy = false;
                this.errorText = 'Could not read the campaign';
                this.draw();
                return;
            }
            this.goMap(id);
        } catch (error) {
            if (!this.current(generation) || this.left) return;
            this.busy = false;
            await this.onStartError(error, generation);
        } finally {
            if (this.current(generation) && !this.left) this.busy = false;
        }
    }

    async onStartError(error, generation) {
        const status = error.statusCode;
        const detail = (error.data && error.data.detail) || error.message;
        if (status === 412) {
            await this.loadCatalog(generation);
            if (!this.current(generation) || this.left) return;
            this.errorText = detail;
            this.showReload = false;
            this.draw();
            return;
        }
        if (status === 0 || error.message === 'Could not read the campaign') {
            await this.loadCatalog(generation);
            return;
        }
        this.errorText = detail;
        this.showReload = false;
        this.draw();
    }

    goMap(instanceId) {
        this.left = true;
        this.removeFileInput();
        fxGoTo(this, 'CampaignMapScene', { instanceId });
    }

    onBack() {
        if (this.left) return;
        this.left = true;
        this.removeFileInput();
        fxGoTo(this, 'GameSelectScene');
    }

    removeFileInput() {
        if (!this.fileInput) return;
        this.fileInput.remove();
        this.fileInput = null;
    }

    draw() {
        this.clearUi();
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        this.text(width / 2, 56, 'Warm Adventure', UI.title, 0.5, 0);
        this.text(width / 2, 96, 'Setup campaign', UI.body, 0.5, 0);
        if (!this.catalogLoaded && !this.errorText) {
            this.text(width / 2, 140, 'Loading...', UI.body, 0.5, 0);
        }
        let y = 220;
        y += this.button(
            (width - UI.menuBtnW) / 2,
            y,
            UI.menuBtnW,
            UI.menuPrimaryH,
            'FROM CAMPAIGN FILE',
            () => this.pickFile(),
            !this.busy
        );
        y += 16;
        if (this.errorText) {
            const made = this.text((width - (width - 48)) / 2, y, this.errorText, UI.body, 0, 0, width - 48);
            y += made.height + 12;
        }
        if (this.showReload) {
            this.button((width - UI.menuBtnW) / 2, y, UI.menuBtnW, 44, 'Reload', () => this.loadCatalog(this.generation), !this.busy);
        }
        this.button(
            (width - UI.menuBtnW) / 2,
            height - 80,
            UI.menuBtnW,
            UI.menuBtnH,
            'BACK',
            () => this.onBack(),
            true,
            { stayActive: true }
        );
    }

    text(x, y, value, size, originX, originY, wrap) {
        const made = this.add.text(x, y, value, {
            font: `${size}px monospace`,
            fill: '#000000',
            wordWrap: wrap ? { width: wrap } : undefined
        }).setOrigin(originX || 0, originY || 0);
        this.track(made);
        return made;
    }

    button(x, y, w, h, label, onClick, enabled, options) {
        const stayActive = !!(options && options.stayActive);
        const shown = stayActive || enabled;
        const live = () => {
            if (this.left) return false;
            if (stayActive) return true;
            return enabled && !this.busy;
        };
        const text = this.add.text(0, 0, label, {
            font: `${UI.heading}px monospace`,
            fill: shown ? '#000000' : '#999999',
            align: 'center',
            wordWrap: { width: Math.max(20, w - 12) }
        }).setOrigin(0.5);
        const height = Math.max(h, text.height + 12);
        const bg = this.add.graphics();
        bg.lineStyle(2, shown ? 0x000000 : 0x999999, 1);
        bg.strokeRect(-w / 2, -height / 2, w, height);
        const btn = this.add.container(x + w / 2, y + height / 2, [bg, text]);
        btn.setInteractive(
            new Phaser.Geom.Rectangle(-w / 2, -height / 2, w, height),
            Phaser.Geom.Rectangle.Contains
        );
        bindPress(this, btn, {
            isEnabled: live,
            onClick: () => {
                if (live()) onClick();
            }
        });
        this.track(btn);
        return height;
    }

    track(obj) {
        this.uiObjects.push(obj);
        return obj;
    }

    clearUi() {
        (this.uiObjects || []).forEach((obj) => {
            if (obj && obj.destroy) obj.destroy();
        });
        this.uiObjects = [];
    }
}
