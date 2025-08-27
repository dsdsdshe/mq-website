// Placeholder for future layout helpers (connectors, hit testing)
// Keeping here for maintainability and possible unit testing in future.

export type Connector = { column: number; minQ: number; maxQ: number };

export function computeConnector(column: number, wires: number[]): Connector {
  const minQ = Math.min(...wires);
  const maxQ = Math.max(...wires);
  return { column, minQ, maxQ };
}

