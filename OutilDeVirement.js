// ══════════════════════════════════════════
//  SUPABASE — Configuration
// ══════════════════════════════════════════
const SB_URL      = 'https://sffqvxpevlzivxubcrgj.supabase.co';
const SB_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmZnF2eHBldmx6aXZ4dWJjcmdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzMjgxODIsImV4cCI6MjA5NzkwNDE4Mn0.tE6fzx4LrzEoYd0gi8JO_ky9Rw3AzdwYBkmxA8gwGIk';

let sbClient = null;
let _sbChannel = null;

function supabaseConfigured() {
  return !SB_URL.includes('REMPLACER') && !SB_ANON_KEY.includes('REMPLACER');
}

function initSupabase() {
  if (!supabaseConfigured()) { console.info('[Supabase] Config non renseignée — mode local'); return; }
  try {
    if (typeof supabase === 'undefined') { console.warn('[Supabase] SDK non chargé'); return; }
    sbClient = supabase.createClient(SB_URL, SB_ANON_KEY);
    console.log('[Supabase] Connecté');
  } catch(e) { console.error('[Supabase] Init:', e); sbClient = null; }
}

// ── Conversions ordre JS ↔ ligne Supabase ─────────────────────────────────────
function _orderToRow(o) {
  return {
    id: o.id, type: o.type || '', status: o.status || 'soumis',
    ref: o.ref || '', beneficiaire: o.beneficiaire || '',
    montant: o.montant || '', texte: o.texte || '',
    created_by: o.createdBy || '', created_by_nom: o.createdByNom || '',
    created_at: o.createdAt || '', validated_by: o.validatedBy || '',
    validated_at: o.validatedAt || '', reject_reason: o.rejectReason || '',
    signatures: o.signatures || [], required_signatures: o.requiredSignatures || 2,
    history: o.history || [], pieces_jointes: o.piecesJointes || [],
    is_duplicate: !!o.isDuplicate, duplicate_info: o.duplicateInfo || null,
    updated_at: new Date().toISOString(),
  };
}
function _rowToOrder(r) {
  return {
    id: r.id, type: r.type, status: r.status, ref: r.ref,
    beneficiaire: r.beneficiaire, montant: r.montant, texte: r.texte,
    createdBy: r.created_by, createdByNom: r.created_by_nom, createdAt: r.created_at,
    validatedBy: r.validated_by, validatedAt: r.validated_at, rejectReason: r.reject_reason,
    signatures: r.signatures || [], requiredSignatures: r.required_signatures,
    history: r.history || [], piecesJointes: r.pieces_jointes || [],
    isDuplicate: r.is_duplicate, duplicateInfo: r.duplicate_info,
  };
}

// ── Conversions historique JS ↔ ligne Supabase ────────────────────────────────
function _histToRow(h) {
  return {
    id: h.id, type: h.type || '', generated_at: h.generatedAt || '',
    date: h.date || '', ref: h.ref || '', beneficiaire: h.beneficiaire || '',
    banque_debitrice: h.banqueDebitrice || '', banque_beneficiaire: h.banqueBeneficiaire || '',
    devise: h.devise || '', montant: h.montant || '',
    iban: h.iban || '', swift: h.swift || '', motif: h.motif || '', fichier: h.fichier || '',
  };
}
function _histRejToRow(h) {
  return {
    ...(_histToRow(h)),
    motif_rejet: h.motifRejet || '', rejete_at: h.rejeteAt || '', rejete_by: h.rejeteBy || '',
  };
}
function _rowToHist(r) {
  return {
    id: r.id, type: r.type, generatedAt: r.generated_at, date: r.date, ref: r.ref,
    beneficiaire: r.beneficiaire, banqueDebitrice: r.banque_debitrice,
    banqueBeneficiaire: r.banque_beneficiaire, devise: r.devise, montant: r.montant,
    iban: r.iban, swift: r.swift, motif: r.motif, fichier: r.fichier,
    motifRejet: r.motif_rejet, rejeteAt: r.rejete_at, rejeteBy: r.rejete_by,
  };
}

// ── Chargement initial depuis Supabase ────────────────────────────────────────
async function syncFromSupabase() {
  if (!sbClient) return;
  try {
    const timeout = new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 8000));
    const doFetch = async () => {
      const [paramsRes, usersRes, ordersRes, histRes, rejRes, cntRes] = await Promise.all([
        sbClient.from('virement_params').select('*').eq('id','config').maybeSingle(),
        sbClient.from('virement_users').select('*'),
        sbClient.from('virement_orders').select('*').order('inserted_at', { ascending: false }),
        sbClient.from('virement_historique').select('*').order('inserted_at', { ascending: false }),
        sbClient.from('virement_historique_rejete').select('*').order('inserted_at', { ascending: false }),
        sbClient.from('virement_counters').select('*'),
      ]);
      if (paramsRes.data) {
        const p = { ...paramsRes.data };
        delete p.id; delete p.updated_at;
        Object.assign(params, p);
        localStorage.setItem('virement_params', JSON.stringify(params));
      }
      if (usersRes.data) {
        localStorage.setItem('app_users', JSON.stringify(usersRes.data));
      }
      if (ordersRes.data) {
        localStorage.setItem('virement_orders', JSON.stringify(ordersRes.data.map(_rowToOrder)));
      }
      if (histRes.data) {
        localStorage.setItem('virement_historique', JSON.stringify(histRes.data.map(_rowToHist)));
      }
      if (rejRes.data) {
        localStorage.setItem('virement_historique_rejete', JSON.stringify(rejRes.data.map(_rowToHist)));
      }
      if (cntRes.data) {
        const counters = {};
        cntRes.data.forEach(r => { counters[r.annee + '_' + r.type] = r.valeur; });
        localStorage.setItem('virement_counters', JSON.stringify(counters));
      }
    };
    await Promise.race([doFetch(), timeout]);
    console.log('[Supabase] Données synchronisées');
  } catch(e) { console.warn('[Supabase] Mode hors-ligne :', e.message); }
}

// ── Sauvegarde paramètres ─────────────────────────────────────────────────────
async function sbSaveParams() {
  if (!sbClient) return;
  const { error } = await sbClient.from('virement_params').upsert({
    id: 'config',
    banques: params.banques || [], banques_ben: params.banques_ben || [],
    beneficiaires: params.beneficiaires || [], devises: params.devises || [],
    societe: params.societe || '', adresse: params.adresse || '',
    telephone: params.telephone || '', ville: params.ville || '',
    devise_niv: params.devise_niv || '', motif_niv: params.motif_niv || '',
    banque_rea: params.banque_rea || '', motif_fac: params.motif_fac || '',
    motif_rea: params.motif_rea || '', entete_ordre: params.entete_ordre || '',
    pied_ordre: params.pied_ordre || '', signataires: params.signataires || [],
    nb_signatures: params.nb_signatures || 2,
    logo: params.logo || '', background: params.background || '#e8edf8',
    updated_at: new Date().toISOString(),
  });
  if (error) console.error('[Supabase] saveParams:', error);
}

// ── Sauvegarde utilisateurs ───────────────────────────────────────────────────
async function sbSyncUsers(users) {
  if (!sbClient) return;
  if (users.length > 0) {
    const { error } = await sbClient.from('virement_users')
      .upsert(users.map(u => ({ ...u, updated_at: new Date().toISOString() })));
    if (error) { console.error('[Supabase] saveUsers:', error); return; }
    const ids = users.map(u => u.id).join(',');
    await sbClient.from('virement_users').delete().not('id', 'in', `(${ids})`);
  } else {
    await sbClient.from('virement_users').delete().neq('id', '__never__');
  }
}

// ── Sauvegarde ordres ─────────────────────────────────────────────────────────
async function sbSyncOrders(orders) {
  if (!sbClient) return;
  if (orders.length > 0) {
    const { error } = await sbClient.from('virement_orders').upsert(orders.map(_orderToRow));
    if (error) { console.error('[Supabase] saveOrders:', error); return; }
    const ids = orders.map(o => o.id).join(',');
    await sbClient.from('virement_orders').delete().not('id', 'in', `(${ids})`);
  } else {
    await sbClient.from('virement_orders').delete().neq('id', '__never__');
  }
}

// ── Sauvegarde historique approuvés ──────────────────────────────────────────
async function sbSyncHistorique() {
  if (!sbClient) return;
  if (historique.length > 0) {
    const { error } = await sbClient.from('virement_historique').upsert(historique.map(_histToRow));
    if (error) { console.error('[Supabase] saveHistorique:', error); return; }
    const ids = historique.map(h => h.id).join(',');
    await sbClient.from('virement_historique').delete().not('id', 'in', `(${ids})`);
  } else {
    await sbClient.from('virement_historique').delete().neq('id', -1);
  }
}

// ── Sauvegarde historique rejetés ─────────────────────────────────────────────
async function sbSyncHistoriqueRejete() {
  if (!sbClient) return;
  if (historiqueRejete.length > 0) {
    const { error } = await sbClient.from('virement_historique_rejete').upsert(historiqueRejete.map(_histRejToRow));
    if (error) { console.error('[Supabase] saveHistoriqueRejete:', error); return; }
    const ids = historiqueRejete.map(h => h.id).join(',');
    await sbClient.from('virement_historique_rejete').delete().not('id', 'in', `(${ids})`);
  } else {
    await sbClient.from('virement_historique_rejete').delete().neq('id', -1);
  }
}

// ── Sauvegarde compteur de référence ─────────────────────────────────────────
async function sbSaveCounter(type, valeur) {
  if (!sbClient) return;
  const annee = new Date().getFullYear();
  const { error } = await sbClient.from('virement_counters').upsert({ annee, type, valeur });
  if (error) console.error('[Supabase] saveCounter:', error);
}

// ── Temps réel ────────────────────────────────────────────────────────────────
function setupRealtimeSubscriptions() {
  if (!sbClient) return;
  if (_sbChannel) { sbClient.removeChannel(_sbChannel); _sbChannel = null; }
  _sbChannel = sbClient.channel('app-realtime')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'virement_orders' },
      () => {
        sbClient.from('virement_orders').select('*').order('inserted_at', { ascending: false }).then(({ data }) => {
          if (!data) return;
          const newStr = JSON.stringify(data.map(_rowToOrder));
          if (localStorage.getItem('virement_orders') === newStr) return;
          localStorage.setItem('virement_orders', newStr);
          updateInboxBadge();
          const p = document.getElementById('panel-inbox');
          if (p && p.classList.contains('active')) renderInbox();
        });
      }
    )
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'virement_users' },
      () => {
        sbClient.from('virement_users').select('*').then(({ data }) => {
          if (data) localStorage.setItem('app_users', JSON.stringify(data));
        });
      }
    )
    .subscribe();
}

