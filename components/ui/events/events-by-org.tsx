import { Event } from '@/components/lib/definitions';
import { useEffect, useState } from 'react';
import { fetchEventsByOrg } from '@/components/lib/data';
import Link from 'next/link';

export default function EventListByOrg({ orgId }: { orgId: string }) {
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchEvents = async () => {
          setLoading(true);
          try {
            const response = await fetch(`/api/events/${orgId}`);
            const data = await response.json();
            setEvents(data);
            setError(null);
          } catch (err) {
            setError('Failed to fetch events');
            console.error(err);
          } finally {
            setLoading(false);
          }
        };
    
        if (orgId) {
          fetchEvents();
        }
      }, [orgId]);
    
      if (loading) return <div>Loading...</div>;
      if (error) return <div>Error: {error}</div>;

    return (
      <ul role="list" className="divide-y divide-gray-100">
        {events.map((event) => (
          <li key={event.id} className="flex justify-between gap-x-6 py-5">
            <Link href={`/events/${event.id}`} passHref>
            <div className="flex min-w-0 gap-x-4">
              <img
              className="h-12 w-12 flex-none rounded-full bg-gray-50" 
              src={event.event_poster} 
              alt="Org Logo" />
              <p className="text-sm font-semibold leading-6 text-white-900">{event.event_location}</p>
              <div className="min-w-0 flex-auto">
                <p className="text-sm font-semibold leading-6 text-white-900">{event.name}</p>
                <p className="mt-1 truncate text-xs leading-5 text-white-500">{event.date}</p>
              </div>
            </div>
            </Link>
          </li>
        ))}
      </ul>
    )
  }
  