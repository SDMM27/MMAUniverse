const organizations = [
  {
    id: 1,
    name: 'Ultimate Fighting Championship',
    abbreviation: 'UFC',
    logo_link: 'https://assets.espn.go.com/i/espn/teamlogos/500/ufc.png',
  },
  {
    id: 2,
    name: 'Professional Fighters League',
    abbreviation: 'PFL',
    logo_link: 'https://a.espncdn.com/i/teamlogos/leagues/500/pfl.png',
  },
  {
    id: 3,
    name: 'Bellator Fighting Championship',
    abbreviation: 'Bellator',
    logo_link: 'https://a3.espncdn.com/redesign/assets/img/icons/ESPN-icon-mma.png',
  },
];

const events = [
  {
    id: 2,
    name: 'PFL 4',
    date: '2021-06-10',
    event_location: 'BALL ARENA, DENVER, COLORADO',
    event_poster: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/leagues/500/pfl.png',
    organization_id: 2,
  },
  {
    id: 3,
    name: 'Bellator 260',
    date: '2021-06-11',
    event_location: 'BALL ARENA, DENVER, COLORADO',
    event_poster: 'https://a3.espncdn.com/redesign/assets/img/icons/ESPN-icon-mma.png',
    organization_id: 3,
  },
  {
    id: 4,
    name: 'UFC ON ESPN 59 - NAMAJUNAS VS. CORTEZ',
    date: 'Samedi 13 juillet 2024',
    event_location: 'BALL ARENA, DENVER, COLORADO',
    event_poster: 'https://www.ufc-fr.com/https://www.ufc-fr.com/data/poster.php?w=450&path=../https://www.ufc-fr.com/data/evenement/709/ufc-on-espn-59-namajunas-vs-cortez-2024-07-03-03-30-10__dsno__ID709.jpg',
    organization_id: 1,
  },
  {
    id: 5,
    name: 'UFC ON ESPN 60 - LEMOS VS. JANDIROBA',
    date: 'Samedi 20 juillet 2024',
    event_location: 'UFC APEX, LAS VEGAS, NEVADA',
    event_poster: 'https://www.ufc-fr.com/https://www.ufc-fr.com/data/poster.php?w=450&path=../https://www.ufc-fr.com/data/evenement/711/ufc-fight-night-lemos-vs-jandiroba-2024-06-23-08-11-28__gyll__ID711.jpg',
    organization_id: 1,
  },
  {
    id: 6,
    name: 'UFC 304 - EDWARDS VS. MUHAMMAD 2',
    date: 'Samedi 27 juillet 2024',
    event_location: 'CO-OP LIVE ARENA, MANCHESTER, ENGLAND',
    event_poster: 'https://www.ufc-fr.com/https://www.ufc-fr.com/data/poster.php?w=450&path=../https://www.ufc-fr.com/data/evenement/713/ufc-304-edwards-vs-muhammad-2-2024-06-06-08-47-10__slur__ID713.jpg',
    organization_id: 1,
  },
  {
    id: 7,
    name: 'UFC ON ABC 7 - SANDHAGEN VS. NURMAGOMEDOV',
    date: 'Samedi 3 août 2024',
    event_location: 'ETIHAD ARENA, YAS ISLAND, ABU DHABI, UNITED ARAB EMIRATES',
    event_poster: 'https://www.ufc-fr.com/https://www.ufc-fr.com/data/poster.php?w=450&path=../https://www.ufc-fr.com/data/evenement/705/ufc-on-abc-7-sandhagen-vs-nurmagomedov-2024-06-14-09-11-23__dckx__ID705.jpg',
    organization_id: 1,
  },
  {
    id: 8,
    name: 'UFC FIGHT NIGHT',
    date: 'Samedi 10 août 2024',
    event_location: 'UFC APEX, LAS VEGAS, NEVADA',
    event_poster: 'https://www.ufc-fr.com/https://www.ufc-fr.com/data/poster.php?w=250&path=../images/evenement.jpg',
    organization_id: 1,
  },
  {
    id: 9,
    name: 'UFC 305 - DU PLESSIS VS. ADESANYA',
    date: 'Samedi 17 août 2024',
    event_location: 'RAC ARENA, PERTH, WESTERN AUSTRALIA',
    event_poster: 'https://www.ufc-fr.com/https://www.ufc-fr.com/data/poster.php?w=450&path=../https://www.ufc-fr.com/data/evenement/710/ufc-305-du-plessis-vs-adesanya-2024-06-17-11-18-20__vdop__ID710.jpg',
    organization_id: 1,
  },
  {
    id: 10,
    name: 'UFC FIGHT NIGHT',
    date: 'Samedi 24 août 2024',
    event_location: 'UFC APEX, LAS VEGAS, NEVADA',
    event_poster: 'https://www.ufc-fr.com/https://www.ufc-fr.com/data/poster.php?w=250&path=../images/evenement.jpg',
    organization_id: 1,
  },
  {
    id: 11,
    name: 'UFC FIGHT NIGHT - BURNS VS. BRADY',
    date: 'Samedi 7 septembre 2024',
    event_location: 'UFC APEX, LAS VEGAS, NEVADA',
    event_poster: 'https://www.ufc-fr.com/https://www.ufc-fr.com/data/poster.php?w=250&path=../images/evenement.jpg',
    organization_id: 1,
  },
  {
    id: 11,
    name: 'UFC 306',
    date: 'Samedi 14 septembre 2024',
    event_location: 'THE SPHERE, LAS VEGAS, NEVADA',
    event_poster: 'https://www.ufc-fr.com/https://www.ufc-fr.com/data/poster.php?w=450&path=../https://www.ufc-fr.com/data/evenement/694/ufc-306-2024-06-27-05-49-19__egpa__ID694.jpg',
    organization_id: 1,
  },
  {
    id: 12,
    name: 'UFC PARIS 3',
    date: 'Samedi 28 septembre 2024',
    event_location: 'ACCOR ARENA, PARIS, FRANCE',
    event_poster: 'https://www.ufc-fr.com/https://www.ufc-fr.com/data/poster.php?w=450&path=../https://www.ufc-fr.com/data/evenement/707/ufc-paris-3-2024-05-14-02-05-48__gnae__ID707.jpg',
    organization_id: 1,
  },
  {
    id: 13,
    name: 'UFC 307',
    date: 'Samedi 5 octobre 2024',
    event_location: 'DELTA CENTER, SALT LAKE CITY, UTAH, UNITED STATES',
    event_poster: 'https://www.ufc-fr.com/https://www.ufc-fr.com/data/poster.php?w=250&path=../images/evenement.jpg',
    organization_id: 1,
  },
  {
    id: 14,
    name: 'UFC 308',
    date: 'Samedi 26 octobre 2024',
    event_location: 'ETIHAD ARENA, YAS ISLAND, ABU DHABI, UNITED ARAB EMIRATES',
    event_poster: 'https://www.ufc-fr.com/https://www.ufc-fr.com/data/poster.php?w=450&path=../https://www.ufc-fr.com/data/evenement/712/ufc-308-2024-04-12-06-30-52__ojsq__ID712.jpg',
    organization_id: 1,
  },
  {
    id: 15,
    name: 'UFC 309',
    date: 'Samedi 9 novembre 2024',
    event_location: 'MADISON SQUARE GARDEN, NEW YORK, NEW YORK',
    event_poster: 'https://www.ufc-fr.com/https://www.ufc-fr.com/data/poster.php?w=250&path=../images/evenement.jpg',
    organization_id: 1,
  },
];

