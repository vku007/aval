/**
 * Score sheet lines. The total is the stored total. Classic global: CampaignScoreLines.
 */
const CampaignScoreLines = {
  lines(score, weights) {
    if (!score || typeof score !== 'object') return [];
    const rules = weights || {};
    return [
      { key: 'base', label: 'Base', op: 'add', text: `Base ${rules.base}`, value: rules.base },
      {
        key: 'turns',
        label: 'Turns',
        op: 'subtract',
        text: `Turns ${score.turns} × ${rules.perTurn}`,
        count: score.turns,
        weight: rules.perTurn
      },
      {
        key: 'victories',
        label: 'Victories',
        op: 'add',
        text: `Victories ${score.victories} × ${rules.perVictory}`,
        count: score.victories,
        weight: rules.perVictory
      },
      {
        key: 'silver',
        label: 'Silver gained',
        op: 'add',
        text: `Silver gained ${score.silver} × ${rules.perSilver}`,
        count: score.silver,
        weight: rules.perSilver
      },
      {
        key: 'copper',
        label: 'Copper gained',
        op: 'add',
        text: `Copper gained ${score.copper} × ${rules.perCopper}`,
        count: score.copper,
        weight: rules.perCopper
      },
      { key: 'total', label: 'Total', text: `Total ${score.total}`, value: score.total }
    ];
  }
};

this.CampaignScoreLines = CampaignScoreLines;
