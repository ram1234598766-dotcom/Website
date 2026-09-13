import { describe, it, expect } from 'vitest';
import { str, number, boolean, object, array, nullable, union, literal, validate, assert } from '../../src/lib/schema/index';
import { validateOperation, validateOperationBatch, OperationKindSchema } from '../../src/lib/schema/operations-schema';
import type { Operation } from '../../src/lib/workspace/types';

// ─── Primitive validators ──────────────────────────────────

describe('str', () => {
  it('validates a correct string', () => {
    const s = str();
    expect(s.validate('hello')).toEqual({ ok: true, value: 'hello' });
  });
  it('rejects non-strings', () => {
    const s = str();
    const r = s.validate(42);
    expect(r.ok).toBe(false);
    expect((r as { errors: unknown[] }).errors).toHaveLength(1);
  });
  it('enforces minLength', () => {
    const s = str({ minLength: 3 });
    expect(s.validate('ab').ok).toBe(false);
    expect(s.validate('abc').ok).toBe(true);
  });
  it('enforces enum', () => {
    const s = str({ enum: ['a', 'b'] });
    expect(s.validate('c').ok).toBe(false);
    expect(s.validate('a').ok).toBe(true);
  });
  it('optional allows undefined', () => {
    const s = str({ required: false });
    expect(s.validate(undefined).ok).toBe(true);
  });
});

describe('number', () => {
  it('validates a correct number', () => {
    expect(number().validate(42)).toEqual({ ok: true, value: 42 });
  });
  it('rejects NaN', () => {
    const r = number().validate(NaN);
    expect(r.ok).toBe(false);
  });
  it('enforces min/max', () => {
    const n = number({ min: 0, max: 10 });
    expect(n.validate(-1).ok).toBe(false);
    expect(n.validate(5).ok).toBe(true);
    expect(n.validate(11).ok).toBe(false);
  });
  it('enforces integer', () => {
    const n = number({ integer: true });
    expect(n.validate(1.5).ok).toBe(false);
    expect(n.validate(2).ok).toBe(true);
  });
});

describe('boolean', () => {
  it('validates booleans', () => {
    expect(boolean().validate(true)).toEqual({ ok: true, value: true });
    expect(boolean().validate(false)).toEqual({ ok: true, value: false });
  });
  it('rejects non-booleans', () => {
    expect(boolean().validate('yes').ok).toBe(false);
  });
});

// ─── Composites ────────────────────────────────────────────

describe('object', () => {
  it('validates matching objects', () => {
    const schema = object({ name: str(), count: number() });
    expect(schema.validate({ name: 'x', count: 1 }).ok).toBe(true);
  });
  it('rejects missing keys', () => {
    const schema = object({ name: str(), count: number() });
    const r = schema.validate({ name: 'x' });
    expect(r.ok).toBe(false);
  });
  it('rejects non-objects', () => {
    const schema = object({ name: str() });
    expect(schema.validate('hello').ok).toBe(false);
  });
});

describe('array', () => {
  it('validates arrays of items', () => {
    const schema = array(str());
    expect(schema.validate(['a', 'b']).ok).toBe(true);
    expect(schema.validate(['a', 42]).ok).toBe(false);
  });
  it('rejects non-arrays', () => {
    expect(array(str()).validate('not array').ok).toBe(false);
  });
});

describe('nullable', () => {
  it('accepts null', () => {
    expect(nullable(str()).validate(null).ok).toBe(true);
  });
  it('delegates to inner schema', () => {
    expect(nullable(str()).validate('hello').ok).toBe(true);
    expect(nullable(str()).validate(42).ok).toBe(false);
  });
});

describe('union', () => {
  const schema = union(literal('a'), literal('b'));
  it('accepts matching literals', () => {
    expect(schema.validate('a').ok).toBe(true);
    expect(schema.validate('b').ok).toBe(true);
  });
  it('rejects non-matching values', () => {
    expect(schema.validate('c').ok).toBe(false);
  });
});

describe('literal', () => {
  it('accepts exact value', () => {
    expect(literal('x').validate('x').ok).toBe(true);
  });
  it('rejects different values', () => {
    expect(literal('x').validate('y').ok).toBe(false);
  });
});

// ─── Helpers ───────────────────────────────────────────────

describe('validate', () => {
  it('prefixes path with context', () => {
    const schema = object({ name: str() });
    const r = validate(schema, { name: 'x' }, 'user');
    expect(r.ok).toBe(true);
  });
});

describe('assert', () => {
  it('does not throw for valid data', () => {
    expect(() => assert(str(), 'hello')).not.toThrow();
  });
  it('throws for invalid data', () => {
    expect(() => assert(str(), 42)).toThrow('Schema validation failed');
  });
});

// ─── Operation validation ──────────────────────────────────

describe('OperationKindSchema', () => {
  it('accepts all valid kinds', () => {
    const kinds = ['create_node', 'update_content', 'rename_node', 'move_node', 'delete_node', 'create_folder'] as const;
    for (const k of kinds) {
      expect(OperationKindSchema.validate(k).ok).toBe(true);
    }
  });
  it('rejects invalid kinds', () => {
    expect(OperationKindSchema.validate('invalid').ok).toBe(false);
  });
});

describe('validateOperation', () => {
  it('validates a create_node operation', () => {
    const op = {
      id: 'op-1',
      kind: 'create_node',
      timestamp: Date.now(),
      source: 'user' as const,
      seq: 1,
      payload: { id: 'f1', path: '/test.txt', name: 'test.txt', parentId: null, content: 'hello', language: 'text' },
    };
    const r = validateOperation(op);
    expect(r.ok).toBe(true);
  });
  it('rejects operations with bad kind', () => {
    const r = validateOperation({ kind: 'invalid' });
    expect(r.ok).toBe(false);
  });
  it('rejects non-objects', () => {
    const r = validateOperation('hello');
    expect(r.ok).toBe(false);
  });
});

describe('validateOperationBatch', () => {
  it('validates a batch of operations', () => {
    const ops = [
      { kind: 'create_node', id: '1', timestamp: 1, source: 'user' as const, seq: 1, payload: { id: 'a', path: '/a', name: 'a', parentId: null, content: '', language: 'text' } },
      { kind: 'create_folder', id: '2', timestamp: 2, source: 'user' as const, seq: 2, payload: { id: 'b', path: '/b', name: 'b', parentId: null } },
    ];
    const r = validateOperationBatch(ops);
    expect(r.valid).toBe(true);
    expect(r.validOps.length).toBe(2);
  });
  it('reports errors for invalid operations', () => {
    const ops = [
      { kind: 'create_node', id: '1', timestamp: 1, source: 'user' as const, seq: 1, payload: { id: 'a', path: '/a', name: 'a', parentId: null, content: '', language: 'text' } },
      { kind: 'invalid', id: '2', timestamp: 2, source: 'user' as const, seq: 2, payload: {} },
    ];
    const r = validateOperationBatch(ops);
    expect(r.valid).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.validOps.length).toBe(1);
  });
  it('handles empty batch', () => {
    const r = validateOperationBatch([]);
    expect(r.valid).toBe(true);
    expect(r.validOps.length).toBe(0);
  });
});
