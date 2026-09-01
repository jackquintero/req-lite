import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

const TOKEN_PATTERN =
  /("(\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\btrue\b|\bfalse\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function highlightJson(json: string): string {
  return escapeHtml(json).replace(TOKEN_PATTERN, (match) => {
    let cssClass = 'json-number';
    if (match.startsWith('"')) {
      cssClass = match.endsWith(':') ? 'json-key' : 'json-string';
    } else if (match === 'true' || match === 'false') {
      cssClass = 'json-boolean';
    } else if (match === 'null') {
      cssClass = 'json-null';
    }
    return `<span class="${cssClass}">${match}</span>`;
  });
}

@Pipe({
  name: 'jsonHighlight',
})
export class JsonHighlightPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  transform(rawBody: string): SafeHtml {
    try {
      const formatted = JSON.stringify(JSON.parse(rawBody), null, 2);
      return this.sanitizer.bypassSecurityTrustHtml(highlightJson(formatted));
    } catch {
      return this.sanitizer.bypassSecurityTrustHtml(escapeHtml(rawBody));
    }
  }
}
