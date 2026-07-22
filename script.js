const ROWS = 6;
const COLS = 5;
const EPOCH = Date.UTC(2025, 0, 1);       // deň 0 pre výpočet denného slova
const STORAGE_KEY = "sk-wordle-daily";
const WIN_MSGS = ["Génius! 🤯", "Super!", "Skvelé!", "Výborne!", "Dobre!", "Uf, tesne! 😅"];

const VALID = new Set([...VALID_GUESSES, ...ANSWERS]);

const board = document.getElementById("board");
const keyboard = document.getElementById("keyboard");
const messageEl = document.getElementById("message");
const subtitleEl = document.getElementById("subtitle");
const shareBtn = document.getElementById("share");

let mode = "daily";           // "daily" | "practice"
let answer = "";
let guesses = []; 
let currentGuess = "";
let gameOver = false;
let won = false;
let keyStates = {};           // pismeno -> 'absent' | 'present' | 'correct'

const activeRow = () => guesses.length;

const KEY_ROWS = [
  "qwertyuiop".split(""),
  "asdfghjkl".split(""),
  ["enter", ..."zxcvbnm".split(""), "back"],
];

function todayStr() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function dailyAnswer() {
  const d = new Date();
  const utcMid = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const idx = Math.floor((utcMid - EPOCH) / 86400000);
  const i = ((idx % ANSWERS.length) + ANSWERS.length) % ANSWERS.length;
  return ANSWERS[i];
}

function saveDaily() {
  if (mode !== "daily") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      date: todayStr(),
      guesses: guesses.map((g) => g.word),
      status: gameOver ? (won ? "won" : "lost") : "playing",
    }));
  } catch (e) { /* localStorage nedostupne - hra beží ďalej */ }
}

function loadDaily() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return data && data.date === todayStr() ? data : null;
  } catch (e) { return null; }
}

function startDaily() {
  mode = "daily";
  answer = dailyAnswer();
  resetState();
  subtitleEl.textContent = "Dnešné slovo · " + todayStr();

  const saved = loadDaily();
  if (saved) {
    for (const word of saved.guesses) commitGuess(word);
  }
  if (gameOver) endGame(true);
}

function startPractice() {
  mode = "practice";
  answer = ANSWERS[Math.floor(Math.random() * ANSWERS.length)];
  resetState();
  subtitleEl.textContent = "Cvičná hra";
}

function resetState() {
  guesses = [];
  currentGuess = "";
  gameOver = false;
  won = false;
  keyStates = {};
  shareBtn.hidden = true;
  clearMessage();
  buildBoard();
  buildKeyboard();
}

function buildBoard() {
  board.innerHTML = "";
  for (let r = 0; r < ROWS; r++) {
    const row = document.createElement("div");
    row.className = "row";
    for (let c = 0; c < COLS; c++) {
      const tile = document.createElement("div");
      tile.className = "tile";
      row.appendChild(tile);
    }
    board.appendChild(row);
  }
}

function buildKeyboard() {
  keyboard.innerHTML = "";
  for (const keys of KEY_ROWS) {
    const rowEl = document.createElement("div");
    rowEl.className = "kb-row";
    for (const key of keys) {
      const btn = document.createElement("button");
      btn.className = "key";
      btn.dataset.key = key;
      if (key === "enter") { btn.textContent = "Enter"; btn.classList.add("wide"); }
      else if (key === "back") { btn.textContent = "⌫"; btn.classList.add("wide"); }
      else btn.textContent = key;
      btn.addEventListener("click", () => handleKey(key));
      rowEl.appendChild(btn);
    }
    keyboard.appendChild(rowEl);
  }
}

function handleKey(key) {
  if (gameOver) return;
  if (key === "enter") return submitGuess();
  if (key === "back") return deleteLetter();
  if (/^[a-z]$/.test(key)) return addLetter(key);
}

function addLetter(letter) {
  if (currentGuess.length >= COLS) return;
  currentGuess += letter;
  const tile = board.children[activeRow()].children[currentGuess.length - 1];
  tile.textContent = letter;
  tile.classList.add("filled");
}

