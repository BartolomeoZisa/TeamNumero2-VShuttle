import './style.css';

// --- Types ---
type ActionType = 'GO' | 'STOP' | 'INTERVENTO' | 'INTERVENT';
type ConfidenceLevel = 'high' | 'medium' | 'low';

interface Scenario {
  id: number;
  parsedText: string;
  action: ActionType;
  uncertainAction?: 'GO' | 'STOP';
  confidenceNum: number; // 0 to 100
  confidenceLevel: ConfidenceLevel;
}

// --- Mock Data Removed: We fetch from backend instead ---
let liveScenarios: Scenario[] = [];

// --- DOM Elements ---
const appEl = document.getElementById('app') as HTMLDivElement;
const btnStart = document.getElementById('btn-start') as HTMLButtonElement;
const btnStopSim = document.getElementById('btn-stop-sim') as HTMLButtonElement;
const btnOverride = document.getElementById('btn-override') as HTMLButtonElement;
const btnConfirm = document.getElementById('btn-confirm') as HTMLButtonElement;

const sysStatusIndicator = document.getElementById('system-status-indicator') as HTMLDivElement;
const sysStatusText = document.getElementById('system-status-text') as HTMLDivElement;

const confidenceValue = document.getElementById('confidence-value') as HTMLSpanElement;
const confidenceBar = document.getElementById('confidence-bar') as HTMLDivElement;
const suggestedAction = document.getElementById('suggested-action') as HTMLDivElement;
const parsedTextEl = document.getElementById('parsed-text') as HTMLParagraphElement;

const timerOverlay = document.getElementById('timer-overlay') as HTMLDivElement;
const countdownText = document.getElementById('countdown-text') as HTMLDivElement;

// --- State ---
let currentScenarioIndex = -1;
let isSimulationRunning = false;
let autoAdvanceTimer: number | null = null;
let overrideTimer: number | null = null;
let currentCountdown = 2.0;
let countdownInterval: number | null = null;

// --- Logic ---

function init() {
  // Reveal app with fade in
  setTimeout(() => {
    appEl.classList.remove('opacity-0');
  }, 100);

  btnStart.addEventListener('click', startSimulation);
  btnStopSim.addEventListener('click', stopSimulation);
  btnOverride.addEventListener('click', () => handleHumanIntervention('OVERRIDE'));
  btnConfirm.addEventListener('click', () => handleHumanIntervention('CONFERMA'));
}

function startSimulation() {
  if (isSimulationRunning) return;

  isSimulationRunning = true;
  currentScenarioIndex = -1;

  // UI Updates
  btnStart.classList.add('hidden');
  btnStopSim.classList.remove('hidden');
  sysStatusIndicator.classList.replace('bg-gray-500', 'bg-green-500');
  sysStatusIndicator.classList.add('animate-pulse-fast');
  sysStatusText.textContent = 'RUNNING';
  sysStatusText.classList.replace('bg-gray-700', 'bg-green-600');

  nextScenario();
}

function stopSimulation() {
  isSimulationRunning = false;
  clearTimers();

  // UI Updates for Stop
  btnStart.classList.remove('hidden');
  btnStart.textContent = 'RESTART SIMULATION';
  btnStopSim.classList.add('hidden');
  sysStatusIndicator.classList.replace('bg-green-500', 'bg-gray-500');
  sysStatusIndicator.classList.remove('animate-pulse-fast');
  sysStatusIndicator.classList.remove('bg-amber-500');
  sysStatusIndicator.classList.remove('bg-red-500');
  sysStatusText.textContent = 'IDLE';
  sysStatusText.className = 'font-semibold px-3 py-1 bg-gray-700 rounded-md text-sm uppercase tracking-wider';

  parsedTextEl.textContent = 'Simulazione interrotta.';
  parsedTextEl.className = 'text-4xl leading-tight font-medium text-center text-gray-400 max-w-3xl drop-shadow-sm transition-all duration-300';

  clearActionUI();
  hideTimerOverlay();
}

async function fetchScenarios() {
  try {
    const response = await fetch('/backend_output.json?t=' + new Date().getTime());
    const data = await response.json();
    liveScenarios = data.map((item: any) => {
      const confidencePercent = Math.round(item.confidence * 100);
      let level: ConfidenceLevel = 'low';
      if (confidencePercent > 80) level = 'high';
      else if (confidencePercent >= 40) level = 'medium';

      return {
        id: item.id_scenario,
        parsedText: item.reason,
        action: confidencePercent < 90 ? 'INTERVENTO' : item.action,
        uncertainAction: item.action, // The actual action that we want to override
        confidenceNum: confidencePercent,
        confidenceLevel: level
      } as Scenario;
    });
  } catch(e) {
    console.warn("Failed to fetch scenarios", e);
  }
}

