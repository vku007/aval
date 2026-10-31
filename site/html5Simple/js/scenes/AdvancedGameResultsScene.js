/**
 * AdvancedGameResultsScene
 * Shown when a blitz match finishes.
 * OK returns to the scene that opened it, or the main menu.
 */
class AdvancedGameResultsScene extends Phaser.Scene {
    constructor() {
        super({ key: 'AdvancedGameResultsScene' });
    }

    init(data) {
        exitTestsCanvas(this);
        this.gameData = data && data.gameData ? data.gameData : null;
        this.returnTo = data && data.returnTo ? data.returnTo : 'MenuScene';
        this._leaving = false;
    }

    create() {
        exitTestsCanvas(this);
        fxEnter(this);
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        this.skinHost = null;
        this.skinLabels = [];
        this.skinValues = [];
        this.resultButtons = [];
        const user = this.registry.get('currentUser');
        const summary = SimpleGameSceneUtil.summarizeAdvancedResult(this.gameData, user && user.id);

        const title = this.add.text(width / 2, 60, this.resultTitle(summary), {
            font: `${UI.heading}px monospace`,
            fill: '#000000',
            align: 'center'
        }).setOrigin(0.5, 0);
        const maxTitleWidth = width - UI.pad * 2;
        let titleSize = UI.heading;
        while (title.width > maxTitleWidth && titleSize > UI.body) {
            titleSize -= 1;
            title.setFont(`${titleSize}px monospace`);
        }
        this.skinValues.push(title);
        styleUiSkinText(title, isUiSkinOn());

        this.resultBar = new RoundsResultBar(this, width / 2, 0, {
            endLeftValue: summary.playerScore,
            endRightValue: summary.enemyScore
        });
        this.stonesBar = new StonesResultBar(this, width / 2, 0, {
            endLeftValue: summary.items.stones,
            endRightValue: summary.enemyItems.stones
        });
        this.stonePrimeBar = new StonePrimeResultBar(this, width / 2, 0, {
            endLeftValue: summary.effects.NA_effect_stone,
            endRightValue: summary.enemyEffects.NA_effect_stone
        });
        this.scissorsBar = new ScissorsResultBar(this, width / 2, 0, {
            endLeftValue: summary.items.scissors,
            endRightValue: summary.enemyItems.scissors
        });
        this.scissorPrimeBar = new ScissorsPrimeResultBar(this, width / 2, 0, {
            endLeftValue: summary.effects.NA_effect_scissors,
            endRightValue: summary.enemyEffects.NA_effect_scissors
        });
        this.paperBar = new PaperResultBar(this, width / 2, 0, {
            endLeftValue: summary.items.papers,
            endRightValue: summary.enemyItems.papers
        });
        this.paperPrimeBar = new PaperPrimeResultBar(this, width / 2, 0, {
            endLeftValue: summary.effects.NA_effect_papers,
            endRightValue: summary.enemyEffects.NA_effect_papers
        });
        this.coreResultBar = new CoreResultBar(this, width / 2, 0, {
            endLeftValue: summary.effects.NT_effect,
            endRightValue: summary.enemyEffects.NT_effect
        });
        this.resultBars().forEach((bar) => {
            if (bar.captionText) {
                this.skinLabels.push(bar.captionText);
                this.styleResultLabel(bar.captionText, isUiSkinOn());
            }
        });
        const y = this.placeResultBars(title);

        const skinH = 28;
        const skinY = height - 16 - skinH / 2;
        this.skinSwitch = createUiSkinSwitch(this, (on) => this.setResultsSkin(on), { y: skinY });

        const btnH = UI.menuBtnH;
        const maxBtnY = skinY - skinH / 2 - 16 - btnH / 2;
        const btnY = Math.min(Math.max(y + 12 + btnH / 2, height * 0.72), maxBtnY);
        this.resultButtons.push(this.createOkButton(width / 2, btnY));
        this.setResultsSkin(isUiSkinOn());
    }

    resultBars() {
        return [
            this.resultBar,
            this.stonesBar,
            this.stonePrimeBar,
            this.scissorsBar,
            this.scissorPrimeBar,
            this.paperBar,
            this.paperPrimeBar,
            this.coreResultBar
        ].filter(Boolean);
    }

    placeResultBars(title) {
        const bars = this.resultBars();
        const barH = bars[0].height;
        const above = bars[0].spaceAbove();
        const barGap = above > 0 ? above + 12 : 20;
        let y = title.y + title.height + barGap + barH / 2;
        bars.forEach((bar, index) => {
            if (index > 0) {
                y += barH / 2 + 6 + bar.spaceAbove() + barH / 2;
            }
            bar.root.y = y;
        });
        return y + barH / 2 + 10;
    }

    update(time, delta) {
        this.resultBars().forEach((bar) => bar.update(time, delta));
        if (this.skinHost && isUiSkinOn()) {
            this.skinHost.update(time, delta);
        }
    }

