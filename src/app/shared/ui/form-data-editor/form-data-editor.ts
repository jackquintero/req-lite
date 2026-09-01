import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { FormDataField } from '../../../core/models/request.model';
import { FileAttachmentService } from '../../../core/services/file-attachment.service';
import { generateId } from '../../utils/id.util';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  selector: 'app-form-data-editor',
  styleUrl: './form-data-editor.scss',
  templateUrl: './form-data-editor.html',
})
export class FormDataEditor {
  private readonly fileAttachments = inject(FileAttachmentService);

  readonly rows = input.required<FormDataField[]>();
  readonly rowsChange = output<FormDataField[]>();

  addRow(type: 'text' | 'file'): void {
    const field: FormDataField = { id: generateId(), key: '', type, value: '', enabled: true };
    this.rowsChange.emit([...this.currentRows(), field]);
  }

  removeRow(index: number): void {
    this.fileAttachments.clearFile(this.currentRows()[index].id);
    this.rowsChange.emit(this.currentRows().filter((_, i) => i !== index));
  }

  toggleRow(index: number, enabled: boolean): void {
    this.patchRow(index, { enabled });
  }

  updateKey(index: number, key: string): void {
    this.patchRow(index, { key });
  }

  updateTextValue(index: number, value: string): void {
    this.patchRow(index, { value });
  }

  onFileSelected(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.fileAttachments.setFile(this.currentRows()[index].id, file);
    this.patchRow(index, { value: file.name });
  }

  hasFile(fieldId: string): boolean {
    return this.fileAttachments.getFile(fieldId) !== undefined;
  }

  private patchRow(index: number, changes: Partial<FormDataField>): void {
    this.rowsChange.emit(this.currentRows().map((row, i) => (i === index ? { ...row, ...changes } : row)));
  }

  // Defensa extra: si llega un `ApiRequest` persistido con una versión anterior del modelo
  // (sin `body.formData`), no rompemos la UI aunque la normalización de arriba fallara.
  private currentRows(): FormDataField[] {
    return this.rows() ?? [];
  }
}
