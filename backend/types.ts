type SensorName = 'camera_frontale' | 'camera_laterale' | 'V2I_receiver';

interface SensorData {
  testo: string | null;
  confidenza: number | null;
}

interface Scenario {
  id_scenario: number;
  sensori: {
    camera_frontale: SensorData;
    camera_laterale: SensorData;
    V2I_receiver: SensorData;
  };
  orario_rilevamento: string;
  giorno_settimana: string;
}

interface FusionResult {
  id_scenario: number;
  testo_definitivo: string | null;
  confidenza_fusa: number;
  sensori_online: number;
  sorgente_testo: string | null;
}


// ==========================================
// 2. LOGICA DI FUSIONE SENSORI
// ==========================================

// Pesi che riflettono l'affidabilità intrinseca del sensore
const SENSOR_WEIGHTS: Record<SensorName, number> = {
  camera_frontale: 1.5, // Molto affidabile
  V2I_receiver: 1.2,    // Abbastanza affidabile (quando è online)
  camera_laterale: 0.8  // Mediamente affidabile
};
