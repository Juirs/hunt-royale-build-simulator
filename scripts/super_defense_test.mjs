import { createSuperStone } from '../src/helpers/stoneCreation.js';
import { processSuperStoneEffects } from '../src/helpers/stoneCalculations.js';
import { createDragData } from '../src/helpers/dragAndDrop.js';

const POWER_STONES = {
  green: {
    name: 'Green',
    color: '#27ae60',
    offensive: 'Poison',
    defensive: 'HP',
    offensiveType: 'percentage',
    defensiveType: 'flat',
    offensiveLevels: [30, 40, 60, 80, 100, 150, 200],
    defensiveLevels: [90, 120, 150, 180, 210, 250, 300]
  },
  red: {
    name: 'Red',
    color: '#e74c3c',
    offensive: 'Burn Effect',
    defensive: 'Dodge Chance',
    offensiveType: 'percentage',
    defensiveType: 'percentage',
    offensiveLevels: [40, 60, 80, 100, 150, 225, 250],
    defensiveLevels: [3, 4, 5, 6, 8, 10, 12]
  }
};

const primary = { type: 'green', level: 7 };
const secondary = { type: 'red', level: 7 };

const superStone = createSuperStone(primary, secondary, POWER_STONES);

// Simulate drag-and-drop serialization path
const dragData = createDragData(superStone);
const serialized = JSON.stringify(dragData);
const deserialized = JSON.parse(serialized);

const statsHelmet = processSuperStoneEffects(deserialized, 'helmet');
const statsWeapon = processSuperStoneEffects(deserialized, 'weapon');

console.log('Has defensiveLevels in serialized data?', !!deserialized.data.defensiveLevels);
console.log('Super Stone Data snapshot:');
console.log({
  defensiveLevels: deserialized.data.defensiveLevels,
  secondaryDefensiveLevels: deserialized.data.secondaryDefensiveLevels
});
console.log('Stats on helmet (should include HP 300 and Dodge Chance 6):');
console.log(statsHelmet);
console.log('Stats on weapon (should include Poison 200% and Burn Effect 125%):');
console.log(statsWeapon);
