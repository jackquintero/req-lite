import { ChangeDetectionStrategy, Component, ElementRef, input, output, viewChild } from '@angular/core';
import { JsonHighlightPipe } from '../../pipes/json-highlight-pipe';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [JsonHighlightPipe],
  selector: 'app-code-editor',
  styleUrl: './code-editor.scss',
  templateUrl: './code-editor.html',
})
export class CodeEditor {
  readonly value = input.required<string>();
  readonly rows = input(8);
  readonly valueChange = output<string>();

  private readonly highlightLayer = viewChild.required<ElementRef<HTMLElement>>('highlightLayer');

  onInput(event: Event): void {
    this.valueChange.emit((event.target as HTMLTextAreaElement).value);
  }

  onScroll(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    const pre = this.highlightLayer().nativeElement;
    pre.scrollTop = textarea.scrollTop;
    pre.scrollLeft = textarea.scrollLeft;
  }
}
