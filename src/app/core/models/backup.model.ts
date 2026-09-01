import { Collection } from './collection.model';
import { Environment } from './environment.model';
import { ApiRequest } from './request.model';

export interface BackupSnapshot {
  version: 1;
  exportedAt: number;
  collections: Collection[];
  requests: ApiRequest[];
  environments: Environment[];
}

export function isBackupSnapshot(data: unknown): data is BackupSnapshot {
  if (typeof data !== 'object' || data === null) return false;
  const candidate = data as Record<string, unknown>;
  return (
    Array.isArray(candidate['collections']) &&
    Array.isArray(candidate['requests']) &&
    Array.isArray(candidate['environments'])
  );
}
