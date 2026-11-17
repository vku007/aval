/**
 * CampaignMapScene
 * Hex map, inventory, and one bottom sheet. Shop, log, battle, and score
 * replace each other. The scene holds the view, its ETag, and one notice.
 */
class CampaignMapScene extends Phaser.Scene {
    constructor() {
        super({ key: 'CampaignMapScene' });
    }

    init(data) {
        exitTestsCanvas(this);
        this.readStartData(data);
    }

    create(data) {
        exitTestsCanvas(this);
        this.generation = (this.generation || 0) + 1;
        this.alive = true;
        this.left = false;
        this.view = null;
        this.etag = null;
        this.notice = null;
        this.sheet = null;
        this.selected = null;
        this.moveAlreadyPlayed = false;
        this.battleKey = '';
        this.emptyBattleGets = 0;
        this.shopAmounts = {};
        this.errorText = null;
        this.showReload = false;
        this.busy = false;
        this.attackConfirm = null;
        this.hideAttackFeeNotice = false;
        this.uiObjects = [];
        this.instanceId = null;
        this.settledGameId = null;
        this.settledOver = false;
        this.pendingOutcome = null;
        this.refreshQueued = false;
        this.readStartData(data);
        const generation = this.generation;
        this.events.once('shutdown', () => {
            if (this.generation === generation) this.alive = false;
        });
        fxEnter(this);
        this.draw();
        this.boot(generation);
    }

    readStartData(data) {
        if (!data) return;
        if (data.instanceId) this.instanceId = data.instanceId;
        if (data.settledGameId) this.settledGameId = data.settledGameId;
        if (data.settledOver) this.settledOver = true;
    }

    current(generation) {
        return this.alive && this.generation === generation;
    }

    async boot(generation) {
        const ok = await this.reload(generation);
        if (!this.current(generation) || !ok) return;
        const battle = this.view && this.view.activeBattle;
        if (this.settledOver && battle && battle.gameId && battle.gameId === this.settledGameId) {
            this.settledOver = false;
            const again = await this.reload(generation);
            if (!this.current(generation) || !again) return;
            this.settledOver = true;
        }
        await this.repairEmptyBattle(generation);
        if (!this.current(generation) || this.showReload) return;
        if (this.openBattleResult(generation)) return;
        this.draw();
    }

    async repairEmptyBattle(generation) {
        const battle = this.view && this.view.activeBattle;
        if (!battle || battle.gameId || this.emptyBattleGets >= 1) return;
        this.emptyBattleGets += 1;
        await this.reload(generation);
    }

    async reload(generation) {
        const ticket = generation || this.generation;
        try {
            const result = await this.readWithRetry(() => campaignClient.get(this.instanceId));
            if (!this.current(ticket)) return false;
            this.applyGet(result);
            this.showReload = false;
            this.errorText = null;
            return true;
        } catch (error) {
            if (!this.current(ticket)) return false;
            this.noteReadError(error);
            this.draw();
            return false;
        }
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
        if (error.statusCode === 404) {
            this.goCatalog();
            return;
        }
        if (error.statusCode === 412 || error.statusCode === 0 || error.message === 'Could not read the campaign') {
            this.showReload = true;
            this.errorText = 'Could not read the campaign';
            return;
        }
        this.errorText = (error.data && error.data.detail) || error.message;
    }

    applyGet(result) {
        this.view = result.body.campaign;
        this.etag = result.etag;
        this.notice = null;
        this.pendingOutcome = (result.body && result.body.battleOutcome) || null;
        this.syncBattle();
    }

    openBattleResult() {
        if (!this.settledOver || !this.pendingOutcome || !this.instanceId) return false;
        const outcome = this.pendingOutcome;
        this.settledOver = false;
        this.pendingOutcome = null;
        this.left = true;
        fxGoTo(this, 'CampaignBattleResultScene', {
            instanceId: this.instanceId,
            battleOutcome: outcome
        });
        return true;
    }

    applyCommand(result) {
        const body = result.body || {};
        this.view = body.campaign;
        this.etag = result.etag;
        this.pendingOutcome = body.battleOutcome || null;
        if (body.found) this.notice = { kind: 'found', found: body.found };
        else this.notice = null;
        this.errorText = null;
        this.syncBattle();
    }

