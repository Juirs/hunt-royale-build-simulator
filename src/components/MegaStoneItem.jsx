import React from 'react';

const MegaStoneItem = ({ megaStone, mergeMode, onDragStart }) => {
  return (
    <div
      className={`stone-item mega-stone stone-${megaStone.primaryType}`}
      draggable={!mergeMode}
      onDragStart={!mergeMode ? (e) => onDragStart(e, megaStone, 'stone') : undefined}
      title={`${megaStone.data.name}\nPrimary: ${megaStone.data.offensive} (+${megaStone.data.levels[0]}%)\nSecondary: ${megaStone.data.secondaryOffensive} (+${megaStone.data.secondaryLevels[0]}%)\nTertiary: ${megaStone.data.tertiaryOffensive} (+${megaStone.data.tertiaryLevels[0]}%)`}
    >
      <div className="stone-name">{megaStone.data.name}</div>
      <div className="stone-level">Mega Level {megaStone.level}</div>
      <div className="stone-bonus">
        +{megaStone.data.levels[0]}% / +{megaStone.data.secondaryLevels[0]}% /
        +{megaStone.data.tertiaryLevels[0]}%
      </div>
    </div>
  );
};

export default MegaStoneItem;

