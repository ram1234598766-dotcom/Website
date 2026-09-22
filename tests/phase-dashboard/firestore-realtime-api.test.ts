/**
 * Unit coverage for the live Realtime Database API surface added for the
 * dashboard panels (commits f7baff1..93c31bc):
 *
 *   - mailbox:  subscribeMailbox / sendMail / saveDraftMail / setMailRead /
 *               setMailStarred / deleteMail
 *   - presence: subscribePresence / publishPresence
 *   - messages: subscribeDirectInbox / sendDirectMessage
 *   - feed:     subscribeNotifications / pushNotification / clearNotifications
 *
 * `firebase/database` is replaced with a tiny in-memory fake (tree + listener
 * registry) so each test drives the actual `src/lib/firestore.ts` code paths
 * and then asserts on the tree and on the callbacks it fired. `./firebase` is
 * mocked so a test can turn demo mode on/off and impersonate a user.
 *
 * These are the small, host-side unit tests; the emulator-backed rules tests
 * that pin the same write shapes live in tests/rules/database-rules.test.ts.
 */

// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { User } from "firebase/auth";

const h = vi.hoisted(() => {
  type RefObj = {
    path: string;
    key: string;
    filter?: { child: string; value: unknown };
  };

  const INC = "__increment__";

  const tree: Record<string, unknown> = {};
  const listeners = new Map<string, Array<() => void>>();
  const onDisconnectPaths: string[] = [];
  let keyCounter = 0;
  let failing: Error | null = null;

  const at = (path: string): unknown => {
    if (path === "") return tree;
    let cur: unknown = tree;
    for (const seg of path.split("/")) {
      if (cur === null || typeof cur !== "object" || Array.isArray(cur))
        return undefined;
      cur = (cur as Record<string, unknown>)[seg];
      if (cur === undefined) return undefined;
    }
    return cur;
  };

  const deleteAt = (path: string): void => {
    const segs = path.split("/");
    if (segs.length === 1) {
      delete tree[segs[0]];
      return;
    }
    const parent = at(segs.slice(0, -1).join("/"));
    if (parent !== null && parent !== undefined && typeof parent === "object") {
      delete (parent as Record<string, unknown>)[segs[segs.length - 1]];
    }
  };

  const setAt = (path: string, value: unknown): void => {
    if (value === null || value === undefined) {
      deleteAt(path);
      return;
    }
    const segs = path.split("/");
    let cur = tree;
    for (let i = 0; i < segs.length - 1; i += 1) {
      const next = (cur as Record<string, unknown>)[segs[i]];
      if (
        next === undefined ||
        next === null ||
        typeof next !== "object" ||
        Array.isArray(next)
      ) {
        (cur as Record<string, unknown>)[segs[i]] = {};
      }
      cur = (cur as Record<string, unknown>)[segs[i]] as Record<
        string,
        unknown
      >;
    }
    (cur as Record<string, unknown>)[segs[segs.length - 1]] = value;
  };

  const ensureAt = (path: string): Record<string, unknown> => {
    const segs = path.split("/");
    let cur = tree;
    for (const seg of segs) {
      const next = (cur as Record<string, unknown>)[seg];
      if (
        next === undefined ||
        next === null ||
        typeof next !== "object" ||
        Array.isArray(next)
      ) {
        (cur as Record<string, unknown>)[seg] = {};
      }
      cur = (cur as Record<string, unknown>)[seg] as Record<string, unknown>;
    }
    return cur as Record<string, unknown>;
  };

  const assertOk = (): void => {
    if (failing) throw failing;
  };

  const isIncrement = (v: unknown): boolean =>
    v !== null &&
    typeof v === "object" &&
    typeof (v as Record<string, unknown>)[INC] === "number";

  const mergePatch = (
    target: Record<string, unknown>,
    patch: Record<string, unknown>,
  ): void => {
    for (const [k, v] of Object.entries(patch)) {
      if (isIncrement(v)) {
        const delta = (v as Record<string, unknown>)[INC] as number;
        const current =
          typeof target[k] === "number" ? (target[k] as number) : 0;
        target[k] = current + delta;
      } else if (
        v !== null &&
        typeof v === "object" &&
        !Array.isArray(v) &&
        target[k] !== null &&
        typeof target[k] === "object" &&
        !Array.isArray(target[k])
      ) {
        mergePatch(
          target[k] as Record<string, unknown>,
          v as Record<string, unknown>,
        );
      } else {
        target[k] = v;
      }
    }
  };

  const makeRef = (
    path: string,
    filter?: { child: string; value: unknown },
  ): RefObj => {
    const segs = path.split("/");
    return { path, key: segs[segs.length - 1], filter };
  };

  class FakeSnap {
    readonly __node: unknown;
    readonly __key: string;
    readonly __size: number | undefined;
    constructor(node: unknown, key: string, size?: number) {
      this.__node = node;
      this.__key = key;
      this.__size = size;
    }
    val(): unknown {
      return this.__node;
    }
    exists(): boolean {
      return this.__node !== undefined && this.__node !== null;
    }
    get key(): string {
      return this.__key;
    }
    get size(): number {
      if (this.__size !== undefined) return this.__size;
      if (
        this.__node !== null &&
        typeof this.__node === "object" &&
        !Array.isArray(this.__node)
      ) {
        return Object.keys(this.__node as Record<string, unknown>).length;
      }
      return 0;
    }
    forEach(cb: (child: FakeSnap) => boolean | void): void {
      if (
        this.__node === null ||
        typeof this.__node !== "object" ||
        Array.isArray(this.__node)
      )
        return;
      for (const [k, v] of Object.entries(
        this.__node as Record<string, unknown>,
      )) {
        if (cb(new FakeSnap(v, k)) === true) return;
      }
    }
  }

  const notifyAt = (path: string): void => {
    for (const [reg, fns] of listeners) {
      if (path === reg || path.startsWith(`${reg}/`)) {
        for (const fn of [...fns]) fn();
      }
    }
  };

  const onValue = (
    refObj: RefObj,
    cb: (snap: FakeSnap) => void,
  ): (() => void) => {
    const notify = () => {
      if (refObj.filter) {
        const filtered: Record<string, unknown> = {};
        const raw = at(refObj.path);
        if (raw !== null && typeof raw === "object" && !Array.isArray(raw)) {
          for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
            const child =
              v !== null && typeof v === "object"
                ? (v as Record<string, unknown>)[refObj.filter.child]
                : undefined;
            if (child === refObj.filter.value) filtered[k] = v;
          }
        }
        cb(new FakeSnap(filtered, refObj.key));
        return;
      }
      cb(new FakeSnap(at(refObj.path), refObj.key));
    };
    const arr = listeners.get(refObj.path) || [];
    arr.push(notify);
    listeners.set(refObj.path, arr);
    notify();
    return () => {
      const list = listeners.get(refObj.path) || [];
      const i = list.indexOf(notify);
      if (i >= 0) list.splice(i, 1);
    };
  };

  const databaseModule = {
    getDatabase: (app: unknown) => app,
    ref: (_db: unknown, path: string): RefObj => makeRef(String(path)),
    query: (
      refObj: RefObj,
      order: { child: string },
      eq: { value: unknown },
    ): RefObj => ({
      ...refObj,
      filter: { child: order.child, value: eq.value },
    }),
    orderByChild: (child: string) => ({ child }),
    equalTo: (value: unknown) => ({ value }),
    push: (refObj: RefObj, value: unknown) => {
      assertOk();
      keyCounter += 1;
      const key = `K${keyCounter}`;
      const childPath = `${refObj.path}/${key}`;
      setAt(childPath, value);
      notifyAt(childPath);
      return Promise.resolve(makeRef(childPath));
    },
    set: (refObj: RefObj, value: unknown) => {
      assertOk();
      setAt(refObj.path, value);
      notifyAt(refObj.path);
      return Promise.resolve();
    },
    update: (refObj: RefObj, patch: Record<string, unknown>) => {
      assertOk();
      mergePatch(ensureAt(refObj.path), patch);
      notifyAt(refObj.path);
      return Promise.resolve();
    },
    remove: (refObj: RefObj) => {
      assertOk();
      deleteAt(refObj.path);
      notifyAt(refObj.path);
      return Promise.resolve();
    },
    get: (refObj: RefObj) => {
      assertOk();
      return Promise.resolve(new FakeSnap(at(refObj.path), refObj.key));
    },
    onValue,
    increment: (n: number) => ({ [INC]: n }),
    serverTimestamp: () => ({ seconds: 1_700_000_000, nanoseconds: 0 }),
    onDisconnect: (refObj: RefObj) => ({
      remove: () => {
        onDisconnectPaths.push(refObj.path);
      },
    }),
  };

  const helpers = {
    reset: () => {
      for (const k of Object.keys(tree)) delete tree[k];
      listeners.clear();
      onDisconnectPaths.length = 0;
      keyCounter = 0;
      failing = null;
    },
    seed: (path: string, value: unknown) => setAt(path, value),
    read: (path: string) => at(path),
    onDisconnectPaths,
    failNext: (err: Error) => {
      failing = err;
    },
    clearFailure: () => {
      failing = null;
    },
    serverTimestamp: () => ({ seconds: 1_700_000_000, nanoseconds: 0 }),
  };

  return { databaseModule, helpers };
});

