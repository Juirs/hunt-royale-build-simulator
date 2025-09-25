import { planBuild } from '../src/helpers/planner.js';

const goals = [
  { stat: 'Dodge Chance', value: 90 },
  { stat: 'Zombie Damage Reduction', value: 90 },
  { stat: 'Damage Reduction', value: 70 }
];

const inventory = {
  l7: {
    red: 1,
    green: 5,
    blue: 3,
    purple: 4,
    pearl: 5,
    yellow: 1,
    azure: 2,
  },
  supers: [
    { primary: 'green', secondary: 'yellow', qty: 2 },
    { primary: 'yellow', secondary: 'purple', qty: 4 },
    { primary: 'red', secondary: 'blue', qty: 4 },
    { primary: 'red', secondary: 'green', qty: 1 },
    { primary: 'red', secondary: 'yellow', qty: 1 },
    { primary: 'rotten', secondary: 'yellow', qty: 2 },
    { primary: 'earth', secondary: 'rotten', qty: 1 },
    { primary: 'earth', secondary: 'blue', qty: 1 },
  ],
  megas: []
};

const res = planBuild(goals, inventory, { debug: true, maxMerges: 48, beamWidth: 32, topChildren: 14, timeLimitMs: 5000 });
console.log(JSON.stringify(res, null, 2));
