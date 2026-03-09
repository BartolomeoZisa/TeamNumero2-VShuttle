/**
 * PRIMA PARTE: Valutazione divieti. Mappatura da stringa ad "AZIONE"
 * SECONDA PARTE: Valutazione di data e ora (Regex-driven e order-agnostic)
 */

export type ActionType = 'STOP' | 'GO' | 'INTERVENT';

export interface ParseResult {
  action: ActionType;
  reason: string;
  confidence?: number;
}

export interface ScenarioContext {
  currentTime: string; // Es. "09:25"
  currentDay: string;  // Es. "Venerdì"
}

// Map per normalizzare i giorni nei check
const daysMap: Record<string, number> = {
  'LUNEDI': 1, 'MARTEDI': 2, 'MERCOLEDI': 3, 'GIOVEDI': 4, 
  'VENERDI': 5, 'SABATO': 6, 'DOMENICA': 7
};

/**
 * Normalizza il testo rimuovendo accenti per i check
 */
function stripAccents(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
}

/**
 * Converte un orario in stringa ("HH:mm" o "HH") in minuti da mezzanotte 
 * per facili confronti matematici.
 */
function timeToMinutes(timeStr: string): number {
  const parts = timeStr.split(/[:\.]/);
  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parts.length > 1 ? parseInt(parts[1], 10) : 0;
  return hours * 60 + minutes;
}

/**
 * Estrae un intervallo di orari dalla stringa, ignorando in che punto della stringa si trovi.
 * @returns [minutiInizio, minutiFine] o null se non trovato
 */
function extractTimeRange(text: string): [number, number] | null {
  // Regex per matchare "08:00 - 20:00", "08-20", "23:00-05:00", "dalle 20", "0-24"
  // Considera varianti con e senza spazi e 1 o 2 cifre
  
  // 1. Caso 0-24
  if (/\b0-24\b/.test(text)) return [0, 1440];

  // 2. Pattern "HH:mm - HH:mm" o "HH - HH"
  const rangeRegex = /\b(\d{1,2}(?::\d{2})?)\s*-\s*(\d{1,2}(?::\d{2})?)\b/;
  const rangeMatch = text.match(rangeRegex);
  if (rangeMatch) {
    return [timeToMinutes(rangeMatch[1]), timeToMinutes(rangeMatch[2])];
  }

  // 3. Pattern "DALLE X ALLE Y" o "DALLE HH:mm"
  const dalleAlleRegex = /DALLE\s+(\d{1,2}(?::\d{2})?)(?:\s+ALLE\s+(\d{1,2}(?::\d{2})?))?/;
  const dalleMatch = text.match(dalleAlleRegex);
  if (dalleMatch) {
    const start = timeToMinutes(dalleMatch[1]);
    const end = dalleMatch[2] ? timeToMinutes(dalleMatch[2]) : 1440; // Se c'è solo DALLE x, assumi fino a mezzanotte
    return [start, end];
  }

  return null;
}

/**
 * Estrae una logica di giorni dalla stringa, order-agnostic.
 * @returns array di giorni validi (1=Lun, 7=Dom) o null se valevole sempre
 */
function extractDays(text: string): number[] | null {
  const days: number[] = [];

  // Match "DAL X AL Y"
  const rangeRegex = /(LUNEDI|MARTEDI|MERCOLEDI|GIOVEDI|VENERDI|SABATO|DOMENICA)\s*(?:AL|A|-)\s*(LUNEDI|MARTEDI|MERCOLEDI|GIOVEDI|VENERDI|SABATO|DOMENICA)/;
  const rangeMatch = text.match(rangeRegex);
  if (rangeMatch) {
    const start = daysMap[rangeMatch[1]];
    const end = daysMap[rangeMatch[2]];
    if (start && end) {
       for (let d = start; d <= end; d++) days.push(d);
       return days;
    }
  }

  // Match singoli giorni espilciti
  Object.keys(daysMap).forEach(d => {
    if (new RegExp(`\\b${d}\\b`).test(text)) {
      if (!days.includes(daysMap[d])) days.push(daysMap[d]);
    }
  });

  // Festivi = Domenica = 7
  if (/\bFESTIVI\b/.test(text)) {
    if (!days.includes(7)) days.push(7);
  }

  return days.length > 0 ? days : null;
}

/**
 * Valuta se l'orario e giorno attuali collidono con quelli del cartello
 * Ritorna TRUE se la regola del cartello è CORRENTEMENTE ATTIVA, FALSE altrimenti.
 */