vi.mock("firebase/database", () => h.databaseModule);

vi.mock("../../src/lib/firebase", () => ({
  getFirebaseApp: vi.fn(),
  getCurrentFireUser: vi.fn(() => null),
  isFirebaseConfigured: vi.fn(() => false),
}));

import * as rtdb from "../../src/lib/firestore";
import * as firebase from "../../src/lib/firebase";

const fb = vi.mocked(firebase);

const ALICE_UID = "user-alice";
const BOB_UID = "user-bob";
const SERVER_TS = h.helpers.serverTimestamp();

function mockUser(overrides: Partial<User> = {}): User {
  return {
    uid: ALICE_UID,
    displayName: "Alice",
    email: "alice@vantaos.local",
    photoURL: null,
    providerId: "password",
    emailVerified: true,
    isAnonymous: false,
    ...overrides,
  } as User;
}

function configure(on: boolean): void {
  fb.isFirebaseConfigured.mockReturnValue(on);
}

function setUser(user: User | null): void {
  fb.getCurrentFireUser.mockReturnValue(user);
}

function readRecord(path: string): Record<string, unknown> {
  return (h.helpers.read(path) || {}) as Record<string, unknown>;
}

beforeEach(() => {
  h.helpers.reset();
  configure(false);
  setUser(null);
});

