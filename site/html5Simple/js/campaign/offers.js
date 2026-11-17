/**
 * Which commands the current campaign view may send. Classic global: CampaignOffers.
 * Display only. The server checks again.
 */
const CampaignOffers = {
  stallLines(campaign) {
    const reasons = (campaign && campaign.blockedReasons) || [];
    if (reasons.indexOf('battle_in_progress') !== -1) return [];
    const lines = [];
    if (reasons.indexOf('cannot_afford_battle') !== -1) {
      const rules = campaign.rules || {};
      if (rules.battleEntry === 'fee') {
        const copper = rules.attackFee && rules.attackFee.copper;
        lines.push(`You need ${copper} copper to attack.`);
      } else {
        lines.push('You need the battle kit before you can attack.');
      }
    }
    if (reasons.indexOf('no_attack_target') !== -1) {
      lines.push('No neighboring tile to attack.');
    }
    return lines;
  },

  playable(campaign) {
    return !!campaign && campaign.status === 'started' && !campaign.activeBattle;
  },

  chrome(campaign) {
    const playable = this.playable(campaign);
    const finished = !!campaign && campaign.status === 'finished';
    return {
      endTurn: playable,
      shop: playable || finished,
      log: true,
      leave: playable,
      back: true
    };
  },

  endTurn(campaign) {
    if (!this.playable(campaign)) return null;
    return {
      id: 'end_turn',
      label: 'End turn',
      enabled: true,
      send: true,
      body: { type: 'end_turn' }
    };
  },

  garrisonPanel(tile) {
    if (!tile || !tile.garrison || !tile.garrison.inventory) return null;
    return {
      title: 'Garrison',
      lines: CampaignLabels.garrisonLines(tile.garrison.inventory)
    };
  },

  tileSheet(campaign, tile) {
    if (!tile) return { lines: [], actions: [], garrison: null };
    if (tile.visibility === 'hidden') return { lines: ['Hidden'], actions: [], garrison: null };
    if (tile.visibility === 'blocked') return { lines: ['Blocked'], actions: [], garrison: null };
    if (tile.visibility === 'seen') {
      const lines = [];
      const difficulty = CampaignLabels.difficulty(tile.difficulty);
      const rounds = CampaignLabels.rounds(tile.rounds);
      if (difficulty) lines.push(difficulty);
      if (rounds) lines.push(rounds);
      if (tile.objective) lines.push('Objective');
      const attack = this.attack(campaign, tile);
      return { lines, actions: attack ? [attack] : [], garrison: this.garrisonPanel(tile) };
    }
    if (tile.visibility === 'owned') {
      const product = tile.income && tile.income.product;
      const lines = [];
      if (product) lines.push(CampaignLabels.word(product));
      if (typeof tile.mines === 'number') lines.push(`${tile.mines}/${tile.maxMines}`);
      if (tile.income && typeof tile.income.perTurn === 'number') {
        lines.push(`${tile.income.perTurn} ${CampaignLabels.word(product)} per turn`);
      }
      return { lines, actions: this.ownedActions(campaign, tile), garrison: null };
    }
    return { lines: [], actions: [], garrison: null };
  },

  attack(campaign, tile) {
    if (!this.playable(campaign) || !tile || tile.visibility !== 'seen') return null;
    if (!CampaignHex.adjacentToOwned(tile, campaign.tiles)) return null;
    if (!(campaign.actionPoints >= 1)) return null;
    const reasons = campaign.blockedReasons || [];
    if (reasons.indexOf('cannot_afford_battle') !== -1) return null;
    const rules = campaign.rules || {};
    const price = rules.battleEntry === 'fee'
      ? `${rules.attackFee && rules.attackFee.copper} copper`
      : CampaignLabels.stackPhrase(rules.battleKit);
    const length = CampaignLabels.rounds(tile.rounds);
    const action = {
      id: 'attack',
      label: ['Attack', length, price].filter(Boolean).join(' · '),
      enabled: true,
      send: true,
      body: { type: 'attack', q: tile.q, r: tile.r }
    };
    if (rules.battleEntry === 'fee') action.confirm = 'fee';
    return action;
  },

  hidesAttackFeeNotice(user) {
    return !!(user && user.settings && user.settings.hideAttackFeeNotice === true);
  },

  attackFeeLine(campaign) {
    const rules = (campaign && campaign.rules) || {};
    const copper = rules.attackFee && rules.attackFee.copper;
    if (typeof copper !== 'number') return 'This attack costs copper.';
    return `This attack costs ${copper} copper.`;
  },

  ownedActions(campaign, tile) {
    if (!this.playable(campaign) || !tile || tile.visibility !== 'owned') return [];
    const actions = [];
    const rules = campaign.rules || {};
    const wallet = campaign.inventory && campaign.inventory.currencies
      ? campaign.inventory.currencies.copper || 0
      : 0;

    const digCopper = rules.digCost && rules.digCost.copper;
    const searchCopper = rules.searchCost && rules.searchCost.copper;
    const upgradeCopper = rules.increaseMinesCost && rules.increaseMinesCost.copper;

    if (tile.dugThisTurn) {
      actions.push(this.spent('dig', 'Dug'));
    } else if (tile.mines >= 1 && tile.income && typeof digCopper === 'number') {
      const cost = CampaignLabels.copper(rules.digCost);
      const yieldAmount = 2 * tile.income.perTurn;
      const product = CampaignLabels.word(tile.income.product);
      const affordable = wallet >= digCopper;
      actions.push({
        id: 'dig',
        label: `Dig · ${cost} copper for ${yieldAmount} ${product}`,
        enabled: affordable,
        send: affordable,
        body: affordable ? { type: 'dig', q: tile.q, r: tile.r } : null
      });
    }

    if (tile.searchedThisTurn) {
      actions.push(this.spent('search', 'Searched'));
    } else if (tile.searchAvailable && typeof searchCopper === 'number') {
      const cost = CampaignLabels.copper(rules.searchCost);
      const affordable = wallet >= searchCopper;
      actions.push({
        id: 'search',
        label: `Search · ${cost} copper`,
        enabled: affordable,
        send: affordable,
        body: affordable ? { type: 'search', q: tile.q, r: tile.r } : null
      });
    }

    if (tile.increasedThisTurn) {
      actions.push(this.spent('upgrade', 'Upgraded'));
    } else if (tile.mines < tile.maxMines && typeof upgradeCopper === 'number') {
      const cost = CampaignLabels.copper(rules.increaseMinesCost);
      const affordable = wallet >= upgradeCopper;
      actions.push({
        id: 'upgrade',
        label: `Upgrade · ${cost} copper · ${tile.mines} to ${tile.mines + 1} of ${tile.maxMines}`,
        enabled: affordable,
        send: affordable,
        body: affordable ? { type: 'increase_mines', q: tile.q, r: tile.r } : null
      });
    }

    return actions;
  },

  spent(id, label) {
    return { id, label, enabled: false, send: false, body: null };
  },

  shopRows(campaign, amounts) {
    const market = (campaign && campaign.rules && campaign.rules.marketplace) || {};
    const wallet = campaign && campaign.inventory && campaign.inventory.currencies
      ? campaign.inventory.currencies.copper || 0
      : 0;
    const open = this.playable(campaign);
    return CampaignLabels.SHOP_ORDER.filter((key) => Object.prototype.hasOwnProperty.call(market, key)).map((key) => {
      const price = market[key];
      const amount = Math.max(1, (amounts && amounts[key]) || 1);
      const line = price * amount;
      const enabled = open && wallet >= line;
      return {
        item: key,
        label: CampaignLabels.word(key),
        price,
        amount,
        line,
        enabled,
        body: enabled ? { type: 'buy', item: key, amount } : null
      };
    });
  },

  battle(campaign, moveAlreadyPlayed) {
    const active = campaign && campaign.activeBattle;
    if (!active) return { mode: 'none', actions: [] };
    if (!active.gameId) return { mode: 'finishing', actions: [] };
    const actions = [{ id: 'play', label: 'PLAY', enabled: true, send: false, body: null }];
    if (!moveAlreadyPlayed) {
      actions.push({
        id: 'autobattle',
        label: 'AUTOBATTLE',
        enabled: true,
        send: true,
        body: { type: 'autobattle' }
      });
      actions.push({
        id: 'cancel',
        label: 'BACK',
        enabled: true,
        send: true,
        body: { type: 'cancel_attack' }
      });
    }
    return { mode: 'open', actions };
  }
};

this.CampaignOffers = CampaignOffers;
