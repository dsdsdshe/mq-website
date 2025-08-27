import type { Circuit } from "../circuit/model";

export type BuildAndRunMessage = {
  type: "BuildAndRun";
  payload: Circuit;
};

export type BuildAndRunResult = {
  statevector?: { re: number[]; im: number[] };
  probs?: number[];
  error?: { code: string; message: string };
};

// In v1 we depend on the 'quantum-circuit' package loaded within the worker.
// To keep the UI functional without the dependency during development, we provide
// a clear error result when the library isn't available.

export async function buildAndRun(c: Circuit): Promise<BuildAndRunResult> {
  try {
    // Dynamic import kept here so worker is the only place touching the dependency.
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - module provided at runtime after installation
    // Use Vite ignore to avoid bundling resolution until runtime
    const mod = await import(/* @vite-ignore */ "quantum-circuit");
    const QuantumCircuit = mod.default || mod.QuantumCircuit || mod;
    if (!QuantumCircuit) throw new Error("QuantumCircuit not found in module export");

    const qc = new QuantumCircuit(c.nQubits);
    // Add gates column by column. Within a column, gates on distinct wires commute,
    // so order doesn't matter for single-qubit gates. Multi-qubit gates (CNOT) added as controlled ops.
    for (let t = 0; t < c.columns.length; t++) {
      const col = c.columns[t];
      // Collect unique gates by id in this column to avoid duplicating multi-qubit occupancy rows
      const unique: Record<string, any> = {};
      for (let q = 0; q < c.nQubits; q++) {
        const gp = col.items[q] as any;
        if (gp && !unique[gp.id]) unique[gp.id] = gp;
      }
      const gates = Object.values(unique) as any[];
      for (const gp of gates) {
        switch (gp.type) {
          case "H":
            qc.addGate("h", t, gp.targets);
            break;
          case "X":
            qc.addGate("x", t, gp.targets);
            break;
          case "Z":
            qc.addGate("z", t, gp.targets);
            break;
          case "CNOT": {
            // Many libraries model CNOT as controlled X
            const target = gp.targets[0];
            const controls = gp.controls || [];
            // Try common method signatures; fall back to a controlled addGate API if present
            if (typeof qc.addGate === "function") {
              // Some versions accept control wires via options
              try {
                qc.addGate("cx", t, [controls[0], target]);
              } catch (_) {
                // Try adding control then target as separate ops if supported
                // This depends on the specific library. If it fails, let it throw to be caught below.
                qc.addGate("cnot", t, [controls[0], target]);
              }
            }
            break;
          }
        }
      }
    }

    // Run and get statevector (depends on library API)
    let statevector: { re: number[]; im: number[] } | undefined = undefined;
    if (typeof qc.run === "function") qc.run();
    if (typeof qc.state === "function") {
      const st = qc.state();
      // Normalize into re/im arrays
      if (Array.isArray(st)) {
        const re = st.map((c: any) => (typeof c === "number" ? c : c.re ?? c[0] ?? 0));
        const im = st.map((c: any) => (typeof c === "number" ? 0 : c.im ?? c[1] ?? 0));
        statevector = { re, im };
      } else if (st && st.re && st.im) {
        statevector = { re: st.re, im: st.im };
      }
    }

    if (!statevector && typeof qc.getStateVector === "function") {
      const vec = qc.getStateVector();
      if (vec && vec.re && vec.im) statevector = { re: vec.re, im: vec.im };
    }

    if (!statevector && typeof qc.stateAsArray === "function") {
      const arr = qc.stateAsArray();
      if (Array.isArray(arr)) {
        const re = arr.map((x: any) => (typeof x === "number" ? x : x.re ?? x[0] ?? 0));
        const im = arr.map((x: any) => (typeof x === "number" ? 0 : x.im ?? x[1] ?? 0));
        statevector = { re, im };
      }
    }

    if (!statevector) throw new Error("Unable to read statevector from quantum-circuit");

    const probs = statevector.re.map((re, i) => re * re + statevector!.im[i] * statevector!.im[i]);
    return { statevector, probs };
  } catch (err: any) {
    return {
      error: {
        code: "sim_error",
        message:
          (err && err.message) ||
          "Simulation failed. Ensure 'quantum-circuit' is installed and compatible.",
      },
    };
  }
}
