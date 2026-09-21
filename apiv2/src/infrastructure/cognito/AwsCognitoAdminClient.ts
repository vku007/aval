import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
  ListUsersInGroupCommand,
  AdminListGroupsForUserCommand,
  AdminGetUserCommand,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
  AdminUpdateUserAttributesCommand,
  AdminEnableUserCommand,
  AdminDisableUserCommand,
  AdminDeleteUserCommand,
  type AttributeType,
  type UserType
} from '@aws-sdk/client-cognito-identity-provider';
import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors/index.js';
import { ApplicationError } from '../../shared/errors/ApplicationError.js';
import type {
  CognitoAdminClient,
  CognitoGroupName,
  CognitoListedUser,
  CognitoUserPage
} from './CognitoAdminClient.js';
import { COGNITO_GROUPS } from './CognitoAdminClient.js';

function attrsToRecord(attrs?: AttributeType[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const attr of attrs ?? []) {
    if (attr.Name && attr.Value !== undefined) {
      out[attr.Name] = attr.Value;
    }
  }
  return out;
}

function fromUserType(user: UserType, fallbackUsername?: string): CognitoListedUser {
  return {
    username: user.Username || fallbackUsername || '',
    attributes: attrsToRecord(user.Attributes),
    enabled: user.Enabled !== false,
    status: user.UserStatus || 'UNKNOWN',
    createdAt: user.UserCreateDate?.toISOString(),
    updatedAt: user.UserLastModifiedDate?.toISOString()
  };
}

function rethrowCognito(error: unknown): never {
  if (error instanceof ApplicationError) {
    throw error;
  }
  const err = error as { name?: string; message?: string };
  switch (err.name) {
    case 'UserNotFoundException':
      throw new NotFoundError('Cognito user not found');
    case 'UsernameExistsException':
    case 'AliasExistsException':
      throw new ConflictError('Email address is already in use');
    case 'InvalidPasswordException':
      throw new ValidationError('Password does not meet requirements');
    case 'InvalidParameterException':
      throw new ValidationError(err.message || 'Invalid parameter');
    default:
      throw error;
  }
}

export class AwsCognitoAdminClient implements CognitoAdminClient {
  private readonly cognito: CognitoIdentityProviderClient;
  private readonly userPoolId: string;

  constructor(client?: CognitoIdentityProviderClient) {
    this.cognito = client ?? new CognitoIdentityProviderClient({
      region: process.env.REGION || process.env.AWS_REGION || 'eu-north-1'
    });
    this.userPoolId = process.env.USER_POOL_ID || '';
  }

  async listUsers(opts: { filter?: string; limit?: number; paginationToken?: string }): Promise<CognitoUserPage> {
    try {
      const response = await this.cognito.send(new ListUsersCommand({
        UserPoolId: this.userPoolId,
        Filter: opts.filter,
        Limit: opts.limit,
        PaginationToken: opts.paginationToken
      }));
      return {
        users: (response.Users ?? []).map((user) => fromUserType(user)),
        paginationToken: response.PaginationToken
      };
    } catch (error) {
      rethrowCognito(error);
    }
  }

  async listUsersInGroup(
    group: CognitoGroupName,
    opts?: { limit?: number; paginationToken?: string }
  ) {
    try {
      const response = await this.cognito.send(new ListUsersInGroupCommand({
        UserPoolId: this.userPoolId,
        GroupName: group,
        Limit: opts?.limit,
        NextToken: opts?.paginationToken
      }));
      const users = (response.Users ?? []).map((user) => fromUserType(user));
      return {
        users,
        usernames: users.map((user) => user.username),
        paginationToken: response.NextToken
      };
    } catch (error) {
      rethrowCognito(error);
    }
  }

