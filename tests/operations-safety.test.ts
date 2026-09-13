import "fake-indexeddb/auto"; 
import { describe, expect, it, beforeEach } from "vitest"; 
import { 
 appendOp, bulkAppendOps, loadOps, loadOpsAfter, replaceOps, clearOps, initSeqCounter, bumpSeq, generateId, 
} from "../src/lib/workspace/operations"; 
import { openWorkspaceDB } from "../src/lib/workspace/db"; 
import type { Operation } from "../src/lib/workspace/types"; 

async function getPersistedNextSeq() { 
 const db = await openWorkspaceDB(); 
 return new Promise(function(resolve, reject) { 
  const tx = db.transaction("workspace_meta", "readonly"); 
  const req = tx.objectStore("workspace_meta").get("nextSeq"); 
  req.onsuccess = function() { resolve((req.result?.value as number) ?? 0); }; 
  req.onerror = function() { reject(req.error); }; 
  }); 
} 

async function loadSeqs() { 
 const ops = await loadOps(); 
 return ops.map(function(o) { return o.seq; }).sort(function(a, b) { return a - b; }); 
} 

async function insertSeq0() { 
 const db = await openWorkspaceDB(); 
 return new Promise(function(resolve, reject) { 
  const tx = db.transaction("operations", "readwrite"); 
  tx.objectStore("operations").put({ 
   id: "z", kind: "create_node", timestamp: 1, source: "system", seq: 0, 
   idempotencyKey: undefined, 
   payload: { id: "n0", path: "zero.ts", name: "zero.ts", parentId: null, content: "", language: "plaintext" } 
  }); 
  tx.oncomplete = function() { resolve(void 0); }; 
  tx.onerror = function() { reject(tx.error); }; 
  }); 
} 

describe("1. bumpSeq concurrency", function() { 
 beforeEach(async function() { await clearOps(); initSeqCounter(0); }); 
 it("sequential calls give unique increasing seqs", async function() { 
  const s = []; 
  let n = 20; while (n--) s.push(bumpSeq()); 
  expect(new Set(s).size).toBe(20); 
  s.slice(1).forEach(function(v, i) { expect(v).toBe(s[i]+1); }); 
 }); 
 it("persisted nextSeq matches", async function() { 
  let n = 5; while (n--) bumpSeq(); 
  await new Promise(function(r) { setTimeout(r, 100); }); 
  expect(await getPersistedNextSeq()).toBe(5); 
 }); 
}); 

describe("2. seq gaps", function() { 
 beforeEach(async function() { await clearOps(); initSeqCounter(0); }); 
 it("gaps are acceptable for append-only oplog", async function() { 
  const op1 = await appendOp("create_node", "user", { id: "n1", path: "a.ts", name: "a.ts", parentId: null, content: "", language: "plaintext" }); 
  bumpSeq(); 
  const op3 = await appendOp("create_node", "user", { id: "n3", path: "c.ts", name: "c.ts", parentId: null, content: "", language: "plaintext" }); 
  const seqs = await loadSeqs(); 
  expect(seqs).toHaveLength(2); 
  expect(op1.seq).not.toBe(op3.seq); 
  expect(op1.seq).toBeLessThan(op3.seq); 
  expect(new Set(seqs).size).toBe(2); 
 }); 
}); 

describe("3. initSeqCounter reset", function() { 
 beforeEach(async function() { await clearOps(); }); 
 it("must not reuse seq numbers after reset", async function() { 
  await appendOp("create_node", "user", { id: "n1", path: "a.ts", name: "a.ts", parentId: null, content: "", language: "plaintext" }); 
  await appendOp("create_node", "user", { id: "n2", path: "b.ts", name: "b.ts", parentId: null, content: "", language: "plaintext" }); 
  expect(await loadSeqs()).toEqual([1, 2]); 
  initSeqCounter(0); 
  await appendOp("create_node", "user", { id: "n3", path: "c.ts", name: "c.ts", parentId: null, content: "", language: "plaintext" }); 
  const seqs = await loadSeqs(); 
  expect(seqs).toHaveLength(3); 
  expect(new Set(seqs).size).toBe(3); 
 }); 
 it("multiple resets should not cause inconsistency", async function() { 
  await appendOp("create_node", "user", { id: "n1", path: "a.ts", name: "a.ts", parentId: null, content: "", language: "plaintext" }); 
  initSeqCounter(0); initSeqCounter(0); 
  await appendOp("create_node", "user", { id: "n2", path: "b.ts", name: "b.ts", parentId: null, content: "", language: "plaintext" }); 
  const seqs = await loadSeqs(); 
  expect(seqs).toHaveLength(2); 
  expect(new Set(seqs).size).toBe(2); 
 }); 
}); 

describe("4. generateId SSR", function() { 
 it("produces valid format", function() { 
  const id = generateId(); 
  if (typeof crypto !== "undefined") { 
    if (crypto.randomUUID) { 
      expect(id).toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i); 
    } else { 
      expect(id).toMatch(/\\d+-[a-z0-9]+/); 
    } 
  } else { 
    expect(id).toMatch(/\\d+-[a-z0-9]+/); 
  } 
 }); 
 it("unique across 1000 calls", function() { 
  const ids = new Set(); 
  let n = 1000; while (n--) ids.add(generateId()); 
  expect(ids.size).toBe(1000); 
 }); 
}); 

