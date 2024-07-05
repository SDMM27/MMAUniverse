const formattedFights = [
    {
        id: 1,
        eventName: "UFC ON ESPN 59 - NAMAJUNAS VS. CORTEZ",
        fighter1Name: "Rose Namajunas",
        fighter2Name: "Tracy Cortez",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Mouches"
    },
    {
        id: 2,
        eventName: "UFC ON ESPN 59 - NAMAJUNAS VS. CORTEZ",
        fighter1Name: "Santiago Ponzinibbio",
        fighter2Name: "Muslim Salikhov",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Mi-Moyens"
    },
    {
        id: 3,
        eventName: "UFC ON ESPN 59 - NAMAJUNAS VS. CORTEZ",
        fighter1Name: "Drew Dober",
        fighter2Name: "Jean Silva",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Légers"
    },
    {
        id: 4,
        eventName: "UFC ON ESPN 59 - NAMAJUNAS VS. CORTEZ",
        fighter1Name: "Ange Loosa",
        fighter2Name: "Gabriel Bonfim",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Mi-Moyens"
    },
    {
        id: 5,
        eventName: "UFC ON ESPN 59 - NAMAJUNAS VS. CORTEZ",
        fighter1Name: "Christian Rodriguez",
        fighter2Name: "Julian Erosa",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Plumes"
    },
    {
        id: 6,
        eventName: "UFC ON ESPN 59 - NAMAJUNAS VS. CORTEZ",
        fighter1Name: "Cody Brundage",
        fighter2Name: "Abdul Razak Alhassan",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Moyens"
    },
    {
        id: 7,
        eventName: "UFC ON ESPN 59 - NAMAJUNAS VS. CORTEZ",
        fighter1Name: "Viviane Araujo",
        fighter2Name: "Jasmine Jasudavicius",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Mouches"
    },
    {
        id: 8,
        eventName: "UFC ON ESPN 59 - NAMAJUNAS VS. CORTEZ",
        fighter1Name: "Montel Jackson",
        fighter2Name: "Da'Mon Blackshear",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Coqs"
    },
    {
        id: 9,
        eventName: "UFC ON ESPN 59 - NAMAJUNAS VS. CORTEZ",
        fighter1Name: "Luana Santos",
        fighter2Name: "Mariya Agapova",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Mouches"
    },
    {
        id: 10,
        eventName: "UFC ON ESPN 59 - NAMAJUNAS VS. CORTEZ",
        fighter1Name: "Josh Fremd",
        fighter2Name: "Andre Petroski",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Moyens"
    },
    {
        id: 11,
        eventName: "UFC ON ESPN 59 - NAMAJUNAS VS. CORTEZ",
        fighter1Name: "Joshua Van",
        fighter2Name: "Charles Johnson",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Mouches"
    },
    {
        id: 12,
        eventName: "UFC ON ESPN 60 - LEMOS VS. JANDIROBA",
        fighter1Name: "Amanda Lemos",
        fighter2Name: "Virna Jandiroba",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Pailles"
    },
    {
        id: 13,
        eventName: "UFC ON ESPN 60 - LEMOS VS. JANDIROBA",
        fighter1Name: "Brad Tavares",
        fighter2Name: "Jun Yong Park",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Moyens"
    },
    {
        id: 14,
        eventName: "UFC ON ESPN 60 - LEMOS VS. JANDIROBA",
        fighter1Name: "Bill Algeo",
        fighter2Name: "Doo Ho Choi",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Plumes"
    },
    {
        id: 15,
        eventName: "UFC ON ESPN 60 - LEMOS VS. JANDIROBA",
        fighter1Name: "Loik Radzhabov",
        fighter2Name: "Trey Ogden",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Légers"
    },
    {
        id: 16,
        eventName: "UFC ON ESPN 60 - LEMOS VS. JANDIROBA",
        fighter1Name: "Kurt Holobaugh",
        fighter2Name: "Kaynan Kruschewsky",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Légers"
    },
    {
        id: 17,
        eventName: "UFC ON ESPN 60 - LEMOS VS. JANDIROBA",
        fighter1Name: "Hyder Amil",
        fighter2Name: "Jeong Yeong Lee",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Plumes"
    },
    {
        id: 18,
        eventName: "UFC ON ESPN 60 - LEMOS VS. JANDIROBA",
        fighter1Name: "Brian Kelleher",
        fighter2Name: "Cody Gibson",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Coqs"
    },
    {
        id: 19,
        eventName: "UFC ON ESPN 60 - LEMOS VS. JANDIROBA",
        fighter1Name: "Luana Carolina",
        fighter2Name: "Lucie Pudilova",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Coqs"
    },
    {
        id: 20,
        eventName: "UFC ON ESPN 60 - LEMOS VS. JANDIROBA",
        fighter1Name: "Miranda Maverick",
        fighter2Name: "Dione Barbosa",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Mouches"
    },
    {
        id: 21,
        eventName: "UFC ON ESPN 60 - LEMOS VS. JANDIROBA",
        fighter1Name: "Mohammed Usman",
        fighter2Name: "Thomas Petersen",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Lourds"
    },
    {
        id: 22,
        eventName: "UFC ON ESPN 60 - LEMOS VS. JANDIROBA",
        fighter1Name: "Steve Garcia",
        fighter2Name: "Seung Woo Choi",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Plumes"
    },
    {
        id: 23,
        eventName: "UFC ON ESPN 60 - LEMOS VS. JANDIROBA",
        fighter1Name: "Cody Durden",
        fighter2Name: "Bruno Gustavo da Silva",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Mouches"
    },
    {
        id: 24,
        eventName: "UFC 304 - EDWARDS VS. MUHAMMAD 2",
        fighter1Name: "Leon Edwards",
        fighter2Name: "Belal Muhammad",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Mi-Moyens"
    },
    {
        id: 25,
        eventName: "UFC 304 - EDWARDS VS. MUHAMMAD 2",
        fighter1Name: "Tom Aspinall",
        fighter2Name: "Curtis Blaydes",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Lourds"
    },
    {
        id: 26,
        eventName: "UFC 304 - EDWARDS VS. MUHAMMAD 2",
        fighter1Name: "Bobby Green",
        fighter2Name: "Paddy Pimblett",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Légers"
    },
    {
        id: 27,
        eventName: "UFC 304 - EDWARDS VS. MUHAMMAD 2",
        fighter1Name: "Arnold Allen",
        fighter2Name: "Giga Chikadze",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Plumes"
    },
    {
        id: 28,
        eventName: "UFC 304 - EDWARDS VS. MUHAMMAD 2",
        fighter1Name: "Nathaniel Wood",
        fighter2Name: "Daniel Pineda",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Plumes"
    },
    {
        id: 29,
        eventName: "UFC 304 - EDWARDS VS. MUHAMMAD 2",
        fighter1Name: "Muhammad Mokaev",
        fighter2Name: "Manel Kape",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Mouches"
    },
    {
        id: 30,
        eventName: "UFC 304 - EDWARDS VS. MUHAMMAD 2",
        fighter1Name: "Ramon Taveras",
        fighter2Name: "Caolan Loughran",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Coqs"
    },
    {
        id: 31,
        eventName: "UFC 304 - EDWARDS VS. MUHAMMAD 2",
        fighter1Name: "Mick Parkin",
        fighter2Name: "Lukasz Brzeski",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Lourds"
    },
    {
        id: 32,
        eventName: "UFC 304 - EDWARDS VS. MUHAMMAD 2",
        fighter1Name: "Shauna Bannon",
        fighter2Name: "Ravena Oliveira",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Coqs"
    },
    {
        id: 33,
        eventName: "UFC 304 - EDWARDS VS. MUHAMMAD 2",
        fighter1Name: "Molly McCann",
        fighter2Name: "Bruna Brasil",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Pailles"
    },
    {
        id: 34,
        eventName: "UFC 304 - EDWARDS VS. MUHAMMAD 2",
        fighter1Name: "Oban Elliott",
        fighter2Name: "Preston Parsons",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Mi-Moyens"
    },
    {
        id: 35,
        eventName: "UFC 304 - EDWARDS VS. MUHAMMAD 2",
        fighter1Name: "Sam Patterson",
        fighter2Name: "Kiefer Crosbie",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Mi-Moyens"
    },
    {
        id: 36,
        eventName: "UFC 304 - EDWARDS VS. MUHAMMAD 2",
        fighter1Name: "Modestas Bukauskas",
        fighter2Name: "Marcin Prachnio",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Mi-Lourds"
    },
    {
        id: 37,
        eventName: "UFC 304 - EDWARDS VS. MUHAMMAD 2",
        fighter1Name: "Christian Leroy Duncan",
        fighter2Name: "Gregory Rodrigues",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Moyens"
    },
    {
        id: 38,
        eventName: "UFC ON ABC 7 - SANDHAGEN VS. NURMAGOMEDOV",
        fighter1Name: "Cory Sandhagen",
        fighter2Name: "Umar Nurmagomedov",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Coqs"
    },
    {
        id: 39,
        eventName: "UFC ON ABC 7 - SANDHAGEN VS. NURMAGOMEDOV",
        fighter1Name: "Vicente Luque",
        fighter2Name: "Nick Diaz",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Mi-Moyens"
    },
    {
        id: 40,
        eventName: "UFC ON ABC 7 - SANDHAGEN VS. NURMAGOMEDOV",
        fighter1Name: "Joel Alvarez",
        fighter2Name: "Elves Brener",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Légers"
    },
    {
        id: 41,
        eventName: "UFC ON ABC 7 - SANDHAGEN VS. NURMAGOMEDOV",
        fighter1Name: "Michael Chiesa",
        fighter2Name: "Tony Ferguson",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Mi-Moyens"
    },
    {
        id: 42,
        eventName: "UFC ON ABC 7 - SANDHAGEN VS. NURMAGOMEDOV",
        fighter1Name: "Marlon Vera",
        fighter2Name: "Deiveson Figueiredo",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Coqs"
    },
    {
        id: 43,
        eventName: "UFC ON ABC 7 - SANDHAGEN VS. NURMAGOMEDOV",
        fighter1Name: "Chris Gutierrez",
        fighter2Name: "Javid Basharat",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Coqs"
    },
    {
        id: 44,
        eventName: "UFC ON ABC 7 - SANDHAGEN VS. NURMAGOMEDOV",
        fighter1Name: "Jai Herbert",
        fighter2Name: "Rolando Bedoya",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Légers"
    },
    {
        id: 45,
        eventName: "UFC ON ABC 7 - SANDHAGEN VS. NURMAGOMEDOV",
        fighter1Name: "Sedriques Dumas",
        fighter2Name: "Denis Tiuliulin",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Moyens"
    },
    {
        id: 46,
        eventName: "UFC ON ABC 7 - SANDHAGEN VS. NURMAGOMEDOV",
        fighter1Name: "Abdul-Kareem Al-Selwady",
        fighter2Name: "Guram Kutateladze",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Légers"
    },
    {
        id: 47,
        eventName: "UFC ON ABC 7 - SANDHAGEN VS. NURMAGOMEDOV",
        fighter1Name: "Mackenzie Dern",
        fighter2Name: "Lupita Godinez",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Pailles"
    },
    {
        id: 48,
        eventName: "UFC ON ABC 7 - SANDHAGEN VS. NURMAGOMEDOV",
        fighter1Name: "Alonzo Menifield",
        fighter2Name: "Azamat Murzakanov",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Mi-Lourds"
    },
    {
        id: 49,
        eventName: "UFC ON ABC 7 - SANDHAGEN VS. NURMAGOMEDOV",
        fighter1Name: "Victoria Dudakova",
        fighter2Name: "Sam Hughes",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Pailles"
    },
    {
        id: 50,
        eventName: "UFC ON ABC 7 - SANDHAGEN VS. NURMAGOMEDOV",
        fighter1Name: "Azat Maksum",
        fighter2Name: "C.J. Vergara",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Mouches"
    },
    {
        id: 51,
        eventName: "UFC ON ABC 7 - SANDHAGEN VS. NURMAGOMEDOV",
        fighter1Name: "Mohammad Yahya",
        fighter2Name: "Kaue Fernandes",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Légers"
    },
    {
        id: 52,
        eventName: "UFC ON ABC 7 - SANDHAGEN VS. NURMAGOMEDOV",
        fighter1Name: "Don'tale Mayes",
        fighter2Name: "Shamil Gaziev",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Lourds"
    },
    {
        id: 53,
        eventName: "UFC FIGHT NIGHT",
        fighter1Name: "Marcin Tybura",
        fighter2Name: "Serghei Spivac",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Lourds"
    },
    {
        id: 54,
        eventName: "UFC FIGHT NIGHT",
        fighter1Name: "Jarno Errens",
        fighter2Name: "Youssef Zalal",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Plumes"
    },
    {
        id: 55,
        eventName: "UFC FIGHT NIGHT",
        fighter1Name: "Karl Williams",
        fighter2Name: "Jhonata Diniz",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Lourds"
    },
    {
        id: 56,
        eventName: "UFC FIGHT NIGHT",
        fighter1Name: "Jonny Parsons",
        fighter2Name: "Yusaku Kinoshita",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Mi-Moyens"
    },
    {
        id: 57,
        eventName: "UFC FIGHT NIGHT",
        fighter1Name: "Stephanie Luciano",
        fighter2Name: "Talita Alencar",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Pailles"
    },
    {
        id: 58,
        eventName: "UFC FIGHT NIGHT",
        fighter1Name: "Allan Nascimento",
        fighter2Name: "Jafel Filho",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Mouches"
    },
    {
        id: 59,
        eventName: "UFC FIGHT NIGHT",
        fighter1Name: "Danny Barlow",
        fighter2Name: "Uros Medic",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Mi-Moyens"
    },
    {
        id: 60,
        eventName: "UFC FIGHT NIGHT",
        fighter1Name: "Yana Santos",
        fighter2Name: "Chelsea Chandler",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Coqs"
    },
    {
        id: 61,
        eventName: "UFC FIGHT NIGHT",
        fighter1Name: "Charalampos Grigoriou",
        fighter2Name: "Toshiomi Kazama",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Coqs"
    },
    {
        id: 62,
        eventName: "UFC 305 - DU PLESSIS VS. ADESANYA",
        fighter1Name: "Dricus Du Plessis",
        fighter2Name: "Israel Adesanya",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Moyens"
    },
    {
        id: 63,
        eventName: "UFC 305 - DU PLESSIS VS. ADESANYA",
        fighter1Name: "Tom Nolan",
        fighter2Name: "Alex Reyes",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Légers"
    },
    {
        id: 64,
        eventName: "UFC 305 - DU PLESSIS VS. ADESANYA",
        fighter1Name: "Jairzinho Rozenstruik",
        fighter2Name: "Tai Tuivasa",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Lourds"
    },
    {
        id: 65,
        eventName: "UFC 305 - DU PLESSIS VS. ADESANYA",
        fighter1Name: "Kai Kara-France",
        fighter2Name: "Steve Erceg",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Mouches"
    },
    {
        id: 66,
        eventName: "UFC 305 - DU PLESSIS VS. ADESANYA",
        fighter1Name: "Junior Tafa",
        fighter2Name: "Valter Walker",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Lourds"
    },
    {
        id: 67,
        eventName: "UFC 305 - DU PLESSIS VS. ADESANYA",
        fighter1Name: "Gavin Tucker",
        fighter2Name: "Jack Jenkins",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Plumes"
    },
    {
        id: 68,
        eventName: "UFC 305 - DU PLESSIS VS. ADESANYA",
        fighter1Name: "Josh Culibao",
        fighter2Name: "Ricardo Ramos",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Plumes"
    },
    {
        id: 69,
        eventName: "UFC 305 - DU PLESSIS VS. ADESANYA",
        fighter1Name: "Casey O'Neill",
        fighter2Name: "Tereza Bleda",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Mouches"
    },
    {
        id: 70,
        eventName: "UFC 305 - DU PLESSIS VS. ADESANYA",
        fighter1Name: "Jingliang Li",
        fighter2Name: "Carlos Prates",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Mi-Moyens"
    },
    {
        id: 71,
        eventName: "UFC FIGHT NIGHT",
        fighter1Name: "Zach Reese",
        fighter2Name: "Jose Medina",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Moyens"
    },
    {
        id: 72,
        eventName: "UFC FIGHT NIGHT",
        fighter1Name: "Dennis Buzukja",
        fighter2Name: "Danny Silva",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Plumes"
    },
    {
        id: 73,
        eventName: "UFC FIGHT NIGHT",
        fighter1Name: "Neil Magny",
        fighter2Name: "Michael Morales",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Mi-Moyens"
    },
    {
        id: 74,
        eventName: "UFC FIGHT NIGHT",
        fighter1Name: "Viacheslav Borshchev",
        fighter2Name: "James Llontop",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Légers"
    },
    {
        id: 75,
        eventName: "UFC FIGHT NIGHT",
        fighter1Name: "Roman Kopylov",
        fighter2Name: "Brunno Ferreira",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Moyens"
    },
    {
        id: 76,
        eventName: "UFC FIGHT NIGHT",
        fighter1Name: "Gerald Meerschaert",
        fighter2Name: "Edmen Shahbazyan",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Moyens"
    },
    {
        id: 77,
        eventName: "UFC FIGHT NIGHT",
        fighter1Name: "Josiane Nunes",
        fighter2Name: "Jacqueline Cavalcanti",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Coqs"
    },
    {
        id: 78,
        eventName: "UFC FIGHT NIGHT - BURNS VS. BRADY",
        fighter1Name: "Gilbert Burns",
        fighter2Name: "Sean Brady",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Mi-Moyens"
    },
    {
        id: 79,
        eventName: "UFC FIGHT NIGHT - BURNS VS. BRADY",
        fighter1Name: "Calvin Kattar",
        fighter2Name: "Kyle Nelson",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Plumes"
    },
    {
        id: 80,
        eventName: "UFC FIGHT NIGHT - BURNS VS. BRADY",
        fighter1Name: "Jessica Andrade",
        fighter2Name: "Natalia Silva",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Mouches"
    },
    {
        id: 81,
        eventName: "UFC FIGHT NIGHT - BURNS VS. BRADY",
        fighter1Name: "Andre Lima",
        fighter2Name: "Felipe dos Santos",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Mouches"
    },
    {
        id: 82,
        eventName: "UFC FIGHT NIGHT - BURNS VS. BRADY",
        fighter1Name: "Matt Schnell",
        fighter2Name: "Alessandro Costa",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Mouches"
    },
    {
        id: 83,
        eventName: "UFC 306",
        fighter1Name: "Sean O'Malley",
        fighter2Name: "Merab Dvalishvili",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Combat non confirme"
    },
    {
        id: 84,
        eventName: "UFC 306",
        fighter1Name: "Alexa Grasso",
        fighter2Name: "Valentina Shevchenko",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Combat non confirme"
    },
    {
        id: 85,
        eventName: "UFC 306",
        fighter1Name: "Irene Aldana",
        fighter2Name: "Norma Dumont",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Coqs"
    },
    {
        id: 86,
        eventName: "UFC 306",
        fighter1Name: "Michel Pereira",
        fighter2Name: "Anthony Hernandez",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Moyens"
    },
    {
        id: 87,
        eventName: "UFC 306",
        fighter1Name: "Yazmin Jauregui",
        fighter2Name: "Ketlen Souza",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Pailles"
    },
    {
        id: 88,
        eventName: "UFC 306",
        fighter1Name: "Edgar Chairez",
        fighter2Name: "Kevin Borjas",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Mouches"
    },
    {
        id: 89,
        eventName: "UFC PARIS 3",
        fighter1Name: "Benoit Saint-Denis",
        fighter2Name: "Renato Moicano",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Légers"
    },
    {
        id: 90,
        eventName: "UFC PARIS 3",
        fighter1Name: "Joanderson Brito",
        fighter2Name: "William Gomis",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Plumes"
    },
    {
        id: 91,
        eventName: "UFC 307",
        fighter1Name: "Raquel Pennington",
        fighter2Name: "Julianna Pena",
        fightFinished: false,
        method: "",
        time: "",
        weight_class: "Combat non confirme"
    }
];

module.exports = formattedFights;