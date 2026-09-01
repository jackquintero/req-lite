import { Injectable, inject } from '@angular/core';
import { ApiRequest, BodyType } from '../models/request.model';
import { appendQueryParams } from '../../shared/utils/url.util';
import { ResolvedRequest } from './http-executor.service';
import { FileAttachmentService } from './file-attachment.service';

const VARIABLE_PATTERN = /\{\{\s*([\w.-]+)\s*\}\}/g;

// 'form-data' queda afuera a propósito: el navegador arma el Content-Type con el boundary
// correcto solo cuando el body es un FormData sin ese header seteado manualmente.
const DEFAULT_CONTENT_TYPE: Partial<Record<BodyType, string>> = {
  json: 'application/json',
  text: 'text/plain',
  'form-urlencoded': 'application/x-www-form-urlencoded',
};

@Injectable({ providedIn: 'root' })
export class VariableInterpolationService {
  private readonly fileAttachments = inject(FileAttachmentService);

  interpolate(text: string, variables: Record<string, string>): string {
    return text.replace(VARIABLE_PATTERN, (match, key) => (key in variables ? variables[key] : match));
  }

  resolveRequest(request: ApiRequest, variables: Record<string, string>): ResolvedRequest {
    const url = appendQueryParams(
      this.interpolate(request.url, variables),
      request.queryParams
        .filter((param) => param.enabled && param.key)
        .map((param) => ({
          key: this.interpolate(param.key, variables),
          value: this.interpolate(param.value, variables),
        })),
    );

    const headers: Record<string, string> = {};
    for (const header of request.headers) {
      if (!header.enabled || !header.key) continue;
      headers[this.interpolate(header.key, variables)] = this.interpolate(header.value, variables);
    }

    const body = this.resolveBody(request.body, variables);

    if (request.body.type === 'form-data') {
      // El boundary lo genera el navegador al armar el FormData; un Content-Type puesto a mano
      // (sin ese boundary) rompe el parseo multipart del backend, así que lo descartamos siempre.
      for (const key of Object.keys(headers)) {
        if (key.toLowerCase() === 'content-type') delete headers[key];
      }
    } else {
      const defaultContentType = DEFAULT_CONTENT_TYPE[request.body.type];
      const hasContentType = Object.keys(headers).some((key) => key.toLowerCase() === 'content-type');
      if (defaultContentType && !hasContentType) {
        headers['Content-Type'] = defaultContentType;
      }
    }

    return { method: request.method, url, headers, body };
  }

  private resolveBody(
    body: ApiRequest['body'],
    variables: Record<string, string>,
  ): string | FormData | undefined {
    if (body.type === 'none') return undefined;

    if (body.type === 'form-data') {
      const formData = new FormData();
      for (const field of body.formData) {
        if (!field.enabled || !field.key) continue;
        const key = this.interpolate(field.key, variables);

        if (field.type === 'text') {
          formData.append(key, this.interpolate(field.value, variables));
        } else {
          const file = this.fileAttachments.getFile(field.id);
          if (file) formData.append(key, file, file.name);
        }
      }
      return formData;
    }

    return this.interpolate(body.content, variables);
  }
}