    syncBattle() {
        const battle = this.view && this.view.activeBattle;
        const key = battle ? `${battle.q}:${battle.r}:${battle.gameId || ''}` : '';
        if (key !== this.battleKey) {
            this.battleKey = key;
            this.moveAlreadyPlayed = false;
            if (!battle || battle.gameId) this.emptyBattleGets = 0;
        }
    }

    async post(body) {
        if (this.busy || this.left || !body || !this.view || !this.etag) return;
        const generation = this.generation;
        this.busy = true;
        this.errorText = null;
        try {
            const result = await campaignClient.act(this.view.id, body, this.etag);
            if (!this.current(generation)) return;
            this.applyCommand(result);
            const outcome = result.body && result.body.battleOutcome;
            if (outcome && this.view && this.view.id) {
                this.left = true;
                fxGoTo(this, 'CampaignBattleResultScene', {
                    instanceId: this.view.id,
                    battleOutcome: outcome
                });
                return;
            }
            this.leaveToCatalog(body);
        } catch (error) {
            if (!this.current(generation)) return;
            await this.onCommandError(error, generation);
            if (this.current(generation)) this.leaveToCatalog(body);
        } finally {
            this.busy = false;
            if (this.current(generation) && !this.left) this.draw();
        }
    }

    async onCommandError(error, generation) {
        const status = error.statusCode;
        const detail = (error.data && error.data.detail) || '';
        if (status === 412 || status === 0 || error.message === 'Could not read the campaign') {
            await this.reload(generation);
            return;
        }
        if (status === 409 && error.data && error.data.gameId) {
            await this.reload(generation);
            this.sheet = null;
            this.selected = null;
            return;
        }
        if (status === 409 && detail === 'The battle already has a move') {
            await this.reload(generation);
            this.moveAlreadyPlayed = true;
            return;
        }
        if (status === 409 && detail === 'No open battle') {
            await this.reload(generation);
            return;
        }
        if (status === 404) {
            this.goCatalog();
            return;
        }
        this.errorText = detail || error.message;
    }

    onOffer(action) {
        if (!action || !action.enabled || !action.send || !action.body || this.busy) return;
        if (action.confirm === 'fee' && !CampaignOffers.hidesAttackFeeNotice(this.registry.get('currentUser'))) {
            this.attackConfirm = action;
            this.hideAttackFeeNotice = false;
            this.refresh();
            return;
        }
        this.post(action.body);
    }

    toggleHideAttackFeeNotice() {
        if (!this.attackConfirm || this.busy) return;
        this.hideAttackFeeNotice = !this.hideAttackFeeNotice;
        this.refresh();
    }

    async closeAttackConfirm() {
        if (!this.attackConfirm || this.busy) return;
        const hide = !!this.hideAttackFeeNotice;
        this.attackConfirm = null;
        this.hideAttackFeeNotice = false;
        this.refresh();
        if (hide) await this.saveHideAttackFeeNotice();
    }

    async confirmAttack() {
        const action = this.attackConfirm;
        if (!action || this.busy || this.left) return;
        const hide = !!this.hideAttackFeeNotice;
        this.attackConfirm = null;
        this.hideAttackFeeNotice = false;
        this.refresh();
        if (hide) await this.saveHideAttackFeeNotice();
        if (this.alive && !this.left) this.post(action.body);
    }

    async saveHideAttackFeeNotice() {
        if (typeof gameAPI === 'undefined' || !this.etag) return;
        try {
            const result = await gameAPI.patchMe({ settings: { hideAttackFeeNotice: true } }, this.etag);
            if (!this.alive) return;
            if (result && result.etag) this.etag = result.etag;
            if (result && result.body) {
                gameAPI.user = result.body;
                this.registry.set('currentUser', result.body);
            }
        } catch (error) {
            console.error('[CampaignMapScene] Could not store the fee-card setting', error);
        }
    }

    onCell(tile) {
        if (this.attackConfirm || this.busy || !this.view || this.view.activeBattle || this.view.score) return;
        const same = this.selected && this.selected.q === tile.q && this.selected.r === tile.r && this.sheet === 'cell';
        if (same) {
            this.selected = null;
            this.sheet = null;
        } else {
            this.selected = { q: tile.q, r: tile.r };
            this.sheet = 'cell';
        }
        this.refresh();
    }

    openSheet(name) {
        if (this.busy || this.attackConfirm) return;
        if (this.sheet === name) {
            this.sheet = null;
        } else {
            this.sheet = name;
            this.selected = null;
        }
        this.refresh();
    }

