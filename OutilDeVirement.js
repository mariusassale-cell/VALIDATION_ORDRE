// ══════════════════════════════════════════
//  FIREBASE — Configuration
//  → Allez sur https://console.firebase.google.com
//    Créez un projet → Realtime Database → Démarrer en mode test
//    Paramètres du projet → Vos applications → SDK → Copier les valeurs ici
// ══════════════════════════════════════════
const FB_CONFIG = {
  apiKey:            "REMPLACER_API_KEY",
  authDomain:        "REMPLACER_PROJECT_ID.firebaseapp.com",
  databaseURL:       "https://REMPLACER_PROJECT_ID-default-rtdb.firebaseio.com",
  projectId:         "REMPLACER_PROJECT_ID",
  storageBucket:     "REMPLACER_PROJECT_ID.appspot.com",
  messagingSenderId: "REMPLACER_SENDER_ID",
  appId:             "REMPLACER_APP_ID"
};
const FB_PATH = 'sla_virement'; // Chemin racine dans Firebase

// ══════════════════════════════════════════
//  FIREBASE — Fonctions de synchronisation
// ══════════════════════════════════════════
let fbDB = null;

function firebaseConfigured() {
  return !FB_CONFIG.apiKey.includes('REMPLACER') && FB_CONFIG.databaseURL.startsWith('https://');
}

function initFirebase() {
  if (!firebaseConfigured()) { console.info('[Firebase] Config non renseignée — mode local'); return; }
  try {
    if (typeof firebase === 'undefined') { console.warn('[Firebase] SDK non chargé'); return; }
    if (!firebase.apps.length) firebase.initializeApp(FB_CONFIG);
    fbDB = firebase.database();
    console.log('[Firebase] Connecté');
  } catch(e) { console.error('[Firebase] Init:', e); fbDB = null; }
}

async function syncFromFirebase() {
  if (!fbDB) return;
  const MAP = [
    ['params','virement_params'], ['users','app_users'],
    ['historique','virement_historique'], ['orders','virement_orders'],
    ['counters','virement_counters'],
  ];
  try {
    const timeout = new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 6000));
    const snap = await Promise.race([fbDB.ref(FB_PATH).once('value'), timeout]);
    const data = snap.val() || {};
    MAP.forEach(([fk, lk]) => { if (data[fk] != null) localStorage.setItem(lk, data[fk]); });
    console.log('[Firebase] Données synchronisées');
  } catch(e) { console.warn('[Firebase] Mode hors-ligne :', e.message); }
}

function fbSave(fbKey, lsKey) {
  if (!fbDB) return;
  const val = localStorage.getItem(lsKey);
  if (val == null) return;
  fbDB.ref(FB_PATH + '/' + fbKey).set(val)
    .catch(e => console.error('[Firebase] Write ' + fbKey + ':', e));
}

function subscribeToOrders() {
  if (!fbDB) return;
  fbDB.ref(FB_PATH + '/orders').on('value', snap => {
    const val = snap.val();
    if (val == null) return;
    if (localStorage.getItem('virement_orders') === val) return;
    localStorage.setItem('virement_orders', val);
    updateInboxBadge();
    const p = document.getElementById('panel-inbox');
    if (p && p.classList.contains('active')) renderInbox();
  });
}

function subscribeToUsers() {
  if (!fbDB) return;
  fbDB.ref(FB_PATH + '/users').on('value', snap => {
    const val = snap.val();
    if (val != null) localStorage.setItem('app_users', val);
  });
}

// ══════════════════════════════════════════
//  PARAMÈTRES (stockés en localStorage + Firebase)
// ══════════════════════════════════════════
let params = {
  banques: [
    { nom: 'SGBCI', compte: 'CI93CI0080111301234500014', iban: 'CI93CI0080111301234500014', swift: 'SGBCCIAB', rib: '00803 00650 01234567890 45', contact: 'Directeur' },
    { nom: 'BICICI', compte: 'CI93CI0014001234567890123', iban: 'CI93CI0014001234567890123', swift: 'BICIABAB', rib: '00140 01400 12345678901 23', contact: 'Directeur' },
    { nom: 'ECOBANK', compte: 'CI93CI0020001234567890123', iban: 'CI93CI0020001234567890123', swift: 'ECOBCIAB', rib: '00200 00120 12345678901 23', contact: 'Directeur' },
    { nom: 'BRIDGE BANK GROUP', compte: 'CI93CI0059001234567890123', iban: 'CI93CI0059001234567890123', swift: 'BRBKCIAB', rib: '00590 00120 12345678901 23', contact: 'Directeur' },
  ],
  banques_ben: [
    { nom: 'SGBCI', iban: 'CI93CI0080111301234500014', swift: 'SGBCCIAB' },
    { nom: 'BICICI', iban: 'CI93CI0014001234567890123', swift: 'BICIABAB' },
    { nom: 'ECOBANK', iban: 'CI93CI0020001234567890123', swift: 'ECOBCIAB' },
    { nom: 'DEUTSCHE BANK AG', iban: 'DE89370400440532013000', swift: 'DEUTDEDB' },
  ],
  beneficiaires: [
    { nom: 'Exemple Fournisseur SA', banque: 'SGBCI', iban: 'CI93CI0080111301234500014', swift: 'SGBCCIAB' },
  ],
  devises: ['FCFA', 'XOF', 'EUR', 'USD', 'GBP', 'CHF'],
  societe:   'SANLAMALLIANZ CI ASSURANCES',
  adresse:   'Abidjan Plateau, Côte d\'Ivoire',
  telephone: '',
  ville:     'ABIDJAN',
  devise_niv: 'XOF',
  motif_niv:  'ODOD/NIVELLEMENT',
  banque_rea: 'DEUTSCHE BANK AG',
  motif_fac:    'FGFG',
  motif_rea:    'PFAC',
  entete_ordre: '',
  pied_ordre:   '',
  signataires:  [],
  nb_signatures: 2,
};

function loadParams() {
  const saved = localStorage.getItem('virement_params');
  if (saved) { try { params = JSON.parse(saved); } catch(e) {} }
}

function saveParams() {
  params.societe   = document.getElementById('param_societe').value   || params.societe;
  params.adresse   = document.getElementById('param_adresse').value   || params.adresse;
  params.telephone = document.getElementById('param_telephone').value || params.telephone;
  params.ville     = document.getElementById('param_ville').value     || params.ville;
  params.devise_niv= document.getElementById('param_devise_niv').value|| params.devise_niv;
  params.motif_niv = document.getElementById('param_motif_niv').value || params.motif_niv;
  params.banque_rea= document.getElementById('param_banque_rea').value|| params.banque_rea;
  params.motif_fac    = document.getElementById('param_motif_fac').value    || params.motif_fac;
  params.motif_rea    = document.getElementById('param_motif_rea').value    || params.motif_rea;
  const entEl = document.getElementById('param_entete_ordre');
  const piedEl = document.getElementById('param_pied_ordre');
  params.entete_ordre = entEl  ? entEl.value  : (params.entete_ordre || '');
  params.pied_ordre   = piedEl ? piedEl.value : (params.pied_ordre   || '');
  const rows = document.querySelectorAll('#banques-tbody tr');
  params.banques = [];
  rows.forEach(row => {
    const inputs = row.querySelectorAll('input');
    if (inputs[0].value.trim()) {
      params.banques.push({ nom:inputs[0].value, compte:inputs[1].value, iban:inputs[2].value, swift:inputs[3].value, rib:inputs[4].value, contact:inputs[5].value });
    }
  });
  const rowsBen = document.querySelectorAll('#banques-ben-tbody tr');
  params.banques_ben = [];
  rowsBen.forEach(row => {
    const inputs = row.querySelectorAll('input');
    if (inputs[0].value.trim()) {
      params.banques_ben.push({ nom:inputs[0].value, iban:inputs[1].value, swift:inputs[2].value });
    }
  });
  // Signataires
  const sigRows = document.querySelectorAll('#signataires-tbody tr');
  params.signataires = [];
  sigRows.forEach(row => {
    const inp = row.querySelectorAll('input');
    const nom = inp[0] && inp[0].value.trim();
    const titre = inp[1] ? inp[1].value.trim() : '';
    if (nom) params.signataires.push({ nom, titre });
  });
  const nbSigEl = document.getElementById('param_nb_signatures');
  if (nbSigEl) params.nb_signatures = parseInt(nbSigEl.value) || 2;

  saveBeneficiaires();
  saveDevises();
  localStorage.setItem('virement_params', JSON.stringify(params));
  fbSave('params', 'virement_params');
  refreshBanqueSelects();
  refreshBeneficiaireSelects();
  refreshDeviseSelects();
  applyCustomization();
  showToast('Paramètres sauvegardés !', 'success');
}

function exportParams() {
  const blob = new Blob([JSON.stringify(params, null, 2)], { type:'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'parametres_virement.json'; a.click();
}

function importParams(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      params = JSON.parse(e.target.result);
      localStorage.setItem('virement_params', JSON.stringify(params));
      fbSave('params', 'virement_params');
      renderParamPanel(); refreshBanqueSelects();
      showToast('Parametres importes !', 'success');
    } catch(err) { showToast('Erreur import', 'error'); }
  };
  reader.readAsText(file);
}

// ══════════════════════════════════════════
//  ETAPE 1 — VALIDATION DES CHAMPS OBLIGATOIRES
// ══════════════════════════════════════════
const REQUIRED_FIELDS = {
  facture:      ['fac_date','fac_ref','fac_banque','fac_beneficiaire_sel','fac_devise','fac_montant'],
  bancassurance:['ban_date','ban_ref','ban_banque','ban_montant','ban_beneficiaire_sel'],
  nivellement:  ['niv_date','niv_ref','niv_banque','niv_montant'],
  reassurance:  ['rea_date','rea_ref','rea_banque','rea_beneficiaire_sel','rea_devise','rea_montant'],
  sinistre:     ['sin_date','sin_ref','sin_banque','sin_beneficiaire_sel','sin_devise','sin_montant','sin_police'],
};

function validateForm(type) {
  const fields = REQUIRED_FIELDS[type] || [];
  let valid = true;
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const empty = el.tagName === 'SELECT'
      ? (el.value === '' || el.value === '__autre__')
      : el.value.trim() === '';
    const fd = el.closest('.field');
    if (fd) fd.classList.toggle('error', empty);
    if (empty) valid = false;
  });
  return valid;
}

function clearValidation(type) {
  (REQUIRED_FIELDS[type] || []).forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const fd = el.closest('.field');
    if (fd) fd.classList.remove('error');
    const evt = el.tagName === 'SELECT' ? 'change' : 'input';
    el.addEventListener(evt, () => { if (fd) fd.classList.remove('error'); });
  });
}

// ══════════════════════════════════════════
//  ETAPE 2 — DATE AUTOMATIQUE AU CHARGEMENT
// ══════════════════════════════════════════
function todayFR() {
  return new Date().toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' });
}

function fillDateAuto(prefix) {
  const el = document.getElementById(prefix + '_date');
  if (el && !el.value) el.value = todayFR();
}

// ══════════════════════════════════════════
//  ETAPE 3 — MONTANT EN LETTRES (francais)
// ══════════════════════════════════════════
function numberToWords(n) {
  const u = ['','un','deux','trois','quatre','cinq','six','sept','huit','neuf',
             'dix','onze','douze','treize','quatorze','quinze','seize','dix-sept','dix-huit','dix-neuf'];
  const d = ['','','vingt','trente','quarante','cinquante','soixante','soixante','quatre-vingt','quatre-vingt'];

  function lt100(x) {
    if (x < 20) return u[x];
    const di = Math.floor(x/10), un = x%10;
    if (di === 7) return 'soixante-' + u[10+un];
    if (di === 9) return un===0 ? 'quatre-vingts' : 'quatre-vingt-' + u[10+un];
    if (un === 0) return d[di] + (di===8?'s':'');
    if (un === 1 && di !== 8) return d[di] + '-et-un';
    return d[di] + '-' + u[un];
  }

  function lt1000(x) {
    if (x < 100) return lt100(x);
    const c = Math.floor(x/100), r = x%100;
    const cents = c===1 ? 'cent' : u[c]+' cent'+(r===0?'s':'');
    return r===0 ? cents : cents+' '+lt100(r);
  }

  if (n===0) return 'zero';
  if (n<0) return 'moins '+numberToWords(-n);
  let res = '';
  if (n>=1000000000) { const b=Math.floor(n/1000000000); res+=lt1000(b)+(b===1?' milliard ':' milliards '); n%=1000000000; }
  if (n>=1000000)    { const m=Math.floor(n/1000000);    res+=lt1000(m)+(m===1?' million ':' millions ');   n%=1000000;    }
  if (n>=1000)       { const k=Math.floor(n/1000);       res+=(k===1?'mille':lt1000(k)+' mille')+' ';       n%=1000;       }
  if (n>0) res+=lt1000(n);
  return res.trim();
}

function getDeviseLabel(code) {
  const map = {
    'FCFA':'francs CFA', 'XOF':'francs CFA', 'XAF':'francs CFA',
    'EUR':'euros', 'USD':'dollars américains', 'GBP':'livres sterling',
    'CHF':'francs suisses', 'MAD':'dirhams marocains', 'NGN':'nairas nigérians',
    'GHS':'cedis ghanéens', 'KES':'shillings kenyans', 'ZAR':'rands sud-africains',
    'JPY':'yens', 'CNY':'yuans', 'CAD':'dollars canadiens', 'AUD':'dollars australiens',
  };
  if (!code || code === '__autre__' || code === '') return 'francs CFA';
  const upper = code.toUpperCase();
  if (map[upper]) return map[upper];
  // Devise ajoutée manuellement : retourner le code tel quel en minuscules
  return code.toLowerCase();
}

function montantToLettre(inputId, outputId, deviseSelectId) {
  const inp = document.getElementById(inputId);
  const out = document.getElementById(outputId);
  if (!inp || !out) return;
  const raw = inp.value.replace(/[\s ]/g,'').replace(',','.');
  const num = parseFloat(raw);
  if (!isNaN(num) && num >= 0) {
    const w = numberToWords(Math.floor(num));
    const devCode = deviseSelectId
      ? (document.getElementById(deviseSelectId)?.value || 'FCFA')
      : 'FCFA';
    const label = getDeviseLabel(devCode);
    out.value = w.charAt(0).toUpperCase() + w.slice(1) + ' ' + label;
  } else {
    out.value = '';
  }
}

// ══════════════════════════════════════════
//  ETAPE 4 — NUMEROTATION AUTOMATIQUE DES REFERENCES
// ══════════════════════════════════════════
const REF_CODES = { facture:'FIN', bancassurance:'BC', nivellement:'NIV', reassurance:'REA', sinistre:'SIN' };

function peekNextRef(type) {
  const year = new Date().getFullYear();
  const counters = JSON.parse(localStorage.getItem('virement_counters') || '{}');
  const num = String((counters[year+'_'+type]||0)+1).padStart(3,'0');
  return year+'/'+REF_CODES[type]+'/'+num;
}

