const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { runInNewContext } = require('node:vm');

function loadCampaign() {
  const dir = __dirname;
  const context = {
    console,
    window: {},
    APIError: class APIError extends Error {
      constructor(message, statusCode, data = null) {
        super(message);
        this.name = 'APIError';
        this.statusCode = statusCode;
        this.data = data;
      }
    },
    gameAPI: {
      token: 'token-1',
      baseUrl: 'http://127.0.0.1:3000/apiv2/external'
    },
    fetchCalls: []
  };
  context.fetch = async (url, options) => {
    context.fetchCalls.push({ url, options });
    return context.fetchImpl(url, options);
  };
  for (const file of ['labels.js', 'hex.js', 'scoreLines.js', 'offers.js', 'campaignClient.js']) {
    const source = readFileSync(path.join(dir, file), 'utf8');
    runInNewContext(source, context, { filename: file });
  }
  return context;
}

function same(actual, expected) {
  assert.deepEqual(JSON.parse(JSON.stringify(actual)), expected);
}

function jsonResponse(status, body, etag) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get(name) {
        const key = String(name).toLowerCase();
        if (key === 'content-type') return 'application/json';
        if (key === 'etag') return etag || null;
        return null;
      }
    },
    json: async () => body
  };
}

function campTile(extra) {
  return {
    q: 0,
    r: 0,
    visibility: 'owned',
    owner: 'player',
    income: { product: 'copper', perTurn: 2 },
    mines: 1,
    maxMines: 3,
    dugThisTurn: false,
    searchedThisTurn: false,
    increasedThisTurn: false,
    searchAvailable: false,
    ...extra
  };
}

function seenTile(q, r, extra) {
  return {
    q,
    r,
    visibility: 'seen',
    owner: 'neutral',
    difficulty: 'easy',
    rounds: 'BO5',
    objective: false,
    ...extra
  };
}

function chapterView(extra) {
  const neighbors = [
    seenTile(1, -1),
    seenTile(0, -1, { difficulty: 'normal' }),
    seenTile(-1, 0),
    seenTile(-1, 1),
    seenTile(0, 1),
    seenTile(1, 0)
  ];
  return {
    id: 'run-1',
    status: 'started',
    turns: 1,
    actionPoints: 1,
    activeBattle: null,
    blockedReasons: [],
    inventory: {
      items: { stones: 14, scissors: 10, papers: 14, NA_effect_stone: 2, NA_effect_scissors: 2, NA_effect_papers: 2, NT_effect: 2 },
      currencies: { gold: 0, silver: 0, copper: 16 }
    },
    rules: {
      digCost: { copper: 4 },
      searchCost: { copper: 6 },
      increaseMinesCost: { copper: 6 },
      battleKit: {
        stones: 8,
        scissors: 5,
        papers: 8,
        NA_effect_stone: 1,
        NA_effect_scissors: 1,
        NA_effect_papers: 1,
        NT_effect: 1
      },
      marketplace: {
        stones: 3,
        papers: 3,
        scissors: 4,
        NA_effect_stone: 8,
        NA_effect_scissors: 8,
        NA_effect_papers: 8,
        NT_effect: 12
      },
      scoreWeights: { base: 200, perTurn: 50, perVictory: 20, perSilver: 20, perCopper: 1 }
    },
    tiles: [campTile(), ...neighbors, { q: 0, r: -2, visibility: 'hidden' }, seenTile(2, -2)],
    ...extra
  };
}