async function nextScenario() {
  if (!isSimulationRunning) return;

  // Ad ogni ciclo chiediamo il file aggiornato
  await fetchScenarios();

  currentScenarioIndex++;

  if (liveScenarios.length === 0) {
    autoAdvanceTimer = window.setTimeout(() => nextScenario(), 4000);
    return;
  }

  // If we reached the end, loop back or stop
  if (currentScenarioIndex >= liveScenarios.length) {
    currentScenarioIndex = 0; // Loop indefinitely for continuous simulation
  }

  const scenario = liveScenarios[currentScenarioIndex];
  renderScenario(scenario);

  if (scenario.action === 'GO' || scenario.action === 'STOP') {
    // Scenario chiaro: avanza automaticamente dopo 4 secondi
    autoAdvanceTimer = window.setTimeout(() => {
      nextScenario();
    }, 4000);
  } else if (scenario.action === 'INTERVENTO') {
    // Scenario incerto: fermati e chiedi intervento umano
    requestHumanIntervention();
  }
}

function renderScenario(scenario: Scenario) {
  // Update sys status to match current scenario threat level
  sysStatusIndicator.className = 'w-4 h-4 rounded-full shadow-[0_0_10px_rgba(107,114,128,0.5)] animate-pulse-fast';
  if (scenario.action === 'GO') sysStatusIndicator.classList.add('bg-green-500');
  else if (scenario.action === 'STOP') sysStatusIndicator.classList.add('bg-red-500');
  else sysStatusIndicator.classList.add('bg-amber-500');

  // Tinta globale schermata (body + pannelli) in base all'azione
  const bodyBase = 'text-white font-sans antialiased h-screen flex flex-col overflow-hidden transition-colors duration-500';
  const panelBase = 'rounded-xl p-0 shadow-lg border flex flex-col transition-colors duration-500';
  const panelLeft  = document.getElementById('panel-left');
  const panelRight = document.getElementById('panel-right');

  if (scenario.action === 'GO') {
    document.body.className = bodyBase + ' state-go';
    panelLeft?.classList.replace('panel-stop', 'panel-go');
    panelLeft?.classList.add('panel-go');
    panelRight?.classList.replace('panel-stop', 'panel-go');
    panelRight?.classList.add('panel-go');
  } else if (scenario.action === 'STOP') {
    document.body.className = bodyBase + ' state-stop';
    panelLeft?.classList.replace('panel-go', 'panel-stop');
    panelLeft?.classList.add('panel-stop');
    panelRight?.classList.replace('panel-go', 'panel-stop');
    panelRight?.classList.add('panel-stop');
  } else {
    document.body.className = bodyBase + ' state-neutral';
    panelLeft?.classList.remove('panel-go', 'panel-stop');
    panelRight?.classList.remove('panel-go', 'panel-stop');
  }

  // Parsed Text
  parsedTextEl.textContent = scenario.parsedText;
  parsedTextEl.className = 'text-4xl leading-tight font-medium text-center max-w-3xl drop-shadow-sm transition-all duration-300';
  if (scenario.action === 'GO') parsedTextEl.classList.add('text-green-100');
  else if (scenario.action === 'STOP') parsedTextEl.classList.add('text-red-100');
  else parsedTextEl.classList.add('text-amber-100');

  // Confidence
  confidenceValue.textContent = `${scenario.confidenceNum}%`;
  confidenceBar.style.width = `${scenario.confidenceNum}%`;

  confidenceBar.className = 'h-4 rounded-full transition-all duration-500';
  if (scenario.confidenceLevel === 'high') {
    confidenceBar.classList.add('bg-confidence-high');
  } else if (scenario.confidenceLevel === 'medium') {
    confidenceBar.classList.add('bg-confidence-medium');
  } else {
    confidenceBar.classList.add('bg-confidence-low');
  }

  // Suggested Action
  suggestedAction.textContent = scenario.action;
  suggestedAction.className = 'text-5xl font-black text-center uppercase tracking-widest drop-shadow-md transition-colors';

  if (scenario.action === 'GO') {
    suggestedAction.classList.add('text-action-go');
  } else if (scenario.action === 'STOP') {
    suggestedAction.classList.add('text-action-stop');
  } else {
    suggestedAction.classList.add('text-action-intervention');
    suggestedAction.textContent = 'ATTENZIONE';
  }
}

function clearActionUI() {
  confidenceValue.textContent = '--%';
  confidenceBar.style.width = '0%';
  confidenceBar.className = 'bg-gray-500 h-4 rounded-full transition-all duration-500';
  suggestedAction.textContent = '--';
  suggestedAction.className = 'text-4xl font-black text-center text-gray-500 uppercase tracking-widest drop-shadow-md';
}

