// components/FighterCard.tsx
import React from 'react';
import { Fighter } from '../app/types';

interface Props {
  fighter: Fighter;
}

const FighterCard: React.FC<Props> = ({ fighter }) => {
  return (
    <div>
      <h1>{fighter.name}</h1>
      <p>Record: {fighter.record}</p>
      <p>Division: {fighter.division}</p>
      <img src={fighter.imageUrl} alt={fighter.name} />
    </div>
  );
};

export default FighterCard;
