import type { User } from '../../domain/entity/User.js';

export class UserResponseDto {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly externalId: number
  ) {}

  static fromUser(user: User): UserResponseDto {
    return new UserResponseDto(
      user.id,
      user.name,
      user.externalId
    );
  }

  toJSON(): object {
    return {
      id: this.id,
      name: this.name,
      externalId: this.externalId
    };
  }
}
