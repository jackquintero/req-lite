import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Environment, EnvironmentVariable } from '../models/environment.model';
import { StorageService } from '../services/storage.service';
import { generateId } from '../../shared/utils/id.util';
import { upsertById } from '../../shared/utils/upsert.util';

@Injectable({ providedIn: 'root' })
export class EnvironmentsStore {
  private readonly storage = inject(StorageService);

  private readonly environmentsSignal = signal<Environment[]>([]);
  private readonly activeEnvironmentIdSignal = signal<string | null>(null);
  private readonly hydrated = signal(false);

  readonly environments = this.environmentsSignal.asReadonly();
  readonly activeEnvironmentId = this.activeEnvironmentIdSignal.asReadonly();

  readonly activeEnvironment = computed(
    () => this.environmentsSignal().find((env) => env.id === this.activeEnvironmentIdSignal()) ?? null,
  );

  readonly activeVariables = computed<Record<string, string>>(() => {
    const env = this.activeEnvironment();
    if (!env) return {};
    const variables: Record<string, string> = {};
    for (const variable of env.variables) {
      if (variable.enabled && variable.key) variables[variable.key] = variable.value;
    }
    return variables;
  });

  constructor() {
    effect(() => {
      const environments = this.environmentsSignal();
      if (!this.hydrated()) return;
      void this.storage.saveEnvironments(environments);
    });

    effect(() => {
      const activeId = this.activeEnvironmentIdSignal();
      if (!this.hydrated()) return;
      void this.storage.saveActiveEnvironmentId(activeId);
    });

    void this.hydrate();
  }

  setActiveEnvironment(environmentId: string | null): void {
    this.activeEnvironmentIdSignal.set(environmentId);
  }

  createEnvironment(name: string): Environment {
    const now = Date.now();
    const environment: Environment = { id: generateId(), name, variables: [], createdAt: now, updatedAt: now };
    this.environmentsSignal.update((envs) => [...envs, environment]);
    return environment;
  }

  renameEnvironment(environmentId: string, name: string): void {
    this.patchEnvironment(environmentId, (env) => ({ ...env, name, updatedAt: Date.now() }));
  }

  updateVariables(environmentId: string, variables: EnvironmentVariable[]): void {
    this.patchEnvironment(environmentId, (env) => ({ ...env, variables, updatedAt: Date.now() }));
  }

  deleteEnvironment(environmentId: string): void {
    this.environmentsSignal.update((envs) => envs.filter((env) => env.id !== environmentId));
    if (this.activeEnvironmentIdSignal() === environmentId) {
      this.activeEnvironmentIdSignal.set(null);
    }
  }

  mergeEnvironments(environments: Environment[]): void {
    this.environmentsSignal.update((existing) => upsertById(existing, environments));
  }

  /** Crea o actualiza una variable por su key. Usado por los scripts post-response. */
  setVariableValue(environmentId: string, key: string, value: string): void {
    this.patchEnvironment(environmentId, (env) => {
      const index = env.variables.findIndex((v) => v.key === key);
      const variables =
        index >= 0
          ? env.variables.map((v, i) => (i === index ? { ...v, value } : v))
          : [...env.variables, { key, value, enabled: true }];
      return { ...env, variables, updatedAt: Date.now() };
    });
  }

  unsetVariable(environmentId: string, key: string): void {
    this.patchEnvironment(environmentId, (env) => ({
      ...env,
      variables: env.variables.filter((v) => v.key !== key),
      updatedAt: Date.now(),
    }));
  }

  private patchEnvironment(environmentId: string, updater: (env: Environment) => Environment): void {
    this.environmentsSignal.update((envs) =>
      envs.map((env) => (env.id === environmentId ? updater(env) : env)),
    );
  }

  private async hydrate(): Promise<void> {
    const [environments, activeId] = await Promise.all([
      this.storage.loadEnvironments(),
      this.storage.loadActiveEnvironmentId(),
    ]);
    if (environments) this.environmentsSignal.set(environments);
    if (activeId) this.activeEnvironmentIdSignal.set(activeId);
    this.hydrated.set(true);
  }
}
