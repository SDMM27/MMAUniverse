import axios from "axios";
import cheerio from "cheerio";
import fs from "fs";
import path from "path";

const baseURL = "https://pflmma.com/regular-season/2024";

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

// Fonction pour récupérer les détails d'un événement spécifique
async function fetchEventDetails(eventUrl, eventTitle) {
  const $ = await fetchPage(eventUrl);
  const eventDetails = {
    eventTitle:
      eventTitle || $("h1.event-title").text().trim() || $("h1").text().trim(),
    eventDate: $(".font-oswald.font-weight-bold.m-0").first().text().trim(),
    eventLocation: $(".m-0.letter-spacing").text().trim(),
    eventPoster: $(".event-thumbnail").attr("src") || "",
    fights: []
  };

  $(".matchupRow").each((i, elem) => {
    const fighter1 = {
      name: $(elem)
        .find(".col-md-12.col-5.text-center")
        .first()
        .find(".fighterName")
        .text()
        .trim(),
      record:
        $(elem).find(".modal_button_open").attr("data-fighter1-record") || "", // Extraction des données d'attribut
      ranking: "", // Champs vide
      image: $(elem).find(".fighterLeftImg").attr("src"),
      status: $(elem)
        .find(".fighter-left .fight_status_text_562")
        .text()
        .trim(),
      winBy: $(elem).find(".fighter-left .winBy").text().trim()
    };
    const fighter2 = {
      name: $(elem)
        .find(".col-md-12.col-5.text-center")
        .last()
        .find(".fighterName")
        .text()
        .trim(),
      record:
        $(elem).find(".modal_button_open").attr("data-fighter2-record") || "", // Extraction des données d'attribut
      ranking: "", // Champs vide
      image: $(elem).find(".fighterRightImg").attr("src"),
      status: $(elem)
        .find(".fighter-right .fight_status_text_633")
        .text()
        .trim(),
      winBy: $(elem).find(".fighter-right .winBy").text().trim()
    };
    const weightClass = $(elem).find(".fightWeight").text().trim();
    const fightLink = ""; // Champs vide
    const details = `Combat Categorie - ${weightClass}`; // Remplacement de weightClass par details

    // Extraire les détails de la modal
    const modal = $(`#fightCardModal${i + 1}`);
    const careerRecord1 = modal
      .find(".topStats .col-4.text-right.no-padding p:nth-child(2)")
      .first()
      .text()
      .trim();
    const careerRecord2 = modal
      .find(".topStats .col-4.text-left.no-padding p:nth-child(2)")
      .first()
      .text()
      .trim();

    fighter1.record = careerRecord1;
    fighter2.record = careerRecord2;

    eventDetails.fights.push({
      fighter1,
      fighter2,
      details,
      fightLink
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
    console.log(eventsDetails);

    const filePath = path.resolve("pflEventsDetails.json");
    console.log(`Writing to file: ${filePath}`);

    fs.writeFile(filePath, JSON.stringify(eventsDetails, null, 2), (err) => {
      if (err) {
        console.error("Error writing file:", err);
      } else {
        console.log("Successfully written to pflEventsDetails.json");
      }
    });
  } catch (error) {
    console.error("Error fetching event details", error.message);
  }
}

fetchEvents();