function subscribeToOrders() { setupRealtimeSubscriptions(); }
function subscribeToUsers()  { /* géré par setupRealtimeSubscriptions */ }

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
  societe:   'SanlamAllianz CI Assurances',
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
  sbSaveParams();
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
      sbSaveParams();
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
  sbSaveCounter(type, counters[key]);
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
  sbSaveParams();
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
  localStorage.setItem('virement_params', JSON.stringify(params));
  sbSaveParams();
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
      const isAcompte  = document.getElementById('fac_type_paiement_acompte')?.checked;
      const objetTexte = isAcompte ? 'Ordre de virement (Acompte)' : 'Ordre de virement';
      return `Abidjan, le ${g('fac_date')||'XXXXXXXX'}
N/Ref. : ${g('fac_ref')||'XXXXXXXX'}

ABIDJAN
A l'attention de M. ${g('fac_attention')||'XXXXXXXXXXXXXXXXX'}

Objet : ${objetTexte}

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

ABIDJAN
A l'attention de M. ${g('niv_attention')||'XXXXXXXXXXXXXXXXX'}

Objet : Ordre de virement

Messieurs,

Par le debit de notre compte N° ${g('niv_compte_debit')||'XXXXXXXXXXX'}, nous vous remercions de virer au benefice du compte suivant :

- Beneficiaire    :   ${params.societe||'SanlamAllianz CI Assurances'}
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
  // Ouvrir un aperçu Word-like dans une nouvelle fenêtre
  const text      = buildText(type);
  const societe   = params.societe   || 'SanlamAllianz CI Assurances';
  const adresse   = params.adresse   || '';
  const telephone = params.telephone || '';
  const logoSrc   = params.logo      || '';
  const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  const enteteHtml = params.entete_ordre
    ? params.entete_ordre.split('\n').map(l => `<p style="margin:2px 0">${esc(l)}</p>`).join('')
    : '';

  const rawLines  = text.split('\n');
  const dateLine  = rawLines[0] || '';
  const bodyLines = rawLines.slice(1);

  let bodyHtml = '';
  for (const line of bodyLines) {
    const t = line.trim();
    if (t === '') { bodyHtml += '<div style="margin:7px 0"></div>'; continue; }
    if (/SIGNATURES AUTORISEES|SIGNATURES AUTORISÉES/i.test(t)) {
      bodyHtml += `<div style="font-weight:bold;text-align:center;margin:32px 0 20px;font-size:12pt;letter-spacing:1px">SIGNATURES AUTORISÉES</div>
        <div style="display:flex;gap:40px;margin-top:8px">
          <div style="flex:1;text-align:center"><div style="height:60px;border:1px dashed #ccc;border-radius:4px;margin-bottom:6px;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:11px">Signature 1</div><div style="border-top:1px solid #000;padding-top:4px;font-size:10pt;color:#374151">Signataire 1</div></div>
          <div style="flex:1;text-align:center"><div style="height:60px;border:1px dashed #ccc;border-radius:4px;margin-bottom:6px;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:11px">Signature 2</div><div style="border-top:1px solid #000;padding-top:4px;font-size:10pt;color:#374151">Signataire 2</div></div>
        </div>`;
      continue;
    }
    if (/^NB\s*:/i.test(t)) {
      bodyHtml += `<p style="margin:4px 0;color:#cc0000;font-weight:bold;font-size:11.5pt">${esc(t)}</p>`;
    } else if (/^Ordre de virement/i.test(t)) {
      bodyHtml += `<p style="margin:4px 0;font-weight:bold;font-size:11.5pt">${esc(t)}</p>`;
    } else {
      const ci = t.indexOf(':');
      if (ci > 0 && t.startsWith('-') && ci < t.length - 1) {
        bodyHtml += `<p style="margin:2px 0;font-size:11.5pt"><span>${esc(t.slice(0,ci+1))}</span><strong>${esc(t.slice(ci+1))}</strong></p>`;
      } else {
        bodyHtml += `<p style="margin:3px 0;font-size:11.5pt">${esc(t)}</p>`;
      }
    }
  }
  const logoHtml = logoSrc ? `<img src="${logoSrc}" style="height:55px;margin-bottom:6px" alt="logo">` : '';

  const w = window.open('', '_blank', 'width=860,height:1000');
  if (!w) { showToast('Popup bloquée — autorisez les popups', 'error'); return; }
  w.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Aperçu — Ordre de Virement</title>
<style>
  *{box-sizing:border-box}
  body{font-family:'Times New Roman',serif;background:#e5e5e5;margin:0;padding:30px 20px}
  .page{width:21cm;min-height:29.7cm;background:#fff;margin:0 auto;padding:2.2cm 2.5cm 2.2cm 3.2cm;box-shadow:0 4px 24px rgba(0,0,0,.18);position:relative}
  .watermark{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);font-size:72px;font-weight:900;color:rgba(30,58,138,.06);pointer-events:none;letter-spacing:4px;white-space:nowrap}
  .hdr{text-align:center;margin-bottom:22px}
  .hdr h1{font-size:15pt;font-weight:bold;margin:0 0 3px;color:#1e3a8a}
  .hdr p{font-size:10pt;margin:2px 0;color:#444}
  .date-row{text-align:right;font-weight:bold;margin-bottom:16px;font-size:11pt}
  .body-content{line-height:1.9}
  .no-print{text-align:center;margin:30px 0 10px;padding:16px;background:#f0f5ff;border-radius:8px}
  .badge-apercu{display:inline-block;background:#f59e0b;color:#fff;font-size:11px;padding:2px 10px;border-radius:12px;font-weight:600;margin-left:8px;vertical-align:middle}
  @media print{body{background:#fff;padding:0}.page{box-shadow:none;margin:0;padding:2cm 2cm 2cm 3cm}.no-print,.watermark{display:none}@page{size:A4;margin:0}}
</style></head><body>
<div class="page">
  <div class="watermark">APERÇU</div>
  <div class="hdr">
    ${logoHtml}
    ${enteteHtml}
  </div>
  <div class="date-row">${esc(dateLine)}</div>
  <div class="body-content">${bodyHtml}</div>
  <div class="no-print">
    <span style="font-size:13px;color:#374151;font-weight:600">Aperçu du document</span>
    <span class="badge-apercu">NON OFFICIEL</span>
    <br><span style="font-size:11px;color:#64748b;margin-top:4px;display:block">Les signataires et signatures seront ajoutés lors de la génération officielle</span>
  </div>
</div>
</body></html>`);
  w.document.close();
  // Masquer la zone pre si elle était visible
  const el = document.getElementById('preview-'+type);
  if (el) el.style.display = 'none';
}

