import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TabsStore } from '../../core/stores/tabs.store';
import { JsonHighlightPipe } from '../../shared/pipes/json-highlight-pipe';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [JsonHighlightPipe],
  selector: 'app-response-viewer',
  styleUrl: './response-viewer.scss',
  templateUrl: './response-viewer.html',
})
export class ResponseViewer {
  private readonly tabsStore = inject(TabsStore);

  protected readonly activeTab = this.tabsStore.activeTab;

  protected readonly headerEntries = computed(() => {
    const response = this.activeTab()?.response;
    return response ? Object.entries(response.headers) : [];
  });
}
