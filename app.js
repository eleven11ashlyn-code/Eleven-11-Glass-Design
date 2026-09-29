import { createLiquidDock } from './dock-motion.mjs';
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const services = {
  brand: { title: ['A brand that', 'feels like you.'], description: 'Find your voice. Make your mark. Give every touchpoint a clear, confident identity that people remember.', tags: ['Brand strategy', 'Visual identity', 'Graphic design'], cta: 'Talk about your brand', interest: 'Brand & creative', icon: 'spark' },
  web: { title: ['Your next chapter.', 'Beautifully built.'], description: 'Turn a first visit into a meaningful connection with a thoughtful website that is easy to explore and a pleasure to use.', tags: ['Website design', 'Development', 'eCommerce'], cta: 'Talk about your website', interest: 'Web experiences', icon: 'globe' },
  social: { title: ['Show up.', 'Stand for something.'], description: 'Join the right conversations with useful content and a consistent voice. Help more people discover what makes your business different.', tags: ['Social strategy', 'Content planning', 'Search optimisation'], cta: 'Talk about your presence', interest: 'Social & SEO', icon: 'chat' },
  growth: { title: ['Less guesswork.', 'More direction.'], description: 'Bring a clear strategy to every campaign. Reach the people who matter, learn from the response and make your next move with confidence.', tags: ['Google Ads', 'Meta campaigns', 'Measurement'], cta: 'Talk about your goals', interest: 'Performance marketing', icon: 'grid' },
  film: { title: ['Make them pause.', 'Make them feel.'], description: 'Some stories need to be seen. Give yours a distinctive point of view through film, photography and content made for the moment.', tags: ['Brand films', 'Ad production', 'Social video'], cta: 'Talk about your story', interest: 'Film & content', icon: 'play' },
  events: { title: ['Beyond the screen.', 'Into the moment.'], description: 'Bring people and ideas together. Shape an experience that lets your audience connect with your brand in a memorable, personal way.', tags: ['Event planning', 'Brand experiences', 'Creative direction'], cta: 'Talk about your event', interest: 'Events & experiences', icon: 'studio' }
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
