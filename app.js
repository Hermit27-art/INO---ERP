// ============================================================
// INO ERP - Pure HTML/JS frontend, Google Sheets sebagai database
// ============================================================

// >>> ISI DENGAN URL WEB APP APPS SCRIPT ANDA (lihat README.md) <<<
const CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbxznd135pQTXCgMwV9cDA6xAez0TYCaewUIpzGJsCuw3ZiRJIq4uYcpSOeY87aDbEegAQ/exec' // contoh: 'https://script.google.com/macros/s/AKfycb.../exec'
};

const SCHEMA_KEYS = {
  Products: 'sku', Customers: 'id', Suppliers: 'id', PurchaseOrders: 'id', SalesOrders: 'id',
  OpnameLog: 'id', CashLedger: 'id', Consignments: 'id', BOMs: 'id', RiwayatProduksi: 'id',
  Settings: 'key', Users: 'username'
};
const SHEET_NAMES = Object.keys(SCHEMA_KEYS);

const SEED_LOCAL = {
  Products: [
    { sku: 'FG-0001', kategori: 'Barang Jadi', subKat: 'Roti & Kue', nama: 'Croissant Mentega Klasik', satuan: 'Pcs', hj: 25000, hpp: 12000, safety: 30, stok: 240, status: 'Aktif', supplier: 'PT. Terigu Sukses', tempatSimpan: 'Etalase Depan', masaSmp: '3 Hari', catatan: '' },
    { sku: 'RAW-0001', kategori: 'Bahan Baku', subKat: 'Bahan Kering', nama: 'Tepung Terigu Pro Tinggi', satuan: 'Kg', hj: 0, hpp: 12500, safety: 100, stok: 80, status: 'Aktif', supplier: 'CV. Mandiri Jaya', tempatSimpan: 'Gudang Utama', masaSmp: '6 Bulan', catatan: '' }
  ],
  Customers: [{ id: 'CUST-001', nama: 'Pelanggan Umum Retail', kontak: 'Walk-in', email: '', telp: '-', alamat: 'Toko Langsung', piutang: 0 }],
  Suppliers: [{ id: 'SUP-001', nama: 'CV. Mandiri Jaya', kontak: 'Dewi Lestari', email: '', telp: '021-9876543', alamat: 'Jakarta Pusat', hutang: 0 }],
  PurchaseOrders: [], SalesOrders: [], OpnameLog: [], CashLedger: [], Consignments: [], BOMs: [], RiwayatProduksi: [],
  Settings: [
    { key: 'namaToko', value: 'INO ERP' }, { key: 'alamatToko', value: 'Jl. Contoh No. 1, Kota' },
    { key: 'telpToko', value: '081234567890' }, { key: 'kotaToko', value: 'Bali' },
    { key: 'ppnRate', value: '0.11' }, { key: 'mataUang', value: 'IDR' }, { key: 'tipeBisnis', value: 'Manufaktur' }
  ],
  Users: [{ username: 'Administrator', password: 'admin123', role: 'Admin' }]
};

// ---------- API layer ----------
// mode 'remote' -> Google Apps Script Web App. mode 'local' -> localStorage saja (untuk uji coba tanpa deploy).
const api = {
  mode: CONFIG.API_URL ? 'remote' : 'local',

  async getAll() {
    if (this.mode === 'local') return getLocalDB();
    const res = await fetch(CONFIG.API_URL + '?action=all');
    return res.json();
  },

  async upsert(sheet, data) {
    if (this.mode === 'local') {
      const db = getLocalDB();
      const keyCol = SCHEMA_KEYS[sheet];
      const idx = db[sheet].findIndex(r => String(r[keyCol]) === String(data[keyCol]));
      if (idx >= 0) db[sheet][idx] = data; else db[sheet].push(data);
      saveLocalDB(db);
      return { ok: true };
    }
    return fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // hindari CORS preflight ke Apps Script
      body: JSON.stringify({ action: 'upsert', sheet, data })
    }).then(r => r.json());
  },

  async del(sheet, key) {
    if (this.mode === 'local') {
      const db = getLocalDB();
      const keyCol = SCHEMA_KEYS[sheet];
      db[sheet] = db[sheet].filter(r => String(r[keyCol]) !== String(key));
      saveLocalDB(db);
      return { ok: true };
    }
    return fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'delete', sheet, key })
    }).then(r => r.json());
  }
};

function getLocalDB() {
  const raw = localStorage.getItem('ino_local_db');
  if (raw) return JSON.parse(raw);
  const fresh = JSON.parse(JSON.stringify(SEED_LOCAL));
  saveLocalDB(fresh);
  return fresh;
}
function saveLocalDB(db) { localStorage.setItem('ino_local_db', JSON.stringify(db)); }

