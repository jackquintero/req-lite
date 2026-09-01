export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export interface KeyValueParam {
  key: string;
  value: string;
  enabled: boolean;
}

export type BodyType = 'none' | 'json' | 'text' | 'form-urlencoded' | 'form-data';

export interface FormDataField {
  id: string;
  key: string;
  type: 'text' | 'file';
  /** Para type 'text': el valor. Para type 'file': el nombre de archivo (solo display, no el contenido). */
  value: string;
  enabled: boolean;
}

export interface RequestBody {
  type: BodyType;
  content: string;
  formData: FormDataField[];
}

export interface ApiRequest {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  queryParams: KeyValueParam[];
  headers: KeyValueParam[];
  body: RequestBody;
  preRequestScript: string;
  postResponseScript: string;
  collectionId?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Completa campos que puedan faltar en un ApiRequest persistido con una versión anterior del
 * modelo (ej. guardado antes de que existiera `body.formData` o `postResponseScript`), para que
 * abrir requests viejos desde una colección o un backup no rompa la UI.
 */
export function normalizeRequest(request: ApiRequest): ApiRequest {
  return {
    ...request,
    queryParams: request.queryParams ?? [],
    headers: request.headers ?? [],
    preRequestScript: request.preRequestScript ?? '',
    postResponseScript: request.postResponseScript ?? '',
    body: {
      type: request.body?.type ?? 'none',
      content: request.body?.content ?? '',
      formData: request.body?.formData ?? [],
    },
  };
}