describe("demo mode — no Firebase configured", () => {
  it("subscribes return empty data and a harmless unsubscriber", () => {
    const mailbox = vi.fn();
    expect(rtdb.subscribeMailbox(ALICE_UID, mailbox)()).toBeUndefined();
    expect(mailbox).toHaveBeenCalledWith([]);

    const peers = vi.fn();
    expect(rtdb.subscribePresence(ALICE_UID, peers)()).toBeUndefined();
    expect(peers).toHaveBeenCalledWith([]);

    const inbox = vi.fn();
    expect(rtdb.subscribeDirectInbox(ALICE_UID, inbox)()).toBeUndefined();
    expect(inbox).toHaveBeenCalledWith({});

    const notifications = vi.fn();
    expect(
      rtdb.subscribeNotifications(ALICE_UID, notifications)(),
    ).toBeUndefined();
    expect(notifications).toHaveBeenCalledWith([]);
  });

  it("write helpers no-op and never reach the database", async () => {
    await rtdb.sendMail({
      to_uid: BOB_UID,
      to_address: "b@x",
      subject: "s",
      content: "c",
    });
    await rtdb.saveDraftMail({ subject: "draft" });
    await rtdb.setMailRead(ALICE_UID, "M1", true);
    await rtdb.setMailStarred(ALICE_UID, "M1", true);
    await rtdb.deleteMail(ALICE_UID, "M1");
    await rtdb.sendDirectMessage({ to_uid: BOB_UID, content: "hi" });
    await rtdb.pushNotification(ALICE_UID, { message: "x" });
    await rtdb.clearNotifications(ALICE_UID);
    await rtdb.publishPresence({ label: "L", address: "a", protocol: "ws" });
    expect(h.helpers.read("mailboxes")).toBeUndefined();
    expect(h.helpers.read("dms")).toBeUndefined();
    expect(h.helpers.read("notifications")).toBeUndefined();
    expect(h.helpers.read("presence")).toBeUndefined();
    expect(h.helpers.onDisconnectPaths).toEqual([]);
  });

  it("guarded writes resolve to the demo-mode sign-in error", async () => {
    await expect(
      rtdb.sendMail({
        to_uid: BOB_UID,
        to_address: "b@x",
        subject: "s",
        content: "c",
      }),
    ).resolves.toEqual({
      id: null,
      error:
        "Sign in to send mail. Realtime Database requires a configured Firebase project.",
    });
    await expect(rtdb.saveDraftMail({ subject: "s" })).resolves.toEqual({
      id: null,
      error: "Drafts require a configured Firebase project.",
    });
    await expect(
      rtdb.sendDirectMessage({ to_uid: BOB_UID, content: "hi" }),
    ).resolves.toEqual({
      id: null,
      error:
        "Sign in to message. Realtime Database requires a configured Firebase project.",
    });
    await expect(
      rtdb.pushNotification(ALICE_UID, { message: "x" }),
    ).resolves.toEqual({
      id: null,
      error: "Notifications require a configured Firebase project.",
    });
  });
});

