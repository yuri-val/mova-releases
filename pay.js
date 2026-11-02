// Buy, thank-you, key recovery and contact forms (stage 19). They talk to the
// payments server (server/, ADR-0009); texts and the API address come from the
// #page-data JSON the build writes into each page. For a local server:
//   http://localhost:8766/buy/?api=http://127.0.0.1:8787   (local preview only)
(() => {
  const dataEl = document.getElementById('page-data');
  if (!dataEl) return;
  const data = JSON.parse(dataEl.textContent);
  const t = data.messages;
  const params = new URLSearchParams(location.search);
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  // Local preview only: ?api= points the forms at a local or test server and is
  // remembered for this tab, because monobank redirects back without it.
  let api = data.api;
  if (local) {
    try {
      if (params.get('api')) sessionStorage.setItem('api', params.get('api'));
      api = sessionStorage.getItem('api') || api;
    } catch (e) {
      api = params.get('api') || api;
    }
  }
  const KEY = /^(MOVA)?[0-9A-HJKMNP-TV-Z]{16}$/;

  const normaliseKey = (raw) => raw.toUpperCase().replace(/[\s-]/g, '');
  const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

  async function post(path, body) {
    const response = await fetch(api + path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    let json = {};
    try { json = await response.json(); } catch (e) { /* 202 and 204 have no body */ }
    return { status: response.status, body: json };
  }

  function status(form, text, kind) {
    const el = form.querySelector('[data-status]');
    if (!el) return;
    el.textContent = text || '';
    el.dataset.kind = kind || '';
  }

  /* Buy */
  const buy = document.querySelector('[data-buy-form]');
  if (buy) {
    const edition = params.get('edition');
    const radio = edition && buy.querySelector(`input[name="edition"][value="${CSS.escape(edition)}"]`);
    if (radio) radio.checked = true;
    const keyParam = params.get('key');
    if (keyParam) {
      buy.querySelector('[data-upgrade]').open = true;
      buy.elements.upgradeKey.value = keyParam;
    }
    buy.addEventListener('submit', async (event) => {
      event.preventDefault();
      const email = buy.elements.email.value.trim();
      const upgrade = buy.querySelector('[data-upgrade]').open ? normaliseKey(buy.elements.upgradeKey.value) : '';
      if (!validEmail(email)) return status(buy, t.err_email, 'error');
      if (upgrade && !KEY.test(upgrade)) return status(buy, t.err_key, 'error');
      if (!buy.elements.consent.checked) return status(buy, t.err_consent, 'error');
      const button = buy.querySelector('[data-pay]');
      button.disabled = true;
      status(buy, t.redirecting);
      const body = { edition: buy.elements.edition.value, email, lang: data.lang };
      if (upgrade) body.upgradeKey = upgrade;
      try {
        const { status: code, body: answer } = await post('/v1/checkout', body);
        if (code === 200 && answer.url) { location.href = answer.url; return; }
        const messages = {
          400: t.err_email,
          404: t.err_invalid_key,
          410: t.err_revoked,
          409: t.err_not_upgrade.replace('{edition}', t.editions[answer.edition] || answer.edition),
        };
        status(buy, messages[code] || t.err_payment, 'error');
      } catch (e) {
        status(buy, t.err_network, 'error');
      }
      button.disabled = false;
    });
  }

  /* Thank-you page: poll the order until the bank has decided. */
  const thanks = document.querySelector('[data-thanks]');
  if (thanks) {
    const show = (state) => thanks.querySelectorAll('[data-state]').forEach((el) => { el.hidden = el.dataset.state !== state; });
    const order = params.get('order');
    if (!order || !/^[0-9a-f]{32}$/.test(order)) { show('unknown'); return; }
    const started = Date.now();
    const poll = async () => {
      try {
        const response = await fetch(`${api}/v1/order/${order}`);
        if (response.status === 404) return show('unknown');
        const answer = await response.json();
        if (answer.status === 'success' && answer.kind === 'upgrade') return show('upgraded');
        if (answer.status === 'success' && answer.key) {
          thanks.querySelector('[data-key]').textContent = answer.key;
          thanks.querySelector('[data-activate]').href = `mova://activate?key=${encodeURIComponent(answer.key)}`;
          return show('success');
        }
        if (['failure', 'expired', 'reversed'].includes(answer.status)) return show('failed');
      } catch (e) { /* keep trying */ }
      if (Date.now() - started > 3 * 60 * 1000) return show('slow');
      setTimeout(poll, 2500);
    };
    thanks.querySelector('[data-copy]')?.addEventListener('click', async (event) => {
      try {
        await navigator.clipboard.writeText(thanks.querySelector('[data-key]').textContent);
        event.currentTarget.textContent = t.copied;
      } catch (e) { /* the key stays selectable */ }
    });
    poll();
  }

  /* Recover */
  const recover = document.querySelector('[data-recover-form]');
  recover?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = recover.elements.email.value.trim();
    if (!validEmail(email)) return status(recover, t.err_email, 'error');
    status(recover, t.sending);
    try {
      const { status: code } = await post('/v1/recover', { email, lang: data.lang });
      status(recover, code === 202 ? t.sent_recover : t.err_email, code === 202 ? 'ok' : 'error');
    } catch (e) {
      status(recover, t.err_network, 'error');
    }
  });

  /* Contact */
  const contact = document.querySelector('[data-contact-form]');
  contact?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const f = contact.elements;
    if (!validEmail(f.email.value)) return status(contact, t.err_email, 'error');
    if (!f.message.value.trim()) return status(contact, t.err_message, 'error');
    const button = contact.querySelector('button[type="submit"]');
    button.disabled = true;
    status(contact, t.sending);
    try {
      const { status: code } = await post('/v1/contact', {
        name: f.name.value.trim(), email: f.email.value.trim(), message: f.message.value.trim(),
        website: f.website.value, lang: data.lang,
      });
      if (code === 202) {
        contact.reset();
        status(contact, t.sent_contact, 'ok');
      } else {
        status(contact, code === 429 ? t.err_too_many : t.err_email, 'error');
      }
    } catch (e) {
      status(contact, t.err_network, 'error');
    }
    button.disabled = false;
  });
})();