// ---------- Util ----------
const rupiah = n => 'Rp' + Math.round(Number(n) || 0).toLocaleString('id-ID');
const uid = prefix => {
  const d = new Date();
  const ymd = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  return `${prefix}-${ymd}-${String(Math.floor(Math.random() * 900) + 100)}`;
};
const todayISO = () => new Date().toISOString().slice(0, 10);
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function toast(msg, type = 'success') {
  const box = document.getElementById('toast-holder');
  const colors = { success: 'bg-emerald-600', error: 'bg-red-600', warning: 'bg-amber-500' };
  const el = document.createElement('div');
  el.className = `${colors[type]} text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-lg`;
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function closeModal() { document.getElementById('modal-root').innerHTML = ''; }
function openModal(title, bodyHtml, footerHtml) {
  document.getElementById('modal-root').innerHTML = `
    <div class="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4" onclick="if(event.target===this) closeModal()">
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div class="px-5 py-3 border-b flex justify-between items-center sticky top-0 bg-white">
          <h3 class="font-extrabold text-sm">${esc(title)}</h3>
          <button onclick="closeModal()" class="text-slate-400 hover:text-slate-700 text-xl leading-none">&times;</button>
        </div>
        <div class="p-5 text-sm">${bodyHtml}</div>
        ${footerHtml ? `<div class="px-5 py-3 border-t bg-slate-50 flex justify-end gap-2">${footerHtml}</div>` : ''}
      </div>
    </div>`;
}

// ---------- Global state ----------
let DB = { Products: [], Customers: [], Suppliers: [], PurchaseOrders: [], SalesOrders: [], OpnameLog: [], CashLedger: [], Consignments: [], BOMs: [], RiwayatProduksi: [], Settings: [], Users: [] };
let currentUser = null;
let activeTab = 'dashboard';

function setting(key, def = '') {
  const row = DB.Settings.find(s => s.key === key);
  return row ? row.value : def;
}
function ppnRate() { return parseFloat(setting('ppnRate', '0.11')) || 0; }

const NAV = [
  { group: 'Utama', items: [{ id: 'dashboard', label: '📊 Dashboard' }] },
  { group: 'Transaksi', items: [{ id: 'kasir', label: '🛒 Kasir (POS)' }, { id: 'po', label: '📥 Purchase Order' }, { id: 'so', label: '📤 Sales Order' }] },
  { group: 'Inventori', items: [{ id: 'produk', label: '📦 Produk & Stok' }, { id: 'opname', label: '📝 Stok Opname' }, { id: 'produksi', label: '🏭 Produksi & BOM' }] },
  { group: 'Keuangan', items: [{ id: 'kas', label: '💰 Kas / Cash Ledger' }, { id: 'konsinyasi', label: '🤝 Konsinyasi' }] },
  { group: 'Kontak', items: [{ id: 'pelanggan', label: '👤 Pelanggan' }, { id: 'supplier', label: '🚚 Supplier' }] },
  { group: 'Sistem', items: [{ id: 'settings', label: '⚙️ Pengaturan' }] }
];

function renderNav() {
  document.getElementById('nav-menu').innerHTML = NAV.map(g => `
    <div class="nav-group">${g.group}</div>
    ${g.items.map(it => `<div class="nav-item ${activeTab === it.id ? 'active' : ''}" onclick="goTo('${it.id}')">${it.label}</div>`).join('')}
  `).join('');
}

function goTo(tab) {
  activeTab = tab;
  renderNav();
  renderMain();
}

async function refreshData(silent) {
  try {
    document.getElementById('sync-status').innerHTML = '● menyinkron...';
    const data = await api.getAll();
    SHEET_NAMES.forEach(name => { DB[name] = data[name] || []; });
    localStorage.setItem('ino_cache', JSON.stringify(DB));
    document.getElementById('sync-status').innerHTML = api.mode === 'local'
      ? '<span class="text-amber-400">● mode lokal (belum tersambung Sheets)</span>'
      : '<span class="text-emerald-400">● tersambung ke Google Sheets</span>';
    document.getElementById('side-toko-name').textContent = setting('namaToko', 'INO ERP');
    if (!silent) renderMain();
  } catch (err) {
    document.getElementById('sync-status').innerHTML = '<span class="text-red-400">● gagal sinkron</span>';
    if (!silent) toast('Gagal memuat data dari Sheets: ' + err.message, 'error');
  }
}

// Simpan 1 record: update state lokal langsung (optimistic) + kirim ke Sheets di background
async function saveRecord(sheet, data) {
  const keyCol = SCHEMA_KEYS[sheet];
  const idx = DB[sheet].findIndex(r => String(r[keyCol]) === String(data[keyCol]));
  if (idx >= 0) DB[sheet][idx] = data; else DB[sheet].push(data);
  renderMain();
  try {
    await api.upsert(sheet, data);
    toast('Tersimpan');
  } catch (err) {
    toast('Gagal sinkron ke Sheets (tersimpan lokal): ' + err.message, 'warning');
  }
}
async function deleteRecord(sheet, key) {
  const keyCol = SCHEMA_KEYS[sheet];
  DB[sheet] = DB[sheet].filter(r => String(r[keyCol]) !== String(key));
  renderMain();
  try { await api.del(sheet, key); toast('Dihapus'); }
  catch (err) { toast('Gagal sinkron hapus: ' + err.message, 'warning'); }
}

// ---------- Generic table ----------
function dataTable(columns, rows, actionsFn) {
  return `<div class="bg-white rounded-xl border overflow-x-auto">
    <table class="dt">
      <thead><tr>${columns.map(c => `<th>${esc(c.label)}</th>`).join('')}${actionsFn ? '<th>Aksi</th>' : ''}</tr></thead>
      <tbody>
        ${rows.length === 0 ? `<tr><td colspan="${columns.length + 1}" class="text-center text-slate-400 py-6">Belum ada data</td></tr>` : ''}
        ${rows.map(row => `<tr>${columns.map(c => `<td>${c.render ? c.render(row) : esc(row[c.key])}</td>`).join('')}${actionsFn ? `<td>${actionsFn(row)}</td>` : ''}</tr>`).join('')}
      </tbody>
    </table>
  </div>`;
}
function btn(label, onclick, cls = 'text-teal-600 hover:underline') {
  return `<button onclick="${onclick}" class="${cls} text-xs font-bold mr-2">${label}</button>`;
}

// ---------- Generic form modal (untuk master data sederhana) ----------
function fieldInput(f, val) {
  const v = val ?? '';
  if (f.type === 'select') {
    return `<select id="fld_${f.key}" class="w-full border rounded px-2 py-1.5 text-sm">
      ${f.options.map(o => `<option value="${esc(o)}" ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}
    </select>`;
  }
  if (f.type === 'textarea') return `<textarea id="fld_${f.key}" class="w-full border rounded px-2 py-1.5 text-sm" rows="2">${esc(v)}</textarea>`;
  return `<input id="fld_${f.key}" type="${f.type || 'text'}" value="${esc(v)}" class="w-full border rounded px-2 py-1.5 text-sm" ${f.readonly ? 'readonly' : ''} ${f.step ? `step="${f.step}"` : ''}>`;
}
function openGenericForm(title, fields, existing, onSave) {
  const body = fields.map(f => `<div class="mb-3"><label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">${esc(f.label)}</label>${fieldInput(f, existing ? existing[f.key] : f.default)}</div>`).join('');
  openModal(title, body, `${btn('Batal', 'closeModal()', 'text-slate-500')}${btn('Simpan', 'submitGenericForm()', 'bg-teal-600 text-white px-3 py-1.5 rounded')}`);
  window.submitGenericForm = () => {
    const data = {};
    fields.forEach(f => {
      const el = document.getElementById('fld_' + f.key);
      data[f.key] = f.type === 'number' ? Number(el.value || 0) : el.value;
    });
    onSave(data);
    closeModal();
  };
}

// ============================================================
// MODUL: DASHBOARD
// ============================================================
function renderDashboard() {
  const stokValue = DB.Products.reduce((s, p) => s + (Number(p.stok) || 0) * (Number(p.hpp) || 0), 0);
  const piutang = DB.Customers.reduce((s, c) => s + (Number(c.piutang) || 0), 0);
  const hutang = DB.Suppliers.reduce((s, c) => s + (Number(c.hutang) || 0), 0);
  const saldoKas = DB.CashLedger.length ? Number(DB.CashLedger[DB.CashLedger.length - 1].saldo) || 0 : 0;
  const lowStock = DB.Products.filter(p => (Number(p.stok) || 0) <= (Number(p.safety) || 0));
  const thisMonth = todayISO().slice(0, 7);
  const soThisMonth = DB.SalesOrders.filter(s => (s.tanggal || '').slice(0, 7) === thisMonth);
  const omzetBulanIni = soThisMonth.reduce((s, o) => s + (Number(o.grandTotal) || 0), 0);

  document.getElementById('main').innerHTML = `
    <h2 class="text-lg font-extrabold mb-4">Dashboard</h2>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div class="kpi-card"><div class="text-[11px] text-slate-400 font-bold uppercase">Nilai Stok</div><div class="text-xl font-extrabold mt-1">${rupiah(stokValue)}</div></div>
      <div class="kpi-card"><div class="text-[11px] text-slate-400 font-bold uppercase">Saldo Kas</div><div class="text-xl font-extrabold mt-1">${rupiah(saldoKas)}</div></div>
      <div class="kpi-card"><div class="text-[11px] text-slate-400 font-bold uppercase">Piutang</div><div class="text-xl font-extrabold mt-1 text-amber-600">${rupiah(piutang)}</div></div>
      <div class="kpi-card"><div class="text-[11px] text-slate-400 font-bold uppercase">Hutang</div><div class="text-xl font-extrabold mt-1 text-red-600">${rupiah(hutang)}</div></div>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="kpi-card md:col-span-2">
        <div class="text-[11px] text-slate-400 font-bold uppercase mb-2">Omzet Penjualan per Bulan</div>
        <canvas id="chartOmzet" height="90"></canvas>
      </div>
      <div class="kpi-card">
        <div class="text-[11px] text-slate-400 font-bold uppercase mb-2">Stok Menipis (≤ safety)</div>
        <div class="text-2xl font-extrabold mb-1">${lowStock.length}</div>
        <ul class="text-xs space-y-1 max-h-40 overflow-y-auto">
          ${lowStock.slice(0, 8).map(p => `<li class="flex justify-between"><span>${esc(p.nama)}</span><span class="font-bold text-red-600">${p.stok}</span></li>`).join('') || '<li class="text-slate-400">Aman semua 👍</li>'}
        </ul>
      </div>
    </div>
    <p class="text-xs text-slate-400 mt-4">Omzet bulan ini: <b>${rupiah(omzetBulanIni)}</b> dari ${soThisMonth.length} transaksi SO.</p>
  `;

  const monthly = {};
  DB.SalesOrders.forEach(o => { const m = (o.tanggal || '').slice(0, 7); if (!m) return; monthly[m] = (monthly[m] || 0) + (Number(o.grandTotal) || 0); });
  const labels = Object.keys(monthly).sort();
  const ctx = document.getElementById('chartOmzet');
  if (ctx && labels.length) {
    new Chart(ctx, { type: 'bar', data: { labels, datasets: [{ label: 'Omzet', data: labels.map(l => monthly[l]), backgroundColor: '#0d9488' }] }, options: { plugins: { legend: { display: false } } } });
  } else if (ctx) {
    ctx.parentElement.insertAdjacentHTML('beforeend', '<p class="text-xs text-slate-400">Belum ada data penjualan.</p>');
  }
}

// ============================================================
// MODUL: PRODUK & STOK (generic master data)
// ============================================================
const PRODUCT_FIELDS = [
  { key: 'sku', label: 'SKU', default: '' },
  { key: 'kategori', label: 'Kategori', type: 'select', options: ['Barang Jadi', 'Bahan Baku', 'Kemasan'] },
  { key: 'subKat', label: 'Sub Kategori' },
  { key: 'nama', label: 'Nama Produk' },
  { key: 'satuan', label: 'Satuan' },
  { key: 'hj', label: 'Harga Jual', type: 'number' },
  { key: 'hpp', label: 'HPP', type: 'number' },
  { key: 'safety', label: 'Stok Aman (Safety)', type: 'number' },
  { key: 'stok', label: 'Stok Saat Ini', type: 'number' },
  { key: 'status', label: 'Status', type: 'select', options: ['Aktif', 'Nonaktif'] },
  { key: 'supplier', label: 'Supplier' },
  { key: 'tempatSimpan', label: 'Tempat Simpan' },
  { key: 'masaSmp', label: 'Masa Simpan' },
  { key: 'catatan', label: 'Catatan', type: 'textarea' }
];
function renderProduk() {
  document.getElementById('main').innerHTML = `
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-lg font-extrabold">Produk & Stok</h2>
      <button onclick="editProduct()" class="bg-teal-600 text-white text-xs font-bold px-3 py-2 rounded">+ Produk Baru</button>
    </div>
    ${dataTable(
      [{ key: 'sku', label: 'SKU' }, { key: 'nama', label: 'Nama' }, { key: 'kategori', label: 'Kategori' },
       { key: 'stok', label: 'Stok', render: p => `<span class="${(Number(p.stok) <= Number(p.safety)) ? 'text-red-600 font-bold' : ''}">${p.stok} ${esc(p.satuan)}</span>` },
       { key: 'hpp', label: 'HPP', render: p => rupiah(p.hpp) }, { key: 'hj', label: 'Harga Jual', render: p => rupiah(p.hj) },
       { key: 'status', label: 'Status', render: p => `<span class="badge ${p.status === 'Aktif' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}">${esc(p.status)}</span>` }],
      DB.Products,
      p => btn('Edit', `editProduct('${p.sku}')`) + btn('Hapus', `if(confirm('Hapus produk ${esc(p.nama)}?')) deleteRecord('Products','${p.sku}')`, 'text-red-500 hover:underline')
    )}`;
}
function editProduct(sku) {
  const existing = sku ? DB.Products.find(p => p.sku === sku) : null;
  openGenericForm(existing ? 'Edit Produk' : 'Produk Baru', PRODUCT_FIELDS, existing, data => saveRecord('Products', data));
}

// ============================================================
// MODUL: PELANGGAN / SUPPLIER (generic)
// ============================================================
const CUSTOMER_FIELDS = [{ key: 'id', label: 'ID', default: '' }, { key: 'nama', label: 'Nama' }, { key: 'kontak', label: 'Kontak Person' }, { key: 'email', label: 'Email' }, { key: 'telp', label: 'Telepon' }, { key: 'alamat', label: 'Alamat', type: 'textarea' }, { key: 'piutang', label: 'Piutang', type: 'number' }];
const SUPPLIER_FIELDS = [{ key: 'id', label: 'ID', default: '' }, { key: 'nama', label: 'Nama' }, { key: 'kontak', label: 'Kontak Person' }, { key: 'email', label: 'Email' }, { key: 'telp', label: 'Telepon' }, { key: 'alamat', label: 'Alamat', type: 'textarea' }, { key: 'hutang', label: 'Hutang', type: 'number' }];

function renderPelanggan() {
  document.getElementById('main').innerHTML = `
    <div class="flex justify-between items-center mb-4"><h2 class="text-lg font-extrabold">Pelanggan</h2>
      <button onclick="editParty('Customers')" class="bg-teal-600 text-white text-xs font-bold px-3 py-2 rounded">+ Pelanggan Baru</button></div>
    ${dataTable([{ key: 'id', label: 'ID' }, { key: 'nama', label: 'Nama' }, { key: 'telp', label: 'Telp' }, { key: 'piutang', label: 'Piutang', render: c => rupiah(c.piutang) }],
      DB.Customers, c => btn('Edit', `editParty('Customers','${c.id}')`) + btn('Hapus', `if(confirm('Hapus?')) deleteRecord('Customers','${c.id}')`, 'text-red-500'))}`;
}
function renderSupplier() {
  document.getElementById('main').innerHTML = `
    <div class="flex justify-between items-center mb-4"><h2 class="text-lg font-extrabold">Supplier</h2>
      <button onclick="editParty('Suppliers')" class="bg-teal-600 text-white text-xs font-bold px-3 py-2 rounded">+ Supplier Baru</button></div>
    ${dataTable([{ key: 'id', label: 'ID' }, { key: 'nama', label: 'Nama' }, { key: 'telp', label: 'Telp' }, { key: 'hutang', label: 'Hutang', render: c => rupiah(c.hutang) }],
      DB.Suppliers, c => btn('Edit', `editParty('Suppliers','${c.id}')`) + btn('Hapus', `if(confirm('Hapus?')) deleteRecord('Suppliers','${c.id}')`, 'text-red-500'))}`;
}
function editParty(sheet, id) {
  const isCust = sheet === 'Customers';
  const fields = isCust ? CUSTOMER_FIELDS : SUPPLIER_FIELDS;
  const list = DB[sheet];
  const existing = id ? list.find(r => r.id === id) : null;
  const data0 = existing || { id: uid(isCust ? 'CUST' : 'SUP') };
  openGenericForm(existing ? 'Edit' : 'Baru', fields, data0, data => saveRecord(sheet, data));
}

// ============================================================
// MODUL: PURCHASE ORDER & SALES ORDER (item-cart form, dipakai bersama)
// ============================================================
let orderCart = [];

function renderPO() { renderOrderList('PurchaseOrders', 'Purchase Order', 'supplier', 'Diterima', 'terimaPO', 'statusLogistik'); }
function renderSO() { renderOrderList('SalesOrders', 'Sales Order', 'pelanggan', 'Terkirim', 'kirimSO', 'statusLogistik'); }

function renderOrderList(sheet, title, partnerKey, doneLabel, actionFn) {
  document.getElementById('main').innerHTML = `
    <div class="flex justify-between items-center mb-4"><h2 class="text-lg font-extrabold">${title}</h2>
      <button onclick="openOrderForm('${sheet}')" class="bg-teal-600 text-white text-xs font-bold px-3 py-2 rounded">+ ${title} Baru</button></div>
    ${dataTable([
      { key: 'id', label: 'No.' }, { key: 'tanggal', label: 'Tanggal' }, { key: partnerKey, label: partnerKey === 'supplier' ? 'Supplier' : 'Pelanggan' },
      { key: 'grandTotal', label: 'Total', render: o => rupiah(o.grandTotal) },
      { key: 'statusLogistik', label: 'Logistik', render: o => `<span class="badge ${o.statusLogistik === doneLabel ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}">${esc(o.statusLogistik)}</span>` },
      { key: 'statusBayar', label: 'Bayar', render: o => `<span class="badge ${o.statusBayar === 'Lunas' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}">${esc(o.statusBayar)}</span>` }
    ], DB[sheet].slice().reverse(), o =>
      (o.statusLogistik !== doneLabel ? btn(sheet === 'PurchaseOrders' ? 'Terima' : 'Kirim', `${sheet === 'PurchaseOrders' ? 'terimaPO' : 'kirimSO'}('${o.id}')`) : '') +
      (o.statusBayar !== 'Lunas' ? btn('Tandai Lunas', `bayarOrder('${sheet}','${o.id}')`) : '') +
      btn('Hapus', `if(confirm('Hapus ${title} ${o.id}?')) deleteRecord('${sheet}','${o.id}')`, 'text-red-500')
    )}`;
}

function openOrderForm(sheet) {
  const isPO = sheet === 'PurchaseOrders';
  const partners = isPO ? DB.Suppliers : DB.Customers;
  const partnerLabel = isPO ? 'Supplier' : 'Pelanggan';
  orderCart = [];
  const body = `
    <div class="grid grid-cols-2 gap-3 mb-3">
      <div><label class="text-[11px] font-bold uppercase text-slate-500">Tanggal</label><input id="ord_tanggal" type="date" value="${todayISO()}" class="w-full border rounded px-2 py-1.5 text-sm"></div>
      <div><label class="text-[11px] font-bold uppercase text-slate-500">${partnerLabel}</label>
        <select id="ord_partner" class="w-full border rounded px-2 py-1.5 text-sm">${partners.map(p => `<option value="${esc(p.nama)}">${esc(p.nama)}</option>`).join('') || '<option value="">- belum ada data -</option>'}</select></div>
    </div>
    <div class="mb-3"><label class="text-[11px] font-bold uppercase text-slate-500">Metode Pembayaran</label>
      <select id="ord_metode" class="w-full border rounded px-2 py-1.5 text-sm"><option>Tunai</option><option>Kredit 30 Hari</option><option>Tempo 30 Hari</option></select></div>
    <div class="border rounded-lg p-3 mb-3 bg-slate-50">
      <div class="grid grid-cols-12 gap-1 mb-2">
        <select id="ord_item_sku" class="col-span-6 border rounded px-2 py-1 text-xs">${DB.Products.map(p => `<option value="${p.sku}">${esc(p.nama)} (${p.sku})</option>`).join('')}</select>
        <input id="ord_item_qty" type="number" min="1" value="1" class="col-span-2 border rounded px-2 py-1 text-xs" placeholder="Qty">
        <input id="ord_item_harga" type="number" class="col-span-3 border rounded px-2 py-1 text-xs" placeholder="Harga">
        <button onclick="addOrderCartItem('${isPO}')" class="col-span-1 bg-slate-700 text-white rounded text-xs font-bold">+</button>
      </div>
      <div id="ord_cart_table"></div>
    </div>
    <textarea id="ord_catatan" class="w-full border rounded px-2 py-1.5 text-sm" placeholder="Catatan (opsional)" rows="2"></textarea>
    <div id="ord_totals" class="text-right text-sm mt-2 font-bold"></div>
  `;
  openModal(`${partnerLabel === 'Supplier' ? 'Purchase' : 'Sales'} Order Baru`, body,
    `${btn('Batal', 'closeModal()', 'text-slate-500')}${btn('Simpan', `submitOrder('${sheet}')`, 'bg-teal-600 text-white px-3 py-1.5 rounded')}`);

  // auto-isi harga sesuai HPP (PO) / HJ (SO) saat pilih produk
  document.getElementById('ord_item_sku').addEventListener('change', e => {
    const p = DB.Products.find(x => x.sku === e.target.value);
    document.getElementById('ord_item_harga').value = p ? (isPO ? p.hpp : p.hj) : 0;
  });
  document.getElementById('ord_item_sku').dispatchEvent(new Event('change'));
  renderOrderCart();
}
function renderOrderCart() {
  const totalsEl = document.getElementById('ord_totals');
  document.getElementById('ord_cart_table').innerHTML = orderCart.length === 0 ? '<p class="text-xs text-slate-400">Belum ada item</p>' :
    `<table class="w-full text-xs"><thead><tr class="text-slate-500"><th class="text-left">Item</th><th>Qty</th><th>Harga</th><th>Subtotal</th><th></th></tr></thead><tbody>
      ${orderCart.map((it, i) => `<tr><td>${esc(it.nama)}</td><td class="text-center">${it.qty}</td><td class="text-right">${rupiah(it.harga)}</td><td class="text-right">${rupiah(it.subtotal)}</td><td><button onclick="orderCart.splice(${i},1);renderOrderCart()" class="text-red-500 font-bold px-1">&times;</button></td></tr>`).join('')}
    </tbody></table>`;
  const subtotal = orderCart.reduce((s, i) => s + i.subtotal, 0);
  const pajak = Math.round(subtotal * ppnRate());
  totalsEl.innerHTML = `Subtotal: ${rupiah(subtotal)} &nbsp; | &nbsp; PPN: ${rupiah(pajak)} &nbsp; | &nbsp; <span class="text-teal-700">Total: ${rupiah(subtotal + pajak)}</span>`;
}
function addOrderCartItem(isPO) {
  isPO = isPO === 'true' || isPO === true;
  const sku = document.getElementById('ord_item_sku').value;
  const qty = Number(document.getElementById('ord_item_qty').value) || 0;
  const harga = Number(document.getElementById('ord_item_harga').value) || 0;
  const p = DB.Products.find(x => x.sku === sku);
  if (!p || qty <= 0) { toast('Pilih produk & qty valid', 'error'); return; }
  orderCart.push({ sku, nama: p.nama, qty, satuan: p.satuan, harga, subtotal: qty * harga });
  renderOrderCart();
}
function submitOrder(sheet) {
  if (orderCart.length === 0) { toast('Tambahkan minimal 1 item', 'error'); return; }
  const partner = document.getElementById('ord_partner').value;
  if (!partner) { toast('Pilih ' + (sheet === 'PurchaseOrders' ? 'supplier' : 'pelanggan') + ' dahulu', 'error'); return; }
  const subtotal = orderCart.reduce((s, i) => s + i.subtotal, 0);
  const pajak = Math.round(subtotal * ppnRate());
  const data = {
    id: uid(sheet === 'PurchaseOrders' ? 'PO' : 'SO'),
    tanggal: document.getElementById('ord_tanggal').value,
    [sheet === 'PurchaseOrders' ? 'supplier' : 'pelanggan']: partner,
    metode: document.getElementById('ord_metode').value,
    itemsJSON: JSON.stringify(orderCart),
    subtotal, pajak, grandTotal: subtotal + pajak,
    statusLogistik: 'Menunggu', statusBayar: document.getElementById('ord_metode').value === 'Tunai' ? 'Belum Dibayar' : 'Belum Dibayar',
    catatan: document.getElementById('ord_catatan').value
  };
  saveRecord(sheet, data);
  closeModal();
}

function terimaPO(id) {
  const po = DB.PurchaseOrders.find(o => o.id === id);
  if (!po) return;
  const items = JSON.parse(po.itemsJSON || '[]');
  items.forEach(it => {
    const p = DB.Products.find(x => x.sku === it.sku);
    if (!p) return;
    // ponytail: HPP baru pakai rata-rata sederhana (bukan moving average penuh per-batch), cukup untuk kebutuhan saat ini
    const totalLamaValue = (Number(p.stok) || 0) * (Number(p.hpp) || 0);
    const totalBaruValue = it.qty * it.harga;
    const stokBaru = (Number(p.stok) || 0) + it.qty;
    p.hpp = stokBaru > 0 ? Math.round((totalLamaValue + totalBaruValue) / stokBaru) : p.hpp;
    p.stok = stokBaru;
    saveRecord('Products', p);
  });
  po.statusLogistik = 'Diterima';
  saveRecord('PurchaseOrders', po);
}
function kirimSO(id) {
  const so = DB.SalesOrders.find(o => o.id === id);
  if (!so) return;
  const items = JSON.parse(so.itemsJSON || '[]');
  for (const it of items) {
    const p = DB.Products.find(x => x.sku === it.sku);
    if (p && Number(p.stok) < it.qty) { if (!confirm(`Stok ${p.nama} kurang (sisa ${p.stok}). Tetap kirim?`)) return; }
  }
  items.forEach(it => {
    const p = DB.Products.find(x => x.sku === it.sku);
    if (!p) return;
    p.stok = (Number(p.stok) || 0) - it.qty;
    saveRecord('Products', p);
  });
  so.statusLogistik = 'Terkirim';
  saveRecord('SalesOrders', so);
}
function bayarOrder(sheet, id) {
  const o = DB[sheet].find(x => x.id === id);
  if (!o) return;
  o.statusBayar = 'Lunas';
  saveRecord(sheet, o);
  addCashEntry({
    tanggal: todayISO(), ref: o.id,
    keterangan: (sheet === 'PurchaseOrders' ? 'Pembayaran PO ' : 'Pelunasan SO ') + o.id,
    kategori: sheet === 'PurchaseOrders' ? 'Pembelian' : 'Penjualan',
    debit: sheet === 'SalesOrders' ? o.grandTotal : 0,
    kredit: sheet === 'PurchaseOrders' ? o.grandTotal : 0
  });
}

// ============================================================
// MODUL: KASIR (POS) - langsung Terkirim + Lunas
// ============================================================
function renderKasir() {
  orderCart = [];
  document.getElementById('main').innerHTML = `
    <h2 class="text-lg font-extrabold mb-4">Kasir (POS)</h2>
    <div class="grid grid-cols-3 gap-4">
      <div class="col-span-2 bg-white rounded-xl border p-3">
        <input id="pos_search" oninput="renderPosGrid(this.value)" placeholder="Cari produk..." class="w-full border rounded px-3 py-2 text-sm mb-3">
        <div id="pos_grid" class="grid grid-cols-3 gap-2 max-h-[60vh] overflow-y-auto"></div>
      </div>
      <div class="bg-white rounded-xl border p-3 flex flex-col">
        <div class="mb-2">
          <label class="text-[11px] font-bold uppercase text-slate-500">Pelanggan</label>
          <select id="pos_partner" class="w-full border rounded px-2 py-1.5 text-sm">${DB.Customers.map(c => `<option value="${esc(c.nama)}">${esc(c.nama)}</option>`).join('')}</select>
        </div>
        <div id="pos_cart" class="flex-1 overflow-y-auto text-xs"></div>
        <div id="pos_totals" class="text-right font-bold text-sm border-t pt-2 mt-2"></div>
        <button onclick="checkoutPOS()" class="mt-3 bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 rounded text-sm">Bayar / Checkout</button>
      </div>
    </div>`;
  renderPosGrid(''); renderPosCart();
}
function renderPosGrid(q) {
  q = (q || '').toLowerCase();
  const items = DB.Products.filter(p => p.status === 'Aktif' && p.kategori === 'Barang Jadi' && (p.nama.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)));
  document.getElementById('pos_grid').innerHTML = items.map(p => `
    <div onclick="addPosItem('${p.sku}')" class="border rounded-lg p-2 cursor-pointer hover:border-teal-500 hover:bg-teal-50">
      <div class="text-xs font-bold truncate">${esc(p.nama)}</div>
      <div class="text-[10px] text-slate-400">Stok: ${p.stok}</div>
      <div class="text-xs font-extrabold text-teal-700">${rupiah(p.hj)}</div>
    </div>`).join('') || '<p class="text-xs text-slate-400 col-span-3">Tidak ada produk (kategori: Barang Jadi)</p>';
}
function addPosItem(sku) {
  const p = DB.Products.find(x => x.sku === sku);
  if (!p) return;
  const existing = orderCart.find(i => i.sku === sku);
  if (existing) existing.qty += 1; else orderCart.push({ sku, nama: p.nama, qty: 1, satuan: p.satuan, harga: p.hj });
  orderCart.forEach(i => i.subtotal = i.qty * i.harga);
  renderPosCart();
}
function renderPosCart() {
  document.getElementById('pos_cart').innerHTML = orderCart.length === 0 ? '<p class="text-slate-400">Keranjang kosong</p>' :
    orderCart.map((it, i) => `<div class="flex justify-between items-center border-b py-1">
      <span class="flex-1 truncate">${esc(it.nama)}</span>
      <input type="number" min="1" value="${it.qty}" onchange="orderCart[${i}].qty=Number(this.value)||1;orderCart[${i}].subtotal=orderCart[${i}].qty*orderCart[${i}].harga;renderPosCart()" class="w-12 border rounded text-center mx-1">
      <span class="w-20 text-right">${rupiah(it.subtotal)}</span>
      <button onclick="orderCart.splice(${i},1);renderPosCart()" class="text-red-500 font-bold px-1">&times;</button>
    </div>`).join('');
  const subtotal = orderCart.reduce((s, i) => s + i.subtotal, 0);
  const pajak = Math.round(subtotal * ppnRate());
  document.getElementById('pos_totals').innerHTML = `Subtotal ${rupiah(subtotal)}<br>PPN ${rupiah(pajak)}<br><span class="text-teal-700 text-base">Total ${rupiah(subtotal + pajak)}</span>`;
}
function checkoutPOS() {
  if (orderCart.length === 0) { toast('Keranjang kosong', 'error'); return; }
  for (const it of orderCart) {
    const p = DB.Products.find(x => x.sku === it.sku);
    if (p && Number(p.stok) < it.qty) { toast(`Stok ${p.nama} tidak cukup (sisa ${p.stok})`, 'error'); return; }
  }
  const subtotal = orderCart.reduce((s, i) => s + i.subtotal, 0);
  const pajak = Math.round(subtotal * ppnRate());
  const so = {
    id: uid('SO'), tanggal: todayISO(), pelanggan: document.getElementById('pos_partner').value || 'Pelanggan Umum Retail',
    metode: 'Tunai', itemsJSON: JSON.stringify(orderCart), subtotal, pajak, grandTotal: subtotal + pajak,
    statusLogistik: 'Terkirim', statusBayar: 'Lunas', catatan: 'Transaksi Kasir/POS'
  };
  orderCart.forEach(it => { const p = DB.Products.find(x => x.sku === it.sku); if (p) { p.stok -= it.qty; saveRecord('Products', p); } });
  saveRecord('SalesOrders', so);
  addCashEntry({ tanggal: todayISO(), ref: so.id, keterangan: 'Penjualan Kasir ' + so.id, kategori: 'Penjualan', debit: so.grandTotal, kredit: 0 });
  toast('Transaksi berhasil! Total ' + rupiah(so.grandTotal));
  orderCart = [];
  renderKasir();
}

