import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Collection } from '../models/collection.model';
import { ApiRequest, normalizeRequest } from '../models/request.model';
import { StorageService } from '../services/storage.service';
import { generateId } from '../../shared/utils/id.util';
import { upsertById } from '../../shared/utils/upsert.util';

@Injectable({ providedIn: 'root' })
export class CollectionsStore {
  private readonly storage = inject(StorageService);

  private readonly collectionsSignal = signal<Collection[]>([]);
  private readonly savedRequestsSignal = signal<ApiRequest[]>([]);
  private readonly selectedCollectionIdSignal = signal<string | null>(null);
  private readonly hydrated = signal(false);

  readonly collections = this.collectionsSignal.asReadonly();
  readonly savedRequests = this.savedRequestsSignal.asReadonly();
  readonly selectedCollectionId = this.selectedCollectionIdSignal.asReadonly();

  readonly requestsByCollectionId = computed<Record<string, ApiRequest[]>>(() => {
    const byId = new Map(this.savedRequestsSignal().map((request) => [request.id, request]));
    const result: Record<string, ApiRequest[]> = {};
    for (const collection of this.collectionsSignal()) {
      result[collection.id] = collection.requestIds
        .map((id) => byId.get(id))
        .filter((request): request is ApiRequest => request !== undefined);
    }
    return result;
  });

  constructor() {
    effect(() => {
      const collections = this.collectionsSignal();
      if (!this.hydrated()) return;
      void this.storage.saveCollections(collections);
    });

    effect(() => {
      const requests = this.savedRequestsSignal();
      if (!this.hydrated()) return;
      void this.storage.saveSavedRequests(requests);
    });

    void this.hydrate();
  }

  setSelectedCollection(collectionId: string | null): void {
    this.selectedCollectionIdSignal.set(collectionId);
  }

  createCollection(name: string): Collection {
    const now = Date.now();
    const collection: Collection = { id: generateId(), name, requestIds: [], createdAt: now, updatedAt: now };
    this.collectionsSignal.update((collections) => [...collections, collection]);
    return collection;
  }

  renameCollection(collectionId: string, name: string): void {
    this.collectionsSignal.update((collections) =>
      collections.map((c) => (c.id === collectionId ? { ...c, name, updatedAt: Date.now() } : c)),
    );
  }

  deleteCollection(collectionId: string): void {
    const collection = this.collectionsSignal().find((c) => c.id === collectionId);
    if (!collection) return;

    const idsToRemove = new Set(collection.requestIds);
    this.savedRequestsSignal.update((requests) => requests.filter((r) => !idsToRemove.has(r.id)));
    this.collectionsSignal.update((collections) => collections.filter((c) => c.id !== collectionId));

    if (this.selectedCollectionIdSignal() === collectionId) {
      this.selectedCollectionIdSignal.set(null);
    }
  }

  saveRequest(request: ApiRequest): ApiRequest {
    const now = Date.now();
    const existing = this.savedRequestsSignal().find((r) => r.id === request.id);
    const saved: ApiRequest = existing
      ? { ...request, updatedAt: now }
      : { ...request, createdAt: now, updatedAt: now };

    this.savedRequestsSignal.update((requests) =>
      existing ? requests.map((r) => (r.id === saved.id ? saved : r)) : [...requests, saved],
    );

    if (!existing && saved.collectionId) {
      this.collectionsSignal.update((collections) =>
        collections.map((c) =>
          c.id === saved.collectionId && !c.requestIds.includes(saved.id)
            ? { ...c, requestIds: [...c.requestIds, saved.id], updatedAt: now }
            : c,
        ),
      );
    }

    return saved;
  }

  mergeCollections(collections: Collection[], requests: ApiRequest[]): void {
    this.collectionsSignal.update((existing) => upsertById(existing, collections));
    this.savedRequestsSignal.update((existing) => upsertById(existing, requests.map(normalizeRequest)));
  }

  deleteRequest(requestId: string): void {
    this.savedRequestsSignal.update((requests) => requests.filter((r) => r.id !== requestId));
    this.collectionsSignal.update((collections) =>
      collections.map((c) => ({ ...c, requestIds: c.requestIds.filter((id) => id !== requestId) })),
    );
  }

  private async hydrate(): Promise<void> {
    const [collections, requests] = await Promise.all([
      this.storage.loadCollections(),
      this.storage.loadSavedRequests(),
    ]);
    if (collections) this.collectionsSignal.set(collections);
    if (requests) this.savedRequestsSignal.set(requests.map(normalizeRequest));
    this.hydrated.set(true);
  }
}
