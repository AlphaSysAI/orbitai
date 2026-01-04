import { NextResponse } from 'next/server';
const pdf = require('pdf-parse-fork');

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: "Fichier non trouvé" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // pdf-parse-fork est synchrone/simple et ne demande pas de worker
    const data = await pdf(buffer);

    // On nettoie le texte pour enlever les retours à la ligne excessifs
    const cleanText = data.text.replace(/\n+/g, '\n').trim();

    return NextResponse.json({ 
      text: cleanText,
      pages: data.numpages 
    });

  } catch (error: any) {
    console.error("Erreur serveur extraction:", error);
    return NextResponse.json({ error: "Échec lecture PDF" }, { status: 500 });
  }
}