// ============================================================
// MODUL: STOK OPNAME
// ============================================================
function renderOpname() {
  document.getElementById('main').innerHTML = `
    <div class="flex justify-between items-center mb-4"><h2 class="text-lg font-extrabold">Stok Opname</h2>
      <button onclick="openOpnameForm()" class="bg-teal-600 text-white text-xs font-bold px-3 py-2 rounded">+ Catat Opname</button></div>
    ${dataTable([{ key: 'tanggal', label: 'Tanggal' }, { key: 'sku', label: 'SKU' }, { key: 'nama', label: 'Nama' },
      { key: 'qtySistem', label: 'Sistem' }, { key: 'qtyFisik', label: 'Fisik' },
      { key: 'selisih', label: 'Selisih', render: r => `<span class="${r.selisih < 0 ? 'text-red-600' : 'text-emerald-600'} font-bold">${r.selisih}</span>` },
      { key: 'subtotal', label: 'Nilai', render: r => rupiah(r.subtotal) }, { key: 'operator', label: 'Operator' }],
      DB.OpnameLog.slice().reverse())}`;
}
function openOpnameForm() {
  const body = `
    <div class="mb-3"><label class="text-[11px] font-bold uppercase text-slate-500">Produk</label>
      <select id="op_sku" class="w-full border rounded px-2 py-1.5 text-sm">${DB.Products.map(p => `<option value="${p.sku}">${esc(p.nama)} (stok sistem: ${p.stok})</option>`).join('')}</select></div>
    <div class="mb-3"><label class="text-[11px] font-bold uppercase text-slate-500">Qty Fisik (hasil hitung)</label><input id="op_fisik" type="number" class="w-full border rounded px-2 py-1.5 text-sm"></div>
    <div class="mb-3"><label class="text-[11px] font-bold uppercase text-slate-500">Operator</label><input id="op_operator" value="${currentUser?.username || ''}" class="w-full border rounded px-2 py-1.5 text-sm"></div>
    <textarea id="op_catatan" class="w-full border rounded px-2 py-1.5 text-sm" placeholder="Catatan" rows="2"></textarea>`;
  openModal('Catat Stok Opname', body, `${btn('Batal', 'closeModal()', 'text-slate-500')}${btn('Simpan', 'submitOpname()', 'bg-teal-600 text-white px-3 py-1.5 rounded')}`);
}
function submitOpname() {
  const sku = document.getElementById('op_sku').value;
  const p = DB.Products.find(x => x.sku === sku);
  const qtyFisik = Number(document.getElementById('op_fisik').value);
  if (!p || isNaN(qtyFisik)) { toast('Isi qty fisik dengan angka valid', 'error'); return; }
  const selisih = qtyFisik - Number(p.stok);
  const log = {
    id: uid('OPN'), tanggal: todayISO(), sku: p.sku, nama: p.nama, tipe: selisih >= 0 ? 'OPNAME_PLUS' : 'OPNAME_MINUS',
    qtySistem: p.stok, qtyFisik, selisih, satuan: p.satuan, hpp: p.hpp, subtotal: selisih * p.hpp,
    catatan: document.getElementById('op_catatan').value, operator: document.getElementById('op_operator').value || '-'
  };
  p.stok = qtyFisik;
  saveRecord('Products', p);
  saveRecord('OpnameLog', log);
  closeModal();
}

