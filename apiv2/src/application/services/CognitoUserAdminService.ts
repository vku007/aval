import type { Logger } from '../../shared/logging/Logger.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../../shared/errors/index.js';
import type { CognitoAdminClient, CognitoGroupName, CognitoListedUser } from '../../infrastructure/cognito/CognitoAdminClient.js';
import { COGNITO_GROUPS } from '../../infrastructure/cognito/CognitoAdminClient.js';
import { UserService } from './UserService.js';
import { GameService } from './GameService.js';
import { AuditLogService } from './AuditLogService.js';
import { CreateUserDto } from '../dto/CreateUserDto.js';
import { UpdateUserDto } from '../dto/UpdateUserDto.js';
import type {
  Actor,
  CognitoUserAdminView,
  CreateCognitoUserInput,
  PatchGameProfileInput,
  UpdateCognitoUserInput,
  UpsertGameProfileInput
} from '../dto/CognitoUserAdminDto.js';
import type { AuditAction } from '../dto/AuditLogDto.js';

const GROUP_RANK: Record<CognitoGroupName, number> = {
  admin: 0,
  user: 1,
  guest: 2
};

export class CognitoUserAdminService {
  constructor(
    private readonly cognito: CognitoAdminClient,
    private readonly userService: UserService,
    private readonly gameService: GameService,
    private readonly auditLogService: AuditLogService,
    private readonly logger: Logger
  ) {}

  async list(opts: {
    emailPrefix?: string;
    group?: CognitoGroupName;
    limit?: number;
    cursor?: string;
  }): Promise<{ users: CognitoUserAdminView[]; nextCursor?: string }> {
    const limit = Math.min(Math.max(opts.limit ?? 20, 1), 60);
    const groupMap = await this.loadGroupMembership();
    const profileIds = await this.listAllProfileIds();

    let pageUsers: CognitoListedUser[];
    let nextCursor: string | undefined;

    if (opts.group) {
      const page = await this.cognito.listUsersInGroup(opts.group, {
        limit,
        paginationToken: opts.cursor
      });
      pageUsers = page.users;
      if (opts.emailPrefix) {
        const prefix = opts.emailPrefix.toLowerCase();
        pageUsers = pageUsers.filter((user) => this.emailOf(user).toLowerCase().startsWith(prefix));
      }
      nextCursor = page.paginationToken;
    } else {
      const filter = opts.emailPrefix
        ? `email ^= "${this.escapeCognitoFilter(opts.emailPrefix)}"`
        : undefined;
      const page = await this.cognito.listUsers({
        filter,
        limit,
        paginationToken: opts.cursor
      });
      pageUsers = page.users;
      nextCursor = page.paginationToken;
    }

    const users = await Promise.all(
      pageUsers.map((user) => this.toView(user, groupMap, profileIds))
    );

    return { users, nextCursor };
  }

  async get(username: string): Promise<CognitoUserAdminView & { recentAudit: unknown[] }> {
    const cognitoUser = await this.cognito.adminGetUser(username);
    const groups = await this.cognito.adminListGroupsForUser(username);
    const group = this.pickGroup(groups);
    const view = await this.toView(cognitoUser, new Map([[cognitoUser.username, group]]));
    const audit = await this.auditLogService.list({ targetSub: view.sub, limit: 20 });
    return { ...view, recentAudit: audit.items };
  }

  async create(input: CreateCognitoUserInput, actor: Actor): Promise<CognitoUserAdminView> {
    const created = await this.cognito.adminCreateUser({
      username: input.email,
      email: input.email,
      displayName: input.displayName,
      temporaryPassword: input.password,
      role: input.group
    });
    await this.cognito.adminSetUserPassword(input.email, input.password);
    await this.setSingleGroup(input.email, input.group);

    const afterCreate = await this.cognito.adminGetUser(input.email);
    const sub = afterCreate.attributes.sub || created.attributes.sub;
    if (!sub) {
      throw new ValidationError('Created Cognito user is missing sub');
    }

    if (input.createGameProfile) {
      const name = input.gameName || input.displayName;
      const externalId = input.externalId ?? this.hashExternalId(sub);
      await this.userService.createUser(new CreateUserDto(sub, name, externalId));
    }

    await this.audit(actor, 'create', input.email, sub, {
      group: input.group,
      createGameProfile: input.createGameProfile
    });

    return this.get(input.email);
  }

