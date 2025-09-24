// filepath: scripts/four_goal_smoke.mjs
import { planBuild } from '../src/helpers/planner.js';

const goals = [
  { stat: 'Dodge Chance', value: 90 },
  { stat: 'Zombie Damage Reduction', value: 90 },
  { stat: 'Damage Reduction', value: 70 },
  { stat: 'Movement Speed', value: 100 }
];

// Empty inventory to force crafting plan
const inventory = {
  l7: {},
  supers: [],
  megas: []
};

const res = planBuild(goals, inventory, { maxMerges: 60, timeLimitMs: 1500, beamWidth: 24, topChildren: 12 });
console.log(JSON.stringify(res, null, 2));