describe("configured but signed out", () => {
  beforeEach(() => configure(true));

  it("writes that need a user resolve to sign-in errors without touching the tree", async () => {
    await expect(
      rtdb.sendMail({
        to_uid: BOB_UID,
        to_address: "b@x",
        subject: "s",
        content: "c",
      }),
    ).resolves.toEqual({
      id: null,
      error:
        "Sign in to send mail. Realtime Database requires a configured Firebase project.",
    });
    await expect(
      rtdb.sendDirectMessage({ to_uid: BOB_UID, content: "hi" }),
    ).resolves.toEqual({
      id: null,
      error:
        "Sign in to message. Realtime Database requires a configured Firebase project.",
    });
    await expect(
      rtdb.pushNotification(ALICE_UID, { message: "x" }),
    ).resolves.toEqual({
      id: null,
      error: "Notifications require a configured Firebase project.",
    });
    expect(h.helpers.read("mailboxes")).toBeUndefined();
    expect(h.helpers.read("dms")).toBeUndefined();
    expect(h.helpers.read("notifications")).toBeUndefined();
  });

  it("publishPresence stays inert without a signed-in user", async () => {
    const handle = await rtdb.publishPresence({
      label: "L",
      address: "a",
      protocol: "ws",
    });
    expect(h.helpers.read("presence")).toBeUndefined();
    expect(h.helpers.onDisconnectPaths).toEqual([]);
    expect(handle.stop()).toBeUndefined();
  });
});