function clearForm(type) {
  const prefixes = { facture:'fac',bancassurance:'ban',nivellement:'niv',reassurance:'rea',sinistre:'sin' };
  const px = prefixes[type];
  document.querySelectorAll(`[id^="${px}_"]`).forEach(el => {
    if (el.tagName==='SELECT') el.selectedIndex=0;
    else if (el.tagName==='INPUT' && el.type==='radio') el.checked = (el.id === px+'_type_paiement_total');
    else el.value='';
  });
  ['iban','swift'].forEach(f => {
    const el = document.getElementById(px+'_'+f);
    if (el) { el.readOnly=true; el.classList.add('autofill'); el.placeholder='Selectionner la banque ci-dessus'; }
  });
  document.getElementById('preview-'+type).style.display='none';
  clearValidation(type);
  localStorage.removeItem('draft_'+type);
  tempAttachments[type] = [];
  renderTempAttachments(type);
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
  // Vérification doublon avant génération
  const prefix = PANEL_META[type] ? PANEL_META[type].prefix : '';
  const mntEl  = prefix ? document.getElementById(prefix + '_montant') : null;
  const montant = mntEl ? mntEl.value.trim() : '';
  const beneficiaire = _extractBeneficiaire(type, prefix);
  const dup = findDuplicateTransfer(beneficiaire, montant, type);
  if (dup) {
    const msg = `⚠️ ATTENTION — Ce virement semble déjà avoir été effectué !\n\nUn virement identique existe déjà :\n• Référence : ${dup.ref}\n• Date : ${dup.date}\n• Statut : ${dup.status}\n\nMême bénéficiaire (${beneficiaire}) et même montant (${montant}).\n\nVoulez-vous quand même générer cet ordre de virement ?`;
    if (!confirm(msg)) return;
    // Doublon forcé → notifier superviseur
    const refEl = prefix ? document.getElementById(prefix + '_ref') : null;
    const ref = refEl ? refEl.value.trim() : '';
    notifySupervisorDuplicate(type, ref, montant, beneficiaire, dup);
    showToast('Superviseur notifié du doublon potentiel', 'error');
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

    function mkLabelVal(trim, opts={}) {
      const ci = trim.indexOf(':');
      if (ci > 0 && ci < trim.length - 1) {
        return new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { before:0, after: opts.after !== undefined ? opts.after : 80 },
          children: [
            new TextRun({ text: trim.slice(0, ci + 1), bold: true,  size: SZ, font: FONT }),
            new TextRun({ text: trim.slice(ci + 1),    bold: false, size: SZ, font: FONT }),
          ]
        });
      }
      return mkPara(trim, opts);
    }

    function mkLineRich(trim, opts={}) {
      const ci = trim.indexOf(':');
      if (ci > 0 && ci < trim.length - 1) {
        const label = trim.slice(0, ci).trimEnd() + ':';
        const value = trim.slice(ci + 1).trimStart();
        return new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { before:0, after: opts.after !== undefined ? opts.after : 80 },
          tabStops: [{ type: 'left', position: 2800 }],
          children: [
            new TextRun({ text: label, bold: false, size: SZ, font: FONT }),
            new TextRun({ text: '\t',  size: SZ, font: FONT }),
            new TextRun({ text: value, bold: true,  size: SZ, font: FONT }),
          ]
        });
      }
      return new Paragraph({ alignment: AlignmentType.LEFT, spacing: { before:0, after: opts.after !== undefined ? opts.after : 80 }, children: [new TextRun({ text: trim, bold: !!opts.allBold, size: SZ, font: FONT })] });
    }

    const children = [];

    // EN-TETE OFFICIELLE
    if (params.entete_ordre) {
      // En-tête personnalisée — remplace l'en-tête standard
      params.entete_ordre.split('\n').forEach(line => {
        children.push(mkPara(line, {align:AlignmentType.CENTER, size:20, after:40}));
      });
    } else {
    }
    children.push(mkPara('',{after:200}));

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
          const cc = [mkPara('', {after:400})];
          cc.push(new Paragraph({
            alignment:AlignmentType.CENTER, spacing:{before:0,after:80},
            border:{bottom:{style:BorderStyle.SINGLE,size:6,color:'000000'}},
            children:[new TextRun({text:'',size:SZ,font:FONT})]
          }));
          if (sigInfo && sigInfo.nom) {
            cc.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:60,after:40},children:[new TextRun({text:sigInfo.nom,bold:true,size:20,font:FONT})]}));
            cc.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:0,after:0},children:[new TextRun({text:sigInfo.titre||'',italics:true,size:18,font:FONT,color:'444444'})]}));
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
      } else if (/^N\/R[eé]f/i.test(trim)) {
        children.push(mkLabelVal(trim,{after:80}));
      } else if (/^Objet\s*:/i.test(trim)) {
        children.push(mkLabelVal(trim,{after:80}));
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

    showToast('Fichier Word généré : ' + fname, 'success');
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
  const societe   = params.societe   || 'SanlamAllianz CI Assurances';
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
  .hdr{text-align:center;margin-bottom:20px}
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
    ${enteteHtml}
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
//  SIGNATURE ÉLECTRONIQUE (N5) — Signature + Initiales
// ──────────────────────────────────────────
let _sigDrawing = false, _sigLastX = 0, _sigLastY = 0;
let _activeCanvas = null, _activeCtx = null;

function _bindCanvas(canvas) {
  if (!canvas) return;
  _activeCanvas = canvas;
  _activeCtx    = canvas.getContext('2d');
  canvas.onmousedown = e => { _sigDrawing=true; const r=canvas.getBoundingClientRect(); _sigLastX=e.clientX-r.left; _sigLastY=e.clientY-r.top; };
  canvas.onmousemove = e => {
    if (!_sigDrawing) return;
    const r=canvas.getBoundingClientRect();
    _activeCtx.beginPath(); _activeCtx.moveTo(_sigLastX,_sigLastY);
    _sigLastX=e.clientX-r.left; _sigLastY=e.clientY-r.top;
    _activeCtx.lineTo(_sigLastX,_sigLastY);
    _activeCtx.strokeStyle='#000'; _activeCtx.lineWidth=2; _activeCtx.lineCap='round'; _activeCtx.stroke();
  };
  canvas.onmouseup    = () => { _sigDrawing=false; };
  canvas.onmouseleave = () => { _sigDrawing=false; };
  canvas.ontouchstart = e => { e.preventDefault(); const t=e.touches[0],r=canvas.getBoundingClientRect(); _sigDrawing=true; _sigLastX=t.clientX-r.left; _sigLastY=t.clientY-r.top; };
  canvas.ontouchmove  = e => {
    e.preventDefault(); if (!_sigDrawing) return;
    const t=e.touches[0],r=canvas.getBoundingClientRect();
    _activeCtx.beginPath(); _activeCtx.moveTo(_sigLastX,_sigLastY);
    _sigLastX=t.clientX-r.left; _sigLastY=t.clientY-r.top;
    _activeCtx.lineTo(_sigLastX,_sigLastY);
    _activeCtx.strokeStyle='#000'; _activeCtx.lineWidth=2; _activeCtx.lineCap='round'; _activeCtx.stroke();
  };
  canvas.ontouchend = () => { _sigDrawing=false; };
}

function openSignatureModal() {
  const overlay = document.getElementById('sig-modal-overlay');
  if (!overlay) return;
  overlay.style.display = 'flex';
  // Charger les signatures existantes si présentes
  const u = getCurrentUser();
  if (u) {
    const users = getUsers();
    const full  = users.find(x => x.id === u.id);
    if (full && full.signature) {
      const img = new Image(); img.onload = () => {
        const c = document.getElementById('sig-canvas');
        if (c) { const ctx=c.getContext('2d'); ctx.clearRect(0,0,c.width,c.height); ctx.drawImage(img,0,0,c.width,c.height); }
      }; img.src = full.signature;
      document.getElementById('sig-full-status').textContent = '✓ Signature déjà enregistrée';
    }
    if (full && full.initiales) {
      const inp = document.getElementById('sig-init-text');
      if (inp) inp.value = full.initiales;
      document.getElementById('sig-init-status').textContent = '✓ Initiales déjà enregistrées';
    }
  }
  switchSigTab('full');
}

function switchSigTab(tab) {
  const fullPanel = document.getElementById('sig-panel-full');
  const initPanel = document.getElementById('sig-panel-init');
  const tabFull   = document.getElementById('sig-tab-full');
  const tabInit   = document.getElementById('sig-tab-init');
  if (tab === 'full') {
    fullPanel.style.display = ''; initPanel.style.display = 'none';
    tabFull.style.color = '#1e3a8a'; tabFull.style.borderBottomColor = '#1e3a8a';
    tabInit.style.color = '#94a3b8'; tabInit.style.borderBottomColor = 'transparent';
    _bindCanvas(document.getElementById('sig-canvas'));
  } else {
    fullPanel.style.display = 'none'; initPanel.style.display = '';
    tabInit.style.color = '#1e3a8a'; tabInit.style.borderBottomColor = '#1e3a8a';
    tabFull.style.color = '#94a3b8'; tabFull.style.borderBottomColor = 'transparent';
    setTimeout(() => { const inp = document.getElementById('sig-init-text'); if (inp) inp.focus(); }, 50);
  }
}

function clearSigCanvas(canvasId) {
  const id = canvasId || 'sig-canvas';
  const c = document.getElementById(id);
  if (c) c.getContext('2d').clearRect(0,0,c.width,c.height);
  if (id === 'sig-canvas') { const s=document.getElementById('sig-full-status'); if(s) s.textContent=''; }
  else { const s=document.getElementById('sig-init-status'); if(s) s.textContent=''; }
}

function closeSigModal() {
  const overlay = document.getElementById('sig-modal-overlay');
  if (overlay) overlay.style.display = 'none';
}

function saveSignatureOnly() {
  const c = document.getElementById('sig-canvas');
  const u = getCurrentUser();
  if (!u) { showToast('Connectez-vous d\'abord', 'error'); return; }
  const ctx = c.getContext('2d');
  const empty = !ctx.getImageData(0,0,c.width,c.height).data.some(v => v !== 0);
  if (empty) { showToast('Veuillez dessiner votre signature', 'error'); return; }
  const users = getUsers();
  const idx = users.findIndex(x => x.id === u.id);
  if (idx < 0) return;
  users[idx].signature = c.toDataURL('image/png');
  saveUsers(users);
  document.getElementById('sig-full-status').textContent = '✓ Signature enregistrée';
  showToast('Signature enregistrée avec succès', 'success');
}

function saveInitialesOnly() {
  const inp = document.getElementById('sig-init-text');
  const u = getCurrentUser();
  if (!u) { showToast('Connectez-vous d\'abord', 'error'); return; }
  const initText = (inp ? inp.value : '').trim().toUpperCase();
  if (!initText) { showToast('Veuillez saisir vos initiales', 'error'); return; }
  const users = getUsers();
  const idx = users.findIndex(x => x.id === u.id);
  if (idx < 0) return;
  users[idx].initiales = initText;
  saveUsers(users);
  document.getElementById('sig-init-status').textContent = '✓ Initiales enregistrées';
  showToast('Initiales enregistrées avec succès', 'success');
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
let historiqueRejete = [];

function loadHistorique() {
  try { historique=JSON.parse(localStorage.getItem('virement_historique')||'[]'); } catch(e) { historique=[]; }
  updateHistCount();
}

function saveHistorique() {
  localStorage.setItem('virement_historique', JSON.stringify(historique));
  sbSyncHistorique();
  updateHistCount();
}

function loadHistoriqueRejete() {
  try { historiqueRejete=JSON.parse(localStorage.getItem('virement_historique_rejete')||'[]'); } catch(e) { historiqueRejete=[]; }
}

function saveHistoriqueRejete() {
  localStorage.setItem('virement_historique_rejete', JSON.stringify(historiqueRejete));
  sbSyncHistoriqueRejete();
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
    nivellement:  {date:g('niv_date'),ref:g('niv_ref'),beneficiaire:params.societe||'SanlamAllianz CI',banqueDebitrice:g('niv_banque'),banqueBeneficiaire:g('niv_banque'),devise:params.devise_niv||'XOF',montant:g('niv_montant'),iban:'',swift:'',motif:params.motif_niv||'NIVELLEMENT'},
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
    </div></td></tr>`;
    renderHistoriqueRejete(); return;
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
  renderHistoriqueRejete();
}

function deleteHistEntry(idx) {
  if (!confirm('Supprimer cette entree ?')) return;
  historique.splice(idx,1); saveHistorique(); renderHistorique();
}

function renderHistoriqueRejete() {
  const container = document.getElementById('hist-rejete-container');
  if (!container) return;
  if (historiqueRejete.length === 0) { container.innerHTML = ''; return; }
  const tc={facture:'type-facture',bancassurance:'type-bancassurance',nivellement:'type-nivellement',reassurance:'type-reassurance',sinistre:'type-sinistre'};
  const tl={facture:'Facture',bancassurance:'Bancassurance',nivellement:'Nivellement',reassurance:'Reassurance',sinistre:'Sinistre'};
  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div class="card-header-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
        </div>
        <h2>Virements Rejetés</h2>
        <span class="badge" style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca">${historiqueRejete.length} rejeté(s)</span>
      </div>
      <div style="overflow-x:auto">
        <table class="hist-table">
          <thead><tr>
            <th>#</th><th>Date génération</th><th>Type</th><th>Date virement</th>
            <th>N/Réf</th><th>Bénéficiaire</th><th>Montant</th><th>Devise</th>
            <th>Rejeté le</th><th>Rejeté par</th><th>Motif du rejet</th><th></th>
          </tr></thead>
          <tbody>
            ${historiqueRejete.map((h,i)=>`<tr style="background:#fffbfb">
              <td style="color:var(--text-light);font-size:12px">${historiqueRejete.length-i}</td>
              <td style="font-size:12px;color:var(--text-light);white-space:nowrap">${h.generatedAt||'—'}</td>
              <td><span class="type-badge ${tc[h.type]||''}">${tl[h.type]||h.type}</span></td>
              <td style="white-space:nowrap"><strong>${h.date||'—'}</strong></td>
              <td style="font-family:monospace;font-size:12px">${h.ref||'—'}</td>
              <td><strong>${h.beneficiaire||'—'}</strong></td>
              <td style="font-weight:700;color:#dc2626">${h.montant||'—'}</td>
              <td>${h.devise||'—'}</td>
              <td style="font-size:12px;white-space:nowrap">${h.rejeteAt||'—'}</td>
              <td style="font-size:12px">${h.rejeteBy||'—'}</td>
              <td style="font-size:12px;color:#dc2626"><em>${h.motifRejet||'—'}</em></td>
              <td><button class="btn-del-row" title="Supprimer" onclick="deleteRejeteEntry(${i})">x</button></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

function deleteRejeteEntry(idx) {
  if (!confirm('Supprimer cette entree ?')) return;
  historiqueRejete.splice(idx,1); saveHistoriqueRejete(); renderHistoriqueRejete();
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
  3: { gestionUsers:false, parametres:true,  virement:true, historique:false, print:false, inbox:true, soumettre:true },
  4: { gestionUsers:false, parametres:true,  virement:false, historique:true,  print:true, inbox:true, soumettre:false },
  5: { gestionUsers:false, parametres:false, virement:false, historique:false, print:true, inbox:true, soumettre:false },
};

function getUsers() {
  try { return JSON.parse(localStorage.getItem('app_users') || '[]'); } catch(e) { return []; }
}

function saveUsers(users) {
  localStorage.setItem('app_users', JSON.stringify(users));
  sbSyncUsers(users);
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
      createdAt: new Date().toISOString(),
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

  show('nav-utilisateurs',    perm.gestionUsers);
  show('nav-parametres',      perm.parametres);
  show('nav-historique',      perm.historique);
  show('nav-signature',       !!(u && u.niveau === 5));
  show('nav-inbox',           !!perm.inbox);

  // Onglets de saisie — masqués pour superviseur (N4) et signataire (N5)
  show('nav-section-saisie',  !!perm.virement);
  show('nav-facture',         !!perm.virement);
  show('nav-bancassurance',   !!perm.virement);
  show('nav-nivellement',     !!perm.virement);
  show('nav-reassurance',     !!perm.virement);
  show('nav-sinistre',        !!perm.virement);

  // Rediriger vers la boîte de réception si l'utilisateur n'a pas accès aux formulaires
  if (!perm.virement) {
    const current = document.querySelector('.panel.active');
    const virPanels = ['panel-facture','panel-bancassurance','panel-nivellement','panel-reassurance','panel-sinistre'];
    if (!current || virPanels.includes(current.id)) showPanel('inbox');
  }

  // Boutons génération directe — masqués pour N3 (doit passer par le workflow)
  document.querySelectorAll('.btn-direct-gen').forEach(b => { b.style.display = perm.print ? '' : 'none'; });
  document.querySelectorAll('.btn-soumettre').forEach(b => { b.style.display = perm.soumettre ? '' : 'none'; });

  // Boutons ajout rapide banque/bénéficiaire — visibles uniquement pour N1 et N2
  document.querySelectorAll('.btn-quick-add').forEach(b => { b.style.display = perm.parametres ? 'flex' : 'none'; });

  // Zones d'ajout de pièces jointes — masquées pour N4/N5 (examen uniquement, pas d'ajout)
  // Seuls N1, N2, N3 peuvent ajouter des documents
  const canAddPJ = u.niveau <= 3;
  ['facture','bancassurance','nivellement','reassurance','sinistre'].forEach(type => {
    const zone = document.getElementById('upload-zone-' + type);
    if (zone) zone.style.display = canAddPJ ? '' : 'none';

    // Pour N4/N5 : remplacer la zone d'upload par un bandeau informatif
    const zoneParent = zone ? zone.parentElement : null;
    const existingInfo = zoneParent ? zoneParent.querySelector('.pj-supervisor-info') : null;
    if (!canAddPJ && zoneParent && !existingInfo) {
      const info = document.createElement('div');
      info.className = 'pj-supervisor-info';
      info.style.cssText = 'padding:10px 14px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;font-size:12px;color:#0369a1;margin-top:6px;display:flex;align-items:center;gap:8px';
      info.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><span>Les factures scannées sont ajoutées par l\'utilisateur lors de la saisie. Examinez-les dans la <strong>Boîte de réception</strong> lors de la validation.</span>';
      zoneParent.insertBefore(info, zone.nextSibling);
    } else if (canAddPJ && existingInfo) {
      existingInfo.remove();
    }
  });

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
    createdAt: new Date().toISOString(),
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
  const nom  = params.societe || 'SanlamAllianz CI';

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
  sbSaveParams();
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
  sbSyncOrders(orders);
}

function getPendingCount() {
  const u = getCurrentUser();
  if (!u) return 0;
  const orders = getOrders();
  if (u.niveau === 3) return orders.filter(o => o.createdBy === u.id && (o.status === 'pret_impression' || o.status === 'rejete')).length;
  if (u.niveau === 4) return orders.filter(o => o.status === 'soumis' || o.status === 'doublon_alerte').length;
  if (u.niveau === 5) return orders.filter(o => o.status === 'valide' && !(o.signatures||[]).some(s => s.userId === u.id)).length;
  return orders.filter(o => ['soumis','valide','doublon_alerte'].includes(o.status)).length;
}

function updateInboxBadge() {
  const count = getPendingCount();
  const badge = document.getElementById('inbox-badge');
  if (badge) { badge.textContent = count > 0 ? count : ''; badge.style.display = count > 0 ? '' : 'none'; }
}

// ═══════════════════════════════════════════
// PIÈCES JOINTES — IndexedDB + gestion formulaire
// ═══════════════════════════════════════════
const tempAttachments = {};
let _attachDB = null;

function _getAttachDB() {
  return new Promise((resolve, reject) => {
    if (_attachDB) { resolve(_attachDB); return; }
    const req = indexedDB.open('virement_pj', 1);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('files')) {
        db.createObjectStore('files', { keyPath: 'pk', autoIncrement: true });
      }
    };
    req.onsuccess = e => { _attachDB = e.target.result; resolve(_attachDB); };
    req.onerror = e => reject(e.target.error);
  });
}

function _saveAttachmentsToDB(orderId, files) {
  return _getAttachDB().then(db => new Promise((resolve, reject) => {
    if (!files.length) { resolve(); return; }
    const tx = db.transaction('files', 'readwrite');
    const store = tx.objectStore('files');
    files.forEach(f => store.add({ orderId, name: f.name, type: f.type, size: f.size, dataUrl: f.dataUrl }));
    tx.oncomplete = resolve;
    tx.onerror = e => reject(e.target.error);
  }));
}

function getAttachmentsFromDB(orderId) {
  return _getAttachDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction('files', 'readonly');
    const store = tx.objectStore('files');
    const results = [];
    const cur = store.openCursor();
    cur.onsuccess = e => {
      const cursor = e.target.result;
      if (cursor) { if (cursor.value.orderId === orderId) results.push(cursor.value); cursor.continue(); }
      else resolve(results);
    };
    cur.onerror = e => reject(e.target.error);
  }));
}

