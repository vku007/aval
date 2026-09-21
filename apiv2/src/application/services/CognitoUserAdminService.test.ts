import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CognitoUserAdminService } from './CognitoUserAdminService.js';
import { Logger } from '../../shared/logging/Logger.js';
import { ForbiddenError, NotFoundError } from '../../shared/errors/index.js';
import type { CognitoAdminClient, CognitoListedUser } from '../../infrastructure/cognito/CognitoAdminClient.js';
import type { UserService } from './UserService.js';
import type { GameService } from './GameService.js';
import type { AuditLogService } from './AuditLogService.js';
import { UserResponseDto } from '../dto/UserResponseDto.js';

function cognitoUser(overrides: Partial<CognitoListedUser> & { sub?: string } = {}): CognitoListedUser {
  const sub = overrides.sub ?? 'sub-ada';
  const { sub: _ignored, ...rest } = overrides;
  return {
    username: 'ada@vkp-test.local',
    attributes: { sub, email: 'ada@vkp-test.local', 'custom:display_name': 'Ada' },
    enabled: true,
    status: 'CONFIRMED',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...rest,
    attributes: {
      sub,
      email: 'ada@vkp-test.local',
      'custom:display_name': 'Ada',
      ...(overrides.attributes ?? {})
    }
  };
}