function deleteLetter() {
  if (currentGuess.length === 0) return;
  const tile = board.children[activeRow()].children[currentGuess.length - 1];
  tile.textContent = "";
  tile.classList.remove("filled");
  currentGuess = currentGuess.slice(0, -1);
}

function submitGuess() {
  if (currentGuess.length < COLS) return flash("Málo písmen", true);
  if (!VALID.has(currentGuess)) return flash("Slovo nie je v zozname", true);

  commitGuess(currentGuess);
  currentGuess = "";
  saveDaily();
  if (gameOver) endGame();
}

function commitGuess(word) {
  const result = evaluateGuess(word, answer);
  const row = activeRow();
  guesses.push({ word, result });
  paintRow(row, word, result);

  if (word === answer) { gameOver = true; won = true; }
  else if (guesses.length >= ROWS) { gameOver = true; won = false; }
}

function endGame(restored = false) {
  endMessage();
  shareBtn.hidden = false;
}

function endMessage() {
  showMessage(won ? (WIN_MSGS[guesses.length - 1] || "Výborne!")
                  : "Slovo bolo: " + answer.toUpperCase());
}

function evaluateGuess(guess, answer) {
  const result = new Array(COLS).fill("absent");
  const answerChars = answer.split("");
  const used = new Array(COLS).fill(false);

  for (let i = 0; i < COLS; i++) {
    if (guess[i] === answerChars[i]) { result[i] = "correct"; used[i] = true; }
  }
  for (let i = 0; i < COLS; i++) {
    if (result[i] === "correct") continue;
    for (let j = 0; j < COLS; j++) {
      if (!used[j] && guess[i] === answerChars[j]) {
        result[i] = "present";
        used[j] = true;
        break;
      }
    }
  }
  return result;
}

function paintRow(row, word, result) {
  const rowEl = board.children[row];
  for (let c = 0; c < COLS; c++) {
    const tile = rowEl.children[c];
    tile.textContent = word[c];
    tile.classList.add("filled", result[c]);
    updateKeyState(word[c], result[c]);
  }
}

function updateKeyState(letter, state) {
  const rank = { absent: 0, present: 1, correct: 2 };
  if (keyStates[letter] && rank[keyStates[letter]] >= rank[state]) return;
  keyStates[letter] = state;
  const keyEl = keyboard.querySelector(`[data-key="${letter}"]`);
  if (keyEl) {
    keyEl.classList.remove("absent", "present", "correct");
    keyEl.classList.add(state);
  }
}

function buildShareText() {
  const score = won ? guesses.length : "X";
  const header = mode === "daily"
    ? `Slovko · ${todayStr()} · ${score}/${ROWS}`
    : `Slovko (cvičná) · ${score}/${ROWS}`;
  const grid = guesses
    .map((g) => g.result.map((s) =>
      s === "correct" ? "🟩" : s === "present" ? "🟨" : "⬜").join(""))
    .join("\n");
  return header + "\n\n" + grid;
}

async function share() {
  const text = buildShareText();
  try {
    await navigator.clipboard.writeText(text);
    flash("Skopírované do schránky");
  } catch (e) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      flash("Skopírované do schránky");
    } catch (e2) {
      flash("Nepodarilo sa skopírovať");
    }
    ta.remove();
  }
}

let flashTimer = null;

function showMessage(text) {
  messageEl.innerHTML = `<span class="toast">${text}</span>`;
}

function clearMessage() {
  messageEl.innerHTML = "";
}

function flash(text, shake = false) {
  showMessage(text);
  if (shake) {
    const row = board.children[activeRow()];
    if (row) {
      row.classList.add("shake");
      setTimeout(() => row.classList.remove("shake"), 400);
    }
  }
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => (gameOver ? endMessage() : clearMessage()), 1200);
}

// --- Klávesnica + tlačidlá ---
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleKey("enter");
  else if (e.key === "Backspace") handleKey("back");
  else if (/^[a-zA-Z]$/.test(e.key)) handleKey(e.key.toLowerCase());
});

document.getElementById("new-game").addEventListener("click", startPractice);
shareBtn.addEventListener("click", share);

startDaily();
