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
    event_location: string;
    event_poster: string;
    organization_id: number;
  };

export type Fight = {
    id: number;
    event_id: number;
    fighter1_id: number;
    fighter2_id: number;
    fight_finished: boolean;
    winner_id: number;
    method: string;
    round: number;
    time: string;
    weight_class: string;
  };

export type Fighter = {
    id: number;
    name: string;
    image_url: string;
    weight_class: string;
    organization_id: number;
    record: string;
    ranking: number;
  };
  