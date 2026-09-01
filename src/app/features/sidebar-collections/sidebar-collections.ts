import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { BackupService } from '../../core/services/backup.service';
import { CollectionsStore } from '../../core/stores/collections.store';
import { TabsStore } from '../../core/stores/tabs.store';
import { ApiRequest } from '../../core/models/request.model';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  selector: 'app-sidebar-collections',
  styleUrl: './sidebar-collections.scss',
  templateUrl: './sidebar-collections.html',
})
export class SidebarCollections {
  private readonly collectionsStore = inject(CollectionsStore);
  private readonly tabsStore = inject(TabsStore);
  private readonly backupService = inject(BackupService);

  protected readonly collections = this.collectionsStore.collections;
  protected readonly requestsByCollection = this.collectionsStore.requestsByCollectionId;
  protected readonly selectedCollectionId = this.collectionsStore.selectedCollectionId;

  private readonly collapsedCollectionIds = signal<Set<string>>(new Set());

  selectCollection(collectionId: string): void {
    this.collectionsStore.setSelectedCollection(collectionId);
  }

  isExpanded(collectionId: string): boolean {
    return !this.collapsedCollectionIds().has(collectionId);
  }

  toggleExpanded(event: Event, collectionId: string): void {
    event.stopPropagation();
    this.collapsedCollectionIds.update((ids) => {
      const next = new Set(ids);
      if (next.has(collectionId)) next.delete(collectionId);
      else next.add(collectionId);
      return next;
    });
  }

  createCollection(): void {
    const name = window.prompt('Nombre de la colección:', 'Mi colección');
    if (!name) return;
    const collection = this.collectionsStore.createCollection(name);
    this.collectionsStore.setSelectedCollection(collection.id);
  }

  renameCollection(event: Event, collectionId: string, currentName: string): void {
    event.stopPropagation();
    const name = window.prompt('Nuevo nombre:', currentName);
    if (!name) return;
    this.collectionsStore.renameCollection(collectionId, name);
  }

  deleteCollection(event: Event, collectionId: string): void {
    event.stopPropagation();
    if (!window.confirm('¿Borrar esta colección y todos sus requests guardados?')) return;
    this.collectionsStore.deleteCollection(collectionId);
  }

  openRequest(request: ApiRequest): void {
    this.tabsStore.openTab(request);
  }

  deleteRequest(event: Event, requestId: string): void {
    event.stopPropagation();
    if (!window.confirm('¿Borrar este request guardado?')) return;
    this.collectionsStore.deleteRequest(requestId);
  }

  exportBackup(): void {
    const snapshot = this.backupService.exportSnapshot();
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `req-lite-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();

    URL.revokeObjectURL(url);
  }

  async onImportFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    try {
      const data = JSON.parse(await file.text());
      this.backupService.importSnapshot(data);
      window.alert('Backup importado correctamente.');
    } catch (error) {
      window.alert(
        `No se pudo importar el archivo: ${error instanceof Error ? error.message : 'formato inválido'}`,
      );
    }
  }
}