  async update(username: string, input: UpdateCognitoUserInput, actor: Actor): Promise<CognitoUserAdminView> {
    const existing = await this.cognito.adminGetUser(username);
    const sub = existing.attributes.sub || '';
    this.assertNotSelfDestructive(actor, sub, {
      disable: input.enabled === false,
      demote: input.group !== undefined && input.group !== 'admin'
    });

    const details: Record<string, unknown> = {};
    const actions: AuditAction[] = [];

    if (input.displayName !== undefined) {
      await this.cognito.adminUpdateUserAttributes(username, {
        'custom:display_name': input.displayName
      });
      details.displayName = input.displayName;
      actions.push('update');
    }

    if (input.group !== undefined) {
      const previousGroups = await this.cognito.adminListGroupsForUser(username);
      await this.setSingleGroup(username, input.group);
      await this.cognito.adminUpdateUserAttributes(username, { 'custom:role': input.group });
      details.group = input.group;
      details.previousGroups = previousGroups;
      actions.push('set-group');
    }

    if (input.password !== undefined) {
      await this.cognito.adminSetUserPassword(username, input.password);
      actions.push('set-password');
    }

    if (input.enabled === true) {
      await this.cognito.adminEnableUser(username);
      actions.push('enable');
    } else if (input.enabled === false) {
      await this.cognito.adminDisableUser(username);
      actions.push('disable');
    }

    for (const action of actions.length ? actions : ['update' as AuditAction]) {
      await this.audit(actor, action, username, sub, details);
    }

    return this.get(username);
  }

  async delete(username: string, actor: Actor): Promise<void> {
    const existing = await this.cognito.adminGetUser(username);
    const sub = existing.attributes.sub || '';
    this.assertNotSelfDestructive(actor, sub, { delete: true });
    await this.cognito.adminDeleteUser(username);
    await this.audit(actor, 'delete', username, sub, {
      note: 'Cognito user deleted; game profile and games were not removed'
    });
  }

  async upsertGameProfile(username: string, input: UpsertGameProfileInput, actor: Actor) {
    const cognitoUser = await this.cognito.adminGetUser(username);
    const sub = cognitoUser.attributes.sub;
    if (!sub) {
      throw new ValidationError('Cognito user is missing sub');
    }
    const externalId = input.externalId ?? this.hashExternalId(sub);
    const existing = await this.userService.findUserOrNull(sub);
    if (existing) {
      await this.userService.updateUser(sub, new UpdateUserDto({ name: input.name, externalId }, false));
    } else {
      await this.userService.createUser(new CreateUserDto(sub, input.name, externalId));
    }
    await this.audit(actor, 'upsert-game-profile', username, sub, { name: input.name, externalId });
    return this.get(username);
  }

  async patchGameProfile(username: string, input: PatchGameProfileInput, actor: Actor) {
    const cognitoUser = await this.cognito.adminGetUser(username);
    const sub = cognitoUser.attributes.sub;
    if (!sub) {
      throw new ValidationError('Cognito user is missing sub');
    }
    const existing = await this.userService.findUserOrNull(sub);
    if (!existing) {
      throw new NotFoundError(`Game profile for '${username}' not found`);
    }
    await this.userService.updateUser(sub, new UpdateUserDto({
      name: input.name,
      externalId: input.externalId
    }, true));
    await this.audit(actor, 'upsert-game-profile', username, sub, { patch: true, ...input });
    return this.get(username);
  }

  async listGames(username: string) {
    const cognitoUser = await this.cognito.adminGetUser(username);
    const sub = cognitoUser.attributes.sub;
    if (!sub) {
      throw new ValidationError('Cognito user is missing sub');
    }
    return this.gameService.findGamesByUserId(sub, 100);
  }

