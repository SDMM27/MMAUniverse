// components/EventCard.tsx
import React from 'react';
import { Event } from '../app/types';

interface Props {
  event: Event;
}

const EventCard: React.FC<Props> = ({ event }) => {
  return (
    <div>
      <h1>{event.title}</h1>
      <p>Date: {event.date}</p>
      <p>Location: {event.location}</p>
      <a href={event.detailsLink}>More details</a>
      {event.imageUrl && <img src={event.imageUrl} alt="Event" />}
    </div>
  );
};

export default EventCard;