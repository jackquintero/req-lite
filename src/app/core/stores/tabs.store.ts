import { Injectable, computed, signal } from '@angular/core';
import { ApiRequest, normalizeRequest } from '../models/request.model';
import { ApiResponse } from '../models/response.model';
import { RequestTab } from '../models/tab.model';
import { generateId } from '../../shared/utils/id.util';

function createEmptyRequest(): ApiRequest {
  const now = Date.now();
  return {
    id: generateId(),
    name: 'Untitled request',
    method: 'GET',
    url: '',
    queryParams: [],
    headers: [],
    body: { type: 'none', content: '', formData: [] },
    preRequestScript: '',
    postResponseScript: '',
    createdAt: now,
    updatedAt: now,
  };
}

function createTab(request?: ApiRequest): RequestTab {
  return {
    id: generateId(),
    requestId: request?.id,
    draft: request ? normalizeRequest(request) : createEmptyRequest(),
    response: null,
    error: null,
    scriptError: null,
    isDirty: false,
    isLoading: false,
  };
}

@Injectable({ providedIn: 'root' })
export class TabsStore {
  private readonly tabsSignal = signal<RequestTab[]>([]);
  private readonly activeTabIdSignal = signal<string | null>(null);

  readonly tabs = this.tabsSignal.asReadonly();
  readonly activeTabId = this.activeTabIdSignal.asReadonly();

  readonly activeTab = computed(
    () => this.tabsSignal().find((tab) => tab.id === this.activeTabIdSignal()) ?? null,
  );

  openTab(request?: ApiRequest): string {
    if (request) {
      const existing = this.tabsSignal().find((tab) => tab.requestId === request.id);
      if (existing) {
        this.activeTabIdSignal.set(existing.id);
        return existing.id;
      }
    }

    const tab = createTab(request);
    this.tabsSignal.update((tabs) => [...tabs, tab]);
    this.activeTabIdSignal.set(tab.id);
    return tab.id;
  }

  closeTab(tabId: string): void {
    const tabs = this.tabsSignal();
    const closingIndex = tabs.findIndex((tab) => tab.id === tabId);
    if (closingIndex === -1) return;

    const nextTabs = tabs.filter((tab) => tab.id !== tabId);
    this.tabsSignal.set(nextTabs);

    if (this.activeTabIdSignal() === tabId) {
      const fallback = nextTabs[closingIndex] ?? nextTabs[closingIndex - 1] ?? null;
      this.activeTabIdSignal.set(fallback?.id ?? null);
    }
  }

  setActiveTab(tabId: string): void {
    this.activeTabIdSignal.set(tabId);
  }

  updateDraft(tabId: string, changes: Partial<ApiRequest>): void {
    this.patchTab(tabId, (tab) => ({
      ...tab,
      draft: { ...tab.draft, ...changes },
      isDirty: true,
    }));
  }

  setLoading(tabId: string, isLoading: boolean): void {
    this.patchTab(tabId, (tab) => ({ ...tab, isLoading }));
  }

  setResponse(tabId: string, response: ApiResponse | null): void {
    this.patchTab(tabId, (tab) => ({ ...tab, response, error: null, isLoading: false }));
  }

  setError(tabId: string, error: string | null): void {
    this.patchTab(tabId, (tab) => ({ ...tab, error, isLoading: false }));
  }

  setScriptError(tabId: string, scriptError: string | null): void {
    this.patchTab(tabId, (tab) => ({ ...tab, scriptError }));
  }

  markSaved(tabId: string, savedRequest: ApiRequest): void {
    this.patchTab(tabId, (tab) => ({
      ...tab,
      requestId: savedRequest.id,
      draft: savedRequest,
      isDirty: false,
    }));
  }

  private patchTab(tabId: string, updater: (tab: RequestTab) => RequestTab): void {
    this.tabsSignal.update((tabs) => tabs.map((tab) => (tab.id === tabId ? updater(tab) : tab)));
  }
}