function handleFileSelect(event, formType) {
  processAttachmentFiles(Array.from(event.target.files), formType);
  event.target.value = '';
}

function handleFileDrop(event, formType) {
  event.preventDefault();
  const zone = document.getElementById('upload-zone-' + formType);
  if (zone) zone.classList.remove('dragover');
  processAttachmentFiles(Array.from(event.dataTransfer.files), formType);
}

function processAttachmentFiles(files, formType) {
  if (!tempAttachments[formType]) tempAttachments[formType] = [];
  const MAX = 10 * 1024 * 1024;
  let added = 0;
  files.forEach(file => {
    if (file.size > MAX) { showToast(file.name + ' dépasse 10 Mo — non ajouté', 'error'); return; }
    const reader = new FileReader();
    reader.onload = e => {
      tempAttachments[formType].push({ name: file.name, type: file.type, size: file.size, dataUrl: e.target.result });
      renderTempAttachments(formType);
    };
    reader.readAsDataURL(file);
    added++;
  });
  if (added > 0) showToast(added + ' fichier(s) ajouté(s)', 'success');
}

function renderTempAttachments(formType) {
  const el = document.getElementById('attachments-' + formType);
  if (!el) return;
  const list = tempAttachments[formType] || [];
  if (list.length === 0) { el.innerHTML = ''; return; }
  el.innerHTML = list.map((f, i) => {
    const icon = f.type === 'application/pdf' ? '📄' : '🖼️';
    const size = f.size < 1048576 ? Math.round(f.size / 1024) + ' Ko' : (f.size / 1048576).toFixed(1) + ' Mo';
    return `<div class="attachment-item"><span class="att-icon">${icon}</span><span class="att-name">${f.name}</span><span class="att-size">${size}</span><button class="att-remove" onclick="removeTempAttachment('${formType}',${i})" title="Retirer">✕</button></div>`;
  }).join('');
}

function removeTempAttachment(formType, idx) {
  if (tempAttachments[formType]) { tempAttachments[formType].splice(idx, 1); renderTempAttachments(formType); }
}

function viewOrderAttachments(orderId) {
  const modal = document.getElementById('attach-view-modal');
  const body  = document.getElementById('attach-view-body');
  const sub   = document.getElementById('attach-view-subtitle');
  if (!modal || !body) return;
  body.innerHTML = '<p style="text-align:center;color:#64748b;padding:30px 0">Chargement…</p>';
  modal.style.display = 'flex';
  getAttachmentsFromDB(orderId).then(files => {
    const ord = getOrders().find(o => o.id === orderId);
    if (sub && ord) sub.textContent = 'Réf : ' + (ord.ref || '—') + ' — ' + files.length + ' document(s)';
    if (files.length === 0) {
      body.innerHTML = '<p style="text-align:center;color:#64748b;padding:40px 0">Aucune pièce jointe pour cet ordre.</p>';
      return;
    }
    body.innerHTML = files.map((f, i) => {
      const isImg = f.type && f.type.startsWith('image/');
      const isPdf = f.type === 'application/pdf';
      const size  = f.size < 1048576 ? Math.round(f.size / 1024) + ' Ko' : (f.size / 1048576).toFixed(1) + ' Mo';
      const preview = isImg
        ? `<img src="${f.dataUrl}" style="max-width:100%;max-height:500px;border-radius:6px;border:1px solid #e2e8f0;display:block;margin:10px auto">`
        : isPdf
          ? `<iframe src="${f.dataUrl}" style="width:100%;height:520px;border:1px solid #e2e8f0;border-radius:6px;margin:10px 0" title="${f.name}"></iframe>`
          : '';
      const sep = i < files.length - 1 ? 'border-bottom:1px solid #f1f5f9;margin-bottom:24px;padding-bottom:24px;' : '';
      return `<div style="${sep}"><div style="display:flex;align-items:center;gap:10px;margin-bottom:8px"><span style="font-size:22px">${isPdf ? '📄' : isImg ? '🖼️' : '📎'}</span><div><div style="font-weight:600;font-size:14px;color:#1e293b">${f.name}</div><div style="font-size:11px;color:#94a3b8">${size}</div></div><a href="${f.dataUrl}" download="${f.name}" style="margin-left:auto;padding:5px 14px;background:#1e3a8a;color:#fff;border-radius:6px;font-size:12px;text-decoration:none;font-weight:600">&#11015; Télécharger</a></div>${preview}</div>`;
    }).join('');
  }).catch(() => {
    body.innerHTML = '<p style="text-align:center;color:#dc2626;padding:40px 0">Erreur lors du chargement des pièces jointes.</p>';
  });
}

