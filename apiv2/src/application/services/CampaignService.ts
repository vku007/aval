import { Campaign, type BattleOutcome } from '../../domain/campaign/Campaign.js';
import { assertSupportedNpcAlgorithm } from '../../domain/campaign/Garrison.js';
import { findDefinition, listDefinitions } from '../../domain/campaign/CampaignRegistry.js';
import { toCampaignView } from '../../domain/campaign/CampaignView.js';
import { User } from '../../domain/entity/User.js';
import { etagsEqual } from '../../shared/etag.js';
import { ConflictError, NotFoundError, PreconditionFailedError, ValidationError } from '../../shared/errors/index.js';
import { Logger } from '../../shared/logging/Logger.js';
import { RoundsLength } from '../../domain/value-object/RoundsLength.js';
import type { CampaignAction } from '../dto/campaign/campaignSchemas.js';
import { battleHasStarted, playAutobattle } from '../campaign/Autobattle.js';
import { applyLoadedGame, repairCampaign } from '../campaign/Repair.js';
import type { IUserRepository } from './UserService.js';
import type { CampaignBattleSink, CampaignGamePort } from './CampaignGamePort.js';
import { GameStatus } from '../../domain/value-object/GameStatus.js';
import type { Game } from '../../domain/entity/Game.js';

export interface CampaignHttpResult {
  body: Record<string, unknown>;
  etag?: string;
}

interface ProfileSeed {
  name: string;
  externalId: number;
}

/**
 * Loads and saves campaigns through the user repository.
 * The game document is touched only for Attack, Autobattle, and resolution.
 */
export class CampaignService implements CampaignBattleSink {
  constructor(
    private readonly users: IUserRepository,
    private readonly games: CampaignGamePort,
    private readonly logger: Logger
  ) {}

  async catalog(userId: string, profile: ProfileSeed): Promise<CampaignHttpResult> {
    let user = await this.ensureUser(userId, profile);
    const repaired = await this.repairAll(user);
    if (repaired.changed) {
      user = await this.users.save(repaired.user, { ifMatch: user.metadata?.etag });
    } else {
      user = repaired.user;
    }
    return { body: this.catalogBody(user), etag: user.metadata?.etag };
  }

  async start(userId: string, definitionId: string, ifMatch: string): Promise<CampaignHttpResult> {
    const loaded = await this.requireUser(userId);
    const repaired = await this.repairAll(loaded);
    const user = repaired.user;
    const definition = findDefinition(definitionId);
    if (!definition) {
      throw new NotFoundError(`Campaign definition '${definitionId}' not found`);
    }
    if (user.campaigns.some(campaign => campaign.definitionId === definitionId && campaign.status === 'started')) {
      throw new ConflictError('This campaign is already started');
    }
    const created = Campaign.start(definition, Date.now(), newId('campaign'));
    const saved = await this.users.save(
      user.withCampaigns([...user.campaigns, created]),
      { ifMatch }
    );
    return { body: { campaign: toCampaignView(created) }, etag: saved.metadata?.etag };
  }

  async get(userId: string, campaignId: string): Promise<CampaignHttpResult> {
    const user = await this.requireUser(userId);
    const campaign = this.requireCampaign(user, campaignId);
    const repaired = await repairCampaign(campaign, this.games, this.logger, Date.now());
    if (repaired === campaign) {
      return { body: campaignBody(campaign), etag: user.metadata?.etag };
    }
    const saved = await this.users.save(this.replace(user, repaired), { ifMatch: user.metadata?.etag });
    return { body: campaignBody(repaired), etag: saved.metadata?.etag };
  }

  async act(userId: string, campaignId: string, action: CampaignAction, ifMatch: string): Promise<CampaignHttpResult> {
    if (action.type === 'attack') {
      return this.attack(userId, campaignId, action.q, action.r, action.from, ifMatch);
    }
    if (action.type === 'autobattle') {
      return this.autobattle(userId, campaignId, ifMatch);
    }
    if (action.type === 'cancel_attack') {
      return this.cancelAttack(userId, campaignId, ifMatch);
    }
    const user = await this.requireUser(userId);
    const campaign = this.requireCampaign(user, campaignId);
    const repaired = await repairCampaign(campaign, this.games, this.logger, Date.now());
    const now = Date.now();
    let next = repaired;
    let extra: Record<string, unknown> = {};
    if (action.type === 'end_turn') {
      next = repaired.endTurn(now);
    } else if (action.type === 'dig') {
      next = repaired.dig(action.q, action.r, now);
    } else if (action.type === 'search') {
      const searched = repaired.search(action.q, action.r, now);
      next = searched.campaign;
      extra = { found: searched.found };
    } else if (action.type === 'increase_mines') {
      next = repaired.increaseMines(action.q, action.r, now);
    } else if (action.type === 'buy') {
      next = repaired.buy(action.item, action.amount, now);
    } else if (action.type === 'leave') {
      next = repaired.leave(now);
    } else {
      throw new ValidationError('Invalid action');
    }
    const saved = await this.users.save(this.replace(user, next), { ifMatch });
    return { body: { campaign: toCampaignView(next), ...extra }, etag: saved.metadata?.etag };
  }

