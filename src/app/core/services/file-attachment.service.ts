import { Injectable } from '@angular/core';

/**
 * Guarda los File reales elegidos en campos de body form-data, indexados por el id del campo.
 * Deliberadamente solo en memoria (nunca se persiste ni se exporta): los navegadores no permiten
 * releer un archivo por ruta, así que tras recargar la página hay que volver a seleccionarlo.
 */
@Injectable({ providedIn: 'root' })
export class FileAttachmentService {
  private readonly files = new Map<string, File>();

  setFile(fieldId: string, file: File): void {
    this.files.set(fieldId, file);
  }

  getFile(fieldId: string): File | undefined {
    return this.files.get(fieldId);
  }

  clearFile(fieldId: string): void {
    this.files.delete(fieldId);
  }
}