function closeAttachViewModal() {
  const modal = document.getElementById('attach-view-modal');
  if (modal) modal.style.display = 'none';
}

// ══════════════════════════════════════════
//  DÉTECTION DE DOUBLON DE VIREMENT
// ══════════════════════════════════════════
function findDuplicateTransfer(beneficiaire, montant, type) {
  if (!beneficiaire || !montant) return null;
  const mnt = String(montant).replace(/[\s ]/g,'');
  // Chercher dans les ordres en cours
  const orders = getOrders();
  const dupOrder = orders.find(o =>
    o.type === type &&
    String(o.montant||'').replace(/[\s ]/g,'') === mnt &&
    (o.beneficiaire||'').toLowerCase().trim() === (beneficiaire||'').toLowerCase().trim() &&
    o.status !== 'rejete'
  );
  if (dupOrder) return { source: 'workflow', ref: dupOrder.ref, date: dupOrder.createdAt, status: dupOrder.status };

  // Chercher dans l'historique (30 derniers jours)
  const limit = Date.now() - 30 * 24 * 3600 * 1000;
  const dupHist = historique.find(h =>
    h.type === type &&
    String(h.montant||'').replace(/[\s ]/g,'') === mnt &&
    (h.beneficiaire||'').toLowerCase().trim() === (beneficiaire||'').toLowerCase().trim() &&
    new Date(h.generatedAt).getTime() > limit
  );
  if (dupHist) return { source: 'historique', ref: dupHist.ref, date: dupHist.generatedAt, status: 'exécuté' };
  return null;
}

function notifySupervisorDuplicate(type, ref, montant, beneficiaire, duplicateInfo) {
  const u = getCurrentUser();
  const orders = getOrders();
  const notif = {
    id: 'dup_' + Date.now().toString(), type, status: 'doublon_alerte',
    ref: ref, beneficiaire, montant,
    texte: '',
    createdBy: u ? u.id : '?',
    createdByNom: u ? u.prenom + ' ' + u.nom : '?',
    createdAt: new Date().toLocaleString('fr-FR'),
    validatedBy: null, validatedAt: null, rejectReason: null,
    signatures: [], requiredSignatures: 0,
    history: [{ action: 'alerte doublon', by: u ? u.prenom + ' ' + u.nom : '?', at: new Date().toLocaleString('fr-FR') }],
    piecesJointes: [],
    duplicateInfo,
  };
  orders.push(notif);
  saveOrders(orders);
  updateInboxBadge();
}

function _extractBeneficiaire(type, prefix) {
  let beneficiaire = '';
  const benSel = prefix ? document.getElementById(prefix + '_beneficiaire_sel') : null;
  if (benSel && benSel.value && benSel.value !== '__autre__') {
    beneficiaire = benSel.options[benSel.selectedIndex] ? benSel.options[benSel.selectedIndex].text : benSel.value;
  } else {
    const benInp = prefix ? document.getElementById(prefix + '_beneficiaire') : null;
    if (benInp) beneficiaire = benInp.value.trim();
    if (!beneficiaire && type === 'nivellement') beneficiaire = params.societe || 'SanlamAllianz CI';
  }
  return beneficiaire;
}

function submitOrder(type) {
  if (!validateForm(type)) { showToast('Veuillez remplir tous les champs obligatoires', 'error'); return; }
  const u = getCurrentUser();
  if (!u) return;
  const prefix  = PANEL_META[type] ? PANEL_META[type].prefix : '';
  const refEl   = prefix ? document.getElementById(prefix + '_ref')    : null;
  const mntEl   = prefix ? document.getElementById(prefix + '_montant') : null;
  const ref     = refEl  ? refEl.value.trim()  : '';
  const montant = mntEl  ? mntEl.value.trim()  : '';
  const beneficiaire = _extractBeneficiaire(type, prefix);

  // Vérification doublon avant soumission
  const dup = findDuplicateTransfer(beneficiaire, montant, type);
  if (dup) {
    const msg = `⚠️ ATTENTION — Virement potentiellement en double !\n\nUn virement similaire a déjà été enregistré :\n• Référence : ${dup.ref}\n• Date : ${dup.date}\n• Statut : ${dup.status}\n\nMême bénéficiaire (${beneficiaire}) et même montant (${montant}).\n\nVoulez-vous forcer la soumission malgré tout ?`;
    if (!confirm(msg)) return;
    // Doublon forcé → notifier le superviseur
    notifySupervisorDuplicate(type, ref, montant, beneficiaire, dup);
    showToast('Superviseur notifié du doublon potentiel', 'error');
  }

  const texte = buildText(type);
  incrementRef(type);
  const histData = extractHistoryData(type);
  saveToHistory(type, Object.assign(histData, { fichier: 'Workflow — soumis' }));
  const pjFiles = [...(tempAttachments[type] || [])];
  const order = {
    id: Date.now().toString(), type, status: 'soumis', ref, beneficiaire, montant, texte,
    createdBy: u.id, createdByNom: u.prenom + ' ' + u.nom,
    createdAt: new Date().toLocaleString('fr-FR'),
    validatedBy: null, validatedAt: null, rejectReason: null,
    signatures: [], requiredSignatures: params.nb_signatures || 2,
    history: [{ action: 'soumis', by: u.prenom + ' ' + u.nom, at: new Date().toLocaleString('fr-FR') }],
    piecesJointes: pjFiles.map(f => ({ name: f.name, type: f.type, size: f.size })),
    isDuplicate: !!dup,
  };
  const orders = getOrders(); orders.push(order); saveOrders(orders);
  if (pjFiles.length > 0) _saveAttachmentsToDB(order.id, pjFiles).catch(e => console.warn('PJ:', e));
  tempAttachments[type] = [];
  renderTempAttachments(type);
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
  saveOrders(orders);
  // Déplacer l'entrée correspondante de l'historique vers l'historique des rejets
  const hi = historique.findIndex(h => h.ref === ord.ref && h.type === ord.type);
  if (hi >= 0) {
    const entry = historique.splice(hi, 1)[0];
    entry.motifRejet = reason.trim();
    entry.rejeteAt = new Date().toLocaleString('fr-FR');
    entry.rejeteBy = u.prenom + ' ' + u.nom;
    historiqueRejete.unshift(entry);
    saveHistorique();
    saveHistoriqueRejete();
  }
  updateInboxBadge(); renderInbox(); showToast('Ordre rejeté', 'error');
}

let _pendingSignOrderId = null;

function signOrder(id) {
  const u = getCurrentUser();
  if (!u || (u.niveau !== 5 && u.niveau > 2)) { showToast('Réservé aux signataires (Niveau 5)', 'error'); return; }
  const orders = getOrders(); const ord = orders.find(o => o.id === id);
  if (!ord || ord.status !== 'valide') { showToast('Cet ordre ne peut pas être signé', 'error'); return; }
  if ((ord.signatures||[]).some(s => s.userId === u.id)) { showToast('Vous avez déjà signé cet ordre', 'error'); return; }

  const users = getUsers(); const fullUser = users.find(x => x.id === u.id);
  const hasSig  = !!(fullUser && fullUser.signature);
  const hasInit = !!(fullUser && fullUser.initiales && fullUser.initiales.trim());

  if (!hasSig && !hasInit) {
    showToast('Veuillez d\'abord enregistrer votre signature ou vos initiales via "Ma Signature"', 'error'); return;
  }
  // Si un seul mode disponible, signer directement
  if (hasSig && !hasInit) { _pendingSignOrderId = id; signOrderWith('signature'); return; }
  if (!hasSig && hasInit) { _pendingSignOrderId = id; signOrderWith('initiales'); return; }

  // Les deux modes sont disponibles → afficher le choix
  _pendingSignOrderId = id;
  document.getElementById('sign-choice-modal').style.display = 'flex';
}

function closeSignChoiceModal() {
  document.getElementById('sign-choice-modal').style.display = 'none';
  _pendingSignOrderId = null;
}

function signOrderWith(mode) {
  document.getElementById('sign-choice-modal').style.display = 'none';
  const id = _pendingSignOrderId;
  _pendingSignOrderId = null;
  if (!id) return;

  const u = getCurrentUser();
  const orders = getOrders(); const ord = orders.find(o => o.id === id);
  if (!ord) return;
  const users = getUsers(); const fullUser = users.find(x => x.id === u.id);
  const titre = fullUser ? (fullUser.titre || '') : '';

  let sigEntry;
  if (mode === 'initiales') {
    const initiales = fullUser ? (fullUser.initiales || '').trim() : '';
    if (!initiales) { showToast('Aucunes initiales enregistrées — configurez-les via "Ma Signature"', 'error'); return; }
    sigEntry = { userId: u.id, nom: u.prenom + ' ' + u.nom, titre, initiales, type: 'initiales', signedAt: new Date().toLocaleString('fr-FR') };
  } else {
    const sigImage = getCurrentUserSignature();
    if (!sigImage) { showToast('Aucune signature enregistrée — configurez-la via "Ma Signature"', 'error'); return; }
    sigEntry = { userId: u.id, nom: u.prenom + ' ' + u.nom, titre, image: sigImage, type: 'signature', signedAt: new Date().toLocaleString('fr-FR') };
  }

  ord.signatures.push(sigEntry);
  const modeLabel = mode === 'initiales' ? 'par initiales' : 'par signature';
  ord.history.push({ action: 'signé ' + modeLabel, by: u.prenom + ' ' + u.nom, at: new Date().toLocaleString('fr-FR') });

  if (ord.signatures.length >= (ord.requiredSignatures || 2)) {
    ord.status = 'pret_impression';
    ord.history.push({ action: 'prêt à imprimer', by: 'système', at: new Date().toLocaleString('fr-FR') });
    showToast('Ordre entièrement signé — prêt pour impression', 'success');
  } else {
    showToast('Signé ' + modeLabel + ' (' + ord.signatures.length + '/' + (ord.requiredSignatures||2) + ')', 'success');
  }
  saveOrders(orders); updateInboxBadge(); renderInbox();
}

