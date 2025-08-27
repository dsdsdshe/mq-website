// Vanilla web component implementing the interactive circuit builder
// UI logic is encapsulated here; simulation runs in a web worker.

import type { Circuit, Column, GatePlacement, GateType } from "../../lib/circuit/model";
import { createEmptyCircuit, ensureColumns, addGate, removeGateById, moveGateById, validatePlacement, serializeCircuit } from "../../lib/circuit/model";
import { GATE_REGISTRY, type GateDef } from "../../lib/circuit/gates";

type RunResult = {
  statevector?: { re: number[]; im: number[] };
  probs?: number[];
  error?: { code: string; message: string };
};

const MAX_QUBITS = 6;
const MIN_QUBITS = 2;
const DEFAULT_QUBITS = 3;
const DEFAULT_COLUMNS = 12;

const TEMPLATE_HTML = /* html */ `
  <div class="mqcb-root" part="root">
    <div class="mqcb-topbar">
      <div class="mqcb-palette" role="listbox" aria-label="Gate Palette">
        <!-- palette gates injected -->
      </div>
      <div class="mqcb-controls">
        <label>
          <span class="mqcb-label" data-label="qubits">Qubits</span>
          <select class="mqcb-qubits" aria-label="Qubits">
            ${Array.from({ length: MAX_QUBITS - MIN_QUBITS + 1 }, (_, i) => MIN_QUBITS + i)
              .map((n) => `<option value="${n}">${n}</option>`)
              .join("")}
          </select>
        </label>
        <button class="mqcb-run" type="button" data-label="run">Run</button>
      </div>
    </div>

    <div class="mqcb-canvas" tabindex="0" aria-label="Circuit Canvas" role="application">
      <!-- grid injected -->
    </div>

    <div class="mqcb-results" aria-live="polite">
      <div class="mqcb-results-header" data-label="results">Results</div>
      <div class="mqcb-results-body">
        <div class="mqcb-probs">
          <div class="mqcb-subheading" data-label="probs">Measurement Probabilities</div>
          <div class="mqcb-problist"></div>
        </div>
        <div class="mqcb-state"></div>
        <div class="mqcb-error" hidden></div>
      </div>
    </div>

    <div class="mqcb-toast" aria-live="assertive" hidden></div>
  </div>
`;

