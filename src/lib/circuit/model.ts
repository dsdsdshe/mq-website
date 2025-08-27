// Circuit data model and pure operations

export type GateType = "H" | "X" | "Z" | "CNOT";

export type GatePlacement = {
  type: GateType;
  targets: number[]; // required non-empty
  controls?: number[];
  params?: Record<string, number>;
  id: string; // stable identity used for selection/drag
};

export type Column = {
  items: (GatePlacement | null)[]; // length = nQubits
};

export type Circuit = {
  nQubits: number;
  columns: Column[]; // time steps
};

export function createEmptyCircuit(nQubits: number, nColumns: number): Circuit {
  return {
    nQubits,
    columns: Array.from({ length: nColumns }, () => ({ items: Array(nQubits).fill(null) })),
  };
}

export function ensureColumns(c: Circuit, nColumns: number): Circuit {
  if (c.columns.length >= nColumns) return c;
  const extra = Array.from({ length: nColumns - c.columns.length }, () => ({ items: Array(c.nQubits).fill(null) }));
  return { ...c, columns: [...c.columns, ...extra] };
}

export function cloneCircuit(c: Circuit): Circuit {
  return {
    nQubits: c.nQubits,
    columns: c.columns.map((col) => ({ items: col.items.map((it) => (it ? { ...it, targets: [...it.targets], controls: it.controls ? [...it.controls] : undefined, params: it.params ? { ...it.params } : undefined } : null)) })),
  };
}

export function involvedWires(g: GatePlacement): number[] {
  const s = new Set<number>();
  g.targets.forEach((x) => s.add(x));
  (g.controls || []).forEach((x) => s.add(x));
  return [...s].sort((a, b) => a - b);
}

export function validatePlacement(c: Circuit, t: number, g: GatePlacement, movingId?: string): { ok: boolean; reason?: string } {
  if (t < 0 || t >= c.columns.length) return { ok: false, reason: "time_oob" };
  for (const q of involvedWires(g)) {
    if (q < 0 || q >= c.nQubits) return { ok: false, reason: "wire_oob" };
    const existing = c.columns[t].items[q];
    if (existing && existing.id !== (movingId || g.id)) return { ok: false, reason: "occupied" };
  }
  // For multi-qubit, ensure controls != targets
  if (g.controls && g.controls.some((q) => g.targets.includes(q))) return { ok: false, reason: "control_eq_target" };
  return { ok: true };
}

export function addGate(c: Circuit, t: number, g: GatePlacement, opts?: { occupyInvolved?: boolean; overwrite?: boolean }): Circuit {
  const occupyInvolved = opts?.occupyInvolved !== false; // default true
  const nc = cloneCircuit(c);
  const col = nc.columns[t];
  if (occupyInvolved) {
    for (const q of involvedWires(g)) {
      col.items[q] = opts?.overwrite ? g : col.items[q] || g;
    }
  } else {
    // Only place at targets, leave controls to be added later
    for (const q of g.targets) {
      col.items[q] = opts?.overwrite ? g : col.items[q] || g;
    }
  }
  return nc;
}

export function removeGateById(c: Circuit, id: string): Circuit {
  const nc = cloneCircuit(c);
  for (let t = 0; t < nc.columns.length; t++) {
    const col = nc.columns[t];
    for (let q = 0; q < nc.nQubits; q++) {
      if (col.items[q]?.id === id) col.items[q] = null;
    }
  }
  return nc;
}

export function moveGateById(c: Circuit, id: string, tNew: number, qTargetNew: number): Circuit {
  const gateInfo = findGate(c, id);
  if (!gateInfo) return c;
  const { tOld, gate } = gateInfo;
  const updated: GatePlacement = { ...gate, targets: [qTargetNew] };
  const valid = validatePlacement(c, tNew, updated, id).ok;
  if (!valid) return c;
  // Remove old
  let nc = removeGateById(c, id);
  // Add new
  nc = addGate(nc, tNew, updated);
  return nc;
}

export function findGate(c: Circuit, id: string): { tOld: number; gate: GatePlacement } | null {
  for (let t = 0; t < c.columns.length; t++) {
    const col = c.columns[t];
    for (let q = 0; q < c.nQubits; q++) {
      const g = col.items[q];
      if (g && g.id === id) return { tOld: t, gate: g };
    }
  }
  return null;
}

export function serializeCircuit(c: Circuit) {
  // Structure suitable for postMessage (structured clone friendly)
  return {
    nQubits: c.nQubits,
    columns: c.columns.map((col) => ({
      items: col.items.map((g) => (g ? { type: g.type, targets: g.targets, controls: g.controls || [], params: g.params || {}, id: g.id } : null)),
    })),
  } as Circuit;
}

