/* ============================================================================
 * BLOCKOUT 3D — clon del Tetris tridimensional de 1989 (California Dreams)
 *
 * Mirás dentro de un pozo rectangular. Caen policubos que podés mover en el
 * plano horizontal y rotar sobre los tres ejes. Cuando una capa (un "face") se
 * llena por completo sin huecos, desaparece y todo lo de arriba cae. El juego
 * termina cuando una pieza nueva ya no entra por la boca del pozo.
 * ==========================================================================*/

(function () {
  "use strict";

  /* ----------------------- Sets de piezas (policubos) -----------------------
   * Cada pieza es una lista de celdas [x, y, z] relativas. La celda [0,0,0] es
   * el pivote de rotación. Los colores se asignan al aparecer la pieza.        */

  // FLAT: poliominós (hasta tetrominó) con grosor 1 — todos en z = 0.
  // (Como en el original, se excluye el tetrominó recto de 4 en línea.)
  const FLAT = [
    [[0, 0, 0]],                                   // monominó
    [[0, 0, 0], [1, 0, 0]],                         // dominó
    [[0, 0, 0], [1, 0, 0], [2, 0, 0]],              // trominó I
    [[0, 0, 0], [1, 0, 0], [0, 1, 0]],              // trominó L
    [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0]],   // O
    [[0, 0, 0], [1, 0, 0], [2, 0, 0], [1, 1, 0]],   // T
    [[0, 0, 0], [1, 0, 0], [2, 0, 0], [0, 1, 0]],   // L
    [[0, 0, 0], [1, 0, 0], [2, 0, 0], [2, 1, 0]],   // J
    [[1, 0, 0], [2, 0, 0], [0, 1, 0], [1, 1, 0]],   // S
    [[0, 0, 0], [1, 0, 0], [1, 1, 0], [2, 1, 0]],   // Z
  ];

  // BASIC: las 7 piezas del cubo Soma (tricubos y tetracubos de orden 3-4).
  const BASIC = [
    [[0, 0, 0], [1, 0, 0], [0, 1, 0]],                          // V (tricubo)
    [[0, 0, 0], [1, 0, 0], [2, 0, 0], [0, 1, 0]],               // L
    [[0, 0, 0], [1, 0, 0], [2, 0, 0], [1, 1, 0]],               // T
    [[0, 0, 0], [1, 0, 0], [1, 1, 0], [2, 1, 0]],               // S/Z
    [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]],               // rama (corner)
    [[1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 1, 1]],               // tornillo izq.
    [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 1, 1]],               // tornillo der.
  ];

  // EXTENDED: planas + soma + una selección de tetracubos y pentacubos 3D.
  const EXTENDED = FLAT.concat(BASIC).concat([
    [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1]],    // pirámide/base
    [[0, 0, 0], [1, 0, 0], [2, 0, 0], [1, 1, 0], [1, 0, 1]],    // cruz 3D
    [[0, 0, 0], [1, 0, 0], [2, 0, 0], [0, 0, 1], [2, 0, 1]],    // U 3D
    [[0, 0, 0], [1, 0, 0], [2, 0, 0], [2, 1, 0], [2, 1, 1]],    // escalera
    [[0, 0, 0], [1, 0, 0], [1, 1, 0], [1, 1, 1], [2, 1, 1]],    // hélice
    [[0, 0, 0], [0, 0, 1], [0, 1, 1], [1, 1, 1], [1, 1, 0]],    // serpiente 3D
    [[0, 0, 0], [1, 0, 0], [2, 0, 0], [3, 0, 0], [1, 1, 0]],    // Y (pentominó)
    [[0, 0, 0], [1, 0, 0], [1, 1, 0], [2, 1, 0], [2, 2, 0]],    // W (pentominó)
  ]);

  const SETS = { flat: FLAT, basic: BASIC, extended: EXTENDED };

  // Paleta de colores vivos para las piezas (estilo neón del original VGA).
  const PALETTE = [
    0xff4d6d, 0x21e6c1, 0x5b8cff, 0xffd34e, 0xff8c42,
    0xb388ff, 0x6bf178, 0xff5cf4, 0x4dd0ff, 0xe0e0e0,
  ];

  /* ----------------------------- Estado global ----------------------------- */
  let W = 5, D = 5, H = 12;     // ancho (x), fondo (y), alto (z) del pozo
  let pieceSet = BASIC;
  let grid;                      // grid[z][y][x] = color | null
  let piece = null;              // { cells:[[x,y,z]], color }
  let nextDef = null;            // { cells, color }
  let score = 0, faces = 0, level = 1;
  let running = false, paused = false, gameOver = false;
  let dropTimer = 0, dropInterval = 800, softDrop = false;

  /* ------------------------------- Three.js -------------------------------- */
  let scene, camera, renderer, controls;
  let pitGroup, settledGroup, pieceGroup, shadowGroup;
  let cubeGeo, edgeGeo;

  const canvas = document.getElementById("game");
  const scoreEl = document.getElementById("score");
  const facesEl = document.getElementById("faces");
  const levelEl = document.getElementById("level");
  const overlay = document.getElementById("overlay");
  const pauseEl = document.getElementById("pause");
  const nextCanvas = document.getElementById("next");
  const nextCtx = nextCanvas.getContext("2d");

  /* =========================== Utilidades 3D ============================== */

  // Convierte una celda del pozo a coordenadas de mundo (Y es la vertical).
  function worldPos(px, py, pz) {
    return new THREE.Vector3(
      px - (W - 1) / 2,
      pz + 0.5,
      py - (D - 1) / 2
    );
  }

  function makeCube(colorHex, opacity) {
    const mat = new THREE.MeshLambertMaterial({
      color: colorHex,
      transparent: opacity != null && opacity < 1,
      opacity: opacity == null ? 1 : opacity,
    });
    const mesh = new THREE.Mesh(cubeGeo, mat);
    const edges = new THREE.LineSegments(
      edgeGeo,
      new THREE.LineBasicMaterial({ color: 0x05070f, transparent: true, opacity: 0.85 })
    );
    mesh.add(edges);
    return mesh;
  }

  function initThree() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05070f);
    scene.fog = new THREE.Fog(0x05070f, 14, 46);

    camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 200);

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    // Luces
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 0.8);
    key.position.set(6, 18, 8);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x5b8cff, 0.35);
    rim.position.set(-8, 6, -10);
    scene.add(rim);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.enablePan = false;
    controls.minDistance = 8;
    controls.maxDistance = 60;
    controls.maxPolarAngle = Math.PI * 0.92;

    // Geometría compartida de los cubos (con pequeño hueco entre ellos).
    cubeGeo = new THREE.BoxGeometry(0.92, 0.92, 0.92);
    edgeGeo = new THREE.EdgesGeometry(cubeGeo);

    pitGroup = new THREE.Group();
    settledGroup = new THREE.Group();
    pieceGroup = new THREE.Group();
    shadowGroup = new THREE.Group();
    scene.add(pitGroup, settledGroup, pieceGroup, shadowGroup);

    window.addEventListener("resize", onResize);
    renderer.setAnimationLoop(loop);
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // Dibuja el pozo: rejilla del suelo, aristas verticales y anillos por capa
  // (los anillos ayudan muchísimo a juzgar la profundidad).
  function buildPit() {
    while (pitGroup.children.length) pitGroup.remove(pitGroup.children[0]);

    const hx = W / 2, hz = D / 2;
    const lineMat = new THREE.LineBasicMaterial({ color: 0x2a3c66 });
    const ringMat = new THREE.LineBasicMaterial({ color: 0x17223f, transparent: true, opacity: 0.6 });

    // Anillos horizontales en cada nivel (incluida la boca y el suelo).
    for (let z = 0; z <= H; z++) {
      const y = z;
      const pts = [
        new THREE.Vector3(-hx, y, -hz), new THREE.Vector3(hx, y, -hz),
        new THREE.Vector3(hx, y, hz), new THREE.Vector3(-hx, y, hz),
        new THREE.Vector3(-hx, y, -hz),
      ];
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      pitGroup.add(new THREE.LineSegments(toSegments(g), z === 0 || z === H ? lineMat : ringMat));
    }

    // Aristas verticales de las 4 esquinas.
    const corners = [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]];
    corners.forEach(([x, zc]) => {
      const g = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x, 0, zc), new THREE.Vector3(x, H, zc),
      ]);
      pitGroup.add(new THREE.Line(g, lineMat));
    });

    // Rejilla del suelo (W x D) para ubicar el punto de aterrizaje.
    const floorMat = new THREE.LineBasicMaterial({ color: 0x223457 });
    for (let i = 0; i <= W; i++) {
      const x = i - hx;
      const g = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x, 0.01, -hz), new THREE.Vector3(x, 0.01, hz),
      ]);
      pitGroup.add(new THREE.Line(g, floorMat));
    }
    for (let j = 0; j <= D; j++) {
      const z = j - hz;
      const g = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-hx, 0.01, z), new THREE.Vector3(hx, 0.01, z),
      ]);
      pitGroup.add(new THREE.Line(g, floorMat));
    }

    // Suelo semitransparente para dar sensación de fondo.
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(W, D),
      new THREE.MeshBasicMaterial({ color: 0x0a1430, transparent: true, opacity: 0.55 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    pitGroup.add(floor);

    // Coloca la cámara mirando hacia dentro del pozo (vista picada clásica).
    const reach = Math.max(W, D);
    camera.position.set(reach * 0.25, H + reach * 1.15, D * 1.05 + 3);
    controls.target.set(0, H * 0.42, 0);
    controls.update();
  }

  // r128: LineSegments necesita pares de puntos; convertimos la polilínea.
  function toSegments(lineGeo) {
    const pos = lineGeo.attributes.position.array;
    const pts = [];
    for (let i = 0; i < pos.length - 3; i += 3) {
      pts.push(new THREE.Vector3(pos[i], pos[i + 1], pos[i + 2]));
      pts.push(new THREE.Vector3(pos[i + 3], pos[i + 4], pos[i + 5]));
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }

  /* ============================ Lógica del juego ========================== */

  function newGrid() {
    grid = [];
    for (let z = 0; z < H; z++) {
      const layer = [];
      for (let y = 0; y < D; y++) layer.push(new Array(W).fill(null));
      grid.push(layer);
    }
  }

  function randomDef() {
    const proto = pieceSet[Math.floor(Math.random() * pieceSet.length)];
    const color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
    return { cells: proto.map((c) => c.slice()), color };
  }

  function spawn() {
    const def = nextDef || randomDef();
    nextDef = randomDef();
    drawNext();

    // Centrar horizontalmente y apoyar la cima en la boca del pozo.
    const cells = def.cells.map((c) => c.slice());
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (const [x, y, z] of cells) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      maxZ = Math.max(maxZ, z);
    }
    const offX = Math.floor((W - (maxX - minX + 1)) / 2) - minX;
    const offY = Math.floor((D - (maxY - minY + 1)) / 2) - minY;
    const offZ = H - 1 - maxZ; // la celda más alta queda en la capa superior
    for (const c of cells) { c[0] += offX; c[1] += offY; c[2] += offZ; }

    piece = { cells, color: def.color };

    if (collides(piece.cells)) {
      endGame();
      return;
    }
    updatePieceMesh();
    updateShadow();
  }

  function inBounds(x, y, z) {
    return x >= 0 && x < W && y >= 0 && y < D && z >= 0 && z < H;
  }

  function collides(cells) {
    for (const [x, y, z] of cells) {
      if (x < 0 || x >= W || y < 0 || y >= D || z < 0) return true;
      if (z < H && grid[z][y][x]) return true;
    }
    return false;
  }

  function tryMove(dx, dy, dz) {
    const moved = piece.cells.map(([x, y, z]) => [x + dx, y + dy, z + dz]);
    if (collides(moved)) return false;
    piece.cells = moved;
    updatePieceMesh();
    if (dx || dy) updateShadow();
    return true;
  }

  // Rotación entera de 90° alrededor del pivote (primera celda).
  function rotate(axis) {
    const [px, py, pz] = piece.cells[0];
    const rot = piece.cells.map(([x, y, z]) => {
      let dx = x - px, dy = y - py, dz = z - pz;
      let nx, ny, nz;
      if (axis === "x") { nx = dx; ny = -dz; nz = dy; }
      else if (axis === "y") { nx = dz; ny = dy; nz = -dx; }
      else { nx = -dy; ny = dx; nz = dz; }
      return [px + nx, py + ny, pz + nz];
    });

    // Reencajar dentro de los límites horizontales y por arriba (wall kicks).
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (const [x, y, z] of rot) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      maxZ = Math.max(maxZ, z);
    }
    let sx = 0, sy = 0, sz = 0;
    if (minX < 0) sx = -minX; else if (maxX > W - 1) sx = (W - 1) - maxX;
    if (minY < 0) sy = -minY; else if (maxY > D - 1) sy = (D - 1) - maxY;
    if (maxZ > H - 1) sz = (H - 1) - maxZ;
    const fixed = rot.map(([x, y, z]) => [x + sx, y + sy, z + sz]);

    if (collides(fixed)) return false;
    piece.cells = fixed;
    updatePieceMesh();
    updateShadow();
    return true;
  }

  function hardDrop() {
    while (tryMove(0, 0, -1)) { /* baja hasta tocar */ }
    lock();
  }

  function lock() {
    for (const [x, y, z] of piece.cells) {
      if (z >= 0 && z < H) grid[z][y][x] = piece.color;
    }
    const cleared = clearFaces();
    scorePiece(piece.cells.length, cleared);
    rebuildSettled();
    spawn();
  }

  // Elimina las capas completas y deja caer lo que queda encima.
  function clearFaces() {
    let cleared = 0;
    for (let z = 0; z < H; z++) {
      let full = true;
      for (let y = 0; y < D && full; y++)
        for (let x = 0; x < W; x++)
          if (!grid[z][y][x]) { full = false; break; }
      if (full) {
        grid.splice(z, 1);
        const empty = [];
        for (let y = 0; y < D; y++) empty.push(new Array(W).fill(null));
        grid.push(empty); // nueva capa vacía arriba
        cleared++;
        z--; // revisar de nuevo la misma altura
      }
    }
    return cleared;
  }

  function pitEmpty() {
    for (let z = 0; z < H; z++)
      for (let y = 0; y < D; y++)
        for (let x = 0; x < W; x++)
          if (grid[z][y][x]) return false;
    return true;
  }

  function scorePiece(numCubes, cleared) {
    score += numCubes; // pequeño premio por colocar
    if (cleared > 0) {
      faces += cleared;
      // Bonus exponencial por limpiar varias capas con una sola pieza.
      const base = W * D;
      score += base * cleared * cleared * level;
      if (pitEmpty()) score += base * 10 * level; // ¡Block Out!
      const newLevel = Math.floor(faces / 10) + 1;
      if (newLevel !== level) {
        level = newLevel;
        dropInterval = Math.max(120, 800 - (level - 1) * 60);
      }
    }
    updateHUD();
  }

  function updateHUD() {
    scoreEl.textContent = score;
    facesEl.textContent = faces;
    levelEl.textContent = level;
  }

  /* ============================ Render de mallas ========================== */

  function rebuildSettled() {
    while (settledGroup.children.length) settledGroup.remove(settledGroup.children[0]);
    for (let z = 0; z < H; z++)
      for (let y = 0; y < D; y++)
        for (let x = 0; x < W; x++) {
          const c = grid[z][y][x];
          if (c) {
            const cube = makeCube(c, 1);
            cube.position.copy(worldPos(x, y, z));
            settledGroup.add(cube);
          }
        }
  }

  function updatePieceMesh() {
    while (pieceGroup.children.length) pieceGroup.remove(pieceGroup.children[0]);
    if (!piece) return;
    for (const [x, y, z] of piece.cells) {
      const cube = makeCube(piece.color, 1);
      cube.position.copy(worldPos(x, y, z));
      pieceGroup.add(cube);
    }
  }

  // Proyecta la silueta de la pieza hacia abajo hasta donde aterrizaría.
  function updateShadow() {
    while (shadowGroup.children.length) shadowGroup.remove(shadowGroup.children[0]);
    if (!piece) return;

    let drop = 0;
    while (true) {
      const test = piece.cells.map(([x, y, z]) => [x, y, z - (drop + 1)]);
      if (collides(test)) break;
      drop++;
    }
    const landing = piece.cells.map(([x, y, z]) => [x, y, z - drop]);

    // Cubos guía translúcidos en la posición de aterrizaje.
    for (const [x, y, z] of landing) {
      const ghost = makeCube(piece.color, 0.18);
      ghost.position.copy(worldPos(x, y, z));
      shadowGroup.add(ghost);
    }
    // Sombra en el suelo del pozo (footprint), para leer la columna.
    const seen = new Set();
    for (const [x, y] of piece.cells) {
      const key = x + "," + y;
      if (seen.has(key)) continue;
      seen.add(key);
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(0.9, 0.9),
        new THREE.MeshBasicMaterial({ color: piece.color, transparent: true, opacity: 0.25 })
      );
      plane.rotation.x = -Math.PI / 2;
      const p = worldPos(x, y, 0);
      plane.position.set(p.x, 0.02, p.z);
      shadowGroup.add(plane);
    }
  }

  /* ====================== Vista previa de la siguiente ==================== */

  function drawNext() {
    const ctx = nextCtx, w = nextCanvas.width, h = nextCanvas.height;
    ctx.clearRect(0, 0, w, h);
    if (!nextDef) return;

    // Proyección isométrica simple de los cubos.
    const cells = nextDef.cells;
    let cx = 0, cy = 0, cz = 0;
    for (const [x, y, z] of cells) { cx += x; cy += y; cz += z; }
    cx /= cells.length; cy /= cells.length; cz /= cells.length;

    const s = 16;
    const iso = (x, y, z) => ({
      px: w / 2 + (x - cx - (y - cy)) * s * 0.87,
      py: h / 2 + (x - cx + (y - cy)) * s * 0.5 - (z - cz) * s,
    });

    // Ordenar para que los cubos del fondo se dibujen primero.
    const order = cells.slice().sort((a, b) =>
      (a[0] + a[1] - a[2]) - (b[0] + b[1] - b[2]));

    const col = "#" + nextDef.color.toString(16).padStart(6, "0");
    for (const [x, y, z] of order) drawIsoCube(ctx, iso, x, y, z, col, s);
  }

  function drawIsoCube(ctx, iso, x, y, z, col, s) {
    const top = [iso(x, y, z + 1), iso(x + 1, y, z + 1), iso(x + 1, y + 1, z + 1), iso(x, y + 1, z + 1)];
    const left = [iso(x, y + 1, z), iso(x, y + 1, z + 1), iso(x, y, z + 1), iso(x, y, z)];
    const right = [iso(x + 1, y + 1, z), iso(x + 1, y + 1, z + 1), iso(x, y + 1, z + 1), iso(x, y + 1, z)];

    const face = (pts, shade) => {
      ctx.beginPath();
      ctx.moveTo(pts[0].px, pts[0].py);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].px, pts[i].py);
      ctx.closePath();
      ctx.fillStyle = shade;
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.5)";
      ctx.lineWidth = 1;
      ctx.stroke();
    };
    face(left, shadeColor(col, -0.25));
    face(right, shadeColor(col, -0.45));
    face(top, col);
  }

  function shadeColor(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = Math.max(0, Math.min(255, Math.round(r + r * amt)));
    g = Math.max(0, Math.min(255, Math.round(g + g * amt)));
    b = Math.max(0, Math.min(255, Math.round(b + b * amt)));
    return "rgb(" + r + "," + g + "," + b + ")";
  }

  /* ============================== Bucle / tiempo ========================= */

  let lastTime = 0;
  function loop(time) {
    const dt = lastTime ? time - lastTime : 16;
    lastTime = time;

    if (running && !paused && !gameOver) {
      dropTimer += dt;
      const interval = softDrop ? Math.min(60, dropInterval) : dropInterval;
      if (dropTimer >= interval) {
        dropTimer = 0;
        if (!tryMove(0, 0, -1)) lock();
      }
    }
    controls.update();
    renderer.render(scene, camera);
  }

  /* =============================== Controles ============================= */

  function onKey(e) {
    if (!running || gameOver) return;
    const k = e.key.toLowerCase();

    if (k === "p") { togglePause(); return; }
    if (paused) return;

    let handled = true;
    switch (k) {
      case "arrowleft": case "a": tryMove(-1, 0, 0); break;
      case "arrowright": case "d": tryMove(1, 0, 0); break;
      case "arrowup": case "w": tryMove(0, -1, 0); break;
      case "arrowdown": case "s": tryMove(0, 1, 0); break;
      case "q": rotate("x"); break;
      case "e": rotate("y"); break;
      case "r": rotate("z"); break;
      case "shift": softDrop = true; break;
      case " ": hardDrop(); break;
      default: handled = false;
    }
    if (handled) e.preventDefault();
  }

  function onKeyUp(e) {
    if (e.key === "Shift") softDrop = false;
  }

  function doAction(act) {
    if (!running || gameOver || paused) return;
    switch (act) {
      case "left": tryMove(-1, 0, 0); break;
      case "right": tryMove(1, 0, 0); break;
      case "up": tryMove(0, -1, 0); break;
      case "down": tryMove(0, 1, 0); break;
      case "soft": tryMove(0, 0, -1); break;
      case "rotX": rotate("x"); break;
      case "rotY": rotate("y"); break;
      case "rotZ": rotate("z"); break;
      case "drop": hardDrop(); break;
    }
  }

  function setupTouch() {
    const touch = document.getElementById("touch");
    const isTouch = window.matchMedia("(pointer: coarse)").matches;
    if (isTouch) touch.classList.remove("hidden");
    touch.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        doAction(btn.dataset.act);
      });
    });
  }

  function togglePause() {
    if (!running || gameOver) return;
    paused = !paused;
    pauseEl.classList.toggle("hidden", !paused);
  }

  /* ============================ Inicio / fin ============================= */

  function startGame() {
    const sizeSel = document.getElementById("cfg-size").value.split(",").map(Number);
    [W, D, H] = sizeSel;
    pieceSet = SETS[document.getElementById("cfg-set").value] || BASIC;

    score = 0; faces = 0; level = 1;
    dropInterval = 800; dropTimer = 0; softDrop = false;
    running = true; paused = false; gameOver = false;
    nextDef = null;

    newGrid();
    buildPit();
    rebuildSettled();
    updateHUD();
    spawn();

    overlay.classList.add("hidden");
    pauseEl.classList.add("hidden");
  }

  function endGame() {
    gameOver = true;
    running = false;
    piece = null;
    updatePieceMesh();
    while (shadowGroup.children.length) shadowGroup.remove(shadowGroup.children[0]);
    showResult();
  }

  function showResult() {
    const panel = overlay.querySelector(".panel");
    panel.querySelector(".result")?.remove();
    const res = document.createElement("div");
    res.className = "result";
    res.innerHTML =
      `<div class="big">GAME OVER<br>Puntaje<b>${score}</b>` +
      `${faces} capa${faces === 1 ? "" : "s"} eliminadas · Nivel ${level}</div>`;
    const h1 = panel.querySelector("h1");
    h1.after(res);
    document.getElementById("start").textContent = "VOLVER A JUGAR";
    overlay.classList.remove("hidden");
  }

  /* ================================ Arranque ============================= */

  function init() {
    if (!window.THREE) {
      overlay.querySelector(".tagline").textContent =
        "No se pudo cargar Three.js (¿sin conexión?). Recargá con internet para jugar.";
      return;
    }
    initThree();
    setupTouch();
    document.getElementById("start").addEventListener("click", startGame);
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
  }

  init();
})();
