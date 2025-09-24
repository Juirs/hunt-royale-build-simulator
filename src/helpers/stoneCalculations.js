// Stone calculation utilities
export const STONE_SLOT_TYPES = {
  OFFENSIVE: ['weapon', 'ring'],
  DEFENSIVE: ['helmet', 'chest', 'boots']
};

// Canonical flat stat names
export const FLAT_STAT_NAMES = ['Base Damage', 'HP'];

// Map alt/abbrev names from stones to canonical display names
const STAT_NAME_NORMALIZATION = {
  // Offensive synonyms
  'Zombie Damage': 'Z Damage', // unify to the stone's label form without merging into Undead
  'Burn': 'Burn Effect',
  'Tentacles': 'Tentacles Chance',
  'AS': 'Attack Speed',
  // Defensive/utility synonyms
  'MS': 'Movement Speed',
  'XP': 'More XP',
  'DR': 'Damage Reduction',
  'Stun': 'Stun Chance'
};

const normalizeStatName = (name) => STAT_NAME_NORMALIZATION[name] || name;

// Canonical list of offensive stats used for categorization
export const OFFENSIVE_STATS = [
  'Z Damage', 'Undead Damage', 'Base Damage', 'Burn Effect', 'Poison', 'Tentacles Chance',
  'Life Drain', 'Attack Speed', 'Blast Nova', 'Earth Damage', 'Damage',
  'Boss Damage'
];

/**
 * Determines if a slot type is offensive or defensive
 */
export const isOffensiveSlot = (slotType) => STONE_SLOT_TYPES.OFFENSIVE.includes(slotType);
export const isDefensiveSlot = (slotType) => STONE_SLOT_TYPES.DEFENSIVE.includes(slotType);

/**
 * Determines if a stat is flat (non-percentage) based
 */
export const isFlatStat = (statName) => FLAT_STAT_NAMES.includes(statName);

/**
 * Determines if a stat is offensive
 */
export const isOffensiveStat = (statName) => OFFENSIVE_STATS.includes(statName);

/**
 * Gets stone values at a specific level (0-indexed)
 */
export const getStoneValuesAtLevel = (stoneData, level) => {
  const index = level - 1;
  return {
    offensive: stoneData.offensiveLevels?.[index] || 0,
    defensive: stoneData.defensiveLevels?.[index] || 0,
    offensiveFlat: stoneData.offensiveFlatLevels?.[index] || 0
  };
};

/**
 * Adds stat value to stats object, handling flat vs percentage types
 */
export const addStatValue = (stats, statName, value) => {
  const key = normalizeStatName(statName);
  if (value > 0) {
    stats[key] = (stats[key] || 0) + value;
  }
};

/**
 * Processes regular stone effects for a given slot type
 */
export const processRegularStoneEffects = (stone, slotType, POWER_STONES) => {
  const stats = {};
  const stoneData = POWER_STONES[stone.type];
  const values = getStoneValuesAtLevel(stoneData, stone.level);

  if (isOffensiveSlot(slotType)) {
    // Primary offensive effect
    const isFlat = stoneData.offensiveType === 'flat';
    // If flat and no explicit offensiveFlatLevels, fall back to offensiveLevels (e.g., Pearl)
    const value = isFlat
      ? (stoneData.offensiveFlatLevels ? values.offensiveFlat : values.offensive)
      : values.offensive;
    addStatValue(stats, stoneData.offensive, value);

    // Secondary offensive effect (e.g., Rotten stone)
    if (stoneData.offensiveSecondary && values.offensiveFlat && stoneData.offensiveSecondaryType === 'flat') {
      addStatValue(stats, stoneData.offensiveSecondary, values.offensiveFlat);
    }
  }

  if (isDefensiveSlot(slotType)) {
    addStatValue(stats, stoneData.defensive, values.defensive);
  }

  return stats;
};

/**
 * Processes super stone effects with primary and secondary bonuses
 */