describe("sendMail — dual-inbox mailbox write", () => {
  beforeEach(() => {
    configure(true);
    setUser(mockUser());
  });

  it("writes a sent copy to the sender and an inbox copy under the same key to the recipient", async () => {
    const result = await rtdb.sendMail({
      to_uid: BOB_UID,
      to_address: "bob@vantaos.local",
      subject: "hello",
      content: "world",
    });

    expect(result).toEqual({ id: "K1", error: null });
    expect(h.helpers.read(`mailboxes/${ALICE_UID}/messages/K1`)).toEqual({
      from_uid: ALICE_UID,
      to_uid: BOB_UID,
      to: "bob@vantaos.local",
      from: "alice@vantaos.local",
      subject: "hello",
      content: "world",
      category: "sent",
      read: true,
      starred: false,
      timestamp: SERVER_TS,
    });
    expect(h.helpers.read(`mailboxes/${BOB_UID}/messages/K1`)).toEqual({
      from_uid: ALICE_UID,
      to_uid: BOB_UID,
      to: "bob@vantaos.local",
      from: "alice@vantaos.local",
      subject: "hello",
      content: "world",
      category: "inbox",
      read: false,
      starred: false,
      timestamp: SERVER_TS,
    });
  });

  it("truncates an overlong subject to 300 characters", async () => {
    await rtdb.sendMail({
      to_uid: BOB_UID,
      to_address: "b@x",
      subject: "x".repeat(350),
      content: "c",
    });
    const sent = readRecord(`mailboxes/${ALICE_UID}/messages/K1`);
    expect(sent.subject).toBe("x".repeat(300));
  });

  it("rejects an empty recipient before writing anything", async () => {
    const result = await rtdb.sendMail({
      to_uid: "",
      to_address: "",
      subject: "s",
      content: "c",
    });
    expect(result).toEqual({ id: null, error: "A recipient is required." });
    expect(h.helpers.read("mailboxes")).toBeUndefined();
  });

  it("returns the underlying error message when the write fails", async () => {
    h.helpers.failNext(new Error("network down"));
    const result = await rtdb.sendMail({
      to_uid: BOB_UID,
      to_address: "b@x",
      subject: "s",
      content: "c",
    });
    expect(result).toEqual({ id: null, error: "network down" });
    h.helpers.clearFailure();
  });
});

describe("drafts and mailbox mutations", () => {
  beforeEach(() => {
    configure(true);
    setUser(mockUser());
  });

  it("saveDraftMail pushes a drafts-category message", async () => {
    const result = await rtdb.saveDraftMail({
      to_uid: BOB_UID,
      to_address: "bob@vantaos.local",
      subject: "Draft",
      content: "notes",
    });
    expect(result).toEqual({ id: "K1", error: null });
    expect(h.helpers.read(`mailboxes/${ALICE_UID}/messages/K1`)).toEqual({
      from: "alice@vantaos.local",
      from_uid: ALICE_UID,
      to: "bob@vantaos.local",
      to_uid: BOB_UID,
      subject: "Draft",
      content: "notes",
      category: "drafts",
      read: true,
      starred: false,
      timestamp: SERVER_TS,
    });
  });

  it("saveDraftMail with a draftId overwrites the existing message", async () => {
    h.helpers.seed(`mailboxes/${ALICE_UID}/messages/DR1`, { from: "old" });
    const result = await rtdb.saveDraftMail({
      subject: "Updated",
      draftId: "DR1",
    });
    expect(result).toEqual({ id: "DR1", error: null });
    const saved = readRecord(`mailboxes/${ALICE_UID}/messages/DR1`);
    expect(saved.subject).toBe("Updated");
    expect(saved.category).toBe("drafts");
    expect(saved.to_uid).toBe("");
  });

  it("setMailRead / setMailStarred merge just the flag being flipped", async () => {
    await rtdb.setMailRead(ALICE_UID, "M1", true);
    expect(h.helpers.read(`mailboxes/${ALICE_UID}/messages/M1`)).toEqual({
      read: true,
    });
    await rtdb.setMailStarred(ALICE_UID, "M1", true);
    expect(h.helpers.read(`mailboxes/${ALICE_UID}/messages/M1`)).toEqual({
      read: true,
      starred: true,
    });
  });

  it("deleteMail removes the message node", async () => {
    h.helpers.seed(`mailboxes/${ALICE_UID}/messages/M1`, { subject: "x" });
    await rtdb.deleteMail(ALICE_UID, "M1");
    expect(
      h.helpers.read(`mailboxes/${ALICE_UID}/messages/M1`),
    ).toBeUndefined();
  });
});

