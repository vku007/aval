export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'set-group'
  | 'set-password'
  | 'enable'
  | 'disable'
  | 'upsert-game-profile';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorSub: string;
  actorEmail: string;
  action: AuditAction;
  targetUsername: string;
  targetSub: string;
  details: Record<string, unknown>;
}

export interface AuditLogListResult {
  items: AuditLogEntry[];
  nextCursor?: string;
}

export interface IAuditLogRepository {
  append(entry: AuditLogEntry): Promise<void>;
  list(opts: { targetSub?: string; limit?: number; cursor?: string }): Promise<AuditLogListResult>;
}
