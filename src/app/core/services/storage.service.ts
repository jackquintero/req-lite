import { Injectable } from '@angular/core';
import { createStore, get, set, UseStore } from 'idb-keyval';
import { Collection } from '../models/collection.model';
import { Environment } from '../models/environment.model';
import { ApiRequest } from '../models/request.model';

const COLLECTIONS_KEY = 'req-lite:collections';
const SAVED_REQUESTS_KEY = 'req-lite:saved-requests';
const ENVIRONMENTS_KEY = 'req-lite:environments';
const ACTIVE_ENVIRONMENT_KEY = 'req-lite:active-environment-id';

const isIndexedDbAvailable = typeof indexedDB !== 'undefined';

// Base de datos propia (en vez del "keyval-store" genérico por defecto de idb-keyval) para no
// colisionar con otra app que use la misma librería si algún día comparten el mismo origen/puerto.
const store: UseStore | undefined = isIndexedDbAvailable
  ? createStore('req-lite-db', 'req-lite-store')
  : undefined;

@Injectable({ providedIn: 'root' })
export class StorageService {
  loadCollections(): Promise<Collection[] | undefined> {
    return this.get(COLLECTIONS_KEY);
  }

  saveCollections(collections: Collection[]): Promise<void> {
    return this.set(COLLECTIONS_KEY, collections);
  }

  loadSavedRequests(): Promise<ApiRequest[] | undefined> {
    return this.get(SAVED_REQUESTS_KEY);
  }

  saveSavedRequests(requests: ApiRequest[]): Promise<void> {
    return this.set(SAVED_REQUESTS_KEY, requests);
  }

  loadEnvironments(): Promise<Environment[] | undefined> {
    return this.get(ENVIRONMENTS_KEY);
  }

  saveEnvironments(environments: Environment[]): Promise<void> {
    return this.set(ENVIRONMENTS_KEY, environments);
  }

  loadActiveEnvironmentId(): Promise<string | null | undefined> {
    return this.get(ACTIVE_ENVIRONMENT_KEY);
  }

  saveActiveEnvironmentId(id: string | null): Promise<void> {
    return this.set(ACTIVE_ENVIRONMENT_KEY, id);
  }

  // IndexedDB puede no estar disponible (jsdom en tests, Safari en modo privado, políticas
  // corporativas). En esos casos la app sigue funcionando, solo sin persistencia entre sesiones.
  private async get<T>(key: string): Promise<T | undefined> {
    if (!store) return undefined;

    const value = await get<T>(key, store);
    if (value !== undefined) return value;

    // Migración de una sola vez: versiones anteriores usaban el store genérico por defecto de
    // idb-keyval. Si hay datos ahí, los copiamos al store propio para no perderlos.
    const legacyValue = await get<T>(key);
    if (legacyValue !== undefined) {
      await set(key, legacyValue, store);
    }
    return legacyValue;
  }

  private set(key: string, value: unknown): Promise<void> {
    return store ? set(key, value, store) : Promise.resolve();
  }
}