function incrementRef(type) {
  const year = new Date().getFullYear();
  const counters = JSON.parse(localStorage.getItem('virement_counters') || '{}');
  const key = year+'_'+type;
  counters[key] = (counters[key]||0)+1;
  localStorage.setItem('virement_counters', JSON.stringify(counters));
  fbSave('counters', 'virement_counters');
}

function fillRefAuto(prefix, type) {
  const el = document.getElementById(prefix+'_ref');
  if (el && !el.value) el.value = peekNextRef(type);
}

// ══════════════════════════════════════════
//  ETAPE 5 — SAUVEGARDE AUTOMATIQUE DU FORMULAIRE
// ══════════════════════════════════════════
const DRAFT_FIELDS = {
  facture:      ['fac_date','fac_ref','fac_banque','fac_attention','fac_compte_debit','fac_beneficiaire_sel','fac_beneficiaire','fac_devise','fac_montant','fac_montant_lettre','fac_banque_ben_nom','fac_iban','fac_swift','fac_motif','fac_ref_facture','fac_frais'],
  bancassurance:['ban_date','ban_ref','ban_ordre','ban_attention','ban_banque','ban_compte_ref','ban_type_commission','ban_num_commission','ban_montant','ban_montant_lettre','ban_beneficiaire_sel','ban_beneficiaire'],
  nivellement:  ['niv_date','niv_ref','niv_banque','niv_attention','niv_compte_debit','niv_rib','niv_montant','niv_montant_lettre'],
  reassurance:  ['rea_date','rea_ref','rea_banque','rea_attention','rea_compte_debit','rea_beneficiaire_sel','rea_beneficiaire','rea_devise','rea_montant','rea_montant_lettre','rea_banque_ben_nom','rea_iban','rea_swift','rea_motif','rea_police'],
  sinistre:     ['sin_date','sin_ref','sin_banque','sin_attention','sin_compte_debit','sin_beneficiaire_sel','sin_beneficiaire','sin_devise','sin_montant','sin_montant_lettre','sin_banque_ben_nom','sin_iban','sin_swift','sin_police'],
};
const _draftTimers = {};

function saveFormDraft(type) {
  clearTimeout(_draftTimers[type]);
  _draftTimers[type] = setTimeout(() => {
    const draft = {};
    (DRAFT_FIELDS[type]||[]).forEach(id => { const el=document.getElementById(id); if(el) draft[id]=el.value; });
    localStorage.setItem('draft_'+type, JSON.stringify(draft));
  }, 600);
}

function restoreFormDraft(type) {
  const raw = localStorage.getItem('draft_'+type);
  if (!raw) return;
  try {
    const draft = JSON.parse(raw);
    Object.entries(draft).forEach(([id,val]) => { const el=document.getElementById(id); if(el&&val!==undefined) el.value=val; });
  } catch(e) {}
}

function setupDraftAutoSave(type) {
  (DRAFT_FIELDS[type]||[]).forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener(el.tagName==='SELECT'?'change':'input', () => saveFormDraft(type));
  });
}

// ══════════════════════════════════════════
//  UI — NAVIGATION
// ══════════════════════════════════════════
const PANEL_META = {
  facture:      { prefix:'fac', type:'facture'       },
  bancassurance:{ prefix:'ban', type:'bancassurance'  },
  nivellement:  { prefix:'niv', type:'nivellement'    },
  reassurance:  { prefix:'rea', type:'reassurance'    },
  sinistre:     { prefix:'sin', type:'sinistre'       },
};

function showPanel(name) {
  // Vérifier les droits d'accès
  const permMap = { parametres:'parametres', historique:'historique', utilisateurs:'gestionUsers', inbox:'inbox' };
  if (permMap[name] && !hasPerm(permMap[name])) {
    showToast('Accès refusé pour votre niveau d\'habilitation', 'error');
    name = 'facture';
  }

  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const panelEl = document.getElementById('panel-'+name);
  if (panelEl) panelEl.classList.add('active');

  // Activer le bon élément nav par ID
  const navId = { historique:'nav-historique', parametres:'nav-parametres', utilisateurs:'nav-utilisateurs', inbox:'nav-inbox' };
  if (navId[name]) {
    const navEl = document.getElementById(navId[name]);
    if (navEl) navEl.classList.add('active');
  } else {
    const order = ['facture','bancassurance','nivellement','reassurance','sinistre'];
    const idx = order.indexOf(name);
    if (idx >= 0) document.querySelectorAll('.nav-item')[idx].classList.add('active');
  }
  if (name === 'parametres')   renderParamPanel();
  if (name === 'historique')   renderHistorique();
  if (name === 'utilisateurs') renderUsersPanel();
  if (name === 'inbox')        renderInbox();
  const meta = PANEL_META[name];
  if (meta) {
    restoreFormDraft(meta.type);
    fillDateAuto(meta.prefix);
    fillRefAuto(meta.prefix, meta.type);
    clearValidation(meta.type);
  }
}

// ══════════════════════════════════════════
//  PARAMETRES — rendu tableau banques
// ══════════════════════════════════════════
function renderParamPanel() {
  document.getElementById('param_societe').value   = params.societe   || '';
  document.getElementById('param_adresse').value   = params.adresse   || '';
  document.getElementById('param_telephone').value = params.telephone || '';
  document.getElementById('param_ville').value     = params.ville     || 'ABIDJAN';
  document.getElementById('param_devise_niv').value= params.devise_niv|| 'XOF';
  document.getElementById('param_motif_niv').value = params.motif_niv || '';
  document.getElementById('param_banque_rea').value= params.banque_rea|| '';
  document.getElementById('param_motif_fac').value = params.motif_fac || '';
  document.getElementById('param_motif_rea').value = params.motif_rea || '';
  const entEl2 = document.getElementById('param_entete_ordre');
  const piedEl2 = document.getElementById('param_pied_ordre');
  if (entEl2)  entEl2.value  = params.entete_ordre || '';
  if (piedEl2) piedEl2.value = params.pied_ordre   || '';
  const nbEl = document.getElementById('param_nb_signatures');
  if (nbEl) nbEl.value = params.nb_signatures || 2;
  renderSigTable();
  renderBanquesTable();
  renderBanquesBenTable();
  renderBeneficiairesTable();
  renderDevisesList();
  applyCustomization();
}

function renderBanquesTable() {
  const tbody = document.getElementById('banques-tbody');
  tbody.innerHTML = '';
  params.banques.forEach((b, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input value="${b.nom||''}" placeholder="Nom banque"></td>
      <td><input value="${b.compte||''}" placeholder="N° compte"></td>
      <td><input value="${b.iban||''}" placeholder="IBAN"></td>
      <td><input value="${b.swift||''}" placeholder="Swift"></td>
      <td><input value="${b.rib||''}" placeholder="RIB"></td>
      <td><input value="${b.contact||''}" placeholder="M. ..."></td>
      <td><button class="btn btn-danger" style="padding:4px 8px;font-size:11px" onclick="removeBanque(${i})">X</button></td>`;
    tbody.appendChild(tr);
  });
  document.getElementById('banques-count').textContent = params.banques.length+' banque(s)';
}

function renderBanquesBenTable() {
  if (!params.banques_ben) params.banques_ben = [];
  const tbody = document.getElementById('banques-ben-tbody');
  tbody.innerHTML = '';
  params.banques_ben.forEach((b, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input value="${b.nom||''}" placeholder="Nom banque beneficiaire"></td>
      <td><input value="${b.iban||''}" placeholder="IBAN"></td>
      <td><input value="${b.swift||''}" placeholder="Swift Code"></td>
      <td><button class="btn btn-danger" style="padding:4px 8px;font-size:11px" onclick="removeBanqueBen(${i})">X</button></td>`;
    tbody.appendChild(tr);
  });
  document.getElementById('banques-ben-count').textContent = params.banques_ben.length+' banque(s)';
}

function addBanque()    { params.banques.push({nom:'',compte:'',iban:'',swift:'',rib:'',contact:''}); renderBanquesTable(); }
function addBanqueBen() { if(!params.banques_ben) params.banques_ben=[]; params.banques_ben.push({nom:'',iban:'',swift:''}); renderBanquesBenTable(); }
function removeBanque(i)   { params.banques.splice(i,1); renderBanquesTable(); }
function removeBanqueBen(i){ params.banques_ben.splice(i,1); renderBanquesBenTable(); }

// ══════════════════════════════════════════
//  SELECTS banques dans les formulaires
// ══════════════════════════════════════════
function refreshBanqueSelects() {
  ['fac_banque','ban_banque','niv_banque','rea_banque','sin_banque'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="">— Selectionner —</option>';
    params.banques.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.nom; opt.textContent = b.nom;
      if (b.nom === cur) opt.selected = true;
      sel.appendChild(opt);
    });
    const opt2 = document.createElement('option');
    opt2.value = '__autre__'; opt2.textContent = '-- Autre (saisie manuelle) --';
    sel.appendChild(opt2);
  });
  refreshBeneficiaireSelects();
  refreshDeviseSelects();
  if (!params.banques_ben) params.banques_ben = [];
  ['fac_banque_ben','sin_banque_ben','rea_banque_ben'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="">— Selectionner la banque —</option>';
    params.banques_ben.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.nom;
      opt.textContent = b.nom + (b.swift ? '  ('+b.swift+')' : '');
      if (b.nom === cur) opt.selected = true;
      sel.appendChild(opt);
    });
    const opt2 = document.createElement('option');
    opt2.value = '__autre__'; opt2.textContent = '-- Autre (saisie manuelle) --';
    sel.appendChild(opt2);
  });
}

function autoFillBanque(prefix, selectId, compteField, ibanField, swiftField) {
  const banqueNom = document.getElementById(selectId).value;
  const banque = params.banques.find(b => b.nom === banqueNom);
  if (!banque || banqueNom === '__autre__') return;
  if (compteField) { const el=document.getElementById(prefix+'_'+compteField); if(el) el.value=banque.compte||''; }
  if (ibanField)   { const el=document.getElementById(prefix+'_'+ibanField);   if(el) el.value=(ibanField==='rib')?(banque.rib||''):(banque.iban||''); }
  if (swiftField)  { const el=document.getElementById(prefix+'_'+swiftField);  if(el) el.value=banque.swift||''; }
  const attn = document.getElementById(prefix+'_attention');
  if (attn && !attn.value && banque.contact) attn.value = banque.contact;
  const typeMap = {fac:'facture',ban:'bancassurance',niv:'nivellement',rea:'reassurance',sin:'sinistre'};
  saveFormDraft(typeMap[prefix]||prefix);
}

function autoFillBanqueBen(prefix, selectId, ibanField, swiftField) {
  const banqueNom = document.getElementById(selectId).value;
  const banque = (params.banques_ben||[]).find(b => b.nom === banqueNom);
  const ibanEl  = document.getElementById(prefix+'_'+ibanField);
  const swiftEl = document.getElementById(prefix+'_'+swiftField);
  if (!banque || banqueNom === '__autre__') {
    if (ibanEl)  { ibanEl.readOnly=false;  ibanEl.classList.remove('autofill');  ibanEl.placeholder='Saisir manuellement'; ibanEl.value=''; }
    if (swiftEl) { swiftEl.readOnly=false; swiftEl.classList.remove('autofill'); swiftEl.placeholder='Saisir manuellement'; swiftEl.value=''; }
    return;
  }
  if (ibanEl)  { ibanEl.value=banque.iban||'';  ibanEl.readOnly=true;  ibanEl.classList.add('autofill'); }
  if (swiftEl) { swiftEl.value=banque.swift||''; swiftEl.readOnly=true; swiftEl.classList.add('autofill'); }
}

