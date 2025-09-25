import { planBuild } from '../src/helpers/planner.js';

const goals = [
  { stat: 'Dodge Chance', value: 12 },
  { stat: 'Zombie Damage Reduction', value: 10 },
  { stat: 'Damage Reduction', value: 5.5 }
];

const inventory = {
  l7: { red: 0, rotten: 0, blue: 0 },
  supers: [],
  megas: [ { primary: 'red', secondary: 'rotten', tertiary: 'blue', qty: 1 } ]
};

const res = planBuild(goals, inventory, { maxMerges: 10, beamWidth: 16, topChildren: 10, timeLimitMs: 2000 });
console.log(JSON.stringify(res, null, 2));

