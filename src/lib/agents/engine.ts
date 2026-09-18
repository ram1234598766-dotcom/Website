type AgentStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface SubAgentTask {
  id: string;
  prompt: string;
  label: string;
  status: AgentStatus;
  result?: string;
  error?: string;
  startedAt?: number;
  completedAt?: number;
}

interface SubAgentResult {
  taskId: string;
  result: string;
  error?: string;
}

type TaskFn = (signal: AbortSignal) => Promise<string>;

export class SubAgentEngine {
  private tasks: Map<string, SubAgentTask> = new Map();
  private listeners: Set<(tasks: SubAgentTask[]) => void> = new Set();
  private running = false;

  subscribe(fn: (tasks: SubAgentTask[]) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    const tasks = [...this.tasks.values()];
    this.listeners.forEach((fn) => fn(tasks));
  }

  async fanout(
    tasks: { prompt: string; label: string; taskFn: TaskFn }[],
    onProgress?: (task: SubAgentTask) => void
  ): Promise<SubAgentTask[]> {
    const taskIds: string[] = [];

    this.running = true;

    const taskFnMap = new Map<string, TaskFn>();
    tasks.forEach((input) => {
      const id = `agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      taskFnMap.set(id, input.taskFn);
      this.tasks.set(id, {
        id,
        prompt: input.prompt,
        label: input.label,
        status: 'pending',
      });
      taskIds.push(id);
    });

    const promises = taskIds.map(async (id) => {
      const task = this.tasks.get(id)!;
      task.status = 'running';
      task.startedAt = Date.now();
      this.notify();
      onProgress?.(task);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60_000);

      try {
        const result = await taskFnMap.get(id)!(controller.signal);
        clearTimeout(timeout);
        task.status = 'completed';
        task.result = result;
        task.completedAt = Date.now();
      } catch (err: any) {
        clearTimeout(timeout);
        if (err.name === 'AbortError') {
          task.status = 'cancelled';
        } else {
          task.status = 'failed';
          task.error = err.message || 'Unknown error';
        }
        task.completedAt = Date.now();
      }
      this.notify();
      onProgress?.(task);
    });

    await Promise.allSettled(promises);
    this.running = false;
    return [...this.tasks.values()];
  }

  getTasks(): SubAgentTask[] {
    return [...this.tasks.values()];
  }

  getTask(id: string): SubAgentTask | undefined {
    return this.tasks.get(id);
  }

  cancel(id: string): void {
    const task = this.tasks.get(id);
    if (task && task.status === 'running') {
      task.status = 'cancelled';
      task.completedAt = Date.now();
      this.notify();
    }
  }

  clear(): void {
    this.tasks.clear();
    this.notify();
  }

  isRunning(): boolean {
    return this.running;
  }
}

export const agentEngine = new SubAgentEngine();
