import { Injectable } from '@angular/core';
import { Collection } from '../models/collection.model';
import { Environment, EnvironmentVariable } from '../models/environment.model';
import { ApiRequest, BodyType, FormDataField, HttpMethod, KeyValueParam } from '../models/request.model';
import { generateId } from '../../shared/utils/id.util';

interface PostmanKeyValue {
  key: string;
  value?: string;
  disabled?: boolean;
}

interface PostmanFormDataEntry {
  key: string;
  value?: string;
  type?: 'text' | 'file';
  src?: string;
  disabled?: boolean;
}

interface PostmanUrl {
  raw?: string;
  query?: PostmanKeyValue[];
}

interface PostmanBody {
  mode?: 'raw' | 'urlencoded' | 'formdata' | 'graphql' | 'file';
  raw?: string;
  options?: { raw?: { language?: string } };
  urlencoded?: PostmanKeyValue[];
  formdata?: PostmanFormDataEntry[];
}

interface PostmanRequest {
  method?: string;
  header?: PostmanKeyValue[];
  url?: PostmanUrl | string;
  body?: PostmanBody;
}

interface PostmanEvent {
  listen?: string;
  script?: { exec?: string[] | string };
}

interface PostmanItem {
  name?: string;
  item?: PostmanItem[];
  request?: PostmanRequest;
  event?: PostmanEvent[];
}

export interface PostmanCollection {
  info?: { name?: string; schema?: string };
  item?: PostmanItem[];
}

export interface PostmanEnvironment {
  name?: string;
  values?: { key: string; value?: string; enabled?: boolean }[];
}

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

export function isPostmanCollection(data: unknown): data is PostmanCollection {
  if (typeof data !== 'object' || data === null) return false;
  const candidate = data as Record<string, unknown>;
  const info = candidate['info'] as Record<string, unknown> | undefined;
  const schema = typeof info?.['schema'] === 'string' ? (info['schema'] as string) : '';
  return Array.isArray(candidate['item']) && schema.toLowerCase().includes('postman');
}

export function isPostmanEnvironment(data: unknown): data is PostmanEnvironment {
  if (typeof data !== 'object' || data === null) return false;
  const candidate = data as Record<string, unknown>;
  return Array.isArray(candidate['values']) && typeof candidate['name'] === 'string';
}

function toKeyValueParams(entries: PostmanKeyValue[] | undefined): KeyValueParam[] {
  return (entries ?? []).map((entry) => ({
    key: entry.key ?? '',
    value: entry.value ?? '',
    enabled: !entry.disabled,
  }));
}

function resolveUrlAndQueryParams(url: PostmanUrl | string | undefined): {
  url: string;
  queryParams: KeyValueParam[];
} {
  const raw = typeof url === 'string' ? url : (url?.raw ?? '');
  const [base, ...rest] = raw.split('?');

  const queryFromUrlObject = typeof url === 'object' ? toKeyValueParams(url.query) : [];
  if (queryFromUrlObject.length > 0) {
    return { url: base, queryParams: queryFromUrlObject };
  }

  // Algunos exports no traen el array `query` explícito: lo parseamos de la URL cruda.
  const queryString = rest.join('?');
  if (!queryString) return { url: base, queryParams: [] };

  const queryParams = queryString
    .split('&')
    .filter(Boolean)
    .map((pair) => {
      const [key, value = ''] = pair.split('=');
      return { key: decodeURIComponent(key), value: decodeURIComponent(value), enabled: true };
    });
  return { url: base, queryParams };
}

function resolveBody(body: PostmanBody | undefined): { type: BodyType; content: string; formData: FormDataField[] } {
  if (!body?.mode) return { type: 'none', content: '', formData: [] };

  switch (body.mode) {
    case 'raw': {
      const type: BodyType = body.options?.raw?.language === 'json' ? 'json' : 'text';
      return { type, content: body.raw ?? '', formData: [] };
    }
    case 'urlencoded': {
      const content = (body.urlencoded ?? [])
        .filter((entry) => !entry.disabled)
        .map((entry) => `${encodeURIComponent(entry.key)}=${encodeURIComponent(entry.value ?? '')}`)
        .join('&');
      return { type: 'form-urlencoded', content, formData: [] };
    }
    case 'formdata': {
      // Los campos tipo "file" solo traen el nombre como referencia: los navegadores no permiten
      // leer un archivo por ruta, así que hay que volver a elegirlo a mano al usar el request.
      const formData: FormDataField[] = (body.formdata ?? []).map((entry) => ({
        id: generateId(),
        key: entry.key ?? '',
        type: entry.type === 'file' ? 'file' : 'text',
        value: entry.type === 'file' ? (entry.src ?? '') : (entry.value ?? ''),
        enabled: !entry.disabled,
      }));
      return { type: 'form-data', content: '', formData };
    }
    default:
      return { type: 'none', content: '', formData: [] };
  }
}

function resolveScript(events: PostmanEvent[] | undefined, listen: 'test' | 'prerequest'): string {
  const event = (events ?? []).find((e) => e.listen === listen);
  const exec = event?.script?.exec;
  if (!exec) return '';
  return Array.isArray(exec) ? exec.join('\n') : exec;
}

function flattenItems(
  items: PostmanItem[],
  pathPrefix: string[] = [],
): { name: string; request: PostmanRequest; preRequestScript: string; postResponseScript: string }[] {
  const result: { name: string; request: PostmanRequest; preRequestScript: string; postResponseScript: string }[] = [];
  for (const item of items) {
    const name = item.name ?? 'Sin nombre';
    if (item.request) {
      result.push({
        name: [...pathPrefix, name].join(' / '),
        request: item.request,
        preRequestScript: resolveScript(item.event, 'prerequest'),
        postResponseScript: resolveScript(item.event, 'test'),
      });
    }
    if (item.item) {
      result.push(...flattenItems(item.item, [...pathPrefix, name]));
    }
  }
  return result;
}

@Injectable({ providedIn: 'root' })
export class PostmanImportService {
  convertCollection(data: PostmanCollection): { collection: Collection; requests: ApiRequest[] } {
    const now = Date.now();
    const collectionId = generateId();
    const flatItems = flattenItems(data.item ?? []);

    const requests: ApiRequest[] = flatItems.map(({ name, request, preRequestScript, postResponseScript }) => {
      const { url, queryParams } = resolveUrlAndQueryParams(request.url);
      const upperMethod = (request.method ?? 'GET').toUpperCase();
      const method = HTTP_METHODS.includes(upperMethod as HttpMethod) ? (upperMethod as HttpMethod) : 'GET';

      return {
        id: generateId(),
        name,
        method,
        url,
        queryParams,
        headers: toKeyValueParams(request.header),
        body: resolveBody(request.body),
        preRequestScript,
        postResponseScript,
        collectionId,
        createdAt: now,
        updatedAt: now,
      };
    });

    const collection: Collection = {
      id: collectionId,
      name: data.info?.name ?? 'Colección importada',
      requestIds: requests.map((r) => r.id),
      createdAt: now,
      updatedAt: now,
    };

    return { collection, requests };
  }

  convertEnvironment(data: PostmanEnvironment): Environment {
    const now = Date.now();
    const variables: EnvironmentVariable[] = (data.values ?? []).map((v) => ({
      key: v.key,
      value: v.value ?? '',
      enabled: v.enabled ?? true,
    }));

    return {
      id: generateId(),
      name: data.name ?? 'Entorno importado',
      variables,
      createdAt: now,
      updatedAt: now,
    };
  }
}