describe("subscribeMailbox", () => {
  it("maps children to MailMessage and sorts newest first", () => {
    configure(true);
    const cb = vi.fn();
    h.helpers.seed(`mailboxes/${ALICE_UID}/messages`, {
      M1: {
        from: "b@x",
        from_uid: BOB_UID,
        to: "a@x",
        subject: "One",
        content: "c",
        category: "inbox",
        read: false,
        starred: false,
        timestamp: 1_700_000_000_000,
      },
      M2: {
        from: "b@x",
        from_uid: BOB_UID,
        to: "a@x",
        subject: "Two",
        content: "c",
        category: "sent",
        read: true,
        starred: true,
        timestamp: 1_700_000_060_000,
      },
      M3: {
        from: "b@x",
        from_uid: BOB_UID,
        to: "a@x",
        subject: "Three",
        content: "c",
        category: "weird",
        read: false,
        starred: false,
        timestamp: 1_700_000_030_000,
      },
    });

    rtdb.subscribeMailbox(ALICE_UID, cb);

    expect(cb).toHaveBeenCalledWith([
      {
        id: "M2",
        from: "b@x",
        from_uid: BOB_UID,
        to: "a@x",
        subject: "Two",
        content: "c",
        category: "sent",
        read: true,
        starred: true,
        timestamp: "2023-11-14T22:14:20.000Z",
      },
      {
        id: "M3",
        from: "b@x",
        from_uid: BOB_UID,
        to: "a@x",
        subject: "Three",
        content: "c",
        category: "inbox",
        read: false,
        starred: false,
        timestamp: "2023-11-14T22:13:50.000Z",
      },
      {
        id: "M1",
        from: "b@x",
        from_uid: BOB_UID,
        to: "a@x",
        subject: "One",
        content: "c",
        category: "inbox",
        read: false,
        starred: false,
        timestamp: "2023-11-14T22:13:20.000Z",
      },
    ]);
  });

  it("re-fires on new mail and stops after unsubscribe", async () => {
    configure(true);
    setUser(mockUser());
    const cb = vi.fn();
    const unsub = rtdb.subscribeMailbox(ALICE_UID, cb);
    cb.mockClear();

    await rtdb.sendMail({
      to_uid: BOB_UID,
      to_address: "b@x",
      subject: "one",
      content: "c",
    });
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0][0]).toHaveLength(1);

    unsub();
    cb.mockClear();
    await rtdb.sendMail({
      to_uid: BOB_UID,
      to_address: "b@x",
      subject: "two",
      content: "c",
    });
    expect(cb).not.toHaveBeenCalled();
  });
});

