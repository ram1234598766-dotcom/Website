import { agentEngine, type SubAgentTask } from './engine';

type TaskFn = (signal: AbortSignal) => Promise<string>;

const FOCUS_LABELS = [
  'Analyze',
  'Implement',
  'Review',
  'Test',
  'Document',
  'Optimize',
  'Refactor',
  'Debug',
];

export interface SubTaskInput {
  prompt: string;
  label: string;
  taskFn: TaskFn;
}

export interface DispatcherResult {
  tasks: SubAgentTask[];
  summary: string;
  aggregatedResults: string[];
}

function generateTaskFn(label: string): TaskFn {
  return async (signal: AbortSignal) => {
    await new Promise<void>((resolve, reject) => {
      const delay = 2000 + Math.random() * 3000;
      const timer = setTimeout(() => resolve(), delay);
      signal.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      });
    });
    return `[${label}] Result: task completed — output ready for aggregation.`;
  };
}

export function splitIntoTasks(userPrompt: string, parallelism: number): SubTaskInput[] {
  const count = Math.min(Math.max(parallelism, 1), 8);
  const tasks: SubTaskInput[] = [];
  for (let i = 0; i < count; i++) {
    const label = FOCUS_LABELS[i % FOCUS_LABELS.length];
    tasks.push({
      prompt: `${userPrompt} — ${label}: find bugs, issues, and risks`,
      label,
      taskFn: generateTaskFn(label),
    });
  }
  return tasks;
}

export async function runWithTimeout(
  tasks: SubTaskInput[],
  timeoutMs: number = 30_000,
): Promise<SubAgentTask[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const engine = agentEngine;
    const result = await engine.fanout(tasks, () => {});
    clearTimeout(timeoutId);
    return result;
  } catch {
    clearTimeout(timeoutId);
    throw new Error('SubAgent fanout timed out or failed');
  }
}

export function aggregateResults(tasks: SubAgentTask[]): DispatcherResult {
  const completed = tasks.filter((t) => t.status === 'completed');
  const results = completed.map((t) => t.result ?? t.error ?? 'No result');
  const summary = `${completed.length}/${tasks.length} agents completed. ${tasks.filter((t) => t.status === 'failed').length} failed, ${tasks.filter((t) => t.status === 'cancelled').length} cancelled.`;
  return { tasks, summary, aggregatedResults: results };
}

export { agentEngine };
