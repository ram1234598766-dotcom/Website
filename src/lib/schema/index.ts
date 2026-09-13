/**
 * VantaOS Schema Validation — lightweight, dependency-free runtime
 * validation with TypeScript type inference.
 *
 * Provides a composable schema definition API that validates at runtime
 * and produces clear error messages. Used to enforce contracts between
 * workspace operations, model manifests, sync batches, plugin manifests,
 * and API responses.
 */

export type ValidationError = {
  path: string;
  message: string;
};

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: ValidationError[] };

export interface Schema<T> {
  validate(raw: unknown): ValidationResult<T>;
}

function makeError(path: string, message: string): ValidationError {
  return { path, message };
}

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

// ─── Primitives ──────────────────────────────────────────────────────

export function str(opts?: { required?: boolean; minLength?: number; maxLength?: number; pattern?: RegExp; enum?: string[] }): Schema<string> {
  return {
    validate(raw) {
      if (raw === undefined || raw === null) {
        if (opts?.required === false) return { ok: true, value: raw as any };
        return { ok: false, errors: [makeError('', `Expected string, got ${typeof raw}`)] };
      }
      const errors: ValidationError[] = [];
      if (typeof raw !== 'string') {
        errors.push(makeError('', `Expected string, got ${typeof raw}`));
        return { ok: false, value: raw, errors };
      }
      if (opts?.minLength !== undefined && raw.length < opts.minLength) {
        errors.push(makeError('', `String too short (min ${opts.minLength}, got ${raw.length})`));
      }
      if (opts?.maxLength !== undefined && raw.length > opts.maxLength) {
        errors.push(makeError('', `String too long (max ${opts.maxLength}, got ${raw.length})`));
      }
      if (opts?.pattern && !opts.pattern.test(raw)) {
        errors.push(makeError('', `String does not match pattern ${opts.pattern}`));
      }
      if (opts?.enum && !opts.enum.includes(raw)) {
        errors.push(makeError('', `Value not in allowed set: ${opts.enum.join(', ')}`));
      }
      return { ok: errors.length === 0, value: raw, errors: errors.length > 0 ? errors : undefined } as ValidationResult<string>;
    },
  };
}

export function number(opts?: { required?: boolean; min?: number; max?: number; integer?: boolean }): Schema<number> {
  return {
    validate(raw) {
      const errors: ValidationError[] = [];
      if (typeof raw !== 'number' || Number.isNaN(raw)) {
        if (opts?.required !== false) errors.push(makeError('', `Expected number, got ${typeof raw}`));
        return { ok: false, errors };
      }
      if (opts?.min !== undefined && raw < opts.min) errors.push(makeError('', `Number below minimum ${opts.min}`));
      if (opts?.max !== undefined && raw > opts.max) errors.push(makeError('', `Number above maximum ${opts.max}`));
      if (opts?.integer && !Number.isInteger(raw)) errors.push(makeError('', `Expected integer, got ${raw}`));
      return { ok: errors.length === 0, value: raw, errors: errors.length > 0 ? errors : undefined } as ValidationResult<number>;
    },
  };
}

export function boolean(): Schema<boolean> {
  return {
    validate(raw) {
      if (typeof raw !== 'boolean') return { ok: false, errors: [makeError('', `Expected boolean, got ${typeof raw}`)] };
      return { ok: true, value: raw };
    },
  };
}

// ─── Composites ──────────────────────────────────────────────────────

export function object<T extends Record<string, Schema<any>>>(shape: T): Schema<{ [K in keyof T]: T[K] extends Schema<infer V> ? V : never }> {
  return {
    validate(raw) {
      if (!isObject(raw)) return { ok: false, errors: [makeError('', `Expected object, got ${typeof raw}`)] };
      const result: Record<string, unknown> = {};
      const errors: ValidationError[] = [];
      for (const key of Object.keys(shape)) {
        const schema = shape[key];
        const res = schema.validate(raw[key]);
        if (res.ok) {
          result[key] = res.value;
        } else {
          for (const e of (res as { ok: false; errors: ValidationError[] }).errors ?? []) {
            errors.push(makeError(key ? `${key}.${e.path}` : key, e.message));
          }
        }
      }
      return { ok: errors.length === 0, value: result as any, errors: errors.length > 0 ? errors : undefined } as any;
    },
  };
}

export function array<ItemSchema extends Schema<any>>(itemSchema: ItemSchema): Schema<{ [K in keyof ItemSchema]: ItemSchema extends Schema<infer V> ? V : never }[]> {
  return {
    validate(raw) {
      if (!Array.isArray(raw)) return { ok: false, errors: [makeError('', `Expected array, got ${typeof raw}`)] };
      const result: unknown[] = [];
      const errors: ValidationError[] = [];
      raw.forEach((item, index) => {
        const res = itemSchema.validate(item);
        if (res.ok) {
          result.push(res.value);
        } else {
          for (const e of (res as { ok: false; errors: ValidationError[] }).errors ?? []) {
            errors.push(makeError(`[${index}].${e.path}`, e.message));
          }
        }
      });
      return { ok: errors.length === 0, value: result as any, errors: errors.length > 0 ? errors : undefined } as any;
    },
  };
}

export function nullable<T>(schema: Schema<T>): Schema<T | null> {
  return {
    validate(raw) {
      if (raw === null) return { ok: true, value: null };
      return schema.validate(raw);
    },
  };
}

export function union<T extends Schema<any>[]>(...schemas: T): Schema<T[number] extends Schema<infer V> ? V : never> {
  return {
    validate(raw) {
      const errors: ValidationError[] = [];
      for (const schema of schemas) {
        const res = schema.validate(raw);
        if (res.ok) return res;
        errors.push(...(res as { ok: false; errors: ValidationError[] }).errors ?? []);
      }
      return { ok: false, errors };
    },
  };
}

export function literal<V extends string | number | boolean>(value: V): Schema<V> {
  return {
    validate(raw) {
      if (raw !== value) return { ok: false, errors: [makeError('', `Expected ${JSON.stringify(value)}, got ${JSON.stringify(raw)}`)] };
      return { ok: true, value };
    },
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────

export function validate<T>(schema: Schema<T>, raw: unknown, context = ''): ValidationResult<T> {
  const result = schema.validate(raw);
  if (!result.ok) {
    for (const e of (result as { ok: false; errors: ValidationError[] }).errors) {
      e.path = context ? `${context}.${e.path}` : e.path;
    }
  }
  return result;
}

export function assert<T>(schema: Schema<T>, raw: unknown, context = ''): asserts raw is T {
  const result = validate(schema, raw, context);
  if (!result.ok) {
    const messages = (result as { ok: false; errors: ValidationError[] }).errors.map((e) => `${e.path}: ${e.message}`).join('; ');
    throw new Error(`Schema validation failed: ${messages}`);
  }
}
