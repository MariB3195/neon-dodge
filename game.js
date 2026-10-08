(() => {
  "use strict";

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const levelEl = document.getElementById("level");
  const comboEl = document.getElementById("combo");

  const shieldLabel = document.getElementById("shieldLabel");
  const shieldFill = document.getElementById("shieldFill");

  const statusEl = document.getElementById("status");

  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayText = document.getElementById("overlayText");
  const finalScore = document.getElementById("finalScore");

  const startButton = document.getElementById("startButton");
  const pauseButton = document.getElementById("pauseButton");
  const shieldButton = document.getElementById("shieldButton");

  let width = 0;
  let height = 0;
  let pixelRatio = 1;

  let player;

  let obstacles = [];
  let gems = [];
  let particles = [];

  let score = 0;
  let best = readBest();

  let level = 1;
  let combo = 1;

  let shieldEnergy = 100;
  let shieldActive = false;

  let running = false;
  let paused = false;

  let animationFrame = 0;
  let lastTime = 0;

  let obstacleTimer = 0;
  let gemTimer = 0;

  // Tastiera
  const keys = Object.create(null);

  // Touch / pointer
  let touchActive = false;
  let touchPointerId = null;
  let touchTargetX = null;

  bestEl.textContent = best;


  // -----------------------------
  // Local storage
  // -----------------------------

  function readBest() {
    try {
      return Math.max(
        0,
        Number(localStorage.getItem("neonDodgeBest") || 0)
      );
    } catch {
      return 0;
    }
  }


  function saveBest(value) {
    try {
      localStorage.setItem(
        "neonDodgeBest",
        String(value)
      );
    } catch {
      // localStorage unavailable
    }
  }


  // -----------------------------
  // Utilities
  // -----------------------------

  function clamp(value, min, max) {
    return Math.max(
      min,
      Math.min(max, value)
    );
  }


  // Converte la posizione del pointer
  // dalla pagina alle coordinate reali del canvas.
  function getCanvasX(event) {
    const rect = canvas.getBoundingClientRect();

    if (rect.width <= 0) {
      return width / 2;
    }

    const x =
      (event.clientX - rect.left) *
      (width / rect.width);

    return clamp(
      x,
      player.width / 2,
      width - player.width / 2
    );
  }


  // -----------------------------
  // Canvas
  // -----------------------------

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();

    pixelRatio = Math.min(
      window.devicePixelRatio || 1,
      2
    );

    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);

    canvas.width =
      Math.floor(width * pixelRatio);

    canvas.height =
      Math.floor(height * pixelRatio);

    ctx.setTransform(
      pixelRatio,
      0,
      0,
      pixelRatio,
      0,
      0
    );

    if (player) {
      player.y = height - 43;

      player.x = clamp(
        player.x,
        player.width / 2,
        width - player.width / 2
      );

      if (touchTargetX !== null) {
        touchTargetX = clamp(
          touchTargetX,
          player.width / 2,
          width - player.width / 2
        );
      }
    }

    draw();
  }


  // -----------------------------
  // Game state
  // -----------------------------

  function resetGame() {
    score = 0;
    level = 1;
    combo = 1;

    shieldEnergy = 100;
    shieldActive = false;

    obstacles = [];
    gems = [];
    particles = [];

    touchActive = false;
    touchPointerId = null;
    touchTargetX = null;

    player = {
      x: width / 2,
      y: height - 43,

      width: 28,
      height: 18,

      speed: 350
    };

    updateHud();
  }


  function updateHud() {
    scoreEl.textContent = score;
    bestEl.textContent = best;
    levelEl.textContent = level;

    comboEl.textContent = `x${combo}`;

    shieldLabel.textContent =
      shieldActive
        ? "ACTIVE"
        : `${Math.round(shieldEnergy)}%`;

    shieldFill.style.width =
      `${clamp(shieldEnergy, 0, 100)}%`;
  }


  // -----------------------------
  // Spawning
  // -----------------------------

  function spawnObstacle() {
    const size =
      15 + Math.random() * 25;

    obstacles.push({
      x:
        Math.random() *
        Math.max(1, width - size),

      y: -size,

      width: size,
      height: size,

      speed:
        135 +
        level * 19 +
        Math.random() * 85,

      rotation:
        Math.random() * Math.PI * 2
    });
  }


  function spawnGem() {
    gems.push({
      x:
        12 +
        Math.random() *
        Math.max(1, width - 24),

      y: -12,

      radius: 7,

      speed:
        105 +
        level * 10
    });
  }


  // -----------------------------
  // Particles
  // -----------------------------

  function burst(
    x,
    y,
    count = 12
  ) {
    for (let i = 0; i < count; i++) {
      const angle =
        Math.random() *
        Math.PI *
        2;

      const velocity =
        30 +
        Math.random() * 120;

      particles.push({
        x,
        y,

        vx:
          Math.cos(angle) *
          velocity,

        vy:
          Math.sin(angle) *
          velocity,

        life:
          0.45 +
          Math.random() * 0.45
      });
    }
  }


  // -----------------------------
  // Collision
  // -----------------------------

  function collision(a, b) {
    return (
      a.x - a.width / 2 <
        b.x + b.width &&

      a.x + a.width / 2 >
        b.x &&

      a.y - a.height / 2 <
        b.y + b.height &&

      a.y + a.height / 2 >
        b.y
    );
  }


  function gemHit(gem) {
    return (
      Math.hypot(
        player.x - gem.x,
        player.y - gem.y
      ) < 18
    );
  }


  // -----------------------------
  // Start / end
  // -----------------------------

  function startGame() {
    cancelAnimationFrame(animationFrame);

    resetGame();

    running = true;
    paused = false;

    pauseButton.textContent = "Pause";

    overlay.classList.add("hidden");

    finalScore.hidden = true;

    statusEl.textContent =
      "Go! Dodge obstacles and collect crystals.";

    lastTime = performance.now();

    animationFrame =
      requestAnimationFrame(loop);
  }


  function endGame() {
    running = false;
    paused = false;

    touchActive = false;
    touchPointerId = null;
    touchTargetX = null;

    cancelAnimationFrame(animationFrame);

    const record = score > best;

    if (record) {
      best = score;
      saveBest(best);
    }

    overlayTitle.textContent =
      "GAME OVER";

    overlayText.textContent =
      record
        ? "New record! You just beat your previous best."
        : "Nice run. Can you beat the record?";

    finalScore.textContent =
      `${score} pts`;

    finalScore.hidden = false;

    startButton.textContent =
      "Play again";

    overlay.classList.remove("hidden");

    statusEl.textContent =
      record
        ? "New high score!"
        : "Game over. Press Play again to retry.";

    updateHud();
  }


  // -----------------------------
  // Pause
  // -----------------------------

  function togglePause() {
    if (!running) {
      return;
    }

    paused = !paused;

    if (paused) {
      // Evita che il touch rimanga "agganciato"
      // mentre il gioco è in pausa.
      touchActive = false;
      touchPointerId = null;
      touchTargetX = null;
    }

    pauseButton.textContent =
      paused
        ? "Resume"
        : "Pause";

    statusEl.textContent =
      paused
        ? "Game paused."
        : "Back in action!";

    if (!paused) {
      lastTime = performance.now();

      animationFrame =
        requestAnimationFrame(loop);
    }
  }


  // -----------------------------
  // Shield
  // -----------------------------

  function activateShield() {
    if (!running) return;
    if (paused) return;
    if (shieldActive) return;
    if (shieldEnergy < 35) return;

    shieldEnergy -= 35;

    shieldActive = true;

    updateHud();
  }


  // -----------------------------
  // Game loop
  // -----------------------------

  function loop(time) {
    if (!running) {
      return;
    }

    if (!paused) {
      const dt =
        Math.min(
          (time - lastTime) / 1000,
          0.032
        );

      lastTime = time;

      update(dt);
      draw();
    }

    animationFrame =
      requestAnimationFrame(loop);
  }


  // -----------------------------
  // Update
  // -----------------------------

  function update(dt) {

    const keyboard =
      (
        keys.ArrowLeft ||
        keys.a ||
        keys.A
          ? -1
          : 0
      ) +
      (
        keys.ArrowRight ||
        keys.d ||
        keys.D
          ? 1
          : 0
      );


    // -----------------------------
    // Player movement
    // -----------------------------

    if (touchActive && touchTargetX !== null) {

      /*
       * MOBILE:
       * Il player segue direttamente il dito.
       *
       * Non usiamo più:
       * direction = -1 / +1
       *
       * perché quel sistema faceva muovere
       * la navicella a velocità fissa.
       *
       * Ora touchTargetX contiene la posizione
       * esatta del dito sul canvas.
       */

      const targetX = clamp(
        touchTargetX,
        player.width / 2,
        width - player.width / 2
      );

      /*
       * Interpolazione molto rapida.
       *
       * 30 = quasi immediato.
       * A differenza del vecchio sistema,
       * il player non "insegue" una direzione.
       */

      const followSpeed = 30;

      player.x +=
        (targetX - player.x) *
        Math.min(
          1,
          followSpeed * dt
        );

    } else {

      // PC / tastiera
      player.x = clamp(
        player.x +
          keyboard *
          player.speed *
          dt,

        player.width / 2,

        width -
          player.width / 2
      );
    }


    obstacleTimer += dt;
    gemTimer += dt;


    // -----------------------------
    // Spawn obstacles
    // -----------------------------

    if (
      obstacleTimer >
      0.58 -
      Math.min(
        0.27,
        level * 0.015
      )
    ) {

      spawnObstacle();

      obstacleTimer = 0;
    }


    // -----------------------------
    // Spawn gems
    // -----------------------------

    if (gemTimer > 2.2) {

      spawnGem();

      gemTimer = 0;
    }


    // -----------------------------
    // Move obstacles
    // -----------------------------

    obstacles.forEach((obstacle) => {

      obstacle.y +=
        obstacle.speed * dt;

      obstacle.rotation +=
        dt * 2;
    });


    // -----------------------------
    // Move gems
    // -----------------------------

    gems.forEach((gem) => {

      gem.y +=
        gem.speed * dt;
    });


    // -----------------------------
    // Move particles
    // -----------------------------

    particles.forEach((particle) => {

      particle.x +=
        particle.vx * dt;

      particle.y +=
        particle.vy * dt;

      particle.vy +=
        60 * dt;

      particle.life -= dt;
    });


    // -----------------------------
    // Remove objects
    // -----------------------------

    obstacles =
      obstacles.filter(
        obstacle =>
          obstacle.y <
          height + 50
      );

    gems =
      gems.filter(
        gem =>
          gem.y <
          height + 30
      );

    particles =
      particles.filter(
        particle =>
          particle.life > 0
      );


    // -----------------------------
    // Obstacle collision
    // -----------------------------

    for (
      let i = obstacles.length - 1;
      i >= 0;
      i--
    ) {

      if (
        !collision(
          player,
          obstacles[i]
        )
      ) {
        continue;
      }


      if (shieldActive) {

        burst(
          player.x,
          player.y,
          18
        );

        obstacles.splice(i, 1);

        score += 5;

      } else {

        endGame();

        return;
      }
    }


    // -----------------------------
    // Gem collection
    // -----------------------------

    for (
      let i = gems.length - 1;
      i >= 0;
      i--
    ) {

      if (!gemHit(gems[i])) {
        continue;
      }

      gems.splice(i, 1);

      score +=
        25 * combo;

      combo =
        Math.min(
          9,
          combo + 1
        );

      shieldEnergy =
        Math.min(
          100,
          shieldEnergy + 18
        );

      burst(
        player.x,
        player.y,
        14
      );
    }


    // -----------------------------
    // Passive score
    // -----------------------------

    score +=
      Math.floor(
        dt *
        10 *
        combo
      );


    // -----------------------------
    // Level progression
    // -----------------------------

    const next =
      Math.floor(
        score / 150
      ) + 1;


    if (next > level) {

      level = next;

      burst(
        player.x,
        player.y,
        20
      );
    }


    // -----------------------------
    // Recharge shield
    // -----------------------------

    if (!shieldActive) {

      shieldEnergy =
        Math.min(
          100,
          shieldEnergy +
            dt * 1.8
        );

    } else {

      shieldEnergy -=
        dt * 28;


      if (shieldEnergy <= 0) {

        shieldEnergy = 0;

        shieldActive = false;
      }
    }


    // -----------------------------
    // Combo
    // -----------------------------

    if (
      Math.random() <
        dt * 0.55 &&
      combo > 1
    ) {

      combo--;
    }


    updateHud();
  }


  // -----------------------------
  // Drawing
  // -----------------------------

  function draw() {

    ctx.clearRect(
      0,
      0,
      width,
      height
    );


    ctx.fillStyle =
      "#080b16";

    ctx.fillRect(
      0,
      0,
      width,
      height
    );


    drawGrid();
    drawPlayer();
    drawObstacles();
    drawGems();
    drawParticles();
  }


  function drawGrid() {

    ctx.strokeStyle =
      "rgba(255,255,255,.045)";

    ctx.lineWidth = 1;


    for (
      let x = 0;
      x < width;
      x += 36
    ) {

      ctx.beginPath();

      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);

      ctx.stroke();
    }


    for (
      let y = 0;
      y < height;
      y += 36
    ) {

      ctx.beginPath();

      ctx.moveTo(0, y);
      ctx.lineTo(width, y);

      ctx.stroke();
    }
  }


  function drawPlayer() {

    // Glow
    ctx.fillStyle =
      "rgba(118,87,255,.09)";

    ctx.beginPath();

    ctx.arc(
      player.x,
      player.y,

      shieldActive
        ? 34
        : 18,

      0,
      Math.PI * 2
    );

    ctx.fill();


    // Shield ring
    if (shieldActive) {

      ctx.strokeStyle =
        "rgba(160,140,255,.9)";

      ctx.lineWidth = 2;

      ctx.beginPath();

      ctx.arc(
        player.x,
        player.y,
        27,
        0,
        Math.PI * 2
      );

      ctx.stroke();
    }


    // Player ship
    ctx.fillStyle =
      "#7657ff";

    ctx.beginPath();

    ctx.moveTo(
      player.x,
      player.y -
        player.height / 2
    );

    ctx.lineTo(
      player.x -
        player.width / 2,
      player.y +
        player.height / 2
    );

    ctx.lineTo(
      player.x +
        player.width / 2,
      player.y +
        player.height / 2
    );

    ctx.closePath();

    ctx.fill();
  }


  function drawObstacles() {

    obstacles.forEach(
      (obstacle) => {

        ctx.save();

        ctx.translate(
          obstacle.x +
            obstacle.width / 2,

          obstacle.y +
            obstacle.height / 2
        );

        ctx.rotate(
          obstacle.rotation
        );

        ctx.fillStyle =
          "#ff4d8d";

        ctx.fillRect(
          -obstacle.width / 2,
          -obstacle.height / 2,

          obstacle.width,
          obstacle.height
        );

        ctx.restore();
      }
    );
  }


  function drawGems() {

    gems.forEach((gem) => {

      ctx.fillStyle =
        "#42e8c3";

      ctx.beginPath();

      ctx.moveTo(
        gem.x,
        gem.y -
          gem.radius
      );

      ctx.lineTo(
        gem.x +
          gem.radius,
        gem.y
      );

      ctx.lineTo(
        gem.x,
        gem.y +
          gem.radius
      );

      ctx.lineTo(
        gem.x -
          gem.radius,
        gem.y
      );

      ctx.closePath();

      ctx.fill();
    });
  }


  function drawParticles() {

    particles.forEach(
      (particle) => {

        ctx.globalAlpha =
          Math.max(
            0,
            particle.life
          );

        ctx.fillStyle =
          "#b7aaff";

        ctx.fillRect(
          particle.x,
          particle.y,
          3,
          3
        );
      }
    );

    ctx.globalAlpha = 1;
  }


  // -----------------------------
  // Events
  // -----------------------------

  startButton.addEventListener(
    "click",
    startGame
  );

  pauseButton.addEventListener(
    "click",
    togglePause
  );

  shieldButton.addEventListener(
    "click",
    activateShield
  );


  // -----------------------------
  // Keyboard
  // -----------------------------

  window.addEventListener(
    "keydown",
    (event) => {

      if (
        [
          "ArrowLeft",
          "ArrowRight",
          "a",
          "A",
          "d",
          "D",
          " ",
          "Shift"
        ].includes(event.key)
      ) {
        event.preventDefault();
      }


      keys[event.key] = true;


      if (
        event.key === " " &&
        running
      ) {
        togglePause();
      }


      if (
        event.key === "Shift"
      ) {
        activateShield();
      }
    }
  );


  window.addEventListener(
    "keyup",
    (event) => {

      keys[event.key] = false;
    }
  );


  // -----------------------------
  // Mobile / touch
  // -----------------------------

  /*
   * IMPORTANTE:
   *
   * Prima il gioco faceva:
   *
   *     metà sinistra -> -1
   *     metà destra   -> +1
   *
   * e quindi il player si muoveva sempre
   * a velocità fissa.
   *
   * Adesso il dito determina direttamente
   * la posizione desiderata del player.
   */

  canvas.addEventListener(
    "pointerdown",
    (event) => {

      // Ignora il mouse.
      // La tastiera continua a funzionare su PC.
      if (event.pointerType === "mouse") {
        return;
      }

      event.preventDefault();

      touchActive = true;
      touchPointerId = event.pointerId;

      // Mantiene il controllo anche se il dito
      // esce leggermente dal canvas.
      try {
        canvas.setPointerCapture(
          event.pointerId
        );
      } catch {
        // Pointer capture non disponibile
      }

      touchTargetX =
        getCanvasX(event);
    },
    { passive: false }
  );


  canvas.addEventListener(
    "pointermove",
    (event) => {

      if (!touchActive) {
        return;
      }

      if (
        event.pointerId !==
        touchPointerId
      ) {
        return;
      }

      event.preventDefault();

      touchTargetX =
        getCanvasX(event);
    },
    { passive: false }
  );


  function endTouch(event) {

    if (!touchActive) {
      return;
    }

    if (
      event &&
      event.pointerId !==
      touchPointerId
    ) {
      return;
    }

    touchActive = false;

    touchPointerId = null;
    touchTargetX = null;

    if (
      event &&
      canvas.hasPointerCapture &&
      canvas.hasPointerCapture(
        event.pointerId
      )
    ) {
      try {
        canvas.releasePointerCapture(
          event.pointerId
        );
      } catch {
        // Ignore
      }
    }
  }


  canvas.addEventListener(
    "pointerup",
    endTouch
  );


  canvas.addEventListener(
    "pointercancel",
    endTouch
  );


  canvas.addEventListener(
    "lostpointercapture",
    () => {

      touchActive = false;
      touchPointerId = null;
      touchTargetX = null;
    }
  );


  window.addEventListener(
    "resize",
    resizeCanvas
  );


  // -----------------------------
  // Init
  // -----------------------------

  resizeCanvas();

  resetGame();

  draw();

})();
