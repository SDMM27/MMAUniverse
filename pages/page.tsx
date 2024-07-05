// // pages/index.tsx
// import { GetStaticProps } from 'next';
// import EventCard from '../components/EventCard';
// import FighterCard from '../components/FighterCard';
// import { Event, Fighter } from '../app/types';

// interface Props {
//   events: Event[];
//   fighters: Fighter[];
// }

// export const getStaticProps: GetStaticProps<Props> = async () => {
//   const eventsResponse = await fetch('http://localhost:3000/events.json');
//   const fightersResponse = await fetch('http://localhost:3000/fighters.json');

//   const events = await eventsResponse.json() as Event[];
//   const fighters = await fightersResponse.json() as Fighter[];

//   return {
//     props: {
//       events,
//       fighters
//     },
//   };
// }

// export default function Home({ events, fighters }: Props) {
//   return (
//     <main className="flex flex-col items-center justify-center min-h-screen p-4">
//       {events.map(event => (
//         <EventCard key={event.id} event={event} />
//       ))}
//       {fighters.map(fighter => (
//         <FighterCard key={fighter.id} fighter={fighter} />
//       ))}
//     </main>
//   );
// }