// ══════════════════════════════════════════
//  BÉNÉFICIAIRES — paramètres et auto-remplissage
// ══════════════════════════════════════════
function renderBeneficiairesTable() {
  if (!params.beneficiaires) params.beneficiaires = [];
  const tbody = document.getElementById('beneficiaires-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  params.beneficiaires.forEach((b, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input value="${b.nom||''}" placeholder="Nom du bénéficiaire"></td>
      <td><input value="${b.banque||''}" placeholder="Nom de la banque"></td>
      <td><input value="${b.iban||''}" placeholder="IBAN / N° compte"></td>
      <td><input value="${b.swift||''}" placeholder="Code Swift"></td>
      <td><button class="btn btn-danger" style="padding:4px 8px;font-size:11px" onclick="removeBeneficiaire(${i})">X</button></td>`;
    tbody.appendChild(tr);
  });
  const el = document.getElementById('beneficiaires-count');
  if (el) el.textContent = params.beneficiaires.length + ' beneficiaire(s)';
}

function addBeneficiaire() {
  if (!params.beneficiaires) params.beneficiaires = [];
  params.beneficiaires.push({ nom:'', banque:'', iban:'', swift:'' });
  renderBeneficiairesTable();
}

function removeBeneficiaire(i) {
  params.beneficiaires.splice(i, 1);
  renderBeneficiairesTable();
}

function saveBeneficiaires() {
  const rows = document.querySelectorAll('#beneficiaires-tbody tr');
  params.beneficiaires = [];
  rows.forEach(row => {
    const inputs = row.querySelectorAll('input');
    if (inputs[0].value.trim()) {
      params.beneficiaires.push({ nom:inputs[0].value, banque:inputs[1].value, iban:inputs[2].value, swift:inputs[3].value });
    }
  });
  localStorage.setItem('virement_params', JSON.stringify(params));
  refreshBeneficiaireSelects();
  showToast('Bénéficiaires sauvegardés !', 'success');
}

function refreshBeneficiaireSelects() {
  if (!params.beneficiaires) params.beneficiaires = [];
  ['fac_beneficiaire_sel','ban_beneficiaire_sel','rea_beneficiaire_sel','sin_beneficiaire_sel'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="">— Selectionner un beneficiaire —</option>';
    params.beneficiaires.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.nom;
      opt.textContent = b.nom + (b.banque ? ' — ' + b.banque : '');
      if (b.nom === cur) opt.selected = true;
      sel.appendChild(opt);
    });
    const opt2 = document.createElement('option');
    opt2.value = '__autre__'; opt2.textContent = '-- Saisie manuelle --';
    if ('__autre__' === cur) opt2.selected = true;
    sel.appendChild(opt2);
  });
}

function autoFillBeneficiaire(prefix) {
  const sel = document.getElementById(prefix + '_beneficiaire_sel');
  if (!sel) return;
  const nom = sel.value;
  const b = (params.beneficiaires || []).find(x => x.nom === nom);
  const isManuel = nom === '__autre__' || !nom;

  const manuelZone = document.getElementById(prefix + '_ben_manuel');
  if (manuelZone) manuelZone.style.display = isManuel ? '' : 'none';

  const nomEl   = document.getElementById(prefix + '_beneficiaire');
  const bnkEl   = document.getElementById(prefix + '_banque_ben_nom');
  const ibanEl  = document.getElementById(prefix + '_iban');
  const swiftEl = document.getElementById(prefix + '_swift');

  if (isManuel || !b) {
    [nomEl, bnkEl, ibanEl, swiftEl].forEach(el => {
      if (!el) return;
      el.readOnly = false; el.classList.remove('autofill'); el.value = '';
      el.placeholder = 'Saisir manuellement';
    });
    return;
  }
  if (nomEl)  { nomEl.value  = b.nom    || ''; nomEl.readOnly  = true; nomEl.classList.add('autofill'); }
  if (bnkEl)  { bnkEl.value  = b.banque || ''; bnkEl.readOnly  = true; bnkEl.classList.add('autofill'); }
  if (ibanEl) { ibanEl.value = b.iban   || ''; ibanEl.readOnly = true; ibanEl.classList.add('autofill'); }
  if (swiftEl){ swiftEl.value= b.swift  || ''; swiftEl.readOnly= true; swiftEl.classList.add('autofill'); }

  const typeMap = {fac:'facture',ban:'bancassurance',niv:'nivellement',rea:'reassurance',sin:'sinistre'};
  saveFormDraft(typeMap[prefix] || prefix);
}

// ══════════════════════════════════════════
//  DEVISES — paramètres et sélects
// ══════════════════════════════════════════
function renderDevisesList() {
  const container = document.getElementById('devises-list');
  if (!container) return;
  const devises = params.devises || ['FCFA', 'XOF', 'EUR', 'USD'];
  container.innerHTML = '';
  devises.forEach((d, i) => {
    const div = document.createElement('div');
    div.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:6px';
    div.innerHTML = `<input value="${d}" style="flex:1;padding:7px 10px;border:1.5px solid #cbd5e1;border-radius:6px;font-size:13px" placeholder="Code devise (ex: EUR)">
      <button class="btn btn-danger" style="padding:4px 8px;font-size:11px" onclick="removeDevise(${i})">X</button>`;
    container.appendChild(div);
  });
  const el = document.getElementById('devises-count');
  if (el) el.textContent = devises.length + ' devise(s)';
}

function addDevise() {
  if (!params.devises) params.devises = [];
  params.devises.push('');
  renderDevisesList();
}

function removeDevise(i) {
  params.devises.splice(i, 1);
  renderDevisesList();
}

function saveDevises() {
  const container = document.getElementById('devises-list');
  if (!container) return;
  params.devises = Array.from(container.querySelectorAll('input')).map(el => el.value.trim()).filter(v => v);
}

function refreshDeviseSelects() {
  const devises = params.devises || ['FCFA', 'XOF', 'EUR', 'USD'];
  ['fac_devise', 'rea_devise', 'sin_devise'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel || sel.tagName !== 'SELECT') return;
    const cur = sel.value;
    sel.innerHTML = '<option value="">— Devise —</option>';
    devises.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d; opt.textContent = d;
      if (d === cur) opt.selected = true;
      sel.appendChild(opt);
    });
    const opt2 = document.createElement('option');
    opt2.value = '__autre__'; opt2.textContent = 'Autre...';
    sel.appendChild(opt2);
  });
}

// ══════════════════════════════════════════
//  PREVIEW TEXTE
// ══════════════════════════════════════════
function g(id) { const el=document.getElementById(id); return el?el.value.trim():''; }

function buildText(type) {
  const texts = {
    facture: () => {
      const fraisMap = {
        'notre_charge':        'Tous les frais a notre charge',
        'partage':             'Frais partages entre le beneficiaire et nous',
        'beneficiaire_charge': 'Tous les frais a la charge du beneficiaire',
      };
      const fraisVal   = g('fac_frais') || 'notre_charge';
      const fraisTexte = fraisMap[fraisVal] || fraisMap['notre_charge'];
      const benNom     = g('fac_beneficiaire') || 'XXXXXXXXXXX';
      const benBanque  = g('fac_banque_ben_nom') || 'XXXXXXXXXXXXX';
      const devise     = g('fac_devise') !== '__autre__' ? (g('fac_devise')||'XXXXXXXXXXX') : 'XXXXXXXXXXX';
      const lettre     = g('fac_montant_lettre') || '';
      return `Abidjan, le ${g('fac_date')||'XXXXXXXX'}
N/Ref. : ${g('fac_ref')||'XXXXXXXX'}

${params.societe||'SANLAMALLIANZ CI ASSURANCES'}
ABIDJAN
A l'attention de M. ${g('fac_attention')||'XXXXXXXXXXXXXXXXX'}

Objet : Ordre de virement

Messieurs,

Par le debit de notre compte N° ${g('fac_compte_debit')||'XXXXXXXXXXX'}, nous vous remercions de virer au benefice du compte suivant :

- Beneficiaire    :   ${benNom}
- Devise          :   ${devise}
- Montant         :   ${g('fac_montant')||'XXXXXXXXXXX'}
- Montant lettre  :   ${lettre||'XXXXXXXXXXX'}
- Banque          :   ${benBanque}
- IBAN            :   ${g('fac_iban')||'XXXXXXXXXXXXXX'}
- Swift Code      :   ${g('fac_swift')||'XXXXXXXXXXXXX'}
- Motif           :   ${params.motif_fac||'FGFG'}/${g('fac_motif')||'XXXXXXXXXXXXXXXXXX'}
- Ref. Facture    :   ${g('fac_ref_facture')||'XXXXXXXXXXXXXXXXX'}
NB: ${fraisTexte}

Veuillez agreer, Messieurs, l'expression de nos sentiments distingues.


                        SIGNATURES AUTORISEES`;
    },
    bancassurance: () => {
      const lettre = g('ban_montant_lettre') || '';
      const benNom = g('ban_beneficiaire') || 'XXXXXXXXXXX';
      return `Abidjan, le ${g('ban_date')||'XXXXXXXX'}
N/Ref : ${g('ban_ref')||'XXXXXXXX'}
Ordre de virement ${g('ban_ordre')||'XXXXXXXXXX'}

ABIDJAN
A l'attention de M. ${g('ban_attention')||'XXXXXXXXXXXXXXXXX'}

Objet : Ordre de virement

Monsieur,

Par le debit de notre compte ${g('ban_compte_ref')||'XXXXXXXXXXX'} cite en reference, nous vous prions de bien vouloir proceder au reglement des commissions ${g('ban_type_commission')||'XXXXXXXXXX'} n°${g('ban_num_commission')||'XXXXXXXXXX'} d'un montant de :

                FCFA ${g('ban_montant')||'XXXXXXXXXXX'}
- Montant lettre  :   ${lettre||'XXXXXXXXXXX'}

En faveur de : ${benNom}

Veuillez agreer, Monsieur, l'expression de nos sentiments distingues.


                        SIGNATURES AUTORISEES`;
    },
    nivellement: () => {
      const lettre = g('niv_montant_lettre') || '';
      return `Abidjan, le ${g('niv_date')||'XXXXXXXX'}
N/Ref. : ${g('niv_ref')||'XXXXXXXX'}

${params.societe||'SANLAMALLIANZ CI ASSURANCES'}
ABIDJAN
A l'attention de M. ${g('niv_attention')||'XXXXXXXXXXXXXXXXX'}

Objet : Ordre de virement

Messieurs,

Par le debit de notre compte N° ${g('niv_compte_debit')||'XXXXXXXXXXX'}, nous vous remercions de virer au benefice du compte suivant :

- Beneficiaire    :   ${params.societe||'SANLAMALLIANZ CI ASSURANCES'}
- Devise          :   FCFA
- Montant         :   ${g('niv_montant')||'XXXXXXXXXXX'}
- Montant lettre  :   ${lettre||'XXXXXXXXXXX'}
- RIB             :   ${g('niv_rib')||'XXXXXXXXXXXXXXXXXXXXXX'}
- Motif           :   Nivellement de compte

Veuillez agreer, Messieurs, l'expression de nos sentiments distingues.


                        SIGNATURES AUTORISEES`;
    },
    reassurance: () => {
      const devise    = g('rea_devise') !== '__autre__' ? (g('rea_devise')||'XXXXX') : 'XXXXX';
      const lettre    = g('rea_montant_lettre') || '';
      const benNom    = g('rea_beneficiaire') || 'XXXXXXXXXXX';
      const benBanque = g('rea_banque_ben_nom') || 'XXXXXXXXXXXXX';
      return `Abidjan, le ${g('rea_date')||'XXXXXXXX'}
N/Ref. : ${g('rea_ref')||'XXXXXXXX'}

${params.societe||'SANLAMALLIANZ CI ASSURANCES'}
Abidjan
A l'attention de M. ${g('rea_attention')||'XXXXXXXXXXXXXXXXX'}

Objet : Ordre de virement

Messieurs,

Par le debit de notre compte, ${g('rea_compte_debit')||'XXXXXXXXXXX'}, nous vous remercions de virer au benefice du compte suivant :

- Beneficiaire    :   ${benNom}
- Devise          :   ${devise}
- Montant         :   ${g('rea_montant')||'XXXXXXXXXXX'}
- Montant lettre  :   ${lettre||'XXXXXXXXXXX'}
- Banque          :   ${benBanque}
- IBAN            :   ${g('rea_iban')||'XXXXXXXXXXXXXX'}
- Swift Code      :   ${g('rea_swift')||'XXXXXXXXXXXXX'}
- Motif           :   ${params.banque_rea||'PFAC'} / ${g('rea_motif')||'XXXXXXXXXXXXXXXXXX'}
   Pol ${g('rea_police')||'XXXXXXXXXXXXXXXXXX'}

Veuillez agreer, Messieurs, l'expression de nos sentiments distingues.


                        SIGNATURES AUTORISEES`;
    },
    sinistre: () => {
      const devise    = g('sin_devise') !== '__autre__' ? (g('sin_devise')||'XXXXXXXX') : 'XXXXXXXX';
      const lettre    = g('sin_montant_lettre') || '';
      const benNom    = g('sin_beneficiaire') || 'XXXXXXXXXXX';
      const benBanque = g('sin_banque_ben_nom') || 'XXXXXXXXXXXXX';
      return `Abidjan, le ${g('sin_date')||'XXXXXXXX'}
N/Ref. : ${g('sin_ref')||'XXXXXXXX'}

${params.societe||'SANLAMALLIANZ CI ASSURANCES'}
ABIDJAN
A l'attention de M. ${g('sin_attention')||'XXXXXXXXXXXXXXXXX'}

Objet : Ordre de virement

Messieurs,

Par le debit de notre compte N° ${g('sin_compte_debit')||'XXXXXXXXXXX'}, nous vous remercions de virer au benefice du compte suivant :

- Beneficiaire    :   ${benNom}
- Devise          :   ${devise}
- Montant         :   ${g('sin_montant')||'XXXXXXXXXXX'}
- Montant lettre  :   ${lettre||'XXXXXXXXXXX'}
- Banque          :   ${benBanque}
- IBAN            :   ${g('sin_iban')||'XXXXXXXXXXXXXX'}
- Swift Code      :   ${g('sin_swift')||'XXXXXXXXXXXXX'}
- Motif           :   Reglement sinistre Pol${g('sin_police')||'XXXXXXXXXXXXXXXXXX'}

Veuillez agreer, Messieurs, l'expression de nos sentiments distingues.


                        SIGNATURES AUTORISEES`;
    },
  };
  return texts[type]();
}

function togglePreview(type) {
  const el = document.getElementById('preview-'+type);
  if (el.style.display==='block') { el.style.display='none'; return; }
  el.textContent = buildText(type);
  el.style.display = 'block';
}

function clearForm(type) {
  const prefixes = { facture:'fac',bancassurance:'ban',nivellement:'niv',reassurance:'rea',sinistre:'sin' };
  const px = prefixes[type];
  document.querySelectorAll(`[id^="${px}_"]`).forEach(el => {
    if (el.tagName==='SELECT') el.selectedIndex=0;
    else el.value='';
  });
  ['iban','swift'].forEach(f => {
    const el = document.getElementById(px+'_'+f);
    if (el) { el.readOnly=true; el.classList.add('autofill'); el.placeholder='Selectionner la banque ci-dessus'; }
  });
  document.getElementById('preview-'+type).style.display='none';
  clearValidation(type);
  localStorage.removeItem('draft_'+type);
  fillDateAuto(px);
  fillRefAuto(px, type);
}

// ══════════════════════════════════════════

// ══════════════════════════════════════════
//  SIGNATAIRES — GESTION ET SÉLECTION
// ══════════════════════════════════════════
function renderSigTable() {
  const tbody = document.getElementById('signataires-tbody');
  if (!tbody) return;
  const sigs = params.signataires || [];
  tbody.innerHTML = sigs.map((s, i) => `<tr>
    <td><input type="text" value="${(s.nom||'').replace(/"/g,'&quot;')}" placeholder="Prénom Nom" style="width:100%;padding:6px 8px;border:1px solid #e2e8f0;border-radius:6px;font-size:13px"></td>
    <td><input type="text" value="${(s.titre||'').replace(/"/g,'&quot;')}" placeholder="Directeur Général..." style="width:100%;padding:6px 8px;border:1px solid #e2e8f0;border-radius:6px;font-size:13px"></td>
    <td style="text-align:center"><button class="btn btn-danger" style="padding:4px 10px;font-size:12px" onclick="this.closest('tr').remove()">✕</button></td>
  </tr>`).join('') || '<tr><td colspan="3" style="text-align:center;color:#94a3b8;padding:18px;font-size:13px">Aucun signataire configuré — cliquez sur Ajouter</td></tr>';
}

function addSigRow() {
  const tbody = document.getElementById('signataires-tbody');
  if (!tbody) return;
  // Retirer la ligne "aucun signataire" si elle existe
  const empty = tbody.querySelector('td[colspan]');
  if (empty) empty.closest('tr').remove();
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="text" placeholder="Prénom Nom" style="width:100%;padding:6px 8px;border:1px solid #e2e8f0;border-radius:6px;font-size:13px"></td>
    <td><input type="text" placeholder="Directeur Général..." style="width:100%;padding:6px 8px;border:1px solid #e2e8f0;border-radius:6px;font-size:13px"></td>
    <td style="text-align:center"><button class="btn btn-danger" style="padding:4px 10px;font-size:12px" onclick="this.closest('tr').remove()">✕</button></td>`;
  tbody.appendChild(tr);
  tr.querySelector('input').focus();
}

// Promise-based modal pour choisir les 2 signataires avant génération
let _sigChooseResolve = null;

function chooseSignataires() {
  return new Promise(resolve => {
    _sigChooseResolve = resolve;
    const sigs = params.signataires || [];
    ['sig-choose-1','sig-choose-2'].forEach(id => {
      const sel = document.getElementById(id);
      if (!sel) return;
      sel.innerHTML = '<option value="">— Sélectionner —</option>';
      sigs.forEach((s, i) => {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = s.nom + (s.titre ? ' — ' + s.titre : '');
        sel.appendChild(opt);
      });
    });
    const errEl = document.getElementById('sig-choose-error');
    if (errEl) errEl.style.display = 'none';
    const modal = document.getElementById('sig-choose-modal');
    if (modal) modal.style.display = 'flex';
  });
}

