export interface ScrapedEvent {
  name: string;
  date: string; // ISO 'YYYY-MM-DD'
  start_time?: string; // full ISO 8601 datetime — absent until this org's JSON is rescraped with this field
  event_location: string;
  event_poster: string;
}

export interface ScrapedFighter {
  name: string;
  image_url: string;
  weight_class: string;
  record: string; // 'W-L-D'
  ranking: number;
}

export interface ScrapedFight {
  event_name: string;
  fighter1_name: string;
  fighter2_name: string;
  fight_finished: boolean;
  winner_name: string | null;
  method: string;
  round: number;
  time: string;
  weight_class: string;
  // Absent on any org's JSON that hasn't been rescraped since this field was
  // introduced — treat as false, same pattern as ScrapedEvent.start_time.
  is_main_event?: boolean;
}

export interface ScrapedOrgData {
  organization_id: number;
  events: ScrapedEvent[];
  fighters: ScrapedFighter[];
  fights: ScrapedFight[];
}
