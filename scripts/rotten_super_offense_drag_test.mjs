import { createSuperStone } from '../src/helpers/stoneCreation.js';
import { processSuperStoneEffects } from '../src/helpers/stoneCalculations.js';
import { createDragData } from '../src/helpers/dragAndDrop.js';

const POWER_STONES = {
  red: {
    name: 'Red',
    color: '#e74c3c',
    offensive: 'Burn',
    defensive: 'Dodge',
    offensiveType: 'percentage',
    defensiveType: 'percentage',
    offensiveLevels: [40, 60, 80, 100, 150, 225, 250],
    defensiveLevels: [3, 4, 5, 6, 8, 10, 12]
  },
  rotten: {
    name: 'Rotten',
    color: '#8B4513',
    offensive: 'Z Damage',
    defensive: 'ZDR',
    offensiveSecondary: 'Base Damage',
    offensiveType: 'percentage',
    offensiveSecondaryType: 'flat',
    defensiveType: 'percentage',
    offensiveLevels: [5, 10, 15, 20, 30, 45, 60],
    offensiveFlatLevels: [2, 4, 6, 8, 10, 15, 20],
    defensiveLevels: [4, 6, 8, 10, 13, 16, 20]
  }
};

const primary = { type: 'red', level: 7 };
const secondary = { type: 'rotten', level: 7 };

const superStone = createSuperStone(primary, secondary, POWER_STONES);
const dragData = createDragData(superStone);
const serialized = JSON.stringify(dragData);
const deserialized = JSON.parse(serialized);

const offensiveStats = processSuperStoneEffects(deserialized, 'weapon');
console.log('After drag serialization (Super Red+Rotten) on weapon => expected Z Damage: 30, Base Damage: +10');
console.log(offensiveStats);

