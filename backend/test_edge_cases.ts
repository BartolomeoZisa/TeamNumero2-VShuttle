import { processScenario, RawScenario } from './main';

console.log("=== VSHUTTLE EDGE CASES TEST ===\n");

const edgeCases: RawScenario[] = [
  {
    id_scenario: 901,
    orario_rilevamento: "03:30",
    giorno_settimana: "Domenica",
    sensori: {
      camera_frontale: { testo: "Z. T. L.  N 0 T T U R N 4  2 3 - 0 5", confidenza: 0.8 },
      camera_laterale: { testo: null, confidenza: null },
      V2I_receiver: { testo: null, confidenza: null }
    }
  },
  {
    id_scenario: 902,
    orario_rilevamento: "10:00",
    giorno_settimana: "Lunedì",
    sensori: {
      camera_frontale: { testo: "D1V1ET0 D1 4CC3550 3CC3TT0 B U S", confidenza: 0.65 },
      camera_laterale: { testo: "DIVIETO ACCESSO ECCETTO BUS", confidenza: 0.90 }, // La fusione prenderà questa per via della confidenza
      V2I_receiver: { testo: null, confidenza: null }
    }
  },
  {
    id_scenario: 903, // Edge case letale: Leetspeak assurdo ma con confidenza alta che la fusione prende
    orario_rilevamento: "09:30",
    giorno_settimana: "Venerdì",
    sensori: {
      camera_frontale: { testo: "M 3 R C 4 T 0  V3N3RD1 DALLE 0 6 ALLE 1 4", confidenza: 0.99 },
      camera_laterale: { testo: "MERCATO VENERDI 06-14", confidenza: 0.50 }, 
      V2I_receiver: { testo: null, confidenza: null }
    }
  },
  {
    id_scenario: 904, // Sensori completamente offline
    orario_rilevamento: "12:00",
    giorno_settimana: "Mercoledì",
    sensori: {
      camera_frontale: { testo: null, confidenza: null },
      camera_laterale: { testo: null, confidenza: null }, 
      V2I_receiver: { testo: null, confidenza: null }
    }
  },
  {
    id_scenario: 905, // Testo sporco che non matcha nulla ma contiene divieto, dovrebbe restituire STOP base
    orario_rilevamento: "15:00",
    giorno_settimana: "Martedì",
    sensori: {
      camera_frontale: { testo: "D I V I E T O JSDFB JSDF", confidenza: 0.88 },
      camera_laterale: { testo: null, confidenza: null }, 
      V2I_receiver: { testo: null, confidenza: null }
    }
  }
];

edgeCases.forEach(scenario => {
  console.log(`\n--- Esecuzione Scenario [${scenario.id_scenario}] ---`);
  console.log(`Orario: ${scenario.orario_rilevamento} | Giorno: ${scenario.giorno_settimana}`);
  const result = processScenario(scenario);
  console.log(`Testo Fuso Originale: "${result.raw_text}"`);
  console.log(`Testo Pulito:         "${result.cleaned_text}"`);
  console.log(`Risultato Parser:     [${result.action}] -> ${result.reason}`);
});

console.log("\n=== TEST EDGE CASES COMPLETATI ===");