test('hex placement, neighbors, radius, and cell marks', () => {
  const { CampaignHex } = loadCampaign();
  const size = 10;
  assert.ok(CampaignHex.center(0, -2, size).y < CampaignHex.center(0, 0, size).y);
  same(CampaignHex.NEIGHBORS, [
    { q: 1, r: -1 },
    { q: 0, r: -1 },
    { q: -1, r: 0 },
    { q: -1, r: 1 },
    { q: 0, r: 1 },
    { q: 1, r: 0 }
  ]);
  assert.equal(CampaignHex.onMap(3, 0), false);
  assert.equal(CampaignHex.onMap(0, -2), true);
  assert.equal(CampaignHex.isNeighbor({ q: 0, r: 0 }, { q: 0, r: -1 }), true);
  assert.equal(CampaignHex.isNeighbor({ q: 0, r: 0 }, { q: 0, r: -2 }), false);
  assert.equal(CampaignHex.mark({ visibility: 'seen', difficulty: 'easy' }), 'E');
  assert.equal(CampaignHex.mark({ visibility: 'seen', difficulty: 'normal' }), 'N');
  assert.equal(CampaignHex.mark({ visibility: 'seen', difficulty: 'hard', objective: true }), 'H*');
  assert.equal(CampaignHex.mark({
    visibility: 'owned',
    income: { product: 'copper', perTurn: 2 },
    mines: 1,
    maxMines: 3
  }), 'C 1/3');
  assert.equal(CampaignHex.mark({ visibility: 'hidden' }), '');
});

test('camp on turn 1 offers dig, upgrade, neighbor attacks, and a bare end turn', () => {
  const { CampaignOffers } = loadCampaign();
  const view = chapterView();
  const camp = view.tiles[0];
  const sheet = CampaignOffers.tileSheet(view, camp);
  const dig = sheet.actions.find((action) => action.id === 'dig');
  const upgrade = sheet.actions.find((action) => action.id === 'upgrade');
  assert.equal(dig.label, 'Dig · 4 copper for 4 Copper');
  assert.equal(dig.label.includes('[object Object]'), false);
  assert.equal(dig.send, true);
  same(dig.body, { type: 'dig', q: 0, r: 0 });
  assert.equal(sheet.actions.some((action) => action.id === 'search'), false);
  assert.equal(upgrade.label, 'Upgrade · 6 copper · 1 to 2 of 3');
  assert.equal(upgrade.send, true);

  view.tiles.filter((tile) => tile.visibility === 'seen' && CampaignOffers.attack(view, tile)).forEach((tile) => {
    const attack = CampaignOffers.attack(view, tile);
    assert.equal(attack.send, true);
    same(Object.keys(attack.body).sort(), ['q', 'r', 'type']);
    assert.equal(attack.body.type, 'attack');
    assert.equal(attack.label.includes('Best of 5'), true);
    assert.equal(attack.label.includes('8 Stone'), true);
    assert.equal(attack.label.includes('5 Scissors'), true);
  });
  const quiet = view.tiles.find((tile) => tile.q === 0 && tile.r === -1);
  assert.equal(CampaignOffers.tileSheet(view, quiet).garrison, null);
  const scouted = {
    ...quiet,
    garrison: { npcAlgorithmId: 'npc-v1', inventory: { items: { stones: 2, papers: 1 }, currencies: { copper: 3 } } }
  };
  const scoutedSheet = CampaignOffers.tileSheet(view, scouted);
  assert.equal(scoutedSheet.lines.some((line) => line.startsWith('Defender')), false);
  assert.equal(scoutedSheet.garrison.title, 'Garrison');
  assert.equal(scoutedSheet.garrison.lines[0].includes('Copper 3'), true);
  assert.equal(scoutedSheet.garrison.lines[1].includes('Stone 2'), true);
  assert.equal(scoutedSheet.garrison.lines[1].includes('Paper 1'), true);
  assert.equal(scoutedSheet.garrison.lines[1].includes('Scissors 0'), true);
  assert.equal(scoutedSheet.garrison.lines[2].includes('Stone NA 0'), true);
  assert.equal(scoutedSheet.garrison.lines[3], 'Core 0');
  const emptyGarrison = { ...quiet, garrison: { npcAlgorithmId: 'npc-v1', inventory: { items: {}, currencies: {} } } };
  const emptySheet = CampaignOffers.tileSheet(view, emptyGarrison);
  assert.equal(emptySheet.garrison.lines[1].includes('Stone 0'), true);
  assert.equal(emptySheet.lines.some((line) => line.startsWith('Defender')), false);
  const offered = view.tiles.filter((tile) => CampaignOffers.attack(view, tile));
  assert.equal(offered.length, 6);
  assert.equal(CampaignOffers.attack(view, view.tiles.find((tile) => tile.visibility === 'hidden')), null);
  assert.equal(CampaignOffers.attack(view, view.tiles.find((tile) => tile.q === 2 && tile.r === -2)), null);

  const end = CampaignOffers.endTurn(view);
  assert.equal(end.label, 'End turn');
  assert.equal(/\d/.test(end.label), false);
  same(end.body, { type: 'end_turn' });

  const richer = chapterView();
  richer.tiles.push(campTile({ q: 1, r: -1, visibility: 'owned', income: { product: 'stones', perTurn: 9 } }));
  assert.equal(CampaignOffers.endTurn(richer).label, 'End turn');
  assert.equal(/\d/.test(CampaignOffers.endTurn(richer).label), false);
});

