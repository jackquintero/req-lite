import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { KeyValueParam } from '../../../core/models/request.model';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  selector: 'app-key-value-editor',
  styleUrl: './key-value-editor.scss',
  templateUrl: './key-value-editor.html',
})
export class KeyValueEditor {
  readonly rows = input.required<KeyValueParam[]>();
  readonly keyPlaceholder = input('Key');
  readonly valuePlaceholder = input('Value');

  readonly rowsChange = output<KeyValueParam[]>();

  addRow(): void {
    this.rowsChange.emit([...this.currentRows(), { key: '', value: '', enabled: true }]);
  }

  removeRow(index: number): void {
    this.rowsChange.emit(this.currentRows().filter((_, i) => i !== index));
  }

  toggleRow(index: number, enabled: boolean): void {
    this.patchRow(index, { enabled });
  }

  updateKey(index: number, key: string): void {
    this.patchRow(index, { key });
  }

  updateValue(index: number, value: string): void {
    this.patchRow(index, { value });
  }

  private patchRow(index: number, changes: Partial<KeyValueParam>): void {
    this.rowsChange.emit(this.currentRows().map((row, i) => (i === index ? { ...row, ...changes } : row)));
  }

  // Defensa extra ante un `ApiRequest` persistido con una versión anterior del modelo.
  private currentRows(): KeyValueParam[] {
    return this.rows() ?? [];
  }
}
