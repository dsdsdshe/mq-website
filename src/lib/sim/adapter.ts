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
    // Dynamically import quantum-circuit when needed
    // @ts-ignore - module types not available
    const QuantumCircuit = (await import("quantum-circuit")).default;
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
            // CNOT is called "cx" in quantum-circuit library
            const target = gp.targets[0];
            const controls = gp.controls || [];
            if (controls.length > 0) {
              // Wire order for cx: [control, target]
              qc.addGate("cx", t, [controls[0], target]);
            }
            break;
          }
        }
      }
    }

    // Run the circuit
    qc.run();

    // Get statevector using stateAsArray
    const stateArray = qc.stateAsArray(false); // false = include all amplitudes
    console.log("State array:", stateArray);
    
    if (!stateArray || !Array.isArray(stateArray)) {
      throw new Error("Unable to read statevector from quantum-circuit");
    }

    // Extract re/im from the complex amplitudes
    const re: number[] = [];
    const im: number[] = [];
    
    // The stateAsArray returns objects with index, indexBinStr, amplitude, amplitudeStr
    for (const item of stateArray) {
      if (item && typeof item === 'object' && 'amplitude' in item) {
        const amp = item.amplitude;
        // amplitude is a complex number object with re and im properties
        re.push(typeof amp.re === 'number' ? amp.re : 0);
        im.push(typeof amp.im === 'number' ? amp.im : 0);
      } else {
        re.push(0);
        im.push(0);
      }
    }

    const statevector = { re, im };
    if (!statevector.re.length) throw new Error("Unable to read statevector from quantum-circuit");

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