// ============================================================
// MODUL: PRODUKSI & BOM
// ============================================================
let bomCart = [];
function renderProduksi() {
  document.getElementById('main').innerHTML = `
    <div class="flex justify-between items-center mb-3">
      <h2 class="text-lg font-extrabold">Produksi & BOM</h2>
      <div>${btn('+ Resep (BOM) Baru', 'openBomForm()', 'bg-slate-700 text-white px-3 py-1.5 rounded text-xs')} ${btn('+ Catat Produksi', 'openProduksiForm()', 'bg-teal-600 text-white px-3 py-1.5 rounded text-xs')}</div>
    </div>
    <h3 class="text-xs font-extrabold uppercase text-slate-500 mb-2">Resep / Bill of Materials</h3>
    ${dataTable([{ key: 'namaFinishedGood', label: 'Produk Jadi' }, { key: 'skuFinishedGood', label: 'SKU' },
      { key: 'ingredientsJSON', label: 'Bahan', render: b => JSON.parse(b.ingredientsJSON || '[]').map(i => `${esc(i.nama)} (${i.qty})`).join(', ') }],
      DB.BOMs, b => btn('Hapus', `if(confirm('Hapus resep ini?')) deleteRecord('BOMs','${b.id}')`, 'text-red-500'))}
    <h3 class="text-xs font-extrabold uppercase text-slate-500 mt-6 mb-2">Riwayat Produksi</h3>
    ${dataTable([{ key: 'tanggal', label: 'Tanggal' }, { key: 'namaFinishedGood', label: 'Produk' }, { key: 'qtyProduced', label: 'Qty' },
      { key: 'costTotal', label: 'Biaya', render: r => rupiah(r.costTotal) }, { key: 'operator', label: 'Operator' }],
      DB.RiwayatProduksi.slice().reverse())}`;
}
function openBomForm() {
  bomCart = [];
  const finishedGoods = DB.Products.filter(p => p.kategori === 'Barang Jadi');
  const body = `
    <div class="mb-3"><label class="text-[11px] font-bold uppercase text-slate-500">Produk Jadi</label>
      <select id="bom_fg" class="w-full border rounded px-2 py-1.5 text-sm">${finishedGoods.map(p => `<option value="${p.sku}">${esc(p.nama)}</option>`).join('') || '<option value="">- belum ada Barang Jadi -</option>'}</select></div>
    <div class="border rounded-lg p-3 bg-slate-50">
      <div class="grid grid-cols-12 gap-1 mb-2">
        <select id="bom_ing_sku" class="col-span-7 border rounded px-2 py-1 text-xs">${DB.Products.filter(p => p.kategori !== 'Barang Jadi').map(p => `<option value="${p.sku}">${esc(p.nama)}</option>`).join('')}</select>
        <input id="bom_ing_qty" type="number" step="0.01" value="1" class="col-span-4 border rounded px-2 py-1 text-xs" placeholder="Qty per 1 produk">
        <button onclick="addBomIngredient()" class="col-span-1 bg-slate-700 text-white rounded text-xs font-bold">+</button>
      </div>
      <div id="bom_ing_table"></div>
    </div>`;
  openModal('Resep (BOM) Baru', body, `${btn('Batal', 'closeModal()', 'text-slate-500')}${btn('Simpan', 'submitBom()', 'bg-teal-600 text-white px-3 py-1.5 rounded')}`);
  renderBomIngredients();
}
function addBomIngredient() {
  const sku = document.getElementById('bom_ing_sku').value;
  const qty = Number(document.getElementById('bom_ing_qty').value);
  const p = DB.Products.find(x => x.sku === sku);
  if (!p || !qty) { toast('Pilih bahan & qty valid', 'error'); return; }
  bomCart.push({ sku, nama: p.nama, qty, satuan: p.satuan });
  renderBomIngredients();
}
function renderBomIngredients() {
  document.getElementById('bom_ing_table').innerHTML = bomCart.length === 0 ? '<p class="text-xs text-slate-400">Belum ada bahan</p>' :
    `<ul class="text-xs space-y-1">${bomCart.map((i, idx) => `<li class="flex justify-between"><span>${esc(i.nama)} — ${i.qty} ${esc(i.satuan)}</span><button onclick="bomCart.splice(${idx},1);renderBomIngredients()" class="text-red-500 font-bold px-1">&times;</button></li>`).join('')}</ul>`;
}
function submitBom() {
  const skuFg = document.getElementById('bom_fg').value;
  const fg = DB.Products.find(p => p.sku === skuFg);
  if (!fg || bomCart.length === 0) { toast('Pilih produk jadi & minimal 1 bahan', 'error'); return; }
  saveRecord('BOMs', { id: 'BOM-' + fg.sku, skuFinishedGood: fg.sku, namaFinishedGood: fg.nama, ingredientsJSON: JSON.stringify(bomCart) });
  closeModal();
}
function openProduksiForm() {
  if (DB.BOMs.length === 0) { toast('Buat resep (BOM) dahulu', 'error'); return; }
  const body = `
    <div class="mb-3"><label class="text-[11px] font-bold uppercase text-slate-500">Resep</label>
      <select id="prod_bom" class="w-full border rounded px-2 py-1.5 text-sm">${DB.BOMs.map(b => `<option value="${b.id}">${esc(b.namaFinishedGood)}</option>`).join('')}</select></div>
    <div class="mb-3"><label class="text-[11px] font-bold uppercase text-slate-500">Qty Diproduksi</label><input id="prod_qty" type="number" min="1" value="1" class="w-full border rounded px-2 py-1.5 text-sm"></div>
    <div class="mb-3"><label class="text-[11px] font-bold uppercase text-slate-500">Biaya Tenaga Kerja/Overhead (opsional)</label><input id="prod_labor" type="number" value="0" class="w-full border rounded px-2 py-1.5 text-sm"></div>`;
  openModal('Catat Produksi', body, `${btn('Batal', 'closeModal()', 'text-slate-500')}${btn('Proses', 'submitProduksi()', 'bg-teal-600 text-white px-3 py-1.5 rounded')}`);
}
function submitProduksi() {
  const bom = DB.BOMs.find(b => b.id === document.getElementById('prod_bom').value);
  const qty = Number(document.getElementById('prod_qty').value) || 0;
  const labor = Number(document.getElementById('prod_labor').value) || 0;
  if (!bom || qty <= 0) { toast('Data tidak valid', 'error'); return; }
  const ingredients = JSON.parse(bom.ingredientsJSON || '[]');
  for (const ing of ingredients) {
    const p = DB.Products.find(x => x.sku === ing.sku);
    const needed = ing.qty * qty;
    if (!p || Number(p.stok) < needed) { toast(`Stok bahan ${ing.nama} tidak cukup (butuh ${needed})`, 'error'); return; }
  }
  let costTotal = labor;
  ingredients.forEach(ing => {
    const p = DB.Products.find(x => x.sku === ing.sku);
    const needed = ing.qty * qty;
    costTotal += needed * (Number(p.hpp) || 0);
    p.stok -= needed;
    saveRecord('Products', p);
  });
  const fg = DB.Products.find(p => p.sku === bom.skuFinishedGood);
  if (fg) {
    const totalLamaValue = (Number(fg.stok) || 0) * (Number(fg.hpp) || 0);
    fg.stok = (Number(fg.stok) || 0) + qty;
    fg.hpp = fg.stok > 0 ? Math.round((totalLamaValue + costTotal) / fg.stok) : fg.hpp;
    saveRecord('Products', fg);
  }
  saveRecord('RiwayatProduksi', { id: uid('PROD'), tanggal: todayISO(), skuFinishedGood: bom.skuFinishedGood, namaFinishedGood: bom.namaFinishedGood, qtyProduced: qty, costTotal, status: 'Selesai', operator: currentUser?.username || '-' });
  closeModal();
  toast('Produksi tercatat, stok diperbarui');
}

