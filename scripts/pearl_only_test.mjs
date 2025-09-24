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
  }
};

const testPearl = (level, slot) => {
  const stone = { type: 'pearl', level, data: POWER_STONES.pearl };
  return processStoneEffects(stone, slot, POWER_STONES);
};

console.log('--- Pearl Test START ---');
console.log('Pearl Lv1 on weapon (expect Base Damage +15):', testPearl(1, 'weapon'));
console.log('Pearl Lv7 on ring (expect Base Damage +75):', testPearl(7, 'ring'));
console.log('Pearl Lv3 on helmet (expect Stun Chance +3%):', testPearl(3, 'helmet'));
console.log('--- Pearl Test END ---');
