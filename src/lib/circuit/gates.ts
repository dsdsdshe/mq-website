import type { GateType } from "./model";

export type GateDef = {
  type: GateType;
  label: string;
  title?: string;
  arity: number; // number of target wires (controls handled separately)
};

export const GATE_REGISTRY: Record<GateType, GateDef> = {
  H: { type: "H", label: "H", title: "Hadamard", arity: 1 },
  X: { type: "X", label: "X", title: "Pauli-X", arity: 1 },
  Z: { type: "Z", label: "Z", title: "Pauli-Z", arity: 1 },
  CNOT: { type: "CNOT", label: "CNOT", title: "Controlled-NOT", arity: 1 },
};

