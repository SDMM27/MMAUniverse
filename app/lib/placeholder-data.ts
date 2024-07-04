const organizations = [
  {
    id: 1,
    name: 'Ultimate Fighting Championship',
    abbreviation: 'UFC',
    logoLink: 'https://assets.espn.go.com/i/espn/teamlogos/500/ufc.png',
  },
  {
    id: 2,
    name: 'Professional Fighters League',
    abbreviation: 'PFL',
    logoLink: 'https://a.espncdn.com/i/teamlogos/leagues/500/pfl.png',
  },
  {
    id: 3,
    name: 'Bellator Fighting Championship',
    abbreviation: 'Bellator',
    logoLink: 'https://a3.espncdn.com/redesign/assets/img/icons/ESPN-icon-mma.png',
  },
];

const events = [
  {
    id: 1,
    name: 'UFC 263',
    date: '2021-06-12',
    organizationId: 1,
  },
  {
    id: 2,
    name: 'PFL 4',
    date: '2021-06-10',
    organizationId: 2,
  },
  {
    id: 3,
    name: 'Bellator 260',
    date: '2021-06-11',
    organizationId: 3,
  },
];

const fights = [
  {
    id: 1,
    eventID: 1,
    fighter1Id: 1,
    fighter2Id: 2,
    fightFinished: true,
    winnerID: 1,
    method: 'KO',
    round: 2,
    time: '1:45',
    weightClass: 'Lightweight',
  },
  {
    id: 2,
    eventID: 2,
    fighter1Id: 3,
    fighter2Id: 4,
    fightFinished: true,
    winnerID: 3,
    method: 'Submission',
    round: 1,
    time: '2:30',
    weightClass: 'Featherweight',
  },
  {
    id: 3,
    eventID: 3,
    fighter1Id: 5,
    fighter2Id: 6,
    fightFinished: true,
    winnerID: 5,
    method: 'Decision',
    round: 3,
    time: '5:00',
    weightClass: 'Middleweight',
  },
];

const fighters = [
  {
    id: 1,
    name: 'Fighter One',
    nationality: 'USA',
    imageUrl: '/fighter.png',
    weightClass: 'Lightweight',
    organizationId: 1,
    wins: 20,
    losses: 5,
    draws: 0,
  },
  {
    id: 2,
    name: 'Fighter Two',
    nationality: 'Brazil',
    imageUrl: '/fighter.png',
    weightClass: 'Featherweight',
    organizationId: 1,
    wins: 15,
    losses: 3,
    draws: 1,
  },
  {
    id: 3,
    name: 'Fighter Three',
    nationality: 'Canada',
    imageUrl: '/fighter.png',
    weightClass: 'Middleweight',
    organizationId: 3,
    wins: 18,
    losses: 4,
    draws: 0,
  },
  {
    id: 4,
    name: 'Fighter Four',
    nationality: 'Russia',
    imageUrl: '/fighter.png',
    weightClass: 'Heavyweight',
    organizationId: 3,
    wins: 10,
    losses: 1,
    draws: 0,
  },
  {
    id: 5,
    name: 'Fighter Five',
    nationality: 'UK',
    imageUrl: '/fighter.png',
    weightClass: 'Welterweight',
    organizationId: 2,
    wins: 22,
    losses: 2,
    draws: 0,
  },
  {
    id: 6,
    name: 'Fighter Six',
    nationality: 'Ireland',
    imageUrl: '/fighter.png',
    weightClass: 'Light Heavyweight',
    organizationId: 2,
    wins: 12,
    losses: 6,
    draws: 0,
  },
];


// Exporting the data to be used in your application
export { organizations, events, fights, fighters };
