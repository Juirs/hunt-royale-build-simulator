// Edge case goals reproduction test for planner
import { planBuild } from '../src/helpers/planner.js';

const goals = [
  { stat: 'Dodge Chance', value: 90 },
  { stat: 'Zombie Damage Reduction', value: 90 },
  { stat: 'Damage Reduction', value: 88 },
  { stat: 'Movement Speed', value: 140 }
];

const inventory = {
  l7: {},
  supers: [],
  megas: []
};

const res = planBuild(goals, inventory, {
  maxMerges: 24, // exactly enough for 12 megas
  beamWidth: 12,
  topChildren: 8,
  timeLimitMs: 800
});

console.log(JSON.stringify(res, null, 2));

