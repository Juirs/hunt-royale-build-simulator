/**
 * Stone creation and management utilities
 */

/**
 * Creates a super stone by merging two level 7 stones
 */
export const createSuperStone = (primaryStone, secondaryStone, POWER_STONES) => {
    const primaryData = POWER_STONES[primaryStone.type];
    const secondaryData = POWER_STONES[secondaryStone.type];

    // Get level 7 values (index 6)
    const primaryOffensive7 = primaryData.offensiveLevels[6];
    const primaryDefensive7 = primaryData.defensiveLevels[6];
    const secondaryOffensive7 = secondaryData.offensiveLevels[6];
    const secondaryDefensive7 = secondaryData.defensiveLevels[6];
    const primaryFlat7 = primaryData.offensiveFlatLevels?.[6] || null;
    const secondaryFlat7 = secondaryData.offensiveFlatLevels?.[6] || null;

    return {
        type: `super_${primaryStone.type}_${secondaryStone.type}`,
        level: 8,
        isSuper: true,
        primaryType: primaryStone.type,
        secondaryType: secondaryStone.type,
        data: {
            name: `Super ${primaryData.name}`,
            color: primaryData.color,
            // Primary stone effects at 100%
            offensive: primaryData.offensive,
            defensive: primaryData.defensive,
            offensiveType: primaryData.offensiveType,
            defensiveType: primaryData.defensiveType,
            offensiveSecondary: primaryData.offensiveSecondary,
            offensiveSecondaryType: primaryData.offensiveSecondaryType,
            // Primary values at 100%
            levels: [primaryOffensive7],
            defensiveLevels: [primaryDefensive7],
            flatLevels: primaryFlat7 ? [primaryFlat7] : null,
            // Secondary values at 50%
            secondaryOffensive: secondaryData.offensive,
            secondaryDefensive: secondaryData.defensive,
            secondaryOffensiveType: secondaryData.offensiveType,
            secondaryDefensiveType: secondaryData.defensiveType,
            // Include secondary's own flat stat name/type (e.g., Base Damage for Rotten)
            secondaryOffensiveSecondary: secondaryData.offensiveSecondary || null,
            secondaryOffensiveSecondaryType: secondaryData.offensiveSecondaryType || null,
            secondaryLevels: [secondaryOffensive7 / 2],
            secondaryDefensiveLevels: [secondaryDefensive7 / 2],
            secondaryFlatLevels: secondaryFlat7 ? [secondaryFlat7 / 2] : null
        }
    };
};

/**
 * Creates a mega stone by merging a super stone with a level 7 regular stone
 */
export const createMegaStone = (superStone, regularStone, POWER_STONES) => {
    const regularData = POWER_STONES[regularStone.type];

    // Get level 7 values from regular stone
    const regularOffensive7 = regularData.offensiveLevels[6];
    const regularDefensive7 = regularData.defensiveLevels[6];
    const regularFlat7 = regularData.offensiveFlatLevels?.[6] || null;

    return {
        type: `mega_${superStone.primaryType}_${superStone.secondaryType}_${regularStone.type}`,
        level: 9,
        isMega: true,
        primaryType: superStone.primaryType,
        secondaryType: superStone.secondaryType,
        tertiaryType: regularStone.type,
        data: {
            ...superStone.data,
            name: `Mega ${POWER_STONES[superStone.primaryType].name}`,
            color: superStone.data.color,
            // Add tertiary effects from regular stone at 50%
            tertiaryOffensive: regularData.offensive,
            tertiaryDefensive: regularData.defensive,
            tertiaryOffensiveType: regularData.offensiveType,
            tertiaryDefensiveType: regularData.defensiveType,
            // Include tertiary's own flat stat name/type (e.g., Base Damage)
            tertiaryOffensiveSecondary: regularData.offensiveSecondary || null,
            tertiaryOffensiveSecondaryType: regularData.offensiveSecondaryType || null,
            tertiaryLevels: [regularOffensive7 / 2],
            tertiaryDefensiveLevels: [regularDefensive7 / 2],
            tertiaryFlatLevels: regularFlat7 ? [regularFlat7 / 2] : null
        }
    };
};

/**
 * Creates a regular stone object
 */
export const createRegularStone = (stoneType, level, POWER_STONES) => ({
    type: stoneType,
    level: level,
    data: POWER_STONES[stoneType]
});

/**
 * Validates stone merging combinations
 */
export const validateStoneMerge = (stone1, stone2) => {
    // Cannot merge stone with itself
    if (stone1.type === stone2.type && !stone1.isSuper && !stone2.isSuper) {
        return {valid: false, message: 'Cannot merge a stone with itself! Please select a different stone type.'};
    }

    // Cannot merge two super stones
    if (stone1.isSuper && stone2.isSuper) {
        return {
            valid: false,
            message: 'Cannot merge two super stones! You can merge:\n• Two different Level 7 stones → Super Stone\n• Super Stone + Level 7 stone → Mega Stone'
        };
    }

    // Additional rule: a Super (A+B) cannot mega-merge with A or B
    if ((stone1.isSuper && !stone2.isSuper) || (!stone1.isSuper && stone2.isSuper)) {
        const superStone = stone1.isSuper ? stone1 : stone2;
        const regularStone = stone1.isSuper ? stone2 : stone1;

        if (regularStone && regularStone.type && (regularStone.type === superStone.primaryType || regularStone.type === superStone.secondaryType)) {
            const a = superStone.primaryType;
            const b = superStone.secondaryType;
            return {
                valid: false,
                message: `Invalid mega merge! Super (${a} + ${b}) cannot merge with ${a} or ${b}. Choose a different Level 7 stone.`
            };
        }
    }

    // Valid combinations: two level 7 regular stones, or super + level 7 regular
    const hasLevel7Regular = (stone1.level === 7 && !stone1.isSuper) || (stone2.level === 7 && !stone2.isSuper);
    const hasSuper = stone1.isSuper || stone2.isSuper;

    if ((stone1.level === 7 && stone2.level === 7 && !stone1.isSuper && !stone2.isSuper) ||
        (hasSuper && hasLevel7Regular)) {
        return {valid: true};
    }

    return {
        valid: false,
        message: 'Invalid combination! You can merge:\n• Two different Level 7 stones → Super Stone\n• Super Stone + Level 7 stone → Mega Stone'
    };
};

/**
 * Formats stone creation success message
 */
export const formatStoneCreationMessage = (stone, stoneType = 'super') => {
    const emoji = stoneType === 'mega' ? '🌟' : '✨';
    let message = `${emoji} Created ${stone.data.name}!\n`;

    message += `Primary: ${stone.data.offensive} (+${stone.data.levels[0]}%)\n`;

    if (stone.data.secondaryOffensive && stone.data.secondaryLevels) {
        message += `Secondary: ${stone.data.secondaryOffensive} (+${stone.data.secondaryLevels[0]}%)\n`;
    }

    if (stoneType === 'mega' && stone.data.tertiaryOffensive && stone.data.tertiaryLevels) {
        message += `Tertiary: ${stone.data.tertiaryOffensive} (+${stone.data.tertiaryLevels[0]}%)\n`;
    }

    message += `\n${stoneType === 'mega' ? 'Mega' : 'Super'} stone added to your library!`;

    return message;
};