describe('CognitoUserAdminService', () => {
  let cognito: CognitoAdminClient;
  let userService: UserService;
  let gameService: GameService;
  let auditLogService: AuditLogService;
  let service: CognitoUserAdminService;
  const actor = { sub: 'admin-sub', email: 'admin@vkp-test.local' };

  beforeEach(() => {
    cognito = {
      listUsers: vi.fn(),
      listUsersInGroup: vi.fn().mockResolvedValue({ users: [], usernames: [], paginationToken: undefined }),
      adminListGroupsForUser: vi.fn().mockResolvedValue(['user']),
      adminGetUser: vi.fn(),
      adminCreateUser: vi.fn(),
      adminSetUserPassword: vi.fn(),
      adminAddUserToGroup: vi.fn(),
      adminRemoveUserFromGroup: vi.fn(),
      adminUpdateUserAttributes: vi.fn(),
      adminEnableUser: vi.fn(),
      adminDisableUser: vi.fn(),
      adminDeleteUser: vi.fn()
    };
    userService = {
      createUser: vi.fn(),
      updateUser: vi.fn(),
      deleteUser: vi.fn(),
      getUser: vi.fn(),
      listUsers: vi.fn().mockResolvedValue({ names: [], nextCursor: undefined }),
      findUserOrNull: vi.fn().mockResolvedValue(null),
      getUserMetadata: vi.fn()
    } as any;
    gameService = {
      findGamesByUserId: vi.fn()
    } as any;
    auditLogService = {
      append: vi.fn().mockResolvedValue({}),
      list: vi.fn().mockResolvedValue({ items: [], nextCursor: undefined })
    } as any;
    service = new CognitoUserAdminService(cognito, userService, gameService, auditLogService, new Logger());
  });

  describe('list', () => {
    it('joins Cognito users with game profiles and groups', async () => {
      const user = cognitoUser();
      vi.mocked(cognito.listUsers).mockResolvedValue({ users: [user] });
      vi.mocked(cognito.listUsersInGroup).mockImplementation(async (group) => {
        if (group === 'user') {
          return { users: [user], usernames: [user.username] };
        }
        return { users: [], usernames: [] };
      });
      vi.mocked(userService.listUsers).mockResolvedValue({ names: ['sub-ada'], nextCursor: undefined });
      vi.mocked(userService.findUserOrNull).mockResolvedValue(new UserResponseDto('sub-ada', 'Ada', 42));

      const result = await service.list({ limit: 20 });

      expect(result.users).toHaveLength(1);
      expect(result.users[0].sub).toBe('sub-ada');
      expect(result.users[0].group).toBe('user');
      expect(result.users[0].gameProfile).toEqual({ id: 'sub-ada', name: 'Ada', externalId: 42 });
      expect(userService.deleteUser).not.toHaveBeenCalled();
    });

    it('returns null gameProfile when S3 user is missing', async () => {
      const user = cognitoUser();
      vi.mocked(cognito.listUsers).mockResolvedValue({ users: [user] });
      vi.mocked(userService.listUsers).mockResolvedValue({ names: [], nextCursor: undefined });

      const result = await service.list({});

      expect(result.users[0].gameProfile).toBeNull();
    });
  });

  describe('create', () => {
    it('creates a Cognito user, optional game profile, and audit event', async () => {
      const user = cognitoUser();
      vi.mocked(cognito.adminCreateUser).mockResolvedValue(user);
      vi.mocked(cognito.adminGetUser).mockResolvedValue(user);
      vi.mocked(cognito.adminListGroupsForUser)
        .mockResolvedValueOnce([])
        .mockResolvedValue(['user']);
      vi.mocked(userService.createUser).mockResolvedValue(new UserResponseDto('sub-ada', 'Ada', 99) as any);

      const created = await service.create({
        email: 'ada@vkp-test.local',
        password: 'SecurePass12',
        displayName: 'Ada',
        group: 'user',
        createGameProfile: true
      }, actor);

      expect(cognito.adminCreateUser).toHaveBeenCalled();
      expect(cognito.adminSetUserPassword).toHaveBeenCalledWith('ada@vkp-test.local', 'SecurePass12');
      expect(cognito.adminAddUserToGroup).toHaveBeenCalledWith('ada@vkp-test.local', 'user');
      expect(userService.createUser).toHaveBeenCalled();
      expect(auditLogService.append).toHaveBeenCalledWith(expect.objectContaining({
        action: 'create',
        targetSub: 'sub-ada',
        actorSub: 'admin-sub'
      }));
      expect(created.username).toBe('ada@vkp-test.local');
    });

    it('does not create a game profile when createGameProfile is false', async () => {
      const user = cognitoUser();
      vi.mocked(cognito.adminCreateUser).mockResolvedValue(user);
      vi.mocked(cognito.adminGetUser).mockResolvedValue(user);

      await service.create({
        email: 'ada@vkp-test.local',
        password: 'SecurePass12',
        displayName: 'Ada',
        group: 'guest',
        createGameProfile: false
      }, actor);

      expect(userService.createUser).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('deletes Cognito only and does not delete the S3 game profile', async () => {
      vi.mocked(cognito.adminGetUser).mockResolvedValue(cognitoUser());

      await service.delete('ada@vkp-test.local', actor);

      expect(cognito.adminDeleteUser).toHaveBeenCalledWith('ada@vkp-test.local');
      expect(userService.deleteUser).not.toHaveBeenCalled();
      expect(auditLogService.append).toHaveBeenCalledWith(expect.objectContaining({ action: 'delete' }));
    });

    it('rejects deleting the actor own account', async () => {
      vi.mocked(cognito.adminGetUser).mockResolvedValue(cognitoUser({ sub: 'admin-sub' }));

      await expect(service.delete('ada@vkp-test.local', actor)).rejects.toThrow(ForbiddenError);
      expect(cognito.adminDeleteUser).not.toHaveBeenCalled();
    });
  });

  describe('update guards', () => {
    it('rejects disabling self', async () => {
      vi.mocked(cognito.adminGetUser).mockResolvedValue(cognitoUser({ sub: 'admin-sub' }));

      await expect(service.update('admin@vkp-test.local', { enabled: false }, actor))
        .rejects.toThrow(ForbiddenError);
      expect(cognito.adminDisableUser).not.toHaveBeenCalled();
    });

    it('rejects demoting self', async () => {
      vi.mocked(cognito.adminGetUser).mockResolvedValue(cognitoUser({ sub: 'admin-sub' }));

      await expect(service.update('admin@vkp-test.local', { group: 'user' }, actor))
        .rejects.toThrow(ForbiddenError);
    });

    it('allows changing own display name', async () => {
      const user = cognitoUser({ sub: 'admin-sub' });
      vi.mocked(cognito.adminGetUser).mockResolvedValue(user);
      vi.mocked(cognito.adminListGroupsForUser).mockResolvedValue(['admin']);

      await service.update('admin@vkp-test.local', { displayName: 'Boss' }, actor);

      expect(cognito.adminUpdateUserAttributes).toHaveBeenCalled();
    });
  });

  describe('listGames', () => {
    it('filters games by Cognito sub', async () => {
      vi.mocked(cognito.adminGetUser).mockResolvedValue(cognitoUser());
      vi.mocked(gameService.findGamesByUserId).mockResolvedValue({
        games: [{ id: 'g1', status: 'created', isFinished: false, usersIds: ['sub-ada', 'NPC_1'] }],
        truncated: false
      });

      const result = await service.listGames('ada@vkp-test.local');

      expect(gameService.findGamesByUserId).toHaveBeenCalledWith('sub-ada', 100);
      expect(result.games).toHaveLength(1);
    });
  });

  describe('patchGameProfile', () => {
    it('throws when the S3 profile does not exist', async () => {
      vi.mocked(cognito.adminGetUser).mockResolvedValue(cognitoUser());
      vi.mocked(userService.findUserOrNull).mockResolvedValue(null);

      await expect(service.patchGameProfile('ada@vkp-test.local', { name: 'New' }, actor))
        .rejects.toThrow(NotFoundError);
    });
  });
});
