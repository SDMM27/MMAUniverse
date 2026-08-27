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
  // Absent on any fighter scraped before this field was introduced (same
  // "absent until rescraped" pattern as ScrapedEvent.start_time above).
  sherdog_url?: string;
  // The fighter's complete career record as scraped straight from their own
  // Sherdog page's "Fight History" table — every organization Sherdog knows
  // about, not just the ones we track. This is what backfills history for a
  // fighter who just transferred into a tracked org from one we've never
  // scraped (e.g. a KSW veteran signed by the UFC).
  fight_history?: ScrapedFightHistoryEntry[];
}

export interface ScrapedFightHistoryEntry {
  opponent_name: string;
  opponent_sherdog_url: string;
  event_name: string;
  event_sherdog_url: string;
  date: string; // ISO 'YYYY-MM-DD', or '' if Sherdog's date text didn't parse
  // Sherdog's own lowercase label: 'win' | 'loss' | 'draw' | 'nc' — kept as
  // raw text rather than a fixed union, see ParsedFighterHistoryEntry.
  result: string;
  method: string;
  referee: string;
  round: number;
  time: string;
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
  // Same story: absent until rescraped with the title-fight parser change — treat as false.
  is_title_fight?: boolean;
}

export interface ScrapedOrgData {
  organization_id: number;
  events: ScrapedEvent[];
  fighters: ScrapedFighter[];
  fights: ScrapedFight[];
}