function isRuleActiveNow(text: string, context: ScenarioContext): boolean {
  const timeRange = extractTimeRange(text);
  const applicableDays = extractDays(text);
  
  const currentMinutes = timeToMinutes(context.currentTime);
  const currentDayNum = daysMap[stripAccents(context.currentDay)] || 0;

  let dayActive = true;
  if (applicableDays) {
    dayActive = applicableDays.includes(currentDayNum);
  }

  let timeActive = true;
  if (timeRange) {
    const [start, end] = timeRange;
    if (start <= end) {
      // Normale (es 08:00 - 20:00)
      timeActive = currentMinutes >= start && currentMinutes <= end;
    } else {
      // Scavallo mezzanotte (es 20:00 - 06:00)
      timeActive = currentMinutes >= start || currentMinutes <= end;
    }
  }

  // Se nel cartello dice "NON ATTIVO" "INATTIVO" es ZTL VARCO NON ATTIVO
  if (/\b(NON\s+ATTIVO|INATTIVO)\b/.test(text)) {
      return false;
  }

  return dayActive && timeActive;
}

/**
 * Logica Principale del Parser. Data la stringa validata da `cleaning`,
 * la analizza nel contesto spazio-temporale estraendo un ActionType e la causale.
 */
export function parseSignSemantic(
  signText: string, 
  context: ScenarioContext, 
  confidenceFromFusion: number = 1.0
): ParseResult {
  
  if (!signText || signText === "NULL" || signText === "") {
    return { action: 'GO', reason: 'Nessun cartello o sensori offline', confidence: 1.0 };
  }

  const normalizedText = stripAccents(signText.toUpperCase());
  
  // FASE 1: VALUTAZIONE BASE E ECCEZIONI NAVETTA (L4 = BUS = AUTORIZZATO = ELETTRICO)
  
  // Eccezioni Palesi (Navetta è autorizzata a passare). 
  // Usa regex order-agnostic per matchare "eccetto" e la categoria della navetta.
  const eccezioniNavettaRegex = /ECCETTO\s+.*(NAVETT|BUS|ELETTRIC|AUTORIZZAT|SOCCORSO)/;
  // Certe volte dice solo "OK ELETTRICI" o "OK BUS" 
  const permessiNavettaRegex = /(OK|CONSENTITO|AUTORIZZATI|ECCETTO).*(NAVETT|BUS|ELETTRIC|AUTORIZZAT|SOCCORSO)/;
  // Certe volte dice "TRANSITO L4 OK"
  const l4OkRegex = /(L4).*(OK|CONSENTITO)/;

  const hasExceptionForUs = eccezioniNavettaRegex.test(normalizedText) 
                         || permessiNavettaRegex.test(normalizedText)
                         || l4OkRegex.test(normalizedText);

  // Variabile per definire la reazione se non ci fosse il calcolo dell'orario
  let baseAction: ActionType = 'GO';
  let baseReason = '';

  // Determina l'azione in base al cartello PURO
  if (/\b(ZTL|DIVIETO|SENSO VIETATO|STRADA CHIUSA)\b/.test(normalizedText)) {
    if (hasExceptionForUs) {
      baseAction = 'GO';
      baseReason = `Consentito per la navetta L4: ${signText}`;
    } else {
      baseAction = 'STOP';
      baseReason = `Vietato: ${signText}`;
    }
  } 
  else if (/\b(ATTENZIONE|LAVORI|DOSSO|PEDONI|ROTATORIA|RALLENTARE|DISSESTATA)\b/.test(normalizedText)) {
    // Sono cartelli di attenzione, impongono prudenza ma non fermata obbligatoria
    baseAction = 'INTERVENT';
    baseReason = `Moderare la velocità, ${signText}`;
  }
  else if (/\b(PARCHEGGIO|STAZIONE|CENTRO STORICO|AREA PEDONALE)\b/.test(normalizedText)) {
    // Attenzione blanda o info
    baseAction = 'INTERVENT';
    baseReason = `Avviso: ${signText}`;
  }
  else {
    baseAction = 'GO';
    baseReason = `Percorso consentito: ${signText}`;
  }

  // FASE 2: VALUTAZIONE TEMPORALE E GIORNALIERA (REGEX DRIVEN)
  // Eseguiamo il check solo se il cartello base voleva fermarci o c'è un dubbio 
  // (perché se il divieto non è attivo, possiamo passare).  
  const ruleActive = isRuleActiveNow(normalizedText, context);

  let finalAction = baseAction;
  let finalReason = baseReason;

  if (baseAction === 'STOP' && !ruleActive) {
    // Era un divieto ma non è attivo a quest'ora/giorno!
    finalAction = 'GO';
    finalReason = `Il segnale '${signText}' non è attualmente attivo (${context.currentDay} ${context.currentTime})`;
  } else if (!ruleActive && baseAction === 'GO' && /\bZTL\b/.test(normalizedText) && hasExceptionForUs) {
      // Era un divieto, navetta esentata, ma il divieto era pure inattivo (ragione piú elegante)
      finalReason = `Segnale inattivo (e comunque navetta autorizzata): ${signText}`;
  }

  return {
    action: finalAction,
    reason: finalReason,
    confidence: confidenceFromFusion
  };
}