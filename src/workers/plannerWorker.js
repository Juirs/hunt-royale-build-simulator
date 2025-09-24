// filepath: src/workers/plannerWorker.js
// Web Worker for planner to avoid blocking the UI thread

import { planBuild } from '../helpers/planner.js';

self.onmessage = (event) => {
  try {
    const { goals, inventory, options } = event.data || {};
    const res = planBuild(goals || [], inventory || {}, options || {});
    // Post back the raw result
    self.postMessage(res);
  } catch (err) {
    self.postMessage({ success: false, reason: (err && err.message) || 'Planner worker error', error: String(err) });
  }
};

