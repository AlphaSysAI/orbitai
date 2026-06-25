// Copyright © 2026 OrbitSys. Tous droits réservés.

import { NextResponse } from 'next/server';

// Import dynamique des parsers selon le format
const pdf = require('pdf-parse-fork');

// Fonction pour extraire le texte d'un fichier Word (.docx)
async function extractFromDocx(buffer: Buffer): Promise<string> {
  try {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    throw new Error(`Erreur lecture Word: ${error}`);
  }
}

// Fonction pour extraire le texte d'un fichier Excel (.xlsx, .xls)
async function extractFromExcel(buffer: Buffer): Promise<string> {
  try {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    
    let text = '';
    workbook.SheetNames.forEach((sheetName, index) => {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) return;
      if (index > 0) text += '\n\n---\n\n';
      text += `[Feuille: ${sheetName}]\n\n`;

      // Convertir la feuille en texte formaté
      const sheetText = XLSX.utils.sheet_to_txt(sheet);
      text += sheetText;
    });
    
    return text;
  } catch (error) {
    throw new Error(`Erreur lecture Excel: ${error}`);
  }
}

// Fonction pour extraire le texte d'un fichier PowerPoint (.pptx)
// Note: L'extraction PowerPoint nécessite une bibliothèque spécialisée
// Pour l'instant, on guide l'utilisateur à convertir en PDF
async function extractFromPowerPoint(buffer: Buffer): Promise<string> {
  // PowerPoint nécessite une bibliothèque dédiée (ex: unzipper + XML parsing)
  // Pour simplifier, on recommande la conversion en PDF
  throw new Error('PowerPoint (.pptx) : veuillez exporter en PDF ou convertir en texte. L\'extraction directe sera disponible prochainement.');
}

// Fonction pour extraire le texte d'un fichier texte brut
function extractFromText(buffer: Buffer, mimeType: string): string {
  // Déterminer l'encodage selon le MIME type
  const encoding = mimeType.includes('utf') ? 'utf-8' : 'latin1';
  try {
    return buffer.toString(encoding);
  } catch (error) {
    return buffer.toString('utf-8'); // Fallback UTF-8
  }
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: "Fichier non trouvé" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileName = file.name.toLowerCase();
    const mimeType = file.type.toLowerCase();
    
    let extractedText = '';
    let pages = 1;

    // Déterminer le type de fichier et extraire le texte
    try {
      // PDF
      if (fileName.endsWith('.pdf') || mimeType === 'application/pdf') {
        const data = await pdf(buffer);
        extractedText = data.text.replace(/\n+/g, '\n').trim();
        pages = data.numpages || 1;
      }
      // Word (.docx)
      else if (fileName.endsWith('.docx') || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        extractedText = await extractFromDocx(buffer);
      }
      // Word ancien format (.doc) - nécessiterait une autre bibliothèque
      else if (fileName.endsWith('.doc') || mimeType === 'application/msword') {
        return NextResponse.json({ 
          error: "Format .doc (Word ancien format) non supporté. Veuillez convertir en .docx ou PDF." 
        }, { status: 400 });
      }
      // Excel (.xlsx, .xls)
      else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || 
               mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
               mimeType === 'application/vnd.ms-excel') {
        extractedText = await extractFromExcel(buffer);
      }
      // PowerPoint (.pptx)
      else if (fileName.endsWith('.pptx') || 
               mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
        // Pour l'instant, PowerPoint n'est pas complètement supporté
        return NextResponse.json({ 
          error: "Format PowerPoint (.pptx) sera bientôt supporté. Pour l'instant, veuillez convertir en PDF ou texte." 
        }, { status: 400 });
        // extractedText = await extractFromPowerPoint(buffer);
      }
      // Fichiers texte (.txt, .md, .csv, etc.)
      else if (fileName.endsWith('.txt') || fileName.endsWith('.md') || fileName.endsWith('.csv') ||
               mimeType.startsWith('text/')) {
        extractedText = extractFromText(buffer, mimeType);
      }
      // Format non supporté
      else {
        // Vérifier si c'est une image
        if (mimeType.startsWith('image/')) {
          return NextResponse.json({ 
            error: "Les images ne sont pas supportées. Veuillez uploader des documents texte (PDF, Word, Excel, etc.)" 
          }, { status: 400 });
        }
        
        return NextResponse.json({ 
          error: `Format de fichier non supporté: ${fileName}. Formats acceptés: PDF, Word (.docx), Excel (.xlsx, .xls), texte (.txt, .md, .csv)` 
        }, { status: 400 });
      }

      // Nettoyer le texte extrait
      extractedText = extractedText.replace(/\n+/g, '\n').trim();

      if (!extractedText || extractedText.length === 0) {
        return NextResponse.json({ 
          error: "Aucun texte trouvé dans le document. Le fichier est peut-être vide ou corrompu." 
        }, { status: 400 });
      }

      return NextResponse.json({ 
        text: extractedText,
        pages: pages,
        format: fileName.split('.').pop()?.toUpperCase() || 'UNKNOWN'
      });
    } catch (extractionError: any) {
      console.error("Erreur extraction texte:", extractionError);
      return NextResponse.json({ 
        error: `Erreur lors de l'extraction: ${extractionError.message || 'Erreur inconnue'}` 
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error("Erreur serveur extraction:", error);
    return NextResponse.json({ 
      error: error.message || "Erreur lors du traitement du fichier" 
    }, { status: 500 });
  }
}