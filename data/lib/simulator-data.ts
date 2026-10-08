// data/lib/simulator-data.ts
//
// Next-main-event prefill for the fight simulator.
import { fetchAllEvents, fetchFightsByEvent } from '@/data/lib/data';
import { computeNextEventForHome, displayEventName, formatEventDate } from '@/data/lib/event-utils';
import { splitMainEvent } from '@/data/lib/fight-utils';
import { matchSimulatorFighter } from '@/data/lib/simulator-params';
import { SimulatorFighter } from '@/data/lib/definitions';

export type MainEventPrefill = {
  a: number;
  b: number;
  eventId: number;
  eventName: string;
  eventDate: string;
};

/**
 * Same selection as the home page: the next upcoming UFC event
 * (computeNextEventForHome) and its main event. is_main_event is rarely set,
 * so -- like app/page.tsx -- the first fight of fetchFightsByEvent
 * (`is_main_event DESC, id ASC`) is the fallback. Returns null unless both
 * fighters are in the simulator list and can face each other.
 */
export async function fetchNextMainEventPrefill(fighters: SimulatorFighter[]): Promise<MainEventPrefill | null> {
  try {
    const events = await fetchAllEvents();
    const next = computeNextEventForHome(events);
    if (!next || !next.isUpcoming || next.event.organization_abbreviation !== 'UFC') return null;

    const fights = await fetchFightsByEvent(String(next.event.id));
    const fight = splitMainEvent(fights).mainEvent ?? fights[0];
    if (!fight) return null;

    const a = matchSimulatorFighter(fighters, fight.fighter1);
    const b = matchSimulatorFighter(fighters, fight.fighter2);
    if (!a || !b || a.fighter_id === b.fighter_id) return null;
    if (a.weight_class.startsWith("Women's") !== b.weight_class.startsWith("Women's")) return null;

    return {
      a: a.fighter_id,
      b: b.fighter_id,
      eventId: next.event.id,
      eventName: displayEventName(next.event.name),
      eventDate: formatEventDate(next.event.date),
    };
  } catch (error) {
    // The prefill is a nicety: never take the simulator down with it.
    console.error('Simulator prefill error:', error);
    return null;
  }
}
