/**
 * DTO for list responses
 */
export class ListResponseDto {
  constructor(
    public readonly names: string[],
    public readonly nextCursor?: string
  ) {}
}

