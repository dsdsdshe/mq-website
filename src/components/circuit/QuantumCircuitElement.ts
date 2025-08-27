// Vanilla web component implementing the interactive circuit builder
// UI logic is encapsulated here; simulation runs in a web worker.

import type { Circuit, GatePlacement, GateType } from "../../lib/circuit/model";
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

const TEMPLATE_STYLES = /* css */ `
<style>
  :host { 
    display: block; 
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
  }
  
  /* Core variables with fallbacks */
  :host {
    --mq-primary: oklch(61% 0.17 260);
    --mq-primary-contrast: #ffffff;
    --mq-bg: oklch(99% 0 0);
    --mq-surface: oklch(98% 0.01 240);
    --mq-surface-2: oklch(97% 0.01 240);
    --mq-border: color-mix(in oklab, oklch(45% 0.02 250), transparent 65%);
    --mq-text: oklch(27% 0.02 250);
    --mq-text-muted: oklch(45% 0.02 250);
    --mq-radius: 12px;
    --mq-shadow: 0 1px 2px rgba(0,0,0,.04), 0 10px 24px rgba(0,0,0,.06);
    --mq-font-sans: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
    --mq-font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  }
  
  .mqcb-root { 
    border: 1px solid var(--mq-border); 
    border-radius: var(--mq-radius); 
    background: var(--mq-surface-2); 
    box-shadow: var(--mq-shadow); 
  }
  
  .mqcb-topbar { 
    display: flex; 
    gap: 1rem; 
    align-items: center; 
    justify-content: space-between; 
    padding: .75rem; 
    border-bottom: 1px solid var(--mq-border); 
  }
  
  .mqcb-palette { 
    display: flex; 
    gap: .5rem; 
    flex-wrap: wrap; 
  }
  
  .mqcb-gate { 
    border: 1px solid var(--mq-border); 
    background: var(--mq-surface); 
    color: var(--mq-text); 
    border-radius: .5rem; 
    padding: .4rem .6rem; 
    cursor: grab; 
  }
  
  .mqcb-gate:hover { 
    filter: brightness(1.05); 
  }
  
  .mqcb-g-h { background: color-mix(in oklab, var(--mq-primary), white 80%); }
  .mqcb-g-x { background: color-mix(in oklab, var(--mq-primary), white 70%); }
  .mqcb-g-z { background: color-mix(in oklab, var(--mq-primary), white 60%); }
  .mqcb-g-cnot { background: color-mix(in oklab, var(--mq-primary), white 50%); }

  .mqcb-controls { 
    display: flex; 
    gap: .5rem; 
    align-items: center; 
  }
  
  .mqcb-label { 
    margin-right: .25rem; 
    color: var(--mq-text-muted); 
    font-size: .9rem; 
  }
  
  .mqcb-qubits { 
    padding: .35rem .5rem; 
    border-radius: .5rem; 
    border: 1px solid var(--mq-border); 
    background: var(--mq-surface); 
    color: var(--mq-text); 
  }

  .mqcb-canvas { 
    overflow-x: auto; 
    padding: .75rem; 
  }
  
  .mqcb-grid { 
    display: grid; 
    gap: 4px; 
    align-items: center; 
  }
  
  .mqcb-row { 
    display: contents; 
  }
  
  .mqcb-header .mqcb-time { 
    text-align: center; 
    color: var(--mq-text-muted); 
    font-size: .85rem; 
    padding: .25rem 0; 
  }
  
  .mqcb-cell { 
    min-height: 42px; 
    position: relative; 
  }
  
  .mqcb-wirelabel { 
    color: var(--mq-text-muted); 
    font-size: .9rem; 
    padding: .25rem .5rem; 
  }
  
  .mqcb-drop { 
    background: var(--mq-surface); 
    border: 1px dashed var(--mq-border); 
    border-radius: .5rem; 
  }
  
  .mqcb-drop.over.valid { 
    outline: 2px solid color-mix(in oklab, var(--mq-primary), white 35%); 
  }
  
  .mqcb-drop.over.invalid { 
    outline: 2px solid oklch(65% 0.22 25); 
  }
  
  .mqcb-drop.maybe { 
    background-image: linear-gradient(45deg, transparent 35%, color-mix(in oklab, var(--mq-primary), white 85%) 35%, color-mix(in oklab, var(--mq-primary), white 85%) 65%, transparent 65%); 
    background-size: 12px 12px; 
  }

  .mqcb-wire { 
    pointer-events: none; 
    position: absolute; 
    left: 0; 
    right: 0; 
    top: calc(50% - 1px); 
    height: 2px; 
    background: var(--mq-border); 
  }

  .mqcb-chip { 
    position: absolute; 
    left: 50%; 
    top: 50%; 
    transform: translate(-50%, -50%); 
    border: 1px solid var(--mq-border); 
    border-radius: .4rem; 
    padding: .25rem .5rem; 
    min-width: 28px; 
    background: var(--mq-surface); 
    cursor: grab; 
    text-align: center;
    color: var(--mq-text);
    font-size: 0.875rem;
    font-weight: 500;
  }
  
  .mqcb-chip.selected { 
    box-shadow: 0 0 0 2px color-mix(in oklab, var(--mq-primary), white 50%); 
  }
  
  .mqcb-chip.control { 
    background: color-mix(in oklab, var(--mq-primary), white 60%); 
  }
  
  .mqcb-chip.target { 
    background: color-mix(in oklab, var(--mq-primary), white 40%); 
  }

  .mqcb-drop.has-connector::before { 
    content: ""; 
    position: absolute; 
    left: calc(50% - 1px); 
    top: -50%; 
    bottom: -50%; 
    width: 2px; 
    background: var(--mq-primary); 
    opacity: .4; 
  }

  .mqcb-footer .mqcb-trash { 
    border: 1px dashed var(--mq-border); 
    border-radius: .5rem; 
    background: repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(0,0,0,.04) 6px, rgba(0,0,0,.04) 12px); 
    min-height: 24px; 
  }
  
  .mqcb-footer .mqcb-trash.over { 
    outline: 2px solid oklch(65% 0.22 25); 
  }

  .mqcb-canvas.selecting-control .mqcb-drop { 
    outline: 1px dashed color-mix(in oklab, var(--mq-primary), white 40%); 
  }

  .mqcb-results { 
    border-top: 1px solid var(--mq-border); 
    padding: .75rem; 
    background: var(--mq-surface); 
    border-bottom-left-radius: var(--mq-radius); 
    border-bottom-right-radius: var(--mq-radius); 
  }
  
  .mqcb-results-header { 
    font-weight: 600; 
    margin-bottom: .5rem; 
    color: var(--mq-text);
  }
  
  .mqcb-subheading { 
    font-weight: 600; 
    margin: .5rem 0; 
    color: var(--mq-text);
  }
  
  .mqcb-prob { 
    display: grid; 
    grid-template-columns: 5ch 1fr auto; 
    gap: .5rem; 
    align-items: center; 
    margin: .25rem 0; 
  }
  
  .mqcb-prob .bar { 
    height: 6px; 
    border-radius: 4px; 
    background: color-mix(in oklab, var(--mq-primary), white 40%); 
    width: var(--w, 1%); 
  }
  
  .mqcb-prob .val { 
    color: var(--mq-text-muted); 
    font-variant-numeric: tabular-nums; 
  }
  
  .mqcb-amp { 
    font-family: var(--mq-font-mono); 
    font-size: .9rem; 
    color: var(--mq-text-muted); 
  }
  
  .mqcb-error { 
    color: oklch(65% 0.22 25); 
  }

  .mqcb-toast { 
    position: fixed; 
    right: 1rem; 
    bottom: 1rem; 
    background: var(--mq-surface-2); 
    color: var(--mq-text); 
    border: 1px solid var(--mq-border); 
    padding: .5rem .75rem; 
    border-radius: .5rem; 
    box-shadow: var(--mq-shadow); 
    z-index: 1000;
  }
  
  button, select {
    font-family: inherit;
    font-size: inherit;
  }

  @media (max-width: 960px) {
    .mqcb-cell { 
      min-width: 44px; 
    }
  }
</style>
`;

