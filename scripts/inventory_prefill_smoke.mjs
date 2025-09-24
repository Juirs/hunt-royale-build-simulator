// Inventory prefill smoke test
import { planBuild } from '../src/helpers/planner.js';

const goals = [
  { stat: 'Dodge Chance', value: 60 },
  { stat: 'Zombie Damage Reduction', value: 60 },
  { stat: 'Damage Reduction', value: 40 }
];

const inventory = {
  l7: {
    red: 3,      // Dodge
    rotten: 4,   // ZDR
    blue: 2      // DR
  },
  supers: [
    { primary: 'red', secondary: 'rotten', qty: 1 }
  ],
  megas: []
};

const res = planBuild(goals, inventory, { maxMerges: 24, timeLimitMs: 1200, beamWidth: 16, topChildren: 10 });
console.log(JSON.stringify(res, null, 2));