describe("presence API", () => {
  it("subscribePresence excludes self, defaults online, and sorts by lastSeen desc", () => {
    configure(true);
    const cb = vi.fn();
    h.helpers.seed("presence", {
      devA: {
        uid: "user-a",
        email: "a@x",
        label: "A",
        address: "10.0.0.1",
        protocol: "ws",
        online: true,
        lastSeen: 1_700_000_001_000,
      },
      devB: {
        uid: "user-b",
        email: "b@x",
        label: "B",
        address: "10.0.0.2",
        protocol: "rtdb",
        online: true,
        lastSeen: 1_700_000_005_000,
      },
      devC: {
        uid: "user-c",
        email: "c@x",
        label: "C",
        address: "10.0.0.3",
        protocol: "ws",
        online: false,
        lastSeen: 1_700_000_006_000,
      },
      devSelf: {
        uid: "self",
        email: "s@x",
        label: "Self",
        address: "10.0.0.9",
        protocol: "ws",
        online: true,
        lastSeen: 1_700_000_009_000,
      },
      devGhost: {
        uid: "self",
        email: "g@x",
        label: "Ghost",
        lastSeen: 1_700_000_008_000,
      },
      devNoUid: { label: "NoUid", lastSeen: 1_700_000_004_000 },
    });

    rtdb.subscribePresence("self", cb);

    expect(cb).toHaveBeenCalledWith([
      {
        deviceId: "devC",
        uid: "user-c",
        email: "c@x",
        label: "C",
        address: "10.0.0.3",
        protocol: "ws",
        online: false,
        lastSeen: "2023-11-14T22:13:26.000Z",
      },
      {
        deviceId: "devB",
        uid: "user-b",
        email: "b@x",
        label: "B",
        address: "10.0.0.2",
        protocol: "rtdb",
        online: true,
        lastSeen: "2023-11-14T22:13:25.000Z",
      },
      {
        deviceId: "devA",
        uid: "user-a",
        email: "a@x",
        label: "A",
        address: "10.0.0.1",
        protocol: "ws",
        online: true,
        lastSeen: "2023-11-14T22:13:21.000Z",
      },
    ]);
  });

  it("publishPresence announces the device, arms onDisconnect removal, and stop() cleans up", async () => {
    configure(true);
    setUser(mockUser({ uid: ALICE_UID, email: "alice@vantaos.local" }));

    const handle = await rtdb.publishPresence({
      label: "Dev",
      address: "10.0.0.5",
      protocol: "ws",
    });

    const presence = readRecord("presence");
    const keys = Object.keys(presence);
    expect(keys).toHaveLength(1);
    const deviceId = keys[0];
    expect(presence[deviceId]).toEqual({
      uid: ALICE_UID,
      email: "alice@vantaos.local",
      label: "Dev",
      address: "10.0.0.5",
      protocol: "ws",
      online: true,
      lastSeen: SERVER_TS,
    });
    expect(h.helpers.onDisconnectPaths).toEqual([`presence/${deviceId}`]);

    handle.stop();
    expect(h.helpers.read(`presence/${deviceId}`)).toBeUndefined();
  });
});

describe("direct message API", () => {
  beforeEach(() => {
    configure(true);
    setUser(mockUser());
  });

  it("sendDirectMessage writes to both inboxes under the same key", async () => {
    const result = await rtdb.sendDirectMessage({
      to_uid: BOB_UID,
      content: "hey",
    });
    expect(result).toEqual({ id: "K1", error: null });

    const payload = {
      sender_id: ALICE_UID,
      recipient_id: BOB_UID,
      content: "hey",
      timestamp: SERVER_TS,
    };
    expect(h.helpers.read(`dms/${ALICE_UID}/inbox/${BOB_UID}/K1`)).toEqual(
      payload,
    );
    expect(h.helpers.read(`dms/${BOB_UID}/inbox/${ALICE_UID}/K1`)).toEqual(
      payload,
    );
  });

  it("truncates an overlong message body to 4000 characters", async () => {
    await rtdb.sendDirectMessage({
      to_uid: BOB_UID,
      content: "x".repeat(4500),
    });
    const sent = readRecord(`dms/${ALICE_UID}/inbox/${BOB_UID}/K1`);
    expect(sent.content).toBe("x".repeat(4000));
  });

  it("rejects an empty recipient before writing", async () => {
    const result = await rtdb.sendDirectMessage({ to_uid: "", content: "hi" });
    expect(result).toEqual({ id: null, error: "A recipient is required." });
    expect(h.helpers.read("dms")).toBeUndefined();
  });

  it("returns the underlying error when the write fails", async () => {
    h.helpers.failNext(new Error("offline"));
    const result = await rtdb.sendDirectMessage({
      to_uid: BOB_UID,
      content: "hi",
    });
    expect(result).toEqual({ id: null, error: "offline" });
    h.helpers.clearFailure();
  });

  it("subscribeDirectInbox groups by opponent, oldest first, and falls back recipient_id to sender_id", () => {
    const cb = vi.fn();
    h.helpers.seed(`dms/${ALICE_UID}/inbox`, {
      bob: {
        M1: {
          sender_id: BOB_UID,
          content: "old",
          timestamp: 1_700_000_000_000,
        },
        M2: {
          sender_id: ALICE_UID,
          recipient_id: BOB_UID,
          content: "new",
          timestamp: 1_700_000_060_000,
        },
      },
      carol: {
        M3: {
          sender_id: "user-carol",
          content: "hi",
          timestamp: 1_700_000_030_000,
        },
      },
    });

    rtdb.subscribeDirectInbox(ALICE_UID, cb);

    expect(cb).toHaveBeenCalledWith({
      bob: [
        {
          id: "M1",
          sender_id: BOB_UID,
          recipient_id: BOB_UID,
          content: "old",
          timestamp: "2023-11-14T22:13:20.000Z",
        },
        {
          id: "M2",
          sender_id: ALICE_UID,
          recipient_id: BOB_UID,
          content: "new",
          timestamp: "2023-11-14T22:14:20.000Z",
        },
      ],
      carol: [
        {
          id: "M3",
          sender_id: "user-carol",
          recipient_id: "user-carol",
          content: "hi",
          timestamp: "2023-11-14T22:13:50.000Z",
        },
      ],
    });
  });
});

