//Logica di Fusione: Implementazione di un algoritmo di fusione sensori che tiene conto dell'affidabilità variabile delle 3 fonti (non è una semplice media).
//Gestione Sensori Offline: Il sistema non va in errore se il V2I_receiver o un altro sensore restituisce valori null.

import { cleanText } from "./cleaning";

// ==========================================
// 1. DEFINIZIONE DEI TIPI
// ==========================================


/**
 * Funzione principale per la fusione dei dati sensoriali.
 * Gestisce automaticamente i sensori offline (valori null).
 */
function fuseSensorsData(scenarios: Scenario[]): FusionResult[] {
  return scenarios.map(scenario => {
    let maxWeightedScore = -1;
    let bestText: string | null = null;
    let bestSource: string | null = null;

    let sensoriOnline = 0;
    // Inizializzato a 1 per il calcolo della probabilità di fallimento congiunto
    let probFallimentoCongiunto = 1; 

    const sensorKeys: SensorName[] = ['camera_frontale', 'camera_laterale', 'V2I_receiver'];

    // Analizza ogni sensore
    for (const key of sensorKeys) {
      const sensor = scenario.sensori[key];

      // GESTIONE SENSORI OFFLINE: Se il sensore ha dati validi, procediamo. Altrimenti viene ignorato.
      if (sensor.testo !== null && sensor.confidenza !== null) {
        sensoriOnline++;

        // 1. Calcolo Probabilità Congiunta
        // Se la camera A è sicura al 90% (sbaglia il 10%) e la B è sicura all'80% (sbaglia il 20%),
        // la probabilità che sbaglino ENTRAMBE è 10% * 20% = 2%. Quindi la confidenza fusa è 98%.
        probFallimentoCongiunto *= (1 - sensor.confidenza);

        // 2. Selezione del Testo Migliore tramite Weighted Score
        // Moltiplichiamo la confidenza per l'affidabilità hardware per capire a chi "credere" per il testo
        const weightedScore = sensor.confidenza * SENSOR_WEIGHTS[key];
        
        if (weightedScore > maxWeightedScore) {
          maxWeightedScore = weightedScore;
          bestText = cleanText(sensor.testo);
          bestSource = key;
        }
      }
    }

    // Se tutti i sensori sono offline o non hanno rilevato nulla (Es. Scenario 105)
    if (sensoriOnline === 0) {
      return {
        id_scenario: scenario.id_scenario,
        testo_definitivo: null,
        confidenza_fusa: 0,
        sensori_online: 0,
        sorgente_testo: null
      };
    }

    // Calcolo finale della confidenza fusa (arrotondato a 4 decimali per leggibilità)
    const confidenzaFusa = Number((1 - probFallimentoCongiunto).toFixed(4));

    return {
      id_scenario: scenario.id_scenario,
      testo_definitivo: bestText,
      confidenza_fusa: confidenzaFusa,
      sensori_online: sensoriOnline,
      sorgente_testo: bestSource
    };
  });
}
