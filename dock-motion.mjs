// Closed-form damped spring: independent of display refresh rate and restart-free.
export function stepSpring(state, target, dt, frequency = 24, damping = 0.8) {
  if (dt <= 0) return { ...state };
  const offset = state.position - target;
  const decay = damping * frequency;
  const oscillation = frequency * Math.sqrt(1 - damping * damping);
  const exponent = Math.exp(-decay * dt);
  const cosine = Math.cos(oscillation * dt);
  const sine = Math.sin(oscillation * dt);
  const coefficient = (state.velocity + decay * offset) / oscillation;
  const wave = offset * cosine + coefficient * sine;
  return {
    position: target + exponent * wave,
    velocity: exponent * (-decay * wave - offset * oscillation * sine + coefficient * oscillation * cosine)
  };
}

// The front rim leads; the back rim follows its moving position, not the final
// destination. Keeping both positions and velocities makes interruption seamless.
export function stepLiquidEdges(edges, target, width, dt, direction = 1) {
  let { left, right } = edges;
  const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
  const step = dt / steps;
  for (let i = 0; i < steps; i++) {
    if (direction > 0) {
      const previous = right.position;
      right = stepSpring(right, target + width / 2, step, 32, 0.84);
      left = stepSpring(left, (previous + right.position) / 2 - width, step, 28, 0.86);
    } else {
      const previous = left.position;
      left = stepSpring(left, target - width / 2, step, 32, 0.84);
      right = stepSpring(right, (previous + left.position) / 2 + width, step, 28, 0.86);
    }
  }
  return { left, right };
}