// ============================================================
// MODUL: KAS / CASH LEDGER
// ============================================================
function renderKas() {
  document.getElementById('main').innerHTML = `
    <div class="flex justify-between items-center mb-4"><h2 class="text-lg font-extrabold">Kas / Cash Ledger</h2>
      <button onclick="openCashForm()" class="bg-teal-600 text-white text-xs font-bold px-3 py-2 rounded">+ Catat Transaksi</button></div>
    ${dataTable([{ key: 'tanggal', label: 'Tanggal' }, { key: 'keterangan', label: 'Keterangan' }, { key: 'kategori', label: 'Kategori' },
      { key: 'debit', label: 'Masuk', render: r => r.debit ? rupiah(r.debit) : '-' }, { key: 'kredit', label: 'Keluar', render: r => r.kredit ? rupiah(r.kredit) : '-' },
      { key: 'saldo', label: 'Saldo', render: r => rupiah(r.saldo) }], DB.CashLedger.slice().reverse())}`;
}
function openCashForm() {
  const body = `
    <div class="mb-3"><label class="text-[11px] font-bold uppercase text-slate-500">Tanggal</label><input id="cs_tgl" type="date" value="${todayISO()}" class="w-full border rounded px-2 py-1.5 text-sm"></div>
    <div class="mb-3"><label class="text-[11px] font-bold uppercase text-slate-500">Keterangan</label><input id="cs_ket" class="w-full border rounded px-2 py-1.5 text-sm"></div>
    <div class="mb-3"><label class="text-[11px] font-bold uppercase text-slate-500">Kategori</label><input id="cs_kat" class="w-full border rounded px-2 py-1.5 text-sm" placeholder="Modal / Sewa / Gaji / Operasional Lain / dll"></div>
    <div class="mb-3"><label class="text-[11px] font-bold uppercase text-slate-500">Jenis</label>
      <select id="cs_jenis" class="w-full border rounded px-2 py-1.5 text-sm"><option value="debit">Uang Masuk (Debit)</option><option value="kredit">Uang Keluar (Kredit)</option></select></div>
    <div class="mb-3"><label class="text-[11px] font-bold uppercase text-slate-500">Jumlah</label><input id="cs_jumlah" type="number" class="w-full border rounded px-2 py-1.5 text-sm"></div>`;
  openModal('Catat Transaksi Kas', body, `${btn('Batal', 'closeModal()', 'text-slate-500')}${btn('Simpan', 'submitCash()', 'bg-teal-600 text-white px-3 py-1.5 rounded')}`);
}
function submitCash() {
  const jumlah = Number(document.getElementById('cs_jumlah').value) || 0;
  if (jumlah <= 0) { toast('Isi jumlah valid', 'error'); return; }
  const jenis = document.getElementById('cs_jenis').value;
  addCashEntry({
    tanggal: document.getElementById('cs_tgl').value, ref: '-', keterangan: document.getElementById('cs_ket').value,
    kategori: document.getElementById('cs_kat').value || 'Lainnya', debit: jenis === 'debit' ? jumlah : 0, kredit: jenis === 'kredit' ? jumlah : 0
  });
  closeModal();
}
// Tambah entri kas & hitung ulang saldo berjalan (sequential, urut waktu input)
function addCashEntry(entry) {
  const saldoTerakhir = DB.CashLedger.length ? Number(DB.CashLedger[DB.CashLedger.length - 1].saldo) || 0 : 0;
  const saldo = saldoTerakhir + (Number(entry.debit) || 0) - (Number(entry.kredit) || 0);
  saveRecord('CashLedger', { id: uid('CSH'), ...entry, saldo });
}