    nudge(item, delta) {
        if (this.busy) return;
        const current = this.shopAmounts[item] || 1;
        this.shopAmounts[item] = Math.max(1, Math.min(99, current + delta));
        this.refresh();
    }

    dismissNotice() {
        this.notice = null;
        this.refresh();
    }

    refresh() {
        if (this.refreshQueued) return;
        this.refreshQueued = true;
        queueMicrotask(() => {
            this.refreshQueued = false;
            if (this.alive && !this.left) this.draw();
        });
    }

    onReload() {
        if (this.busy || this.left) return;
        const generation = this.generation;
        this.busy = true;
        this.reload(generation).finally(() => {
            this.busy = false;
            if (this.current(generation) && !this.left) this.draw();
        });
    }

    onPlay() {
        const battle = this.view && this.view.activeBattle;
        if (this.busy || this.left || !battle || !battle.gameId) return;
        this.left = true;
        fxGoTo(this, 'BlitzGameScene', {
            gameId: battle.gameId,
            campaignId: this.view.id,
            returnTo: 'CampaignMapScene'
        });
    }

    onBack() {
        if (this.left || this.attackConfirm) return;
        this.left = true;
        fxGoTo(this, 'CampaignCatalogScene');
    }

    leaveToCatalog(body) {
        if (this.left || !body || body.type !== 'leave') return;
        if (this.view && this.view.status === 'finished' && this.view.finishReason === 'abandoned') {
            this.goCatalog();
        }
    }

    goCatalog() {
        if (this.left) return;
        this.left = true;
        fxGoTo(this, 'CampaignCatalogScene');
    }

    sheetKind() {
        const view = this.view;
        if (!view) return null;
        if (view.activeBattle) return this.sheet === 'log' ? 'log' : 'battle';
        if (this.sheet === 'shop') return 'shop';
        if (this.sheet === 'log') return 'log';
        if (view.score) return 'score';
        if (this.sheet === 'leave' && view.status === 'started') return 'leave';
        if (this.sheet === 'cell' && this.selectedTile()) return 'cell';
        if (view.status === 'finished') return 'finish';
        return null;
    }

    selectedTile() {
        if (!this.selected || !this.view) return null;
        return (this.view.tiles || []).find((tile) => tile.q === this.selected.q && tile.r === this.selected.r) || null;
    }

    draw() {
        this.clearUi();
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        const view = this.view;
        if (!view) {
            this.text(width / 2, 48, this.errorText || 'Loading...', UI.body, 0.5, 0, width - 24);
            if (this.showReload) {
                this.button(12, 96, width - 24, 44, 'Reload', () => this.reload(this.generation), true);
            }
            this.drawChrome(width, height, { back: true });
            return;
        }

        let y = 8;
        const title = this.text(width / 2, y, view.title || '', UI.heading, 0.5, 0);
        y += title.height + 2;
        const attackWord = view.actionPoints >= 1 ? 'Attack ready' : 'Attack spent';
        const turn = this.text(width / 2, y, `Turn ${view.turns}   ${attackWord}`, UI.body, 0.5, 0);
        y += turn.height + 2;
        CampaignOffers.stallLines(view).forEach((line) => {
            const made = this.text(12, y, line, UI.small, 0, 0, width - 24);
            y += made.height + 2;
        });
        if (this.errorText) {
            const err = this.text(12, y, this.errorText, UI.small, 0, 0, width - 24);
            y += err.height + 4;
        }
        if (this.showReload) {
            y += this.button(12, y, width - 24, 40, 'Reload', () => this.onReload(), true) + 4;
        }
        CampaignLabels.inventoryLines(view.inventory).forEach((line) => {
            const made = this.text(8, y, line, UI.small, 0, 0, width - 16);
            y += made.height + 1;
        });

        const chromeTop = height - 52;
        const fieldTop = y + 4;
        const kind = this.sheetKind();
        const natural = (kind || this.notice) ? this.plannedSheetHeight(kind, width - 16) : 0;
        const maxSheet = Math.max(120, chromeTop - fieldTop - 120);
        const sheetH = Math.min(natural, maxSheet);
        const fieldH = Math.max(80, chromeTop - fieldTop - sheetH - 6);
        this.drawHexes(8, fieldTop, width - 16, fieldH);
        if (kind && sheetH > 0) {
            this.drawSheet(kind, 8, chromeTop - sheetH, width - 16, sheetH);
        }
        this.drawChrome(width, height, CampaignOffers.chrome(view));
        if (this.notice && sheetH > 0) {
            this.drawNotice(8, chromeTop - sheetH, width - 16, sheetH);
        }
        this.drawAttackConfirm(width, height);
    }

