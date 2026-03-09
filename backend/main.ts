import fs from 'fs';
import path from 'path';
import { fuseSensors, ScenarioSensors } from './fusion';
import { cleanText } from './cleaning';
import { parseSignSemantic, ParseResult, ScenarioContext } from './parser';

const INPUT_JSON_PATH = path.join(__dirname, '..', 'VShuttle-input.json');

// Struttura fissa definita dal dataset JSON in input
export interface RawScenario {
  id_scenario: number;
  sensori: ScenarioSensors;
  orario_rilevamento: string;
  giorno_settimana: string;
}

export interface DashboardOutput extends ParseResult {
  id_scenario: number;
  raw_text: string | null;    // Il testo originale (vincente dalla fusione)
  cleaned_text: string | null; // Il testo pulito mostrato alla Dashboard
}

/**
 * Legge e fa il parsing del JSON di Input
 */
export function loadScenarios(): RawScenario[] {
  try {
    const rawData = fs.readFileSync(INPUT_JSON_PATH, 'utf-8');
    return JSON.parse(rawData);
  } catch (error) {
    console.error("Errore fatale: Impossibile leggere VShuttle-input.json", error);
    return [];
  }
}

/**
 * Pipeline architetturale completa per un singolo scenario:
 * 1) Fusione: Risolve il rumore multi-sensore
 * 2) Pulizia: Normalizza OCR e stringhe "sporche" ed esgue fallback semantico (Levenshtein)
 * 3) Parsing: Determina l'azione in base all'orario e alle eccezioni della navetta
 */
export function processScenario(scenario: RawScenario): DashboardOutput {
  // 1. FUSIONE
  const fusionResult = fuseSensors(scenario.sensori);
  
  // 2. OCR NORMALIZER / DATACLEANING
  const cleanResult = cleanText(fusionResult.testo_fuso);
  
  // 3. PARSER SEMANTICO & TEMPORALE
  const context: ScenarioContext = {
    currentTime: scenario.orario_rilevamento,
    currentDay: scenario.giorno_settimana
  };
  
  // Usiamo il testo pulito per il parsing, ignoriamo il raw (la pulizia l'ha normalizzato per noi)
  // Nota bene: Se cleanResult è null significa che la stringa era vuota (sensori offline). Il parser l'ha gestito per restituire GO
  const finalAction = parseSignSemantic(
    cleanResult || "", 
    context, 
    fusionResult.confidenza_finale
  );

  return {
    id_scenario: scenario.id_scenario,
    raw_text: fusionResult.testo_fuso,
    cleaned_text: cleanResult,
    action: finalAction.action,
    reason: finalAction.reason,
    confidence: finalAction.confidence
  };
}

/**
 * Un Generatore TS (*). 
 * Quando chiamato itererà sugli array json restituendo LA VALUTAZIONE PRONTA
 * UNO ALLA VOLTA senza esporre logica a memoria superflua o gergo tecnico al frontend.
 * Questo permette alla Dashboard "Live" di consumarlo come uno Stream.
 */
export function* createScenarioGenerator(scenarios: RawScenario[]): Generator<DashboardOutput, void, unknown> {
  for (const scenario of scenarios) {
     yield processScenario(scenario);
  }
}

// ============== ESECUZIONE DI DEBUG / TEST MANUALE =================

if (require.main === module) {
  console.log("=== VSHUTTLE: Avvio Simulazione Pipeline (Modalita' CLI) ===\n");
  
  const allScenarios = loadScenarios();
  console.log(`Caricati ${allScenarios.length} scenari... \n`);

  const simEngine = createScenarioGenerator(allScenarios);

  // Generate the output for the dashboard
  const outPath = path.resolve('./../dashboard/public/backend_output.json');
  const results: DashboardOutput[] = [];
  for (const scenario of allScenarios) {
      results.push(processScenario(scenario));
  }
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`Output scritto con successo in: ${outPath}\n`);

  // Simuliamo di srotolare i primi 3 per testare il generatore in CLI
  for (let i = 0; i < 74; i++) {
    const nextItem = simEngine.next();
    if (!nextItem.done) {
      console.log(`[Scenario ID: ${nextItem.value.id_scenario}] --> Action: ${nextItem.value.action}`);
      console.log(`  Data Pulita : "${nextItem.value.cleaned_text}" (Confidenza: ${nextItem.value.confidence})`);
      console.log(`  Reason      : ${nextItem.value.reason}`);
      console.log("-----------------------------------------------------------------");
    }
  }
  
  console.log("\nSimulazione di prova generatore eseguita con successo.");
}
