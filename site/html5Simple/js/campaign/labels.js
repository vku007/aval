/**
 * Display words for campaign inventory keys. Payload keys stay the keys.
 * Classic global: CampaignLabels.
 */
const CampaignLabels = {
  WORDS: {
    stones: 'Stone',
    scissors: 'Scissors',
    papers: 'Paper',
    NA_effect_stone: 'Stone NA',
    NA_effect_scissors: 'Scissors NA',
    NA_effect_papers: 'Paper NA',
    NT_effect: 'Core',
    gold: 'Gold',
    silver: 'Silver',
    copper: 'Copper'
  },

  ITEM_ORDER: [
    'stones',
    'scissors',
    'papers',
    'NA_effect_stone',
    'NA_effect_scissors',
    'NA_effect_papers',
    'NT_effect'
  ],

  CURRENCY_ORDER: ['gold', 'silver', 'copper'],

  SHOP_ORDER: [
    'stones',
    'papers',
    'scissors',
    'NA_effect_stone',
    'NA_effect_scissors',
    'NA_effect_papers',
    'NT_effect'
  ],

  word(key) {
    return this.WORDS[key] || String(key);
  },

  copper(cost) {
    if (!cost || typeof cost !== 'object' || typeof cost.copper !== 'number') {
      return '';
    }
    return String(cost.copper);
  },

  difficulty(value) {
    if (value === 'easy') return 'Easy';
    if (value === 'normal') return 'Normal';
    if (value === 'hard') return 'Hard';
    return value ? String(value) : '';
  },

  rounds(value) {
    if (value === 'BO5') return 'Best of 5';
    if (value === 'BO7') return 'Best of 7';
    return value ? String(value) : '';
  },

  stackPhrase(bag) {
    if (!bag || typeof bag !== 'object') return '';
    const items = bag.items || bag.currencies ? bag.items : bag;
    const currencies = bag.items || bag.currencies ? bag.currencies : null;
    const parts = [];
    this.ITEM_ORDER.forEach((key) => {
      const count = items && items[key];
      if (typeof count === 'number' && count > 0) {
        parts.push(`${count} ${this.word(key)}`);
      }
    });
    this.CURRENCY_ORDER.forEach((key) => {
      const count = currencies && currencies[key];
      if (typeof count === 'number' && count > 0) {
        parts.push(`${count} ${this.word(key)}`);
      }
    });
    return parts.join(', ');
  },

  inventoryLines(inventory) {
    const currencies = (inventory && inventory.currencies) || {};
    const items = (inventory && inventory.items) || {};
    const line = (keys, source) => keys.map((key) => `${this.word(key)} ${source[key] ?? 0}`).join('  ');
    return [
      line(this.CURRENCY_ORDER, currencies),
      line(['stones', 'scissors', 'papers'], items),
      line(['NA_effect_stone', 'NA_effect_scissors', 'NA_effect_papers', 'NT_effect'], items)
    ];
  },

  /**
   * NPC item stacks for the advanced enemy panel. Zeros stay.
   * Coins are omitted; they do not change a throw.
   */
  npcStockLines(inventory) {
    const items = (inventory && inventory.items) || {};
    const line = (keys) => keys.map((key) => `${this.word(key)} ${items[key] ?? 0}`).join('  ');
    return [
      line(['stones', 'scissors', 'papers']),
      line(['NA_effect_stone', 'NA_effect_scissors', 'NA_effect_papers']),
      `${this.word('NT_effect')} ${items.NT_effect ?? 0}`
    ];
  },

  /** Same counts as the wallet strip, with Core on its own row so the cell panel does not wrap a number away from its name. */
  garrisonLines(inventory) {
    const currencies = (inventory && inventory.currencies) || {};
    const items = (inventory && inventory.items) || {};
    const line = (keys, source) => keys.map((key) => `${this.word(key)} ${source[key] ?? 0}`).join('  ');
    return [
      line(this.CURRENCY_ORDER, currencies),
      line(['stones', 'scissors', 'papers'], items),
      line(['NA_effect_stone', 'NA_effect_scissors', 'NA_effect_papers'], items),
      `Core ${items.NT_effect ?? 0}`
    ];
  },

  visibleHistory(rows) {
    if (!Array.isArray(rows)) return [];
    return rows.filter((row) => row && row.finishReason !== 'abandoned');
  },

  historyLabel(row) {
    if (!row) return '';
    const total = row.score && typeof row.score === 'object' && typeof row.score.total === 'number'
      ? row.score.total
      : null;
    if (row.finishReason === 'victory') {
      return total === null ? 'Victory' : String(total);
    }
    const word = row.finishReason === 'abandoned'
      ? 'Left'
      : row.finishReason === 'external'
        ? 'Ended'
        : (row.finishReason || '');
    return total === null ? word : `${word} ${total}`;
  },

  foundLines(found) {
    const phrase = this.stackPhrase(found);
    return phrase ? ['Found', phrase] : ['Found'];
  },

  outcomeLines(outcome) {
    if (!outcome) return [];
    const lines = [];
    if (outcome.result === 'victory') lines.push('Victory');
    else if (outcome.result === 'defeat') lines.push('Defeat');
    else if (outcome.result) lines.push(String(outcome.result));
    lines.push(`Rounds ${outcome.playerRoundWins}–${outcome.npcRoundWins}`);
    lines.push(outcome.captured ? 'Captured' : 'Held');
    if (outcome.result === 'defeat' && outcome.garrison) {
      const left = this.stackPhrase(outcome.garrison.inventory);
      lines.push(left ? `Defender left ${left}` : 'Defender has nothing left');
    }
    if (outcome.result !== 'defeat') {
      const gained = this.stackPhrase(outcome.reward);
      if (gained) lines.push(`Gained ${gained}`);
    }
    const spent = outcome.spent && outcome.spent.items
      ? this.stackPhrase({ items: outcome.spent.items })
      : '';
    if (spent) lines.push(`Spent ${spent}`);
    return lines;
  },

  finishLines(campaign) {
    if (!campaign || campaign.score) return [];
    if (campaign.finishReason === 'abandoned') return ['Left. No score.'];
    if (campaign.finishReason === 'external') return ['Ended. No score.'];
    if (campaign.finishReason === 'victory') return ['Victory'];
    return [];
  }
};

this.CampaignLabels = CampaignLabels;
