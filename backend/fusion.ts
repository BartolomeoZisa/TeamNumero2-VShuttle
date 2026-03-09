// Logica temporanea di fusione in attesa dell'implementazione completa.
// Dato che i sensori restituiscono confidenze diverse, prendiamo il testo
// del sensore con confidenza maggiore. Non crasherà se qualche sensore è null.

export interface SensorData {
  testo: string | null;
  confidenza: number | null;
}

export interface ScenarioSensors {
  camera_frontale: SensorData;
  camera_laterale: SensorData;
  V2I_receiver: SensorData;
}

export interface FusionResult {
  testo_fuso: string | null;
  confidenza_finale: number;
}

export function fuseSensors(sensori: ScenarioSensors): FusionResult {
  let highestConfidence = -1;
  let bestText: string | null = null;

  for (const key of Object.keys(sensori)) {
     const sensor = sensori[key as keyof ScenarioSensors];
     if (sensor && sensor.testo && sensor.confidenza !== null) {
        if (sensor.confidenza > highestConfidence) {
           highestConfidence = sensor.confidenza;
           bestText = sensor.testo;
        }
     }
  }

  return {
    testo_fuso: bestText,
    // Se tutti offline usiamo 0
    confidenza_finale: highestConfidence === -1 ? 0 : highestConfidence 
  };
}
