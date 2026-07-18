"use strict";
(() => {
  // src/types.ts
  var DIFFICULTY_LABELS = {
    easy: "F\xE1cil",
    medium: "M\xE9dio",
    hard: "Dif\xEDcil",
    expert: "Expert"
  };

  // src/core/solver.ts
  var ALL_CANDIDATES = 511;
  var ROW_OF = new Array(81);
  var COL_OF = new Array(81);
  var BOX_OF = new Array(81);
  for (let i = 0; i < 81; i++) {
    ROW_OF[i] = Math.floor(i / 9);
    COL_OF[i] = i % 9;
    BOX_OF[i] = Math.floor(ROW_OF[i] / 3) * 3 + Math.floor(COL_OF[i] / 3);
  }
  function buildMasks(grid) {
    const rows = new Array(9).fill(0);
    const cols = new Array(9).fill(0);
    const boxes = new Array(9).fill(0);
    for (let i = 0; i < 81; i++) {
      const value = grid[i];
      if (value === 0) continue;
      const bit = 1 << value - 1;
      if (rows[ROW_OF[i]] & bit || cols[COL_OF[i]] & bit || boxes[BOX_OF[i]] & bit) {
        return null;
      }
      rows[ROW_OF[i]] |= bit;
      cols[COL_OF[i]] |= bit;
      boxes[BOX_OF[i]] |= bit;
    }
    return { rows, cols, boxes };
  }
  function popCount(mask) {
    let count = 0;
    while (mask) {
      mask &= mask - 1;
      count++;
    }
    return count;
  }
  function place(grid, masks, pos, digit) {
    const bit = 1 << digit - 1;
    grid[pos] = digit;
    masks.rows[ROW_OF[pos]] |= bit;
    masks.cols[COL_OF[pos]] |= bit;
    masks.boxes[BOX_OF[pos]] |= bit;
  }
  function unplace(grid, masks, pos, digit) {
    const bit = 1 << digit - 1;
    grid[pos] = 0;
    masks.rows[ROW_OF[pos]] &= ~bit;
    masks.cols[COL_OF[pos]] &= ~bit;
    masks.boxes[BOX_OF[pos]] &= ~bit;
  }
  function pickCell(grid, masks) {
    let bestPos = -1;
    let bestMask = 0;
    let bestCount = 10;
    for (let i = 0; i < 81; i++) {
      if (grid[i] !== 0) continue;
      const mask = ALL_CANDIDATES & ~(masks.rows[ROW_OF[i]] | masks.cols[COL_OF[i]] | masks.boxes[BOX_OF[i]]);
      if (mask === 0) return "dead";
      const count = popCount(mask);
      if (count < bestCount) {
        bestCount = count;
        bestPos = i;
        bestMask = mask;
        if (count === 1) break;
      }
    }
    if (bestPos === -1) return "solved";
    return { pos: bestPos, candidates: bestMask };
  }
  function searchFirst(grid, masks, randomize) {
    const picked = pickCell(grid, masks);
    if (picked === "dead") return false;
    if (picked === "solved") return true;
    const digits = [];
    for (let digit = 1; digit <= 9; digit++) {
      if (picked.candidates & 1 << digit - 1) digits.push(digit);
    }
    if (randomize) shuffle(digits);
    for (const digit of digits) {
      place(grid, masks, picked.pos, digit);
      if (searchFirst(grid, masks, randomize)) return true;
      unplace(grid, masks, picked.pos, digit);
    }
    return false;
  }
  function countRecursive(grid, masks, limit) {
    const picked = pickCell(grid, masks);
    if (picked === "dead") return 0;
    if (picked === "solved") return 1;
    let found = 0;
    for (let digit = 1; digit <= 9; digit++) {
      if (!(picked.candidates & 1 << digit - 1)) continue;
      place(grid, masks, picked.pos, digit);
      found += countRecursive(grid, masks, limit - found);
      unplace(grid, masks, picked.pos, digit);
      if (found >= limit) break;
    }
    return found;
  }
  function countSolutions(grid, limit = 2) {
    const work = grid.slice();
    const masks = buildMasks(work);
    if (!masks) return 0;
    return countRecursive(work, masks, limit);
  }
  function generateSolvedGrid() {
    const grid = new Array(81).fill(0);
    const masks = buildMasks(grid);
    searchFirst(grid, masks, true);
    return grid;
  }
  function shuffle(items) {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }

  // src/core/generator.ts
  var CLUE_RANGES = {
    easy: [30, 36],
    medium: [26, 30],
    hard: [22, 26],
    expert: [17, 22]
  };
  var TIME_BUDGET_MS = 1500;
  function generatePuzzle(difficulty) {
    const solution = generateSolvedGrid();
    const [minClues, maxClues] = CLUE_RANGES[difficulty];
    const target = minClues + Math.floor(Math.random() * (maxClues - minClues + 1));
    const deadline = performance.now() + TIME_BUDGET_MS;
    let best = solution;
    let bestClues = 82;
    do {
      const { puzzle, clues } = dig(solution, target, deadline);
      if (clues < bestClues) {
        best = puzzle;
        bestClues = clues;
      }
    } while (bestClues > maxClues && performance.now() < deadline);
    return { puzzle: best, solution };
  }
  function dig(solution, targetClues, deadline) {
    const puzzle = solution.slice();
    const positions = shuffle(Array.from({ length: 81 }, (_, i) => i));
    let clues = 81;
    for (const pos of positions) {
      if (clues <= targetClues || performance.now() > deadline) break;
      const removed = puzzle[pos];
      puzzle[pos] = 0;
      if (countSolutions(puzzle, 2) === 1) {
        clues--;
      } else {
        puzzle[pos] = removed;
      }
    }
    return { puzzle, clues };
  }

  // src/game/state.ts
  var MAX_HINTS = 3;
  function emptyNotes() {
    return Array.from({ length: 81 }, () => []);
  }
  function newGame(difficulty) {
    const { puzzle, solution } = generatePuzzle(difficulty);
    return {
      puzzle,
      solution,
      grid: puzzle.slice(),
      notes: emptyNotes(),
      difficulty,
      seconds: 0,
      hintsLeft: MAX_HINTS,
      finished: false,
      checkedErrors: []
    };
  }
  function isFixed(state2, pos) {
    return state2.puzzle[pos] !== 0;
  }
  function setCell(state2, pos, value) {
    if (state2.finished || isFixed(state2, pos) || state2.grid[pos] === value) return false;
    state2.grid[pos] = value;
    state2.notes[pos] = [];
    if (value !== 0) removeNoteFromPeers(state2, pos, value);
    state2.checkedErrors = state2.checkedErrors.filter((p) => p !== pos);
    if (value !== 0 && isComplete(state2)) state2.finished = true;
    return true;
  }
  function toggleNote(state2, pos, digit) {
    if (state2.finished || isFixed(state2, pos) || state2.grid[pos] !== 0 || !Number.isInteger(digit) || digit < 1 || digit > 9) {
      return false;
    }
    const notes = state2.notes[pos];
    const existing = notes.indexOf(digit);
    if (existing >= 0) {
      notes.splice(existing, 1);
    } else {
      notes.push(digit);
      notes.sort((a, b) => a - b);
    }
    return true;
  }
  function eraseCell(state2, pos) {
    if (state2.finished || isFixed(state2, pos)) return false;
    const changed = state2.grid[pos] !== 0 || state2.notes[pos].length > 0;
    if (!changed) return false;
    state2.grid[pos] = 0;
    state2.notes[pos] = [];
    state2.checkedErrors = state2.checkedErrors.filter((p) => p !== pos);
    return true;
  }
  function isComplete(state2) {
    return state2.grid.every((value, i) => value === state2.solution[i]);
  }
  function wrongPositions(state2) {
    const wrong = [];
    for (let i = 0; i < 81; i++) {
      if (state2.grid[i] !== 0 && !isFixed(state2, i) && state2.grid[i] !== state2.solution[i]) {
        wrong.push(i);
      }
    }
    return wrong;
  }
  function applyHint(state2, selected2) {
    if (state2.finished || state2.hintsLeft <= 0) return null;
    let pos = null;
    if (selected2 !== null && !isFixed(state2, selected2) && state2.grid[selected2] === 0) {
      pos = selected2;
    }
    if (pos === null) {
      const empty = [];
      for (let i = 0; i < 81; i++) if (state2.grid[i] === 0) empty.push(i);
      const pool = empty.length > 0 ? empty : wrongPositions(state2);
      if (pool.length === 0) return null;
      pos = pool[Math.floor(Math.random() * pool.length)];
    }
    state2.grid[pos] = state2.solution[pos];
    state2.notes[pos] = [];
    removeNoteFromPeers(state2, pos, state2.solution[pos]);
    state2.checkedErrors = state2.checkedErrors.filter((p) => p !== pos);
    state2.hintsLeft--;
    if (isComplete(state2)) state2.finished = true;
    return pos;
  }
  function solveAll(state2) {
    state2.grid = state2.solution.slice();
    state2.notes = emptyNotes();
    state2.checkedErrors = [];
    state2.finished = true;
  }
  function restart(state2) {
    state2.grid = state2.puzzle.slice();
    state2.notes = emptyNotes();
    state2.seconds = 0;
    state2.hintsLeft = MAX_HINTS;
    state2.finished = false;
    state2.checkedErrors = [];
  }
  function remainingByDigit(state2) {
    const remaining = new Array(10).fill(9);
    for (const value of state2.grid) {
      if (value !== 0) remaining[value]--;
    }
    return remaining.map((count) => Math.max(0, count));
  }
  function removeNoteFromPeers(state2, filledPos, digit) {
    const filledRow = Math.floor(filledPos / 9);
    const filledCol = filledPos % 9;
    for (let pos = 0; pos < 81; pos++) {
      if (pos === filledPos || state2.notes[pos].length === 0) continue;
      const row = Math.floor(pos / 9);
      const col = pos % 9;
      const sharesRow = row === filledRow;
      const sharesCol = col === filledCol;
      const sharesBox = Math.floor(row / 3) === Math.floor(filledRow / 3) && Math.floor(col / 3) === Math.floor(filledCol / 3);
      if (sharesRow || sharesCol || sharesBox) {
        state2.notes[pos] = state2.notes[pos].filter((note) => note !== digit);
      }
    }
  }

  // src/game/timer.ts
  var Timer = class {
    constructor(onTick) {
      this.onTick = onTick;
      this.seconds = 0;
      this.intervalId = null;
    }
    /** Retoma a contagem a partir do valor atual. */
    start() {
      if (this.intervalId !== null) return;
      this.intervalId = window.setInterval(() => {
        this.seconds++;
        this.onTick(this.seconds);
      }, 1e3);
    }
    pause() {
      if (this.intervalId !== null) {
        window.clearInterval(this.intervalId);
        this.intervalId = null;
      }
    }
    /** Para o cronômetro e zera (ou restaura um tempo salvo). */
    reset(seconds = 0) {
      this.pause();
      this.seconds = seconds;
      this.onTick(this.seconds);
    }
    get running() {
      return this.intervalId !== null;
    }
  };
  function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  // src/game/audio.ts
  var SoundPlayer = class {
    constructor() {
      this.enabled = true;
      this.ctx = null;
    }
    /** Toque curto e neutro ao inserir um número (sem revelar acerto/erro). */
    place() {
      this.tone(520, 0.06, "sine", 0.05);
    }
    /** Confirmação sutil de acerto. */
    correct() {
      this.tone(660, 0.09, "sine", 0.06);
    }
    /** Aviso grave de erro. */
    error() {
      this.tone(165, 0.18, "triangle", 0.08);
    }
    /** Arpejo ascendente de vitória (C5–E5–G5–C6). */
    win() {
      [523, 659, 784, 1047].forEach((freq, i) => this.tone(freq, 0.22, "sine", 0.07, i * 0.13));
    }
    context() {
      if (!this.enabled) return null;
      try {
        this.ctx ??= new AudioContext();
        if (this.ctx.state === "suspended") void this.ctx.resume();
        return this.ctx;
      } catch {
        return null;
      }
    }
    tone(frequency, duration, type, gain, delay = 0) {
      const ctx = this.context();
      if (!ctx) return;
      const start = ctx.currentTime + delay;
      const oscillator = ctx.createOscillator();
      const volume = ctx.createGain();
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      volume.gain.setValueAtTime(0, start);
      volume.gain.linearRampToValueAtTime(gain, start + 0.01);
      volume.gain.exponentialRampToValueAtTime(1e-4, start + duration);
      oscillator.connect(volume).connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.05);
    }
  };

  // src/game/storage.ts
  var STORAGE_KEY = "sudoku-ts:save:v1";
  function save(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
    }
  }
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!isValid(data)) return null;
      if (!Array.isArray(data.state.notes)) {
        data.state.notes = Array.from({ length: 81 }, () => []);
      }
      return data;
    } catch {
      return null;
    }
  }
  function isValid(data) {
    const grids = [data?.state?.puzzle, data?.state?.solution, data?.state?.grid];
    const notes = data?.state?.notes;
    const notesAreValid = notes === void 0 || Array.isArray(notes) && notes.length === 81 && notes.every(
      (cellNotes) => Array.isArray(cellNotes) && cellNotes.every(
        (digit, index) => Number.isInteger(digit) && digit >= 1 && digit <= 9 && cellNotes.indexOf(digit) === index
      )
    );
    return grids.every((grid) => Array.isArray(grid) && grid.length === 81) && notesAreValid && typeof data.state.seconds === "number" && typeof data.state.hintsLeft === "number" && Array.isArray(data.state.checkedErrors) && typeof data.settings?.autoCheck === "boolean" && typeof data.settings?.sound === "boolean" && typeof data.settings?.dark === "boolean";
  }

  // src/ui/view.ts
  function query(selector) {
    const element = document.querySelector(selector);
    if (!element) throw new Error(`Elemento n\xE3o encontrado: ${selector}`);
    return element;
  }
  var View = class {
    constructor(callbacks) {
      this.callbacks = callbacks;
      this.board = query("#board");
      this.numpad = query("#numpad");
      this.timerLabel = query("#stat-timer");
      this.hintsLabel = query("#stat-hints");
      this.difficultyLabel = query("#stat-difficulty");
      this.autoCheckInput = query("#auto-check");
      this.soundButton = query("#btn-sound");
      this.themeButton = query("#btn-theme");
      this.annotationButton = query("#btn-annotation");
      this.toast = query("#toast");
      this.modalOverlay = query("#modal-overlay");
      this.winTime = query("#win-time");
      this.winDifficulty = query("#win-difficulty");
      this.cells = [];
      this.cellValues = [];
      this.noteSlots = [];
      /** Botões de dígito indexados de 1 a 9. */
      this.digitButtons = new Array(10);
      this.toastTimeout = null;
      this.buildBoard();
      this.buildNumpad();
      this.modalOverlay.addEventListener("click", (event) => {
        if (event.target === this.modalOverlay) this.hideWinModal();
      });
    }
    /** Cria as 81 células uma única vez; o render só atualiza classes/texto. */
    buildBoard() {
      for (let pos = 0; pos < 81; pos++) {
        const row = Math.floor(pos / 9);
        const col = pos % 9;
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "cell";
        const value = document.createElement("span");
        value.className = "cell-value";
        const notes = document.createElement("span");
        notes.className = "cell-notes";
        notes.setAttribute("aria-hidden", "true");
        const slots = [];
        for (let digit = 1; digit <= 9; digit++) {
          const slot = document.createElement("span");
          slot.className = "cell-note";
          notes.appendChild(slot);
          slots.push(slot);
        }
        cell.append(value, notes);
        if (col === 2 || col === 5) cell.classList.add("edge-right");
        if (row === 2 || row === 5) cell.classList.add("edge-bottom");
        cell.setAttribute("aria-label", `Linha ${row + 1}, coluna ${col + 1}`);
        cell.addEventListener("click", () => this.callbacks.onCellClick(pos));
        this.cells.push(cell);
        this.cellValues.push(value);
        this.noteSlots.push(slots);
        this.board.appendChild(cell);
      }
    }
    /** Teclado numérico em tela com contador de dígitos restantes. */
    buildNumpad() {
      for (let digit = 1; digit <= 9; digit++) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "key";
        button.setAttribute("aria-label", `Inserir ${digit}`);
        button.innerHTML = `<span class="key-digit">${digit}</span><span class="key-count">9</span>`;
        button.addEventListener("click", () => this.callbacks.onDigit(digit));
        this.digitButtons[digit] = button;
        this.numpad.appendChild(button);
      }
      const erase = document.createElement("button");
      erase.type = "button";
      erase.className = "key key-erase";
      erase.setAttribute("aria-label", "Apagar n\xFAmero");
      erase.innerHTML = '<span class="key-digit">\u232B</span>';
      erase.addEventListener("click", () => this.callbacks.onErase());
      this.numpad.appendChild(erase);
    }
    /** Atualiza tabuleiro, teclado e estatísticas a partir do estado. */
    render(state2, selected2, autoCheck, annotationMode2) {
      const wrong = new Set(
        autoCheck ? wrongPositions(state2) : state2.checkedErrors
      );
      const selectedValue = selected2 !== null ? state2.grid[selected2] : 0;
      for (let pos = 0; pos < 81; pos++) {
        const cell = this.cells[pos];
        const value = state2.grid[pos];
        const notes = state2.notes[pos];
        this.cellValues[pos].textContent = value === 0 ? "" : String(value);
        const noteSet = new Set(notes);
        for (let digit = 1; digit <= 9; digit++) {
          this.noteSlots[pos][digit - 1].textContent = noteSet.has(digit) ? String(digit) : "";
        }
        cell.setAttribute(
          "aria-label",
          cellAriaLabel(pos, value, notes)
        );
        cell.classList.toggle("has-value", value !== 0);
        cell.classList.toggle("has-notes", value === 0 && notes.length > 0);
        cell.classList.toggle("fixed", isFixed(state2, pos));
        cell.classList.toggle("user", !isFixed(state2, pos) && value !== 0);
        cell.classList.toggle("selected", pos === selected2);
        cell.classList.toggle(
          "peer",
          selected2 !== null && pos !== selected2 && isPeer(pos, selected2)
        );
        cell.classList.toggle(
          "same",
          selectedValue !== 0 && value === selectedValue && pos !== selected2
        );
        cell.classList.toggle("error", wrong.has(pos));
      }
      const remaining = remainingByDigit(state2);
      for (let digit = 1; digit <= 9; digit++) {
        const button = this.digitButtons[digit];
        button.querySelector(".key-count").textContent = String(
          remaining[digit]
        );
        button.disabled = state2.finished || !annotationMode2 && remaining[digit] === 0;
      }
      this.annotationButton.classList.toggle(
        "active",
        annotationMode2 && !state2.finished
      );
      this.annotationButton.setAttribute(
        "aria-pressed",
        String(annotationMode2 && !state2.finished)
      );
      this.annotationButton.disabled = state2.finished;
      this.hintsLabel.textContent = String(state2.hintsLeft);
      this.difficultyLabel.textContent = DIFFICULTY_LABELS[state2.difficulty];
    }
    updateTimer(seconds) {
      this.timerLabel.textContent = formatTime(seconds);
    }
    /** Reaplica uma animação CSS em uma célula (pop de dígito, shake de erro). */
    animateCell(pos, animation) {
      const cell = this.cells[pos];
      cell.classList.remove(animation);
      void cell.offsetWidth;
      cell.classList.add(animation);
      cell.addEventListener(
        "animationend",
        () => cell.classList.remove(animation),
        {
          once: true
        }
      );
    }
    /** Sincroniza tema, botões de som/tema e o toggle de erros. */
    applySettings(settings2) {
      document.documentElement.dataset.theme = settings2.dark ? "dark" : "light";
      this.themeButton.textContent = settings2.dark ? "\u2600\uFE0F" : "\u{1F319}";
      this.themeButton.setAttribute(
        "aria-label",
        settings2.dark ? "Ativar modo claro" : "Ativar modo escuro"
      );
      this.soundButton.textContent = settings2.sound ? "\u{1F50A}" : "\u{1F507}";
      this.soundButton.setAttribute(
        "aria-label",
        settings2.sound ? "Desligar sons" : "Ligar sons"
      );
      this.autoCheckInput.checked = settings2.autoCheck;
    }
    showToast(message, kind = "info") {
      this.toast.textContent = message;
      this.toast.className = `toast visible ${kind}`;
      if (this.toastTimeout !== null) window.clearTimeout(this.toastTimeout);
      this.toastTimeout = window.setTimeout(() => {
        this.toast.classList.remove("visible");
      }, 2400);
    }
    showWinModal(timeText, difficultyLabel) {
      this.winTime.textContent = timeText;
      this.winDifficulty.textContent = difficultyLabel;
      this.modalOverlay.classList.add("visible");
    }
    hideWinModal() {
      this.modalOverlay.classList.remove("visible");
    }
  };
  function cellAriaLabel(pos, value, notes) {
    const row = Math.floor(pos / 9) + 1;
    const col = pos % 9 + 1;
    if (value !== 0) return `Linha ${row}, coluna ${col}, valor ${value}`;
    if (notes.length > 0) {
      return `Linha ${row}, coluna ${col}, anota\xE7\xF5es ${notes.join(", ")}`;
    }
    return `Linha ${row}, coluna ${col}, vazia`;
  }
  function isPeer(a, b) {
    const rowA = Math.floor(a / 9);
    const colA = a % 9;
    const rowB = Math.floor(b / 9);
    const colB = b % 9;
    const sameBox = Math.floor(rowA / 3) === Math.floor(rowB / 3) && Math.floor(colA / 3) === Math.floor(colB / 3);
    return rowA === rowB || colA === colB || sameBox;
  }

  // src/main.ts
  var state;
  var selected = null;
  var annotationMode = false;
  var settings = {
    autoCheck: true,
    sound: true,
    dark: window.matchMedia("(prefers-color-scheme: dark)").matches
  };
  var sound = new SoundPlayer();
  var view = new View({
    onCellClick(pos) {
      selected = pos;
      renderAll();
    },
    onDigit: inputDigit,
    onErase: eraseSelected
  });
  var timer = new Timer((seconds) => {
    state.seconds = seconds;
    view.updateTimer(seconds);
    persist();
  });
  var difficultySelect = query("#difficulty");
  var saved = load();
  if (saved) {
    state = saved.state;
    Object.assign(settings, saved.settings);
  } else {
    state = newGame("easy");
  }
  sound.enabled = settings.sound;
  difficultySelect.value = state.difficulty;
  view.applySettings(settings);
  renderAll();
  timer.reset(state.seconds);
  if (!state.finished) timer.start();
  function persist() {
    save({ state, settings });
  }
  function renderAll() {
    view.render(state, selected, settings.autoCheck, annotationMode);
  }
  function inputDigit(digit) {
    if (state.finished || selected === null) return;
    if (isFixed(state, selected)) {
      view.animateCell(selected, "shake");
      return;
    }
    if (annotationMode) {
      if (!toggleNote(state, selected, digit)) return;
      renderAll();
      view.animateCell(selected, "pop");
      sound.place();
      persist();
      return;
    }
    if (!setCell(state, selected, digit)) return;
    renderAll();
    view.animateCell(selected, "pop");
    persist();
    if (state.finished) {
      celebrateWin();
      return;
    }
    if (settings.autoCheck) {
      const correct = state.grid[selected] === state.solution[selected];
      if (correct) {
        sound.correct();
      } else {
        sound.error();
        view.animateCell(selected, "shake");
      }
    } else {
      sound.place();
    }
  }
  function eraseSelected() {
    if (selected === null) return;
    if (eraseCell(state, selected)) {
      renderAll();
      persist();
    }
  }
  function toggleAnnotationMode() {
    if (state.finished) return;
    annotationMode = !annotationMode;
    renderAll();
    view.showToast(
      annotationMode ? "Modo anota\xE7\xE3o ativado." : "Modo anota\xE7\xE3o desativado."
    );
  }
  function celebrateWin() {
    timer.pause();
    sound.win();
    persist();
    view.showWinModal(
      formatTime(state.seconds),
      DIFFICULTY_LABELS[state.difficulty]
    );
  }
  function startNewGame(difficulty) {
    view.showToast("Gerando novo jogo\u2026");
    document.body.classList.add("busy");
    window.setTimeout(() => {
      state = newGame(difficulty);
      selected = null;
      annotationMode = false;
      view.hideWinModal();
      timer.reset(0);
      timer.start();
      renderAll();
      persist();
      document.body.classList.remove("busy");
    }, 30);
  }
  function restartGame() {
    restart(state);
    selected = null;
    annotationMode = false;
    view.hideWinModal();
    timer.reset(0);
    timer.start();
    renderAll();
    persist();
    view.showToast("Puzzle reiniciado.");
  }
  function giveHint() {
    if (state.hintsLeft <= 0) {
      view.showToast("Dicas esgotadas nesta partida.", "error");
      return;
    }
    const pos = applyHint(state, selected);
    if (pos === null) {
      view.showToast("Nada para preencher.", "info");
      return;
    }
    selected = pos;
    renderAll();
    view.animateCell(pos, "pop");
    persist();
    if (state.finished) {
      celebrateWin();
    } else {
      sound.correct();
    }
  }
  function checkErrors() {
    if (state.finished) return;
    const wrong = wrongPositions(state);
    state.checkedErrors = wrong;
    renderAll();
    persist();
    if (wrong.length === 0) {
      sound.correct();
      view.showToast("Nenhum erro at\xE9 aqui! \u{1F44F}", "success");
    } else {
      sound.error();
      const plural = wrong.length > 1 ? "s" : "";
      view.showToast(
        `${wrong.length} erro${plural} encontrado${plural}.`,
        "error"
      );
    }
  }
  function solveGame() {
    if (state.finished) return;
    solveAll(state);
    selected = null;
    annotationMode = false;
    timer.pause();
    renderAll();
    persist();
    view.showToast("Puzzle resolvido com a solu\xE7\xE3o armazenada.");
  }
  query("#btn-new").addEventListener("click", () => {
    startNewGame(difficultySelect.value);
  });
  query("#btn-restart").addEventListener("click", restartGame);
  query("#btn-solve").addEventListener("click", solveGame);
  query("#btn-annotation").addEventListener(
    "click",
    toggleAnnotationMode
  );
  query("#btn-hint").addEventListener("click", giveHint);
  query("#btn-check").addEventListener("click", checkErrors);
  query("#btn-erase").addEventListener("click", eraseSelected);
  query("#btn-play-again").addEventListener("click", () => {
    startNewGame(difficultySelect.value);
  });
  query("#auto-check").addEventListener("change", (event) => {
    settings.autoCheck = event.target.checked;
    renderAll();
    persist();
  });
  query("#btn-theme").addEventListener("click", () => {
    settings.dark = !settings.dark;
    view.applySettings(settings);
    persist();
  });
  query("#btn-sound").addEventListener("click", () => {
    settings.sound = !settings.sound;
    sound.enabled = settings.sound;
    view.applySettings(settings);
    persist();
  });
  var ARROW_DELTAS = {
    ArrowUp: -9,
    ArrowDown: 9,
    ArrowLeft: -1,
    ArrowRight: 1
  };
  document.addEventListener("keydown", (event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement)
      return;
    if (event.key >= "1" && event.key <= "9") {
      inputDigit(Number(event.key));
    } else if (event.key === "Backspace" || event.key === "Delete" || event.key === "0") {
      event.preventDefault();
      eraseSelected();
    } else if (event.key in ARROW_DELTAS) {
      event.preventDefault();
      const next = (selected ?? 0) + (selected === null ? 0 : ARROW_DELTAS[event.key]);
      selected = Math.min(80, Math.max(0, next));
      renderAll();
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      timer.pause();
      persist();
    } else if (!state.finished) {
      timer.start();
    }
  });
  window.__sudoku = {
    getState: () => state,
    /** Preenche tudo corretamente exceto uma célula — útil para testar a vitória. */
    almostWin() {
      let kept = -1;
      for (let i = 80; i >= 0; i--) {
        if (state.grid[i] !== state.solution[i]) {
          kept = i;
          break;
        }
      }
      if (kept === -1) return;
      for (let i = 0; i < 81; i++) {
        if (i !== kept && !isFixed(state, i)) state.grid[i] = state.solution[i];
      }
      state.grid[kept] = 0;
      state.checkedErrors = [];
      renderAll();
      persist();
    }
  };
})();
