import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { EnvironmentsStore } from '../../core/stores/environments.store';
import { EnvironmentVariable } from '../../core/models/environment.model';
import { KeyValueEditor } from '../../shared/ui/key-value-editor/key-value-editor';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [KeyValueEditor],
  selector: 'app-environment-manager',
  styleUrl: './environment-manager.scss',
  templateUrl: './environment-manager.html',
})
export class EnvironmentManager {
  private readonly environmentsStore = inject(EnvironmentsStore);

  protected readonly environments = this.environmentsStore.environments;
  protected readonly activeEnvironmentId = this.environmentsStore.activeEnvironmentId;
  protected readonly activeEnvironment = this.environmentsStore.activeEnvironment;
  protected readonly expanded = signal(false);

  onSelectEnvironment(environmentId: string): void {
    this.environmentsStore.setActiveEnvironment(environmentId || null);
  }

  toggleExpanded(): void {
    this.expanded.update((value) => !value);
  }

  createEnvironment(): void {
    const name = window.prompt('Nombre del nuevo entorno:', 'Local');
    if (!name) return;
    const environment = this.environmentsStore.createEnvironment(name);
    this.environmentsStore.setActiveEnvironment(environment.id);
    this.expanded.set(true);
  }

  renameActive(): void {
    const environment = this.activeEnvironment();
    if (!environment) return;
    const name = window.prompt('Nuevo nombre del entorno:', environment.name);
    if (!name) return;
    this.environmentsStore.renameEnvironment(environment.id, name);
  }

  deleteActive(): void {
    const environment = this.activeEnvironment();
    if (!environment) return;
    if (!window.confirm(`¿Borrar el entorno "${environment.name}"?`)) return;
    this.environmentsStore.deleteEnvironment(environment.id);
  }

  onVariablesChange(variables: EnvironmentVariable[]): void {
    const environment = this.activeEnvironment();
    if (!environment) return;
    this.environmentsStore.updateVariables(environment.id, variables);
  }
}
