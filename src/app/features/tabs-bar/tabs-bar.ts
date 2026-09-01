import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TabsStore } from '../../core/stores/tabs.store';
import { RequestTab } from '../../core/models/tab.model';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  selector: 'app-tabs-bar',
  styleUrl: './tabs-bar.scss',
  templateUrl: './tabs-bar.html',
})
export class TabsBar {
  private readonly tabsStore = inject(TabsStore);

  protected readonly tabs = this.tabsStore.tabs;
  protected readonly activeTabId = this.tabsStore.activeTabId;

  selectTab(tabId: string): void {
    this.tabsStore.setActiveTab(tabId);
  }

  closeTab(event: MouseEvent, tabId: string): void {
    event.stopPropagation();
    this.tabsStore.closeTab(tabId);
  }

  addTab(): void {
    this.tabsStore.openTab();
  }

  // Un request guardado en una colección muestra su nombre; un draft nuevo sin guardar
  // todavía muestra la URL que se está tipeando (más útil que "Untitled request").
  tabLabel(tab: RequestTab): string {
    return tab.requestId ? tab.draft.name : tab.draft.url || tab.draft.name;
  }
}
