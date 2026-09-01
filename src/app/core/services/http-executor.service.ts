import { Injectable } from '@angular/core';
import { HttpMethod } from '../models/request.model';
import { ApiResponse } from '../models/response.model';

export interface ResolvedRequest {
  method: HttpMethod;
  url: string;
  headers: Record<string, string>;
  body?: string | FormData;
}

export class RequestExecutionError extends Error {}

@Injectable({ providedIn: 'root' })
export class HttpExecutorService {
  async execute(request: ResolvedRequest, signal?: AbortSignal): Promise<ApiResponse> {
    const startedAt = performance.now();
    const hasBody = request.method !== 'GET' && request.method !== 'HEAD';

    let rawResponse: Response;
    try {
      rawResponse = await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: hasBody ? request.body : undefined,
        signal,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new RequestExecutionError('Request cancelado.');
      }
      const detail = error instanceof Error ? error.message : String(error);
      throw new RequestExecutionError(
        `No se pudo completar el request (${detail}). Verificá la URL, que el servidor esté ` +
          'corriendo, y que tenga CORS habilitado si es un backend distinto.',
      );
    }

    const durationMs = performance.now() - startedAt;
    const body = await rawResponse.text();
    const headers: Record<string, string> = {};
    rawResponse.headers.forEach((value, key) => {
      headers[key] = value;
    });

    return {
      status: rawResponse.status,
      statusText: rawResponse.statusText,
      headers,
      body,
      bodySize: new Blob([body]).size,
      durationMs: Math.round(durationMs),
      receivedAt: Date.now(),
    };
  }
}
