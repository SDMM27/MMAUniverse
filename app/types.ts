// types.ts
export interface Event {
    id: number;
    title: string;
    date: string;
    location: string;
    detailsLink: string;
    imageUrl: string | null;
    daysRemaining: string;
  }
  
  export interface Fighter {
    id: number;
    name: string;
    record: string;
    division: string;
    country: string;
    imageUrl: string;
  }
  