function confirmSigChoose() {
  const errEl = document.getElementById('sig-choose-error');
  const idx1  = document.getElementById('sig-choose-1').value;
  const idx2  = document.getElementById('sig-choose-2').value;
  if (!idx1 || !idx2) {
    errEl.textContent = 'Veuillez sélectionner les 2 signataires.';
    errEl.style.display = 'block'; return;
  }
  if (idx1 === idx2) {
    errEl.textContent = 'Les deux signataires doivent être différents.';
    errEl.style.display = 'block'; return;
  }
  const sigs = params.signataires || [];
  const s1 = sigs[parseInt(idx1)];
  const s2 = sigs[parseInt(idx2)];
  document.getElementById('sig-choose-modal').style.display = 'none';
  if (_sigChooseResolve) { _sigChooseResolve([s1, s2]); _sigChooseResolve = null; }
}

function cancelSigChoose() {
  const modal = document.getElementById('sig-choose-modal');
  if (modal) modal.style.display = 'none';
  if (_sigChooseResolve) { _sigChooseResolve(null); _sigChooseResolve = null; }
}

//  ETAPE 6 — GENERATION WORD AVEC EN-TETE OFFICIELLE
// ══════════════════════════════════════════
async function genWord(type) {
  if (!validateForm(type)) {
    showToast('Veuillez remplir tous les champs obligatoires (*)', 'error');
    return;
  }
  let sig1 = null, sig2 = null;
  if ((params.signataires||[]).length >= (params.nb_signatures||2)) {
    const result = await chooseSignataires();
    if (!result) return;
    [sig1, sig2] = result;
  }
  try {
    const D = window.docx;
    if (!D) throw new Error('Bibliotheque docx non chargee');
    const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, WidthType, BorderStyle } = D;

    const text  = buildText(type);
    const lines = text.split('\n');

    const NB = {
      top:    {style:BorderStyle.NONE,size:0,color:'FFFFFF'},
      bottom: {style:BorderStyle.NONE,size:0,color:'FFFFFF'},
      left:   {style:BorderStyle.NONE,size:0,color:'FFFFFF'},
      right:  {style:BorderStyle.NONE,size:0,color:'FFFFFF'},
      insideH:{style:BorderStyle.NONE,size:0,color:'FFFFFF'},
      insideV:{style:BorderStyle.NONE,size:0,color:'FFFFFF'},
    };
    const FONT = 'Times New Roman';
    const SZ   = 22;
    const SZ_H = 28;

    function mkPara(txt, opts={}) {
      return new Paragraph({
        alignment: opts.align||AlignmentType.LEFT,
        spacing: { before:0, after:opts.after!==undefined?opts.after:80 },
        children: [new TextRun({ text:txt||'', bold:!!opts.bold, size:opts.size||SZ, font:FONT })]
      });
    }

    function mkLineRich(trim, opts={}) {
      const ci = trim.indexOf(':');
      let runs = [];
      if (ci>0 && ci<trim.length-1) {
        runs = [
          new TextRun({ text:trim.slice(0,ci+1), bold:false, size:SZ, font:FONT }),
          new TextRun({ text:trim.slice(ci+1),   bold:true,  size:SZ, font:FONT }),
        ];
      } else {
        runs = [new TextRun({ text:trim, bold:!!opts.allBold, size:SZ, font:FONT })];
      }
      return new Paragraph({ alignment:AlignmentType.LEFT, spacing:{before:0,after:opts.after!==undefined?opts.after:80}, children:runs });
    }

    const children = [];

    // EN-TETE OFFICIELLE
    if (params.entete_ordre) {
      // En-tête personnalisée — remplace l'en-tête standard
      params.entete_ordre.split('\n').forEach(line => {
        children.push(mkPara(line, {align:AlignmentType.CENTER, size:20, after:40}));
      });
    } else {
      children.push(mkPara(params.societe||'SANLAMALLIANZ CI ASSURANCES', { bold:true, align:AlignmentType.CENTER, size:SZ_H, after:60 }));
      if (params.adresse)   children.push(mkPara(params.adresse,            { align:AlignmentType.CENTER, size:20, after:40 }));
      if (params.telephone) children.push(mkPara('Tel. : '+params.telephone, { align:AlignmentType.CENTER, size:20, after:40 }));
    }
    children.push(new Paragraph({
      spacing:{before:0,after:200},
      border:{ bottom:{style:BorderStyle.SINGLE,size:8,color:'1e3a8a'} },
      children:[new TextRun({text:'',size:SZ,font:FONT})]
    }));

    // DATE (droite)
    children.push(new Table({
      width:{size:9026,type:WidthType.DXA}, columnWidths:[5513,3513], borders:NB,
      rows:[new TableRow({children:[
        new TableCell({borders:NB,width:{size:5513,type:WidthType.DXA},children:[mkPara('')]}),
        new TableCell({borders:NB,width:{size:3513,type:WidthType.DXA},children:[
          new Paragraph({alignment:AlignmentType.RIGHT,spacing:{before:0,after:80},
            children:[new TextRun({text:lines[0]||'',bold:true,size:SZ,font:FONT})]})
        ]}),
      ]})]
    }));

    // CORPS
    const userSigBase64 = getCurrentUserSignature();
    for (let i=1; i<lines.length; i++) {
      const trim = lines[i].trim();
      if (trim==='') { children.push(mkPara('',{after:160})); continue; }

      if (trim.includes('SIGNATURES AUTORISEES') || trim.includes('SIGNATURES AUTORISÉES')) {
        children.push(mkPara('', {after:320}));
        children.push(mkPara('SIGNATURES AUTORISEES', {bold:true, align:AlignmentType.CENTER, after:220}));
        const mkSigCell = (sigInfo) => {
          const cc = [mkPara('', {after:380})]; // espace pour la signature manuscrite
          cc.push(new Paragraph({
            alignment:AlignmentType.CENTER, spacing:{before:0,after:60},
            border:{bottom:{style:BorderStyle.SINGLE,size:4,color:'000000'}},
            children:[new TextRun({text:'',size:SZ,font:FONT})]
          }));
          if (sigInfo && sigInfo.nom) {
            cc.push(mkPara(sigInfo.nom, {align:AlignmentType.CENTER, bold:true, size:20, after:20}));
            if (sigInfo.titre) cc.push(mkPara(sigInfo.titre, {align:AlignmentType.CENTER, size:18, after:0}));
          }
          return new TableCell({borders:NB, width:{size:4513,type:WidthType.DXA}, children:cc});
        };
        children.push(new Table({
          width:{size:9026,type:WidthType.DXA}, columnWidths:[4513,4513], borders:NB,
          rows:[new TableRow({children:[mkSigCell(sig1), mkSigCell(sig2)]})]
        }));
        if (params.pied_ordre) {
          children.push(mkPara('', {after:240}));
          children.push(new Paragraph({
            spacing:{before:0,after:0},
            border:{top:{style:BorderStyle.SINGLE,size:4,color:'cccccc'}},
            children:[new TextRun({text:'',size:SZ,font:FONT})]
          }));
          children.push(mkPara(params.pied_ordre, {align:AlignmentType.CENTER, size:18, after:0}));
        }
      } else if (/^NB\s*:/i.test(trim)) {
        children.push(new Paragraph({
          alignment:AlignmentType.LEFT, spacing:{before:0,after:80},
          children:[new TextRun({text:trim, bold:true, color:'FF0000', size:SZ, font:FONT})]
        }));
      } else if (/^Ordre de virement/i.test(trim)) {
        children.push(mkPara(trim,{bold:true,after:80}));
      } else {
        children.push(mkLineRich(trim,{after:80}));
      }
    }

    const doc = new Document({
      sections:[{properties:{page:{size:{width:11906,height:16838},margin:{top:1134,right:1134,bottom:1134,left:1701}}},children}]
    });

    const blob = await Packer.toBlob(doc);
    const labels  = {facture:'FACTURE',bancassurance:'BANCASSURANCE',nivellement:'NIVELLEMENT',reassurance:'REASSURANCE',sinistre:'SINISTRE'};
    const dateIds = {facture:'fac_date',bancassurance:'ban_date',nivellement:'niv_date',reassurance:'rea_date',sinistre:'sin_date'};
    const dateVal = g(dateIds[type])||new Date().toLocaleDateString('fr-FR');
    const fname   = 'OV_'+labels[type]+'_'+dateVal.replace(/[\s\/]/g,'-')+'.docx';

    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fname;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);

    const histData = extractHistoryData(type);
    histData.fichier = fname;
    saveToHistory(type, histData);
    incrementRef(type);

    showToast('Fichier genere : '+fname, 'success');
  } catch(err) {
    console.error('genWord error:', err);
    showToast('Erreur : '+err.message, 'error');
  }
}

// ══════════════════════════════════════════
//  ETAPE 7 — IMPRESSION / EXPORT PDF
// ══════════════════════════════════════════
function getCurrentUserSignature() {
  const u = getCurrentUser();
  if (!u) return null;
  const users = getUsers();
  const full  = users.find(x => x.id === u.id);
  return (full && full.signature) ? full.signature : null;
}

async function printForm(type) {
  // Sélection des signataires si configurés
  let sig1 = null, sig2 = null;
  if ((params.signataires||[]).length >= (params.nb_signatures||2)) {
    const result = await chooseSignataires();
    if (!result) return;
    [sig1, sig2] = result;
  }

  const text      = buildText(type);
  const societe   = params.societe   || 'SANLAMALLIANZ CI ASSURANCES';
  const adresse   = params.adresse   || '';
  const telephone = params.telephone || '';
  const logoSrc   = params.logo      || '';

  const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  const enteteHtml = params.entete_ordre
    ? params.entete_ordre.split('\n').map(l => `<p style="margin:2px 0">${esc(l)}</p>`).join('')
    : '';
  const piedHtml = params.pied_ordre
    ? `<div style="border-top:1px solid #ccc;margin-top:20px;padding-top:8px;text-align:center;font-size:9.5pt;color:#555">${params.pied_ordre.split('\n').map(l=>esc(l)).join('<br>')}</div>`
    : '';

  const rawLines  = text.split('\n');
  const dateLine  = rawLines[0] || '';
  const bodyLines = rawLines.slice(1);

  let bodyHtml = '';
  for (const line of bodyLines) {
    const t = line.trim();
    if (t === '') { bodyHtml += '<div style="margin:6px 0"></div>'; continue; }
    if (/SIGNATURES AUTORISEES|SIGNATURES AUTORISÉES/i.test(t)) continue;
    if (/^NB\s*:/i.test(t)) {
      bodyHtml += `<p style="margin:3px 0;color:#cc0000;font-weight:bold">${esc(t)}</p>`;
    } else if (/^Ordre de virement/i.test(t)) {
      bodyHtml += `<p style="margin:3px 0;font-weight:bold">${esc(t)}</p>`;
    } else {
      const ci = t.indexOf(':');
      if (ci > 0 && t.startsWith('-') && ci < t.length - 1) {
        bodyHtml += `<p style="margin:2px 0"><span>${esc(t.slice(0,ci+1))}</span><strong>${esc(t.slice(ci+1))}</strong></p>`;
      } else {
        bodyHtml += `<p style="margin:3px 0">${esc(t)}</p>`;
      }
    }
  }

  const logoHtml = logoSrc ? `<img src="${logoSrc}" style="height:60px;margin-bottom:8px" alt="logo">` : '';

  const sigCellHtml = (sigInfo) => {
    const nameBlock = sigInfo && sigInfo.nom
      ? `<div style="font-weight:bold;font-size:10.5pt;margin-top:4px">${esc(sigInfo.nom)}</div>${sigInfo.titre?`<div style="font-size:9.5pt;color:#555">${esc(sigInfo.titre)}</div>`:''}`
      : '';
    return `<div class="sig-cell"><div style="height:65px"></div><div class="sig-line"></div>${nameBlock}</div>`;
  };

  const win = window.open('', '_blank', 'width=850,height=1000');
  win.document.write(`<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><title>Ordre de Virement</title>
<style>
  *{box-sizing:border-box}
  body{font-family:'Times New Roman',serif;font-size:12pt;margin:0;color:#000;background:#fff}
  .page{width:19cm;margin:1.2cm auto;padding:0}
  .hdr{text-align:center;border-bottom:2.5px solid #1e3a8a;padding-bottom:10px;margin-bottom:20px}
  .hdr h1{font-size:15pt;font-weight:bold;margin:0 0 3px}
  .hdr p{font-size:10pt;margin:2px 0;color:#444}
  .date-row{text-align:right;font-weight:bold;margin-bottom:14px;font-size:11pt}
  .body{line-height:1.9;font-size:11.5pt}
  .sig-title{font-weight:bold;text-align:center;font-size:12pt;margin:38px 0 18px;letter-spacing:1px}
  .sig-row{display:flex;gap:40px}
  .sig-cell{flex:1;text-align:center}
  .sig-cell .sig-line{border-top:1px solid #000;margin:0 8px 5px}
  .no-print{margin-top:28px;text-align:center}
  @media print{@page{size:A4;margin:2cm}.no-print{display:none}}
</style></head><body>
<div class="page">
  <div class="hdr">
    ${logoHtml}
    ${enteteHtml ? enteteHtml : `<h1>${esc(societe)}</h1>${adresse?`<p>${esc(adresse)}</p>`:''}${telephone?`<p>Tel. : ${esc(telephone)}</p>`:''}`}
  </div>
  <div class="date-row">${esc(dateLine)}</div>
  <div class="body">${bodyHtml}</div>
  <div class="sig-title">SIGNATURES AUTORISEES</div>
  <div class="sig-row">
    ${sigCellHtml(sig1)}
    ${sigCellHtml(sig2)}
  </div>
  ${piedHtml}
  <div class="no-print">
    <button onclick="window.print()" style="padding:10px 32px;font-size:13px;cursor:pointer;background:#1e3a8a;color:#fff;border:none;border-radius:6px">Imprimer / Enregistrer en PDF</button>
  </div>
</div></body></html>`);
  win.document.close();
}

// ──────────────────────────────────────────
//  SIGNATURE ÉLECTRONIQUE (N5)
// ──────────────────────────────────────────
let _sigCanvas = null, _sigCtx = null, _sigDrawing = false, _sigLastX = 0, _sigLastY = 0;

