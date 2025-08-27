/// <reference lib="webworker" />
import type { BuildAndRunMessage, BuildAndRunResult } from "./adapter";
import { buildAndRun } from "./adapter";

declare const self: DedicatedWorkerGlobalScope;

self.onmessage = async (e: MessageEvent<BuildAndRunMessage>) => {
  const msg = e.data;
  if (!msg || msg.type !== "BuildAndRun") return;
  const res = await buildAndRun(msg.payload);
  const out: BuildAndRunResult = res;
  self.postMessage(out);
};

export {};