    plannedSheetHeight(kind, outerW) {
        const textW = outerW - 16;
        let height = 16;
        if (kind === 'shop') {
            const rows = CampaignOffers.shopRows(this.view, this.shopAmounts).length;
            height += this.measureText('Shop', UI.body, textW) + 6 + rows * 34 + 36;
        } else if (kind === 'log') {
            height += this.measureText('Log', UI.body, textW) + 8 + 160 + 36;
        } else if (kind === 'leave') {
            height += this.measureText('Leave this chapter? It will not be scored.', UI.body, textW) + 10 + 44 + 6 + 36;
        } else if (kind === 'battle') {
            const battle = CampaignOffers.battle(this.view, this.moveAlreadyPlayed);
            const line = battle.mode === 'finishing' ? 'Finishing the last battle…' : 'Battle in progress';
            height += this.measureText(line, UI.body, textW) + 4;
            battle.actions.forEach(() => { height += 50; });
        } else if (kind === 'score') {
            const lines = CampaignScoreLines.lines(this.view.score, this.view.rules && this.view.rules.scoreWeights);
            lines.forEach((line) => { height += this.measureText(line.text, UI.body, textW) + 4; });
        } else if (kind === 'finish') {
            CampaignLabels.finishLines(this.view).forEach((line) => {
                height += this.measureText(line, UI.body, textW) + 4;
            });
        } else if (kind === 'cell') {
            const info = CampaignOffers.tileSheet(this.view, this.selectedTile());
            info.lines.forEach((line) => { height += this.measureText(line, UI.body, textW) + 4; });
            if (info.garrison) height += this.garrisonPanelHeight(info.garrison, textW);
            info.actions.forEach((action) => { height += this.measureButton(action.label, textW, 40) + 6; });
            height += this.measureButton('BACK', textW, 36);
        }
        if (this.notice) {
            const lines = this.notice.kind === 'found'
                ? CampaignLabels.foundLines(this.notice.found)
                : CampaignLabels.outcomeLines(this.notice.outcome);
            let noticeH = 16;
            lines.forEach((line) => { noticeH += this.measureText(line, UI.body, textW) + 4; });
            noticeH += this.measureButton('DISMISS', textW, 40);
            height = Math.max(height, noticeH);
        }
        return height;
    }

    measureText(value, size, wrap) {
        const made = this.add.text(0, 0, String(value), {
            font: `${size}px monospace`,
            wordWrap: wrap ? { width: wrap } : undefined
        });
        const height = made.height;
        made.destroy();
        return height;
    }

    measureButton(label, width, minHeight) {
        const fontSize = Math.min(UI.body, 14);
        return Math.max(minHeight, this.measureText(label, fontSize, Math.max(16, width - 8)) + 8);
    }

    drawHexes(x, y, w, h) {
        const tiles = this.view.tiles || [];
        const layout = CampaignHex.layout(tiles, w, h);
        if (!layout.size) return;
        const ox = x + (w - layout.width) / 2 - layout.minX;
        const oy = y - layout.minY;
        tiles.forEach((tile) => {
            const at = CampaignHex.center(tile.q, tile.r, layout.size);
            this.drawHex(tile, ox + at.x, oy + at.y, layout.size);
        });
    }

    drawHex(tile, cx, cy, size) {
        const selected = this.sheet === 'cell' && this.selected && this.selected.q === tile.q && this.selected.r === tile.r;
        const battle = this.view.activeBattle;
        const isBattle = battle && battle.q === tile.q && battle.r === tile.r;
        const attackable = CampaignHex.adjacentToOwned(tile, this.view.tiles);
        let lineWidth = 1;
        let lineColor = 0x000000;
        let fill = null;
        if (tile.visibility === 'hidden') {
            lineColor = 0x999999;
        } else if (tile.visibility === 'blocked') {
            lineColor = 0x999999;
            fill = 0xcccccc;
        } else if (tile.visibility === 'owned') {
            lineWidth = 2;
            fill = 0xf3f3f3;
        }
        if (attackable) lineWidth = 3;
        if (selected || isBattle) lineWidth = 4;

        const raw = CampaignHex.localPoints(size);
        const points = [];
        for (let i = 0; i < raw.length; i += 2) {
            points.push(new Phaser.Geom.Point(raw[i], raw[i + 1]));
        }
        const g = this.add.graphics();
        g.lineStyle(lineWidth, lineColor, 1);
        g.beginPath();
        g.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i += 1) g.lineTo(points[i].x, points[i].y);
        g.closePath();
        if (fill !== null) {
            g.fillStyle(fill, 1);
            g.fillPath();
        }
        g.strokePath();
        const holder = this.add.container(cx, cy, [g]);
        holder.setInteractive(new Phaser.Geom.Polygon(points), Phaser.Geom.Polygon.Contains);
        holder.on('pointerup', () => this.onCell(tile));
        this.track(holder);