export const processSuperStoneEffects = (stone, slotType) => {
  const stats = {};
  const { data } = stone;

  if (isOffensiveSlot(slotType)) {
    // Primary effects (100%)
    addStatValue(stats, data.offensive, data.levels[0]);

    if (data.offensiveSecondary && data.flatLevels) {
      addStatValue(stats, data.offensiveSecondary, data.flatLevels[0]);
    }

    // Secondary effects (50%)
    if (data.secondaryOffensive && data.secondaryLevels) {
      addStatValue(stats, data.secondaryOffensive, data.secondaryLevels[0]);
    }

    // Apply secondary flat using explicit mapping or type inference
    if (data.secondaryFlatLevels) {
      const inferred = inferFlatSecondaryNameByType(stone.secondaryType);
      const flatName = data.secondaryOffensiveSecondary || inferred;
      if (flatName) {
        addStatValue(stats, flatName, data.secondaryFlatLevels[0]);
      }
    }
  }

  if (isDefensiveSlot(slotType)) {
    // Primary defensive effects (100%) - Always use defensiveLevels for defensive effects
    if (data.defensiveLevels && data.defensiveLevels[0] !== undefined && data.defensiveLevels[0] !== null) {
      addStatValue(stats, data.defensive, data.defensiveLevels[0]);
    }

    // Secondary defensive effects (50%)
    if (data.secondaryDefensive && data.secondaryDefensiveLevels && data.secondaryDefensiveLevels[0] !== undefined) {
      addStatValue(stats, data.secondaryDefensive, data.secondaryDefensiveLevels[0]);
    }
  }

  return stats;
};

/**
 * Processes mega stone effects with primary, secondary, and tertiary bonuses
 */
export const processMegaStoneEffects = (stone, slotType) => {
  const stats = {};
  const { data } = stone;

  if (isOffensiveSlot(slotType)) {
    // Primary effects (100% of super stone primary)
    addStatValue(stats, data.offensive, data.levels[0]);

    if (data.offensiveSecondary && data.flatLevels) {
      addStatValue(stats, data.offensiveSecondary, data.flatLevels[0]);
    }

    // Secondary effects (100% of super stone secondary)
    if (data.secondaryOffensive && data.secondaryLevels) {
      addStatValue(stats, data.secondaryOffensive, data.secondaryLevels[0]);
    }

    // Apply secondary flat using explicit mapping or type inference
    if (data.secondaryFlatLevels) {
      const inferred = inferFlatSecondaryNameByType(stone.secondaryType);
      const flatName = data.secondaryOffensiveSecondary || inferred;
      if (flatName) {
        addStatValue(stats, flatName, data.secondaryFlatLevels[0]);
      }
    }

    // Tertiary effects (50% of regular stone)
    if (data.tertiaryOffensive && data.tertiaryLevels) {
      addStatValue(stats, data.tertiaryOffensive, data.tertiaryLevels[0]);
    }

    // Apply tertiary flat using explicit mapping or type inference
    if (data.tertiaryFlatLevels) {
      const inferred = inferFlatSecondaryNameByType(stone.tertiaryType);
      const flatName = data.tertiaryOffensiveSecondary || inferred;
      if (flatName) {
        addStatValue(stats, flatName, data.tertiaryFlatLevels[0]);
      }
    }
  }

  if (isDefensiveSlot(slotType)) {
    // Primary defensive effects (100%) - Always use defensiveLevels for defensive effects
    if (data.defensiveLevels && data.defensiveLevels[0] !== undefined) {
      addStatValue(stats, data.defensive, data.defensiveLevels[0]);
    }

    // Secondary defensive effects (100%)
    if (data.secondaryDefensive && data.secondaryDefensiveLevels) {
      addStatValue(stats, data.secondaryDefensive, data.secondaryDefensiveLevels[0]);
    }

    // Tertiary defensive effects (50%)
    if (data.tertiaryDefensive && data.tertiaryDefensiveLevels) {
      addStatValue(stats, data.tertiaryDefensive, data.tertiaryDefensiveLevels[0]);
    }
  }

  return stats;
};

/**
 * Main function to process any stone type and return its stat effects
 */
export const processStoneEffects = (stone, slotType, POWER_STONES) => {
  if (stone.isMega) {
    return processMegaStoneEffects(stone, slotType);
  } else if (stone.isSuper) {
    return processSuperStoneEffects(stone, slotType);
  } else {
    return processRegularStoneEffects(stone, slotType, POWER_STONES);
  }
};

// Fallback mapping: secondary/tertiary flat stat names by stone type (for older objects)
const SECONDARY_FLAT_BY_TYPE = {
  rotten: 'Base Damage'
};

const inferFlatSecondaryNameByType = (type) => SECONDARY_FLAT_BY_TYPE[type] || null;