  async finishExternal(userId: string, campaignId: string, ifMatch: string): Promise<CampaignHttpResult> {
    const user = await this.requireUser(userId);
    const campaign = this.requireCampaign(user, campaignId);
    const repaired = await repairCampaign(campaign, this.games, this.logger, Date.now());
    const next = repaired.finishExternal(Date.now());
    const saved = await this.users.save(this.replace(user, next), { ifMatch });
    return { body: { campaign: toCampaignView(next) }, etag: saved.metadata?.etag };
  }

  async resolveFromGame(game: Game): Promise<void> {
    if (!game.campaignId) {
      return;
    }
    const userId = game.usersIds[0];
    const user = await this.users.findById(userId);
    if (!user) {
      this.logger.warn('Campaign user missing for battle resolution', { userId, campaignId: game.campaignId });
      return;
    }
    const campaign = user.campaigns.find(item => item.id === game.campaignId);
    if (!campaign) {
      this.logger.warn('Campaign instance missing for battle resolution', { userId, campaignId: game.campaignId });
      return;
    }
    const applied = applyLoadedGame(campaign, game, Date.now());
    if (applied.campaign === campaign) {
      return;
    }
    await this.users.save(this.replace(user, applied.campaign), { ifMatch: user.metadata?.etag });
  }

  private async attack(
    userId: string,
    campaignId: string,
    q: number,
    r: number,
    from: { q: number; r: number } | undefined,
    ifMatch: string
  ): Promise<CampaignHttpResult> {
    const user = await this.requireUser(userId);
    const campaign = this.requireCampaign(user, campaignId);
    const repaired = await repairCampaign(campaign, this.games, this.logger, Date.now());
    const now = Date.now();
    const begun = repaired.beginAttack(q, r, from, newId('attack'), newSeed(), now);
    const battle = begun.activeBattle;
    const tile = begun.tiles.find(item => item.q === q && item.r === r);
    if (!battle || !tile?.rounds || !tile.difficulty || !tile.garrison) {
      throw new ValidationError('That tile cannot be attacked');
    }
    assertSupportedNpcAlgorithm(tile.garrison.npcAlgorithmId);
    const saved = await this.users.save(this.replace(user, begun), { ifMatch });
    let gameId: string;
    try {
      const created = await this.games.createBattle({
        userId,
        campaignId: begun.id,
        attackId: battle.attackId,
        seed: battle.battleSeed,
        tile: { q, r },
        rounds: tile.rounds === 'BO7' ? RoundsLength.BO7 : RoundsLength.BO5,
        levelName: tile.difficulty,
        title: begun.title,
        humanItems: battle.committedItems ?? battle.wager ?? {},
        npcItems: tile.garrison.inventory.items,
        npcCurrencies: tile.garrison.inventory.currencies,
        npcAlgorithmId: tile.garrison.npcAlgorithmId
      });
      gameId = created.gameId;
    } catch (error) {
      try {
        const refunded = begun.refundOpenAttack(Date.now());
        await this.users.save(this.replace(saved, refunded), { ifMatch: saved.metadata?.etag });
      } catch (refundError: any) {
        this.logger.error('Failed to refund an attack whose game was not stored', {
          campaignId: begun.id,
          error: refundError?.message
        });
      }
      throw error;
    }
    const attached = begun.attachGame(gameId, Date.now());
    const savedGame = await this.users.save(this.replace(saved, attached), { ifMatch: saved.metadata?.etag });
    return {
      body: { campaign: toCampaignView(attached), gameId },
      etag: savedGame.metadata?.etag
    };
  }

  private async autobattle(userId: string, campaignId: string, ifMatch: string): Promise<CampaignHttpResult> {
    const user = await this.requireUser(userId);
    if (!etagMatches(ifMatch, user.metadata?.etag)) {
      throw new PreconditionFailedError('Campaign ETag mismatch');
    }
    const campaign = this.requireCampaign(user, campaignId);
    const repaired = await repairCampaign(campaign, this.games, this.logger, Date.now());
    const battle = repaired.activeBattle;
    if (!battle?.gameId) {
      throw new ConflictError('No open battle');
    }
    const loaded = await this.games.load(battle.gameId);
    if (!loaded || (loaded.game.status !== GameStatus.Created && loaded.game.status !== GameStatus.Started)) {
      throw new ConflictError('No open battle');
    }
    if (battleHasStarted(loaded.game)) {
      throw new ConflictError('The battle already has a move');
    }
    const played = playAutobattle(loaded.game);
    await this.games.save(played, loaded.etag);
    const applied = applyLoadedGame(repaired, played, Date.now());
    const saved = await this.users.save(this.replace(user, applied.campaign), { ifMatch });
    const body: Record<string, unknown> = { campaign: toCampaignView(applied.campaign) };
    if (applied.outcome) {
      body.battleOutcome = toBattleOutcome(applied.outcome);
    }
    return { body, etag: saved.metadata?.etag };
  }