        const mark = CampaignHex.mark(tile);
        if (mark) {
            this.text(cx, cy, mark, Math.max(10, Math.floor(size * 0.36)), 0.5, 0.5);
        }
    }

    drawSheet(kind, x, y, w, h) {
        const bg = this.add.graphics();
        bg.fillStyle(0xffffff, 1);
        bg.fillRect(x, y, w, h);
        bg.lineStyle(2, 0x000000, 1);
        bg.strokeRect(x, y, w, h);
        bg.setInteractive(new Phaser.Geom.Rectangle(x, y, w, h), Phaser.Geom.Rectangle.Contains);
        this.track(bg);
        const view = this.view;
        if (kind === 'cell') this.drawCellSheet(view, x + 8, y + 8, w - 16);
        else if (kind === 'shop') this.drawShop(view, x + 8, y + 8, w - 16);
        else if (kind === 'log') this.drawLog(view, x + 8, y + 8, w - 16, h - 16);
        else if (kind === 'leave') this.drawLeave(x + 8, y + 8, w - 16);
        else if (kind === 'battle') this.drawBattle(view, x + 8, y + 8, w - 16);
        else if (kind === 'score') this.drawScore(view, x + 8, y + 8, w - 16);
        else if (kind === 'finish') this.drawLines(CampaignLabels.finishLines(view), x + 8, y + 8, w - 16, UI.body);
    }

    drawCellSheet(view, x, y, w) {
        const tile = this.selectedTile();
        const info = CampaignOffers.tileSheet(view, tile);
        y = this.drawLines(info.lines, x, y, w, UI.body);
        if (info.garrison) y = this.drawGarrisonPanel(info.garrison, x, y, w);
        info.actions.forEach((action) => {
            y += this.button(x, y, w, 40, action.label, () => this.onOffer(action), action.enabled) + 6;
        });
        this.button(x, y, w, 36, 'BACK', () => {
            this.sheet = null;
            this.selected = null;
            this.refresh();
        }, true);
    }

    garrisonBox(panel, textW) {
        const pad = 6;
        const innerW = Math.max(16, textW - pad * 2);
        let inner = this.measureText(panel.title, UI.small, innerW);
        (panel.lines || []).forEach((line) => {
            inner += 2 + this.measureText(line, UI.small, innerW);
        });
        return { pad, innerW, boxH: inner + pad * 2, gap: 6 };
    }

    garrisonPanelHeight(panel, textW) {
        const box = this.garrisonBox(panel, textW);
        return box.boxH + box.gap;
    }

    drawGarrisonPanel(panel, x, y, w) {
        const box = this.garrisonBox(panel, w);
        const bg = this.add.graphics();
        bg.fillStyle(0xf4f4f4, 1);
        bg.fillRect(x, y, w, box.boxH);
        bg.lineStyle(1, 0x000000, 1);
        bg.strokeRect(x, y, w, box.boxH);
        this.track(bg);
        let cursor = y + box.pad;
        const title = this.text(x + box.pad, cursor, panel.title, UI.small, 0, 0, box.innerW);
        cursor += title.height;
        (panel.lines || []).forEach((line) => {
            cursor += 2;
            const made = this.text(x + box.pad, cursor, line, UI.small, 0, 0, box.innerW);
            cursor += made.height;
        });
        return y + box.boxH + box.gap;
    }

    drawShop(view, x, y, w) {
        const title = this.text(x, y, 'Shop', UI.body, 0, 0);
        let cursor = y + title.height + 6;
        const rows = CampaignOffers.shopRows(view, this.shopAmounts);
        const buyW = 84;
        const step = 30;
        const amountW = 24;
        const gap = 4;
        rows.forEach((row) => {
            const buyX = x + w - buyW;
            const plusX = buyX - gap - step;
            const amountX = plusX - gap - amountW;
            const minusX = amountX - gap - step;
            this.text(x, cursor + 8, `${row.label}  ${row.price} copper`, UI.small, 0, 0, Math.max(40, minusX - x - 4));
            this.button(minusX, cursor, step, 30, '−', () => this.nudge(row.item, -1), true);
            this.text(amountX + amountW / 2, cursor + 15, String(row.amount), UI.small, 0.5, 0.5);
            this.button(plusX, cursor, step, 30, '+', () => this.nudge(row.item, 1), true);
            this.button(buyX, cursor, buyW, 30, `BUY ${row.line}`, () => {
                if (row.enabled && row.body) this.post(row.body);
            }, row.enabled);
            cursor += 34;
        });
        this.button(x, cursor, w, 32, 'BACK', () => this.openSheet('shop'), true);
    }

    drawLog(view, x, y, w, h) {
        const title = this.text(x, y, 'Log', UI.body, 0, 0);
        const lines = (view.log || []).map((entry) => `${entry.turn}  ${entry.summary}`);
        const body = lines.length ? lines.join('\n') : '—';
        const text = this.text(x, y + title.height + 4, body, UI.small, 0, 0, w);
        const top = y + title.height + 4;
        const viewH = h - title.height - 40;
        if (text.height > viewH) {
            const mask = this.make.graphics({ add: false });
            mask.fillStyle(0xffffff, 1);
            mask.fillRect(x, top, w, viewH);
            const geom = mask.createGeometryMask();
            text.setMask(geom);
            this.track({ destroy: () => { geom.destroy(); mask.destroy(); } });
            const zone = this.add.zone(x + w / 2, top + viewH / 2, w, viewH).setInteractive();
            let last = null;
            zone.on('pointerdown', (pointer) => { last = pointer.y; });
            zone.on('pointermove', (pointer) => {
                if (!pointer.isDown || last === null) return;
                const next = text.y + (pointer.y - last);
                last = pointer.y;
                const min = top + viewH - text.height;
                text.y = Math.min(top, Math.max(min, next));
            });
            zone.on('pointerup', () => { last = null; });
            this.track(zone);
        }
        this.button(x, y + h - 34, w, 32, 'BACK', () => this.openSheet('log'), true);
    }

    drawAttackConfirm(width, height) {
        if (!this.attackConfirm) return;
        const dim = this.add.rectangle(0, 0, width, height, 0x000000, 0.45);
        dim.setOrigin(0, 0);
        dim.setInteractive();
        dim.on('pointerup', () => this.closeAttackConfirm());
        this.track(dim);

        const cardW = Math.min(340, width - 32);
        const cardH = 220;
        const x = (width - cardW) / 2;
        const y = (height - cardH) / 2;
        const bg = this.add.graphics();
        bg.fillStyle(0xffffff, 1);
        bg.fillRect(x, y, cardW, cardH);
        bg.lineStyle(2, 0x000000, 1);
        bg.strokeRect(x, y, cardW, cardH);
        bg.setInteractive(new Phaser.Geom.Rectangle(x, y, cardW, cardH), Phaser.Geom.Rectangle.Contains);
        this.track(bg);

        this.text(width / 2, y + 16, CampaignOffers.attackFeeLine(this.view), UI.body, 0.5, 0, cardW - 24);
        this.drawFeeCheckbox(x + 16, y + 56, cardW - 32);
        const btnW = cardW - 24;
        this.button(x + 12, y + 96, btnW, 44, 'ATTACK', () => this.confirmAttack(), true);
        this.button(x + 12, y + 148, btnW, 36, 'BACK', () => this.closeAttackConfirm(), true);
    }

    drawFeeCheckbox(x, y, w) {
        const box = 18;
        const checked = !!this.hideAttackFeeNotice;
        const row = this.add.container(x, y);
        const square = this.add.graphics();
        square.lineStyle(2, 0x000000, 1);
        square.strokeRect(0, 0, box, box);
        if (checked) {
            square.fillStyle(0x000000, 1);
            square.fillRect(4, 4, box - 8, box - 8);
        }
        const label = this.add.text(box + 8, box / 2, 'do not show this window', {
            font: `${UI.body}px monospace`,
            fill: '#000000'
        }).setOrigin(0, 0.5);
        row.add([square, label]);
        const hitW = Math.min(w, box + 8 + label.width);
        row.setInteractive(new Phaser.Geom.Rectangle(0, -4, hitW, box + 8), Phaser.Geom.Rectangle.Contains);
        bindPress(this, row, {
            isEnabled: () => !this.busy,
            onClick: () => this.toggleHideAttackFeeNotice()
        });
        this.track(row);
    }

    drawLeave(x, y, w) {
        const copy = this.text(x, y, 'Leave this chapter? It will not be scored.', UI.body, 0, 0, w);
        y += copy.height + 10;
        y += this.button(x, y, w, 44, 'Leave', () => this.post({ type: 'leave' }), true) + 6;
        this.button(x, y, w, 36, 'BACK', () => this.openSheet('leave'), true);
    }

    drawBattle(view, x, y, w) {
        const battle = CampaignOffers.battle(view, this.moveAlreadyPlayed);
        const lines = battle.mode === 'finishing'
            ? ['Finishing the last battle…']
            : ['Battle in progress'];
        y = this.drawLines(lines, x, y, w, UI.body);
        battle.actions.forEach((action) => {
            const click = action.id === 'play' ? () => this.onPlay() : () => this.onOffer(action);
            y += this.button(x, y, w, 44, action.label, click, action.enabled) + 6;
        });
    }

    drawScore(view, x, y, w) {
        const lines = CampaignScoreLines.lines(view.score, view.rules && view.rules.scoreWeights);
        this.drawLines(lines.map((line) => line.text), x, y, w, UI.body);
    }

    drawNotice(x, y, w, h) {
        const bg = this.add.graphics();
        bg.fillStyle(0xffffff, 1);
        bg.fillRect(x, y, w, h);
        bg.lineStyle(2, 0x000000, 1);
        bg.strokeRect(x, y, w, h);
        bg.setInteractive(new Phaser.Geom.Rectangle(x, y, w, h), Phaser.Geom.Rectangle.Contains);
        this.track(bg);
        const lines = this.notice.kind === 'found'
            ? CampaignLabels.foundLines(this.notice.found)
            : CampaignLabels.outcomeLines(this.notice.outcome);
        const next = this.drawLines(lines, x + 8, y + 8, w - 16, UI.body);
        this.button(x + 8, next, w - 16, 40, 'DISMISS', () => this.dismissNotice(), true);
    }

    drawLines(lines, x, y, w, size) {
        (lines || []).forEach((line) => {
            if (!line) return;
            const made = this.text(x, y, line, size, 0, 0, w);
            y += made.height + 4;
        });
        return y;
    }

    drawChrome(width, height, flags) {
        const buttons = [];
        const end = this.view && CampaignOffers.endTurn(this.view);
        if (flags.endTurn && end) buttons.push({ label: end.label, onClick: () => this.onOffer(end) });
        if (flags.shop) buttons.push({ label: 'SHOP', onClick: () => this.openSheet('shop') });
        if (flags.log) buttons.push({ label: 'LOG', onClick: () => this.openSheet('log') });
        if (flags.leave) buttons.push({ label: 'LEAVE', onClick: () => this.openSheet('leave') });
        if (flags.back) buttons.push({ label: 'BACK', onClick: () => this.onBack() });
        if (!buttons.length) return;
        const gap = 4;
        const y = height - 48;
        const total = width - 12;
        const bw = (total - gap * (buttons.length - 1)) / buttons.length;
        let x = 6;
        buttons.forEach((btn) => {
            this.button(x, y, bw, 42, btn.label, btn.onClick, true, 12);
            x += bw + gap;
        });
    }

    text(x, y, value, size, originX, originY, wrap) {
        const made = this.add.text(x, y, String(value), {
            font: `${size}px monospace`,
            fill: '#000000',
            align: originX === 0.5 ? 'center' : 'left',
            wordWrap: wrap ? { width: wrap } : undefined
        }).setOrigin(originX || 0, originY || 0);
        this.track(made);
        return made;
    }

    button(x, y, w, h, label, onClick, enabled, fontSize) {
        const text = this.add.text(0, 0, label, {
            font: `${fontSize || Math.min(UI.body, 14)}px monospace`,
            fill: enabled ? '#000000' : '#999999',
            align: 'center',
            wordWrap: { width: Math.max(16, w - 8) }
        }).setOrigin(0.5);
        const height = Math.max(h, text.height + 8);
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
