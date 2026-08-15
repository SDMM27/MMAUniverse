// pages/api/events/[slug].js

import { sql } from "@/data/lib/db";

export default async function handler(req, res) {
  const { slug } = req.query; // Extraction du slug de la requête

  try {
    // Utilisation hypothétique de la fonction pour récupérer les événements
    // Assurez-vous que cette fonction est correctement implémentée dans vos dépendances
    const data =
      await sql`SELECT * FROM events WHERE organization_id = ${slug}`;

    // Assurez-vous que la requête retourne des données valides
    if (data.rowCount > 0) {
      res.status(200).json(data.rows);
    } else {
      res
        .status(404)
        .json({ message: "No events found for this organization." });
    }
  } catch (error) {
    console.error("Database Error:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch events", error: error.message });
  }
}
