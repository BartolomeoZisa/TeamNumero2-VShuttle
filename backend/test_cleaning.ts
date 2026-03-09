import { cleanText, normalizeString, findBestMatch } from './cleaning';

console.log("=== TEST NORMALIZE ===");
const testCases = [
  { in: "Z T L", out: "ZTL" },
  { in: "D1V1ET0 D1 ACCE550", out: "DIVIETO DI ACCESSO" },
  { in: "V.A.R.C.O.", out: "VARCO" },
  { in: "S3NS0 UN1C0 4LT3RN4T0", out: "SENSO UNICO ALTERNATO" },
  { in: "ECCETTO FORNITORE 08-10", out: "ECCETTO FORNITORE 08-10" } // numeri non toccati
];

testCases.forEach(tc => {
  const res = normalizeString(tc.in);
  console.log(`[${res === tc.out ? 'PASS' : 'FAIL'}] '${tc.in}' => '${res}' (Atteso: '${tc.out}')`);
});

console.log("\n=== TEST FUSION / LEVENSHTEIN ===");
const matchCases = [
  { in: "D I V  E T O  D I  A C C S S O", out: "DIVIETO DI ACCESSO" },
  { in: "DIVIETO TRANSITO NAVETTE L4", out: "DIVIETO DI TRANSITO NAVETTE L4" },
  { in: "MERCATO VENERDI 06-14", out: "MERCATO RIONALE VENERDI 06:00-14:00" },
  { in: "STRADA SDISSESTATA", out: "STRADA DISSESTATA LIMITE 10 KM/H" } // forse
];

matchCases.forEach(mc => {
  const res = cleanText(mc.in);
  console.log(`'${mc.in}' => '${res}' (Atteso simile a: '${mc.out}')`);
});
