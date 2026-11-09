/**
 * CampaignCatalogScene
 * One block per definition: goal, best, start or continue, history.
 */
class CampaignCatalogScene extends Phaser.Scene {
    constructor() {
        super({ key: 'CampaignCatalogScene' });
    }

    init() {
        exitTestsCanvas(this);
    }

    create() {
        exitTestsCanvas(this);
        this.generation = (this.generation || 0) + 1;
        this.alive = true;
        this.left = false;
        this.catalog = null;
        this.etag = null;
        this.errorText = null;
        this.showReload = false;
        this.busy = false;
        this.uiObjects = [];
        const generation = this.generation;
        this.events.once('shutdown', () => {
            if (this.generation === generation) this.alive = false;
        });
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
            this.catalog = result.body;
            this.etag = result.etag;
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

    async onStart(definitionId) {
        if (this.busy || this.left) return;
        if (!this.etag) {
            this.errorText = 'Could not read the campaign';
            this.showReload = true;
            this.draw();
            return;
        }
        const generation = this.generation;
        this.busy = true;
        this.errorText = null;
        try {
            const result = await campaignClient.start(definitionId, this.etag);
            if (!this.current(generation)) return;
            const id = result.body && result.body.campaign && result.body.campaign.id;
            if (!id) {
                this.errorText = 'Could not read the campaign';
                this.draw();
                return;
            }
            this.goMap(id);
        } catch (error) {
            if (!this.current(generation)) return;
            await this.onStartError(definitionId, error, generation);
        } finally {
            this.busy = false;
        }
    }

    async onStartError(definitionId, error, generation) {
        const status = error.statusCode;
        const detail = (error.data && error.data.detail) || error.message;
        if (status === 412 || status === 0 || error.message === 'Could not read the campaign') {
            await this.loadCatalog(generation);
            if (!this.current(generation) || this.left) return;
            if (status !== 412) {
                const row = this.row(definitionId);
                if (row && row.currentStatus === 'started' && row.instanceId) {
                    this.goMap(row.instanceId);
                }
            }
            return;
        }
        if (status === 409) {
            await this.loadCatalog(generation);
            if (!this.current(generation) || this.left) return;
            const row = this.row(definitionId);
            if (row && row.instanceId) {
                this.goMap(row.instanceId);
                return;
            }
        }
        this.errorText = detail;
        this.draw();
    }

    row(definitionId) {
        const definitions = (this.catalog && this.catalog.definitions) || [];
        return definitions.find((row) => row.id === definitionId) || null;
    }

    goMap(instanceId) {
        this.left = true;
        fxGoTo(this, 'CampaignMapScene', { instanceId });
    }

    onBack() {
        if (this.left) return;
        this.left = true;
        fxGoTo(this, 'GameSelectScene');
    }

    draw() {
        this.clearUi();
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        const definitions = (this.catalog && this.catalog.definitions) || [];
        let y = 16;
        if (!this.catalog) {
            this.text(width / 2, 48, this.errorText || 'Loading...', UI.body, 0.5, 0, width - 24);
        }
        definitions.forEach((row) => {
            y = this.drawDefinition(row, 12, y, width - 24);
            y += 12;
        });
        if (this.errorText && this.catalog) {
            this.text(12, y, this.errorText, UI.small, 0, 0, width - 24);
            y += 36;
        }
        if (this.showReload) {
            this.button(12, y, width - 24, 44, 'Reload', () => this.loadCatalog(this.generation), true);
        }
        this.button(12, height - 56, width - 24, 44, 'BACK', () => this.onBack(), true);
    }

    drawDefinition(row, x, y, width) {
        const title = this.text(x, y, row.title || '', UI.title, 0, 0, width);
        y += title.height + 8;
        const goal = this.text(x, y, row.goal || '', UI.body, 0, 0, width);
        y += goal.height + 8;
        if (row.bestScore !== null && row.bestScore !== undefined) {
            const best = this.text(x, y, `Best ${row.bestScore}`, UI.body, 0, 0, width);
            y += best.height + 8;
        }
        const label = row.currentStatus === 'started' ? 'CONTINUE' : 'START';
        const action = row.currentStatus === 'started'
            ? () => row.instanceId && this.goMap(row.instanceId)
            : () => this.onStart(row.id);
        y += this.button(x, y, width, UI.menuPrimaryH, label, action, true) + 8;
        CampaignLabels.visibleHistory(row.history).forEach((entry) => {
            const historyLabel = CampaignLabels.historyLabel(entry);
            y += this.button(x, y, width, 44, historyLabel, () => this.goMap(entry.instanceId), true) + 6;
        });
        return y;
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

    button(x, y, w, h, label, onClick, enabled) {
        const text = this.add.text(0, 0, label, {
            font: `${UI.heading}px monospace`,
            fill: enabled ? '#000000' : '#999999',
            align: 'center',
            wordWrap: { width: Math.max(20, w - 12) }
        }).setOrigin(0.5);
        const height = Math.max(h, text.height + 12);
        const bg = this.add.graphics();
        bg.lineStyle(2, enabled ? 0x000000 : 0x999999, 1);
        if (!enabled) {
            bg.fillStyle(0xeeeeee, 1);
            bg.fillRect(-w / 2, -height / 2, w, height);
        }
        bg.strokeRect(-w / 2, -height / 2, w, height);
        const btn = this.add.container(x + w / 2, y + height / 2, [bg, text]);
        btn.setInteractive(
            new Phaser.Geom.Rectangle(-w / 2, -height / 2, w, height),
            Phaser.Geom.Rectangle.Contains
        );
        bindPress(this, btn, {
            isEnabled: () => enabled && !this.busy,
            onClick: () => {
                if (enabled && !this.busy) onClick();
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
