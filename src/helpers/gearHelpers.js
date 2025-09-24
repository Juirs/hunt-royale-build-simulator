/**
 * Gear statistics and management utilities
 */

/**
 * Maps gear stats from internal names to display names
 */
const GEAR_STAT_MAPPING = {
  damage: 'Base Damage',
  hp: 'HP',
  attackSpeed: 'Attack Speed',
  movementSpeed: 'Movement Speed',
  moreXP: 'More XP',
  moreCoins: 'More Coins',
  undeadDamage: 'Undead Damage',
  damagePercent: 'Damage',
  bossDamage: 'Boss Damage'
};

/**
 * Calculates gear stats for a specific piece at a given level
 */
export const calculateGearStats = (gearType, level, TITAN_GEAR_STATS) => {
  return TITAN_GEAR_STATS[level] || TITAN_GEAR_STATS[1];
};

/**
 * Calculates total gear stats from all equipped gear pieces
 */
export const calculateTotalGearStats = (gearLevels, TITAN_GEAR_STATS) => {
  const totalStats = {
    damage: 0,
    hp: 0,
    attackSpeed: 0,
    movementSpeed: 0,
    moreXP: 0,
    moreCoins: 0,
    undeadDamage: 0,
    damagePercent: 0,
    bossDamage: 0
  };

  // Sum stats from all gear pieces (excluding pet)
  Object.entries(gearLevels).forEach(([gearType, level]) => {
    const gearStats = calculateGearStats(gearType, level, TITAN_GEAR_STATS);
    Object.keys(totalStats).forEach(stat => {
      totalStats[stat] += gearStats[stat];
    });
  });

  return totalStats;
};

/**
 * Maps gear stats to display names and adds to stats object
 */
export const addGearStatsToTotal = (stats, gearStats) => {
  Object.entries(gearStats).forEach(([statKey, value]) => {
    if (value > 0) {
      const displayName = GEAR_STAT_MAPPING[statKey];
      if (displayName) {
        stats[displayName] = (stats[displayName] || 0) + value;
      }
    }
  });
};

/**
 * Generates gear data with current levels
 */
export const generateGearData = (gearLevels) => {
  const gear = {};

  // Process leveled gear pieces
  Object.entries(gearLevels).forEach(([type, level]) => {
    gear[type] = {
      id: `${type}1`,
      name: type === 'chest' ? 'Chest Armor' : type.charAt(0).toUpperCase() + type.slice(1),
      type,
      level
    };
  });

  // Add pet with no level
  gear.pet = { id: 'pet1', name: 'Pet', type: 'pet' };

  return gear;
};

/**
 * Validates gear level update
 */
export const validateGearLevelUpdate = (newLevel) => {
  return newLevel >= 1 && newLevel <= 15;
};

/**
 * Calculates total gear score from gear levels, gear ranks, and power stones
 */
export const calculateGearScore = (
  gearLevels,
  gearRanks,
  powerStonesBySlot,
  TITAN_GEAR_STATS,
  POWER_STONE_GEAR_SCORES
) => {
  let total = 0;

  // Add gear scores strictly via gearScore per level
  Object.values(gearLevels).forEach((level) => {
    const levelStats = TITAN_GEAR_STATS[level];
    if (levelStats && typeof levelStats.gearScore === 'number') {
      total += levelStats.gearScore;
    }
  });

  // Rank bonus: each piece at rank 2 adds +150
  Object.values(gearRanks || {}).forEach((rank) => {
    if (Number(rank) === 2) total += 150;
  });

  // Power stones gear scores
  Object.values(powerStonesBySlot).forEach((stones) => {
    stones.forEach((stone) => {
      total += POWER_STONE_GEAR_SCORES[stone.level] || 0;
    });
  });

  return total;
};