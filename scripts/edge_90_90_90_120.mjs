import { planBuild } from '../src/helpers/planner.js';

const goals = [
  { stat: 'Dodge Chance', value: 90 },
  { stat: 'Zombie Damage Reduction', value: 90 },
  { stat: 'Damage Reduction', value: 90 },
  { stat: 'Movement Speed', value: 120 }
];

const inventory = {
  l7: {
    red: 20,    // Dodge
    rotten: 20, // ZDR
    blue: 20,   // DR
    yellow: 20  // MS
  },
  supers: [],
  megas: []
};

const res = planBuild(goals, inventory, { maxMerges: 48, beamWidth: 24, topChildren: 14, timeLimitMs: 3000 });
console.log(JSON.stringify(res, null, 2));

