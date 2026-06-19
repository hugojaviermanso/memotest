(function () {
  "use strict";

  const board = document.getElementById("board");
  const pairsEl = document.getElementById("pairs");
  const movesEl = document.getElementById("moves");
  const timeEl = document.getElementById("time");
  const restartBtn = document.getElementById("restart");
  const winOverlay = document.getElementById("win");
  const winStats = document.getElementById("win-stats");
  const playAgainBtn = document.getElementById("play-again");

  const TOTAL_PAIRS = PLAYERS.length; // 20

  let imageCache = null; // { wikiTitle: url|null }
  let deck = [];
  let firstCard = null;
  let secondCard = null;
  let lockBoard = false;
  let matched = 0;
  let moves = 0;
  let timerId = null;
  let seconds = 0;
  let started = false;

  /* ---------- Obtención de las caras desde Wikipedia ---------- */

  async function fetchPlayerImage(title) {
    const endpoints = [
      "https://en.wikipedia.org/api/rest_v1/page/summary/",
      "https://es.wikipedia.org/api/rest_v1/page/summary/",
    ];
    for (const base of endpoints) {
      try {
        const res = await fetch(base + encodeURIComponent(title), {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) continue;
        const data = await res.json();
        if (data.type === "disambiguation") continue;
        let src =
          (data.thumbnail && data.thumbnail.source) ||
          (data.originalimage && data.originalimage.source) ||
          null;
        if (src) {
          // Subimos la resolución del thumbnail para que se vea nítido en la carta.
          src = src.replace(/\/\d+px-/, "/500px-");
          return src;
        }
      } catch (e) {
        /* probamos el siguiente endpoint */
      }
    }
    return null;
  }

  async function loadAllImages() {
    if (imageCache) return imageCache;
    const cache = {};
    await Promise.all(
      PLAYERS.map(async (p) => {
        cache[p.wiki] = await fetchPlayerImage(p.wiki);
      })
    );
    imageCache = cache;
    return cache;
  }

  function showLoading() {
    const ov = document.createElement("div");
    ov.className = "loading-overlay";
    ov.id = "loading";
    ov.innerHTML =
      '<div class="spinner"></div><div>Cargando las caras de la Scaloneta…</div>';
    document.body.appendChild(ov);
  }
  function hideLoading() {
    const ov = document.getElementById("loading");
    if (ov) ov.remove();
  }

  /* ---------- Construcción del tablero ---------- */

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function buildDeck() {
    deck = [];
    PLAYERS.forEach((p, idx) => {
      const card = { id: idx, player: p };
      deck.push({ ...card });
      deck.push({ ...card });
    });
    shuffle(deck);
  }

  function faceMarkup(player) {
    const url = imageCache[player.wiki];
    const inner = url
      ? `<img src="${url}" alt="${player.name}" loading="lazy"
             onerror="this.parentNode.innerHTML = window.__fallbackFace('${player.name.replace(
               /'/g,
               "\\'"
             )}')" />`
      : window.__fallbackFace(player.name);
    return `
      <div class="card-number">${player.number}</div>
      ${inner}
      <div class="card-name">${player.name}</div>`;
  }

  // Expuesto para el handler onerror de las imágenes.
  window.__fallbackFace = function (name) {
    return `<div class="card-fallback"><div class="ball">⚽</div><div class="fb-name">${name}</div></div>`;
  };

  function renderBoard() {
    board.innerHTML = "";
    deck.forEach((entry, pos) => {
      const card = document.createElement("div");
      card.className = "card";
      card.dataset.id = entry.id;
      card.dataset.pos = pos;
      card.innerHTML = `
        <div class="card-inner">
          <div class="card-face card-back"><div class="sun"></div></div>
          <div class="card-face card-front">${faceMarkup(entry.player)}</div>
        </div>`;
      card.addEventListener("click", () => onCardClick(card));
      board.appendChild(card);
    });
  }

  /* ---------- Lógica del juego ---------- */

  function onCardClick(card) {
    if (lockBoard) return;
    if (card.classList.contains("flipped")) return;
    if (card.classList.contains("matched")) return;

    if (!started) startTimer();

    card.classList.add("flipped");

    if (!firstCard) {
      firstCard = card;
      return;
    }
    secondCard = card;
    moves++;
    movesEl.textContent = moves;
    checkMatch();
  }

  function checkMatch() {
    const isMatch = firstCard.dataset.id === secondCard.dataset.id;
    if (isMatch) {
      firstCard.classList.add("matched");
      secondCard.classList.add("matched");
      resetTurn();
      matched++;
      pairsEl.textContent = matched;
      if (matched === TOTAL_PAIRS) endGame();
    } else {
      lockBoard = true;
      setTimeout(() => {
        firstCard.classList.remove("flipped");
        secondCard.classList.remove("flipped");
        resetTurn();
      }, 850);
    }
  }

  function resetTurn() {
    firstCard = null;
    secondCard = null;
    lockBoard = false;
  }

  /* ---------- Cronómetro ---------- */

  function startTimer() {
    started = true;
    timerId = setInterval(() => {
      seconds++;
      timeEl.textContent = formatTime(seconds);
    }, 1000);
  }
  function stopTimer() {
    clearInterval(timerId);
    timerId = null;
  }
  function formatTime(s) {
    const m = String(Math.floor(s / 60)).padStart(2, "0");
    const sec = String(s % 60).padStart(2, "0");
    return `${m}:${sec}`;
  }

  /* ---------- Fin de partida ---------- */

  function endGame() {
    stopTimer();
    winStats.textContent = `Lo lograste en ${moves} movimientos y ${formatTime(
      seconds
    )}. ¡De memoria, como Messi en el Mundial!`;
    setTimeout(() => winOverlay.classList.remove("hidden"), 600);
  }

  function resetState() {
    stopTimer();
    firstCard = secondCard = null;
    lockBoard = false;
    matched = moves = seconds = 0;
    started = false;
    pairsEl.textContent = "0";
    movesEl.textContent = "0";
    timeEl.textContent = "00:00";
    winOverlay.classList.add("hidden");
  }

  function newGame() {
    resetState();
    buildDeck();
    renderBoard();
  }

  /* ---------- Arranque ---------- */

  async function init() {
    showLoading();
    await loadAllImages();
    hideLoading();
    newGame();
  }

  restartBtn.addEventListener("click", newGame);
  playAgainBtn.addEventListener("click", newGame);

  init();
})();
