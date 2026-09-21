import { describe, it, expect } from 'vitest';
import { CognitoUserAdminDto } from './CognitoUserAdminDto.js';
import { ValidationError } from '../../shared/errors/index.js';

describe('CognitoUserAdminDto', () => {
  it('accepts a valid create body', () => {
    const dto = CognitoUserAdminDto.parseCreate({
      email: 'ada@vkp-test.local',
      password: 'SecurePass12',
      displayName: 'Ada',
      group: 'user',
      createGameProfile: true
    });
    expect(dto.createGameProfile).toBe(true);
    expect(dto.group).toBe('user');
  });

  it('rejects a password without a number', () => {
    expect(() => CognitoUserAdminDto.parseCreate({
      email: 'ada@vkp-test.local',
      password: 'NoNumbersHere!',
      displayName: 'Ada',
      group: 'user'
    })).toThrow(ValidationError);
  });

  it('requires at least one update field', () => {
    expect(() => CognitoUserAdminDto.parseUpdate({})).toThrow(ValidationError);
  });
});
