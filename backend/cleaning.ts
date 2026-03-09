import fs from 'fs';
import path from 'path';

// Carica la lista di stringhe ammissibili dal JSON (modificabile dall'utente)
const ADMISSIBLE_SIGNS_PATH = path.join(__dirname, 'admissible_signs.json');
let admissibleSigns: string[] = [];
try {
  const fileContent = fs.readFileSync(ADMISSIBLE_SIGNS_PATH, 'utf-8');
  admissibleSigns = JSON.parse(fileContent);
} catch (error) {
  console.error("Errore nel caricamento di admissible_signs.json", error);
}

/**
 * Funzione che calcola la distanza di Levenshtein tra due stringhe
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // sostituzione
          Math.min(
            matrix[i][j - 1] + 1, // inserimento
            matrix[i - 1][j] + 1  // cancellazione
          )
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Rimuove il rumore di base e tenta di correggere pattern "leetspeak" comuni
 */
export function normalizeString(input: string): string {
  let cleaned = input.toUpperCase().trim();

  // Mappa leetspeak a caratteri standard
  const leetspeakMap: Record<string, string> = {
    '0': 'O',
    '1': 'I',
    '3': 'E',
    '4': 'A',
    '5': 'S'
  };

  // 1. Sostituzione dei caratteri alfanumerici confusi (Leetspeak)
  cleaned = cleaned.replace(/[01345]/g, (match) => {
    // Non sostituire i numeri se fanno parte di orari o limiti di velocità come "10" o "30" o "08:00"
    // Questo è un approccio semplificativo: per una robustezza totale, dovremmo assicurarci 
    // di non alterare cifre legittime. Facciamo replace solo su parole che sembrano testo.
    return leetspeakMap[match] || match;
  });

  // Tuttavia, siccome abbiamo orari (es. 08:00) e numeri (es. 30 KM/H, L4), 
  // la sostituzione cieca di sopra romperebbe i numeri.
  // Rifacciamo il normalize con una logica più selettiva:
  let words = input.toUpperCase().trim().split(/\s+/);
  
  words = words.map(word => {
    // Se la parola è chiaramente un numero, un orario o un limite (es "30", "08:00", "L4", "100M", "0-24") 
    // la lasciamo stare
    if (/^([0-9]+[A-Z]?|[0-9]+:[0-9]+|[0-9]+\-[0-9]+)$/.test(word)) {
      return word;
    }
    // Altrimenti sostituiamo leetspeak
    return word.replace(/[01345]/g, (match) => leetspeakMap[match] || match);
  });
  
  cleaned = words.join(" ");

  // 2. Rimuovere punti spuri e punteggiatura inutile (es: "V.A.R.C.O." -> "VARCO")
  cleaned = cleaned.replace(/\./g, "");

  // 3. Spazi eccessivi tra lettere singole (es "Z T L" -> "ZTL")
  // Trova sequenze di 2 o più lettere singole separate da spazio
  cleaned = cleaned.replace(/(?<=\b[A-Z]) (?=[A-Z]\b)/g, "");

  // 4. Rimozione spazi extra multipli
  cleaned = cleaned.replace(/\s{2,}/g, " ");

  return cleaned.trim();
}

/**
 * Confronta la stringa normalizzata con i segnali ammissibili
 * @returns La stringa ammissibile ottimale o null se nessuna è sufficientemente vicina
 */
export function findBestMatch(normalized: string, dataset: string[]): string | null {
  if (!dataset || dataset.length === 0) return normalized;

  let bestMatch = null;
  let minDistance = Infinity;

  // Cerchiamo il match esatto o parziale (substring) per gestire i testi troncati
  for (const validSign of dataset) {
    // Exact match
    if (validSign === normalized) return validSign;

    const distance = levenshteinDistance(normalized, validSign);
    
    // Calcoliamo una tolleranza basata sulla lunghezza della stringa (es. 30% di errori ammessi)
    const maxLength = Math.max(normalized.length, validSign.length);
    const maxAllowedDistance = Math.floor(maxLength * 0.35); // 35% tolleranza
    
    // Controllo extra: se il testo rilevato dal sensore è una sottostringa di un segno valido
    // (es. "ECCETTO FORNITORE 08-10" contro "ECCETTO FORNITORE DALLE 08:00 ALLE 10:00")
    if (distance < minDistance && distance <= maxAllowedDistance) {
      minDistance = distance;
      bestMatch = validSign;
    }
  }

  // Se non abbiamo trovato nulla entro la tolleranza, potremmo ritornare null 
  // o ritornare l'input normalizzato in attesa della fusione
  return bestMatch !== null ? bestMatch : normalized;
}

/**
 * Funzione principale esportata
 * Riceve in input il testo "sporco" dal sensore e lo pulisce/valida.
 * Se il sensore è offline (null), ritorna null.
 */
export function cleanText(input: string | null): string | null {
  if (input === null || input === undefined || input.trim() === "") {
    return null;
  }

  const normalized = normalizeString(input);
  const validated = findBestMatch(normalized, admissibleSigns);
  
  return validated;
}