function requestHumanIntervention() {
  sysStatusText.textContent = 'WAITING U.I.';
  sysStatusText.classList.replace('bg-green-600', 'bg-amber-600');

  currentCountdown = 2.0;
  updateCountdownUI();

  // Show overlay
  timerOverlay.classList.remove('hidden');
  // Small delay for transition to work
  requestAnimationFrame(() => {
    timerOverlay.classList.remove('opacity-0');
  });

  const currentScenario = liveScenarios[currentScenarioIndex];
  const overlaySuggestedAction = document.getElementById('overlay-suggested-action') as HTMLDivElement;

  // Mostra SEMPRE l'azione reale del backend che stiamo per confermare o annullare.
  // uncertainAction è impostato dal fetchScenarios e contiene l'action originale (GO/STOP/INTERVENT).
  const actionToDisplay = currentScenario.uncertainAction ?? currentScenario.action;
  const isStop = actionToDisplay === 'STOP';
  overlaySuggestedAction.textContent = `AZIONE PREVISTA: ${actionToDisplay}`;
  overlaySuggestedAction.className = `text-5xl font-black mb-12 drop-shadow-lg uppercase tracking-widest ${
    isStop ? 'text-red-400' : 'text-green-400'
  }`;

  countdownInterval = window.setInterval(() => {
    currentCountdown -= 0.1;
    if (currentCountdown <= 0) {
      currentCountdown = 0;
      updateCountdownUI();
      handleTimeout();
    } else {
      updateCountdownUI();
    }
  }, 100);
}

function updateCountdownUI() {
  countdownText.textContent = `${currentCountdown.toFixed(1)}s`;
  if (currentCountdown <= 0.5) {
    countdownText.classList.add('text-red-500');
  } else {
    countdownText.classList.remove('text-red-500');
  }
}

function handleHumanIntervention(decision: 'OVERRIDE' | 'CONFERMA') {
  console.log(`User interaction: ${decision}`);
  sysStatusText.textContent = 'RUNNING';
  sysStatusText.classList.replace('bg-amber-600', 'bg-green-600');

  const currentScenario = liveScenarios[currentScenarioIndex];
  // L'azione reale che il sistema aveva suggerito (prima della soglia di confidenza)
  const baseAction = currentScenario.uncertainAction ?? currentScenario.action;
  // CONFERMA: mantieni l'azione del sistema. OVERRIDE: invertila.
  let finalAction: ActionType = baseAction as ActionType;
  if (decision === 'OVERRIDE') {
    finalAction = (finalAction === 'GO' || finalAction === 'INTERVENT') ? 'STOP' : 'GO';
  }

  // Update the Action Panel with the final decision
  suggestedAction.textContent = finalAction || 'SCONOSCIUTA';
  suggestedAction.className = 'text-5xl font-black text-center uppercase tracking-widest drop-shadow-md transition-colors';
  if (finalAction === 'GO') {
    suggestedAction.classList.add('text-action-go');
  } else {
    suggestedAction.classList.add('text-action-stop');
  }

  hideTimerOverlay();
  clearTimers();

  // Show immediate feedback
  parsedTextEl.textContent = `Azione manuale registrata: ${decision}`;
  parsedTextEl.className = 'text-4xl leading-tight font-black text-center max-w-3xl drop-shadow-sm transition-all duration-300 text-indigo-400';

  // Resume loop after a short visual confirm
  setTimeout(() => {
    nextScenario();
  }, 1000);
}

function handleTimeout() {
  console.log('Timeout reached. Enforcing safety STOP.');
  sysStatusText.textContent = 'SAFETY STOP';
  sysStatusText.classList.replace('bg-amber-600', 'bg-red-600');

  hideTimerOverlay();
  clearTimers();

  // Overwrite UI to show emergency stop
  suggestedAction.textContent = 'STOP DI EMERGENZA';
  suggestedAction.className = 'text-4xl font-black text-center text-action-stop uppercase tracking-widest drop-shadow-md';
  parsedTextEl.textContent = 'Frenata di emergenza attivata per sicurezza.';
  parsedTextEl.className = 'text-4xl leading-tight font-black text-center max-w-3xl drop-shadow-sm transition-all duration-300 text-red-500 bg-red-900/30 p-8 rounded-xl border border-red-500 animate-pulse';

  sysStatusIndicator.className = 'w-4 h-4 rounded-full shadow-[0_0_10px_rgba(107,114,128,0.5)] bg-red-500 animate-pulse-fast text-red-100';

  // Resume loop
  autoAdvanceTimer = window.setTimeout(() => {
    sysStatusText.textContent = 'RUNNING';
    sysStatusText.classList.replace('bg-red-600', 'bg-green-600');
    nextScenario();
  }, 3000); // Wait 3s on emergency stop before continuing
}

function hideTimerOverlay() {
  timerOverlay.classList.add('opacity-0');
  setTimeout(() => {
    timerOverlay.classList.add('hidden');
  }, 300); // matches duration-300
}

function clearTimers() {
  if (autoAdvanceTimer) {
    clearTimeout(autoAdvanceTimer);
    autoAdvanceTimer = null;
  }
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}

// Start app
init();
