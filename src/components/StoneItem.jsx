import React, { memo } from 'react';

const StoneItem = ({ stoneKey, stone, level, mergeMode, selectedStones, onDragStart, onSelect }) => {
  const isSelected = mergeMode && selectedStones.some(s => s.type === stoneKey && s.level === level);
  const isLevel7 = level === 7;
  const canSelect = mergeMode && isLevel7;

  const offensiveValue = stone.offensiveLevels[level - 1];
  const defensiveValue = stone.defensiveLevels[level - 1];
  const offensiveFlatValue = stone.offensiveFlatLevels ? stone.offensiveFlatLevels[level - 1] : null;

  const offensiveUnit = stone.offensiveType === 'flat' ? '' : '%';
  const defensiveUnit = stone.defensiveType === 'flat' ? '' : '%';

  let tooltipText = `${stone.name} Stone Level ${level}`;
  if (mergeMode && isLevel7) {
    tooltipText = `Click to select for merging: ${tooltipText}`;
  } else {
    tooltipText += `\nOffensive (weapon/ring): ${stone.offensive}`;
    tooltipText += ` (+${offensiveValue}${offensiveUnit})`;

    if (stone.offensiveSecondary && offensiveFlatValue) {
      tooltipText += `, ${stone.offensiveSecondary} (+${offensiveFlatValue})`;
    }

    tooltipText += `\nDefensive (helmet/chest/boots): ${stone.defensive}`;
    tooltipText += ` (+${defensiveValue}${defensiveUnit})`;
  }

  return (
    <div
      className={`stone-item stone-${stoneKey} ${isSelected ? 'selected' : ''} ${canSelect ? 'mergeable' : ''}`}
      draggable={!mergeMode}
      onDragStart={!mergeMode ? (e) => onDragStart(e, { type: stoneKey, level }, 'stone') : undefined}
      onClick={mergeMode ? () => onSelect(stoneKey, level) : undefined}
      title={tooltipText}
    >
      <div className="stone-row-title">
        <span className="stone-name">{stone.name}</span>
        <span className="stone-level">Lv. {level}</span>
      </div>
      <div className="stone-defensive">
        <span className="stone-stat-label">{stone.defensive}</span>
        <span className="stone-stat-value">+{defensiveValue}{defensiveUnit}</span>
      </div>
      <div className="stone-offensive">
        <span className="stone-stat-label">{stone.offensive}</span>
        <span className="stone-stat-value">+{offensiveValue}{offensiveUnit}</span>
      </div>
      {stone.offensiveSecondary && offensiveFlatValue ? (
        <div className="stone-offensive secondary">
          <span className="stone-stat-label">{stone.offensiveSecondary}</span>
          <span className="stone-stat-value">+{offensiveFlatValue}</span>
        </div>
      ) : null}
      {mergeMode && isLevel7 && (
        <div className="merge-indicator">
          {isSelected ? '✓' : '🔀'}
        </div>
      )}
    </div>
  );
};

export default memo(StoneItem);