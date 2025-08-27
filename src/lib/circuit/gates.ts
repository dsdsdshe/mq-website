import type { GateType } from "./model";

export type GateDef = {
  type: GateType;
  label: string;
  title?: string;
  arity: number; // number of target wires (controls handled separately)
};

export const GATE_REGISTRY: Record<GateType, GateDef> = {
  // Single-qubit gates
  H: { type: "H", label: "H", title: "Hadamard", arity: 1 },
  X: { type: "X", label: "X", title: "Pauli-X (NOT)", arity: 1 },
  Y: { type: "Y", label: "Y", title: "Pauli-Y", arity: 1 },
  Z: { type: "Z", label: "Z", title: "Pauli-Z", arity: 1 },
  S: { type: "S", label: "S", title: "Phase Gate (√Z)", arity: 1 },
  T: { type: "T", label: "T", title: "T Gate (√S)", arity: 1 },
  RX: { type: "RX", label: "Rx", title: "X Rotation", arity: 1 },
  RY: { type: "RY", label: "Ry", title: "Y Rotation", arity: 1 },
  RZ: { type: "RZ", label: "Rz", title: "Z Rotation", arity: 1 },
  // Two-qubit gates
  CNOT: { type: "CNOT", label: "CNOT", title: "Controlled-NOT", arity: 1 },
  CZ: { type: "CZ", label: "CZ", title: "Controlled-Z", arity: 1 },
  SWAP: { type: "SWAP", label: "SWAP", title: "Swap", arity: 1 },
};

