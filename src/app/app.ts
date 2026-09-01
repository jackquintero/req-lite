import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { EnvironmentManager } from './features/environment-manager/environment-manager';
import { RequestBuilder } from './features/request-builder/request-builder';
import { SidebarCollections } from './features/sidebar-collections/sidebar-collections';
import { TabsBar } from './features/tabs-bar/tabs-bar';
import { TabsStore } from './core/stores/tabs.store';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SidebarCollections, EnvironmentManager, TabsBar, RequestBuilder],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  private readonly tabsStore = inject(TabsStore);

  constructor() {
    if (this.tabsStore.tabs().length === 0) {
      this.tabsStore.openTab();
    }
  }
}