    setResultsSkin(on) {
        if (on) {
            if (!this.resultsSkinLive()) {
                if (this.skinHost) {
                    this.skinHost.setVisible(false);
                    this.skinHost = null;
                }
                const width = this.cameras.main.width;
                const height = this.cameras.main.height;
                this.skinHost = mountUiSkin(this, { x: 0, y: 0, width, height }, { highlighters: false });
            }
            if (this.skinHost) {
                this.skinHost.setVisible(true);
                this.linkOkHighlight();
                this.linkResultBarHighlight();
            }
        } else if (this.skinHost) {
            this.skinHost.setVisible(false);
        }
        (this.skinLabels || []).forEach((text) => this.styleResultLabel(text, on));
        (this.skinValues || []).forEach((text) => styleUiSkinText(text, on));
        (this.resultButtons || []).forEach((btn) => styleUiSkinMenuButton(this, btn, on));
    }

    styleResultLabel(text, on) {
        if (!text) {
            return;
        }
        if (on) {
            styleUiSkinText(text, true);
            return;
        }
        text.setColor('#666666');
        if (typeof text.setStroke === 'function') {
            text.setStroke('#000000', 0);
        }
    }

    linkResultBarHighlight() {
        const host = this.skinHost;
        if (!host || !host.heatMap) {
            return;
        }
        this.resultBars().forEach((bar) => {
            if (!bar) {
                return;
            }
            if (bar.highlight && heatMapOwns(host.heatMap, bar.highlight)) {
                resultBarSeekRise(bar);
                return;
            }
            const mounted = createResultBarHighlight(host.heatMap, bar);
            host.highlighters.push(mounted.highlight);
        });
    }

    linkOkHighlight() {
        const host = this.skinHost;
        const btn = (this.resultButtons || [])[0];
        if (!host || !host.heatMap || !btn) {
            return;
        }
        let highlight = btn.menuHighlight;
        if (!highlight || !heatMapOwns(host.heatMap, highlight)) {
            highlight = createResultsOkHighlight(host.heatMap, btn);
            host.highlighters.push(highlight);
        }
        if (btn.menuHighlight === highlight) {
            return;
        }
        highlight.armHover();
        btn.menuHighlight = highlight;
        btn.menuLabel = 'OK';
        btn.on('pointerover', () => highlight.setHovered(true));
        btn.on('pointerout', () => highlight.setHovered(false));
        if (typeof pointerInsideMenuButton === 'function' && pointerInsideMenuButton(this, btn)) {
            highlight.setHovered(true);
        }
    }

    resultsSkinLive() {
        const host = this.skinHost;
        if (!host || !host.heatMap || host.heatMap.scene !== this) {
            return false;
        }
        const lists = [host.balls, host.rods, host.highlighters];
        return lists.every((list) => (list || []).every((item) => heatMapOwns(host.heatMap, item)));
    }

    resultTitle(summary) {
        if (summary.winner === 'you') {
            return 'Victory!';
        }
        if (summary.winner === 'enemy') {
            return 'Defeat...';
        }
        return 'Draw';
    }

    onOkClick() {
        if (this._leaving) {
            return;
        }
        this._leaving = true;
        fxGoTo(this, this.returnTo || 'MenuScene');
    }

    createOkButton(x, y) {
        const btn = this.add.container(x, y);
        const btnWidth = UI.menuBtnW;
        const btnHeight = UI.menuBtnH;
        const bg = this.add.graphics();
        bg.lineStyle(2, 0x000000, 1);
        bg.strokeRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight);
        const text = this.add.text(0, 0, 'OK', {
            font: `${UI.heading}px monospace`,
            fill: '#000000'
        }).setOrigin(0.5);
        btn.add([bg, text]);
        btn.buttonBg = bg;
        btn.buttonText = text;
        btn.buttonWidth = btnWidth;
        btn.buttonHeight = btnHeight;
        const hitArea = new Phaser.Geom.Rectangle(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight);
        btn.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains, { useHandCursor: true });
        bindPress(this, btn, {
            strong: true,
            particles: true,
            onClick: () => this.onOkClick()
        });
        return btn;
    }
}

function createResultsOkHighlight(heatMap, btn) {
    const cell = resultsHeatCell(heatMap, btn.x, btn.y);
    return new UiBackHighlighter(heatMap, {
        name: 'OK',
        cycling: false,
        center: cell,
        target: { col: cell.col, row: cell.row },
        params: { speed: 6, delay: 0.5, gap: 0.4 },
        from: { width: 106, height: 18, angle: 0, heat: 0.1 },
        to: { width: 108, height: 22, angle: 0, heat: 0.9 }
    });
}

function resultsHeatCell(heatMap, x, y) {
    const field = heatMap.field;
    const bounds = heatMap.bounds;
    return {
        col: ((x - bounds.x) / Math.max(bounds.width, 1)) * (field.cols - 1),
        row: ((y - bounds.y) / Math.max(bounds.height, 1)) * (field.rows - 1)
    };
}
