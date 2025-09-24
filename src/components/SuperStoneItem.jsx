import React from 'react';

const SuperStoneItem = ({ superStone, mergeMode, selectedStones, onDragStart, onSelect }) => {
  const isSelected = mergeMode && selectedStones.some(s => s.isSuper && s.type === superStone.type);
  const canSelect = mergeMode;

  return (
    <div
      className={`stone-item super-stone stone-${superStone.primaryType} ${isSelected ? 'selected' : ''} ${canSelect ? 'mergeable' : ''}`}
      draggable={!mergeMode}
      onDragStart={!mergeMode ? (e) => onDragStart(e, superStone, 'stone') : undefined}
      onClick={mergeMode ? () => onSelect(superStone) : undefined}
      title={mergeMode
        ? `Click to select for mega stone creation: ${superStone.data.name}`
        : `${superStone.data.name}\nPrimary: ${superStone.data.offensive} (+${superStone.data.levels[0]}%)\nSecondary: ${superStone.data.secondaryOffensive} (+${superStone.data.secondaryLevels[0]}%)`}
    >
      <div className="stone-name">{superStone.data.name}</div>
      <div className="stone-level">Super Level {superStone.level}</div>
      <div className="stone-bonus">
        +{superStone.data.levels[0]}% / +{superStone.data.secondaryLevels[0]}%
      </div>
      {mergeMode && canSelect && (
        <div className="merge-indicator">
          {isSelected ? '✓' : '🔀'}
        </div>
      )}
    </div>
  );
};

export default SuperStoneItem;