const TEMPLATE_HTML = /* html */ `
  ${TEMPLATE_STYLES}
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
      </div>
    </div>

    <div class="mqcb-canvas" tabindex="0" aria-label="Circuit Canvas" role="application">
      <!-- grid injected -->
    </div>

    <div class="mqcb-results" aria-live="polite">
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
  private autoRunDebounced: () => void;

  constructor() {
    super();
    this.root = this.attachShadow({ mode: "open" });
    this.autoRunDebounced = debounce(() => this.runSimulation(), 300);
  }

  connectedCallback() {
    this.render();
    this.applyLabels();
    // Worker disabled - using main thread for simulation
    // this.ensureWorker();
    this.bindEvents();
  }

  disconnectedCallback() {
    // Cleanup if needed
  }

  private render() {
    this.root.innerHTML = TEMPLATE_HTML;
    this.renderPalette();
    this.renderGrid();
  }

  private applyLabels() {
    const labels = {
      qubits: this.getAttribute("data-label-qubits") || this.dataset.labelQubits || "Qubits",
      probs: this.getAttribute("data-label-probs") || this.dataset.labelProbs || "Measurement Probabilities",
    };
    const q = this.root.querySelector<HTMLElement>('[data-label="qubits"]');
    const pr = this.root.querySelector<HTMLElement>('[data-label="probs"]');
    if (q) q.textContent = labels.qubits;
    if (pr) pr.textContent = labels.probs;
  }

  private bindEvents() {
    const qubitsSel = this.qs<HTMLSelectElement>(".mqcb-qubits");
    qubitsSel.value = String(this.circuit.nQubits);
    qubitsSel.addEventListener("change", () => this.onChangeQubits(parseInt(qubitsSel.value, 10)));

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
        if (!e.dataTransfer) return;
        e.dataTransfer.setData("application/x-mq-gate", g.type);
        e.dataTransfer.setData("text/plain", g.type);
        e.dataTransfer.effectAllowed = "copy";
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
    table.style.gridTemplateColumns = `auto repeat(${this.circuit.columns.length}, minmax(48px, 1fr))`;

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

  private highlightValidTargetsForMove(_id: string) {
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
    
    if (!dt || q < 0 || t < 0) {
      return;
    }
    
    // Check if this is a gate drag or a move drag
    const hasGate = Array.from(dt.types).some(type => type === "application/x-mq-gate" || type === "text/plain");
    const hasMove = Array.from(dt.types).some(type => type === "application/x-mq-move");
    
    if (hasGate || hasMove) {
      e.preventDefault();
      
      // We can't actually read the data during dragover due to browser security
      // So we just prevent default and add visual feedback
      cell.classList.add("over");
      cell.classList.add("valid");
    }
  }

  private onCellDragLeave(e: DragEvent) {
    const cell = e.currentTarget as HTMLElement;
    cell.classList.remove("over", "valid", "invalid");
  }

  private onCellDrop(e: DragEvent) {
    e.preventDefault();
    const cell = e.currentTarget as HTMLElement;
    const q = parseInt(cell.dataset.q || "-1", 10);
    const t = parseInt(cell.dataset.t || "-1", 10);
    
    if (!e.dataTransfer || q < 0 || t < 0) return;
    
    const dt = e.dataTransfer;
    
    // Try to get gate type or move ID from dataTransfer
    let gateType: GateType | null = null;
    let moveId: string | null = null;
    
    try {
      // Try to get custom MIME type first
      const customGate = dt.getData("application/x-mq-gate");
      if (customGate) {
        gateType = customGate as GateType;
      }
      const customMove = dt.getData("application/x-mq-move");
      if (customMove) {
        moveId = customMove;
      }
    } catch (e) {
      // Fallback to text/plain if custom type fails
      const plainText = dt.getData("text/plain");
      if (plainText && ["H", "X", "Z", "CNOT"].includes(plainText)) {
        gateType = plainText as GateType;
      }
    }

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
    this.clearDragHighlights();
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
    this.clearDragHighlights();
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

  private async runSimulation() {
    try {
      // Run simulation directly in main thread since quantum-circuit needs DOM APIs
      const { buildAndRun } = await import("../../lib/sim/adapter");
      const payload = serializeCircuit(this.circuit);
      const result = await buildAndRun(payload);
      this.onSimulationResult(result);
    } catch (err: any) {
      console.error("Simulation error:", err);
      this.onSimulationResult({
        error: { 
          code: "sim_error", 
          message: err.message || "Simulation failed"
        }
      });
    }
  }

  private onSimulationResult(res: RunResult) {
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

export { QuantumCircuitElement };