  async adminListGroupsForUser(username: string): Promise<CognitoGroupName[]> {
    try {
      const response = await this.cognito.send(new AdminListGroupsForUserCommand({
        UserPoolId: this.userPoolId,
        Username: username
      }));
      const names = (response.Groups ?? [])
        .map((group) => group.GroupName)
        .filter((name): name is CognitoGroupName => COGNITO_GROUPS.includes(name as CognitoGroupName));
      return names;
    } catch (error) {
      rethrowCognito(error);
    }
  }

  async adminGetUser(username: string): Promise<CognitoListedUser> {
    try {
      const response = await this.cognito.send(new AdminGetUserCommand({
        UserPoolId: this.userPoolId,
        Username: username
      }));
      return {
        username: response.Username || username,
        attributes: attrsToRecord(response.UserAttributes),
        enabled: response.Enabled !== false,
        status: response.UserStatus || 'UNKNOWN',
        createdAt: response.UserCreateDate?.toISOString(),
        updatedAt: response.UserLastModifiedDate?.toISOString()
      };
    } catch (error) {
      rethrowCognito(error);
    }
  }

  async adminCreateUser(params: {
    username: string;
    email: string;
    displayName: string;
    temporaryPassword: string;
    role: CognitoGroupName;
  }): Promise<CognitoListedUser> {
    try {
      const response = await this.cognito.send(new AdminCreateUserCommand({
        UserPoolId: this.userPoolId,
        Username: params.username,
        UserAttributes: [
          { Name: 'email', Value: params.email },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'custom:display_name', Value: params.displayName },
          { Name: 'custom:role', Value: params.role }
        ],
        TemporaryPassword: params.temporaryPassword,
        MessageAction: 'SUPPRESS'
      }));
      if (!response.User) {
        throw new Error('Cognito create user returned no user');
      }
      return fromUserType(response.User, params.username);
    } catch (error) {
      rethrowCognito(error);
    }
  }

  async adminSetUserPassword(username: string, password: string): Promise<void> {
    try {
      await this.cognito.send(new AdminSetUserPasswordCommand({
        UserPoolId: this.userPoolId,
        Username: username,
        Password: password,
        Permanent: true
      }));
    } catch (error) {
      rethrowCognito(error);
    }
  }

  async adminAddUserToGroup(username: string, group: CognitoGroupName): Promise<void> {
    try {
      await this.cognito.send(new AdminAddUserToGroupCommand({
        UserPoolId: this.userPoolId,
        Username: username,
        GroupName: group
      }));
    } catch (error) {
      rethrowCognito(error);
    }
  }

  async adminRemoveUserFromGroup(username: string, group: CognitoGroupName): Promise<void> {
    try {
      await this.cognito.send(new AdminRemoveUserFromGroupCommand({
        UserPoolId: this.userPoolId,
        Username: username,
        GroupName: group
      }));
    } catch (error) {
      rethrowCognito(error);
    }
  }

  async adminUpdateUserAttributes(username: string, attributes: Record<string, string>): Promise<void> {
    try {
      await this.cognito.send(new AdminUpdateUserAttributesCommand({
        UserPoolId: this.userPoolId,
        Username: username,
        UserAttributes: Object.entries(attributes).map(([Name, Value]) => ({ Name, Value }))
      }));
    } catch (error) {
      rethrowCognito(error);
    }
  }

  async adminEnableUser(username: string): Promise<void> {
    try {
      await this.cognito.send(new AdminEnableUserCommand({
        UserPoolId: this.userPoolId,
        Username: username
      }));
    } catch (error) {
      rethrowCognito(error);
    }
  }

  async adminDisableUser(username: string): Promise<void> {
    try {
      await this.cognito.send(new AdminDisableUserCommand({
        UserPoolId: this.userPoolId,
        Username: username
      }));
    } catch (error) {
      rethrowCognito(error);
    }
  }

  async adminDeleteUser(username: string): Promise<void> {
    try {
      await this.cognito.send(new AdminDeleteUserCommand({
        UserPoolId: this.userPoolId,
        Username: username
      }));
    } catch (error) {
      rethrowCognito(error);
    }
  }
}
