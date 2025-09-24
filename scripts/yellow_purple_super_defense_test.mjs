import { createSuperStone } from '../src/helpers/stoneCreation.js';
import { processSuperStoneEffects } from '../src/helpers/stoneCalculations.js';

const POWER_STONES = {
  yellow: {
    name: 'Yellow',
    color: '#f1c40f',
    offensive: 'AS',
    defensive: 'MS',
    offensiveType: 'percentage',
    defensiveType: 'percentage',
    offensiveLevels: [12, 15, 20, 25, 30, 35, 40],
    defensiveLevels: [10, 12, 15, 20, 25, 30, 35]
  },
  purple: {
    name: 'Purple',
    color: '#9b59b6',
    offensive: 'Life Drain',
    defensive: 'XP',
    offensiveType: 'percentage',
    defensiveType: 'percentage',
    offensiveLevels: [2, 4, 6, 8, 10, 15, 20],
    defensiveLevels: [10, 12, 15, 20, 25, 30, 35]
  }
};

const primary = { type: 'yellow', level: 7 };
const secondary = { type: 'purple', level: 7 };

const superStone = createSuperStone(primary, secondary, POWER_STONES);
const statsHelmet = processSuperStoneEffects(superStone, 'helmet');

console.log('Super (Yellow + Purple) on helmet => expected Movement Speed: 35, More XP: 17.5');
console.log(statsHelmet);

