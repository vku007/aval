/**
 * DTO for list responses
 */
export class ListResponseDto {
  constructor(
    public readonly names: string[],
    public readonly nextCursor?: string
  ) {}

  toJSON(): { names: string[]; nextCursor?: string } {
    return {
      names: this.names,
      ...(this.nextCursor ? { nextCursor: this.nextCursor } : {})
    };
  }
}

