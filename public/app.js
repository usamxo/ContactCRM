const API = '/api/contacts';

    const $ = (sel) => document.querySelector(sel);
    const listEl = $('#list');
    const summaryEl = $('#summary');
    const filtersEl = $('#filters');
    const statusBadge = $('#statusBadge');

    const createForm = $('#createForm');
    const editCard = $('#editCard');
    const editForm = $('#editForm');
    const resetBtn = $('#resetBtn');
    const refreshBtn = $('#refreshBtn');
    const searchInput = $('#searchInput');
    const cancelEditBtn = $('#cancelEditBtn');
    const deleteBtn = $('#deleteBtn');
    const deleteAllBtn = $('#deleteAllBtn');
    const countLabel = $('#countLabel');

    let items = [];
    let activeId = null;
    let activeFilter = { key: null, value: null };
    let activeSearch = '';

    function fmtDate(s) {
      if (!s) return '';
      const d = new Date(s);
      if (Number.isNaN(d.getTime())) return s;
      return d.toISOString().slice(0,10);
    }

    function escapeHtml(str) {
      return String(str ?? '').replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
    }

    async function api(url, options) {
      const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        ...options
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || res.statusText);
      }
      return res.json();
    }

    async function load() {
      try {
        const data = await api(API);
        items = data.items || [];
        statusBadge.textContent = 'Online';
        statusBadge.style.borderColor = 'rgba(122,162,255,.5)';
      } catch (e) {
        statusBadge.textContent = 'Offline';
        statusBadge.style.borderColor = 'rgba(255,107,107,.7)';
        console.error(e);
        items = [];
      }
      render();
    }

    function getFieldNames() {
      return Array.from(createForm.querySelectorAll('input[name]'))
        .map(i => i.name)
        .filter(n => n && n !== 'id');
    }

    function serializeForm(form) {
      const obj = {};
      for (const el of form.elements) {
        if (!el.name) continue;
        if (el.type === 'submit' || el.type === 'button') continue;
        obj[el.name] = el.value.trim();
      }
      return obj;
    }

    function normalizeItem(raw) {
      const out = { ...raw };
      for (const name of getFieldNames()) {
        if (name.toLowerCase().includes('amount') || name.toLowerCase().includes('price')) {
          if (out[name] !== '' && out[name] != null) {
            const n = Number(out[name]);
            out[name] = Number.isFinite(n) ? n : out[name];
          }
        }
      }
      return out;
    }

    function applySearchAndFilter(list) {
      let r = list.slice();

      if (activeSearch) {
        const q = activeSearch.toLowerCase();
        r = r.filter(it => JSON.stringify(it).toLowerCase().includes(q));
      }
      if (activeFilter.key && activeFilter.value != null) {
        r = r.filter(it => String(it[activeFilter.key] ?? '') === String(activeFilter.value));
      }
      return r;
    }

    function buildFilters(list) {
      const fieldNames = getFieldNames();
      const candidates = fieldNames.filter(n => !/note|notes|description|desc/i.test(n));
      const key = candidates.find(n => /category|type|tag|status/i.test(n)) || candidates[0] || null;
      if (!key) {
        filtersEl.innerHTML = '';
        return;
      }
      const values = Array.from(new Set(list.map(it => it[key]).filter(v => v != null && String(v).trim() !== ''))).sort();
      const pills = [
        `<button class="pillBtn" data-k="${key}" data-v="">All</button>`,
        ...values.map(v => `<button class="pillBtn" data-k="${key}" data-v="${escapeHtml(v)}">${escapeHtml(v)}</button>`)
      ];
      filtersEl.innerHTML = `<div class="row" style="flex-wrap:wrap;gap:8px">
        <span class="muted" style="font-size:12px">Filter by <strong>${escapeHtml(key)}</strong>:</span>
        ${pills.join('')}
      </div>`;
      filtersEl.querySelectorAll('.pillBtn').forEach(btn => {
        btn.addEventListener('click', () => {
          const k = btn.dataset.k;
          const v = btn.dataset.v;
          activeFilter = { key: k, value: v === '' ? null : v };
          render();
        });
      });
    }

    function render() {
      buildFilters(items);
      const filtered = applySearchAndFilter(items);
      countLabel.textContent = `${filtered.length} item${filtered.length === 1 ? '' : 's'}`;

      listEl.innerHTML = '';
      if (!filtered.length) {
        listEl.innerHTML = `<div class="muted">No contacts yet.</div>`;
      } else {
        for (const it of filtered) {
          const el = document.createElement('div');
          el.className = 'item';
          el.tabIndex = 0;

          const fieldNames = getFieldNames();
          const primary = fieldNames[0];
          const secondary = fieldNames[1];

          const title = escapeHtml(it[primary] ?? 'Contact');
          const metaParts = [];
          if (secondary) metaParts.push(`${secondary}: ${escapeHtml(it[secondary] ?? '')}`);
          metaParts.push(`updated: ${fmtDate(it.updatedAt)}`);

          el.innerHTML = `
            <div>
              <div class="title">${title}</div>
              <div class="meta">${metaParts.filter(Boolean).join(' • ')}</div>
            </div>
            <span class="pill">ID: ${escapeHtml(it.id)}</span>
          `;

          el.addEventListener('click', () => openEdit(it.id));
          el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') openEdit(it.id);
          });

          listEl.appendChild(el);
        }
      }

      renderSummary(items, filtered);
    }

    function renderSummary(all, filtered) {
      const fieldNames = getFieldNames();
      const amountKey = fieldNames.find(n => /amount|price|total/i.test(n));

      let total = null;
      if (amountKey) {
        total = all.reduce((acc, it) => {
          const v = Number(it[amountKey]);
          return Number.isFinite(v) ? acc + v : acc;
        }, 0);
      }

      summaryEl.innerHTML = `
        <div class="big">${all.length}</div>
        <div class="muted">Total contacts</div>
        <hr style="border:none;border-top:1px solid var(--border);margin:12px 0" />
        <div class="row"><span class="muted">Visible (after filters)</span><span>${filtered.length}</span></div>
        ${amountKey ? `<div class="row"><span class="muted">Sum of ${escapeHtml(amountKey)}</span><span>${Number.isFinite(total) ? total.toFixed(2) : '-'}</span></div>` : ''}
        <div class="muted" style="font-size:12px;margin-top:10px">You can extend this summary in <code>public/app.js</code>.</div>
      `;
    }

    function openEdit(id) {
      const it = items.find(x => x.id === id);
      if (!it) return;
      activeId = id;

      editForm.id.value = it.id;
      for (const name of getFieldNames()) {
        editForm[name].value = it[name] ?? '';
      }
      editCard.hidden = false;
      editCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function closeEdit() {
      activeId = null;
      editCard.hidden = true;
      editForm.reset();
    }

    createForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const raw = serializeForm(createForm);
      const payload = normalizeItem(raw);
      try {
        await api(API, { method: 'POST', body: JSON.stringify(payload) });
        createForm.reset();
        await load();
      } catch (err) {
        alert('Failed to create: ' + err.message);
      }
    });

    editForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = editForm.id.value;
      const raw = serializeForm(editForm);
      delete raw.id;
      const payload = normalizeItem(raw);
      try {
        await api(`${API}/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
        closeEdit();
        await load();
      } catch (err) {
        alert('Failed to save: ' + err.message);
      }
    });

    deleteBtn.addEventListener('click', async () => {
      const id = editForm.id.value;
      if (!id) return;
      if (!confirm('Delete this item?')) return;
      try {
        await api(`${API}/${id}`, { method: 'DELETE' });
        closeEdit();
        await load();
      } catch (err) {
        alert('Failed to delete: ' + err.message);
      }
    });

    deleteAllBtn.addEventListener('click', async () => {
      if (!confirm('Delete ALL items? This cannot be undone.')) return;
      try {
        await api(`${API}/_all`, { method: 'DELETE' });
        closeEdit();
        await load();
      } catch (err) {
        alert('Failed to delete all: ' + err.message);
      }
    });

    resetBtn.addEventListener('click', () => createForm.reset());
    refreshBtn.addEventListener('click', load);
    cancelEditBtn.addEventListener('click', closeEdit);

    searchInput.addEventListener('input', (e) => {
      activeSearch = e.target.value.trim();
      render();
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeEdit();
    });

    // ContactCRM-specific: normalize tags and show richer cards
function normalizeItem(raw) {
  const out = { ...raw };
  if (out.tags) {
    out.tags = out.tags
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .slice(0, 12)
      .join(', ');
  }
  return out;
}

const _renderBase = render;
render = function() {
  buildFilters(items);

  const filtered = applySearchAndFilter(items);
  countLabel.textContent = `${filtered.length} contact${filtered.length === 1 ? '' : 's'}`;

  listEl.innerHTML = '';
  if (!filtered.length) {
    listEl.innerHTML = `<div class="muted">No contacts yet.</div>`;
  } else {
    for (const it of filtered) {
      const el = document.createElement('div');
      el.className = 'item';
      el.tabIndex = 0;

      const metaParts = [];
      if (it.company) metaParts.push(`company: ${escapeHtml(it.company)}`);
      if (it.email) metaParts.push(`email: ${escapeHtml(it.email)}`);
      if (it.phone) metaParts.push(`phone: ${escapeHtml(it.phone)}`);

      const tags = (it.tags || '').split(',').map(s => s.trim()).filter(Boolean);

      el.innerHTML = `
        <div style="min-width:0">
          <div class="title">${escapeHtml(it.name || 'Contact')}</div>
          <div class="meta">${metaParts.join(' • ') || '—'}</div>
          ${tags.length ? `<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px">${tags.map(t=>`<span class="pill">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
        </div>
        <span class="pill">updated: ${fmtDate(it.updatedAt)}</span>
      `;

      el.addEventListener('click', () => openEdit(it.id));
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter') openEdit(it.id); });

      listEl.appendChild(el);
    }
  }

  renderSummary(items, filtered);
};

function renderSummary(all, filtered) {
  const byCompany = {};
  for (const it of filtered) {
    const c = (it.company || 'No company').trim() || 'No company';
    byCompany[c] = (byCompany[c] || 0) + 1;
  }
  const top = Object.entries(byCompany).sort((a,b)=>b[1]-a[1]).slice(0,8);

  summaryEl.innerHTML = `
    <div class="big">${all.length}</div>
    <div class="muted">Total contacts</div>
    <hr style="border:none;border-top:1px solid var(--border);margin:12px 0" />
    <div class="row"><span class="muted">Visible</span><span>${filtered.length}</span></div>
    <div class="muted" style="font-size:12px;margin-top:12px;margin-bottom:6px">Top companies (visible)</div>
    ${top.length ? top.map(([k,v]) => `<div class="row"><span class="muted">${escapeHtml(k)}</span><span>${v}</span></div>`).join('') : `<div class="muted">No company distribution yet.</div>`}
  `;
}

    load();
