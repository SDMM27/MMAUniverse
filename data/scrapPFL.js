import axios from "axios";
import cheerio from "cheerio";
import fs from "fs";
import path from "path";

const baseURL = "https://pflmma.com/regular-season/2024";
const organizationId = 3; // ID de l'organisation fixé à 3

// Fonction pour récupérer et charger une page
async function fetchPage(url) {
  try {
    const response = await axios.get(url);
    return cheerio.load(response.data);
  } catch (error) {
    console.error(`Error fetching page: ${url}`, error.message);
    throw error;
  }
}

let eventIdCounter = 1;
let fightIdCounter = 1;
const fighters = new Map();

// Fonction pour récupérer les détails d'un événement spécifique
async function fetchEventDetails(eventUrl, eventTitle) {
  const $ = await fetchPage(eventUrl);
  const eventDetails = {
    id: eventIdCounter++,
    name:
      eventTitle || $("h1.event-title").text().trim() || $("h1").text().trim(),
    date: $(".font-oswald.font-weight-bold.m-0").first().text().trim(),
    event_location: $(".m-0.letter-spacing").text().trim(),
    event_poster: $(".event-thumbnail").attr("src") || "",
    organization_id: organizationId,
    fights: []
  };

  $(".matchupRow").each((i, elem) => {
    const fighter1Name = $(elem)
      .find(".col-md-12.col-5.text-center")
      .first()
      .find(".fighterName")
      .text()
      .trim();
    const fighter2Name = $(elem)
      .find(".col-md-12.col-5.text-center")
      .last()
      .find(".fighterName")
      .text()
      .trim();

    let fighter1 = fighters.get(fighter1Name);
    if (!fighter1) {
      fighter1 = {
        id: fighter1Name,
        name: fighter1Name,
        image_url: $(elem).find(".fighterLeftImg").attr("src"),
        weight_class: $(elem).find(".fightWeight").text().trim(),
        organization_id: organizationId,
        record:
          $(elem).find(".modal_button_open").attr("data-fighter1-record") || "",
        ranking: 0 // Champ vide
      };
      fighters.set(fighter1Name, fighter1);
    }

    let fighter2 = fighters.get(fighter2Name);
    if (!fighter2) {
      fighter2 = {
        id: fighter2Name,
        name: fighter2Name,
        image_url: $(elem).find(".fighterRightImg").attr("src"),
        weight_class: $(elem).find(".fightWeight").text().trim(),
        organization_id: organizationId,
        record:
          $(elem).find(".modal_button_open").attr("data-fighter2-record") || "",
        ranking: 0 // Champ vide
      };
      fighters.set(fighter2Name, fighter2);
    }

    const weightClass = $(elem).find(".fightWeight").text().trim();
    const details = `Combat Categorie - ${weightClass}`;
    const fightLink = ""; // Champ vide

    eventDetails.fights.push({
      id: fightIdCounter++,
      event_name: eventDetails.name,
      fighter1_id: fighter1.name,
      fighter2_id: fighter2.name,
      fight_finished: false,
      winner_id: null,
      method: "",
      round: 0,
      time: "",
      weight_class: weightClass
    });
  });

  return eventDetails;
}

// Fonction principale pour orchestrer la récupération des événements
async function fetchEvents() {
  const $ = await fetchPage(baseURL);
  if (!$) return;

  const events = [];

  $(".event-buttons a.btn-secondary").each((i, elem) => {
    const eventUrl = $(elem).attr("href");
    const eventTitle = $(elem)
      .closest(".row")
      .find(".font-oswald.font-weight-bold.m-0")
      .first()
      .text()
      .trim();
    if (eventUrl) {
      events.push(fetchEventDetails(eventUrl, eventTitle));
    }
  });

  try {
    const eventsDetails = await Promise.all(events);

    const eventsData = eventsDetails.map((event) => ({
      id: event.id,
      name: event.name,
      date: event.date,
      event_location: event.event_location,
      event_poster: event.event_poster,
      organization_id: organizationId
    }));

    const fightsData = eventsDetails.flatMap((event) => event.fights);

    const fightersData = Array.from(fighters.values()).map((fighter) => ({
      id: fighter.id,
      name: fighter.name,
      image_url: fighter.image_url,
      weight_class: fighter.weight_class,
      organization_id: organizationId,
      record: fighter.record,
      ranking: fighter.ranking
    }));

    const filePathEvents = path.resolve("pflEventsDetails.js");
    const filePathFights = path.resolve("pflFightsDetails.js");
    const filePathFighters = path.resolve("pflFightersDetails.js");

    const writeDataToFile = (filePath, data) => {
      const fileContent = `const data = ${JSON.stringify(data, null, 2).replace(
        /"([^"]+)":/g,
        "$1:"
      )};\n\nmodule.exports = data;`;
      fs.writeFile(filePath, fileContent, (err) => {
        if (err) {
          console.error(`Error writing file ${filePath}:`, err);
        } else {
          console.log(`Successfully written to ${filePath}`);
        }
      });
    };

    writeDataToFile(filePathEvents, eventsData);
    writeDataToFile(filePathFights, fightsData);
    writeDataToFile(filePathFighters, fightersData);
  } catch (error) {
    console.error("Error fetching event details", error.message);
  }
}

fetchEvents();
