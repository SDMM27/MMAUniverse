export type Organization = {
  id: number;
  name: string;
  abbreviation: string;
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

export type EventWithOrganization = Event & {
  organization_abbreviation: string;
};

export type Fighter = {
  id: number;
  name: string;
  image_url: string;
  weight_class: string;
  organization_id: number;
  record: string;
  ranking: number;
  nationality: string | null;
};

export type FighterWithOrganization = Fighter & {
  organization_abbreviation: string;
};

export type FightWithFighters = {
  id: number;
  event_id: number;
  fighter1_id: number;
  fighter2_id: number;
  fight_finished: boolean;
  winner_id: number | null;
  method: string;
  round: number;
  time: string;
  weight_class: string;
  is_main_event: boolean;
  fighter1: Fighter | null;
  fighter2: Fighter | null;
};

export type FightHistoryEntry = {
  id: number;
  event_id: number;
  fighter1_id: number;
  fighter2_id: number;
  fight_finished: boolean;
  winner_id: number | null;
  method: string;
  round: number;
  time: string;
  weight_class: string;
  event_name: string;
  event_date: string;
  opponent_name: string | null;
  opponent_image_url: string | null;
  result: 'win' | 'loss' | 'draw' | 'upcoming';
};

export type FighterStats = {
  wins: number;
  losses: number;
  draws: number;
  ko: number;
  submission: number;
  decision: number;
};

export type NextEventPayload = {
  event: EventWithOrganization;
  isUpcoming: boolean;
} | null;

export type HomeResponse = {
  nextEvent: NextEventPayload;
  organizations: Organization[];
  fights: FightWithFighters[];
};

export type OrgDetailResponse = {
  organization: Organization;
  events: Event[];
};

export type EventDetailResponse = {
  event: EventWithOrganization;
  fights: FightWithFighters[];
};

export type FighterDetailResponse = {
  fighter: FighterWithOrganization;
  fights: FightHistoryEntry[];
  stats: FighterStats;
};
