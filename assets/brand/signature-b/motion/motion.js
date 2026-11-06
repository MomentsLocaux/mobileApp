/* BRAND-SIGNATURE-B-002. Standalone SVG study; no application or network calls. */
(() => {
  'use strict';
  const byId = (id) => document.getElementById(id);
  const route = byId('route');
  const arrow = byId('arrow');
  const pulse = byId('pulse');
  const accent = byId('accent');
  const arrivalDot = byId('arrival-dot');
  const arrivalRing = byId('arrival-ring');
  const wordmark = byId('wordmark');
  const timeline = byId('timeline');
  const toggle = byId('toggle');
  const reduce = byId('reduce');
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const routeLength = route.getTotalLength();
  const arrowLength = arrow.getTotalLength();
  const modes = {
    signature: {
      duration: 2050, title: 'La signature', context: 'Signature d’ouverture',
      description: 'Le détour se dessine, la flèche atteint un petit point. Une onde marque l’arrivée, puis le logo reste seul.',
      note: 'Un point, une onde : le détour atteint son arrivée.'
    },
    loading: {
      duration: 2800, title: 'Le passage', context: 'Chargement · boucle',
      description: 'Le logo reste entier. Une impulsion suit la boucle et la diagonale, puis laisse un temps de respiration.',
      note: 'Une impulsion, puis une pause. Le repère reste toujours lisible.'
    },
    interaction: {
      duration: 440, title: 'L’élan', context: 'Réponse au toucher',
      description: 'Un élan très court de la partie anis vers le haut à droite, puis un retour exact au dessin d’origine.',
      note: 'Un geste bref pour accompagner le toucher.'
    }
  };
  let mode = 'signature';
  let progress = 0;
  let playing = false;
  let frame = null;
  let lastTime = null;
  let rate = 1;
  let resumeAfterVisibility = false;
  let manualReduction = false;
  let reduced = preference.matches;

  const clamp = (value) => Math.max(0, Math.min(1, value));
  const smooth = (value) => { const t = clamp(value); return t * t * (3 - 2 * t); };

  function reveal(path, length, amount) {
    // Hide the round cap at zero; remove dash rendering entirely at completion.
    path.style.opacity = amount <= 0 ? '0' : '1';
    path.style.strokeDasharray = amount >= 1 ? 'none' : `${length} ${length}`;
    path.style.strokeDashoffset = `${length * (1 - clamp(amount))}`;
  }

  function draw(value) {
    const t = clamp(value);
    accent.removeAttribute('transform');
    pulse.style.opacity = '0';
    arrivalDot.style.opacity = '0';
    arrivalRing.style.opacity = '0';
    wordmark.style.opacity = '1';
    wordmark.style.transform = 'none';
    reveal(route, routeLength, 1);
    reveal(arrow, arrowLength, 1);

    if (!reduced && mode === 'signature') {
      // Preserve the original 1 700 ms gesture, then add one 350 ms arrival.
      const signature = clamp(t * modes.signature.duration / 1700);
      // A measured loop (first 56% of path), followed by the quicker ascent.
      const trace = signature < 0.55
        ? 0.56 * smooth((signature - 0.07) / 0.48)
        : 0.56 + 0.44 * smooth((signature - 0.55) / 0.25);
      reveal(route, routeLength, trace);
      reveal(arrow, arrowLength, smooth((signature - 0.77) / 0.13));
      const text = smooth((signature - 0.72) / 0.28);
      wordmark.style.opacity = String(text);
      wordmark.style.transform = `translateY(${(1 - text) * 5}px)`;
      const arrival = clamp((t * modes.signature.duration - 1700) / 350);
      const dot = smooth(arrival / 0.15) * (1 - smooth((arrival - 0.65) / 0.35));
      const wave = smooth((arrival - 0.08) / 0.2) * (1 - smooth((arrival - 0.3) / 0.7));
      arrivalDot.style.opacity = String(dot);
      arrivalRing.style.opacity = String(wave * 0.65);
      arrivalRing.setAttribute('r', String(0.9 + 1.6 * smooth((arrival - 0.08) / 0.92)));
    } else if (!reduced && mode === 'loading') {
      // Single soft highlight moves from below the loop to above the tip.
      // Long gaps guarantee exactly one visible segment; last 30% is a rest.
      const travel = clamp((t - 0.08) / 0.62);
      const segment = routeLength * 0.15;
      pulse.style.strokeDasharray = `${segment} ${routeLength * 3}`;
      pulse.style.strokeDashoffset = String(segment - travel * (routeLength + segment));
      const fade = smooth((t - 0.08) / 0.08) * (1 - smooth((t - 0.62) / 0.08));
      pulse.style.opacity = String(fade);
    } else if (!reduced && mode === 'interaction') {
      // Less than 0.5 viewBox unit; geometry settles back exactly at 440 ms.
      const lift = t < 0.43 ? smooth(t / 0.43) : 1 - smooth((t - 0.43) / 0.57);
      accent.setAttribute('transform', `translate(${0.42 * lift} ${-0.42 * lift})`);
    }

    timeline.value = String(Math.round(t * 1000));
    byId('progress-label').value = `${Math.round(t * 100)} %`;
  }

  function stop() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    lastTime = null;
    playing = false;
    toggle.textContent = progress >= 1 ? 'Relire' : 'Lire';
  }

  function tick(now) {
    if (!playing) return;
    if (lastTime !== null) progress += ((now - lastTime) * rate) / modes[mode].duration;
    lastTime = now;
    if (progress >= 1) {
      if (mode === 'loading') progress %= 1;
      else {
        progress = 1;
        draw(progress);
        stop();
        byId('status').textContent = 'Lecture terminée. Le logo retrouve son dessin exact.';
        return;
      }
    }
    draw(progress);
    frame = requestAnimationFrame(tick);
  }

  function play(restart = false) {
    if (reduced) return;
    stop();
    if (restart || progress >= 1) progress = 0;
    playing = true;
    toggle.textContent = 'Pause';
    byId('status').textContent = mode === 'loading' ? 'Boucle en cours. Pause disponible à tout moment.' : 'Lecture en cours.';
    draw(progress);
    frame = requestAnimationFrame(tick);
  }

  function selectMode(nextMode) {
    stop();
    mode = nextMode;
    progress = reduced ? 1 : 0;
    const current = modes[mode];
    byId('mode-title').textContent = current.title;
    byId('stage-context').textContent = current.context;
    byId('duration').textContent = `${(current.duration / rate / 1000).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} s`;
    byId('mode-description').textContent = current.description;
    byId('stage-note').textContent = current.note;
    document.querySelectorAll('[data-mode]').forEach((button) => {
      const selected = button.dataset.mode === mode;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    draw(progress);
    if (!reduced && !document.hidden) play(true);
    else byId('status').textContent = reduced ? 'Logo fixe : réduction des animations activée.' : 'Lecture en pause tant que la page est masquée.';
  }

  function updateReduction() {
    reduced = manualReduction || preference.matches;
    reduce.checked = reduced;
    reduce.disabled = preference.matches;
    byId('motion-note').textContent = preference.matches
      ? 'Réduction des animations activée par votre appareil : le logo reste fixe.'
      : 'Le réglage d’accessibilité de votre appareil est aussi respecté.';
    toggle.disabled = reduced;
    byId('replay').disabled = reduced;
    timeline.disabled = reduced;
    byId('speed').disabled = reduced;
    resumeAfterVisibility = false;
    selectMode(mode);
  }

  document.querySelectorAll('[data-mode]').forEach((button) => button.addEventListener('click', () => selectMode(button.dataset.mode)));
  toggle.addEventListener('click', () => {
    if (playing) {
      stop();
      byId('status').textContent = 'Lecture en pause.';
    } else play();
  });
  byId('replay').addEventListener('click', () => play(true));
  timeline.addEventListener('input', () => {
    stop();
    progress = Number(timeline.value) / 1000;
    draw(progress);
    toggle.textContent = progress >= 1 ? 'Relire' : 'Lire';
    byId('status').textContent = 'Lecture en pause : vous explorez le tracé.';
  });
  byId('speed').addEventListener('change', (event) => {
    rate = Number(event.target.value);
    byId('speed-label').value = `${String(rate).replace('.', ',')}×`;
    byId('duration').textContent = `${(modes[mode].duration / rate / 1000).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} s`;
    lastTime = null;
  });
  byId('dark').addEventListener('change', (event) => byId('stage').classList.toggle('dark', event.target.checked));
  reduce.addEventListener('change', () => { manualReduction = reduce.checked; updateReduction(); });
  preference.addEventListener('change', updateReduction);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { resumeAfterVisibility = playing; stop(); }
    else if (resumeAfterVisibility && !reduced) { resumeAfterVisibility = false; play(); }
  });
  updateReduction();
})();