function openSignatureModal() {
  const overlay = document.getElementById('sig-modal-overlay');
  if (!overlay) return;
  overlay.style.display = 'flex';
  _sigCanvas = document.getElementById('sig-canvas');
  _sigCtx    = _sigCanvas.getContext('2d');
  clearSigCanvas();
  // Mouse
  _sigCanvas.onmousedown = e => { _sigDrawing=true; const r=_sigCanvas.getBoundingClientRect(); _sigLastX=e.clientX-r.left; _sigLastY=e.clientY-r.top; };
  _sigCanvas.onmousemove = e => {
    if (!_sigDrawing) return;
    const r=_sigCanvas.getBoundingClientRect();
    _sigCtx.beginPath(); _sigCtx.moveTo(_sigLastX,_sigLastY);
    _sigLastX=e.clientX-r.left; _sigLastY=e.clientY-r.top;
    _sigCtx.lineTo(_sigLastX,_sigLastY);
    _sigCtx.strokeStyle='#000'; _sigCtx.lineWidth=2; _sigCtx.lineCap='round'; _sigCtx.stroke();
  };
  _sigCanvas.onmouseup   = () => { _sigDrawing=false; };
  _sigCanvas.onmouseleave= () => { _sigDrawing=false; };
  // Touch
  _sigCanvas.ontouchstart = e => { e.preventDefault(); const t=e.touches[0],r=_sigCanvas.getBoundingClientRect(); _sigDrawing=true; _sigLastX=t.clientX-r.left; _sigLastY=t.clientY-r.top; };
  _sigCanvas.ontouchmove  = e => {
    e.preventDefault();
    if (!_sigDrawing) return;
    const t=e.touches[0],r=_sigCanvas.getBoundingClientRect();
    _sigCtx.beginPath(); _sigCtx.moveTo(_sigLastX,_sigLastY);
    _sigLastX=t.clientX-r.left; _sigLastY=t.clientY-r.top;
    _sigCtx.lineTo(_sigLastX,_sigLastY);
    _sigCtx.strokeStyle='#000'; _sigCtx.lineWidth=2; _sigCtx.lineCap='round'; _sigCtx.stroke();
  };
  _sigCanvas.ontouchend = () => { _sigDrawing=false; };
}

function clearSigCanvas() {
  if (_sigCtx && _sigCanvas) _sigCtx.clearRect(0,0,_sigCanvas.width,_sigCanvas.height);
}

function closeSigModal() {
  const overlay = document.getElementById('sig-modal-overlay');
  if (overlay) overlay.style.display = 'none';
}

function saveSignatureFromModal() {
  if (!_sigCanvas) return;
  const dataUrl = _sigCanvas.toDataURL('image/png');
  const u = getCurrentUser();
  if (!u) { showToast('Connectez-vous pour enregistrer la signature', 'error'); return; }
  const users = getUsers();
  const idx   = users.findIndex(x => x.id === u.id);
  if (idx < 0) return;
  users[idx].signature = dataUrl;
  saveUsers(users);
  closeSigModal();
  showToast('Signature enregistree avec succes', 'success');
}


// ══════════════════════════════════════════
//  TOAST
// ══════════════════════════════════════════
function showToast(msg, type='') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'show '+type;
  setTimeout(() => t.className='', 3500);
}

// ══════════════════════════════════════════
//  HISTORIQUE
// ══════════════════════════════════════════
let historique = [];

function loadHistorique() {
  try { historique=JSON.parse(localStorage.getItem('virement_historique')||'[]'); } catch(e) { historique=[]; }
  updateHistCount();
}

function saveHistorique() {
  localStorage.setItem('virement_historique', JSON.stringify(historique));
  fbSave('historique', 'virement_historique');
  updateHistCount();
}

function updateHistCount() {
  const el = document.getElementById('hist-count');
  if (el) el.textContent = historique.length;
}

function saveToHistory(type, data) {
  historique.unshift({
    id:Date.now(), generatedAt:new Date().toLocaleString('fr-FR'), type,
    date:data.date||'',  ref:data.ref||'',         beneficiaire:data.beneficiaire||'',
    banqueDebitrice:data.banqueDebitrice||'',       banqueBeneficiaire:data.banqueBeneficiaire||'',
    devise:data.devise||'', montant:data.montant||'',
    iban:data.iban||'', swift:data.swift||'', motif:data.motif||'', fichier:data.fichier||'',
  });
  saveHistorique();
}

function extractHistoryData(type) {
  const map = {
    facture:      {date:g('fac_date'),ref:g('fac_ref'),beneficiaire:g('fac_beneficiaire'),banqueDebitrice:g('fac_banque'),banqueBeneficiaire:g('fac_banque_ben_nom'),devise:g('fac_devise'),montant:g('fac_montant'),iban:g('fac_iban'),swift:g('fac_swift'),motif:g('fac_motif')||g('fac_ref_facture')},
    bancassurance:{date:g('ban_date'),ref:g('ban_ref'),beneficiaire:g('ban_beneficiaire'),banqueDebitrice:g('ban_banque'),banqueBeneficiaire:'',devise:'FCFA',montant:g('ban_montant'),iban:'',swift:'',motif:g('ban_num_commission')},
    nivellement:  {date:g('niv_date'),ref:g('niv_ref'),beneficiaire:params.societe||'SANLAMALLIANZ CI',banqueDebitrice:g('niv_banque'),banqueBeneficiaire:g('niv_banque'),devise:params.devise_niv||'XOF',montant:g('niv_montant'),iban:'',swift:'',motif:params.motif_niv||'NIVELLEMENT'},
    reassurance:  {date:g('rea_date'),ref:g('rea_ref'),beneficiaire:g('rea_beneficiaire'),banqueDebitrice:g('rea_banque'),banqueBeneficiaire:g('rea_banque_ben_nom'),devise:g('rea_devise'),montant:g('rea_montant'),iban:g('rea_iban'),swift:g('rea_swift'),motif:g('rea_motif')},
    sinistre:     {date:g('sin_date'),ref:g('sin_ref'),beneficiaire:g('sin_beneficiaire'),banqueDebitrice:g('sin_banque'),banqueBeneficiaire:g('sin_banque_ben_nom'),devise:g('sin_devise'),montant:g('sin_montant'),iban:g('sin_iban'),swift:g('sin_swift'),motif:g('sin_police')},
  };
  return map[type]||{};
}

function renderHistorique() {
  const search     = (document.getElementById('hist-search')?.value||'').toLowerCase();
  const filterType = document.getElementById('hist-filter-type')?.value||'';
  const tbody=document.getElementById('hist-tbody'), badge=document.getElementById('hist-total-badge');
  if (!tbody) return;
  const statsEl = document.getElementById('hist-stats');
  if (statsEl) {
    const types=['facture','bancassurance','nivellement','reassurance','sinistre'];
    const labels={facture:'Factures',bancassurance:'Bancassurance',nivellement:'Nivellements',reassurance:'Reassurances',sinistre:'Sinistres'};
    statsEl.innerHTML=`<div class="stat-card"><div class="stat-val">${historique.length}</div><div class="stat-lbl">Total virements</div></div>`
      +types.map(t=>`<div class="stat-card"><div class="stat-val">${historique.filter(h=>h.type===t).length}</div><div class="stat-lbl">${labels[t]}</div></div>`).join('');
  }
  const filtered=historique.filter(h=>{
    const mT=!filterType||h.type===filterType;
    const mS=!search||[h.beneficiaire,h.ref,h.banqueDebitrice,h.banqueBeneficiaire,h.motif,h.montant].some(v=>(v||'').toLowerCase().includes(search));
    return mT&&mS;
  });
  if (badge) badge.textContent=filtered.length+' entree(s)';
  if (filtered.length===0) {
    tbody.innerHTML=`<tr><td colspan="14"><div class="hist-empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
      <div style="font-size:15px;font-weight:600;color:var(--text-mid);margin-bottom:4px">${historique.length===0?'Aucun virement genere':'Aucun resultat'}</div>
    </div></td></tr>`; return;
  }
  const tc={facture:'type-facture',bancassurance:'type-bancassurance',nivellement:'type-nivellement',reassurance:'type-reassurance',sinistre:'type-sinistre'};
  const tl={facture:'Facture',bancassurance:'Bancassurance',nivellement:'Nivellement',reassurance:'Reassurance',sinistre:'Sinistre'};
  tbody.innerHTML=filtered.map(h=>{
    const ri=historique.indexOf(h);
    return `<tr>
      <td style="color:var(--text-light);font-size:12px">${historique.length-ri}</td>
      <td style="font-size:12px;color:var(--text-light);white-space:nowrap">${h.generatedAt}</td>
      <td><span class="type-badge ${tc[h.type]||''}">${tl[h.type]||h.type}</span></td>
      <td style="white-space:nowrap"><strong>${h.date||'—'}</strong></td>
      <td style="font-family:monospace;font-size:12px">${h.ref||'—'}</td>
      <td><strong>${h.beneficiaire||'—'}</strong></td>
      <td>${h.banqueDebitrice||'—'}</td><td>${h.banqueBeneficiaire||'—'}</td>
      <td>${h.devise||'—'}</td>
      <td style="font-weight:700;color:var(--blue-mid)">${h.montant||'—'}</td>
      <td style="font-size:11px;font-family:monospace">${h.iban||'—'}</td>
      <td style="font-size:12px">${h.swift||'—'}</td>
      <td style="font-size:12px">${h.motif||'—'}</td>
      <td><button class="btn-del-row" title="Supprimer" onclick="deleteHistEntry(${ri})">x</button></td>
    </tr>`;
  }).join('');
}

function deleteHistEntry(idx) {
  if (!confirm('Supprimer cette entree ?')) return;
  historique.splice(idx,1); saveHistorique(); renderHistorique();
}

// ══════════════════════════════════════════
//  ETAPE 8 — EXPORT EXCEL (SheetJS local)
// ══════════════════════════════════════════
function exportExcel() {
  if (historique.length===0) { showToast('Aucun virement a exporter','error'); return; }
  if (!window.XLSX) {
    const script=document.createElement('script');
    script.src='xlsx.full.min.js';
    script.onload =()=>doExportExcel();
    script.onerror=()=>showToast('xlsx.full.min.js introuvable — placez-le dans le meme dossier','error');
    document.head.appendChild(script);
  } else { doExportExcel(); }
}