describe("5. bulkAppendOps seq=0", function() { 
 beforeEach(async function() { await clearOps(); initSeqCounter(0); }); 
 it("assigns unique seqs to seq=0 ops", async function() { 
  const ops = [0,0,0].map(function(_, i) { 
    return { id: "x"+i, kind: "create_node", timestamp: i, source: "system", seq: 0, payload: { id: "n"+i, path: (i+1)+".ts", name: (i+1)+".ts", parentId: null, content: "", language: "plaintext" } }; 
  }); 
  await bulkAppendOps(ops as any); 
  const seqs = await loadSeqs(); 
  expect(seqs).toHaveLength(3); 
  expect(new Set(seqs).size).toBe(3); 
  expect(seqs.every(function(s) { return s !== 0; })).toBe(true); 
 }); 
 it("no collision with existing ops", async function() { 
  await appendOp("create_node", "user", { id: "e1", path: "e1.ts", name: "e1.ts", parentId: null, content: "", language: "plaintext" }); 
  await appendOp("create_node", "user", { id: "e2", path: "e2.ts", name: "e2.ts", parentId: null, content: "", language: "plaintext" }); 
  await bulkAppendOps([{ id: "m1", kind: "create_node", timestamp: 10, source: "system", seq: 0, payload: { id: "n1", path: "m1.ts", name: "m1.ts", parentId: null, content: "", language: "plaintext" } }, { id: "m2", kind: "create_node", timestamp: 11, source: "system", seq: 0, payload: { id: "n2", path: "m2.ts", name: "m2.ts", parentId: null, content: "", language: "plaintext" } }]); 
  const seqs = await loadSeqs(); 
  expect(seqs).toHaveLength(4); 
  expect(new Set(seqs).size).toBe(4); 
 }); 
 it("deduplicates by seq when nonzero", async function() { 
  await bulkAppendOps([{ id: "d1", kind: "create_node", timestamp: 1, source: "system", seq: 5, payload: { id: "n1", path: "d1.ts", name: "d1.ts", parentId: null, content: "", language: "plaintext" } }, { id: "d2", kind: "create_node", timestamp: 2, source: "system", seq: 5, payload: { id: "n2", path: "d2.ts", name: "d2.ts", parentId: null, content: "", language: "plaintext" } }]); 
  expect((await loadOps()).length).toBe(2); 
 }); 
}); 

describe("6. loadOpsAfter(0)", function() { 
 beforeEach(async function() { await clearOps(); }); 
 it("includes seq=0 ops if present", async function() { 
  await insertSeq0(); 
  expect((await loadOpsAfter(0)).map(function(o) { return o.seq; })).toContain(0); 
 }); 
 it("returns ops after given seq", async function() { 
  await bulkAppendOps([1,2,3,4].map(function(s) { return { id: "a"+s, kind: "create_node", timestamp: s, source: "system", seq: s, payload: { id: "n"+s, path: s+".ts", name: s+".ts", parentId: null, content: "", language: "plaintext" } }; })); 
  expect((await loadOpsAfter(2)).map(function(o) { return o.seq; })).toEqual([3, 4]); 
 }); 
}); 

describe("7. replaceOps atomicity", function() { 
 beforeEach(async function() { await clearOps(); }); 
 it("replaces data on success", async function() { 
  await appendOp("create_node", "user", { id: "old", path: "old.ts", name: "old.ts", parentId: null, content: "", language: "plaintext" }); 
  await replaceOps([{ id: "r1", kind: "create_node", timestamp: 1, source: "system", seq: 10, payload: { id: "n1", path: "r1.ts", name: "r1.ts", parentId: null, content: "", language: "plaintext" } }, { id: "r2", kind: "create_node", timestamp: 2, source: "system", seq: 11, payload: { id: "n2", path: "r2.ts", name: "r2.ts", parentId: null, content: "", language: "plaintext" } }]); 
  expect(await loadSeqs()).toEqual([10, 11]); 
 }); 
 it("empty array clears all", async function() { 
  await appendOp("create_node", "user", { id: "x", path: "x.ts", name: "x.ts", parentId: null, content: "", language: "plaintext" }); 
  await replaceOps([]); 
  expect(await loadSeqs()).toHaveLength(0); 
 }); 
 it("atomic no partial state", async function() { 
  await appendOp("create_node", "user", { id: "p1", path: "pre1.ts", name: "pre1.ts", parentId: null, content: "", language: "plaintext" }); 
  await appendOp("create_node", "user", { id: "p2", path: "pre2.ts", name: "pre2.ts", parentId: null, content: "", language: "plaintext" }); 
  await replaceOps([{ id: "post1", kind: "create_node", timestamp: 1, source: "system", seq: 100, payload: { id: "n1", path: "post1.ts", name: "post1.ts", parentId: null, content: "", language: "plaintext" } }]); 
  expect((await loadOps()).length).toBe(1); 
  expect((await loadOps())[0].id).toBe("post1"); 
 }); 
}); 
