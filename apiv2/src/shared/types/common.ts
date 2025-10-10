/**
 * Recursive JSON value type
 */
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

/**
 * Generic list result with pagination
 */
export interface ListResult<T> {
  items: T[];
  nextCursor?: string;
}

/**
 * Entity metadata from storage
 */
export interface EntityMetadata {
  etag?: string;
  size?: number;
  lastModified?: string;
}

