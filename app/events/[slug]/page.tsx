"use client"

import { useEffect, useState } from 'react';
import { fetchEventsByOrg } from '@/components/lib/data';
import FightListByEvent from '../../../components/ui/fights/fights-by-event';

export default function Page({ params }: { params: { slug: string } })  {
    const [eventName, setEventName] = useState(null);
    const [eventPoster, setEventPoster] = useState(undefined);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
  
    useEffect(() => {
      const fetchEvents = async () => {
        setLoading(true);
        try {
          const response = await fetch(`/api/event/${params.slug}`);
          const data = await response.json();
          setEventName(data[0].name);
          setEventPoster(data[0].event_poster);
          setError(null);
        } catch (err) {
          setError('Failed to fetch events');
          console.error(err);
        } finally {
          setLoading(false);
        }
      };
  
      if (params.slug) {
        fetchEvents();
      }
    }, [params.slug]);
  
    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error: {error}</div>;
  return (
    <div>
      <div className="flex h-20 shrink-0 items-end rounded-lg bg-red-600 p-4 md:h-52">
        <img src={eventPoster} alt="Org Logo" className="h-20 w-20 rounded-full bg-gray-50" />
        <h1 className="text-2xl text-white-900">{eventName}</h1>
      </div>
      <div className="flex items-center justify-center p-6 md:w-3/5 md:px-28 md:py-12">
          <FightListByEvent eventId={params.slug}/>
        </div>
    </div>
  );
};