  private async toView(
    user: CognitoListedUser,
    groupMap: Map<string, CognitoGroupName | null>,
    profileIds?: Set<string>
  ): Promise<CognitoUserAdminView> {
    const sub = user.attributes.sub || '';
    const email = this.emailOf(user);
    const displayName = user.attributes['custom:display_name'] || email || user.username;
    const group = groupMap.get(user.username) ?? groupMap.get(email) ?? null;
    let gameProfile = null;
    if (sub && (!profileIds || profileIds.has(sub))) {
      const profile = await this.userService.findUserOrNull(sub);
      if (profile) {
        gameProfile = { id: profile.id, name: profile.name, externalId: profile.externalId };
      }
    }
    return {
      username: user.username,
      sub,
      email,
      displayName,
      group,
      enabled: user.enabled,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      gameProfile
    };
  }

  private async loadGroupMembership(): Promise<Map<string, CognitoGroupName | null>> {
    const map = new Map<string, CognitoGroupName | null>();
    for (const group of COGNITO_GROUPS) {
      let cursor: string | undefined;
      let pages = 0;
      do {
        const page = await this.cognito.listUsersInGroup(group, { limit: 60, paginationToken: cursor });
        for (const username of page.usernames) {
          const current = map.get(username);
          if (!current || GROUP_RANK[group] < GROUP_RANK[current]) {
            map.set(username, group);
          }
        }
        cursor = page.paginationToken;
        pages += 1;
      } while (cursor && pages < 5);
    }
    return map;
  }

  private async listAllProfileIds(): Promise<Set<string>> {
    const ids = new Set<string>();
    let cursor: string | undefined;
    let pages = 0;
    do {
      const page = await this.userService.listUsers('', 1000, cursor);
      for (const id of page.names) {
        ids.add(id);
      }
      cursor = page.nextCursor;
      pages += 1;
    } while (cursor && pages < 10);
    return ids;
  }

  private async setSingleGroup(username: string, group: CognitoGroupName): Promise<void> {
    const existing = await this.cognito.adminListGroupsForUser(username);
    for (const current of COGNITO_GROUPS) {
      if (existing.includes(current) && current !== group) {
        try {
          await this.cognito.adminRemoveUserFromGroup(username, current);
        } catch (error: any) {
          this.logger.warn('Could not remove user from group', {
            username,
            group: current,
            error: error?.message
          });
        }
      }
    }
    if (!existing.includes(group)) {
      await this.cognito.adminAddUserToGroup(username, group);
    }
  }

  private pickGroup(groups: CognitoGroupName[]): CognitoGroupName | null {
    if (groups.length === 0) {
      return null;
    }
    return [...groups].sort((a, b) => GROUP_RANK[a] - GROUP_RANK[b])[0];
  }

  private emailOf(user: CognitoListedUser): string {
    return user.attributes.email || user.username;
  }

  private escapeCognitoFilter(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  private hashExternalId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = ((hash << 5) - hash) + userId.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash) % 2147483647 + 1;
  }

  private assertNotSelfDestructive(
    actor: Actor,
    targetSub: string,
    flags: { delete?: boolean; disable?: boolean; demote?: boolean }
  ): void {
    if (actor.sub !== targetSub) {
      return;
    }
    if (flags.delete) {
      throw new ForbiddenError('You cannot delete your own Cognito account');
    }
    if (flags.disable) {
      throw new ForbiddenError('You cannot disable your own Cognito account');
    }
    if (flags.demote) {
      throw new ForbiddenError('You cannot demote your own admin role');
    }
  }

  private async audit(
    actor: Actor,
    action: AuditAction,
    targetUsername: string,
    targetSub: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    try {
      await this.auditLogService.append({
        actorSub: actor.sub,
        actorEmail: actor.email,
        action,
        targetUsername,
        targetSub,
        details
      });
    } catch (error: any) {
      this.logger.warn('Failed to append audit log', { action, targetUsername, error: error?.message });
    }
  }
}