// ============================================================
// MODUL: KONSINYASI (generic)
// ============================================================
const CONSIGN_FIELDS = [
  { key: 'id', label: 'ID', default: '' }, { key: 'consignor', label: 'Pemilik Barang (Consignor)' }, { key: 'tanggal', label: 'Tanggal', type: 'date', default: todayISO() },
  { key: 'sku', label: 'SKU' }, { key: 'nama', label: 'Nama Barang' }, { key: 'qtyReceived', label: 'Qty Diterima', type: 'number' },
  { key: 'qtySold', label: 'Qty Terjual', type: 'number' }, { key: 'qtyReturned', label: 'Qty Retur', type: 'number' },
  { key: 'harga', label: 'Harga Jual', type: 'number' }, { key: 'komisiPct', label: 'Komisi (%)', type: 'number' },
  { key: 'status', label: 'Status', type: 'select', options: ['Aktif', 'Selesai'] }, { key: 'catatan', label: 'Catatan', type: 'textarea' }
];
function renderKonsinyasi() {
  document.getElementById('main').innerHTML = `
    <div class="flex justify-between items-center mb-4"><h2 class="text-lg font-extrabold">Konsinyasi</h2>
      <button onclick="editConsign()" class="bg-teal-600 text-white text-xs font-bold px-3 py-2 rounded">+ Konsinyasi Baru</button></div>
    ${dataTable([{ key: 'consignor', label: 'Consignor' }, { key: 'nama', label: 'Barang' }, { key: 'qtyReceived', label: 'Diterima' },
      { key: 'qtySold', label: 'Terjual' }, { key: 'qtyReturned', label: 'Retur' },
      { key: 'komisiPct', label: 'Komisi Toko', render: r => rupiah(r.qtySold * r.harga * (r.komisiPct / 100)) },
      { key: 'status', label: 'Status' }], DB.Consignments,
      r => btn('Edit', `editConsign('${r.id}')`) + btn('Hapus', `if(confirm('Hapus?')) deleteRecord('Consignments','${r.id}')`, 'text-red-500'))}`;
}
function editConsign(id) {
  const existing = id ? DB.Consignments.find(r => r.id === id) : null;
  openGenericForm(existing ? 'Edit Konsinyasi' : 'Konsinyasi Baru', CONSIGN_FIELDS, existing || { id: uid('CSG') }, data => saveRecord('Consignments', data));
}

