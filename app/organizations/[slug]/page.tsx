"use client"

export default function Page({ params }: { params: { slug: string } })  {

  return (
    <div>
      <h1>Événements de l'Organisation {params.slug}</h1>
      {/* Ici, vous chargerez et afficherez les événements de l'organisation spécifique */}
    </div>
  );
};