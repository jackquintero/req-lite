import { Injectable } from '@angular/core';
import { ApiResponse } from '../models/response.model';

export interface VariableScope {
  get(key: string): string | undefined;
  set(key: string, value: string): void;
  unset(key: string): void;
}

interface PmHeaders {
  get(name: string): string | null;
}

interface PmResponse {
  code: number;
  status: string;
  headers: PmHeaders;
  json(): unknown;
  text(): string;
}

export interface PmRequestBodyUpdate {
  mode?: string;
  raw?: string;
  options?: { raw?: { language?: string } };
}

export interface PmRequestContext {
  method: string;
  url: { toString(): string };
  headers: { add(header: { key: string; value: string }): void };
  body: {
    mode: string;
    raw?: string;
    update(update: PmRequestBodyUpdate): void;
  };
}

let cryptoJsPromise: Promise<unknown> | null = null;

function loadCryptoJs(): Promise<unknown> {
  if (!cryptoJsPromise) {
    cryptoJsPromise = import('crypto-js').then((mod: unknown) => {
      const namespace = mod as { default?: unknown };
      return namespace.default ?? mod;
    });
  }
  return cryptoJsPromise;
}

/**
 * Shim mínimo de la API `pm.*` de Postman: response + request + variables. Alcanza para los
 * usos más comunes de "Pre-request Script"/"Tests" (armar el body, agregar headers, capturar
 * valores de la respuesta), pero no implementa pm.test(), pm.expect() ni pm.sendRequest().
 * `CryptoJS` se carga de forma perezosa (solo si un script lo referencia) para no sumarlo al
 * bundle principal de quienes no encriptan nada.
 */
@Injectable({ providedIn: 'root' })
export class ScriptRunnerService {
  run(script: string, response: ApiResponse, scope: VariableScope): void {
    const pmResponse: PmResponse = {
      code: response.status,
      status: response.statusText,
      headers: {
        get: (name: string) => {
          const key = Object.keys(response.headers).find((h) => h.toLowerCase() === name.toLowerCase());
          return key ? response.headers[key] : null;
        },
      },
      json: () => JSON.parse(response.body),
      text: () => response.body,
    };

    const pm = { response: pmResponse, environment: scope, variables: scope };

    // Solo se expone `pm` (igual que el sandbox real de Postman) para no chocar con nombres
    // que el propio script del usuario declare, p. ej. `const response = pm.response.json();`.
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
    const scriptFn = new Function('pm', script);
    scriptFn(pm);
  }

  async runPreRequest(script: string, request: PmRequestContext, scope: VariableScope): Promise<void> {
    const CryptoJS = await loadCryptoJs();
    const pm = { request, environment: scope, variables: scope };

    // Se envuelve en un IIFE async para soportar scripts que usen `await` (ej. crypto async).
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
    const scriptFn = new Function(
      'pm',
      'CryptoJS',
      `return (async () => {\n${script}\n})();`,
    );
    await scriptFn(pm, CryptoJS);
  }
}