function doExportExcel() {
  const XLSX=window.XLSX;
  const headers=['N°','Date generation','Type','Date virement','N/Ref','Beneficiaire','Banque debitrice','Banque beneficiaire','Devise','Montant','IBAN','Swift Code','Motif','Fichier'];
  const rows=historique.map((h,i)=>[
    historique.length-i,h.generatedAt,h.type.charAt(0).toUpperCase()+h.type.slice(1),
    h.date,h.ref,h.beneficiaire,h.banqueDebitrice,h.banqueBeneficiaire,
    h.devise,h.montant,h.iban,h.swift,h.motif,h.fichier,
  ]);
  const ws=XLSX.utils.aoa_to_sheet([headers,...rows]);
  ws['!cols']=[{wch:5},{wch:18},{wch:14},{wch:14},{wch:16},{wch:24},{wch:20},{wch:20},{wch:8},{wch:16},{wch:28},{wch:12},{wch:22},{wch:30}];
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Virements');
  const statsData=[
    ['TYPE','NOMBRE'],
    ['Facture',       historique.filter(h=>h.type==='facture').length],
    ['Bancassurance', historique.filter(h=>h.type==='bancassurance').length],
    ['Nivellement',   historique.filter(h=>h.type==='nivellement').length],
    ['Reassurance',   historique.filter(h=>h.type==='reassurance').length],
    ['Sinistre',      historique.filter(h=>h.type==='sinistre').length],
    ['TOTAL',         historique.length],
  ];
  const wsStats=XLSX.utils.aoa_to_sheet(statsData);
  wsStats['!cols']=[{wch:20},{wch:10}];
  XLSX.utils.book_append_sheet(wb,wsStats,'Statistiques');
  XLSX.writeFile(wb,'Historique_Virements_'+new Date().toLocaleDateString('fr-FR').replace(/\//g,'-')+'.xlsx');
  showToast('Export Excel genere !','success');
}

// ══════════════════════════════════════════
//  PHASE 2 — GESTION DES UTILISATEURS
// ══════════════════════════════════════════
const NIVEAUX = {
  1: 'Super Administrateur',
  2: 'Administrateur',
  3: 'Utilisateur',
  4: 'Superviseur',
  5: 'Signataire',
};

// Permissions par niveau
// N1 Super Admin  : tout
// N2 Admin        : gestion users (N3-N5 seulement), paramètres, virements, historique, impression
// N3 Utilisateur  : saisie + impression uniquement
// N4 Superviseur  : saisie + impression + consultation historique
// N5 Signataire   : saisie + impression (pour signature physique à la banque)
const PERMS = {
  1: { gestionUsers:true,  parametres:true,  virement:true, historique:true,  print:true, inbox:true, soumettre:false },
  2: { gestionUsers:true,  parametres:true,  virement:true, historique:true,  print:true, inbox:true, soumettre:false },
  3: { gestionUsers:false, parametres:false, virement:true, historique:false, print:false, inbox:true, soumettre:true },
  4: { gestionUsers:false, parametres:false, virement:true, historique:true,  print:true, inbox:true, soumettre:false },
  5: { gestionUsers:false, parametres:false, virement:true, historique:false, print:true, inbox:true, soumettre:false },
};

function getUsers() {
  try { return JSON.parse(localStorage.getItem('app_users') || '[]'); } catch(e) { return []; }
}

function saveUsers(users) {
  localStorage.setItem('app_users', JSON.stringify(users));
  fbSave('users', 'app_users');
}

function hashPwd(pwd) {
  // Simple obfuscation pour outil interne (pas un vrai hash cryptographique)
  return btoa(pwd + '_sla2026');
}

function initUsers() {
  const users = getUsers();
  if (users.length === 0) {
    saveUsers([{
      id: '1', nom: 'Administrateur', prenom: 'Super',
      username: 'admin', password: hashPwd('admin123'),
      niveau: 1, email: '', actif: true,
      createdAt: new Date().toLocaleString('fr-FR'),
    }]);
  }
}

function getSession() {
  try { return JSON.parse(sessionStorage.getItem('app_session') || 'null'); } catch(e) { return null; }
}

function setSession(user) {
  sessionStorage.setItem('app_session', JSON.stringify({
    id: user.id, username: user.username,
    nom: user.nom, prenom: user.prenom, niveau: user.niveau,
  }));
}

function clearSession() {
  sessionStorage.removeItem('app_session');
}

function getCurrentUser() { return getSession(); }

function hasPerm(perm) {
  const u = getCurrentUser();
  if (!u) return false;
  return !!(PERMS[u.niveau] || {})[perm];
}

function login(username, password) {
  const users = getUsers();
  const hashed = hashPwd(password);
  const user = users.find(u => u.username === username && u.password === hashed && u.actif);
  if (!user) return false;
  setSession(user);
  return true;
}

function logout() {
  clearSession();
  showLoginScreen();
}

function showLoginScreen() {
  document.getElementById('login-overlay').style.display = 'flex';
  showLoginError('');
  document.getElementById('login-username').value = '';
  document.getElementById('login-password').value = '';
}

function hideLoginScreen() {
  document.getElementById('login-overlay').style.display = 'none';
}

function showLoginError(msg) {
  const el = document.getElementById('login-error');
  if (!el) return;
  el.textContent = msg;
  el.style.display = msg ? 'block' : 'none';
}

function doLogin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  if (!username || !password) {
    showLoginError('Veuillez saisir votre identifiant et mot de passe.');
    return;
  }
  if (login(username, password)) {
    hideLoginScreen();
    applyPermissions();
    updateSessionBar();
    updateInboxBadge();
    showPanel('facture');
  } else {
    showLoginError('Identifiant ou mot de passe incorrect.');
    document.getElementById('login-password').value = '';
  }
}

function applyPermissions() {
  const u = getCurrentUser();
  if (!u) return;
  const perm = PERMS[u.niveau] || {};

  // Afficher/masquer les éléments de navigation selon les droits
  const show = (id, visible) => {
    const el = document.getElementById(id);
    if (el) el.style.display = visible ? '' : 'none';
  };

  show('nav-utilisateurs', perm.gestionUsers);
  show('nav-parametres',   perm.parametres);
  show('nav-historique',   perm.historique);
  show('nav-signature',    !!(u && u.niveau === 5));
  show('nav-inbox',        !!perm.inbox);

  // Boutons génération directe — masqués pour N3 (doit passer par le workflow)
  document.querySelectorAll('.btn-direct-gen').forEach(b => { b.style.display = perm.print ? '' : 'none'; });
  document.querySelectorAll('.btn-soumettre').forEach(b => { b.style.display = perm.soumettre ? '' : 'none'; });

  // Si l'utilisateur est sur un panel interdit, rediriger vers Facture
  const current = document.querySelector('.panel.active');
  if (current) {
    const id = current.id;
    if (id === 'panel-parametres'   && !perm.parametres)   showPanel('facture');
    if (id === 'panel-utilisateurs' && !perm.gestionUsers) showPanel('facture');
    if (id === 'panel-historique'   && !perm.historique)   showPanel('facture');
    if (id === 'panel-inbox'        && !perm.inbox)        showPanel('facture');
  }
}

function updateSessionBar() {
  const u = getCurrentUser();
  const bar = document.getElementById('session-bar');
  if (!bar) return;
  if (!u) { bar.style.display = 'none'; return; }
  bar.style.display = '';
  const nomEl = document.getElementById('session-nom');
  const nivEl = document.getElementById('session-niveau');
  if (nomEl) nomEl.textContent = u.prenom + ' ' + u.nom;
  if (nivEl) nivEl.textContent = NIVEAUX[u.niveau] || 'Utilisateur';
}

function renderUsersPanel() {
  const users = getUsers();
  const u = getCurrentUser();
  const tbody = document.getElementById('users-tbody');
  if (!tbody) return;
  const countEl = document.getElementById('users-count');
  if (countEl) countEl.textContent = users.length + ' utilisateur(s)';

  // Stats
  const statsEl = document.getElementById('users-stats');
  if (statsEl) {
    statsEl.innerHTML = Object.entries(NIVEAUX).map(([lvl, label]) =>
      `<div class="stat-card"><div class="stat-val">${users.filter(x=>x.niveau==lvl).length}</div><div class="stat-lbl">${label}</div></div>`
    ).join('') + `<div class="stat-card"><div class="stat-val">${users.filter(x=>x.actif).length}</div><div class="stat-lbl">Actifs</div></div>`;
  }

  tbody.innerHTML = users.map((usr, i) => {
    const canEdit = u && (u.niveau === 1 || (u.niveau === 2 && usr.niveau >= 3));
    return `<tr>
      <td style="font-weight:600">${usr.prenom} ${usr.nom}</td>
      <td style="font-family:monospace;color:var(--blue-mid)">${usr.username}</td>
      <td><span class="tag tag-blue">${NIVEAUX[usr.niveau]||'?'} (N${usr.niveau})</span></td>
      <td>${usr.email||'—'}</td>
      <td style="font-size:12px;color:var(--text-mid)">${usr.titre||'—'}</td>
      <td><span class="tag ${usr.actif?'tag-green':'tag-orange'}">${usr.actif?'Actif':'Inactif'}</span></td>
      <td style="font-size:11px;color:var(--text-light)">${usr.createdAt||'—'}</td>
      <td>
        ${canEdit?`<button class="btn btn-outline" style="padding:4px 10px;font-size:11px" onclick="editUser('${usr.id}')">Modifier</button>
        ${usr.id!=='1'?`<button class="btn btn-danger" style="padding:4px 8px;font-size:11px;margin-left:4px" onclick="deleteUser('${usr.id}')">X</button>`:''}`:'-'}
      </td>
    </tr>`;
  }).join('') || '<tr><td colspan="8" style="text-align:center;color:var(--text-light);padding:30px">Aucun utilisateur</td></tr>';
}

function normalizeStr(s) {
  return (s || '').normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
}

function autoGenUsername(force) {
  const nom    = document.getElementById('new_user_nom').value.trim();
  const prenom = document.getElementById('new_user_prenom').value.trim();
  const uEl    = document.getElementById('new_user_username');
  if (!uEl) return;
  // Ne pas écraser si l'utilisateur a modifié manuellement (sauf si force=true)
  if (!force && uEl.dataset.manualEdit === '1') return;
  const nNom    = normalizeStr(nom);
  const nPrenom = normalizeStr(prenom);
  let generated = '';
  if (nPrenom && nNom) {
    generated = nPrenom[0] + '.' + nNom;
  } else if (nNom) {
    generated = nNom;
  } else if (nPrenom) {
    generated = nPrenom;
  }
  if (generated) {
    uEl.value = generated;
    uEl.dataset.manualEdit = '0';
    checkUsernameAvail();
  }
}

function checkUsernameAvail() {
  const uEl  = document.getElementById('new_user_username');
  const hint = document.getElementById('username-hint');
  if (!uEl || !hint) return;
  const val = uEl.value.trim();
  if (!val) { hint.textContent = ''; return; }
  const exists = getUsers().some(u => u.username === val);
  if (exists) {
    hint.textContent = '⚠ Identifiant déjà utilisé — un suffixe sera ajouté automatiquement';
    hint.style.color = '#f59e0b';
  } else {
    hint.textContent = '✓ Identifiant disponible';
    hint.style.color = '#16a34a';
  }
}

// Marquer si l'utilisateur modifie manuellement le champ username
document.addEventListener('DOMContentLoaded', () => {
  const uEl = document.getElementById('new_user_username');
  if (uEl) {
    uEl.addEventListener('keydown', () => { uEl.dataset.manualEdit = '1'; });
  }
});

function saveNewUser() {
  const u = getCurrentUser();
  const nom      = document.getElementById('new_user_nom').value.trim();
  const prenom   = document.getElementById('new_user_prenom').value.trim();
  const username = document.getElementById('new_user_username').value.trim();
  const password = document.getElementById('new_user_password').value;
  const niveau   = parseInt(document.getElementById('new_user_niveau').value);
  const email    = document.getElementById('new_user_email').value.trim();
  const titreEl  = document.getElementById('new_user_titre');
  const titre    = titreEl ? titreEl.value.trim() : '';

  if (!nom || !prenom || !password) {
    showToast('Remplir tous les champs obligatoires (Nom, Prénom, Mot de passe)', 'error'); return;
  }
  if (u && u.niveau === 2 && niveau < 3) {
    showToast('Vous ne pouvez pas creer un compte de niveau superieur au votre', 'error'); return;
  }

  const users = getUsers();
  // Auto-générer le login si vide
  let finalUsername = username || (normalizeStr(prenom)[0] + '.' + normalizeStr(nom)) || normalizeStr(nom) || normalizeStr(prenom);
  // Gérer les doublons avec suffixe numérique
  let suffix = 2;
  let base = finalUsername;
  while (users.find(x => x.username === finalUsername)) {
    finalUsername = base + suffix;
    suffix++;
  }

  const newUser = {
    id: Date.now().toString(), nom, prenom, username: finalUsername,
    password: hashPwd(password), niveau, email, titre, actif: true,
    createdAt: new Date().toLocaleString('fr-FR'),
  };
  users.push(newUser);
  saveUsers(users);

  // Réinitialiser le formulaire
  ['new_user_nom','new_user_prenom','new_user_username','new_user_password','new_user_email','new_user_titre'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.value = ''; if (el.dataset) el.dataset.manualEdit = '0'; }
  });
  document.getElementById('new_user_niveau').value = '3';
  const hint = document.getElementById('username-hint');
  if (hint) hint.textContent = '';

  renderUsersPanel();
  showToast('Utilisateur cree avec succes !', 'success');
}

function deleteUser(id) {
  if (id === '1') { showToast('Impossible de supprimer le super administrateur', 'error'); return; }
  if (!confirm('Supprimer cet utilisateur ?')) return;
  const users = getUsers().filter(u => u.id !== id);
  saveUsers(users);
  renderUsersPanel();
  showToast('Utilisateur supprime', 'success');
}

function editUser(id) {
  const users = getUsers();
  const usr = users.find(u => u.id === id);
  if (!usr) return;
  const pwd = prompt('Nouveau mot de passe (laisser vide pour ne pas changer) :');
  const actifStr = prompt('Actif ? (oui/non)', usr.actif ? 'oui' : 'non');
  const niveauStr = prompt(`Niveau (1-5)\n1=Super Admin, 2=Admin, 3=Utilisateur, 4=Superviseur, 5=Signataire`, usr.niveau);
  const titreStr = prompt('Poste / Titre (apparaît sur les signatures) :', usr.titre || '');

  if (pwd) usr.password = hashPwd(pwd);
  if (actifStr !== null) usr.actif = actifStr.toLowerCase() === 'oui';
  if (niveauStr !== null) {
    const n = parseInt(niveauStr);
    if (n >= 1 && n <= 5) usr.niveau = n;
  }
  if (titreStr !== null) usr.titre = titreStr.trim();
  saveUsers(users);
  renderUsersPanel();
  showToast('Utilisateur modifie', 'success');
}

function checkAuth() {
  const u = getCurrentUser();
  if (!u) { showLoginScreen(); return false; }
  return true;
}

// ══════════════════════════════════════════
//  PERSONNALISATION — Logo & Fond d'écran
// ══════════════════════════════════════════
function applyCustomization() {
  const logo = params.logo || '';
  const bg   = params.background || '#e8edf8';
  const nom  = params.societe || 'SANLAMALLIANZ CI';

  // Fond d'écran
  if (bg.startsWith('data:')) {
    document.body.style.background = `url('${bg}') center/cover fixed`;
  } else {
    document.body.style.background = bg;
  }
  // Swatch actif
  document.querySelectorAll('.bg-swatch').forEach(s => {
    s.classList.toggle('active', s.style.background === bg || s.getAttribute('data-bg') === bg);
  });
  const colorInput = document.getElementById('param-bg-color');
  if (colorInput && !bg.startsWith('data:')) colorInput.value = bg;

  // Logo — sidebar
  const imgEl  = document.getElementById('app-logo-img');
  const txtEl  = document.getElementById('app-logo-text');
  if (imgEl && txtEl) {
    if (logo) {
      imgEl.src = logo; imgEl.style.display = '';
      txtEl.style.display = 'none';
    } else {
      imgEl.style.display = 'none';
      txtEl.style.display = '';
    }
  }

  // Nom société — sidebar & login
  const sidebarName = document.getElementById('sidebar-company-name');
  if (sidebarName) sidebarName.textContent = nom;
  const loginName = document.getElementById('login-company-name');
  if (loginName) loginName.textContent = nom;

  // Logo — login
  const loginImg  = document.getElementById('login-logo-img');
  const loginTxt  = document.getElementById('login-logo-text');
  if (loginImg && loginTxt) {
    if (logo) {
      loginImg.src = logo; loginImg.style.display = '';
      loginTxt.style.display = 'none';
    } else {
      loginImg.style.display = 'none';
      loginTxt.style.display = '';
    }
  }

  // Preview dans Paramètres
  const prevImg  = document.getElementById('param-logo-preview');
  const prevPlh  = document.getElementById('param-logo-placeholder');
  if (prevImg && prevPlh) {
    if (logo) {
      prevImg.src = logo; prevImg.style.display = '';
      prevPlh.style.display = 'none';
    } else {
      prevImg.style.display = 'none';
      prevPlh.style.display = '';
    }
  }

  // Titre onglet navigateur
  document.title = 'Ordres de Virement — ' + nom;
}

function saveCustomization() {
  localStorage.setItem('virement_params', JSON.stringify(params));
  applyCustomization();
  showToast('Personnalisation sauvegardée !', 'success');
}

function uploadLogo(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 600000) { showToast('Image trop volumineuse (max 600 Ko)', 'error'); return; }
  const reader = new FileReader();
  reader.onload = e => {
    params.logo = e.target.result;
    applyCustomization();
    showToast('Logo chargé — cliquez Sauvegarder pour le conserver', 'success');
  };
  reader.readAsDataURL(file);
  event.target.value = '';
}

function removeLogo() {
  params.logo = '';
  applyCustomization();
  showToast('Logo supprimé', 'success');
}

function applyBg(value, swatchEl) {
  params.background = value;
  applyCustomization();
  if (swatchEl) {
    document.querySelectorAll('.bg-swatch').forEach(s => s.classList.remove('active'));
    swatchEl.classList.add('active');
  }
}

function uploadBgImage(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 3000000) { showToast('Image trop volumineuse (max 3 Mo)', 'error'); return; }
  const reader = new FileReader();
  reader.onload = e => {
    params.background = e.target.result;
    applyCustomization();
    showToast('Image de fond chargée — cliquez Sauvegarder pour la conserver', 'success');
  };
  reader.readAsDataURL(file);
  event.target.value = '';
}

// ══════════════════════════════════════════
//  WORKFLOW — BOÎTE DE RÉCEPTION
// ══════════════════════════════════════════

function getOrders() {
  try { return JSON.parse(localStorage.getItem('virement_orders') || '[]'); } catch(e) { return []; }
}

function saveOrders(orders) {
  localStorage.setItem('virement_orders', JSON.stringify(orders));
  fbSave('orders', 'virement_orders');
}

function getPendingCount() {
  const u = getCurrentUser();
  if (!u) return 0;
  const orders = getOrders();
  if (u.niveau === 3) return orders.filter(o => o.createdBy === u.id && (o.status === 'pret_impression' || o.status === 'rejete')).length;
  if (u.niveau === 4) return orders.filter(o => o.status === 'soumis').length;
  if (u.niveau === 5) return orders.filter(o => o.status === 'valide' && !(o.signatures||[]).some(s => s.userId === u.id)).length;
  return orders.filter(o => ['soumis','valide'].includes(o.status)).length;
}

function updateInboxBadge() {
  const count = getPendingCount();
  const badge = document.getElementById('inbox-badge');
  if (badge) { badge.textContent = count > 0 ? count : ''; badge.style.display = count > 0 ? '' : 'none'; }
}

