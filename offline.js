// Closed-form damped spring: independent of display refresh rate and restart-free.
function stepSpring(state, target, dt, frequency = 24, damping = 0.8) {
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
function stepLiquidEdges(edges, target, width, dt, direction = 1) {
  let { left, right } = edges;
  const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
  const step = dt / steps;
  for (let i = 0; i < steps; i++) {
    if (direction > 0) {
      const previous = right.position;
      right = stepSpring(right, target + width / 2, step, 32, 0.84);
      left = stepSpring(left, (previous + right.position) / 2 - width, step, 20, 0.84);
    } else {
      const previous = left.position;
      left = stepSpring(left, target - width / 2, step, 32, 0.84);
      right = stepSpring(right, (previous + left.position) / 2 + width, step, 20, 0.84);
    }
  }
  return { left, right };
}

function createLiquidDock(dock) {
  if (!dock) return;
  const links = [...dock.querySelectorAll('.dock-item')];
  const sections = links.map(link => document.querySelector(link.getAttribute('href')));
  const lens = dock.querySelector('.dock-lens');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let centers = [], lensWidth = 0, activeIndex = 0, target = 0, direction = 1;
  let edges = { left: { position: 0, velocity: 0 }, right: { position: 0, velocity: 0 } };
  let press = { position: 0, velocity: 0 }, pressTarget = 0;
  let dockSpring = { position: 0, velocity: 0 }, pastHero = null;
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
    const scaleY = 1 - Math.min(Math.max(stretch - 1, 0), 2) * 0.10 + pressure * 0.075;
    lens.style.transform = `translate3d(${(center() - lensWidth / 2).toFixed(3)}px,${(-pressure * 2).toFixed(3)}px,0) scale(${scaleX.toFixed(4)},${scaleY.toFixed(4)})`;
    // Counter-scale the corner radii so the stretched glass keeps rounded ends.
    lens.style.setProperty('--lens-scale-x', scaleX.toFixed(4));
    lens.style.setProperty('--lens-scale-y', scaleY.toFixed(4));
    lens.style.setProperty('--lens-energy', (0.58 + pressure * 0.27 + energy * 0.15).toFixed(3));
    if (!pointer) lens.style.setProperty('--lens-light', `${clamp(30 + velocity / 65, 12, 87)}%`);
    dock.style.setProperty('--dock-lift', `${dockSpring.position.toFixed(3)}px`);
  }
  function tick(now) {
    frame = 0;
    const dt = Math.min((now - (lastTime || now - 1000 / 60)) / 1000, 0.05);
    lastTime = now;
    edges = stepLiquidEdges(edges, target, lensWidth, dt, direction);
    press = stepSpring(press, pressTarget, dt, 29, 0.82);
    dockSpring = stepSpring(dockSpring, 0, dt, 19, 0.64);
    render();
    if (pointer || !settled(edges.left, target - lensWidth / 2) || !settled(edges.right, target + lensWidth / 2) || !settled(press, pressTarget) || !settled(dockSpring, 0)) frame = requestAnimationFrame(tick);
    else { rest(); press = { position: pressTarget, velocity: 0 }; dockSpring = { position: 0, velocity: 0 }; lastTime = 0; render(); }
  }
  function animate() {
    if (reduced.matches) {
      if (frame) cancelAnimationFrame(frame);
      frame = 0; lastTime = 0; rest(); press = { position: 0, velocity: 0 }; dockSpring = { position: 0, velocity: 0 }; render();
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
  function updateScrollGlass(allowSpring = true) {
    const heroBottom = sections[0].getBoundingClientRect().bottom;
    // A small return margin prevents repeated pulses at the hero boundary.
    const next = pastHero ? heroBottom < 48 : heroBottom <= 0;
    if (next === pastHero) return;
    const leavingHero = pastHero === false && next;
    pastHero = next;
    dock.classList.toggle('is-scrolled', next);
    if (leavingHero && allowSpring && !reduced.matches && !document.hidden) {
      // An impulse preserves the current position if the motion is interrupted.
      dockSpring.velocity = Math.max(-420, dockSpring.velocity - 360);
      animate();
    }
  }
  function updateFromScroll() {
    scrollFrame = 0;
    // Glass and the hero-exit spring also respond during a tab's smooth scroll.
    updateScrollGlass();
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
    updateScrollGlass(false); render(); animate();
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


'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const services = {
  "brand": {
    "title": [
      "Design the journey.",
      "Define the details."
    ],
    "description": "Approve user flows, layouts, typography and interactions before implementation. Give AI a clear design system and acceptance criteria to work from.",
    "tags": [
      "User journeys",
      "Design system",
      "Interactive prototype"
    ],
    "cta": "Discuss design direction",
    "interest": "Design direction",
    "icon": "spark"
  },
  "web": {
    "title": [
      "Design-led websites.",
      "Built with AI."
    ],
    "description": "Create brand sites and campaign experiences from approved designs. AI helps implement components and responsive layouts; people check content, accessibility, performance and forms.",
    "tags": [
      "Brand websites",
      "Responsive UI",
      "Content & forms"
    ],
    "cta": "Discuss website development",
    "interest": "Website development",
    "icon": "globe"
  },
  "social": {
    "title": [
      "Useful workflows.",
      "Connected web apps."
    ],
    "description": "Build portals, booking tools and dashboards around real user tasks. AI helps with screens, logic and integrations; engineers review permissions, data handling and complete workflows.",
    "tags": [
      "Client portals",
      "Dashboards",
      "API integrations"
    ],
    "cta": "Discuss web app development",
    "interest": "Web app development",
    "icon": "chat"
  },
  "growth": {
    "title": [
      "Designed for touch.",
      "Ready for real life."
    ],
    "description": "Create focused mobile experiences for booking, loyalty and services. AI assists implementation; the team validates device behaviour, connectivity, permissions and release readiness.",
    "tags": [
      "Mobile journeys",
      "App interfaces",
      "Device testing"
    ],
    "cta": "Discuss mobile development",
    "interest": "Mobile app development",
    "icon": "grid"
  },
  "film": {
    "title": [
      "Brief. Build. Review.",
      "Then refine."
    ],
    "description": "Give the agent one scoped task with designs, project context and acceptance checks. Review its plan and code, run tests, inspect the preview and iterate before approving the change.",
    "tags": [
      "Scoped tasks",
      "AI coding agents",
      "Human review"
    ],
    "cta": "Discuss the agentic workflow",
    "interest": "Agentic workflow",
    "icon": "play"
  },
  "events": {
    "title": [
      "Speed with purpose.",
      "Quality by design."
    ],
    "description": "Measure delivery time, rework, defects and total cost. Keep design approval, code review, workflow testing and a named release owner before expanding beyond the pilot.",
    "tags": [
      "Quality gates",
      "Release checks",
      "Measured outcomes"
    ],
    "cta": "Discuss quality & delivery",
    "interest": "Quality & delivery",
    "icon": "studio"
  }
};
const serviceTabs = $$('.service-tab');
function activateService(tab, focus = false) {
  const service = services[tab.dataset.service];
  serviceTabs.forEach(t => { const active = t === tab; t.classList.toggle('selected', active); t.setAttribute('aria-selected', String(active)); t.tabIndex = active ? 0 : -1; });
  $('#service-panel').setAttribute('aria-labelledby', tab.id);
  const heading = $('#service-title'); heading.replaceChildren(document.createTextNode(service.title[0]), document.createElement('br'), document.createTextNode(service.title[1]));
  $('#service-description').textContent = service.description;
  $('#service-counter').textContent = `0${serviceTabs.indexOf(tab) + 1} / 06`;
  $('#service-icon-use').setAttribute('href', '#i-' + service.icon);
  $('#service-tags').replaceChildren(...service.tags.map(label => { const el = document.createElement('span'); el.textContent = label; return el; }));
  const cta = $('#service-enquire'); cta.firstChild.textContent = service.cta + ' '; cta.dataset.interest = service.interest;
  if (focus) tab.focus();
}
serviceTabs.forEach((tab, index) => {
  tab.addEventListener('click', () => activateService(tab));
  tab.addEventListener('keydown', e => { let next; if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = (index + 1) % serviceTabs.length; else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = (index - 1 + serviceTabs.length) % serviceTabs.length; else if (e.key === 'Home') next = 0; else if (e.key === 'End') next = serviceTabs.length - 1; if (next !== undefined) { e.preventDefault(); activateService(serviceTabs[next], true); } });
});
createLiquidDock($('.dock'));
function updateTime() { $('#kochi-time').textContent = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()); }
updateTime(); setInterval(updateTime, 60000); $('#year').textContent = new Date().getFullYear();
const dialog = $('#enquiry-dialog'); const form = $('#enquiry-form'); const ready = $('#enquiry-ready'); let returnFocus;
$$('[data-enquire]').forEach(button => button.addEventListener('click', () => { returnFocus = button; form.hidden = false; ready.hidden = true; if (button.dataset.interest) $('#enquiry-service').value = button.dataset.interest; dialog.showModal(); document.body.classList.add('dialog-open'); }));
function closeDialog() { dialog.close(); }
$('.dialog-close').addEventListener('click', closeDialog);
dialog.addEventListener('click', e => { if (e.target === dialog) { const rect = dialog.getBoundingClientRect(); if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) closeDialog(); } });
dialog.addEventListener('close', () => { document.body.classList.remove('dialog-open'); returnFocus?.focus(); });
form.addEventListener('submit', e => { e.preventDefault(); if (!form.reportValidity()) return; const data = new FormData(form); const name = String(data.get('name')).trim(); const email = String(data.get('email')).trim(); const company = String(data.get('company')).trim(); const service = String(data.get('service')); const message = String(data.get('message')).trim(); if (!name || message.length < 10) { const field = !name ? form.elements.name : form.elements.message; field.setCustomValidity(!name ? 'Please enter your name.' : 'Please share at least 10 characters about your project.'); field.reportValidity(); field.addEventListener('input', () => field.setCustomValidity(''), { once: true }); return; } const body = `Hi Eleven:11,\n\n${message}\n\nInterested in: ${service}\nName: ${name}\nEmail: ${email}${company ? '\nCompany: ' + company : ''}`; $('#send-email').href = `mailto:info@eleven-11services.com?subject=${encodeURIComponent('Project enquiry — ' + (company || name))}&body=${encodeURIComponent(body)}`; $('#send-whatsapp').href = 'https://wa.me/918113811011?text=' + encodeURIComponent(body); form.hidden = true; ready.hidden = false; dialog.scrollTop = 0; $('#send-email').focus(); });
$('#edit-enquiry').addEventListener('click', () => { ready.hidden = true; form.hidden = false; form.elements.name.focus(); });

// The same enquiry preparation is available to supported browser agents.
// Sending always remains a separate visitor-controlled email or WhatsApp step.
if (document.modelContext?.registerTool) {
  const lifecycle = new AbortController();
  const tool = {
    name: 'prepare_project_enquiry',
    title: 'Prepare a project enquiry',
    description: 'Fill the visible project enquiry and prepare its email and WhatsApp options. This stages a draft only; it never sends a message.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 1, maxLength: 100 },
        email: { type: 'string', format: 'email', maxLength: 200 },
        company: { type: 'string', maxLength: 150 },
        service: { type: 'string', enum: [...$('#enquiry-service').options].map(option => option.value) },
        message: { type: 'string', minLength: 10, maxLength: 3000 }
      },
      required: ['name', 'email', 'message'],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute(input) {
      if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('An enquiry object is required.');
      const allowed = ['name', 'email', 'company', 'service', 'message'];
      if (Object.keys(input).some(key => !allowed.includes(key))) throw new Error('The enquiry contains an unsupported field.');
      for (const key of Object.keys(input)) if (typeof input[key] !== 'string') throw new Error('Enquiry fields must be text.');
      const name = (input.name || '').trim(), email = (input.email || '').trim(), company = (input.company || '').trim(), message = (input.message || '').trim();
      const service = input.service || $('#enquiry-service').options[0].value;
      const validServices = [...$('#enquiry-service').options].map(option => option.value);
      const emailProbe = document.createElement('input'); emailProbe.type = 'email'; emailProbe.required = true; emailProbe.value = email;
      if (!name || name.length > 100 || email.length > 200 || !emailProbe.checkValidity() || company.length > 150 || message.length < 10 || message.length > 3000 || !validServices.includes(service)) throw new Error('Provide a valid name, email, service and project message of 10–3000 characters.');
      for (const [key, value] of Object.entries({ name, email, company, service, message })) { form.elements[key].value = value; form.elements[key].setCustomValidity(''); }
      returnFocus = $('.header-cta'); form.hidden = false; ready.hidden = true;
      if (!dialog.open) dialog.showModal();
      document.body.classList.add('dialog-open');
      form.requestSubmit();
      if (ready.hidden) throw new Error('Please review the highlighted enquiry fields.');
      return { status: 'prepared', sent: false, nextStep: 'Review the visible draft and choose email or WhatsApp to send it.' };
    }
  };
  try { Promise.resolve(document.modelContext.registerTool(tool, { signal: lifecycle.signal })).catch(() => {}); } catch (_) { /* The regular interface remains available. */ }
  window.addEventListener('pagehide', () => lifecycle.abort(), { once: true });
}


// Preserve the original top-of-page appearance; reveal glass only on scroll.
(() => {
  const topbar = document.querySelector('.site-header');
  if (!topbar) return;
  let pending = false;
  const syncTopbar = () => {
    pending = false;
    topbar.classList.toggle('is-sticky', window.scrollY > 16);
  };
  window.addEventListener('scroll', () => {
    if (!pending) { pending = true; requestAnimationFrame(syncTopbar); }
  }, { passive: true });
  window.addEventListener('pageshow', syncTopbar);
  syncTopbar();
})();
