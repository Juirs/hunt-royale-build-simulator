/**
 * UI utilities and rendering helpers
 */

import { isFlatStat, isOffensiveStat } from './stoneCalculations.js';

/**
 * Formats stat value for display (flat vs percentage)
 */
export const formatStatValue = (statName, value) => {
  const isFlat = isFlatStat(statName);
  if (isFlat) {
    // Always show two decimals for flat stats like HP and Base Damage
    return `+${Number(value).toFixed(2)}`;
  }
  return `+${value}%`;
};

/**
 * Categorizes stats into offensive and defensive groups
 */
export const categorizeStats = (stats) => {
  const offensiveStats = {};
  const defensiveStats = {};

  Object.entries(stats).forEach(([statName, value]) => {
    if (isOffensiveStat(statName)) {
      offensiveStats[statName] = value;
    } else {
      defensiveStats[statName] = value;
    }
  });

  return { offensiveStats, defensiveStats };
};

/**
 * Renders a stat category section - returns JSX element data
 */
export const renderStatCategory = (title, stats, emoji) => {
  if (Object.keys(stats).length === 0) return null;

  // Return an object that can be used to create JSX in the component
  return {
    title,
    emoji,
    stats: Object.entries(stats).map(([statName, value]) => ({
      statName,
      value,
      displayValue: formatStatValue(statName, value)
    }))
  };
};

/**
 * Creates equipment slot title text
 */
export const getSlotTitle = (slotType, gear, stones) => {
  if (slotType === 'pet') {
    return `${gear.name} (placeholder - pets coming soon!)`;
  }
  return `${gear.name} Level ${gear.level} (${stones.length}/4 power stones)`;
};

/**
 * Validates equipment slot for stone equipping
 */
export const validateSlotForStone = (equipmentSlot, currentStones) => {
  if (!equipmentSlot) {
    return { valid: false, message: 'Please drop the power stone on a specific equipment piece!' };
  }

  if (equipmentSlot === 'pet') {
    return { valid: false, message: 'Cannot equip power stones to pets!' };
  }

  if (currentStones.length >= 4) {
    return { valid: false, message: `Maximum 4 power stones allowed per equipment piece! ${equipmentSlot} is full.` };
  }

  return { valid: true };
};

/**
 * Creates level control data for gear - returns control configuration
 */
export const createLevelControls = (slotType, level, updateGearLevel) => {
  if (slotType === 'pet') return null;

  return {
    slotType,
    level,
    canDecrease: level > 1,
    canIncrease: level < 15,
    onDecrease: () => updateGearLevel(slotType, level - 1),
    onIncrease: () => updateGearLevel(slotType, level + 1)
  };
};

/**
 * Resolve the stone type key used for socket coloring
 */
export const getSocketStoneTypeKey = (stone) => (stone?.isSuper || stone?.isMega) ? stone.primaryType : stone?.type;

/**
 * Formats the equipped stone label for a slot (weapon/ring show offensive; armor shows defensive)
 */
export const formatEquippedStoneLabel = (stone, slot, POWER_STONES) => {
  if (stone.isMega) {
    return `🌟 ${stone.data.name} Lv.${stone.level} (+${stone.data.levels[0]}% / +${stone.data.secondaryLevels[0]}% / +${stone.data.tertiaryLevels[0]}%)`;
  }
  if (stone.isSuper) {
    return `⭐ ${stone.data.name} Lv.${stone.level} (+${stone.data.levels[0]}% / +${stone.data.secondaryLevels[0]}%)`;
  }

  const isOffensiveSlot = ['weapon', 'ring'].includes(slot);
  const stoneData = stone.data || POWER_STONES[stone.type];
  if (!stoneData) return `💎 Lv.${stone.level}`;

  if (isOffensiveSlot) {
    const offensiveValue = stoneData.offensiveLevels[stone.level - 1];
    const offensiveFlatValue = stoneData.offensiveFlatLevels ? stoneData.offensiveFlatLevels[stone.level - 1] : null;

    let display = `💎 ${stoneData.name} Lv.${stone.level} (${stoneData.offensive}: +${offensiveValue}${stoneData.offensiveType === 'flat' ? '' : '%'}`;
    if (stoneData.offensiveSecondary && offensiveFlatValue) {
      display += `, ${stoneData.offensiveSecondary}: +${offensiveFlatValue}`;
    }
    display += ')';
    return display;
  }

  // Defensive slot (helmet/chest/boots)
  const defensiveValue = stoneData.defensiveLevels[stone.level - 1];
  const displayUnit = stoneData.defensiveType === 'flat' ? '' : '%';
  return `💎 ${stoneData.name} Lv.${stone.level} (${stoneData.defensive}: +${defensiveValue}${displayUnit})`;
};