function printSignedOrder(id) {
  const orders = getOrders(); const ord = orders.find(o => o.id === id); if (!ord) return;
  const esc = s => (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const sigCellHtml = (sigInfo) => {
    let imgBlock;
    if (sigInfo && sigInfo.type === 'initiales' && sigInfo.initiales) {
      imgBlock = `<div style="height:55px;display:flex;align-items:center;justify-content:center"><span style="font-size:30px;font-family:'Georgia',serif;font-weight:bold;color:#1e3a8a;letter-spacing:5px">${esc(sigInfo.initiales)}</span></div>`;
    } else if (sigInfo && sigInfo.image) {
      imgBlock = `<div style="text-align:center;height:55px;display:flex;align-items:center;justify-content:center"><img src="${sigInfo.image}" style="max-width:130px;max-height:50px;object-fit:contain"></div>`;
    } else {
      imgBlock = `<div style="height:55px"></div>`;
    }
    const nameBlock = sigInfo && sigInfo.nom ? `<div style="font-weight:bold;text-align:center;font-size:11px;margin-top:4px">${esc(sigInfo.nom)}</div>${sigInfo.titre?`<div style="text-align:center;font-size:10px;color:#555">${esc(sigInfo.titre)}</div>`:''}` : '';
    return `<div style="width:46%;display:inline-block;vertical-align:top;margin:0 2%">${imgBlock}<div style="border-top:1.5px solid #333;padding-top:4px">${nameBlock}</div></div>`;
  };
  const logoHtml = params.logo ? `<img src="${params.logo}" style="max-height:65px;max-width:180px;object-fit:contain">` : '';
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
}

function previewOrderText(id) {
  const orders = getOrders();
  const ord = orders.find(o => o.id === id);
  if (!ord) return;

  const esc = s => (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const societe   = params.societe   || 'SanlamAllianz CI Assurances';
  const adresse   = params.adresse   || '';
  const telephone = params.telephone || '';
  const logoSrc   = params.logo      || '';

  const rawLines  = (ord.texte || '').split('\n');
  const dateLine  = rawLines[0] || '';
  const bodyLines = rawLines.slice(1);

  const enteteHtml = params.entete_ordre
    ? params.entete_ordre.split('\n').map(l => `<p style="margin:2px 0">${esc(l)}</p>`).join('')
    : '';
  const piedHtml = params.pied_ordre
    ? `<div style="border-top:1px solid #ccc;margin-top:20px;padding-top:8px;text-align:center;font-size:9.5pt;color:#555">${params.pied_ordre.split('\n').map(l=>esc(l)).join('<br>')}</div>`
    : '';

  // Construire le bloc signatures
  const sig1 = (ord.signatures||[])[0] || null;
  const sig2 = (ord.signatures||[])[1] || null;
  const sigCellHtml = (sigInfo, label) => {
    let imgBlock;
    if (sigInfo && sigInfo.type === 'initiales' && sigInfo.initiales) {
      imgBlock = `<div style="height:60px;display:flex;align-items:center;justify-content:center"><span style="font-size:34px;font-family:'Georgia',serif;font-weight:bold;color:#1e3a8a;letter-spacing:5px">${esc(sigInfo.initiales)}</span></div>`;
    } else if (sigInfo && sigInfo.image) {
      imgBlock = `<div style="text-align:center;height:60px;display:flex;align-items:center;justify-content:center"><img src="${sigInfo.image}" style="max-width:130px;max-height:55px;object-fit:contain"></div>`;
    } else {
      imgBlock = `<div style="height:60px;border:1px dashed #cbd5e1;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:11px">${label}</div>`;
    }
    const nameBlock = sigInfo && sigInfo.nom
      ? `<div style="font-weight:bold;font-size:10.5pt;margin-top:4px;text-align:center">${esc(sigInfo.nom)}</div>${sigInfo.titre?`<div style="font-size:9.5pt;color:#555;text-align:center">${esc(sigInfo.titre)}</div>`:''}`
      : `<div style="font-size:10pt;color:#94a3b8;text-align:center;font-style:italic">En attente de signature</div>`;
    return `<div style="flex:1;text-align:center">${imgBlock}<div style="border-top:1.5px solid #333;margin-top:8px;padding-top:5px">${nameBlock}</div></div>`;
  };

  let bodyHtml = '';
  for (const line of bodyLines) {
    const t = line.trim();
    if (t === '') { bodyHtml += '<div style="margin:7px 0"></div>'; continue; }
    if (/SIGNATURES AUTORISEES|SIGNATURES AUTORISÉES/i.test(t)) {
      bodyHtml += `<div style="font-weight:bold;text-align:center;margin:32px 0 18px;font-size:12pt;letter-spacing:1px">SIGNATURES AUTORISÉES</div>
        <div style="display:flex;gap:40px;margin-top:8px">
          ${sigCellHtml(sig1, 'Signataire 1')}
          ${sigCellHtml(sig2, 'Signataire 2')}
        </div>`;
      continue;
    }
    if (/^NB\s*:/i.test(t)) {
      bodyHtml += `<p style="margin:4px 0;color:#cc0000;font-weight:bold;font-size:11.5pt">${esc(t)}</p>`;
    } else if (/^Ordre de virement/i.test(t)) {
      bodyHtml += `<p style="margin:4px 0;font-weight:bold;font-size:11.5pt">${esc(t)}</p>`;
    } else {
      const ci = t.indexOf(':');
      if (ci > 0 && t.startsWith('-') && ci < t.length - 1) {
        bodyHtml += `<p style="margin:2px 0;font-size:11.5pt"><span>${esc(t.slice(0,ci+1))}</span><strong>${esc(t.slice(ci+1))}</strong></p>`;
      } else {
        bodyHtml += `<p style="margin:3px 0;font-size:11.5pt">${esc(t)}</p>`;
      }
    }
  }

  const logoHtml = logoSrc ? `<img src="${logoSrc}" style="height:55px;margin-bottom:6px" alt="logo">` : '';
  const statusLabel = STATUS_LABELS[ord.status] || ord.status;
  const statusColor = STATUS_COLORS[ord.status] || '#94a3b8';

  const w = window.open('', '_blank', 'width=870,height:1050');
  if (!w) { showToast('Popup bloquée — autorisez les popups', 'error'); return; }
  w.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Aperçu Ordre — ${esc(ord.ref)}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:'Times New Roman',serif;background:#e5e5e5;margin:0;padding:30px 20px}
  .page{width:21cm;min-height:29.7cm;background:#fff;margin:0 auto;padding:2.2cm 2.5cm 2.2cm 3.2cm;box-shadow:0 4px 24px rgba(0,0,0,.18)}
  .hdr{text-align:center;margin-bottom:22px}
  .hdr h1{font-size:15pt;font-weight:bold;margin:0 0 3px;color:#1e3a8a}
  .hdr p{font-size:10pt;margin:2px 0;color:#444}
  .date-row{text-align:right;font-weight:bold;margin-bottom:16px;font-size:11pt}
  .body-content{line-height:1.9}
  .meta-bar{display:flex;align-items:center;gap:10px;margin-bottom:18px;padding:10px 14px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;font-size:12px}
  .status-pill{display:inline-block;padding:3px 12px;border-radius:12px;font-size:11px;font-weight:700;color:#fff}
  .no-print{text-align:center;margin:28px 0 10px;padding:14px;background:#f0f5ff;border-radius:8px}
  @media print{body{background:#fff;padding:0}.page{box-shadow:none;margin:0;padding:2cm 2cm 2cm 3cm}.no-print{display:none}@page{size:A4;margin:0}}
</style></head><body>
<div class="page">
  <div class="meta-bar">
    <span style="font-weight:600;color:#374151">Réf :</span> <span style="font-family:monospace;color:#1e3a8a">${esc(ord.ref)}</span>
    <span style="color:#cbd5e1">|</span>
    <span style="font-weight:600;color:#374151">Type :</span> <span>${esc(TYPE_LABELS[ord.type]||ord.type)}</span>
    <span style="color:#cbd5e1">|</span>
    <span style="font-weight:600;color:#374151">Statut :</span> <span class="status-pill" style="background:${statusColor}">${esc(statusLabel)}</span>
    <span style="color:#cbd5e1">|</span>
    <span style="font-weight:600;color:#374151">Soumis par :</span> <span>${esc(ord.createdByNom||'—')}</span>
    <span style="margin-left:auto;font-size:11px;color:#94a3b8">${esc(ord.createdAt||'')}</span>
  </div>
  <div class="hdr">
    ${logoHtml}
    ${enteteHtml}
  </div>
  <div class="date-row">${esc(dateLine)}</div>
  <div class="body-content">${bodyHtml}</div>
  ${piedHtml}
  <div class="no-print">
    <button onclick="window.print()" style="padding:9px 28px;font-size:13px;cursor:pointer;background:#1e3a8a;color:#fff;border:none;border-radius:6px;margin-right:8px">🖨️ Imprimer</button>
    <button onclick="window.close()" style="padding:9px 20px;font-size:13px;cursor:pointer;background:#fff;color:#374151;border:1.5px solid #cbd5e1;border-radius:6px">Fermer</button>
  </div>
</div>
</body></html>`);
  w.document.close();
}

const TYPE_LABELS   = { facture:'Facture', bancassurance:'Bancassurance', nivellement:'Nivellement', reassurance:'Réassurance', sinistre:'Sinistre' };
const STATUS_LABELS = { soumis:'Soumis', valide:'Validé', rejete:'Rejeté', pret_impression:'Prêt à imprimer', imprime:'Exécuté', doublon_alerte:'Doublon (alerte)' };
const STATUS_COLORS = { soumis:'#f59e0b', valide:'#3b82f6', rejete:'#ef4444', pret_impression:'#22c55e', imprime:'#059669', doublon_alerte:'#d97706' };

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

  // Section N4 / admin : ALERTES DOUBLONS
  if (u.niveau === 4 || u.niveau <= 2) {
    const doublons = orders.filter(o => o.status === 'doublon_alerte');
    if (doublons.length > 0) {
      html += `<div class="card" style="border:2px solid #f59e0b"><div class="card-header" style="background:#fffbeb"><div class="card-header-icon" style="background:#fef3c7"><svg viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div><h2 style="color:#b45309">⚠ Alertes doublons (${doublons.length})</h2><span style="font-size:11px;color:#92400e;margin-left:auto">Un utilisateur a forcé un virement potentiellement identique</span></div><div class="card-body">`;
      html += `<div style="overflow-x:auto"><table class="param-table"><thead><tr><th>Initié par</th><th>Type</th><th>Référence</th><th>Bénéficiaire</th><th>Montant</th><th>Doublon détecté</th><th>Actions</th></tr></thead><tbody>`;
      doublons.forEach(o => {
        const di = o.duplicateInfo || {};
        html += `<tr style="background:#fffbeb"><td style="font-weight:600">${esc(o.createdByNom)}</td><td>${TYPE_LABELS[o.type]||o.type}</td><td style="font-family:monospace">${esc(o.ref)}</td><td>${esc(o.beneficiaire)}</td><td style="font-weight:700;color:#b45309">${esc(o.montant)}</td><td style="font-size:11px">Réf: <strong>${esc(di.ref||'—')}</strong><br>Date: ${esc(di.date||'—')}<br>Statut: ${esc(di.status||'—')}</td><td style="white-space:nowrap"><button class="btn btn-gold" style="padding:4px 12px;font-size:11px;background:#16a34a;border-color:#16a34a" onclick="dismissDuplicateAlert('${o.id}','valider')">✓ Valider quand même</button> <button class="btn btn-danger" style="padding:4px 10px;font-size:11px" onclick="dismissDuplicateAlert('${o.id}','annuler')">✗ Annuler</button></td></tr>`;
      });
      html += `</tbody></table></div></div></div>`;
    }
  }

  // Section N4 / admin : À VALIDER
  if (u.niveau === 4 || u.niveau <= 2) {
    const toValidate = orders.filter(o => o.status === 'soumis');
    if (badgeEl && u.niveau === 4) badgeEl.textContent = toValidate.length + ' en attente';
    html += `<div class="card"><div class="card-header"><div class="card-header-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></div><h2>À valider (${toValidate.length})</h2></div><div class="card-body">`;
    if (toValidate.length === 0) {
      html += `<p style="color:var(--text-light);text-align:center;padding:20px 0">Aucun ordre en attente de validation</p>`;
    } else {
      html += `<div style="overflow-x:auto"><table class="param-table"><thead><tr><th>Référence</th><th>Type</th><th>Soumis par</th><th>Date</th><th>Montant</th><th>Bénéficiaire</th><th>Factures jointes</th><th>Actions</th></tr></thead><tbody>`;
      toValidate.forEach(o => {
        const pjC = (o.piecesJointes||[]).length;
        const pjBtn = pjC > 0
          ? `<button class="btn btn-outline" style="padding:5px 12px;font-size:11px;background:#eff6ff;border-color:#3b82f6;color:#1d4ed8;font-weight:600" onclick="viewOrderAttachments('${o.id}')">📄 Examiner (${pjC} fichier${pjC>1?'s':''})</button>`
          : `<span style="font-size:11px;color:#f59e0b;font-weight:600">⚠ Aucune facture jointe</span>`;
        html += `<tr>
          <td style="font-weight:600;font-family:monospace">${esc(o.ref)}</td>
          <td>${TYPE_LABELS[o.type]||o.type}</td>
          <td>${esc(o.createdByNom)}</td>
          <td style="font-size:11px">${esc(o.createdAt)}</td>
          <td>${esc(o.montant)}</td>
          <td>${esc(o.beneficiaire)}</td>
          <td>${pjBtn}</td>
          <td style="white-space:nowrap">
            <button class="btn btn-gold" style="padding:4px 12px;font-size:11px" onclick="validateOrder('${o.id}')">Valider</button>
            <button class="btn btn-danger" style="padding:4px 10px;font-size:11px" onclick="rejectOrder('${o.id}')">Rejeter</button>
            <button class="btn btn-outline" style="padding:4px 10px;font-size:11px" onclick="previewOrderText('${o.id}')">Aperçu</button>
          </td>
        </tr>`;
      });
      html += `</tbody></table></div>`;
    }
    html += `</div></div>`;

    // Ordres traités — N4 peut déverrouiller
    const treatedOrders = orders.filter(o => o.status === 'imprime');
    if (treatedOrders.length > 0) {
      html += `<div class="card"><div class="card-header"><div class="card-header-icon" style="background:#f0fdf4"><svg viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></div><h2 style="color:#16a34a">Ordres traités (${treatedOrders.length})</h2><span style="font-size:11px;color:#6b7280;margin-left:auto">Cliquez sur Déverrouiller pour remettre en impression</span></div><div class="card-body">`;
      html += `<div style="overflow-x:auto"><table class="param-table"><thead><tr><th>Référence</th><th>Type</th><th>Soumis par</th><th>Montant</th><th>Bénéficiaire</th><th>Traité le</th><th>Actions</th></tr></thead><tbody>`;
      treatedOrders.forEach(o => {
        const execEntry = [...(o.history||[])].reverse().find(h => h.action === 'exécuté');
        const traitedAt = execEntry ? execEntry.at : '—';
        html += `<tr>
          <td style="font-weight:600;font-family:monospace">${esc(o.ref)}</td>
          <td>${TYPE_LABELS[o.type]||o.type}</td>
          <td>${esc(o.createdByNom||'—')}</td>
          <td>${esc(o.montant)}</td>
          <td>${esc(o.beneficiaire)}</td>
          <td style="font-size:11px;color:#6b7280">${esc(traitedAt)}</td>
          <td style="white-space:nowrap">
            <button class="btn btn-outline" style="padding:4px 10px;font-size:11px" onclick="previewOrderText('${o.id}')">Voir</button>
            <button class="btn btn-outline" style="padding:4px 12px;font-size:11px;color:#dc2626;border-color:#dc2626;margin-left:4px" onclick="unlockOrder('${o.id}')">🔓 Déverrouiller</button>
          </td>
        </tr>`;
      });
      html += `</tbody></table></div></div></div>`;
    }
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
      myUnsigned.forEach(o => { const sc=(o.signatures||[]).length; const rq=o.requiredSignatures||2; const canSign=(u.niveau===5||u.niveau<=2); const pjC=(o.piecesJointes||[]).length; html += `<tr><td style="font-weight:600;font-family:monospace">${esc(o.ref)}</td><td>${TYPE_LABELS[o.type]||o.type}</td><td>${esc(o.validatedBy||'—')}</td><td>${esc(o.montant)}</td><td>${esc(o.beneficiaire)}</td><td>${sc}/${rq}</td><td>${canSign?`<button class="btn btn-gold" style="padding:4px 12px;font-size:11px" onclick="signOrder('${o.id}')">Signer</button> `:''}<button class="btn btn-outline" style="padding:4px 10px;font-size:11px" onclick="previewOrderText('${o.id}')">Voir</button>${pjC>0?` <button class="btn btn-outline" style="padding:4px 10px;font-size:11px;background:#eff6ff;border-color:#bfdbfe;color:#1d4ed8" onclick="viewOrderAttachments('${o.id}')">📎 ${pjC} PJ</button>`:''}</td></tr>`; });
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
      toPrint.forEach(o => { const sn=(o.signatures||[]).map(s=>s.nom).join(', '); const pjC=(o.piecesJointes||[]).length; html += `<tr><td style="font-weight:600;font-family:monospace">${esc(o.ref)}</td><td>${TYPE_LABELS[o.type]||o.type}</td><td>${esc(o.montant)}</td><td>${esc(o.beneficiaire)}</td><td style="font-size:11px">${esc(sn)}</td><td style="white-space:nowrap"><button class="btn btn-gold" style="padding:4px 12px;font-size:11px" onclick="genWordFromOrder('${o.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:11px;height:11px;vertical-align:middle"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Word</button> <button class="btn btn-outline" style="padding:4px 10px;font-size:11px" onclick="printSignedOrder('${o.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:11px;height:11px;vertical-align:middle"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> PDF</button> <button class="btn btn-outline" style="padding:4px 8px;font-size:11px" onclick="previewOrderText('${o.id}')">Voir</button> <button class="btn btn-outline" style="padding:4px 12px;font-size:11px;background:#f0fdf4;border-color:#86efac;color:#16a34a;font-weight:600" onclick="confirmTraite('${o.id}')">✓ Traité</button>${pjC>0?` <button class="btn btn-outline" style="padding:4px 10px;font-size:11px;background:#eff6ff;border-color:#bfdbfe;color:#1d4ed8" onclick="viewOrderAttachments('${o.id}')">📎 ${pjC} PJ</button>`:''}</td></tr>`; });
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

    // Ordres traités — visibles en lecture seule pour N3
    if (printed.length > 0) {
      html += `<div class="card"><div class="card-header"><div class="card-header-icon" style="background:#f0fdf4"><svg viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></div><h2 style="color:#16a34a">Ordres traités (${printed.length})</h2><span style="font-size:11px;color:#6b7280;margin-left:auto">Contactez votre superviseur pour rouvrir un ordre</span></div><div class="card-body">`;
      html += `<div style="overflow-x:auto"><table class="param-table"><thead><tr><th>Référence</th><th>Type</th><th>Montant</th><th>Bénéficiaire</th><th>Traité le</th><th>Actions</th></tr></thead><tbody>`;
      printed.forEach(o => {
        const execEntry = [...(o.history||[])].reverse().find(h => h.action === 'exécuté');
        const traitedAt = execEntry ? execEntry.at : '—';
        const pjC = (o.piecesJointes||[]).length;
        html += `<tr>
          <td style="font-weight:600;font-family:monospace">${esc(o.ref)}</td>
          <td>${TYPE_LABELS[o.type]||o.type}</td>
          <td>${esc(o.montant)}</td>
          <td>${esc(o.beneficiaire)}</td>
          <td style="font-size:11px;color:#6b7280">${esc(traitedAt)}</td>
          <td style="white-space:nowrap">
            <button class="btn btn-outline" style="padding:4px 10px;font-size:11px" onclick="previewOrderText('${o.id}')">Voir</button>
            ${pjC>0?`<button class="btn btn-outline" style="padding:4px 10px;font-size:11px;background:#eff6ff;border-color:#bfdbfe;color:#1d4ed8;margin-left:4px" onclick="viewOrderAttachments('${o.id}')">📎 ${pjC} PJ</button>`:''}
            <span style="font-size:10px;color:#9ca3af;margin-left:6px;font-style:italic">🔒 Verrouillé</span>
          </td>
        </tr>`;
      });
      html += `</tbody></table></div></div></div>`;
    }
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
    function mkLabelVal(trim, opts) {
      const o = opts||{};
      const ci = trim.indexOf(':');
      if (ci > 0 && ci < trim.length - 1) {
        return new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { before:0, after: o.after !== undefined ? o.after : 80 },
          children: [
            new TextRun({ text: trim.slice(0, ci + 1), bold: true,  size: SZ, font: FONT }),
            new TextRun({ text: trim.slice(ci + 1),    bold: false, size: SZ, font: FONT }),
          ]
        });
      }
      return mkPara(trim, o);
    }
    function mkLineRich(trim, opts) {
      const o = opts||{};
      const ci = trim.indexOf(':');
      if (ci > 0 && ci < trim.length - 1) {
        const label = trim.slice(0, ci).trimEnd() + ':';
        const value = trim.slice(ci + 1).trimStart();
        return new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: {before:0, after: o.after !== undefined ? o.after : 80},
          tabStops: [{type: 'left', position: 2800}],
          children: [
            new TextRun({text: label, bold: false, size: SZ, font: FONT}),
            new TextRun({text: '\t',  size: SZ, font: FONT}),
            new TextRun({text: value, bold: true,  size: SZ, font: FONT}),
          ]
        });
      }
      return new Paragraph({alignment:AlignmentType.LEFT,spacing:{before:0,after:o.after!==undefined?o.after:80},children:[new TextRun({text:trim,bold:!!o.allBold,size:SZ,font:FONT})]});
    }
    const children = [];
    if (params.entete_ordre) {
      params.entete_ordre.split('\n').forEach(l => children.push(mkPara(l,{align:AlignmentType.CENTER,size:20,after:40})));
    } else {
    }
    children.push(mkPara('',{after:200}));
    children.push(new Table({width:{size:9026,type:WidthType.DXA},columnWidths:[5513,3513],borders:NB,rows:[new TableRow({children:[
      new TableCell({borders:NB,width:{size:5513,type:WidthType.DXA},children:[mkPara('')]}),
      new TableCell({borders:NB,width:{size:3513,type:WidthType.DXA},children:[new Paragraph({alignment:AlignmentType.RIGHT,spacing:{before:0,after:80},children:[new TextRun({text:lines[0]||'',bold:true,size:SZ,font:FONT})]})]})
    ]})]}));
    const sig1 = (ord.signatures||[])[0]||null;
    const sig2 = (ord.signatures||[])[1]||null;
    const mkSigCell = (sigInfo) => {
      const cc = [];
      if (sigInfo && sigInfo.type === 'initiales' && sigInfo.initiales) {
        cc.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:0,after:40},children:[new TextRun({text:sigInfo.initiales,bold:true,size:64,font:'Georgia',color:'1E3A8A'})]}));
      } else if (sigInfo && sigInfo.image && D.ImageRun) {
        try {
          const buf = base64ToArrayBuffer(sigInfo.image);
          cc.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:0,after:40},children:[new D.ImageRun({data:buf,transformation:{width:120,height:50},type:'png'})]}));
        } catch(e) { cc.push(mkPara('',{after:380})); }
      } else { cc.push(mkPara('',{after:380})); }
      cc.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:0,after:80},border:{bottom:{style:BorderStyle.SINGLE,size:6,color:'000000'}},children:[new TextRun({text:'',size:SZ,font:FONT})]}));
      if (sigInfo && sigInfo.nom) {
        cc.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:60,after:40},children:[new TextRun({text:sigInfo.nom,bold:true,size:20,font:FONT})]}));
        cc.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:0,after:0},children:[new TextRun({text:sigInfo.titre||'',italics:true,size:18,font:FONT,color:'444444'})]}));
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
      } else if (/^N\/R[eé]f/i.test(trim)) {
        children.push(mkLabelVal(trim,{after:80}));
      } else if (/^Objet\s*:/i.test(trim)) {
        children.push(mkLabelVal(trim,{after:80}));
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
    showToast('Fichier Word généré : ' + fname + ' — (Génération illimitée active)', 'success');
  } catch(err) {
    console.error('genWordFromOrder error:', err);
    showToast('Erreur génération Word : ' + err.message, 'error');
  }
}

