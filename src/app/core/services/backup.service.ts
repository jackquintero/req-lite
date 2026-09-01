import { Injectable, inject } from '@angular/core';
import { BackupSnapshot, isBackupSnapshot } from '../models/backup.model';
import { CollectionsStore } from '../stores/collections.store';
import { EnvironmentsStore } from '../stores/environments.store';
import { isPostmanCollection, isPostmanEnvironment, PostmanImportService } from './postman-import.service';

@Injectable({ providedIn: 'root' })
export class BackupService {
  private readonly collectionsStore = inject(CollectionsStore);
  private readonly environmentsStore = inject(EnvironmentsStore);
  private readonly postmanImport = inject(PostmanImportService);

  exportSnapshot(): BackupSnapshot {
    return {
      version: 1,
      exportedAt: Date.now(),
      collections: this.collectionsStore.collections(),
      requests: this.collectionsStore.savedRequests(),
      environments: this.environmentsStore.environments(),
    };
  }

  /** Acepta un backup propio de req-lite, una colección de Postman (v2.x) o un entorno de Postman. */
  importSnapshot(data: unknown): void {
    if (isBackupSnapshot(data)) {
      this.collectionsStore.mergeCollections(data.collections, data.requests);
      this.environmentsStore.mergeEnvironments(data.environments);
      return;
    }

    if (isPostmanCollection(data)) {
      const { collection, requests } = this.postmanImport.convertCollection(data);
      this.collectionsStore.mergeCollections([collection], requests);
      return;
    }

    if (isPostmanEnvironment(data)) {
      const environment = this.postmanImport.convertEnvironment(data);
      this.environmentsStore.mergeEnvironments([environment]);
      return;
    }

    throw new Error(
      'El archivo no es un backup de req-lite ni una colección/entorno de Postman reconocible.',
    );
  }
}
