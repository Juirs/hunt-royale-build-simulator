import { planBuild } from '../src/helpers/planner.js';

const goals = [
  { stat: 'Dodge Chance', value: 90 },
  { stat: 'Zombie Damage Reduction', value: 90 },
  { stat: 'Damage Reduction', value: 70 }
];

const inventory = {
  l7: {
    red: 0,
    blue: 0,
    rotten: 0,
  },
  supers: [],
  megas: []
};

const res = planBuild(goals, inventory, { socketLimit: 12, maxMerges: 30 });
console.log(JSON.stringify(res, null, 2));