function confirmTraite(id) {
  const orders = getOrders();
  const ord = orders.find(o => o.id === id);
  if (!ord) return;
  if (!confirm(`Confirmer que l'ordre ${ord.ref} a été traité et imprimé ?\n\nIl sera déplacé dans les ordres exécutés.`)) return;
  markOrderExecuted(id, 'Traité');
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

function dismissDuplicateAlert(id, action) {
  const orders = getOrders();
  const idx = orders.findIndex(o => o.id === id);
  if (idx < 0) return;
  if (action === 'valider') {
    orders[idx].status = 'soumis';
    orders[idx].history.push({ action: 'doublon confirmé — transmis en validation', by: getCurrentUser()?.prenom + ' ' + getCurrentUser()?.nom, at: new Date().toLocaleString('fr-FR') });
    showToast('Virement transmis en validation malgré le doublon', 'success');
  } else {
    orders.splice(idx, 1);
    showToast('Alerte doublon supprimée — virement annulé', 'success');
  }
  saveOrders(orders);
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
  if (!confirm(`Rouvrir l'ordre ${ord.ref} ?\n\nL'utilisateur pourra à nouveau le traiter et l'imprimer.`)) return;
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
//  CAPITALISATION DES CHAMPS DE SAISIE
// ══════════════════════════════════════════
function toTitleCase(str) {
  if (!str) return str;
  return str.replace(/\b(\w)(\S*)/g, (_, first, rest) => first.toUpperCase() + rest.toLowerCase());
}

const TITLE_CASE_FIELDS = [
  'fac_attention','fac_motif',
  'ban_attention','ban_type_commission',
  'niv_attention',
  'rea_attention','rea_motif',
  'sin_attention',
  // Champs bénéficiaires manuels
  'fac_beneficiaire','ban_beneficiaire','rea_beneficiaire','sin_beneficiaire',
];

function setupTitleCaseFields() {
  TITLE_CASE_FIELDS.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('blur', () => {
      if (el.value.trim()) el.value = toTitleCase(el.value.trim());
    });
  });
}