function submitOrder(type) {
  if (!validateForm(type)) { showToast('Veuillez remplir tous les champs obligatoires', 'error'); return; }
  const u = getCurrentUser();
  if (!u) return;
  const prefix = PANEL_META[type] ? PANEL_META[type].prefix : '';
  const refEl  = prefix ? document.getElementById(prefix + '_ref')    : null;
  const mntEl  = prefix ? document.getElementById(prefix + '_montant') : null;
  const ref    = refEl  ? refEl.value.trim()  : '';
  const montant = mntEl ? mntEl.value.trim() : '';
  // Beneficiaire
  let beneficiaire = '';
  const benSel = prefix ? document.getElementById(prefix + '_beneficiaire_sel') : null;
  if (benSel && benSel.value && benSel.value !== '__autre__') {
    beneficiaire = benSel.options[benSel.selectedIndex] ? benSel.options[benSel.selectedIndex].text : benSel.value;
  } else {
    const benInp = prefix ? document.getElementById(prefix + '_beneficiaire') : null;
    if (benInp) beneficiaire = benInp.value.trim();
    if (!beneficiaire && type === 'nivellement') beneficiaire = params.societe || 'SANLAMALLIANZ CI';
  }
  const texte = buildText(type);
  incrementRef(type);
  const histData = extractHistoryData(type);
  saveToHistory(type, Object.assign(histData, { fichier: 'Workflow — soumis' }));
  const order = {
    id: Date.now().toString(), type, status: 'soumis', ref, beneficiaire, montant, texte,
    createdBy: u.id, createdByNom: u.prenom + ' ' + u.nom,
    createdAt: new Date().toLocaleString('fr-FR'),
    validatedBy: null, validatedAt: null, rejectReason: null,
    signatures: [], requiredSignatures: params.nb_signatures || 2,
    history: [{ action: 'soumis', by: u.prenom + ' ' + u.nom, at: new Date().toLocaleString('fr-FR') }],
  };
  const orders = getOrders(); orders.push(order); saveOrders(orders);
  clearForm(type);
  updateInboxBadge();
  showToast('Ordre soumis à la validation — Réf: ' + ref, 'success');
}

function validateOrder(id) {
  const u = getCurrentUser();
  if (!u || (u.niveau > 2 && u.niveau !== 4)) { showToast('Accès non autorisé', 'error'); return; }
  const orders = getOrders(); const ord = orders.find(o => o.id === id); if (!ord) return;
  ord.status = 'valide'; ord.validatedBy = u.prenom + ' ' + u.nom; ord.validatedAt = new Date().toLocaleString('fr-FR');
  ord.history.push({ action: 'validé', by: u.prenom + ' ' + u.nom, at: new Date().toLocaleString('fr-FR') });
  saveOrders(orders); updateInboxBadge(); renderInbox(); showToast('Ordre validé — transmis aux signataires', 'success');
}

function rejectOrder(id) {
  const u = getCurrentUser();
  if (!u || (u.niveau > 2 && u.niveau !== 4)) { showToast('Accès non autorisé', 'error'); return; }
  const reason = prompt('Motif du rejet (obligatoire) :');
  if (!reason || !reason.trim()) { showToast('Motif de rejet requis', 'error'); return; }
  const orders = getOrders(); const ord = orders.find(o => o.id === id); if (!ord) return;
  ord.status = 'rejete'; ord.rejectReason = reason.trim();
  ord.history.push({ action: 'rejeté', by: u.prenom + ' ' + u.nom, at: new Date().toLocaleString('fr-FR'), motif: reason.trim() });
  saveOrders(orders); updateInboxBadge(); renderInbox(); showToast('Ordre rejeté', 'error');
}

function signOrder(id) {
  const u = getCurrentUser();
  if (!u || (u.niveau !== 5 && u.niveau > 2)) { showToast('Réservé aux signataires (Niveau 5)', 'error'); return; }
  const orders = getOrders(); const ord = orders.find(o => o.id === id);
  if (!ord || ord.status !== 'valide') { showToast('Cet ordre ne peut pas être signé', 'error'); return; }
  if ((ord.signatures||[]).some(s => s.userId === u.id)) { showToast('Vous avez déjà signé cet ordre', 'error'); return; }
  const sigImage = getCurrentUserSignature();
  if (!sigImage) { showToast('Veuillez d\'abord enregistrer votre signature via "Ma Signature" dans le menu', 'error'); return; }
  const users = getUsers(); const fullUser = users.find(x => x.id === u.id);
  const titre = fullUser ? (fullUser.titre || '') : '';
  ord.signatures.push({ userId: u.id, nom: u.prenom + ' ' + u.nom, titre, image: sigImage, signedAt: new Date().toLocaleString('fr-FR') });
  ord.history.push({ action: 'signé', by: u.prenom + ' ' + u.nom, at: new Date().toLocaleString('fr-FR') });
  if (ord.signatures.length >= (ord.requiredSignatures || 2)) {
    ord.status = 'pret_impression';
    ord.history.push({ action: 'prêt à imprimer', by: 'système', at: new Date().toLocaleString('fr-FR') });
    showToast('Ordre entièrement signé — prêt pour impression', 'success');
  } else {
    showToast('Signature enregistrée (' + ord.signatures.length + '/' + (ord.requiredSignatures||2) + ')', 'success');
  }
  saveOrders(orders); updateInboxBadge(); renderInbox();
}

function printSignedOrder(id) {
  const orders = getOrders(); const ord = orders.find(o => o.id === id); if (!ord) return;
  const esc = s => (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const sigCellHtml = (sigInfo) => {
    const imgBlock = sigInfo && sigInfo.image ? `<div style="text-align:center;height:55px;display:flex;align-items:center;justify-content:center"><img src="${sigInfo.image}" style="max-width:130px;max-height:50px;object-fit:contain"></div>` : `<div style="height:55px"></div>`;
    const nameBlock = sigInfo && sigInfo.nom ? `<div style="font-weight:bold;text-align:center;font-size:11px;margin-top:4px">${esc(sigInfo.nom)}</div>${sigInfo.titre?`<div style="text-align:center;font-size:10px;color:#555">${esc(sigInfo.titre)}</div>`:''}` : '';
    return `<div style="width:46%;display:inline-block;vertical-align:top;margin:0 2%">${imgBlock}<div style="border-top:1.5px solid #333;padding-top:4px">${nameBlock}</div></div>`;
  };
  const logoHtml = params.logo ? `<img src="${params.logo}" style="max-height:65px;max-width:180px;object-fit:contain">` : `<div style="font-size:14px;font-weight:800;color:#1e3a8a">${esc(params.societe||'SANLAMALLIANZ CI')}</div>`;
  const entete = params.entete_ordre ? `<div style="text-align:center;font-size:11px;margin-bottom:8px;white-space:pre-wrap">${esc(params.entete_ordre)}</div>` : '';
  const pied   = params.pied_ordre   ? `<div style="text-align:center;font-size:10px;margin-top:16px;border-top:1px solid #ccc;padding-top:6px;white-space:pre-wrap">${esc(params.pied_ordre)}</div>` : '';
  const lines = (ord.texte || '').split('\n');
  let bodyLines = ''; let inSig = false;
  for (const line of lines) {
    const t = line.trim();
    if (t === 'SIGNATURES AUTORISEES' || t === 'SIGNATURES AUTORISÉES') {
      inSig = true;
      bodyLines += `<div style="font-weight:bold;text-align:center;margin:16px 0 8px;font-size:12px;letter-spacing:1px">SIGNATURES AUTORISÉES</div>`;
      const s1 = ord.signatures[0]||null; const s2 = ord.signatures[1]||null;
      bodyLines += `<div style="text-align:center">${sigCellHtml(s1)}${sigCellHtml(s2)}</div>`;
      continue;
    }
    if (inSig) continue;
    if (t.startsWith('NB:')) { bodyLines += `<div style="color:red;margin:3px 0;font-size:11px">${esc(line)}</div>`; }
    else if (t === '') { bodyLines += `<div style="margin:2px 0">&nbsp;</div>`; }
    else { bodyLines += `<div style="font-size:11px;margin:1px 0;font-family:'Courier New',monospace">${esc(line)}</div>`; }
  }
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Ordre signé — ${esc(ord.ref)}</title><style>body{font-family:'Courier New',monospace;max-width:750px;margin:20px auto;padding:20px}@media print{body{margin:0;padding:10px}}</style></head><body><div style="text-align:center;margin-bottom:10px">${logoHtml}</div>${entete}${bodyLines}${pied}</body></html>`;
  const w = window.open('', '_blank', 'width=800,height=700');
  if (!w) { showToast('Popup bloquée — autorisez les popups', 'error'); return; }
  w.document.write(html); w.document.close();
  setTimeout(() => { try { w.print(); } catch(e) {} }, 600);
  markOrderExecuted(id, 'Impression PDF');
}

function previewOrderText(id) {
  const orders = getOrders(); const ord = orders.find(o => o.id === id); if (!ord) return;
  const esc = s => (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const lines = (ord.texte||'').split('\n').map(l => l.trim().startsWith('NB:') ? `<span style="color:red">${esc(l)}</span>` : esc(l)).join('\n');
  const w = window.open('', '_blank', 'width=700,height=600');
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Aperçu — ${esc(ord.ref)}</title></head><body style="font-family:'Courier New',monospace;padding:20px;font-size:12px"><pre style="white-space:pre-wrap">${lines}</pre></body></html>`);
  w.document.close();
}

const TYPE_LABELS   = { facture:'Facture', bancassurance:'Bancassurance', nivellement:'Nivellement', reassurance:'Réassurance', sinistre:'Sinistre' };
const STATUS_LABELS = { soumis:'Soumis', valide:'Validé', rejete:'Rejeté', pret_impression:'Prêt à imprimer', imprime:'Exécuté' };
const STATUS_COLORS = { soumis:'#f59e0b', valide:'#3b82f6', rejete:'#ef4444', pret_impression:'#22c55e', imprime:'#059669' };

