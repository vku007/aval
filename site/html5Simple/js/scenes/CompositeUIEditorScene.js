/**
 * CompositeUIEditorScene
 * Copy of UIEditorScene. Stage canvas only. Same logical size and scale as the main scene.
 * Effects, props, and objects live on a second Phaser canvas.
 */
class CompositeUIEditorScene extends Phaser.Scene {
    constructor() {
        super({ key: 'CompositeUIEditorScene' });
        console.log('[CompositeUIEditorScene] Constructor called');
    }

    init() {
        exitTestsCanvas(this);
    }

    create() {
        exitTestsCanvas(this);
        console.log('[CompositeUIEditorScene] create() started');
        fxEnter(this);
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        this._left = false;

        this.heatMap = new UiHeatMap(this, {
            x: 0,
            y: 0,
            width: width,
            height: height
        });
        this.add.text(12, 12, 'STAGE', {
            font: `bold ${UI.small}px monospace`,
            fill: '#c8c8c8',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0, 0);
        this.heatMap.onTap = (cell) => {
            if (this.selectedObject && typeof this.selectedObject.retarget === 'function') {
                this.selectedObject.retarget(cell);
            }
        };

        this.balls = [];
        this.rods = [];
        this.highlighters = [];
        this.shards = [];
        this.sheets = [];
        this.pointers = [];
        this.rounds = [];
        this.circles = [];
        this.cores = [];
        this.primes = [];
        this.stone = new HotMapUiStone(this.heatMap, { name: 'Stone' });
        this.scissor = new HotMapUiScissor(this.heatMap, { name: 'Scissor' });
        this.newPaper = new HotMapUiNewPaper(this.heatMap, { name: 'New Paper' });
        this.core = new UiCore(this.heatMap, { name: 'Core', centerX: 50, centerY: 48 });
        this.cores.push(this.core);
        this.prime = new UiPrime(this.heatMap, {
            name: 'Prime',
            centerX: 78,
            centerY: 22,
            animate: false
        });
        this.primes.push(this.prime);
        this.stonePrime = new HotMapUiStonePrime(this.heatMap, {
            name: 'Stone Prime',
            center: { col: 28, row: 48 },
            animate: false
        });
        this.scissorsPrime = new HotMapUiScissorsPrime(this.heatMap, {
            name: 'Scissors Prime',
            center: { col: 102, row: 210 },
            animate: false
        });
        this.paperPrime = new HotMapUiPaperPrime(this.heatMap, {
            name: 'Paper Prime',
            center: { col: 36, row: 250 },
            animate: false
        });
        this.amount = new HmHorisontalAmountIndicator(this.heatMap, {
            name: 'Amount',
            width: 100,
            height: 16,
            maxAmount: 8,
            stored: 5,
            selected: 2,
            center: { col: 65, row: 36 }
        });
        this.verticalAmount = new HmVerticalAmountIndicator(this.heatMap, {
            name: 'Amount V',
            width: 16,
            height: 100,
            maxAmount: 8,
            stored: 5,
            selected: 2,
            center: { col: 22, row: 160 }
        });
        this.tableAmount = new HmVerticalTableAmountIndicator(this.heatMap, {
            name: 'Amount Table',
            width: 44,
            height: 80,
            maxAmount: 8,
            columns: 2,
            stored: 5,
            selected: 2,
            center: { col: 108, row: 148 }
        });
        this.objects = [this.stone, this.scissor, this.newPaper, this.core, this.prime, this.stonePrime, this.scissorsPrime, this.paperPrime, this.amount, this.verticalAmount, this.tableAmount];
        this.selectedObject = this.stone;
        this.stageMarkup = createUiStageMarkup(this, width, height);
        this.menuMarkup = createUiMenuMarkup(this, width, height);
        applyCompositeHeatMapDefault(this);
        this.events.once('shutdown', () => closeEditorTools());
        openEditorTools(this, CompositeUIEditorToolsScene);
    }

    update(time, delta) {
        if (this.heatMap && typeof this.heatMap.update === 'function') {
            this.heatMap.update(time, delta);
        }
    }

    leave() {
        if (this._left) {
            return;
        }
        this._left = true;
        closeEditorTools();
        fxGoTo(this, 'TestsScene');
    }
}

const COMPOSITE_HEAT_MAP_JSON_KEY = 'compositeHeatMapInit';
const COMPOSITE_HEAT_MAP_JSON_PATH = 'resources/hotmap-1.json?v=101';

function preloadCompositeHeatMap(scene) {
    if (!scene || !scene.load || scene.cache.json.exists(COMPOSITE_HEAT_MAP_JSON_KEY)) {
        return;
    }
    scene.load.json(COMPOSITE_HEAT_MAP_JSON_KEY, COMPOSITE_HEAT_MAP_JSON_PATH);
}

function applyCompositeHeatMapDefault(scene) {
    if (!scene || !scene.heatMap || !scene.cache || !scene.cache.json.exists(COMPOSITE_HEAT_MAP_JSON_KEY)) {
        return;
    }
    const raw = scene.cache.json.get(COMPOSITE_HEAT_MAP_JSON_KEY);
    const data = raw && raw.heatMap;
    if (data && typeof scene.heatMap.applySerialized === 'function') {
        scene.heatMap.applySerialized(data);
    }
}