// ══════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════
// ══════════════════════════════════════════
//  AJOUT RAPIDE — Banque / Bénéficiaire (depuis les formulaires)
// ══════════════════════════════════════════
let _quickAddType = null;

function addQuickAddButtons() {
  const bankSelects = ['fac_banque','ban_banque','niv_banque','rea_banque','sin_banque'];
  const benSelects  = ['fac_beneficiaire_sel','ban_beneficiaire_sel','rea_beneficiaire_sel','sin_beneficiaire_sel'];

  bankSelects.forEach(id => {
    const sel = document.getElementById(id);
    if (!sel || sel.parentElement.classList.contains('quick-add-wrapper')) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'quick-add-wrapper';
    wrapper.style.cssText = 'display:flex;gap:8px;align-items:flex-end';
    sel.style.flex = '1';
    sel.parentNode.insertBefore(wrapper, sel);
    wrapper.appendChild(sel);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-quick-add';
    btn.title = 'Ajouter une nouvelle banque débitrice';
    btn.textContent = '+';
    btn.style.display = 'none';
    btn.onclick = () => openQuickAddModal('banque');
    wrapper.appendChild(btn);
  });

  benSelects.forEach(id => {
    const sel = document.getElementById(id);
    if (!sel || sel.parentElement.classList.contains('quick-add-wrapper')) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'quick-add-wrapper';
    wrapper.style.cssText = 'display:flex;gap:8px;align-items:flex-end';
    sel.style.flex = '1';
    sel.parentNode.insertBefore(wrapper, sel);
    wrapper.appendChild(sel);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-quick-add';
    btn.title = 'Ajouter un nouveau bénéficiaire';
    btn.textContent = '+';
    btn.style.display = 'none';
    btn.onclick = () => openQuickAddModal('beneficiaire');
    wrapper.appendChild(btn);
  });
}

function openQuickAddModal(type) {
  _quickAddType = type;
  const modal  = document.getElementById('quick-add-modal');
  const title  = document.getElementById('quick-add-title');
  const fields = document.getElementById('quick-add-fields');
  if (!modal) return;
  if (type === 'banque') {
    title.textContent = 'Ajouter une banque débitrice';
    fields.innerHTML = `
      <div class="field span2"><label>Nom de la banque <span class="req">*</span></label><input id="qa_nom" placeholder="ex: SGBCI" style="width:100%"></div>
      <div class="field"><label>N° Compte</label><input id="qa_compte" placeholder="CI93CI0080..." style="width:100%"></div>
      <div class="field"><label>IBAN</label><input id="qa_iban" placeholder="CI93CI0080..." style="width:100%"></div>
      <div class="field"><label>Swift Code</label><input id="qa_swift" placeholder="SGBCCIAB" style="width:100%"></div>
      <div class="field"><label>RIB</label><input id="qa_rib" placeholder="00803 00650..." style="width:100%"></div>
      <div class="field"><label>Contact (M.)</label><input id="qa_contact" placeholder="Directeur Agence" style="width:100%"></div>`;
  } else {
    title.textContent = 'Ajouter un bénéficiaire';
    fields.innerHTML = `
      <div class="field span2"><label>Nom du bénéficiaire <span class="req">*</span></label><input id="qa_nom" placeholder="ex: Fournisseur SA" style="width:100%"></div>
      <div class="field"><label>Banque</label><input id="qa_banque" placeholder="ex: SGBCI" style="width:100%"></div>
      <div class="field"><label>IBAN / N° compte</label><input id="qa_iban" placeholder="CI93CI0080..." style="width:100%"></div>
      <div class="field span2"><label>Code Swift</label><input id="qa_swift" placeholder="SGBCCIAB" style="width:100%"></div>`;
  }
  modal.style.display = 'flex';
  setTimeout(() => document.getElementById('qa_nom')?.focus(), 80);
}

function closeQuickAddModal() {
  const modal = document.getElementById('quick-add-modal');
  if (modal) modal.style.display = 'none';
  _quickAddType = null;
}

function saveQuickAdd() {
  const nom = (document.getElementById('qa_nom')?.value || '').trim();
  if (!nom) { showToast('Le nom est obligatoire', 'error'); return; }
  const type = _quickAddType;
  if (type === 'banque') {
    if (!params.banques) params.banques = [];
    params.banques.push({
      nom,
      compte:  (document.getElementById('qa_compte')?.value  || '').trim(),
      iban:    (document.getElementById('qa_iban')?.value    || '').trim(),
      swift:   (document.getElementById('qa_swift')?.value   || '').trim(),
      rib:     (document.getElementById('qa_rib')?.value     || '').trim(),
      contact: (document.getElementById('qa_contact')?.value || '').trim(),
    });
  } else {
    if (!params.beneficiaires) params.beneficiaires = [];
    params.beneficiaires.push({
      nom,
      banque: (document.getElementById('qa_banque')?.value || '').trim(),
      iban:   (document.getElementById('qa_iban')?.value   || '').trim(),
      swift:  (document.getElementById('qa_swift')?.value  || '').trim(),
    });
  }
  localStorage.setItem('virement_params', JSON.stringify(params));
  sbSaveParams();
  refreshBanqueSelects();
  refreshBeneficiaireSelects();
  closeQuickAddModal();
  showToast((type === 'banque' ? 'Banque débitrice' : 'Bénéficiaire') + ' ajouté et sauvegardé !', 'success');
}

(async function initApp() {
  const loadingEl = document.getElementById('fb-loading');
  initSupabase();
  if (sbClient && loadingEl) loadingEl.style.display = 'flex';
  await syncFromSupabase();
  if (loadingEl) loadingEl.style.display = 'none';

  loadParams();
  applyCustomization();
  loadHistorique();
  loadHistoriqueRejete();
  initUsers();
  refreshBanqueSelects();
  refreshBeneficiaireSelects();
  refreshDeviseSelects();
  renderBeneficiairesTable();
  renderDevisesList();
  Object.keys(DRAFT_FIELDS).forEach(type => setupDraftAutoSave(type));
  setupTitleCaseFields();
  fillDateAuto('fac');
  fillRefAuto('fac','facture');
  restoreFormDraft('facture');
  clearValidation('facture');
  addQuickAddButtons();
  checkAuth();
  applyPermissions();
  updateSessionBar();
  updateInboxBadge();
  subscribeToOrders();
  subscribeToUsers();
})();
