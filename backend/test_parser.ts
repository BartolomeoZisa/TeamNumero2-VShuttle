import fs from 'fs';
import path from 'path';
import { parseSignSemantic, ScenarioContext, ActionType } from './parser';

const REPORT_PATH = path.join(__dirname, '..', 'parser_debug_report.txt');

interface TestCase {
  text: string;
  context: ScenarioContext;
  expectedAction: ActionType;
  description: string;
}

const tests: TestCase[] = [
  {
    description: "Divieto Navetta Esplicita",
    text: "DIVIETO DI TRANSITO NAVETTE L4",
    context: { currentTime: "12:00", currentDay: "Lunedì" },
    expectedAction: "STOP"
  },
  {
    description: "Divieto Eccetto Navetta (Semplice)",
    text: "DIVIETO DI ACCESSO ECCETTO BUS",
    context: { currentTime: "10:00", currentDay: "Martedì" },
    expectedAction: "GO"
  },
  {
    description: "ZTL Fuori Orario (Divieto ma non attivo)",
    text: "ZTL ATTIVA 08:00 - 20:00",
    context: { currentTime: "22:00", currentDay: "Mercoledì" },
    expectedAction: "GO"
  },
  {
    description: "ZTL In Orario (Divieto attivo)",
    text: "ZTL ATTIVA 08:00 - 20:00",
    context: { currentTime: "15:00", currentDay: "Giovedì" },
    expectedAction: "STOP"
  },
  {
    description: "ZTL Notturna Scavallo",
    text: "ZTL NOTTURNA 23:00-05:00",
    context: { currentTime: "02:00", currentDay: "Domenica" },
    expectedAction: "STOP" 
  },
  {
    description: "Mercato Rionale (Regex range ore e giorno)",
    text: "MERCATO RIONALE VENERDI 06:00-14:00",
    context: { currentTime: "10:30", currentDay: "Venerdì" },
    expectedAction: "STOP" 
  },
  {
    description: "Mercato Rionale Fuori Giorno",
    text: "MERCATO RIONALE VENERDI 06:00-14:00",
    context: { currentTime: "10:30", currentDay: "Giovedì" },
    expectedAction: "GO" 
  },
  {
    description: "Attenzione Blanda",
    text: "LAVORI IN CORSO A 100M",
    context: { currentTime: "12:00", currentDay: "Lunedì" },
    expectedAction: "INTERVENT"
  },
  {
    description: "Varco Non Attivo Esplicito",
    text: "ZTL VARCO NON ATTIVO",
    context: { currentTime: "12:00", currentDay: "Lunedì" },
    expectedAction: "GO"
  },
  {
    description: "Test pattern order-agnostic",
    text: "DALLE 20 ALLE 06 ZTL",
    context: { currentTime: "23:00", currentDay: "Sabato" },
    expectedAction: "STOP"
  }
];

let reportOutput = "=== VSHUTTLE PARSER DEBUG REPORT ===\n\n";
let passedCount = 0;

tests.forEach((tc, idx) => {
  const result = parseSignSemantic(tc.text, tc.context, 0.99);
  const passed = result.action === tc.expectedAction;
  if (passed) passedCount++;

  const status = passed ? "[PASS]" : "[FAIL]";
  const logLine = `${status} Test #${idx+1} - ${tc.description}
  [In] Cartello: "${tc.text}" | Contesto: ${tc.context.currentDay} ${tc.context.currentTime}
  [Ut] Azione Attesa: ${tc.expectedAction} | Azione Ricevuta: ${result.action}
  [Rt] Causale Parser: ${result.reason}
  --------------------------------------------------\n`;
  
  process.stdout.write(logLine);
  reportOutput += logLine;
});

reportOutput += `\nRisultato Totale: ${passedCount} / ${tests.length} PASSATI.\n`;

fs.writeFileSync(REPORT_PATH, reportOutput, 'utf-8');
console.log(`\nReport completo salvato in: ${REPORT_PATH}`);
