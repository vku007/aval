export type CognitoGroupName = 'admin' | 'user' | 'guest';

export const COGNITO_GROUPS: CognitoGroupName[] = ['admin', 'user', 'guest'];

export interface CognitoListedUser {
  username: string;
  attributes: Record<string, string>;
  enabled: boolean;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CognitoUserPage {
  users: CognitoListedUser[];
  paginationToken?: string;
}

export interface CognitoGroupPage {
  usernames: string[];
  paginationToken?: string;
}

export interface CognitoAdminClient {
  listUsers(opts: { filter?: string; limit?: number; paginationToken?: string }): Promise<CognitoUserPage>;
  listUsersInGroup(
    group: CognitoGroupName,
    opts?: { limit?: number; paginationToken?: string }
  ): Promise<CognitoGroupPage & { users: CognitoListedUser[] }>;
  adminListGroupsForUser(username: string): Promise<CognitoGroupName[]>;
  adminGetUser(username: string): Promise<CognitoListedUser>;
  adminCreateUser(params: {
    username: string;
    email: string;
    displayName: string;
    temporaryPassword: string;
    role: CognitoGroupName;
  }): Promise<CognitoListedUser>;
  adminSetUserPassword(username: string, password: string): Promise<void>;
  adminAddUserToGroup(username: string, group: CognitoGroupName): Promise<void>;
  adminRemoveUserFromGroup(username: string, group: CognitoGroupName): Promise<void>;
  adminUpdateUserAttributes(username: string, attributes: Record<string, string>): Promise<void>;
  adminEnableUser(username: string): Promise<void>;
  adminDisableUser(username: string): Promise<void>;
  adminDeleteUser(username: string): Promise<void>;
}
