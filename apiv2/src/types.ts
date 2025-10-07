export type JsonValue = null | boolean | number | string | JsonValue[] | { [k: string]: JsonValue };

export interface ListResultItem {
  name: string;
  etag?: string;
  size?: number;
  lastModified?: string;
}

export interface ListResult {
  items: ListResultItem[];
  nextCursor?: string;
}