const fights = [
  {
      id: 1,
      eventName: "UFC ON ESPN 59 - NAMAJUNAS VS. CORTEZ",
      fighter1Name: "Rose Namajunas",
      fighter2Name: "Tracy Cortez",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Mouches"
  },
  {
      id: 2,
      eventName: "UFC ON ESPN 59 - NAMAJUNAS VS. CORTEZ",
      fighter1Name: "Santiago Ponzinibbio",
      fighter2Name: "Muslim Salikhov",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Mi-Moyens"
  },
  {
      id: 3,
      eventName: "UFC ON ESPN 59 - NAMAJUNAS VS. CORTEZ",
      fighter1Name: "Drew Dober",
      fighter2Name: "Jean Silva",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Légers"
  },
  {
      id: 4,
      eventName: "UFC ON ESPN 59 - NAMAJUNAS VS. CORTEZ",
      fighter1Name: "Ange Loosa",
      fighter2Name: "Gabriel Bonfim",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Mi-Moyens"
  },
  {
      id: 5,
      eventName: "UFC ON ESPN 59 - NAMAJUNAS VS. CORTEZ",
      fighter1Name: "Christian Rodriguez",
      fighter2Name: "Julian Erosa",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Plumes"
  },
  {
      id: 6,
      eventName: "UFC ON ESPN 59 - NAMAJUNAS VS. CORTEZ",
      fighter1Name: "Cody Brundage",
      fighter2Name: "Abdul Razak Alhassan",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Moyens"
  },
  {
      id: 7,
      eventName: "UFC ON ESPN 59 - NAMAJUNAS VS. CORTEZ",
      fighter1Name: "Viviane Araujo",
      fighter2Name: "Jasmine Jasudavicius",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Mouches"
  },
  {
      id: 8,
      eventName: "UFC ON ESPN 59 - NAMAJUNAS VS. CORTEZ",
      fighter1Name: "Montel Jackson",
      fighter2Name: "Da'Mon Blackshear",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Coqs"
  },
  {
      id: 9,
      eventName: "UFC ON ESPN 59 - NAMAJUNAS VS. CORTEZ",
      fighter1Name: "Luana Santos",
      fighter2Name: "Mariya Agapova",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Mouches"
  },
  {
      id: 10,
      eventName: "UFC ON ESPN 59 - NAMAJUNAS VS. CORTEZ",
      fighter1Name: "Josh Fremd",
      fighter2Name: "Andre Petroski",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Moyens"
  },
  {
      id: 11,
      eventName: "UFC ON ESPN 59 - NAMAJUNAS VS. CORTEZ",
      fighter1Name: "Joshua Van",
      fighter2Name: "Charles Johnson",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Mouches"
  },
  {
      id: 12,
      eventName: "UFC ON ESPN 60 - LEMOS VS. JANDIROBA",
      fighter1Name: "Amanda Lemos",
      fighter2Name: "Virna Jandiroba",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Pailles"
  },
  {
      id: 13,
      eventName: "UFC ON ESPN 60 - LEMOS VS. JANDIROBA",
      fighter1Name: "Brad Tavares",
      fighter2Name: "Jun Yong Park",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Moyens"
  },
  {
      id: 14,
      eventName: "UFC ON ESPN 60 - LEMOS VS. JANDIROBA",
      fighter1Name: "Bill Algeo",
      fighter2Name: "Doo Ho Choi",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Plumes"
  },
  {
      id: 15,
      eventName: "UFC ON ESPN 60 - LEMOS VS. JANDIROBA",
      fighter1Name: "Loik Radzhabov",
      fighter2Name: "Trey Ogden",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Légers"
  },
  {
      id: 16,
      eventName: "UFC ON ESPN 60 - LEMOS VS. JANDIROBA",
      fighter1Name: "Kurt Holobaugh",
      fighter2Name: "Kaynan Kruschewsky",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Légers"
  },
  {
      id: 17,
      eventName: "UFC ON ESPN 60 - LEMOS VS. JANDIROBA",
      fighter1Name: "Hyder Amil",
      fighter2Name: "Jeong Yeong Lee",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Plumes"
  },
  {
      id: 18,
      eventName: "UFC ON ESPN 60 - LEMOS VS. JANDIROBA",
      fighter1Name: "Brian Kelleher",
      fighter2Name: "Cody Gibson",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Coqs"
  },
  {
      id: 19,
      eventName: "UFC ON ESPN 60 - LEMOS VS. JANDIROBA",
      fighter1Name: "Luana Carolina",
      fighter2Name: "Lucie Pudilova",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Coqs"
  },
  {
      id: 20,
      eventName: "UFC ON ESPN 60 - LEMOS VS. JANDIROBA",
      fighter1Name: "Miranda Maverick",
      fighter2Name: "Dione Barbosa",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Mouches"
  },
  {
      id: 21,
      eventName: "UFC ON ESPN 60 - LEMOS VS. JANDIROBA",
      fighter1Name: "Mohammed Usman",
      fighter2Name: "Thomas Petersen",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Lourds"
  },
  {
      id: 22,
      eventName: "UFC ON ESPN 60 - LEMOS VS. JANDIROBA",
      fighter1Name: "Steve Garcia",
      fighter2Name: "Seung Woo Choi",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Plumes"
  },
  {
      id: 23,
      eventName: "UFC ON ESPN 60 - LEMOS VS. JANDIROBA",
      fighter1Name: "Cody Durden",
      fighter2Name: "Bruno Gustavo da Silva",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Mouches"
  },
  {
      id: 24,
      eventName: "UFC 304 - EDWARDS VS. MUHAMMAD 2",
      fighter1Name: "Leon Edwards",
      fighter2Name: "Belal Muhammad",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Mi-Moyens"
  },
  {
      id: 25,
      eventName: "UFC 304 - EDWARDS VS. MUHAMMAD 2",
      fighter1Name: "Tom Aspinall",
      fighter2Name: "Curtis Blaydes",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Lourds"
  },
  {
      id: 26,
      eventName: "UFC 304 - EDWARDS VS. MUHAMMAD 2",
      fighter1Name: "Bobby Green",
      fighter2Name: "Paddy Pimblett",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Légers"
  },
  {
      id: 27,
      eventName: "UFC 304 - EDWARDS VS. MUHAMMAD 2",
      fighter1Name: "Arnold Allen",
      fighter2Name: "Giga Chikadze",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Plumes"
  },
  {
      id: 28,
      eventName: "UFC 304 - EDWARDS VS. MUHAMMAD 2",
      fighter1Name: "Nathaniel Wood",
      fighter2Name: "Daniel Pineda",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Plumes"
  },
  {
      id: 29,
      eventName: "UFC 304 - EDWARDS VS. MUHAMMAD 2",
      fighter1Name: "Muhammad Mokaev",
      fighter2Name: "Manel Kape",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Mouches"
  },
  {
      id: 30,
      eventName: "UFC 304 - EDWARDS VS. MUHAMMAD 2",
      fighter1Name: "Ramon Taveras",
      fighter2Name: "Caolan Loughran",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Coqs"
  },
  {
      id: 31,
      eventName: "UFC 304 - EDWARDS VS. MUHAMMAD 2",
      fighter1Name: "Mick Parkin",
      fighter2Name: "Lukasz Brzeski",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Lourds"
  },
  {
      id: 32,
      eventName: "UFC 304 - EDWARDS VS. MUHAMMAD 2",
      fighter1Name: "Shauna Bannon",
      fighter2Name: "Ravena Oliveira",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Coqs"
  },
  {
      id: 33,
      eventName: "UFC 304 - EDWARDS VS. MUHAMMAD 2",
      fighter1Name: "Molly McCann",
      fighter2Name: "Bruna Brasil",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Pailles"
  },
  {
      id: 34,
      eventName: "UFC 304 - EDWARDS VS. MUHAMMAD 2",
      fighter1Name: "Oban Elliott",
      fighter2Name: "Preston Parsons",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Mi-Moyens"
  },
  {
      id: 35,
      eventName: "UFC 304 - EDWARDS VS. MUHAMMAD 2",
      fighter1Name: "Sam Patterson",
      fighter2Name: "Kiefer Crosbie",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Mi-Moyens"
  },
  {
      id: 36,
      eventName: "UFC 304 - EDWARDS VS. MUHAMMAD 2",
      fighter1Name: "Modestas Bukauskas",
      fighter2Name: "Marcin Prachnio",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Mi-Lourds"
  },
  {
      id: 37,
      eventName: "UFC 304 - EDWARDS VS. MUHAMMAD 2",
      fighter1Name: "Christian Leroy Duncan",
      fighter2Name: "Gregory Rodrigues",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Moyens"
  },
  {
      id: 38,
      eventName: "UFC ON ABC 7 - SANDHAGEN VS. NURMAGOMEDOV",
      fighter1Name: "Cory Sandhagen",
      fighter2Name: "Umar Nurmagomedov",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Coqs"
  },
  {
      id: 39,
      eventName: "UFC ON ABC 7 - SANDHAGEN VS. NURMAGOMEDOV",
      fighter1Name: "Vicente Luque",
      fighter2Name: "Nick Diaz",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Mi-Moyens"
  },
  {
      id: 40,
      eventName: "UFC ON ABC 7 - SANDHAGEN VS. NURMAGOMEDOV",
      fighter1Name: "Joel Alvarez",
      fighter2Name: "Elves Brener",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Légers"
  },
  {
      id: 41,
      eventName: "UFC ON ABC 7 - SANDHAGEN VS. NURMAGOMEDOV",
      fighter1Name: "Michael Chiesa",
      fighter2Name: "Tony Ferguson",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Mi-Moyens"
  },
  {
      id: 42,
      eventName: "UFC ON ABC 7 - SANDHAGEN VS. NURMAGOMEDOV",
      fighter1Name: "Marlon Vera",
      fighter2Name: "Deiveson Figueiredo",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Coqs"
  },
  {
      id: 43,
      eventName: "UFC ON ABC 7 - SANDHAGEN VS. NURMAGOMEDOV",
      fighter1Name: "Chris Gutierrez",
      fighter2Name: "Javid Basharat",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Coqs"
  },
  {
      id: 44,
      eventName: "UFC ON ABC 7 - SANDHAGEN VS. NURMAGOMEDOV",
      fighter1Name: "Jai Herbert",
      fighter2Name: "Rolando Bedoya",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Légers"
  },
  {
      id: 45,
      eventName: "UFC ON ABC 7 - SANDHAGEN VS. NURMAGOMEDOV",
      fighter1Name: "Sedriques Dumas",
      fighter2Name: "Denis Tiuliulin",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Moyens"
  },
  {
      id: 46,
      eventName: "UFC ON ABC 7 - SANDHAGEN VS. NURMAGOMEDOV",
      fighter1Name: "Abdul-Kareem Al-Selwady",
      fighter2Name: "Guram Kutateladze",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Légers"
  },
  {
      id: 47,
      eventName: "UFC ON ABC 7 - SANDHAGEN VS. NURMAGOMEDOV",
      fighter1Name: "Mackenzie Dern",
      fighter2Name: "Lupita Godinez",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Pailles"
  },
  {
      id: 48,
      eventName: "UFC ON ABC 7 - SANDHAGEN VS. NURMAGOMEDOV",
      fighter1Name: "Alonzo Menifield",
      fighter2Name: "Azamat Murzakanov",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Mi-Lourds"
  },
  {
      id: 49,
      eventName: "UFC ON ABC 7 - SANDHAGEN VS. NURMAGOMEDOV",
      fighter1Name: "Victoria Dudakova",
      fighter2Name: "Sam Hughes",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Pailles"
  },
  {
      id: 50,
      eventName: "UFC ON ABC 7 - SANDHAGEN VS. NURMAGOMEDOV",
      fighter1Name: "Azat Maksum",
      fighter2Name: "C.J. Vergara",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Mouches"
  },
  {
      id: 51,
      eventName: "UFC ON ABC 7 - SANDHAGEN VS. NURMAGOMEDOV",
      fighter1Name: "Mohammad Yahya",
      fighter2Name: "Kaue Fernandes",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Légers"
  },
  {
      id: 52,
      eventName: "UFC ON ABC 7 - SANDHAGEN VS. NURMAGOMEDOV",
      fighter1Name: "Don'tale Mayes",
      fighter2Name: "Shamil Gaziev",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Lourds"
  },
  {
      id: 53,
      eventName: "UFC FIGHT NIGHT",
      fighter1Name: "Marcin Tybura",
      fighter2Name: "Serghei Spivac",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Lourds"
  },
  {
      id: 54,
      eventName: "UFC FIGHT NIGHT",
      fighter1Name: "Jarno Errens",
      fighter2Name: "Youssef Zalal",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Plumes"
  },
  {
      id: 55,
      eventName: "UFC FIGHT NIGHT",
      fighter1Name: "Karl Williams",
      fighter2Name: "Jhonata Diniz",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Lourds"
  },
  {
      id: 56,
      eventName: "UFC FIGHT NIGHT",
      fighter1Name: "Jonny Parsons",
      fighter2Name: "Yusaku Kinoshita",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Mi-Moyens"
  },
  {
      id: 57,
      eventName: "UFC FIGHT NIGHT",
      fighter1Name: "Stephanie Luciano",
      fighter2Name: "Talita Alencar",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Pailles"
  },
  {
      id: 58,
      eventName: "UFC FIGHT NIGHT",
      fighter1Name: "Allan Nascimento",
      fighter2Name: "Jafel Filho",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Mouches"
  },
  {
      id: 59,
      eventName: "UFC FIGHT NIGHT",
      fighter1Name: "Danny Barlow",
      fighter2Name: "Uros Medic",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Mi-Moyens"
  },
  {
      id: 60,
      eventName: "UFC FIGHT NIGHT",
      fighter1Name: "Yana Santos",
      fighter2Name: "Chelsea Chandler",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Coqs"
  },
  {
      id: 61,
      eventName: "UFC FIGHT NIGHT",
      fighter1Name: "Charalampos Grigoriou",
      fighter2Name: "Toshiomi Kazama",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Coqs"
  },
  {
      id: 62,
      eventName: "UFC 305 - DU PLESSIS VS. ADESANYA",
      fighter1Name: "Dricus Du Plessis",
      fighter2Name: "Israel Adesanya",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Moyens"
  },
  {
      id: 63,
      eventName: "UFC 305 - DU PLESSIS VS. ADESANYA",
      fighter1Name: "Tom Nolan",
      fighter2Name: "Alex Reyes",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Légers"
  },
  {
      id: 64,
      eventName: "UFC 305 - DU PLESSIS VS. ADESANYA",
      fighter1Name: "Jairzinho Rozenstruik",
      fighter2Name: "Tai Tuivasa",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Lourds"
  },
  {
      id: 65,
      eventName: "UFC 305 - DU PLESSIS VS. ADESANYA",
      fighter1Name: "Kai Kara-France",
      fighter2Name: "Steve Erceg",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Mouches"
  },
  {
      id: 66,
      eventName: "UFC 305 - DU PLESSIS VS. ADESANYA",
      fighter1Name: "Junior Tafa",
      fighter2Name: "Valter Walker",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Lourds"
  },
  {
      id: 67,
      eventName: "UFC 305 - DU PLESSIS VS. ADESANYA",
      fighter1Name: "Gavin Tucker",
      fighter2Name: "Jack Jenkins",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Plumes"
  },
  {
      id: 68,
      eventName: "UFC 305 - DU PLESSIS VS. ADESANYA",
      fighter1Name: "Josh Culibao",
      fighter2Name: "Ricardo Ramos",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Plumes"
  },
  {
      id: 69,
      eventName: "UFC 305 - DU PLESSIS VS. ADESANYA",
      fighter1Name: "Casey O'Neill",
      fighter2Name: "Tereza Bleda",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Mouches"
  },
  {
      id: 70,
      eventName: "UFC 305 - DU PLESSIS VS. ADESANYA",
      fighter1Name: "Jingliang Li",
      fighter2Name: "Carlos Prates",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Mi-Moyens"
  },
  {
      id: 71,
      eventName: "UFC FIGHT NIGHT",
      fighter1Name: "Zach Reese",
      fighter2Name: "Jose Medina",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Moyens"
  },
  {
      id: 72,
      eventName: "UFC FIGHT NIGHT",
      fighter1Name: "Dennis Buzukja",
      fighter2Name: "Danny Silva",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Plumes"
  },
  {
      id: 73,
      eventName: "UFC FIGHT NIGHT",
      fighter1Name: "Neil Magny",
      fighter2Name: "Michael Morales",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Mi-Moyens"
  },
  {
      id: 74,
      eventName: "UFC FIGHT NIGHT",
      fighter1Name: "Viacheslav Borshchev",
      fighter2Name: "James Llontop",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Légers"
  },
  {
      id: 75,
      eventName: "UFC FIGHT NIGHT",
      fighter1Name: "Roman Kopylov",
      fighter2Name: "Brunno Ferreira",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Moyens"
  },
  {
      id: 76,
      eventName: "UFC FIGHT NIGHT",
      fighter1Name: "Gerald Meerschaert",
      fighter2Name: "Edmen Shahbazyan",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Moyens"
  },
  {
      id: 77,
      eventName: "UFC FIGHT NIGHT",
      fighter1Name: "Josiane Nunes",
      fighter2Name: "Jacqueline Cavalcanti",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Coqs"
  },
  {
      id: 78,
      eventName: "UFC FIGHT NIGHT - BURNS VS. BRADY",
      fighter1Name: "Gilbert Burns",
      fighter2Name: "Sean Brady",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Mi-Moyens"
  },
  {
      id: 79,
      eventName: "UFC FIGHT NIGHT - BURNS VS. BRADY",
      fighter1Name: "Calvin Kattar",
      fighter2Name: "Kyle Nelson",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Plumes"
  },
  {
      id: 80,
      eventName: "UFC FIGHT NIGHT - BURNS VS. BRADY",
      fighter1Name: "Jessica Andrade",
      fighter2Name: "Natalia Silva",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Mouches"
  },
  {
      id: 81,
      eventName: "UFC FIGHT NIGHT - BURNS VS. BRADY",
      fighter1Name: "Andre Lima",
      fighter2Name: "Felipe dos Santos",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Mouches"
  },
  {
      id: 82,
      eventName: "UFC FIGHT NIGHT - BURNS VS. BRADY",
      fighter1Name: "Matt Schnell",
      fighter2Name: "Alessandro Costa",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Mouches"
  },
  {
      id: 83,
      eventName: "UFC 306",
      fighter1Name: "Sean O'Malley",
      fighter2Name: "Merab Dvalishvili",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Combat non confirme"
  },
  {
      id: 84,
      eventName: "UFC 306",
      fighter1Name: "Alexa Grasso",
      fighter2Name: "Valentina Shevchenko",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Combat non confirme"
  },
  {
      id: 85,
      eventName: "UFC 306",
      fighter1Name: "Irene Aldana",
      fighter2Name: "Norma Dumont",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Coqs"
  },
  {
      id: 86,
      eventName: "UFC 306",
      fighter1Name: "Michel Pereira",
      fighter2Name: "Anthony Hernandez",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Moyens"
  },
  {
      id: 87,
      eventName: "UFC 306",
      fighter1Name: "Yazmin Jauregui",
      fighter2Name: "Ketlen Souza",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Pailles"
  },
  {
      id: 88,
      eventName: "UFC 306",
      fighter1Name: "Edgar Chairez",
      fighter2Name: "Kevin Borjas",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Mouches"
  },
  {
      id: 89,
      eventName: "UFC PARIS 3",
      fighter1Name: "Benoit Saint-Denis",
      fighter2Name: "Renato Moicano",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Légers"
  },
  {
      id: 90,
      eventName: "UFC PARIS 3",
      fighter1Name: "Joanderson Brito",
      fighter2Name: "William Gomis",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Plumes"
  },
  {
      id: 91,
      eventName: "UFC 307",
      fighter1Name: "Raquel Pennington",
      fighter2Name: "Julianna Pena",
      fight_finished: false,
      method: "",
      time: "",
      weight_class: "Combat non confirme"
  }
];
  // {
  //   id: 100,
  //   eventID: 1,
  //   fighter1Id: 1,
  //   fighter2Id: 2,
  //   fight_finished: true,
  //   winnerID: 1,
  //   method: 'KO',
  //   round: 2,
  //   time: '1:45',
  //   weight_class: 'Lightweight',
  // },
  // {
  //   id: 2000,
  //   eventID: 2,
  //   fighter1Id: 3,
  //   fighter2Id: 4,
  //   fight_finished: true,
  //   winnerID: 3,
  //   method: 'Submission',
  //   round: 1,
  //   time: '2:30',
  //   weight_class: 'Featherweight',
  // },
  // {
  //   id: 30000,
  //   eventID: 3,
  //   fighter1Id: 5,
  //   fighter2Id: 6,
  //   fight_finished: true,
  //   winnerID: 5,
  //   method: 'Decision',
  //   round: 3,
  //   time: '5:00',
  //   weight_class: 'Middleweight',
  // },

