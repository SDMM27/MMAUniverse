import { Fight } from '@/components/lib/definitions';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function EventListByOrg({ eventId }: { eventId: string }) {
  const [fights, setFights] = useState<Fight[]>([]);
  const [fightsWithFighters, setFightsWithFighters] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFights = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/fights/${eventId}`);
        const data = await response.json();
        setFights(data);
        fetchFighters(data);
        setError(null);
      } catch (err) {
        setError('Failed to fetch fights');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    const fetchFighters = async (data: any) => {
      setLoading(true);
      let fightsWithFighters = [];
      for (let i = 0; i < data.length; i++) {
        const fight = data[i];
        const responseFighter1 = await fetch(`/api/fighter/${fight.fighter1_id}`);
        const responseFighter2 = await fetch(`/api/fighter/${fight.fighter2_id}`);
        const dataFighter1 = await responseFighter1.json();
        const dataFighter2 = await responseFighter2.json();
        fight.fighter1 = dataFighter1[0]; // Assurez-vous que vous obtenez le premier élément du tableau
        fight.fighter2 = dataFighter2[0]; // Assurez-vous que vous obtenez le premier élément du tableau
        fightsWithFighters.push(fight);
      }
      try {
        setFightsWithFighters(fightsWithFighters);
        setError(null);
      } catch (err) {
        setError('Failed to fetch fights');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (eventId) {
      fetchFights();
    }
  }, [eventId]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <ul role="list" className="divide-y divide-gray-100">
      {fightsWithFighters.length > 0 ? (
        fightsWithFighters.map((fight) => (
          <li key={fight.id} className="flex justify-between gap-x-6 py-5">
            <Link href={`/fights/${fight.id}`} passHref>
              <div className="flex min-w-0 gap-x-4">
                {fight.fighter1 && fight.fighter2 ? (
                  <>
                    <div className="flex items-center gap-x-4">
                      <img
                        className="h-12 w-12 flex-none rounded-full bg-gray-50"
                        src={fight.fighter1.image_url}
                        alt={fight.fighter1.name}
                      />
                      <div>
                        <p className="text-sm font-semibold leading-6 text-white-900">
                          {fight.fighter1.name}
                        </p>
                        <p className="text-xs text-white-500">{fight.fighter1.record}</p>
                        <p className="text-xs text-white-500">{fight.fighter1.ranking}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-x-4">
                      <img
                        className="h-12 w-12 flex-none rounded-full bg-gray-50"
                        src={fight.fighter2.image_url}
                        alt={fight.fighter2.name}
                      />
                      <div>
                        <p className="text-sm font-semibold leading-6 text-white-900">
                          {fight.fighter2.name}
                        </p>
                        <p className="text-xs text-white-500">{fight.fighter2.record}</p>
                        <p className="text-xs text-white-500">{fight.fighter2.ranking}</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-sm font-semibold leading-6 text-white-900">
                    Fighters data not available
                  </p>
                )}
                <div className="min-w-0 flex-auto">
                  <p className="text-sm font-semibold leading-6 text-white-900">
                    {fight.method}
                  </p>
                  <p className="mt-1 truncate text-xs leading-5 text-white-500">
                    Round: {fight.round}
                  </p>
                  <p className="mt-1 truncate text-xs leading-5 text-white-500">
                    Time: {fight.time}
                  </p>
                  <p className="mt-1 truncate text-xs leading-5 text-white-500">
                    Weight Class: {fight.weight_class}
                  </p>
                </div>
              </div>
            </Link>
          </li>
        ))
      ) : (
        <li className="text-center py-5">
          <p className="text-sm font-semibold text-white-900">
            No fights announced yet
          </p>
        </li>
      )}
    </ul>
  );
}
