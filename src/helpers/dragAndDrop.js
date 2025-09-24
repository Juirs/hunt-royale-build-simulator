/**
 * Drag and drop utilities for power stones
 */

/**
 * Creates a serializable drag data object for any stone type
 */
export const createDragData = (item) => {
  if (item.isSuper || item.isMega) {
    // For super/mega stones, create a clean serializable object
    return {
      isSuper: item.isSuper || false,
      isMega: item.isMega || false,
      type: item.type,
      level: item.level,
      primaryType: item.primaryType,
      secondaryType: item.secondaryType,
      tertiaryType: item.tertiaryType || null,
      data: {
        name: item.data.name,
        color: item.data.color,
        offensive: item.data.offensive,
        defensive: item.data.defensive,
        offensiveType: item.data.offensiveType,
        defensiveType: item.data.defensiveType,
        offensiveSecondary: item.data.offensiveSecondary,
        offensiveSecondaryType: item.data.offensiveSecondaryType,
        // Primary values
        levels: item.data.levels,
        flatLevels: item.data.flatLevels,
        defensiveLevels: item.data.defensiveLevels, // Preserve primary defensive values
        // Secondary values
        secondaryOffensive: item.data.secondaryOffensive,
        secondaryDefensive: item.data.secondaryDefensive,
        secondaryOffensiveType: item.data.secondaryOffensiveType,
        secondaryDefensiveType: item.data.secondaryDefensiveType,
        // Preserve secondary's own flat-stat mapping (e.g., Base Damage for Rotten)
        secondaryOffensiveSecondary: item.data.secondaryOffensiveSecondary || null,
        secondaryOffensiveSecondaryType: item.data.secondaryOffensiveSecondaryType || null,
        secondaryLevels: item.data.secondaryLevels,
        secondaryDefensiveLevels: item.data.secondaryDefensiveLevels,
        secondaryFlatLevels: item.data.secondaryFlatLevels,
        // Mega stone specific properties
        tertiaryOffensive: item.data.tertiaryOffensive || null,
        tertiaryDefensive: item.data.tertiaryDefensive || null,
        tertiaryOffensiveType: item.data.tertiaryOffensiveType || null,
        tertiaryDefensiveType: item.data.tertiaryDefensiveType || null,
        // Preserve tertiary's own flat-stat mapping
        tertiaryOffensiveSecondary: item.data.tertiaryOffensiveSecondary || null,
        tertiaryOffensiveSecondaryType: item.data.tertiaryOffensiveSecondaryType || null,
        tertiaryLevels: item.data.tertiaryLevels || null,
        tertiaryDefensiveLevels: item.data.tertiaryDefensiveLevels || null,
        tertiaryFlatLevels: item.data.tertiaryFlatLevels || null
      }
    };
  }

  // For regular stones, return as is
  return item;
};

/**
 * Handles drag start event for power stones
 */
export const handleDragStart = (e, item, itemType) => {
  const dragData = createDragData(item);

  try {
    const serializedData = JSON.stringify(dragData);
    e.dataTransfer.setData('application/json', serializedData);
    e.dataTransfer.setData('itemType', itemType);
    e.dataTransfer.setData('text/plain', serializedData); // Fallback

    e.target.classList.add('dragging');
    setTimeout(() => {
      if (e.target) {
        e.target.classList.remove('dragging');
      }
    }, 100);
  } catch (error) {
    console.error('Error serializing drag data:', error, item);
    alert('Error starting drag. Please try again.');
  }
};

/**
 * Handles drag over event
 */
export const handleDragOver = (e) => {
  e.preventDefault();
  e.currentTarget.classList.add('drag-over');
};

/**
 * Handles drop event and returns parsed item data
 */
export const handleDrop = (e) => {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');

  try {
    const itemType = e.dataTransfer.getData('itemType');
    let itemData = e.dataTransfer.getData('application/json');

    // Fallback to text/plain if application/json is empty
    if (!itemData || itemData.trim() === '') {
      itemData = e.dataTransfer.getData('text/plain');
    }

    if (!itemData || itemData.trim() === '') {
      console.warn('No drag data received');
      return null;
    }

    const item = JSON.parse(itemData);
    return { item, itemType };
  } catch (error) {
    console.error('Error handling drop:', error);
    alert('Error dropping stone. Please try again.');
    return null;
  }
};