const fighters = [
  {
    id: 1,
    name: 'Rose Namajunas',
    image_url: 'https://www.ufc-fr.com/data/combattant/252/rose-namajunas-2023-09-02-11-41-42__dxif__ID252.webp',
    weight_class: '',
    organization_id: 1,
    record: '10-5-0',
    ranking: 6
  },
  {
    id: 2,
    name: 'Tracy Cortez',
    image_url: 'https://www.ufc-fr.com/data/combattant/2018/2022-05-07-09-23-17__lrcc__ID2018.jpg',
    weight_class: '',
    organization_id: 1,
    record: '5-0-0',
    ranking: 10
  },
  {
    id: 3,
    name: 'Santiago Ponzinibbio',
    image_url: 'https://www.ufc-fr.com/data/combattant/332/2018-11-17-08-59-06__hmjo__ID332.jpg',
    weight_class: '',
    organization_id: 1,
    record: '11-6-0',
    ranking: 0
  },
  {
    id: 4,
    name: 'Muslim Salikhov',
    image_url: 'https://www.ufc-fr.com/data/combattant/1737/2022-11-18-09-43-08__khuc__ID1737.jpg',
    weight_class: '',
    organization_id: 1,
    record: '6-4-0',
    ranking: 0
  },
  {
    id: 5,
    name: 'Drew Dober',
    image_url: 'https://www.ufc-fr.com/data/combattant/612/drew-dober-2024-02-03-02-26-54__ohib__ID612.webp',
    weight_class: '',
    organization_id: 1,
    record: '13-9-0',
    ranking: 0
  },
  {
    id: 6,
    name: 'Jean Silva',
    image_url: 'https://www.ufc-fr.com/data/combattant/2502/jean-silva-2024-06-29-10-46-06__cayv__ID2502.webp',
    weight_class: '',
    organization_id: 1,
    record: '2-0-0',
    ranking: 0
  },
  {
    id: 7,
    name: 'Ange Loosa',
    image_url: 'https://www.ufc-fr.com/data/combattant/2296/ange-loosa-2024-03-16-05-03-17__kyft__ID2296.webp',
    weight_class: '',
    organization_id: 1,
    record: '2-1-0',
    ranking: 0
  },
  {
    id: 8,
    name: 'Gabriel Bonfim',
    image_url: 'https://www.ufc-fr.com/data/combattant/2338/gabriel-bonfim-2023-11-04-10-31-34__whtl__ID2338.webp',
    weight_class: '',
    organization_id: 1,
    record: '2-1-0',
    ranking: 0
  },
  {
    id: 9,
    name: 'Christian Rodriguez',
    image_url: 'https://www.ufc-fr.com/data/combattant/2283/christian-rodriguez-2024-03-16-12-20-29__xeev__ID2283.webp',
    weight_class: '',
    organization_id: 1,
    record: '4-1-0',
    ranking: 0
  },
  {
    id: 10,
    name: 'Julian Erosa',
    image_url: 'https://www.ufc-fr.com/data/combattant/1514/2022-09-09-10-07-41__sdrg__ID1514.jpg',
    weight_class: '',
    organization_id: 1,
    record: '7-7-0',
    ranking: 0
  },
  {
    id: 11,
    name: 'Cody Brundage',
    image_url: 'https://www.ufc-fr.com/data/combattant/2234/cody-brundage-2024-04-13-01-38-51__cjij__ID2234.webp',
    weight_class: '',
    organization_id: 1,
    record: '4-5-0',
    ranking: 0
  },
  {
    id: 12,
    name: 'Abdul Razak Alhassan',
    image_url: 'https://www.ufc-fr.com/data/combattant/1624/abdul-razak-alhassan-2023-10-06-08-46-11__crve__ID1624.webp',
    weight_class: '',
    organization_id: 1,
    record: '6-6-0',
    ranking: 0
  },
  {
    id: 13,
    name: 'Viviane Araujo',
    image_url: 'https://www.ufc-fr.com/data/combattant/1944/viviane-araujo-2024-02-03-01-28-31__ifuh__ID1944.webp',
    weight_class: '',
    organization_id: 1,
    record: '6-5-0',
    ranking: 9
  },
  {
    id: 14,
    name: 'Jasmine Jasudavicius',
    image_url: 'https://www.ufc-fr.com/data/combattant/2247/jasmine-jasudavicius-2024-01-20-08-49-05__jfcs__ID2247.webp',
    weight_class: '',
    organization_id: 1,
    record: '4-2-0',
    ranking: 15
  },
  {
    id: 15,
    name: 'Montel Jackson',
    image_url: 'https://www.ufc-fr.com/data/combattant/1826/2018-08-03-10-13-49__ayys__ID1826.jpg',
    weight_class: '',
    organization_id: 1,
    record: '7-2-0',
    ranking: 0
  },
  {
    id: 16,
    name: 'Da Mon Blackshear',
    image_url: 'https://www.ufc-fr.com/data/combattant/2323/da-mon-blackshear-2023-03-03-08-49-04__rjqk__ID2323.jpg',
    weight_class: '',
    organization_id: 1,
    record: '2-2-1',
    ranking: 0
  },
  {
    id: 17,
    name: 'Luana Santos',
    image_url: 'https://www.ufc-fr.com/data/combattant/2429/luana-santos-2023-12-08-09-17-05__zdsf__ID2429.webp',
    weight_class: '',
    organization_id: 1,
    record: '2-0-0',
    ranking: 0
  },
  {
    id: 18,
    name: 'Mariya Agapova',
    image_url: 'https://www.ufc-fr.com/data/combattant/2062/2020-05-29-03-24-50__aihc__ID2062.jpg',
    weight_class: '',
    organization_id: 1,
    record: '2-3-0',
    ranking: 0
  },
  {
    id: 19,
    name: 'Josh Fremd',
    image_url: 'https://www.ufc-fr.com/data/combattant/2294/josh-fremd-2023-03-11-09-09-19__nwri__ID2294.jpg',
    weight_class: '',
    organization_id: 1,
    record: '2-3-0',
    ranking: 0
  },
  {
    id: 20,
    name: 'Andre Petroski',
    image_url: 'https://www.ufc-fr.com/data/combattant/2225/2022-05-14-07-18-52__pswh__ID2225.jpg',
    weight_class: '',
    organization_id: 1,
    record: '5-2-0',
    ranking: 0
  },
  {
    id: 21,
    name: 'Joshua Van',
    image_url: 'https://www.ufc-fr.com/data/combattant/2436/joshua-van-2023-11-10-03-40-33__scwr__ID2436.webp',
    weight_class: '',
    organization_id: 1,
    record: '3-0-0',
    ranking: 0
  },
  {
    id: 22,
    name: 'Charles Johnson',
    image_url: 'https://www.ufc-fr.com/data/combattant/2299/charles-johnson-2024-02-03-11-57-37__qimu__ID2299.webp',
    weight_class: '',
    organization_id: 1,
    record: '4-4-0',
    ranking: 0
  },
  {
    id: 23,
    name: 'Amanda Lemos',
    image_url: 'https://www.ufc-fr.com/data/combattant/1691/2022-04-23-08-17-28__pkkq__ID1691.jpg',
    weight_class: '',
    organization_id: 1,
    record: '8-3-0',
    ranking: 3
  },
  {
    id: 24,
    name: 'Virna Jandiroba',
    image_url: 'https://www.ufc-fr.com/data/combattant/1924/2020-08-16-03-38-45__bgff__ID1924.jpg',
    weight_class: '',
    organization_id: 1,
    record: '6-3-0',
    ranking: 4
  },
  {
    id: 25,
    name: 'Brad Tavares',
    image_url: 'https://www.ufc-fr.com/data/combattant/549/2016-09-10-06-05-33__iiyn__ID549.jpg',
    weight_class: '',
    organization_id: 1,
    record: '15-9-0',
    ranking: 0
  },
  {
    id: 26,
    name: 'Jun Yong Park',
    image_url: 'https://www.ufc-fr.com/data/combattant/1970/jun-yong-park-2023-07-14-10-09-27__ehvq__ID1970.webp',
    weight_class: '',
    organization_id: 1,
    record: '7-3-0',
    ranking: 0
  },
  {
    id: 27,
    name: 'Bill Algeo',
    image_url: 'https://www.ufc-fr.com/data/combattant/2120/bill-algeo-2023-10-06-08-40-48__uozm__ID2120.webp',
    weight_class: '',
    organization_id: 1,
    record: '5-4-0',
    ranking: 0
  },
  {
    id: 28,
    name: 'Doo Ho Choi',
    image_url: 'https://www.ufc-fr.com/data/combattant/1402/2023-02-04-09-18-13__rqdl__ID1402.jpg',
    weight_class: '',
    organization_id: 1,
    record: '3-3-1',
    ranking: 0
  },
  {
    id: 29,
    name: 'Loik Radzhabov',
    image_url: 'https://www.ufc-fr.com/data/combattant/2408/loik-radzhabov-2024-03-02-08-32-17__neww__ID2408.webp',
    weight_class: '',
    organization_id: 1,
    record: '2-1-0',
    ranking: 0
  },
  {
    id: 30,
    name: 'Trey Ogden',
    image_url: 'https://www.ufc-fr.com/data/combattant/2293/trey-ogden-2023-11-18-09-42-01__eenu__ID2293.webp',
    weight_class: '',
    organization_id: 1,
    record: '2-2-0',
    ranking: 0
  },
  {
    id: 31,
    name: 'Kurt Holobaugh',
    image_url: 'https://www.ufc-fr.com/data/combattant/1056/2018-07-14-07-23-30__dhlw__ID1056.jpg',
    weight_class: '',
    organization_id: 1,
    record: '1-5-0',
    ranking: 0
  },
  {
    id: 32,
    name: 'Kaynan Kruschewsky',
    image_url: 'https://www.ufc-fr.com/data/combattant/2492/kaynan-kruschewsky-2023-11-04-09-58-44__uvct__ID2492.webp',
    weight_class: '',
    organization_id: 1,
    record: '0-1-0',
    ranking: 0
  },
  {
    id: 33,
    name: 'Hyder Amil',
    image_url: 'https://www.ufc-fr.com/data/combattant/2500/hyder-amil-2023-12-04-11-49-25__oblk__ID2500.webp',
    weight_class: '',
    organization_id: 1,
    record: '1-0-0',
    ranking: 0
  },
  {
    id: 34,
    name: 'Jeong Yeong Lee',
    image_url: 'https://www.ufc-fr.com/data/combattant/2387/jeong-yeong-lee-2024-02-03-10-47-51__ibvd__ID2387.webp',
    weight_class: '',
    organization_id: 1,
    record: '2-0-0',
    ranking: 0
  },
  {
    id: 35,
    name: 'Brian Kelleher',
    image_url: 'https://www.ufc-fr.com/data/combattant/1676/brian-kelleher-2023-12-15-10-36-25__ktoe__ID1676.webp',
    weight_class: '',
    organization_id: 1,
    record: '8-8-0',
    ranking: 0
  },
  {
    id: 36,
    name: 'Cody Gibson',
    image_url: 'https://www.ufc-fr.com/data/combattant/953/cody-gibson-2024-03-27-03-56-00__ieds__ID953.webp',
    weight_class: '',
    organization_id: 1,
    record: '1-5-0',
    ranking: 0
  },
  {
    id: 37,
    name: 'Luana Carolina',
    image_url: 'https://www.ufc-fr.com/data/combattant/1912/luana-carolina-2024-02-03-10-16-02__ehrl__ID1912.webp',
    weight_class: '',
    organization_id: 1,
    record: '5-3-0',
    ranking: 0
  },
  {
    id: 38,
    name: 'Lucie Pudilova',
    image_url: 'https://www.ufc-fr.com/data/combattant/1662/2018-09-09-05-24-54__aned__ID1662.jpg',
    weight_class: '',
    organization_id: 1,
    record: '3-7-0',
    ranking: 0
  },
  {
    id: 39,
    name: 'Miranda Maverick',
    image_url: 'https://www.ufc-fr.com/data/combattant/2081/2020-10-24-05-31-21__wgcr__ID2081.jpg',
    weight_class: '',
    organization_id: 1,
    record: '6-3-0',
    ranking: 14
  },
  {
    id: 40,
    name: 'Dione Barbosa',
    image_url: 'https://www.ufc-fr.com/data/combattant/2472/dione-barbosa-2023-10-02-02-51-12__jsmg__ID2472.webp',
    weight_class: '',
    organization_id: 1,
    record: '1-0-0',
    ranking: 14
  },
  {
    id: 41,
    name: 'Mohammed Usman',
    image_url: 'https://www.ufc-fr.com/data/combattant/2318/mohammed-usman-2023-04-22-05-11-54__ygau__ID2318.jpg',
    weight_class: '',
    organization_id: 1,
    record: '3-1-0',
    ranking: 0
  },
  {
    id: 42,
    name: 'Thomas Petersen',
    image_url: 'https://www.ufc-fr.com/data/combattant/2493/thomas-petersen-2024-02-03-09-18-33__umee__ID2493.webp',
    weight_class: '',
    organization_id: 1,
    record: '0-1-0',
    ranking: 0
  },
  {
    id: 43,
    name: 'Steve Garcia',
    image_url: 'https://www.ufc-fr.com/data/combattant/2053/steve-garcia-2023-12-08-09-20-07__sutq__ID2053.webp',
    weight_class: '',
    organization_id: 1,
    record: '4-2-0',
    ranking: 0
  },
  {
    id: 44,
    name: 'Seung Woo Choi',
    image_url: 'https://www.ufc-fr.com/data/combattant/1920/2019-07-26-10-59-35__gedj__ID1920.jpg',
    weight_class: '',
    organization_id: 1,
    record: '4-5-0',
    ranking: 0
  },
  {
    id: 45,
    name: 'Cody Durden',
    image_url: 'https://www.ufc-fr.com/data/combattant/2096/cody-durden-2023-12-15-10-27-52__byao__ID2096.webp',
    weight_class: '',
    organization_id: 1,
    record: '5-3-1',
    ranking: 14
  },
  {
    id: 46,
    name: 'Bruno Gustavo da Silva',
    image_url: 'https://www.ufc-fr.com/data/combattant/1951/bruno-silva-2023-03-11-06-20-17__eicn__ID1951.jpg',
    weight_class: '',
    organization_id: 1,
    record: '3-2-0',
    ranking: 14
  },
  {
    id: 47,
    name: 'Leon Edwards',
    image_url: 'https://www.ufc-fr.com/data/combattant/59/leon-edwards-2023-12-15-11-14-27__aoxi__ID59.webp',
    weight_class: '',
    organization_id: 1,
    record: '14-2-0',
    ranking: 2
  },
  {
    id: 48,
    name: 'Belal Muhammad',
    image_url: 'https://www.ufc-fr.com/data/combattant/1558/2022-04-16-09-08-23__dwkd__ID1558.jpg',
    weight_class: '',
    organization_id: 1,
    record: '14-3-0',
    ranking: 2
  },
  {
    id: 49,
    name: 'Tom Aspinall',
    image_url: 'https://www.ufc-fr.com/data/combattant/2036/tom-aspinall-2023-11-10-04-30-38__shyz__ID2036.webp',
    weight_class: '',
    organization_id: 1,
    record: '7-1-0',
    ranking: 1
  },
  {
    id: 50,
    name: 'Curtis Blaydes',
    image_url: 'https://www.ufc-fr.com/data/combattant/1533/curtis-blaydes-2024-03-09-12-41-03__hama__ID1533.webp',
    weight_class: '',
    organization_id: 1,
    record: '13-4-0',
    ranking: 5
  },
  {
    id: 51,
    name: 'Bobby Green',
    image_url: 'https://www.ufc-fr.com/data/combattant/249/bobby-green-2023-12-02-11-16-15__ubph__ID249.webp',
    weight_class: '',
    organization_id: 1,
    record: '13-10-1',
    ranking: 14
  },
  {
    id: 52,
    name: 'Paddy Pimblett',
    image_url: 'https://www.ufc-fr.com/data/combattant/2213/paddy-pimblett-2023-12-15-11-04-39__upmq__ID2213.webp',
    weight_class: '',
    organization_id: 1,
    record: '5-0-0',
    ranking: 14
  },
  {
    id: 53,
    name: 'Arnold Allen',
    image_url: 'https://www.ufc-fr.com/data/combattant/1366/arnold-allen-2024-01-20-11-12-15__ynht__ID1366.webp',
    weight_class: '',
    organization_id: 1,
    record: '10-2-0',
    ranking: 6
  },
  {
    id: 54,
    name: 'Giga Chikadze',
    image_url: 'https://www.ufc-fr.com/data/combattant/2010/2020-11-08-06-09-17__jjbd__ID2010.jpg',
    weight_class: '',
    organization_id: 1,
    record: '8-1-0',
    ranking: 10
  },
  {
    id: 55,
    name: 'Nathaniel Wood',
    image_url: 'https://www.ufc-fr.com/data/combattant/1796/nathaniel-wood-2023-10-21-09-18-28__dskq__ID1796.webp',
    weight_class: '',
    organization_id: 1,
    record: '7-3-0',
    ranking: 0
  },
  {
    id: 56,
    name: 'Daniel Pineda',
    image_url: 'https://www.ufc-fr.com/data/combattant/1038/2021-06-26-03-03-49__sgtm__ID1038.jpg',
    weight_class: '',
    organization_id: 1,
    record: '5-6-0',
    ranking: 0
  },
  {
    id: 57,
    name: 'Muhammad Mokaev',
    image_url: 'https://www.ufc-fr.com/data/combattant/2267/muhammad-mokaev-2024-03-02-11-15-28__vnpo__ID2267.webp',
    weight_class: '',
    organization_id: 1,
    record: '6-0-0',
    ranking: 6
  },
  {
    id: 58,
    name: 'Manel Kape',
    image_url: 'https://www.ufc-fr.com/data/combattant/2150/2022-11-09-07-03-59__zusx__ID2150.jpg',
    weight_class: '',
    organization_id: 1,
    record: '4-2-0',
    ranking: 8
  },
  {
    id: 59,
    name: 'Ramon Taveras',
    image_url: 'https://www.ufc-fr.com/data/combattant/2478/ramon-taveras-2024-01-20-09-58-58__cgzc__ID2478.webp',
    weight_class: '',
    organization_id: 1,
    record: '1-0-0',
    ranking: 0
  },
  {
    id: 60,
    name: 'Caolan Loughran',
    image_url: 'https://www.ufc-fr.com/data/combattant/2448/caolan-loughran-2023-09-02-11-11-02__nuoj__ID2448.webp',
    weight_class: '',
    organization_id: 1,
    record: '1-1-0',
    ranking: 0
  },
  {
    id: 61,
    name: 'Mick Parkin',
    image_url: 'https://www.ufc-fr.com/data/combattant/2416/mick-parkin-2023-11-18-11-44-39__ygfe__ID2416.webp',
    weight_class: '',
    organization_id: 1,
    record: '3-0-0',
    ranking: 0
  },
  {
    id: 62,
    name: 'Lukasz Brzeski',
    image_url: 'https://www.ufc-fr.com/data/combattant/2306/lukasz-brzeski-2024-04-06-11-42-44__spto__ID2306.webp',
    weight_class: '',
    organization_id: 1,
    record: '1-3-0',
    ranking: 0
  },
  {
    id: 63,
    name: 'Shauna Bannon',
    image_url: 'https://www.ufc-fr.com/data/combattant/2430/shauna-bannon-2023-07-22-05-07-49__fuyg__ID2430.webp',
    weight_class: '',
    organization_id: 1,
    record: '0-1-0',
    ranking: 0
  },
  {
    id: 64,
    name: 'Ravena Oliveira',
    image_url: 'https://www.ufc-fr.com/data/combattant/2469/ravena-oliveira-2023-10-14-10-58-02__mbxd__ID2469.webp',
    weight_class: '',
    organization_id: 1,
    record: '0-1-0',
    ranking: 0
  },
  {
    id: 65,
    name: 'Molly McCann',
    image_url: 'https://www.ufc-fr.com/data/combattant/1806/molly-mccann-2024-02-03-12-29-51__khat__ID1806.webp',
    weight_class: '',
    organization_id: 1,
    record: '7-5-0',
    ranking: 0
  },
  {
    id: 66,
    name: 'Bruna Brasil',
    image_url: 'https://www.ufc-fr.com/data/combattant/2396/bruna-brasil-2023-07-22-05-08-03__ffaw__ID2396.webp',
    weight_class: '',
    organization_id: 1,
    record: '1-2-0',
    ranking: 0
  },
  {
    id: 67,
    name: 'Oban Elliott',
    image_url: 'https://www.ufc-fr.com/data/combattant/2504/oban-elliott-2024-02-17-09-04-46__kmrq__ID2504.webp',
    weight_class: '',
    organization_id: 1,
    record: '1-0-0',
    ranking: 0
  },
  {
    id: 68,
    name: 'Preston Parsons',
    image_url: 'https://www.ufc-fr.com/data/combattant/2214/2022-04-23-08-06-34__jmlx__ID2214.jpg',
    weight_class: '',
    organization_id: 1,
    record: '2-2-0',
    ranking: 0
  },
  {
    id: 69,
    name: 'Sam Patterson',
    image_url: 'https://www.ufc-fr.com/data/combattant/2402/sam-patterson-2024-01-20-09-43-12__bask__ID2402.webp',
    weight_class: '',
    organization_id: 1,
    record: '1-1-0',
    ranking: 0
  },
  {
    id: 70,
    name: 'Kiefer Crosbie',
    image_url: 'https://www.ufc-fr.com/data/combattant/2462/kiefer-crosbie-2023-08-25-05-02-44__mldm__ID2462.webp',
    weight_class: '',
    organization_id: 1,
    record: '0-1-0',
    ranking: 0
  },
  {
    id: 71,
    name: 'Modestas Bukauskas',
    image_url: 'https://www.ufc-fr.com/data/combattant/2072/modestas-bukauskas-2023-11-04-09-47-02__zclm__ID2072.webp',
    weight_class: '',
    organization_id: 1,
    record: '3-4-0',
    ranking: 0
  },
  {
    id: 72,
    name: 'Marcin Prachnio',
    image_url: 'https://www.ufc-fr.com/data/combattant/1775/marcin-prachnio-2023-07-07-07-47-54__wcax__ID1775.webp',
    weight_class: '',
    organization_id: 1,
    record: '4-5-0',
    ranking: 0
  },
  {
    id: 73,
    name: 'Christian Leroy Duncan',
    image_url: 'https://www.ufc-fr.com/data/combattant/2405/christian-leroy-duncan-2024-03-02-09-26-39__xkzd__ID2405.webp',
    weight_class: '',
    organization_id: 1,
    record: '3-1-0',
    ranking: 0
  },
  {
    id: 74,
    name: 'Gregory Rodrigues',
    image_url: 'https://www.ufc-fr.com/data/combattant/2206/2022-06-17-06-39-49__qaeb__ID2206.jpg',
    weight_class: '',
    organization_id: 1,
    record: '6-2-0',
    ranking: 0
  },
  {
    id: 75,
    name: 'Cory Sandhagen',
    image_url: 'https://www.ufc-fr.com/data/combattant/1774/2018-08-24-11-33-27__muwz__ID1774.jpg',
    weight_class: '',
    organization_id: 1,
    record: '10-3-0',
    ranking: 2
  },
  {
    id: 76,
    name: 'Umar Nurmagomedov',
    image_url: 'https://www.ufc-fr.com/data/combattant/2059/umar-nurmagomedov-2024-03-02-10-49-49__cohi__ID2059.webp',
    weight_class: '',
    organization_id: 1,
    record: '5-0-0',
    ranking: 10
  },
  {
    id: 77,
    name: 'Vicente Luque',
    image_url: 'https://www.ufc-fr.com/data/combattant/68/2018-05-19-08-25-23__pyzu__ID68.jpg',
    weight_class: '',
    organization_id: 1,
    record: '15-6-0',
    ranking: 13
  },
  {
    id: 78,
    name: 'Nick Diaz',
    image_url: 'https://www.ufc-fr.com/data/combattant/83/2015-12-24-10-37-04__ruwu__ID83.jpg',
    weight_class: '',
    organization_id: 1,
    record: '7-7-0',
    ranking: 13
  },
  {
    id: 79,
    name: 'Joel Alvarez',
    image_url: 'https://www.ufc-fr.com/data/combattant/1901/joel-alvarez-2023-07-22-05-30-32__genr__ID1901.webp',
    weight_class: '',
    organization_id: 1,
    record: '5-2-0',
    ranking: 0
  },
  {
    id: 80,
    name: 'Elves Brener',
    image_url: 'https://www.ufc-fr.com/data/combattant/2392/elves-brener-2023-11-04-09-59-00__rzxw__ID2392.webp',
    weight_class: '',
    organization_id: 1,
    record: '3-1-0',
    ranking: 0
  },
  {
    id: 81,
    name: 'Michael Chiesa',
    image_url: 'https://www.ufc-fr.com/data/combattant/155/2019-07-05-09-28-57__fdtg__ID155.jpg',
    weight_class: '',
    organization_id: 1,
    record: '11-7-0',
    ranking: 0
  },
  {
    id: 82,
    name: 'Tony Ferguson',
    image_url: 'https://www.ufc-fr.com/data/combattant/43/tony-ferguson-2023-12-15-11-04-57__wios__ID43.webp',
    weight_class: '',
    organization_id: 1,
    record: '15-8-0',
    ranking: 0
  },
  {
    id: 83,
    name: 'Marlon Vera',
    image_url: 'https://www.ufc-fr.com/data/combattant/341/marlon-vera-2024-03-09-12-52-49__fuzx__ID341.webp',
    weight_class: '',
    organization_id: 1,
    record: '15-8-0',
    ranking: 4
  },
  {
    id: 84,
    name: 'Deiveson Figueiredo',
    image_url: 'https://www.ufc-fr.com/data/combattant/1667/deiveson-figueiredo-2024-04-13-08-56-22__xjev__ID1667.webp',
    weight_class: '',
    organization_id: 1,
    record: '12-3-1',
    ranking: 6
  },
  {
    id: 85,
    name: 'Chris Gutierrez',
    image_url: 'https://www.ufc-fr.com/data/combattant/1875/chris-gutierrez-2023-10-14-10-54-04__xdlq__ID1875.webp',
    weight_class: '',
    organization_id: 1,
    record: '8-3-1',
    ranking: 0
  },
  {
    id: 86,
    name: 'Javid Basharat',
    image_url: 'https://www.ufc-fr.com/data/combattant/2263/javid-basharat-2024-03-02-09-38-43__czlq__ID2263.webp',
    weight_class: '',
    organization_id: 1,
    record: '3-1-0',
    ranking: 0
  },
  {
    id: 87,
    name: 'Jai Herbert',
    image_url: 'https://www.ufc-fr.com/data/combattant/2038/jai-herbert-2023-07-22-05-42-19__bxzd__ID2038.webp',
    weight_class: '',
    organization_id: 1,
    record: '2-4-1',
    ranking: 0
  },
  {
    id: 88,
    name: 'Rolando Bedoya',
    image_url: 'https://www.ufc-fr.com/data/combattant/2399/2023-01-26-06-46-43__xqxe__ID2399.jpg',
    weight_class: '',
    organization_id: 1,
    record: '0-2-0',
    ranking: 0
  },
  {
    id: 89,
    name: 'Sedriques Dumas',
    image_url: 'https://www.ufc-fr.com/data/combattant/2369/sedriques-dumas-2023-10-21-09-31-27__zmyx__ID2369.webp',
    weight_class: '',
    organization_id: 1,
    record: '2-2-0',
    ranking: 0
  },
  {
    id: 90,
    name: 'Denis Tiuliulin',
    image_url: 'https://www.ufc-fr.com/data/combattant/2291/denis-tiuliulin-2023-11-18-02-32-59__hqtt__ID2291.webp',
    weight_class: '',
    organization_id: 1,
    record: '1-4-0',
    ranking: 0
  },
  {
    id: 91,
    name: 'Abdul-Kareem Al-Selwady',
    image_url: 'https://www.ufc-fr.com/data/combattant/2514/abdul-kareem-al-selwady-2024-03-02-08-32-35__mysg__ID2514.webp',
    weight_class: '',
    organization_id: 1,
    record: '0-1-0',
    ranking: 0
  },
  {
    id: 92,
    name: 'Guram Kutateladze',
    image_url: 'https://www.ufc-fr.com/data/combattant/2144/guram-kutateladze-2023-06-30-11-36-03__gbtk__ID2144.webp',
    weight_class: '',
    organization_id: 1,
    record: '1-2-0',
    ranking: 0
  },
  {
    id: 93,
    name: 'Mackenzie Dern',
    image_url: 'https://www.ufc-fr.com/data/combattant/1780/mackenzie-dern-2024-02-17-10-21-16__pbqk__ID1780.webp',
    weight_class: '',
    organization_id: 1,
    record: '8-5-0',
    ranking: 6
  },
  {
    id: 94,
    name: 'Lupita Godinez',
    image_url: 'https://www.ufc-fr.com/data/combattant/2197/lupita-godinez-2023-11-10-04-06-17__ydtn__ID2197.webp',
    weight_class: '',
    organization_id: 1,
    record: '7-4-0',
    ranking: 9
  },
  {
    id: 95,
    name: 'Alonzo Menifield',
    image_url: 'https://www.ufc-fr.com/data/combattant/1849/alonzo-menifield-2023-12-15-10-49-10__cvrw__ID1849.webp',
    weight_class: '',
    organization_id: 1,
    record: '8-4-1',
    ranking: 14
  },
  {
    id: 96,
    name: 'Azamat Murzakanov',
    image_url: 'https://www.ufc-fr.com/data/combattant/2239/2022-08-12-08-39-42__fwom__ID2239.jpg',
    weight_class: '',
    organization_id: 1,
    record: '3-0-0',
    ranking: 15
  },
  {
    id: 97,
    name: 'Victoria Dudakova',
    image_url: 'https://www.ufc-fr.com/data/combattant/2425/viktoriya-dudakova-2023-10-21-09-16-38__djjm__ID2425.webp',
    weight_class: '',
    organization_id: 1,
    record: '2-0-0',
    ranking: 0
  },
  {
    id: 98,
    name: 'Sam Hughes',
    image_url: 'https://www.ufc-fr.com/data/combattant/2160/2022-04-16-01-31-41__olas__ID2160.jpg',
    weight_class: '',
    organization_id: 1,
    record: '3-5-0',
    ranking: 0
  },
  {
    id: 99,
    name: 'Azat Maksum',
    image_url: 'https://www.ufc-fr.com/data/combattant/2414/azat-maksum-2023-07-14-09-56-28__hubr__ID2414.webp',
    weight_class: '',
    organization_id: 1,
    record: '1-1-0',
    ranking: 0
  },
  {
    id: 100,
    name: 'C.J. Vergara',
    image_url: 'https://www.ufc-fr.com/data/combattant/2243/c-j--vergara-2024-03-09-09-12-30__tjme__ID2243.webp',
    weight_class: '',
    organization_id: 1,
    record: '3-3-0',
    ranking: 0
  },
  {
    id: 101,
    name: 'Mohammad Yahya',
    image_url: 'https://www.ufc-fr.com/data/combattant/2468/mohammad-yahya-2023-10-21-09-40-32__eeai__ID2468.webp',
    weight_class: '',
    organization_id: 1,
    record: '0-1-0',
    ranking: 0
  },
  {
    id: 102,
    name: 'Kaue Fernandes',
    image_url: 'https://www.ufc-fr.com/data/combattant/2474/kaue-fernandes-2023-11-04-09-27-16__rxdm__ID2474.webp',
    weight_class: '',
    organization_id: 1,
    record: '0-1-0',
    ranking: 0
  },
  {
    id: 103,
    name: 'Don tale Mayes',
    image_url: 'https://www.ufc-fr.com/data/combattant/1996/don-tale-mayes-2024-04-27-12-15-15__auzs__ID1996.jpeg',
    weight_class: '',
    organization_id: 1,
    record: '4-4-0',
    ranking: 0
  },
  {
    id: 104,
    name: 'Shamil Gaziev',
    image_url: 'https://www.ufc-fr.com/data/combattant/2482/shamil-gaziev-2024-03-02-11-17-03__xhnw__ID2482.webp',
    weight_class: '',
    organization_id: 1,
    record: '1-1-0',
    ranking: 0
  },
  {
    id: 105,
    name: 'Marcin Tybura',
    image_url: 'https://www.ufc-fr.com/data/combattant/1538/marcin-tybura-2023-07-22-05-53-15__ufmq__ID1538.webp',
    weight_class: '',
    organization_id: 1,
    record: '12-7-0',
    ranking: 8
  },
  {
    id: 106,
    name: 'Serghei Spivac',
    image_url: 'https://www.ufc-fr.com/data/combattant/1928/serghei-spivac-2023-09-02-11-41-59__pmpg__ID1928.webp',
    weight_class: '',
    organization_id: 1,
    record: '7-4-0',
    ranking: 9
  },
  {
    id: 107,
    name: 'Jarno Errens',
    image_url: 'https://www.ufc-fr.com/data/combattant/2332/jarno-errens-2023-08-25-12-46-11__pyvx__ID2332.webp',
    weight_class: '',
    organization_id: 1,
    record: '1-2-0',
    ranking: 0
  },
  {
    id: 108,
    name: 'Youssef Zalal',
    image_url: 'https://www.ufc-fr.com/data/combattant/2040/2020-02-08-09-21-24__nhkv__ID2040.jpg',
    weight_class: '',
    organization_id: 1,
    record: '4-3-1',
    ranking: 0
  },
  {
    id: 109,
    name: 'Karl Williams',
    image_url: 'https://www.ufc-fr.com/data/combattant/2367/karl-williams-2023-03-11-09-22-13__oiif__ID2367.jpg',
    weight_class: '',
    organization_id: 1,
    record: '3-0-0',
    ranking: 0
  },
  {
    id: 110,
    name: 'Jhonata Diniz',
    image_url: 'https://www.ufc-fr.com/data/combattant/2520/jhonata-diniz-2024-04-27-12-26-27__mixc__ID2520.jpeg',
    weight_class: '',
    organization_id: 1,
    record: '1-0-0',
    ranking: 0
  },
  {
    id: 111,
    name: 'Jonny Parsons',
    image_url: 'https://www.ufc-fr.com/data/combattant/2281/2022-02-10-11-10-32__fzll__ID2281.jpg',
    weight_class: '',
    organization_id: 1,
    record: '1-0-0',
    ranking: 0
  },
  {
    id: 112,
    name: 'Yusaku Kinoshita',
    image_url: 'https://www.ufc-fr.com/data/combattant/2352/2023-02-04-09-07-06__epun__ID2352.jpg',
    weight_class: '',
    organization_id: 1,
    record: '0-2-0',
    ranking: 0
  },
  {
    id: 113,
    name: 'Stephanie Luciano',
    image_url: 'https://www.ufc-fr.com/data/combattant/2506/stephanie-luciano-2023-12-25-09-43-12__lsdd__ID2506.webp',
    weight_class: '',
    organization_id: 1,
    record: '0-0-0',
    ranking: 0
  },
  {
    id: 114,
    name: 'Talita Alencar',
    image_url: 'https://www.ufc-fr.com/data/combattant/2495/talita-alencar-2023-12-08-09-01-10__zqih__ID2495.webp',
    weight_class: '',
    organization_id: 1,
    record: '1-0-0',
    ranking: 0
  },
  {
    id: 115,
    name: 'Allan Nascimento',
    image_url: 'https://www.ufc-fr.com/data/combattant/2217/2023-01-14-02-11-52__dfnf__ID2217.jpg',
    weight_class: '',
    organization_id: 1,
    record: '2-1-0',
    ranking: 0
  },
  {
    id: 116,
    name: 'Jafel Filho',
    image_url: 'https://www.ufc-fr.com/data/combattant/2395/2023-01-17-08-38-29__bxdc__ID2395.jpg',
    weight_class: '',
    organization_id: 1,
    record: '2-1-0',
    ranking: 0
  },
  {
    id: 117,
    name: 'Danny Barlow',
    image_url: 'https://www.ufc-fr.com/data/combattant/2473/danny-barlow-2023-10-02-03-07-41__cwye__ID2473.webp',
    weight_class: '',
    organization_id: 1,
    record: '1-0-0',
    ranking: 0
  },
  {
    id: 118,
    name: 'Uros Medic',
    image_url: 'https://www.ufc-fr.com/data/combattant/2163/uros-medic-2024-04-27-12-39-19__xsbh__ID2163.jpeg',
    weight_class: '',
    organization_id: 1,
    record: '4-2-0',
    ranking: 0
  },
  {
    id: 119,
    name: 'Yana Santos',
    image_url: 'https://www.ufc-fr.com/data/combattant/1781/2018-10-05-08-00-19__pmvf__ID1781.jpg',
    weight_class: '',
    organization_id: 1,
    record: '4-5-0',
    ranking: 12
  },
  {
    id: 120,
    name: 'Chelsea Chandler',
    image_url: 'https://www.ufc-fr.com/data/combattant/2307/chelsea-chandler-2024-03-16-10-51-24__yytw__ID2307.webp',
    weight_class: '',
    organization_id: 1,
    record: '2-1-0',
    ranking: 14
  },
  {
    id: 121,
    name: 'Charalampos Grigoriou',
    image_url: 'https://www.ufc-fr.com/data/combattant/2510/charalampos-grigoriou-2024-03-16-05-54-27__tzed__ID2510.webp',
    weight_class: '',
    organization_id: 1,
    record: '0-1-0',
    ranking: 0
  },
  {
    id: 122,
    name: 'Toshiomi Kazama',
    image_url: 'https://www.ufc-fr.com/data/combattant/2389/2023-02-04-08-53-12__ubbi__ID2389.jpg',
    weight_class: '',
    organization_id: 1,
    record: '0-2-0',
    ranking: 0
  },
  {
    id: 123,
    name: 'Dricus Du Plessis',
    image_url: 'https://www.ufc-fr.com/data/combattant/2137/dricus-du-plessis-2024-01-20-12-05-16__zcwn__ID2137.webp',
    weight_class: '',
    organization_id: 1,
    record: '7-0-0',
    ranking: 2
  },
  {
    id: 124,
    name: 'Israel Adesanya',
    image_url: 'https://www.ufc-fr.com/data/combattant/1767/2020-09-24-03-15-35__mhwu__ID1767.jpg',
    weight_class: '',
    organization_id: 1,
    record: '13-3-0',
    ranking: 2
  },
  {
    id: 125,
    name: 'Tom Nolan',
    image_url: 'https://www.ufc-fr.com/data/combattant/2499/tom-nolan-2024-05-18-10-28-18__skzi__ID2499.webp',
    weight_class: '',
    organization_id: 1,
    record: '1-1-0',
    ranking: 0
  },
  {
    id: 126,
    name: 'Alex Reyes',
    image_url: 'https://www.ufc-fr.com/data/combattant/1716/alex-reyes-2023-02-13-09-15-50__vgnd__ID1716.jpg',
    weight_class: '',
    organization_id: 1,
    record: '0-2-0',
    ranking: 0
  },
  {
    id: 127,
    name: 'Jairzinho Rozenstruik',
    image_url: 'https://www.ufc-fr.com/data/combattant/1892/jairzinho-rozenstruik-2024-03-02-11-17-21__ggfw__ID1892.webp',
    weight_class: '',
    organization_id: 1,
    record: '8-5-0',
    ranking: 12
  },
  {
    id: 128,
    name: 'Tai Tuivasa',
    image_url: 'https://www.ufc-fr.com/data/combattant/1733/2018-06-09-02-27-03__igkr__ID1733.jpg',
    weight_class: '',
    organization_id: 1,
    record: '8-7-0',
    ranking: 10
  },
  {
    id: 129,
    name: 'Kai Kara-France',
    image_url: 'https://www.ufc-fr.com/data/combattant/1834/2019-02-09-09-34-26__fufq__ID1834.jpg',
    weight_class: '',
    organization_id: 1,
    record: '7-4-0',
    ranking: 4
  },
  {
    id: 130,
    name: 'Steve Erceg',
    image_url: 'https://www.ufc-fr.com/data/combattant/2417/steve-erceg-2024-03-02-10-22-23__ackq__ID2417.webp',
    weight_class: '',
    organization_id: 1,
    record: '3-1-0',
    ranking: 9
  },
  {
    id: 131,
    name: 'Junior Tafa',
    image_url: 'https://www.ufc-fr.com/data/combattant/2393/junior-tafa-2024-02-17-10-03-38__ahzf__ID2393.webp',
    weight_class: '',
    organization_id: 1,
    record: '1-2-0',
    ranking: 0
  },
  {
    id: 132,
    name: 'Valter Walker',
    image_url: 'https://www.ufc-fr.com/data/combattant/2437/valter-walker-2024-04-06-11-42-27__umyr__ID2437.webp',
    weight_class: '',
    organization_id: 1,
    record: '0-1-0',
    ranking: 0
  },
  {
    id: 133,
    name: 'Gavin Tucker',
    image_url: 'https://www.ufc-fr.com/data/combattant/1653/2019-07-26-11-01-14__qnfi__ID1653.jpg',
    weight_class: '',
    organization_id: 1,
    record: '4-3-0',
    ranking: 0
  },
  {
    id: 134,
    name: 'Jack Jenkins',
    image_url: 'https://www.ufc-fr.com/data/combattant/2358/jack-jenkins-2023-02-11-09-22-16__heit__ID2358.jpg',
    weight_class: '',
    organization_id: 1,
    record: '2-1-0',
    ranking: 0
  },
  {
    id: 135,
    name: 'Josh Culibao',
    image_url: 'https://www.ufc-fr.com/data/combattant/2048/josh-culibao-2024-03-16-10-01-51__masl__ID2048.webp',
    weight_class: '',
    organization_id: 1,
    record: '3-3-1',
    ranking: 0
  },
  {
    id: 136,
    name: 'Ricardo Ramos',
    image_url: 'https://www.ufc-fr.com/data/combattant/1647/2022-06-17-06-32-40__dsxx__ID1647.jpg',
    weight_class: '',
    organization_id: 1,
    record: '7-5-0',
    ranking: 0
  },
  {
    id: 137,
    name: 'Casey O\'Neill',
    image_url: 'https://www.ufc-fr.com/data/combattant/2159/casey-o-neill-2023-12-15-10-32-35__vdqv__ID2159.webp',
    weight_class: '',
    organization_id: 1,
    record: '4-2-0',
    ranking: 13
  },
  {
    id: 138,
    name: 'Tereza Bleda',
    image_url: 'https://www.ufc-fr.com/data/combattant/2346/2022-11-18-09-29-21__uszb__ID2346.jpg',
    weight_class: '',
    organization_id: 1,
    record: '1-1-0',
    ranking: 13
  },
  {
    id: 139,
    name: 'Jingliang Li',
    image_url: 'https://www.ufc-fr.com/data/combattant/950/2019-08-31-02-19-13__yjnh__ID950.jpg',
    weight_class: '',
    organization_id: 1,
    record: '11-6-0',
    ranking: 0
  },
  {
    id: 140,
    name: 'Carlos Prates',
    image_url: 'https://www.ufc-fr.com/data/combattant/2496/carlos-prates-2023-11-23-09-08-57__usnw__ID2496.webp',
    weight_class: '',
    organization_id: 1,
    record: '2-0-0',
    ranking: 0
  },
  {
    id: 141,
    name: 'Zach Reese',
    image_url: 'https://www.ufc-fr.com/data/combattant/2483/zachary-reese-2023-12-02-10-20-24__mgaf__ID2483.webp',
    weight_class: '',
    organization_id: 1,
    record: '1-1-0',
    ranking: 0
  },
  {
    id: 142,
    name: 'Jose Medina',
    image_url: 'https://www.ufc-fr.com/data/combattant/2585/jose-medina-2024-06-18-09-17-40__ooda__ID2585.webp',
    weight_class: '',
    organization_id: 1,
    record: '0-0-0',
    ranking: 0
  },
  {
    id: 143,
    name: 'Dennis Buzukja',
    image_url: 'https://www.ufc-fr.com/data/combattant/2450/dennis-buzukja-2023-11-10-03-38-44__txew__ID2450.webp',
    weight_class: '',
    organization_id: 1,
    record: '1-2-0',
    ranking: 0
  },
  {
    id: 144,
    name: 'Danny Silva',
    image_url: 'https://www.ufc-fr.com/data/combattant/2518/danny-silva-2024-03-16-10-01-21__hozs__ID2518.webp',
    weight_class: '',
    organization_id: 1,
    record: '1-0-0',
    ranking: 0
  },
  {
    id: 145,
    name: 'Neil Magny',
    image_url: 'https://www.ufc-fr.com/data/combattant/29/neil-magny-2024-01-20-11-32-25__szse__ID29.webp',
    weight_class: '',
    organization_id: 1,
    record: '22-10-0',
    ranking: 12
  },
  {
    id: 146,
    name: 'Michael Morales',
    image_url: 'https://www.ufc-fr.com/data/combattant/2250/michael-morales-2023-07-01-10-07-38__frjn__ID2250.webp',
    weight_class: '',
    organization_id: 1,
    record: '4-0-0',
    ranking: 12
  },
  {
    id: 147,
    name: 'Viacheslav Borshchev',
    image_url: 'https://www.ufc-fr.com/data/combattant/2255/viacheslav-borshchev-2023-11-10-04-00-29__pplg__ID2255.webp',
    weight_class: '',
    organization_id: 1,
    record: '2-3-1',
    ranking: 0
  },
  {
    id: 148,
    name: 'James Llontop',
    image_url: 'https://www.ufc-fr.com/data/combattant/2516/james-llontop-2024-04-27-12-06-23__ccyx__ID2516.jpeg',
    weight_class: '',
    organization_id: 1,
    record: '0-1-0',
    ranking: 0
  },
  {
    id: 149,
    name: 'Roman Kopylov',
    image_url: 'https://www.ufc-fr.com/data/combattant/2011/roman-kopylov-2024-06-01-10-43-37__pctl__ID2011.webp',
    weight_class: '',
    organization_id: 1,
    record: '5-3-0',
    ranking: 0
  },
  {
    id: 150,
    name: 'Brunno Ferreira',
    image_url: 'https://www.ufc-fr.com/data/combattant/2382/2023-01-21-11-39-57__pgxr__ID2382.jpg',
    weight_class: '',
    organization_id: 1,
    record: '3-1-0',
    ranking: 0
  },
  {
    id: 151,
    name: 'Gerald Meerschaert',
    image_url: 'https://www.ufc-fr.com/data/combattant/1628/gerald-meerschaert-2024-03-16-11-45-50__xkhv__ID1628.webp',
    weight_class: '',
    organization_id: 1,
    record: '11-9-0',
    ranking: 0
  },
  {
    id: 152,
    name: 'Edmen Shahbazyan',
    image_url: 'https://www.ufc-fr.com/data/combattant/1862/2019-07-05-09-18-08__beod__ID1862.jpg',
    weight_class: '',
    organization_id: 1,
    record: '6-4-0',
    ranking: 0
  },
  {
    id: 153,
    name: 'Josiane Nunes',
    image_url: 'https://www.ufc-fr.com/data/combattant/1763/josiane-nunes-2024-03-16-10-51-41__uivm__ID1763.webp',
    weight_class: '',
    organization_id: 1,
    record: '3-1-0',
    ranking: 0
  },
  {
    id: 154,
    name: 'Jacqueline Cavalcanti',
    image_url: 'https://www.ufc-fr.com/data/combattant/2457/jacqueline-cavalcanti-2023-09-02-09-38-45__dgew__ID2457.webp',
    weight_class: '',
    organization_id: 1,
    record: '1-0-0',
    ranking: 0
  },
  {
    id: 155,
    name: 'Gilbert Burns',
    image_url: 'https://www.ufc-fr.com/data/combattant/914/2018-07-07-02-29-47__erda__ID914.jpg',
    weight_class: '',
    organization_id: 1,
    record: '15-7-0',
    ranking: 6
  },
  {
    id: 156,
    name: 'Sean Brady',
    image_url: 'https://www.ufc-fr.com/data/combattant/2004/sean-brady-2023-12-02-10-49-25__zjaf__ID2004.webp',
    weight_class: '',
    organization_id: 1,
    record: '6-1-0',
    ranking: 8
  },
  {
    id: 157,
    name: 'Calvin Kattar',
    image_url: 'https://www.ufc-fr.com/data/combattant/1702/calvin-kattar-2024-04-13-11-39-25__dcos__ID1702.webp',
    weight_class: '',
    organization_id: 1,
    record: '7-6-0',
    ranking: 9
  },
  {
    id: 158,
    name: 'Kyle Nelson',
    image_url: 'https://www.ufc-fr.com/data/combattant/1899/2023-02-04-09-17-14__okci__ID1899.jpg',
    weight_class: '',
    organization_id: 1,
    record: '4-4-1',
    ranking: 9
  },
  {
    id: 159,
    name: 'Jessica Andrade',
    image_url: 'https://www.ufc-fr.com/data/combattant/634/jessica-andrade-2024-04-13-09-39-03__ixmm__ID634.webp',
    weight_class: '',
    organization_id: 1,
    record: '17-10-0',
    ranking: 5
  },
  {
    id: 160,
    name: 'Natalia Silva',
    image_url: 'https://www.ufc-fr.com/data/combattant/2162/natalia-silva-2024-02-03-01-28-04__clyd__ID2162.webp',
    weight_class: '',
    organization_id: 1,
    record: '5-0-0',
    ranking: 8
  },
  {
    id: 161,
    name: 'Andre Lima',
    image_url: 'https://www.ufc-fr.com/data/combattant/2533/andre-lima-2024-06-01-10-08-15__slqu__ID2533.webp',
    weight_class: '',
    organization_id: 1,
    record: '2-0-0',
    ranking: 0
  },
  {
    id: 162,
    name: 'Felipe dos Santos',
    image_url: 'https://www.ufc-fr.com/data/combattant/2458/felipe-dos-santos-2023-08-22-08-06-35__qfha__ID2458.webp',
    weight_class: '',
    organization_id: 1,
    record: '1-1-0',
    ranking: 0
  },
  {
    id: 163,
    name: 'Matt Schnell',
    image_url: 'https://www.ufc-fr.com/data/combattant/1629/matt-schnell-2024-03-02-10-22-56__dsqq__ID1629.webp',
    weight_class: '',
    organization_id: 1,
    record: '6-6-0',
    ranking: 12
  },
  {
    id: 164,
    name: 'Alessandro Costa',
    image_url: 'https://www.ufc-fr.com/data/combattant/2364/alessandro-costa-2023-11-10-04-08-48__yojr__ID2364.webp',
    weight_class: '',
    organization_id: 1,
    record: '2-2-0',
    ranking: 12
  },
  {
    id: 165,
    name: 'Sean O\'Malley',
    image_url: 'https://www.ufc-fr.com/data/combattant/1747/sean-o-malley-2024-03-09-12-53-05__uumw__ID1747.webp',
    weight_class: '',
    organization_id: 1,
    record: '10-1-0',
    ranking: 1
  },
  {
    id: 166,
    name: 'Merab Dvalishvili',
    image_url: 'https://www.ufc-fr.com/data/combattant/1745/merab-dvalishvili-2024-02-17-10-39-50__byzy__ID1745.webp',
    weight_class: '',
    organization_id: 1,
    record: '10-2-0',
    ranking: 1
  },
  {
    id: 167,
    name: 'Alexa Grasso',
    image_url: 'https://www.ufc-fr.com/data/combattant/1596/2018-05-19-08-47-04__qrte__ID1596.jpg',
    weight_class: '',
    organization_id: 1,
    record: '8-3-1',
    ranking: 1
  },
  {
    id: 168,
    name: 'Valentina Shevchenko',
    image_url: 'https://www.ufc-fr.com/data/combattant/1518/valentina-shevchenko-2023-03-03-09-42-37__htcj__ID1518.jpg',
    weight_class: '',
    organization_id: 1,
    record: '12-3-1',
    ranking: 1
  },
  {
    id: 169,
    name: 'Irene Aldana',
    image_url: 'https://www.ufc-fr.com/data/combattant/1635/irene-aldana-2023-12-15-10-43-28__yatg__ID1635.webp',
    weight_class: '',
    organization_id: 1,
    record: '8-5-0',
    ranking: 3
  },
  {
    id: 170,
    name: 'Norma Dumont',
    image_url: 'https://www.ufc-fr.com/data/combattant/2032/norma-dumont-2024-04-06-11-06-44__jewl__ID2032.webp',
    weight_class: '',
    organization_id: 1,
    record: '7-2-0',
    ranking: 10
  },
  {
    id: 171,
    name: 'Michel Pereira',
    image_url: 'https://www.ufc-fr.com/data/combattant/1932/michel-pereira-2024-03-09-10-00-39__bryr__ID1932.webp',
    weight_class: '',
    organization_id: 1,
    record: '9-2-0',
    ranking: 13
  },
  {
    id: 172,
    name: 'Anthony Hernandez',
    image_url: 'https://www.ufc-fr.com/data/combattant/1891/anthony-hernandez-2024-02-17-10-26-48__occt__ID1891.webp',
    weight_class: '',
    organization_id: 1,
    record: '6-2-0',
    ranking: 14
  },
  {
    id: 173,
    name: 'Yazmin Jauregui',
    image_url: 'https://www.ufc-fr.com/data/combattant/2303/2022-08-12-08-36-08__cpda__ID2303.jpg',
    weight_class: '',
    organization_id: 1,
    record: '3-1-0',
    ranking: 0
  },
  {
    id: 174,
    name: 'Ketlen Souza',
    image_url: 'https://www.ufc-fr.com/data/combattant/2421/ketlen-souza-2024-04-27-12-13-04__zegy__ID2421.jpeg',
    weight_class: '',
    organization_id: 1,
    record: '1-1-0',
    ranking: 0
  },
  {
    id: 175,
    name: 'Edgar Chairez',
    image_url: 'https://www.ufc-fr.com/data/combattant/2442/edgar-chairez-2023-07-07-07-49-20__fopb__ID2442.webp',
    weight_class: '',
    organization_id: 1,
    record: '1-1-0',
    ranking: 0
  },
  {
    id: 176,
    name: 'Kevin Borjas',
    image_url: 'https://www.ufc-fr.com/data/combattant/2455/kevin-borjas-2023-11-10-03-39-56__qkyw__ID2455.webp',
    weight_class: '',
    organization_id: 1,
    record: '0-2-0',
    ranking: 0
  },
  {
    id: 177,
    name: 'Benoit Saint-Denis',
    image_url: 'https://www.ufc-fr.com/data/combattant/2253/benoit-saint-denis-2024-03-09-12-51-12__dexw__ID2253.webp',
    weight_class: '',
    organization_id: 1,
    record: '5-2-0',
    ranking: 11
  },
  {
    id: 178,
    name: 'Renato Moicano',
    image_url: 'https://www.ufc-fr.com/data/combattant/1396/renato-moicano-2024-04-13-10-00-12__dcuh__ID1396.webp',
    weight_class: '',
    organization_id: 1,
    record: '11-5-0',
    ranking: 9
  },
  {
    id: 179,
    name: 'Joanderson Brito',
    image_url: 'https://www.ufc-fr.com/data/combattant/2238/joanderson-brito-2023-07-01-08-59-32__uapy__ID2238.webp',
    weight_class: '',
    organization_id: 1,
    record: '5-1-0',
    ranking: 0
  },
  {
    id: 180,
    name: 'William Gomis',
    image_url: 'https://www.ufc-fr.com/data/combattant/2331/william-gomis-2023-09-02-11-20-12__qlip__ID2331.webp',
    weight_class: '',
    organization_id: 1,
    record: '3-0-0',
    ranking: 0
  },
  {
    id: 181,
    name: 'Raquel Pennington',
    image_url: 'https://www.ufc-fr.com/data/combattant/219/raquel-pennington-2024-01-20-12-03-41__dwfs__ID219.webp',
    weight_class: '',
    organization_id: 1,
    record: '13-5-0',
    ranking: 1
  },
  {
    id: 182,
    name: 'Julianna Pena',
    image_url: 'https://www.ufc-fr.com/data/combattant/904/2021-01-22-06-35-23__ddic__ID904.jpg',
    weight_class: '',
    organization_id: 1,
    record: '7-3-0',
    ranking: 1
  },
  
  {
    id: 1,
    name: 'Fighter One',
    image_url: '/fighter.png',
    weight_class: 'Lightweight',
    organization_id: 1,
    record : '10-2-0',
    ranking: 0,
  },
  {
    id: 2,
    name: 'Fighter Two',
    image_url: '/fighter.png',
    weight_class: 'Featherweight',
    organization_id: 1,
    record : '12-3-0',
    ranking: 0,
  },
  {
    id: 3,
    name: 'Fighter Three',
    image_url: '/fighter.png',
    weight_class: 'Middleweight',
    organization_id: 3,
    record : '15-5-0',
    ranking: 0,
  },
  {
    id: 4,
    name: 'Fighter Four',
    image_url: '/fighter.png',
    weight_class: 'Heavyweight',
    organization_id: 3,
    record : '10-6-0',
    ranking: 0,
  },
  {
    id: 5,
    name: 'Fighter Five',
    image_url: '/fighter.png',
    weight_class: 'Welterweight',
    organization_id: 2,
    record : '8-4-0',
    ranking: 0,
  },
  {
    id: 6,
    name: 'Fighter Six',
    image_url: '/fighter.png',
    weight_class: 'Light Heavyweight',
    organization_id: 2,
    record : '7-3-0',
    ranking: 0,
  },
];


// Exporting the data to be used in your application
export { organizations, events, fights, fighters };