// ============================================================
// MODUL: SETTINGS
// ============================================================
const USER_FIELDS = [{ key: 'username', label: 'Username' }, { key: 'password', label: 'Password' }, { key: 'role', label: 'Role', type: 'select', options: ['Admin', 'Staff'] }];
function renderSettings() {
  const s = k => setting(k);
  document.getElementById('main').innerHTML = `
    <h2 class="text-lg font-extrabold mb-4">Pengaturan</h2>
    <div class="grid md:grid-cols-2 gap-4">
      <div class="bg-white rounded-xl border p-4">
        <h3 class="text-xs font-extrabold uppercase text-slate-500 mb-3">Profil Toko</h3>
        ${['namaToko', 'alamatToko', 'telpToko', 'kotaToko', 'tipeBisnis'].map(k => `<div class="mb-2"><label class="text-[11px] text-slate-500 font-bold uppercase">${k}</label><input id="set_${k}" value="${esc(s(k))}" class="w-full border rounded px-2 py-1.5 text-sm"></div>`).join('')}
        <div class="mb-2"><label class="text-[11px] text-slate-500 font-bold uppercase">PPN Rate (0.11 = 11%)</label><input id="set_ppnRate" value="${esc(s('ppnRate'))}" class="w-full border rounded px-2 py-1.5 text-sm"></div>
        <button onclick="saveSettings()" class="bg-teal-600 text-white text-xs font-bold px-3 py-2 rounded mt-2">Simpan Pengaturan</button>
      </div>
      <div class="bg-white rounded-xl border p-4">
        <div class="flex justify-between items-center mb-3"><h3 class="text-xs font-extrabold uppercase text-slate-500">Pengguna</h3>
          <button onclick="editUser()" class="text-teal-600 text-xs font-bold">+ Tambah</button></div>
        ${dataTable([{ key: 'username', label: 'Username' }, { key: 'role', label: 'Role' }], DB.Users,
          u => btn('Edit', `editUser('${u.username}')`) + btn('Hapus', `if(confirm('Hapus user ${u.username}?')) deleteRecord('Users','${u.username}')`, 'text-red-500'))}
      </div>
    </div>`;
}
function saveSettings() {
  ['namaToko', 'alamatToko', 'telpToko', 'kotaToko', 'tipeBisnis', 'ppnRate'].forEach(k => {
    saveRecord('Settings', { key: k, value: document.getElementById('set_' + k).value });
  });
  toast('Pengaturan disimpan');
}
function editUser(username) {
  const existing = username ? DB.Users.find(u => u.username === username) : null;
  openGenericForm(existing ? 'Edit Pengguna' : 'Pengguna Baru', USER_FIELDS, existing, data => saveRecord('Users', data));
}

