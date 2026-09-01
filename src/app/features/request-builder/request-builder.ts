import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  HttpExecutorService,
  RequestExecutionError,
} from '../../core/services/http-executor.service';
import { VariableInterpolationService } from '../../core/services/variable-interpolation.service';
import { PmRequestBodyUpdate, ScriptRunnerService } from '../../core/services/script-runner.service';
import {
  ApiRequest,
  BodyType,
  FormDataField,
  HttpMethod,
  KeyValueParam,
  RequestBody,
} from '../../core/models/request.model';
import { ApiResponse } from '../../core/models/response.model';
import { RequestTab } from '../../core/models/tab.model';
import { CollectionsStore } from '../../core/stores/collections.store';
import { EnvironmentsStore } from '../../core/stores/environments.store';
import { TabsStore } from '../../core/stores/tabs.store';
import { KeyValueEditor } from '../../shared/ui/key-value-editor/key-value-editor';
import { FormDataEditor } from '../../shared/ui/form-data-editor/form-data-editor';
import { CodeEditor } from '../../shared/ui/code-editor/code-editor';
import { ResponseViewer } from '../response-viewer/response-viewer';
import { toCurlCommand } from '../../shared/utils/curl.util';

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
const BODY_TYPES: BodyType[] = ['none', 'json', 'text', 'form-urlencoded', 'form-data'];

type Section = 'body' | 'config';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [KeyValueEditor, FormDataEditor, CodeEditor, ResponseViewer],
  selector: 'app-request-builder',
  styleUrl: './request-builder.scss',
  templateUrl: './request-builder.html',
})
export class RequestBuilder {
  private readonly tabsStore = inject(TabsStore);
  private readonly httpExecutor = inject(HttpExecutorService);
  private readonly interpolation = inject(VariableInterpolationService);
  private readonly environmentsStore = inject(EnvironmentsStore);
  private readonly collectionsStore = inject(CollectionsStore);
  private readonly scriptRunner = inject(ScriptRunnerService);

  protected readonly methods = METHODS;
  protected readonly bodyTypes = BODY_TYPES;

  protected readonly activeTab = this.tabsStore.activeTab;

  protected readonly bodyEnabled = computed(() => {
    const method = this.activeTab()?.draft.method;
    return method !== undefined && method !== 'GET' && method !== 'HEAD';
  });

  protected readonly hasManualContentTypeForFormData = computed(() => {
    const tab = this.activeTab();
    if (!tab || tab.draft.body.type !== 'form-data') return false;
    return tab.draft.headers.some((h) => h.enabled && h.key.toLowerCase() === 'content-type');
  });

  protected readonly curlCopied = signal(false);
  protected readonly activeSection = signal<Section>('body');

  private readonly abortControllers = new Map<string, AbortController>();

  setSection(section: Section): void {
    this.activeSection.set(section);
  }

  onMethodChange(method: HttpMethod): void {
    this.updateDraft({ method });
  }

  onUrlChange(url: string): void {
    this.updateDraft({ url });
  }

  onQueryParamsChange(queryParams: KeyValueParam[]): void {
    this.updateDraft({ queryParams });
  }

  onHeadersChange(headers: KeyValueParam[]): void {
    this.updateDraft({ headers });
  }

  onBodyTypeChange(type: BodyType): void {
    const tab = this.activeTab();
    if (!tab) return;
    this.updateDraft({ body: { ...tab.draft.body, type } });
  }

  onBodyContentChange(content: string): void {
    const tab = this.activeTab();
    if (!tab) return;
    this.updateDraft({ body: { ...tab.draft.body, content } });
  }

  onFormDataChange(formData: FormDataField[]): void {
    const tab = this.activeTab();
    if (!tab) return;
    this.updateDraft({ body: { ...tab.draft.body, formData } });
  }

  onPreRequestScriptChange(preRequestScript: string): void {
    this.updateDraft({ preRequestScript });
  }

  onPostResponseScriptChange(postResponseScript: string): void {
    this.updateDraft({ postResponseScript });
  }