describe("notifications API", () => {
  beforeEach(() => {
    configure(true);
    setUser(mockUser());
  });

  it("pushNotification persists a feed entry with defaults when omitted", async () => {
    const result = await rtdb.pushNotification(ALICE_UID, {
      message: "New comment",
    });
    expect(result).toEqual({ id: "K1", error: null });
    expect(h.helpers.read(`notifications/${ALICE_UID}/K1`)).toEqual({
      message: "New comment",
      type: "info",
      source: "system",
      timestamp: SERVER_TS,
    });
  });

  it("pushNotification honours explicit type/source and truncates the body to 500", async () => {
    await rtdb.pushNotification(ALICE_UID, {
      message: "DM",
      type: "message",
      source: "messaging",
    });
    await rtdb.pushNotification(ALICE_UID, { message: "m".repeat(600) });
    expect(h.helpers.read(`notifications/${ALICE_UID}/K1`)).toEqual({
      message: "DM",
      type: "message",
      source: "messaging",
      timestamp: SERVER_TS,
    });
    const second = readRecord(`notifications/${ALICE_UID}/K2`);
    expect(second.message).toBe("m".repeat(500));
  });

  it("refuses to notify on behalf of another user", async () => {
    const result = await rtdb.pushNotification(BOB_UID, { message: "x" });
    expect(result).toEqual({ id: null, error: "Cannot notify another user." });
    expect(h.helpers.read("notifications")).toBeUndefined();
  });

  it("clearNotifications removes the whole feed node", async () => {
    h.helpers.seed(`notifications/${ALICE_UID}`, { N1: { message: "x" } });
    await rtdb.clearNotifications(ALICE_UID);
    expect(h.helpers.read(`notifications/${ALICE_UID}`)).toBeUndefined();
  });

  it("subscribeNotifications maps children and sorts newest first", () => {
    const cb = vi.fn();
    h.helpers.seed(`notifications/${ALICE_UID}`, {
      N1: {
        message: "a",
        type: "info",
        source: "forum",
        timestamp: 1_700_000_000_000,
      },
      N2: { message: "b", timestamp: 1_700_000_060_000 },
    });

    rtdb.subscribeNotifications(ALICE_UID, cb);

    expect(cb).toHaveBeenCalledWith([
      {
        id: "N2",
        message: "b",
        type: "info",
        source: "system",
        timestamp: "2023-11-14T22:14:20.000Z",
      },
      {
        id: "N1",
        message: "a",
        type: "info",
        source: "forum",
        timestamp: "2023-11-14T22:13:20.000Z",
      },
    ]);
  });
});
