/**
 * VantaOS Schema — workspace operation contracts.
 *
 * Validates operations before they enter the oplog. Used by
 * appendOp and bulkAppendOps to reject malformed operations
 * before persistence.
 */

import { literal, union, type Schema, type ValidationResult, type ValidationError } from './index';
import type { Operation, OperationKind, WorkspaceNode, CreateNodeOp, CreateFolderOp, UpdateContentOp, RenameNodeOp, MoveNodeOp, DeleteNodeOp } from '../workspace/types';

export const OperationKindSchema = union(
  literal('create_node'),
  literal('update_content'),
  literal('rename_node'),
  literal('move_node'),
  literal('delete_node'),
  literal('create_folder')
) as Schema<OperationKind>;

export function validateOperation(raw: unknown): ValidationResult<Operation> {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, errors: [{ path: '', message: 'Operation must be an object' }] };
  }
  const op = raw as Record<string, unknown>;
  if (typeof op.kind !== 'string') {
    return { ok: false, errors: [{ path: 'kind', message: 'Missing operation kind' }] };
  }
  const kindResult = OperationKindSchema.validate(op.kind);
  if (!kindResult.ok) return kindResult as ValidationResult<Operation>;
  return { ok: true, value: raw as Operation };
}

export function validateOperationBatch(ops: unknown[]): { valid: boolean; errors: ValidationError[]; validOps: Operation[] } {
  const errors: ValidationError[] = [];
  const validOps: Operation[] = [];
  for (let i = 0; i < ops.length; i++) {
    const result = validateOperation(ops[i]);
    if (result.ok) {
      validOps.push(result.value);
    } else {
      for (const e of (result as { ok: false; errors: ValidationError[] }).errors ?? []) {
        errors.push({ path: `[${i}].${e.path}`, message: e.message });
      }
    }
  }
  return { valid: errors.length === 0, errors, validOps };
}