// ============================================================
// LOGIN & INIT
// ============================================================
function doLogin() {
  const u = document.getElementById('login-username').value.trim();
  const p = document.getElementById('login-password').value;
  const user = DB.Users.find(x => x.username === u && String(x.password) === p);
  const errEl = document.getElementById('login-error');
  if (!user) { errEl.textContent = 'Username atau password salah.'; errEl.classList.remove('hidden'); return; }
  currentUser = user;
  sessionStorage.setItem('ino_session', JSON.stringify(user));
  document.getElementById('login-screen').classList.add('hidden');
  goTo('dashboard');
}
function logout() {
  sessionStorage.removeItem('ino_session');
  currentUser = null;
  document.getElementById('login-screen').classList.remove('hidden');
}

// ---------- Dispatcher ----------
const RENDERERS = {
  dashboard: renderDashboard, produk: renderProduk, kasir: renderKasir, po: renderPO, so: renderSO,
  opname: renderOpname, produksi: renderProduksi, kas: renderKas, konsinyasi: renderKonsinyasi,
  pelanggan: renderPelanggan, supplier: renderSupplier, settings: renderSettings
};
function renderMain() {
  (RENDERERS[activeTab] || renderDashboard)();
}

async function init() {
  if (!CONFIG.API_URL) document.getElementById('setup-banner').classList.remove('hidden');
  // tampilkan cache lokal dulu (biar instan), lalu sinkron ke Sheets di background
  const cached = localStorage.getItem('ino_cache');
  if (cached) { const c = JSON.parse(cached); SHEET_NAMES.forEach(name => { DB[name] = c[name] || []; }); }
  await refreshData(true);

  const session = sessionStorage.getItem('ino_session');
  if (session) currentUser = JSON.parse(session);
  else document.getElementById('login-screen').classList.remove('hidden');

  renderNav();
  renderMain();
  // auto-refresh dari Sheets tiap 30 detik supaya data selalu terkini
  setInterval(() => refreshData(activeTab !== 'produk' && activeTab !== 'kasir'), 30000);
}
init();