test('spent actions and a short wallet are not sent', () => {
  const { CampaignOffers, CampaignLabels } = loadCampaign();
  assert.equal(CampaignLabels.copper({ copper: 4 }), '4');
  assert.equal(CampaignLabels.copper({ copper: 4 }).includes('[object Object]'), false);

  const spent = chapterView();
  spent.tiles[0] = campTile({ dugThisTurn: true, searchedThisTurn: true, searchAvailable: true, increasedThisTurn: true });
  const actions = CampaignOffers.tileSheet(spent, spent.tiles[0]).actions;
  same(actions.map((action) => action.label), ['Dug', 'Searched', 'Upgraded']);
  actions.forEach((action) => {
    assert.equal(action.send, false);
    assert.equal(action.body, null);
  });

  const poor = chapterView();
  poor.inventory.currencies.copper = 3;
  const dig = CampaignOffers.tileSheet(poor, poor.tiles[0]).actions.find((action) => action.id === 'dig');
  assert.equal(dig.label, 'Dig · 4 copper for 4 Copper');
  assert.equal(dig.enabled, false);
  assert.equal(dig.send, false);
  assert.equal(dig.body, null);
});

test('shop buy uses item keys and the copper line', () => {
  const { CampaignOffers } = loadCampaign();
  const view = chapterView();
  const rows = CampaignOffers.shopRows(view, { stones: 2 });
  same(rows.map((row) => row.item), [
    'stones', 'papers', 'scissors', 'NA_effect_stone', 'NA_effect_scissors', 'NA_effect_papers', 'NT_effect'
  ]);
  const stones = rows[0];
  assert.equal(stones.label, 'Stone');
  assert.equal(stones.line, 6);
  same(stones.body, { type: 'buy', item: 'stones', amount: 2 });

  view.inventory.currencies.copper = 5;
  const blocked = CampaignOffers.shopRows(view, { stones: 2 })[0];
  assert.equal(blocked.enabled, false);
  assert.equal(blocked.body, null);

  view.status = 'finished';
  assert.equal(CampaignOffers.shopRows(view, { stones: 1 })[0].enabled, false);
  assert.equal(CampaignOffers.chrome(view).leave, false);
  assert.equal(CampaignOffers.chrome(view).log, true);
});

test('stall lines stay hidden while a battle is open', () => {
  const { CampaignOffers } = loadCampaign();
  const view = chapterView({
    activeBattle: { gameId: 'game-1', q: 0, r: -1 },
    blockedReasons: ['cannot_afford_battle', 'battle_in_progress']
  });
  same(CampaignOffers.stallLines(view), []);
  assert.equal(CampaignOffers.endTurn(view), null);
  assert.equal(CampaignOffers.chrome(view).endTurn, false);
  assert.equal(CampaignOffers.chrome(view).leave, false);
  same(
    CampaignOffers.stallLines(chapterView({ blockedReasons: ['cannot_afford_battle', 'no_attack_target'] })),
    [
      'You need the battle kit before you can attack.',
      'No neighboring tile to attack.'
    ]
  );
  assert.equal(CampaignOffers.battle(view, false).actions.map((action) => action.id).join(','), 'play,autobattle,cancel');
  assert.equal(CampaignOffers.battle(view, false).actions.find((action) => action.id === 'cancel').body.type, 'cancel_attack');
  same(CampaignOffers.battle(view, true).actions.map((action) => action.id), ['play']);
  assert.equal(CampaignOffers.battle(chapterView({ activeBattle: { gameId: null, q: 0, r: -1 } }), false).mode, 'finishing');
});