  private async cancelAttack(userId: string, campaignId: string, ifMatch: string): Promise<CampaignHttpResult> {
    const user = await this.requireUser(userId);
    if (!etagMatches(ifMatch, user.metadata?.etag)) {
      throw new PreconditionFailedError('Campaign ETag mismatch');
    }
    const campaign = this.requireCampaign(user, campaignId);
    const repaired = await repairCampaign(campaign, this.games, this.logger, Date.now());
    const battle = repaired.activeBattle;
    if (!battle?.gameId) {
      throw new ConflictError('No open battle');
    }
    const loaded = await this.games.load(battle.gameId);
    if (!loaded || (loaded.game.status !== GameStatus.Created && loaded.game.status !== GameStatus.Started)) {
      throw new ConflictError('No open battle');
    }
    if (battleHasStarted(loaded.game)) {
      throw new ConflictError('The battle already has a move');
    }
    loaded.game.setStatus(GameStatus.Broken);
    await this.games.save(loaded.game, loaded.etag);
    const applied = applyLoadedGame(repaired, loaded.game, Date.now());
    const saved = await this.users.save(this.replace(user, applied.campaign), { ifMatch });
    return { body: { campaign: toCampaignView(applied.campaign) }, etag: saved.metadata?.etag };
  }

  private async repairAll(user: User): Promise<{ user: User; changed: boolean }> {
    const now = Date.now();
    const next = [];
    let changed = false;
    for (const campaign of user.campaigns) {
      const repaired = await repairCampaign(campaign, this.games, this.logger, now);
      if (repaired !== campaign) {
        changed = true;
      }
      next.push(repaired);
    }
    return { user: changed ? user.withCampaigns(next) : user, changed };
  }

  private catalogBody(user: User): Record<string, unknown> {
    return {
      definitions: listDefinitions().map(definition => {
        const runs = user.campaigns.filter(campaign => campaign.definitionId === definition.id);
        const active = runs.find(campaign => campaign.status === 'started');
        const history = runs
          .filter(campaign => campaign.status === 'finished')
          .sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0))
          .map(campaign => ({
            instanceId: campaign.id,
            finishedAt: campaign.finishedAt,
            finishReason: campaign.finishReason,
            score: campaign.score ?? null
          }));
        const totals = history
          .map(row => row.score?.total)
          .filter((total): total is number => typeof total === 'number');
        const row: Record<string, unknown> = {
          id: definition.id,
          title: definition.title,
          goal: definition.goal,
          currentStatus: active ? 'started' : 'not_started',
          bestScore: totals.length > 0 ? Math.max(...totals) : null,
          history
        };
        if (active) {
          row.instanceId = active.id;
        }
        return row;
      })
    };
  }

  private async ensureUser(userId: string, profile: ProfileSeed): Promise<User> {
    const existing = await this.users.findById(userId);
    if (existing) {
      return existing;
    }
    try {
      return await this.users.save(User.create(userId, profile.name, profile.externalId), { ifNoneMatch: '*' });
    } catch (error) {
      if (error instanceof ConflictError) {
        const again = await this.users.findById(userId);
        if (again) {
          return again;
        }
      }
      throw error;
    }
  }

  private async requireUser(userId: string): Promise<User> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new NotFoundError(`User '${userId}' not found`);
    }
    return user;
  }

  private requireCampaign(user: User, campaignId: string): Campaign {
    const campaign = user.campaigns.find(item => item.id === campaignId);
    if (!campaign) {
      throw new NotFoundError(`Campaign '${campaignId}' not found`);
    }
    return campaign;
  }

  private replace(user: User, campaign: Campaign): User {
    const campaigns = user.campaigns.some(item => item.id === campaign.id)
      ? user.campaigns.map(item => item.id === campaign.id ? campaign : item)
      : [...user.campaigns, campaign];
    return user.withCampaigns(campaigns);
  }
}

function toBattleOutcome(outcome: BattleOutcome): BattleOutcome {
  return outcome;
}

function campaignBody(campaign: Campaign): Record<string, unknown> {
  const body: Record<string, unknown> = { campaign: toCampaignView(campaign) };
  if (campaign.lastBattleOutcome) {
    body.battleOutcome = campaign.lastBattleOutcome;
  }
  return body;
}

function etagMatches(header: string, stored: string | undefined): boolean {
  if (!stored) {
    return false;
  }
  return etagsEqual(header, stored);
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function newSeed(): number {
  return Math.floor(Math.random() * 0x100000000);
}