  onKeydown(event: KeyboardEvent): void {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      void this.send();
    }
  }

  async send(): Promise<void> {
    const tab = this.activeTab();
    if (!tab || !tab.draft.url || tab.isLoading) return;

    this.tabsStore.setLoading(tab.id, true);

    let effectiveDraft: ApiRequest;
    try {
      effectiveDraft = await this.runPreRequestScript(tab);
    } catch (error) {
      this.tabsStore.setError(
        tab.id,
        error instanceof Error ? error.message : 'Error en el pre-request script.',
      );
      return;
    }

    const controller = new AbortController();
    this.abortControllers.set(tab.id, controller);

    const resolved = this.interpolation.resolveRequest(
      effectiveDraft,
      this.environmentsStore.activeVariables(),
    );

    try {
      const response = await this.httpExecutor.execute(resolved, controller.signal);
      this.tabsStore.setResponse(tab.id, response);
      this.runPostResponseScript(tab, response);
    } catch (error) {
      this.tabsStore.setError(
        tab.id,
        error instanceof RequestExecutionError ? error.message : 'Error inesperado al enviar el request.',
      );
    } finally {
      this.abortControllers.delete(tab.id);
    }
  }

  cancel(tabId: string): void {
    this.abortControllers.get(tabId)?.abort();
  }

  async copyAsCurl(): Promise<void> {
    const tab = this.activeTab();
    if (!tab) return;

    const resolved = this.interpolation.resolveRequest(tab.draft, this.environmentsStore.activeVariables());
    await navigator.clipboard.writeText(toCurlCommand(resolved));

    this.curlCopied.set(true);
    setTimeout(() => this.curlCopied.set(false), 1500);
  }

  private async runPreRequestScript(tab: RequestTab): Promise<ApiRequest> {
    const script = tab.draft.preRequestScript ?? '';
    if (!script.trim()) return tab.draft;

    const activeEnvironment = this.environmentsStore.activeEnvironment();
    const mutableHeaders: KeyValueParam[] = [...tab.draft.headers];
    let mutableBody: RequestBody = { ...tab.draft.body };

    await this.scriptRunner.runPreRequest(
      script,
      {
        method: tab.draft.method,
        url: { toString: () => tab.draft.url },
        headers: {
          add: (header) => mutableHeaders.push({ key: header.key, value: header.value, enabled: true }),
        },
        body: {
          mode: toPostmanBodyMode(tab.draft.body.type),
          raw: tab.draft.body.content,
          update: (update: PmRequestBodyUpdate) => {
            mutableBody = applyBodyUpdate(mutableBody, update);
          },
        },
      },
      {
        get: (key) => activeEnvironment?.variables.find((v) => v.key === key)?.value,
        set: (key, value) => {
          if (!activeEnvironment) {
            throw new Error('No hay un entorno activo para guardar variables. Seleccioná uno arriba.');
          }
          this.environmentsStore.setVariableValue(activeEnvironment.id, key, value);
        },
        unset: (key) => {
          if (activeEnvironment) this.environmentsStore.unsetVariable(activeEnvironment.id, key);
        },
      },
    );

    return { ...tab.draft, headers: mutableHeaders, body: mutableBody };
  }

  private runPostResponseScript(tab: RequestTab, response: ApiResponse): void {
    const script = tab.draft.postResponseScript ?? '';
    if (!script.trim()) {
      this.tabsStore.setScriptError(tab.id, null);
      return;
    }

    const activeEnvironment = this.environmentsStore.activeEnvironment();

    try {
      this.scriptRunner.run(script, response, {
        get: (key) => activeEnvironment?.variables.find((v) => v.key === key)?.value,
        set: (key, value) => {
          if (!activeEnvironment) {
            throw new Error('No hay un entorno activo para guardar variables. Seleccioná uno arriba.');
          }
          this.environmentsStore.setVariableValue(activeEnvironment.id, key, value);
        },
        unset: (key) => {
          if (activeEnvironment) this.environmentsStore.unsetVariable(activeEnvironment.id, key);
        },
      });
      this.tabsStore.setScriptError(tab.id, null);
    } catch (error) {
      this.tabsStore.setScriptError(
        tab.id,
        error instanceof Error ? error.message : 'Error al ejecutar el script.',
      );
    }
  }

  save(): void {
    const tab = this.activeTab();
    if (!tab) return;

    let collectionId = tab.draft.collectionId ?? this.collectionsStore.selectedCollectionId();
    if (!collectionId) {
      const name = window.prompt('Nombre de la nueva colección:', 'Mi colección');
      if (!name) return;
      collectionId = this.collectionsStore.createCollection(name).id;
      this.collectionsStore.setSelectedCollection(collectionId);
    }

    const name = window.prompt('Nombre del request:', tab.draft.name) ?? tab.draft.name;
    const saved = this.collectionsStore.saveRequest({ ...tab.draft, name, collectionId });
    this.tabsStore.markSaved(tab.id, saved);
  }

  private updateDraft(changes: Partial<ApiRequest>): void {
    const tab = this.activeTab();
    if (!tab) return;
    this.tabsStore.updateDraft(tab.id, changes);
  }
}

function toPostmanBodyMode(type: BodyType): string {
  switch (type) {
    case 'json':
    case 'text':
      return 'raw';
    case 'form-urlencoded':
      return 'urlencoded';
    case 'form-data':
      return 'formdata';
    default:
      return 'none';
  }
}

// Solo soporta mode:'raw' (JSON/texto) desde el script, que es el uso real de pre-request más
// común (armar un body calculado, como en el ejemplo de encriptación). urlencoded/formdata
// requerirían reconstruir campos estructurados y quedan afuera por ahora.
function applyBodyUpdate(current: RequestBody, update: PmRequestBodyUpdate): RequestBody {
  const mode = update.mode ?? 'raw';
  if (mode !== 'raw' || update.raw === undefined) return current;

  const type: BodyType = update.options?.raw?.language === 'json' ? 'json' : 'text';
  return { ...current, type, content: update.raw };
}
