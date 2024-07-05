require("dotenv").config();
const fs = require("fs");

const inputFilename = "detailedEventsWithFights.json";

fs.readFile(inputFilename, "utf8", async (err, data) => {
  if (err) {
    console.error(`Erreur lors de la lecture du fichier : ${err}`);
    return;
  }

  const events = JSON.parse(data);
  const fights = [];
  let fightId = 1;

  for (const event of events) {
    const eventTitle = event.eventTitle;

    for (const fight of event.fights) {
      const weightClass = fight.details
        .split(" - ")
        .pop()
        .replace("Poids ", "");

      fights.push({
        id: fightId,
        eventName: eventTitle,
        fighter1Name: fight.fighter1.name,
        fighter2Name: fight.fighter2.name,
        fightFinished: false,
        method: "",
        time: "",
        weight_class: weightClass
      });
      fightId++;
    }
  }

  const outputFilename = "formatted_fights.js";
  const fileContent = `const formattedFights = ${JSON.stringify(
    fights,
    null,
    4
  ).replace(/"([^"]+)":/g, "$1:")};\n\nmodule.exports = formattedFights;`;

  fs.writeFile(outputFilename, fileContent, (err) => {
    if (err) {
      console.error(`Erreur lors de l'écriture du fichier : ${err}`);
      return;
    }
    console.log(
      `Les données des combats ont été sauvegardées dans ${outputFilename}.`
    );
  });
});
