const fs = require("fs");
const path = require("path");

async function extractFighters() {
  // Chemin vers le fichier JSON
  const filePath = path.join(__dirname, "detailedEventsWithFights.json");
  const jsonData = JSON.parse(fs.readFileSync(filePath, "utf8"));

  // Extraire et transformer les données des combattants
  const fighters = [];
  jsonData.forEach((event) => {
    event.fights.forEach((fight) => {
      ["fighter1", "fighter2"].forEach((key) => {
        const fighter = fight[key];
        if (!fighters.some((f) => f.name === fighter.name)) {
          fighters.push({
            id: fighters.length + 1, // Simuler un ID séquentiel
            name: fighter.name,
            imageUrl: fighter.image,
            weightClass: "", // Laisser vide comme demandé
            organization_id: 1, // Utiliser une valeur par défaut pour l'organisation
            record: fighter.record,
            ranking: parseInt(fighter.ranking.replace("#", "")) || null // Transformer en nombre, `null` si non disponible
          });
        }
      });
    });
  });

  // Transformer en format d'objet JavaScript pour l'affichage sans guillemets
  const outputContent = fighters
    .map(
      (fighter) =>
        `{\n  id: ${fighter.id},\n  name: "${fighter.name}",\n  imageUrl: "${
          fighter.imageUrl
        }",\n  weightClass: "${fighter.weightClass}",\n  organization_id: ${
          fighter.organization_id
        },\n  record: "${fighter.record}",\n  ranking: ${
          fighter.ranking || "null"
        }\n},\n`
    )
    .join("");

  // Écrire les combattants transformés dans un fichier
  const outputFile = path.join(__dirname, "fightersOutput.js");
  fs.writeFileSync(outputFile, outputContent, "utf8");

  console.log(`Fighters data has been written to ${outputFile}`);
}

// Exécuter la fonction
extractFighters();
