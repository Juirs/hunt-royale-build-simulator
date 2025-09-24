import { processStoneEffects } from '../src/helpers/stoneCalculations.js';

const POWER_STONES = {
  pearl: {
    name: 'Pearl',
    color: '#ecf0f1',
    offensive: 'Base Damage',
    defensive: 'Stun Chance',
    offensiveType: 'flat',
    defensiveType: 'percentage',
    offensiveLevels: [15, 20, 25, 30, 45, 60, 75],
    defensiveLevels: [1, 2, 3, 4, 5, 7, 10]
  },
  rotten: {
    name: 'Rotten',
    color: '#8B4513',
    offensive: 'Zombie Damage',
    defensive: 'Zombie Damage Reduction',
    offensiveSecondary: 'Base Damage',
    offensiveType: 'percentage',
    offensiveSecondaryType: 'flat',
    defensiveType: 'percentage',
    offensiveLevels: [5, 10, 15, 20, 30, 45, 60],
    offensiveFlatLevels: [2, 4, 6, 8, 10, 15, 20],
    defensiveLevels: [4, 6, 8, 10, 13, 16, 20]
  }
};

const test = (type, level, slot) => {
  const stone = { type, level, data: POWER_STONES[type] };
  const stats = processStoneEffects(stone, slot, POWER_STONES);
  return stats;
};

console.log('Pearl Lv1 on weapon (expect Base Damage +15):', test('pearl', 1, 'weapon'));
console.log('Pearl Lv7 on ring (expect Base Damage +75):', test('pearl', 7, 'ring'));
console.log('Pearl Lv3 on helmet (expect Stun Chance +3%):', test('pearl', 3, 'helmet'));
console.log('Rotten Lv1 on weapon (expect Zombie Damage +5% and Base Damage +2):', test('rotten', 1, 'weapon'));