export function createLiquidDock(dock) {
  if (!dock) return;
  const links = [...dock.querySelectorAll('.dock-item')];
  const sections = links.map(link => document.querySelector(link.getAttribute('href')));
  const lens = dock.querySelector('.dock-lens');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let centers = [], lensWidth = 0, activeIndex = 0, target = 0, direction = 1;
  let edges = { left: { position: 0, velocity: 0 }, right: { position: 0, velocity: 0 } };
  let press = { position: 0, velocity: 0 }, pressTarget = 0;
  let pointer = null, frame = 0, lastTime = 0, scrollFrame = 0, navigationLock = null, ignoreClickUntil = 0;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const nearest = x => centers.reduce((best, center, index) => Math.abs(center - x) < Math.abs(centers[best] - x) ? index : best, 0);
  const settled = (value, destination) => Math.abs(value.position - destination) < 0.025 && Math.abs(value.velocity) < 0.15;
  const center = () => (edges.left.position + edges.right.position) / 2;
  function retarget(next) {
    if (next !== target) direction = Math.sign(next - center()) || direction;
    target = next;
  }
  function rest() {
    edges = { left: { position: target - lensWidth / 2, velocity: 0 }, right: { position: target + lensWidth / 2, velocity: 0 } };
  }

  function render() {
    const velocity = (edges.left.velocity + edges.right.velocity) / 2;
    const energy = reduced.matches ? 0 : Math.min(Math.abs(velocity) / 2200, 1);
    const pressure = reduced.matches ? 0 : clamp(press.position, 0, 1.1);
    const stretch = Math.max(0.85, (edges.right.position - edges.left.position) / lensWidth);
    const scaleX = stretch * (1 + pressure * 0.035);
    const scaleY = 1 - Math.min(Math.max(stretch - 1, 0), 2) * 0.08 + pressure * 0.075;
    lens.style.transform = `translate3d(${(center() - lensWidth / 2).toFixed(3)}px,${(-pressure * 2).toFixed(3)}px,0) scale(${scaleX.toFixed(4)},${scaleY.toFixed(4)})`;
    // Counter-scale the corner radii so the stretched glass keeps rounded ends.
    lens.style.setProperty('--lens-scale-x', scaleX.toFixed(4));
    lens.style.setProperty('--lens-scale-y', scaleY.toFixed(4));
    lens.style.setProperty('--lens-energy', (0.58 + pressure * 0.27 + energy * 0.15).toFixed(3));
    if (!pointer) lens.style.setProperty('--lens-light', `${clamp(30 + velocity / 65, 12, 87)}%`);
  }
  function tick(now) {
    frame = 0;
    const dt = Math.min((now - (lastTime || now - 1000 / 60)) / 1000, 0.05);
    lastTime = now;
    edges = stepLiquidEdges(edges, target, lensWidth, dt, direction);
    press = stepSpring(press, pressTarget, dt, 29, 0.82);
    render();
    if (pointer || !settled(edges.left, target - lensWidth / 2) || !settled(edges.right, target + lensWidth / 2) || !settled(press, pressTarget)) frame = requestAnimationFrame(tick);
    else { rest(); press = { position: pressTarget, velocity: 0 }; lastTime = 0; render(); }
  }
  function animate() {
    if (reduced.matches) {
      if (frame) cancelAnimationFrame(frame);
      frame = 0; lastTime = 0; rest(); press = { position: 0, velocity: 0 }; render();
    } else if (!frame && !document.hidden) { lastTime = 0; frame = requestAnimationFrame(tick); }
  }
  function preview(index = -1) { links.forEach((link, i) => link.classList.toggle('is-preview', i === index)); }
  function select(index) {
    activeIndex = index;
    links.forEach((link, i) => {
      link.classList.toggle('active', i === index);
      if (i === index) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
    });
    if (!pointer) { retarget(centers[index]); animate(); }
  }
  function updateFromScroll() {
    scrollFrame = 0;
    if (pointer) return;
    if (navigationLock && performance.now() < navigationLock.until) return;
    navigationLock = null;
    let index = 0;
    const threshold = window.innerHeight * 0.43;
    sections.forEach((section, i) => { if (section.getBoundingClientRect().top <= threshold) index = i; });
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 5) index = links.length - 1;
    if (index !== activeIndex) select(index);
  }
  function navigate(index) {
    navigationLock = { index, until: performance.now() + 1800 };
    select(index); preview();
    sections[index].scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth', block: 'start' });
    const hash = links[index].getAttribute('href');
    if (window.location.hash !== hash) { try { window.history.pushState(null, '', hash); } catch (_) {} }
  }
  function measure() {
    const previousCenters = centers, previousWidth = lensWidth;
    centers = links.map(link => link.offsetLeft + link.offsetWidth / 2);
    lensWidth = links[0].offsetWidth + 6;
    lens.style.width = `${lensWidth}px`;
    if (previousWidth) {
      // Remap an in-flight blob with the layout instead of snapping to a tab.
      const ratio = (centers.at(-1) - centers[0]) / (previousCenters.at(-1) - previousCenters[0] || 1);
      const remap = x => centers[0] + (x - previousCenters[0]) * ratio;
      edges = {
        left: { position: remap(edges.left.position + previousWidth / 2) - lensWidth / 2, velocity: edges.left.velocity * ratio },
        right: { position: remap(edges.right.position - previousWidth / 2) + lensWidth / 2, velocity: edges.right.velocity * ratio }
      };
      target = remap(target);
      if (pointer) { pointer.x = remap(pointer.x); pointer.bounds = dock.getBoundingClientRect(); }
    } else { target = centers[activeIndex]; rest(); }
    render(); animate();
  }
  function lightAt(event, bounds) {
    const x = event.clientX - bounds.left;
    dock.style.setProperty('--shine-x', `${x}px`);
    dock.style.setProperty('--shine-y', `${clamp(event.clientY - bounds.top, 0, bounds.height)}px`);
    lens.style.setProperty('--lens-light', `${clamp(50 + (x - center()) / lensWidth * 60, 8, 92)}%`);
  }
  dock.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || pointer) return;
    const bounds = dock.getBoundingClientRect();
    const x = clamp(event.clientX - bounds.left, centers[0], centers.at(-1));
    pointer = { id: event.pointerId, bounds, x, startX: event.clientX, startY: event.clientY, dragged: false };
    retarget(centers[nearest(x)]); pressTarget = 1; preview(nearest(x)); lightAt(event, bounds);
    dock.setPointerCapture(event.pointerId); animate();
  });
  dock.addEventListener('pointermove', event => {
    if (!pointer) { if (event.pointerType === 'mouse') lightAt(event, dock.getBoundingClientRect()); return; }
    if (event.pointerId !== pointer.id) return;
    const x = clamp(event.clientX - pointer.bounds.left, centers[0], centers.at(-1));
    pointer.x = x;
    if (Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) > 5) pointer.dragged = true;
    if (pointer.dragged) { event.preventDefault(); retarget(x); dock.classList.add('is-dragging'); }
    preview(nearest(x)); lightAt(event, pointer.bounds); animate();
  });
  function release(event, cancelled = false) {
    if (!pointer || event.pointerId !== pointer.id) return;
    const index = nearest(pointer.x), id = pointer.id;
    pointer = null; pressTarget = 0; dock.classList.remove('is-dragging'); preview();
    if (dock.hasPointerCapture(id)) dock.releasePointerCapture(id);
    ignoreClickUntil = performance.now() + 500;
    if (cancelled) { retarget(centers[activeIndex]); animate(); }
    else navigate(index);
  }
  dock.addEventListener('pointerup', event => release(event));
  dock.addEventListener('pointercancel', event => release(event, true));
  dock.addEventListener('lostpointercapture', event => { if (pointer) release(event, true); });
  dock.addEventListener('click', event => {
    const link = event.target.closest('.dock-item');
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (performance.now() < ignoreClickUntil && event.detail !== 0) return;
    navigate(links.indexOf(link));
  });
  links.forEach((link, index) => {
    link.draggable = false;
    link.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % links.length;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + links.length) % links.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = links.length - 1;
      if (next !== undefined) { event.preventDefault(); links[next].focus(); }
    });
    link.addEventListener('focus', () => { if (!pointer) { retarget(centers[index]); preview(index); animate(); } });
  });
  dock.addEventListener('focusout', event => { if (!dock.contains(event.relatedTarget) && !pointer) { preview(); retarget(centers[activeIndex]); animate(); } });
  window.addEventListener('scroll', () => { if (!scrollFrame) scrollFrame = requestAnimationFrame(updateFromScroll); }, { passive: true });
  window.addEventListener('scrollend', () => { navigationLock = null; updateFromScroll(); });
  window.addEventListener('hashchange', updateFromScroll);
  window.addEventListener('popstate', () => { navigationLock = null; requestAnimationFrame(updateFromScroll); });
  window.addEventListener('resize', measure, { passive: true });
  reduced.addEventListener('change', animate);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && frame) { cancelAnimationFrame(frame); frame = 0; lastTime = 0; }
    else if (!document.hidden) animate();
  });
  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(measure);
    [dock, ...links].forEach(element => observer.observe(element));
  }
  measure(); updateFromScroll();
}
