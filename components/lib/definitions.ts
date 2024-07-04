export type Organization = {
    id: number;
    name: string;
    abbreviation: number;
    logo_link: string;
  };

export type Event = {
    id: number;
    name: string;
    date: string;
    location: string;
    organization_id: number;
  };

export type Fight = {
    id: number;
    eventId: number;
    fighter1Id: number;
    fighter2Id: number;
    fightFinished: boolean;
    winnerId: number;
    method: string;
    round: number;
    time: string;
    weightClass: string;
  };

export type Fighter = {
    id: number;
    name: string;
    nationality: string;
    imageUrl: string;
    weightClass: string;
    organization_id: number;
    wins: number; // Moved out of 'record' for direct access
    losses: number;
    draws: number;
  };
  