test('score lines use the stored total and skip a missing score', () => {
  const { CampaignScoreLines, CampaignLabels } = loadCampaign();
  const weights = { base: 200, perTurn: 50, perVictory: 20, perSilver: 20, perCopper: 1 };
  const lines = CampaignScoreLines.lines(
    { total: 117, turns: 3, victories: 1, silver: 2, copper: 10 },
    weights
  );
  assert.equal(lines.find((line) => line.key === 'turns').op, 'subtract');
  assert.equal(lines.find((line) => line.key === 'base').op, 'add');
  assert.equal(lines.find((line) => line.key === 'victories').op, 'add');
  assert.equal(lines[lines.length - 1].value, 117);
  assert.equal(lines[lines.length - 1].text, 'Total 117');
  same(CampaignScoreLines.lines(null, weights), []);
  same(CampaignScoreLines.lines(undefined, weights), []);
  assert.equal(CampaignLabels.historyLabel({ finishReason: 'victory', score: null }), 'Victory');
  assert.equal(CampaignLabels.historyLabel({ finishReason: 'victory', score: { total: 228 } }), '228');
  same(
    CampaignLabels.visibleHistory([
      { instanceId: 'left-1', finishReason: 'abandoned' },
      { instanceId: 'win', finishReason: 'victory', score: { total: 10 } },
      { instanceId: 'left-2', finishReason: 'abandoned' },
      { instanceId: 'ended', finishReason: 'external' }
    ]).map((row) => row.instanceId),
    ['win', 'ended']
  );
  assert.equal(CampaignLabels.historyLabel({ finishReason: 'abandoned', score: null }), 'Left');
  assert.equal(CampaignLabels.historyLabel({ finishReason: 'external', score: null }), 'Ended');
  same(CampaignLabels.finishLines({ finishReason: 'abandoned' }), ['Left. No score.']);
  same(CampaignLabels.foundLines({ items: { scissors: 4 }, currencies: { silver: 2, copper: 6 } }), [
    'Found',
    '4 Scissors, 2 Silver, 6 Copper'
  ]);
  const outcome = CampaignLabels.outcomeLines({
    result: 'defeat',
    playerRoundWins: 1,
    npcRoundWins: 3,
    captured: false,
    reward: { items: { stones: 3 } },
    spent: { items: { stones: 2 } }
  });
  assert.equal(outcome[0], 'Defeat');
  assert.equal(outcome[1], 'Rounds 1–3');
  assert.equal(outcome[2], 'Held');
  assert.equal(outcome.some((line) => line.startsWith('Gained')), false);
  assert.equal(outcome.some((line) => line === 'Spent 2 Stone'), true);
  assert.equal(outcome.some((line) => line.startsWith('Defender')), false);
  const revealed = CampaignLabels.outcomeLines({
    result: 'defeat',
    playerRoundWins: 1,
    npcRoundWins: 3,
    captured: false,
    garrison: { inventory: { items: { stones: 4 }, currencies: { copper: 1 } } },
    spent: { items: {} }
  });
  assert.equal(revealed.includes('Defender left 4 Stone, 1 Copper'), true);
  const bare = CampaignLabels.outcomeLines({
    result: 'defeat',
    playerRoundWins: 0,
    npcRoundWins: 3,
    captured: false,
    garrison: { inventory: { items: {}, currencies: {} } }
  });
  assert.equal(bare.includes('Defender has nothing left'), true);
});