function debounce<T extends (...a: any[]) => void>(fn: T, ms: number) {
  let t: any;
  return (...args: Parameters<T>) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

class QuantumCircuitElement extends HTMLElement {
  static tag = "mq-circuit-builder";
  private root!: ShadowRoot;
  private circuit: Circuit = createEmptyCircuit(DEFAULT_QUBITS, DEFAULT_COLUMNS);
  private selectedGateId: string | null = null;
  private worker?: Worker;
  private autoRunDebounced: () => void;

  constructor() {
    super();
    this.root = this.attachShadow({ mode: "open" });
    this.autoRunDebounced = debounce(() => this.runSimulation(), 300);
  }

  connectedCallback() {
    this.render();
    this.applyLabels();
    this.ensureWorker();
    this.bindEvents();
  }

  disconnectedCallback() {
    this.worker?.terminate();
  }

  private ensureWorker() {
    if (!this.worker) {
      try {
        this.worker = new Worker(new URL("../../lib/sim/worker.ts", import.meta.url), { type: "module" });
        this.worker.onmessage = (e: MessageEvent<RunResult>) => this.onWorkerMessage(e.data);
      } catch (err) {
        console.warn("Worker setup failed", err);
      }
    }
  }

  private render() {
    this.root.innerHTML = TEMPLATE_HTML;
    this.renderPalette();
    this.renderGrid();
  }

  private applyLabels() {
    const labels = {
      qubits: this.getAttribute("data-label-qubits") || this.dataset.labelQubits || "Qubits",
      run: this.getAttribute("data-label-run") || this.dataset.labelRun || "Run",
      results: this.getAttribute("data-label-results") || this.dataset.labelResults || "Results",
      probs: this.getAttribute("data-label-probs") || this.dataset.labelProbs || "Measurement Probabilities",
    };
    const q = this.root.querySelector<HTMLElement>('[data-label="qubits"]');
    const r = this.root.querySelector<HTMLElement>('[data-label="run"]');
    const res = this.root.querySelector<HTMLElement>('[data-label="results"]');
    const pr = this.root.querySelector<HTMLElement>('[data-label="probs"]');
    if (q) q.textContent = labels.qubits;
    if (r) r.textContent = labels.run;
    if (res) res.textContent = labels.results;
    if (pr) pr.textContent = labels.probs;
  }

  private bindEvents() {
    const qubitsSel = this.qs<HTMLSelectElement>(".mqcb-qubits");
    qubitsSel.value = String(this.circuit.nQubits);
    qubitsSel.addEventListener("change", () => this.onChangeQubits(parseInt(qubitsSel.value, 10)));

    const runBtn = this.qs<HTMLButtonElement>(".mqcb-run");
    runBtn.addEventListener("click", () => this.runSimulation());

    const canvas = this.qs<HTMLElement>(".mqcb-canvas");
    canvas.addEventListener("keydown", (e) => this.onCanvasKeyDown(e as KeyboardEvent));
  }

  private qs<T extends Element>(sel: string): T {
    const el = this.root.querySelector(sel);
    if (!el) throw new Error(`Missing element ${sel}`);
    return el as T;
  }

  // Palette rendering and drag start
  private renderPalette() {
    const pal = this.qs<HTMLDivElement>(".mqcb-palette");
    pal.innerHTML = "";
    const gates: GateDef[] = [GATE_REGISTRY.H, GATE_REGISTRY.X, GATE_REGISTRY.Z, GATE_REGISTRY.CNOT];
    for (const g of gates) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `mqcb-gate mqcb-g-${g.type.toLowerCase()}`;
      btn.textContent = g.label;
      btn.setAttribute("role", "option");
      btn.draggable = true;
      btn.dataset.gate = g.type;
      btn.title = g.title || g.label;
      btn.addEventListener("dragstart", (e) => {
        e.dataTransfer?.setData("application/x-mq-gate", g.type);
        e.dataTransfer?.setData("text/plain", g.type);
        e.dataTransfer!.effectAllowed = "copy";
      });
      pal.appendChild(btn);
    }
  }

  // Grid rendering and drag/drop handlers
  private renderGrid() {
    const canvas = this.qs<HTMLDivElement>(".mqcb-canvas");
    canvas.innerHTML = "";

    // Ensure column count
    this.circuit = ensureColumns(this.circuit, Math.max(this.circuit.columns.length, DEFAULT_COLUMNS));

    // Build grid
    const table = document.createElement("div");
    table.className = "mqcb-grid";

    // Header row (time indices)
    const header = document.createElement("div");
    header.className = "mqcb-row mqcb-header";
    header.appendChild(document.createElement("div")); // empty corner
    for (let t = 0; t < this.circuit.columns.length; t++) {
      const h = document.createElement("div");
      h.className = "mqcb-cell mqcb-time";
      h.textContent = String(t + 1);
      header.appendChild(h);
    }
    table.appendChild(header);

    // Qubit rows
    for (let q = 0; q < this.circuit.nQubits; q++) {
      const row = document.createElement("div");
      row.className = "mqcb-row";
      const label = document.createElement("div");
      label.className = "mqcb-cell mqcb-wirelabel";
      label.textContent = `q${q}`;
      row.appendChild(label);

      for (let t = 0; t < this.circuit.columns.length; t++) {
        const col = this.circuit.columns[t];
        const cell = document.createElement("div");
        cell.className = "mqcb-cell mqcb-drop";
        cell.dataset.q = String(q);
        cell.dataset.t = String(t);

        // Wire line
        const wire = document.createElement("div");
        wire.className = "mqcb-wire";
        cell.appendChild(wire);

        // Render gate if present
        const item = col.items[q];
        if (item) {
          const gateEl = this.renderGateChip(item, q, t);
          cell.appendChild(gateEl);
        }

        // Drag & drop events
        cell.addEventListener("dragover", (e) => this.onCellDragOver(e));
        cell.addEventListener("dragleave", (e) => this.onCellDragLeave(e));
        cell.addEventListener("drop", (e) => this.onCellDrop(e));
        row.appendChild(cell);
      }

      table.appendChild(row);
    }

    // Trash bin row
    const trashRow = document.createElement("div");
    trashRow.className = "mqcb-row mqcb-footer";
    const trashLabel = document.createElement("div");
    trashLabel.className = "mqcb-cell mqcb-wirelabel";
    trashLabel.textContent = "";
    trashRow.appendChild(trashLabel);
    for (let t = 0; t < this.circuit.columns.length; t++) {
      const cell = document.createElement("div");
      cell.className = "mqcb-cell mqcb-trash";
      cell.dataset.t = String(t);
      cell.setAttribute("aria-label", "Trash Bin");
      cell.addEventListener("dragover", (e) => {
        if (this.selectedGateId) {
          e.preventDefault();
          cell.classList.add("over");
        }
      });
      cell.addEventListener("dragleave", () => cell.classList.remove("over"));
      cell.addEventListener("drop", (e) => this.onTrashDrop(e));
      trashRow.appendChild(cell);
    }
    table.appendChild(trashRow);

    canvas.appendChild(table);
  }

  private renderGateChip(g: GatePlacement, q: number, t: number) {
    const chip = document.createElement("button");
    chip.className = `mqcb-chip mqcb-g-${g.type.toLowerCase()} ${this.selectedGateId === g.id ? "selected" : ""}`;
    chip.type = "button";
    chip.textContent = g.type;
    chip.setAttribute("data-id", g.id);
    chip.draggable = true;
    chip.addEventListener("click", () => this.onGateClick(g.id));
    chip.addEventListener("dragstart", (e) => this.onGateDragStart(e, g.id));
    chip.addEventListener("dragend", () => this.clearDragHighlights());

    // CNOT connectors: draw control/target markers and vertical line across involved wires
    if (g.type === "CNOT") {
      const isTarget = g.targets.includes(q);
      chip.classList.add(isTarget ? "target" : "control");
      // draw connector segments on the column by augmenting cells; handled after entire grid build
      // We rely on having the same GatePlacement present at all involved wires in this column
      // Vertical line is drawn via CSS ::before stretching within column cells using a data attribute
      const colCells = Array.from(this.root.querySelectorAll(`.mqcb-cell.mqcb-drop[data-t="${t}"]`));
      const minQ = Math.min(...[...g.targets, ...(g.controls || [])]);
      const maxQ = Math.max(...[...g.targets, ...(g.controls || [])]);
      for (let qi = minQ; qi <= maxQ; qi++) {
        const c = colCells[qi];
        c && c.classList.add("has-connector");
      }
    }

    return chip;
  }

  private onGateClick(id: string) {
    this.selectedGateId = this.selectedGateId === id ? null : id;
    this.renderGrid();
  }

  private onGateDragStart(e: DragEvent, id: string) {
    this.selectedGateId = id;
    e.dataTransfer?.setData("application/x-mq-move", id);
    e.dataTransfer?.setData("text/plain", id);
    e.dataTransfer!.effectAllowed = "move";
    // Highlight potential drop targets
    this.highlightValidTargetsForMove(id);
  }

  private highlightValidTargetsForMove(id: string) {
    // For simplicity, allow moving to any empty cell in any column; validation on drop
    const cells = this.root.querySelectorAll<HTMLElement>(`.mqcb-cell.mqcb-drop`);
    cells.forEach((c) => c.classList.add("maybe"));
  }

  private clearDragHighlights() {
    this.root.querySelectorAll<HTMLElement>(`.mqcb-cell.mqcb-drop.maybe, .mqcb-cell.mqcb-drop.valid, .mqcb-cell.mqcb-drop.invalid`).forEach((c) => {
      c.classList.remove("maybe", "valid", "invalid", "over");
    });
    this.root.querySelectorAll<HTMLElement>(`.mqcb-cell.mqcb-trash.over`).forEach((c) => c.classList.remove("over"));
  }

  private onCellDragOver(e: DragEvent) {
    const dt = e.dataTransfer;
    const cell = e.currentTarget as HTMLElement;
    const q = parseInt(cell.dataset.q || "-1", 10);
    const t = parseInt(cell.dataset.t || "-1", 10);
    if (!dt || q < 0 || t < 0) return;
    const gateType = dt.types.includes("application/x-mq-gate") ? (dt.getData("application/x-mq-gate") as GateType) : null;
    const moveId = dt.types.includes("application/x-mq-move") ? dt.getData("application/x-mq-move") : null;

    if (gateType || moveId) {
      e.preventDefault();
      const temp: GatePlacement | null = gateType
        ? { type: gateType, targets: [q], id: `temp-${Date.now()}` }
        : this.findGateById(moveId!);

      if (!temp) return;
      const placement: GatePlacement = { ...temp, targets: [q] };
      const ok = validatePlacement(this.circuit, t, placement, moveId || undefined).ok;
      cell.classList.add(ok ? "valid" : "invalid");
      cell.classList.add("over");
    }
  }

  private onCellDragLeave(e: DragEvent) {
    const cell = e.currentTarget as HTMLElement;
    cell.classList.remove("over");
  }

  private onCellDrop(e: DragEvent) {
    e.preventDefault();
    const cell = e.currentTarget as HTMLElement;
    const q = parseInt(cell.dataset.q || "-1", 10);
    const t = parseInt(cell.dataset.t || "-1", 10);
    const dt = e.dataTransfer!;

    const gateType = dt.types.includes("application/x-mq-gate") ? (dt.getData("application/x-mq-gate") as GateType) : null;
    const moveId = dt.types.includes("application/x-mq-move") ? dt.getData("application/x-mq-move") : null;

    if (gateType) {
      if (gateType === "CNOT") {
        // Place placeholder and ask for control wire selection
        const id = `g_${Math.random().toString(36).slice(2)}`;
        const candidate: GatePlacement = { type: "CNOT", targets: [q], controls: [], id };
        const valid = validatePlacement(this.circuit, t, candidate).ok;
        if (!valid) return this.toast("Invalid placement");
        // Commit target only for now
        this.circuit = addGate(this.circuit, t, candidate, { occupyInvolved: false });
        this.renderGrid();
        this.promptControlWire(t, id, q);
        return;
      } else {
        const id = `g_${Math.random().toString(36).slice(2)}`;
        const placement: GatePlacement = { type: gateType, targets: [q], id };
        const valid = validatePlacement(this.circuit, t, placement).ok;
        if (!valid) return this.toast("Invalid placement");
        this.circuit = addGate(this.circuit, t, placement);
      }
    } else if (moveId) {
      const gate = this.findGateById(moveId);
      if (!gate) return;
      const placement: GatePlacement = { ...gate, targets: [q] };
      const valid = validatePlacement(this.circuit, t, placement, moveId).ok;
      if (!valid) return this.toast("Invalid placement");
      this.circuit = moveGateById(this.circuit, moveId, t, q);
    }

    this.clearSelection();
    this.renderGrid();
    this.autoRunDebounced();
  }

  private onTrashDrop(e: DragEvent) {
    e.preventDefault();
    const dt = e.dataTransfer!;
    const moveId = dt.getData("application/x-mq-move");
    if (moveId) {
      this.circuit = removeGateById(this.circuit, moveId);
      this.clearSelection();
      this.renderGrid();
      this.autoRunDebounced();
    }
  }

  private promptControlWire(t: number, gateId: string, targetQ: number) {
    // Lightweight overlay effect: highlight wire labels and wait for a click
    const canvas = this.qs<HTMLElement>(".mqcb-canvas");
    canvas.classList.add("selecting-control");
    const cleanup = () => canvas.classList.remove("selecting-control");
    this.toast("Select control wire");
    const handler = (e: MouseEvent) => {
      const cell = (e.target as HTMLElement).closest(".mqcb-cell.mqcb-drop") as HTMLElement | null;
      if (!cell) return;
      const q = parseInt(cell.dataset.q || "-1", 10);
      if (q === targetQ) {
        this.toast("Control cannot equal target");
        return;
      }
      // Update the placeholder CNOT with selected control
      const gate = this.findGateById(gateId);
      if (!gate) return;
      const updated: GatePlacement = { ...gate, controls: [q] };
      const valid = validatePlacement(this.circuit, t, updated).ok;
      if (!valid) {
        this.toast("Invalid placement");
        cleanup();
        canvas.removeEventListener("click", handler);
        this.circuit = removeGateById(this.circuit, gateId);
        this.renderGrid();
        return;
      }
      // Commit occupancy for control
      this.circuit = addGate(this.circuit, t, updated, { overwrite: true });
      cleanup();
      canvas.removeEventListener("click", handler);
      this.renderGrid();
      this.autoRunDebounced();
    };
    canvas.addEventListener("click", handler);
  }

  private onCanvasKeyDown(e: KeyboardEvent) {
    if (e.key === "Delete" || e.key === "Backspace") {
      if (this.selectedGateId) {
        this.circuit = removeGateById(this.circuit, this.selectedGateId);
        this.clearSelection();
        this.renderGrid();
        this.autoRunDebounced();
      }
    }
  }

  private onChangeQubits(n: number) {
    if (n < MIN_QUBITS || n > MAX_QUBITS) return;
    const confirmReset = this.circuit.columns.some((c) => c.items.some(Boolean)) ? confirm("Changing qubits will clear the circuit. Continue?") : true;
    if (!confirmReset) {
      this.qs<HTMLSelectElement>(".mqcb-qubits").value = String(this.circuit.nQubits);
      return;
    }
    this.circuit = createEmptyCircuit(n, DEFAULT_COLUMNS);
    this.clearSelection();
    this.renderGrid();
    this.autoRunDebounced();
  }

  private clearSelection() {
    this.selectedGateId = null;
  }

  private findGateById(id: string): GatePlacement | null {
    for (let t = 0; t < this.circuit.columns.length; t++) {
      for (let q = 0; q < this.circuit.nQubits; q++) {
        const gp = this.circuit.columns[t].items[q];
        if (gp && gp.id === id) return gp;
      }
    }
    return null;
  }

  private runSimulation() {
    if (!this.worker) return;
    const payload = serializeCircuit(this.circuit);
    const msg = { type: "BuildAndRun", payload } as const;
    this.toggleResultsLoading(true);
    this.worker.postMessage(msg);
  }

  private onWorkerMessage(res: RunResult) {
    this.toggleResultsLoading(false);
    const errBox = this.qs<HTMLDivElement>(".mqcb-error");
    const probsList = this.qs<HTMLDivElement>(".mqcb-problist");
    const stateBox = this.qs<HTMLDivElement>(".mqcb-state");
    if (res.error) {
      errBox.hidden = false;
      errBox.textContent = res.error.message;
      probsList.innerHTML = "";
      stateBox.innerHTML = "";
      return;
    }
    errBox.hidden = true;
    probsList.innerHTML = this.renderProbList(res.probs || []);
    stateBox.innerHTML = this.renderStatevector(res.statevector);
  }

  private toggleResultsLoading(loading: boolean) {
    const header = this.qs<HTMLDivElement>(".mqcb-results-header");
    const base = this.getAttribute("data-label-results") || this.dataset.labelResults || "Results";
    header.textContent = loading ? `${base} (running…)` : base;
  }

  private renderProbList(probs: number[]) {
    if (!probs.length) return "";
    const pad = Math.ceil(Math.log2(probs.length));
    const items = probs.map((p, i) => {
      const bit = i.toString(2).padStart(pad, "0");
      const pct = (p * 100).toFixed(2) + "%";
      return `<div class="mqcb-prob"><code>${bit}</code><span class="bar" style="--w:${Math.max(1, p * 100)}%"></span><span class="val">${pct}</span></div>`;
    });
    return items.join("");
  }

  private renderStatevector(state?: { re: number[]; im: number[] }) {
    if (!state || !state.re || !state.im || state.re.length !== state.im.length) return "";
    const fmt = (x: number) => {
      const s = x.toFixed(4);
      return /-0\.0000/.test(s) ? "0.0000" : s;
    };
    const parts: string[] = [];
    for (let i = 0; i < state.re.length; i++) {
      const re = fmt(state.re[i]);
      const im = fmt(state.im[i]);
      parts.push(`<div class="mqcb-amp"><code>|${i.toString(2).padStart(Math.ceil(Math.log2(state.re.length)), "0")}\u27e9</code> = <span>${re} + ${im}i</span></div>`);
    }
    return parts.join("");
  }

  private toast(msg: string) {
    const t = this.qs<HTMLDivElement>(".mqcb-toast");
    t.textContent = msg;
    t.hidden = false;
    setTimeout(() => (t.hidden = true), 1600);
  }
}

// Define once
if (!customElements.get(QuantumCircuitElement.tag)) {
  customElements.define(QuantumCircuitElement.tag, QuantumCircuitElement);
}

export {};
