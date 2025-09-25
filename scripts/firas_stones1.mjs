// filepath: scripts/firas_stones.mjs
import { planBuild } from '../src/helpers/planner.js';

const goals = [
    { stat: 'Dodge Chance', value: 90 },
    { stat: 'Zombie Damage Reduction', value: 90 },
    { stat: 'Damage Reduction', value: 88 }
];

const inventory = {
    l7: {
        rotten: 5, // ZDR
        red: 5, // Dodge
        green: 5, // HP
        blue: 8, // DR
        purple: 4, // XP
        pearl: 8, // Stun
        yellow: 11, // MS
        azure: 7, // Deep Freeze
        earth: 7 // Earth
    },
    supers: [
        { primary: 'green', secondary: 'purple', qty: 8 },
        { primary: 'red', secondary: 'blue', qty: 4 }
    ],
    megas: [
        { primary: 'red', secondary: 'rotten', tertiary: 'blue', qty: 4 },
        { primary: 'earth', secondary: 'blue', tertiary: 'red', qty: 2 },
        { primary: 'earth', secondary: 'red', tertiary: 'green', qty: 2 }
    ]
};

const res = planBuild(goals, inventory, { socketLimit: 12, maxMerges: 30 });
console.log(JSON.stringify(res, null, 2));