test('campaign client returns the etag and does not invent one', async () => {
  const context = loadCampaign();
  context.fetchImpl = async () => jsonResponse(200, { definitions: [] }, '"user-etag"');
  const catalog = await context.campaignClient.catalog();
  assert.equal(catalog.etag, '"user-etag"');
  assert.equal(context.fetchCalls[0].url, 'http://127.0.0.1:3000/apiv2/external/campaigns');
  assert.equal(context.fetchCalls[0].options.headers.Authorization, 'Bearer token-1');
  assert.equal(context.fetchCalls[0].options.headers['If-Match'], undefined);

  context.fetchImpl = async () => jsonResponse(200, { campaign: { id: 'run-1' } }, '"next"');
  await context.campaignClient.start('chapter-i', '"user-etag"');
  const start = context.fetchCalls[1];
  assert.equal(start.options.method, 'POST');
  assert.equal(start.options.headers['If-Match'], '"user-etag"');
  assert.deepEqual(JSON.parse(start.options.body), { definitionId: 'chapter-i' });

  await context.campaignClient.act('run 1', { type: 'attack', q: 0, r: -1 }, '"next"');
  const action = context.fetchCalls[2];
  assert.equal(action.url.endsWith('/campaigns/run%201/actions'), true);
  assert.equal(action.options.headers['If-Match'], '"next"');
  assert.deepEqual(JSON.parse(action.options.body), { type: 'attack', q: 0, r: -1 });
  assert.equal(Object.prototype.hasOwnProperty.call(JSON.parse(action.options.body), 'from'), false);

  context.fetchImpl = async () => jsonResponse(200, { campaign: { id: 'run-1' } }, null);
  await assert.rejects(
    () => context.campaignClient.get('run-1'),
    (error) => error.message === 'Could not read the campaign' && error.statusCode === 0
  );

  context.fetchImpl = async () => jsonResponse(409, { detail: 'A battle is already open', gameId: 'game-9' }, null);
  await assert.rejects(
    () => context.campaignClient.act('run-1', { type: 'end_turn' }, '"next"'),
    (error) => error.statusCode === 409 && error.data.detail === 'A battle is already open' && error.data.gameId === 'game-9'
  );
});

test('campaign match-over includes broken and the lobby check does not', () => {
  const utilPath = path.join(__dirname, '../utils/SimpleGameSceneUtil.js');
  const source = readFileSync(utilPath, 'utf8');
  const context = { console };
  runInNewContext(`${source}\nthis.SimpleGameSceneUtil = SimpleGameSceneUtil;\n`, context, { filename: 'SimpleGameSceneUtil.js' });
  const finished = { payload: { gameContext: { status: 'finished' } } };
  const broken = { payload: { gameContext: { status: 'broken' } } };
  const started = { payload: { gameContext: { status: 'started' } } };
  assert.equal(context.SimpleGameSceneUtil.isGameFinished(broken), false);
  assert.equal(context.SimpleGameSceneUtil.isGameFinished(finished), true);
  assert.equal(context.SimpleGameSceneUtil.isCampaignMatchOver(broken), true);
  assert.equal(context.SimpleGameSceneUtil.isCampaignMatchOver(finished), true);
  assert.equal(context.SimpleGameSceneUtil.isCampaignMatchOver(started), false);
  assert.equal(context.SimpleGameSceneUtil.isCampaignMatchOver({ payload: { gameContext: { status: 'created' } } }), false);
});

test('npc stock lines keep zeros and skip coins', () => {
  const { CampaignLabels } = loadCampaign();
  same(CampaignLabels.npcStockLines({
    items: {
      stones: 21,
      scissors: 12,
      papers: 12,
      NA_effect_stone: 3,
      NA_effect_scissors: 2,
      NA_effect_papers: 5,
      NT_effect: 3
    },
    currencies: { gold: 1000, silver: 1000, copper: 1000 }
  }), [
    'Stone 21  Scissors 12  Paper 12',
    'Stone NA 3  Scissors NA 2  Paper NA 5',
    'Core 3'
  ]);
  same(CampaignLabels.npcStockLines({
    items: { stones: 0, scissors: 4, papers: 1 }
  }), [
    'Stone 0  Scissors 4  Paper 1',
    'Stone NA 0  Scissors NA 0  Paper NA 0',
    'Core 0'
  ]);
  same(CampaignLabels.npcStockLines({}), [
    'Stone 0  Scissors 0  Paper 0',
    'Stone NA 0  Scissors NA 0  Paper NA 0',
    'Core 0'
  ]);
});
