// filepath: scripts/actual_stones.mjs
import { planBuild } from '../src/helpers/planner.js';

const goals = [
    { stat: 'Dodge Chance', value: 90 },
    { stat: 'Zombie Damage Reduction', value: 90 },
    { stat: 'Damage Reduction', value: 70 }
];

const inventory = {
    l7: {
        red: 1, // Dodge
        green: 5, // HP
        blue: 3, // DR
        purple: 4, // XP
        pearl: 5, // Stun
        yellow: 1, // MS
        azure: 2, // Deep Freeze
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

const res = planBuild(goals, inventory, { socketLimit: 12, maxMerges: 30 });
console.log(JSON.stringify(res, null, 2));