function renderInbox() {
  const u = getCurrentUser(); const el = document.getElementById('inbox-content');
  if (!el || !u) return;
  const orders = getOrders();
  const esc = s => (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const statusTag = st => `<span style="background:${STATUS_COLORS[st]||'#94a3b8'};color:#fff;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600">${STATUS_LABELS[st]||st}</span>`;
  const badgeEl = document.getElementById('inbox-badge-text');
  let html = '';

  if (badgeEl && u.niveau <= 2) {
    const pending = orders.filter(o => ['soumis','valide'].includes(o.status)).length;
    badgeEl.textContent = pending + ' en cours';
  }

  // Section N4 / admin : À VALIDER
  if (u.niveau === 4 || u.niveau <= 2) {
    const toValidate = orders.filter(o => o.status === 'soumis');
    if (badgeEl && u.niveau === 4) badgeEl.textContent = toValidate.length + ' en attente';
    html += `<div class="card"><div class="card-header"><div class="card-header-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></div><h2>À valider (${toValidate.length})</h2></div><div class="card-body">`;
    if (toValidate.length === 0) {
      html += `<p style="color:var(--text-light);text-align:center;padding:20px 0">Aucun ordre en attente de validation</p>`;
    } else {
      html += `<div style="overflow-x:auto"><table class="param-table"><thead><tr><th>Référence</th><th>Type</th><th>Soumis par</th><th>Date</th><th>Montant</th><th>Bénéficiaire</th><th>Actions</th></tr></thead><tbody>`;
      toValidate.forEach(o => { html += `<tr><td style="font-weight:600;font-family:monospace">${esc(o.ref)}</td><td>${TYPE_LABELS[o.type]||o.type}</td><td>${esc(o.createdByNom)}</td><td style="font-size:11px">${esc(o.createdAt)}</td><td>${esc(o.montant)}</td><td>${esc(o.beneficiaire)}</td><td><button class="btn btn-gold" style="padding:4px 12px;font-size:11px" onclick="validateOrder('${o.id}')">Valider</button> <button class="btn btn-danger" style="padding:4px 10px;font-size:11px" onclick="rejectOrder('${o.id}')">Rejeter</button> <button class="btn btn-outline" style="padding:4px 10px;font-size:11px" onclick="previewOrderText('${o.id}')">Voir</button></td></tr>`; });
      html += `</tbody></table></div>`;
    }
    html += `</div></div>`;
  }

  // Section N5 : À SIGNER
  if (u.niveau === 5 || u.niveau <= 2) {
    const myUnsigned = orders.filter(o => o.status === 'valide' && !(o.signatures||[]).some(s => s.userId === u.id));
    if (badgeEl && u.niveau === 5) badgeEl.textContent = myUnsigned.length + ' à signer';
    html += `<div class="card"><div class="card-header"><div class="card-header-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 19.5v.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8.5L18 5.5"/><path d="M15 2v4h4"/><path d="M8 18s1-1 2-1 2 1 3 1 2-1 2-1"/></svg></div><h2>À signer (${myUnsigned.length})</h2></div><div class="card-body">`;
    if (myUnsigned.length === 0) {
      html += `<p style="color:var(--text-light);text-align:center;padding:20px 0">Aucun ordre en attente de votre signature</p>`;
    } else {
      html += `<div style="overflow-x:auto"><table class="param-table"><thead><tr><th>Référence</th><th>Type</th><th>Validé par</th><th>Montant</th><th>Bénéficiaire</th><th>Signatures</th><th>Actions</th></tr></thead><tbody>`;
      myUnsigned.forEach(o => { const sc=(o.signatures||[]).length; const rq=o.requiredSignatures||2; const canSign=(u.niveau===5||u.niveau<=2); html += `<tr><td style="font-weight:600;font-family:monospace">${esc(o.ref)}</td><td>${TYPE_LABELS[o.type]||o.type}</td><td>${esc(o.validatedBy||'—')}</td><td>${esc(o.montant)}</td><td>${esc(o.beneficiaire)}</td><td>${sc}/${rq}</td><td>${canSign?`<button class="btn btn-gold" style="padding:4px 12px;font-size:11px" onclick="signOrder('${o.id}')">Signer</button> `:''}<button class="btn btn-outline" style="padding:4px 10px;font-size:11px" onclick="previewOrderText('${o.id}')">Voir</button></td></tr>`; });
      html += `</tbody></table></div>`;
    }
    html += `</div></div>`;

    // Ordres exécutés — déverrouillage
    const executed = orders.filter(o => o.status === 'imprime');
    if (executed.length > 0) {
      html += `<div class="card"><div class="card-header"><div class="card-header-icon" style="background:#f0fdf4"><svg viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></div><h2 style="color:#059669">Ordres exécutés (${executed.length})</h2><span style="font-size:11px;color:#6b7280;margin-left:auto">Déverrouiller si impression non réalisée</span></div><div class="card-body">`;
      html += `<div style="overflow-x:auto"><table class="param-table"><thead><tr><th>Référence</th><th>Type</th><th>Créé par</th><th>Montant</th><th>Bénéficiaire</th><th>Exécuté le</th><th>Actions</th></tr></thead><tbody>`;
      executed.forEach(o => {
        const execEntry = [...(o.history||[])].reverse().find(h => h.action === 'exécuté');
        const execAt = execEntry ? execEntry.at : '—';
        html += `<tr><td style="font-weight:600;font-family:monospace">${esc(o.ref)}</td><td>${TYPE_LABELS[o.type]||o.type}</td><td>${esc(o.createdByNom)}</td><td>${esc(o.montant)}</td><td>${esc(o.beneficiaire)}</td><td style="font-size:11px">${esc(execAt)}</td><td><button class="btn btn-outline" style="padding:4px 10px;font-size:11px;color:#dc2626;border-color:#dc2626" onclick="unlockOrder('${o.id}')">🔓 Déverrouiller</button> <button class="btn btn-outline" style="padding:4px 8px;font-size:11px" onclick="previewOrderText('${o.id}')">Voir</button></td></tr>`;
      });
      html += `</tbody></table></div></div></div>`;
    }
  }

  // Section N3 : MES ORDRES
  if (u.niveau === 3 || u.niveau <= 2) {
    const myOrders = u.niveau === 3 ? orders.filter(o => o.createdBy === u.id) : orders;
    const toPrint  = myOrders.filter(o => o.status === 'pret_impression');
    const rejected = myOrders.filter(o => o.status === 'rejete');
    const pending  = myOrders.filter(o => ['soumis','valide'].includes(o.status));
    const printed  = myOrders.filter(o => o.status === 'imprime');
    if (badgeEl && u.niveau === 3) badgeEl.textContent = (toPrint.length + rejected.length) + ' actions requises';

    if (toPrint.length > 0) {
      html += `<div class="card"><div class="card-header"><div class="card-header-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg></div><h2>Prêts à imprimer (${toPrint.length})</h2></div><div class="card-body">`;
      html += `<div style="overflow-x:auto"><table class="param-table"><thead><tr><th>Référence</th><th>Type</th><th>Montant</th><th>Bénéficiaire</th><th>Signataires</th><th>Actions</th></tr></thead><tbody>`;
      toPrint.forEach(o => { const sn=(o.signatures||[]).map(s=>s.nom).join(', '); html += `<tr><td style="font-weight:600;font-family:monospace">${esc(o.ref)}</td><td>${TYPE_LABELS[o.type]||o.type}</td><td>${esc(o.montant)}</td><td>${esc(o.beneficiaire)}</td><td style="font-size:11px">${esc(sn)}</td><td style="white-space:nowrap"><button class="btn btn-gold" style="padding:4px 12px;font-size:11px" onclick="genWordFromOrder('${o.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:11px;height:11px;vertical-align:middle"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Word</button> <button class="btn btn-outline" style="padding:4px 10px;font-size:11px" onclick="printSignedOrder('${o.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:11px;height:11px;vertical-align:middle"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> PDF</button> <button class="btn btn-outline" style="padding:4px 8px;font-size:11px" onclick="previewOrderText('${o.id}')">Voir</button></td></tr>`; });
      html += `</tbody></table></div></div></div>`;
    }
    if (rejected.length > 0) {
      html += `<div class="card"><div class="card-header"><div class="card-header-icon" style="background:#fef2f2"><svg viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></div><h2 style="color:#dc2626">Ordres rejetés (${rejected.length})</h2></div><div class="card-body">`;
      html += `<div style="overflow-x:auto"><table class="param-table"><thead><tr><th>Référence</th><th>Type</th><th>Montant</th><th>Motif de rejet</th><th>Actions</th></tr></thead><tbody>`;
      rejected.forEach(o => { html += `<tr><td style="font-weight:600;font-family:monospace">${esc(o.ref)}</td><td>${TYPE_LABELS[o.type]||o.type}</td><td>${esc(o.montant)}</td><td style="color:#dc2626;font-size:11px">${esc(o.rejectReason||'—')}</td><td><button class="btn btn-outline" style="padding:4px 10px;font-size:11px" onclick="showPanel('${o.type}')">Modifier & Resoumettre</button></td></tr>`; });
      html += `</tbody></table></div></div></div>`;
    }
    html += `<div class="card"><div class="card-header"><div class="card-header-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div><h2>En cours (${pending.length})</h2></div><div class="card-body">`;
    if (pending.length === 0) {
      html += `<p style="color:var(--text-light);text-align:center;padding:20px 0">Aucun ordre en cours de traitement</p>`;
    } else {
      html += `<div style="overflow-x:auto"><table class="param-table"><thead><tr><th>Référence</th><th>Type</th><th>Statut</th><th>Date</th><th>Montant</th><th>Bénéficiaire</th></tr></thead><tbody>`;
      pending.forEach(o => { html += `<tr><td style="font-weight:600;font-family:monospace">${esc(o.ref)}</td><td>${TYPE_LABELS[o.type]||o.type}</td><td>${statusTag(o.status)}</td><td style="font-size:11px">${esc(o.createdAt)}</td><td>${esc(o.montant)}</td><td>${esc(o.beneficiaire)}</td></tr>`; });
      html += `</tbody></table></div>`;
    }
    html += `</div></div>`;
  }

  if (!html) { html = `<div class="card"><div class="card-body"><p style="color:var(--text-light);text-align:center;padding:40px">Boîte de réception vide</p></div></div>`; }
  el.innerHTML = html;
}


function base64ToArrayBuffer(dataUrl) {
  const b64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  const bin = atob(b64);
  const buf = new ArrayBuffer(bin.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i);
  return buf;
}

async function genWordFromOrder(id) {
  const orders = getOrders();
  const ord = orders.find(o => o.id === id);
  if (!ord) return;
  const D = window.docx;
  if (!D) { showToast('Bibliothèque docx non chargée (docx.min.js)', 'error'); return; }
  try {
    const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, WidthType, BorderStyle } = D;
    const lines = (ord.texte || '').split('\n');
    const FONT = 'Times New Roman', SZ = 22, SZ_H = 28;
    const NB = {
      top:{style:BorderStyle.NONE,size:0,color:'FFFFFF'}, bottom:{style:BorderStyle.NONE,size:0,color:'FFFFFF'},
      left:{style:BorderStyle.NONE,size:0,color:'FFFFFF'}, right:{style:BorderStyle.NONE,size:0,color:'FFFFFF'},
      insideH:{style:BorderStyle.NONE,size:0,color:'FFFFFF'}, insideV:{style:BorderStyle.NONE,size:0,color:'FFFFFF'},
    };
    function mkPara(txt, opts) {
      const o = opts||{};
      return new Paragraph({ alignment:o.align||AlignmentType.LEFT, spacing:{before:0,after:o.after!==undefined?o.after:80},
        children:[new TextRun({text:txt||'',bold:!!o.bold,size:o.size||SZ,font:FONT})] });
    }
    function mkLineRich(trim, opts) {
      const o = opts||{};
      const ci = trim.indexOf(':');
      let runs = ci>0&&ci<trim.length-1
        ? [new TextRun({text:trim.slice(0,ci+1),bold:false,size:SZ,font:FONT}),new TextRun({text:trim.slice(ci+1),bold:true,size:SZ,font:FONT})]
        : [new TextRun({text:trim,bold:!!o.allBold,size:SZ,font:FONT})];
      return new Paragraph({alignment:AlignmentType.LEFT,spacing:{before:0,after:o.after!==undefined?o.after:80},children:runs});
    }
    const children = [];
    if (params.entete_ordre) {
      params.entete_ordre.split('\n').forEach(l => children.push(mkPara(l,{align:AlignmentType.CENTER,size:20,after:40})));
    } else {
      children.push(mkPara(params.societe||'SANLAMALLIANZ CI ASSURANCES',{bold:true,align:AlignmentType.CENTER,size:SZ_H,after:60}));
      if (params.adresse)   children.push(mkPara(params.adresse,{align:AlignmentType.CENTER,size:20,after:40}));
      if (params.telephone) children.push(mkPara('Tel. : '+params.telephone,{align:AlignmentType.CENTER,size:20,after:40}));
    }
    children.push(new Paragraph({spacing:{before:0,after:200},border:{bottom:{style:BorderStyle.SINGLE,size:8,color:'1e3a8a'}},children:[new TextRun({text:'',size:SZ,font:FONT})]}));
    children.push(new Table({width:{size:9026,type:WidthType.DXA},columnWidths:[5513,3513],borders:NB,rows:[new TableRow({children:[
      new TableCell({borders:NB,width:{size:5513,type:WidthType.DXA},children:[mkPara('')]}),
      new TableCell({borders:NB,width:{size:3513,type:WidthType.DXA},children:[new Paragraph({alignment:AlignmentType.RIGHT,spacing:{before:0,after:80},children:[new TextRun({text:lines[0]||'',bold:true,size:SZ,font:FONT})]})]})
    ]})]}));
    const sig1 = (ord.signatures||[])[0]||null;
    const sig2 = (ord.signatures||[])[1]||null;
    const mkSigCell = (sigInfo) => {
      const cc = [];
      if (sigInfo && sigInfo.image && D.ImageRun) {
        try {
          const buf = base64ToArrayBuffer(sigInfo.image);
          cc.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:0,after:40},children:[new D.ImageRun({data:buf,transformation:{width:120,height:50},type:'png'})]}));
        } catch(e) { cc.push(mkPara('',{after:380})); }
      } else { cc.push(mkPara('',{after:380})); }
      cc.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:0,after:60},border:{bottom:{style:BorderStyle.SINGLE,size:4,color:'000000'}},children:[new TextRun({text:'',size:SZ,font:FONT})]}));
      if (sigInfo && sigInfo.nom) {
        cc.push(mkPara(sigInfo.nom,{align:AlignmentType.CENTER,bold:true,size:20,after:20}));
        if (sigInfo.titre) cc.push(mkPara(sigInfo.titre,{align:AlignmentType.CENTER,size:18,after:0}));
      }
      return new TableCell({borders:NB,width:{size:4513,type:WidthType.DXA},children:cc});
    };
    for (let i=1; i<lines.length; i++) {
      const trim = lines[i].trim();
      if (trim==='') { children.push(mkPara('',{after:160})); continue; }
      if (trim.includes('SIGNATURES AUTORISEES')||trim.includes('SIGNATURES AUTORISÉES')) {
        children.push(mkPara('',{after:320}));
        children.push(mkPara('SIGNATURES AUTORISEES',{bold:true,align:AlignmentType.CENTER,after:220}));
        children.push(new Table({width:{size:9026,type:WidthType.DXA},columnWidths:[4513,4513],borders:NB,rows:[new TableRow({children:[mkSigCell(sig1),mkSigCell(sig2)]})]}));
        if (params.pied_ordre) {
          children.push(mkPara('',{after:240}));
          children.push(new Paragraph({spacing:{before:0,after:0},border:{top:{style:BorderStyle.SINGLE,size:4,color:'cccccc'}},children:[new TextRun({text:'',size:SZ,font:FONT})]}));
          children.push(mkPara(params.pied_ordre,{align:AlignmentType.CENTER,size:18,after:0}));
        }
      } else if (/^NB\s*:/i.test(trim)) {
        children.push(new Paragraph({alignment:AlignmentType.LEFT,spacing:{before:0,after:80},children:[new TextRun({text:trim,bold:true,color:'FF0000',size:SZ,font:FONT})]}));
      } else if (/^Ordre de virement/i.test(trim)) {
        children.push(mkPara(trim,{bold:true,after:80}));
      } else {
        children.push(mkLineRich(trim,{after:80}));
      }
    }
    const doc = new Document({sections:[{properties:{page:{size:{width:11906,height:16838},margin:{top:1134,right:1134,bottom:1134,left:1701}}},children}]});
    const blob = await Packer.toBlob(doc);
    const fname = 'OV_SIGNE_' + (ord.ref||'').replace(/\//g,'-') + '.docx';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = fname;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    markOrderExecuted(id, 'Word — ' + fname);
    showToast('Fichier généré : ' + fname, 'success');
  } catch(err) {
    console.error('genWordFromOrder error:', err);
    showToast('Erreur génération Word : ' + err.message, 'error');
  }
}

function markOrderExecuted(id, fichierLabel) {
  const u = getCurrentUser();
  const orders = getOrders();
  const ord = orders.find(o => o.id === id);
  if (!ord) return;
  ord.status = 'imprime';
  ord.history.push({ action: 'exécuté', by: (u ? u.prenom + ' ' + u.nom : '?'), at: new Date().toLocaleString('fr-FR') });
  saveOrders(orders);
  const hi = historique.findIndex(h => h.ref === ord.ref && h.type === ord.type);
  if (hi >= 0) { historique[hi].fichier = 'Ordre exécuté — ' + (fichierLabel||''); saveHistorique(); }
  updateInboxBadge();
  renderInbox();
}

function unlockOrder(id) {
  const u = getCurrentUser();
  if (!u || (u.niveau !== 4 && u.niveau !== 5 && u.niveau > 2)) {
    showToast('Seul un superviseur (N4) ou un signataire (N5) peut déverrouiller', 'error'); return;
  }
  const orders = getOrders();
  const ord = orders.find(o => o.id === id);
  if (!ord || ord.status !== 'imprime') { showToast('Cet ordre ne peut pas être déverrouillé', 'error'); return; }
  if (!confirm('Remettre cet ordre dans la boîte de l\'utilisateur pour réimpression ?')) return;
  ord.status = 'pret_impression';
  ord.history.push({ action: 'déverrouillé pour réimpression', by: u.prenom + ' ' + u.nom, at: new Date().toLocaleString('fr-FR') });
  saveOrders(orders);
  const hi = historique.findIndex(h => h.ref === ord.ref && h.type === ord.type);
  if (hi >= 0) { historique[hi].fichier = 'Déverrouillé — en attente réimpression'; saveHistorique(); }
  updateInboxBadge();
  renderInbox();
  showToast('Ordre déverrouillé — retransmis à l\'utilisateur', 'success');
}

// ══════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════
(async function initApp() {
  const loadingEl = document.getElementById('fb-loading');
  initFirebase();
  if (fbDB && loadingEl) loadingEl.style.display = 'flex';
  await syncFromFirebase();
  if (loadingEl) loadingEl.style.display = 'none';

  loadParams();
  applyCustomization();
  loadHistorique();
  initUsers();
  refreshBanqueSelects();
  refreshBeneficiaireSelects();
  refreshDeviseSelects();
  renderBeneficiairesTable();
  renderDevisesList();
  Object.keys(DRAFT_FIELDS).forEach(type => setupDraftAutoSave(type));
  fillDateAuto('fac');
  fillRefAuto('fac','facture');
  restoreFormDraft('facture');
  clearValidation('facture');
  checkAuth();
  applyPermissions();
  updateSessionBar();
  updateInboxBadge();
  subscribeToOrders();
  subscribeToUsers();
})();
