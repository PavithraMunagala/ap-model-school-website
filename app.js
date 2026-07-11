// ============================================================
// AP Model School — App Logic
// Data layer: Firebase Firestore (permanent, shared by all visitors)
// Auth layer: Firebase Authentication (real admin login)
// ============================================================
import { firebaseConfig } from './firebase-config.js';
import { IMGBB_API_KEY } from './imgbb-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc,
  collection, addDoc, getDocs, deleteDoc, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

/* ---------- Defaults (used only if Firestore has no data yet) ---------- */
const DEFAULT_SETTINGS = {
  schoolName:"AP Model School", tagline:"Est. 1978 · Learn · Grow · Lead",
  logoInitials:"AP", logoUrl:"",
  heroTitle:"Where every child finds their <em style=\"font-style:italic;color:var(--gold-light);\">reason to shine.</em>",
  heroLead:"AP Model School blends strong academics, creative expression, and character-building in a nurturing K–12 campus.",
  heroImg:"https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=800&auto=format&fit=crop",
  stat1n:"1,200+", stat1l:"Students", stat2n:"98%", stat2l:"Board Pass Rate", stat3n:"45+", stat3l:"Years of Legacy", stat4n:"30+", stat4l:"Clubs & Sports",
  aboutTitle:"A community built on curiosity and care.",
  aboutText:"For over four decades, we have been a home for young minds to question, explore, and grow. Our principal and faculty work closely with every family.",
  aboutImg:"https://images.unsplash.com/photo-1580582932707-520aed937b7b?q=80&w=800&auto=format&fit=crop",
  val1t:"Academic Excellence", val1d:"CBSE-aligned curriculum with STEM and humanities depth.",
  val2t:"Whole-Child Growth", val2d:"Sports, arts, and life-skills built into every week.",
  val3t:"Safe & Inclusive", val3d:"Small class sizes, on-campus counseling, secure transport.",
  phone:"+91 98765 43210", email:"admissions@apmodelschool.edu", address:"142 Riverstone Avenue, Uppal Kalan, Telangana",
  footDesc:"A K–12 institution committed to academic excellence and holistic growth since 1978."
};
const DEFAULT_PROGRAMS = [
  {id:"p1", grade:"Pre-K – Grade 2", title:"Early Years", desc:"Play-based foundational learning in literacy, numeracy, and motor skills."},
  {id:"p2", grade:"Grade 3 – 5", title:"Primary Wing", desc:"Core subjects with hands-on science labs and reading circles."},
  {id:"p3", grade:"Grade 6 – 8", title:"Middle School", desc:"Subject specialization begins, with electives in coding and design."},
  {id:"p4", grade:"Grade 9 – 12", title:"Senior Secondary", desc:"Science, Commerce & Humanities streams with career counseling."}
];

/* ---------- Firestore helpers ----------
   content/settings        -> settings fields directly
   content/programs        -> { items: [...] }
   content/achievements    -> { items: [...] }
   content/gallery         -> { items: [...] }
   content/notices         -> { items: [...] }
   messages/{autoId}       -> one doc per visitor question
------------------------------------------------------------- */
async function loadDoc(name, fallback){
  try{
    const snap = await getDoc(doc(db, 'content', name));
    return snap.exists() ? snap.data() : fallback;
  }catch(e){ console.error(e); return fallback; }
}
async function saveDoc(name, data){
  try{ await setDoc(doc(db, 'content', name), data); return true; }
  catch(e){ console.error(e); return false; }
}
async function loadList(name, fallback){
  const data = await loadDoc(name, {items: fallback});
  return data.items || fallback;
}
async function saveList(name, items){ return await saveDoc(name, {items}); }

function showToast(msg, type){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('toast-success','toast-error');
  if(type === 'success') t.classList.add('toast-success');
  if(type === 'error') t.classList.add('toast-error');
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 3200);
}
function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
function escapeHtml(str){ return (str||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

/* ---------- Photo upload from device (via ImgBB — free, no card needed) ---------- */
async function handleImageUpload(fileInput, hiddenFieldId, previewId, btnId){
  const file = fileInput.files[0];
  if(!file) return;
  const hiddenField = document.getElementById(hiddenFieldId);
  const preview = document.getElementById(previewId);
  const btn = btnId ? document.getElementById(btnId) : null;
  if(IMGBB_API_KEY === "YOUR_IMGBB_API_KEY"){
    showToast('Add your free ImgBB API key to imgbb-config.js first — see the comments in that file.');
    fileInput.value = '';
    return;
  }
  if(btn){
    btn.disabled = true;
    btn.dataset.origText = btn.dataset.origText || btn.textContent;
    btn.textContent = 'Uploading photo…';
  }
  showToast('Uploading photo…');
  try{
    const base64 = await fileToBase64(file);
    const formData = new FormData();
    formData.append('image', base64);
    const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method:'POST', body: formData });
    const data = await res.json();
    if(data.success){
      hiddenField.value = data.data.url;
      if(preview){ preview.src = data.data.url; preview.classList.add('show'); }
      showToast('Photo uploaded! You can save/add now.');
    } else {
      showToast('Upload failed — please try again.');
    }
  }catch(err){
    console.error(err);
    showToast('Upload failed — check your connection.');
  }finally{
    if(btn){ btn.disabled = false; btn.textContent = btn.dataset.origText; }
  }
}
function fileToBase64(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ---------- Admin session (real Firebase Auth) ---------- */
let isAdmin = false;

onAuthStateChanged(auth, (user) => {
  isAdmin = !!user;
  if(isAdmin){ enterAdminUI(); } else { exitAdminUI(); }
});

function openLogin(e){ if(e) e.preventDefault(); document.getElementById('loginError').style.display='none'; document.getElementById('loginUser').value=''; document.getElementById('loginPass').value=''; document.getElementById('loginOverlay').classList.add('open'); }
function closeModal(id){ document.getElementById(id).classList.remove('open'); }

async function attemptLogin(){
  const email = document.getElementById('loginUser').value.trim();
  const pass = document.getElementById('loginPass').value;
  try{
    await signInWithEmailAndPassword(auth, email, pass);
    closeModal('loginOverlay');
    showToast('Welcome back! Admin mode is on.');
  }catch(err){
    document.getElementById('loginError').style.display='block';
  }
}
async function exitAdmin(){
  await signOut(auth);
  showToast('You are back in user (view-only) mode.');
}
function enterAdminUI(){
  document.getElementById('adminBar').classList.add('on');
  document.getElementById('adminFab').style.display='none';
  document.getElementById('navAdminBtn').style.display='none';
  document.querySelectorAll('.admin-panel').forEach(p=>p.classList.add('open'));
  renderAll();
  refreshMessageBadge();
}
function exitAdminUI(){
  document.getElementById('adminBar').classList.remove('on');
  document.getElementById('adminFab').style.display='flex';
  document.getElementById('navAdminBtn').style.display='inline-block';
  document.querySelectorAll('.admin-panel').forEach(p=>p.classList.remove('open'));
  renderAll();
}

/* ---------- Settings ---------- */
let currentSettings = {...DEFAULT_SETTINGS};
async function loadSettings(){
  currentSettings = await loadDoc('settings', DEFAULT_SETTINGS);
  applySettings();
}
function applySettings(){
  const s = currentSettings;
  document.getElementById('navSchoolName').textContent = s.schoolName;
  document.getElementById('navTagline').textContent = s.tagline;
  document.getElementById('footSchoolName').textContent = s.schoolName;
  document.getElementById('footDesc').innerHTML = s.footDesc;
  document.getElementById('footBottom').innerHTML = `&copy; 2026 ${escapeHtml(s.schoolName)}. All rights reserved.`;
  document.getElementById('crestInitials').textContent = s.logoInitials;
  const crestBox = document.getElementById('crestBox');
  crestBox.innerHTML = s.logoUrl ? `<img src="${escapeHtml(s.logoUrl)}" alt="logo">` : `<span>${escapeHtml(s.logoInitials)}</span>`;
  document.getElementById('heroTitle').innerHTML = s.heroTitle;
  document.getElementById('heroLead').innerHTML = s.heroLead;
  document.getElementById('heroImg').src = s.heroImg;
  document.getElementById('statRow').innerHTML = `
    <div class="stat"><div class="num">${escapeHtml(s.stat1n)}</div><div class="lbl">${escapeHtml(s.stat1l)}</div></div>
    <div class="stat"><div class="num">${escapeHtml(s.stat2n)}</div><div class="lbl">${escapeHtml(s.stat2l)}</div></div>
    <div class="stat"><div class="num">${escapeHtml(s.stat3n)}</div><div class="lbl">${escapeHtml(s.stat3l)}</div></div>
    <div class="stat"><div class="num">${escapeHtml(s.stat4n)}</div><div class="lbl">${escapeHtml(s.stat4l)}</div></div>`;
  document.getElementById('aboutTitle').textContent = s.aboutTitle;
  document.getElementById('aboutText').textContent = s.aboutText;
  document.getElementById('aboutImg').src = s.aboutImg;
  document.getElementById('valueList').innerHTML = `
    <li><span class="dot"></span><div><strong>${escapeHtml(s.val1t)}</strong><br>${escapeHtml(s.val1d)}</div></li>
    <li><span class="dot"></span><div><strong>${escapeHtml(s.val2t)}</strong><br>${escapeHtml(s.val2d)}</div></li>
    <li><span class="dot"></span><div><strong>${escapeHtml(s.val3t)}</strong><br>${escapeHtml(s.val3d)}</div></li>`;
  document.getElementById('cPhone').textContent = s.phone;
  document.getElementById('cEmail').textContent = s.email;
  document.getElementById('cAddress').textContent = s.address;
  document.getElementById('stepsRow').innerHTML = `
    <div class="step"><div class="n">01</div><h4>Inquiry</h4><p>Submit the online form or visit the admissions desk.</p></div>
    <div class="step"><div class="n">02</div><h4>Campus Visit</h4><p>Tour the campus and meet our faculty in person.</p></div>
    <div class="step"><div class="n">03</div><h4>Assessment</h4><p>A friendly interaction to understand the student's needs.</p></div>
    <div class="step"><div class="n">04</div><h4>Enrollment</h4><p>Complete documentation and secure your seat.</p></div>`;
}
function setPreview(id, url){
  const el = document.getElementById(id);
  if(!el) return;
  if(url){ el.src = url; el.classList.add('show'); }
  else { el.src=''; el.classList.remove('show'); }
}
function openSettingsModal(){
  const s = currentSettings;
  document.getElementById('sSchoolName').value = s.schoolName;
  document.getElementById('sTagline').value = s.tagline;
  document.getElementById('sLogoInitials').value = s.logoInitials;
  document.getElementById('sLogoUrl').value = s.logoUrl;
  document.getElementById('sHeroTitle').value = s.heroTitle;
  document.getElementById('sHeroLead').value = s.heroLead;
  document.getElementById('sHeroImg').value = s.heroImg;
  setPreview('sLogoUrlPreview', s.logoUrl);
  setPreview('sHeroImgPreview', s.heroImg);
  setPreview('sAboutImgPreview', s.aboutImg);
  document.getElementById('sStat1n').value=s.stat1n; document.getElementById('sStat1l').value=s.stat1l;
  document.getElementById('sStat2n').value=s.stat2n; document.getElementById('sStat2l').value=s.stat2l;
  document.getElementById('sStat3n').value=s.stat3n; document.getElementById('sStat3l').value=s.stat3l;
  document.getElementById('sStat4n').value=s.stat4n; document.getElementById('sStat4l').value=s.stat4l;
  document.getElementById('sAboutTitle').value = s.aboutTitle;
  document.getElementById('sAboutText').value = s.aboutText;
  document.getElementById('sAboutImg').value = s.aboutImg;
  document.getElementById('sVal1t').value=s.val1t; document.getElementById('sVal1d').value=s.val1d;
  document.getElementById('sVal2t').value=s.val2t; document.getElementById('sVal2d').value=s.val2d;
  document.getElementById('sVal3t').value=s.val3t; document.getElementById('sVal3d').value=s.val3d;
  document.getElementById('sPhone').value = s.phone;
  document.getElementById('sEmail').value = s.email;
  document.getElementById('sAddress').value = s.address;
  document.getElementById('sFootDesc').value = s.footDesc;
  document.getElementById('settingsOverlay').classList.add('open');
}
async function saveSettings(){
  const g = id => document.getElementById(id).value;
  const newSettings = {
    schoolName:g('sSchoolName'), tagline:g('sTagline'), logoInitials:g('sLogoInitials')||'SC', logoUrl:g('sLogoUrl'),
    heroTitle:g('sHeroTitle'), heroLead:g('sHeroLead'), heroImg:g('sHeroImg'),
    stat1n:g('sStat1n'), stat1l:g('sStat1l'), stat2n:g('sStat2n'), stat2l:g('sStat2l'),
    stat3n:g('sStat3n'), stat3l:g('sStat3l'), stat4n:g('sStat4n'), stat4l:g('sStat4l'),
    aboutTitle:g('sAboutTitle'), aboutText:g('sAboutText'), aboutImg:g('sAboutImg'),
    val1t:g('sVal1t'), val1d:g('sVal1d'), val2t:g('sVal2t'), val2d:g('sVal2d'), val3t:g('sVal3t'), val3d:g('sVal3d'),
    phone:g('sPhone'), email:g('sEmail'), address:g('sAddress'), footDesc:g('sFootDesc')
  };
  const btn = document.getElementById('settingsSaveBtn');
  if(btn){ btn.disabled = true; btn.textContent = 'Saving…'; }
  const ok = await saveDoc('settings', newSettings);
  if(btn){ btn.disabled = false; btn.textContent = 'Save changes'; }
  if(ok){
    currentSettings = newSettings;
    applySettings();
    closeModal('settingsOverlay');
    showToast('✓ Saved! Changes are now live for everyone.', 'success');
  } else {
    showToast('✗ Not saved — check your connection or that you\'re still logged in, then try again.', 'error');
  }
}

/* ---------- Programs (Academics) ---------- */
async function renderPrograms(){
  const list = await loadList('programs', DEFAULT_PROGRAMS);
  document.getElementById('progGrid').innerHTML = list.map(item => `
    <div class="prog-card">
      <div class="grade">${escapeHtml(item.grade)}</div>
      <h4>${escapeHtml(item.title)}</h4>
      <p>${escapeHtml(item.desc)}</p>
      ${isAdmin ? `<div class="card-admin-row"><button class="del-btn" onclick="window.deleteListItem('programs','${item.id}')">Remove</button></div>` : ''}
    </div>`).join('');
}
async function addProgram(){
  const grade = document.getElementById('progGrade').value.trim();
  const title = document.getElementById('progTitle').value.trim();
  const desc = document.getElementById('progDesc').value.trim();
  if(!title){ showToast('Please enter a title.'); return; }
  const list = await loadList('programs', DEFAULT_PROGRAMS);
  list.push({id:uid(), grade, title, desc});
  const ok = await saveList('programs', list);
  if(ok){
    document.getElementById('progGrade').value=''; document.getElementById('progTitle').value=''; document.getElementById('progDesc').value='';
    showToast('✓ Saved! Program added for everyone.', 'success');
    renderPrograms();
  } else {
    showToast('✗ Not saved — please try again.', 'error');
  }
}

/* ---------- Achievements ---------- */
async function renderAchievements(){
  const list = await loadList('achievements', []);
  const grid = document.getElementById('achGrid');
  if(list.length === 0 && !isAdmin){ grid.innerHTML = '<p class="empty-note">No achievements posted yet — check back soon!</p>'; return; }
  grid.innerHTML = list.map(item => `
    <div class="pin-card">
      <div class="pin"></div>
      ${item.image ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}">` : `<div class="medal">&#9733;</div>`}
      <h4>${escapeHtml(item.title)}</h4><p>${escapeHtml(item.desc)}</p><div class="date">${escapeHtml(item.date)}</div>
      ${isAdmin ? `<div class="card-admin-row"><button class="del-btn" onclick="window.deleteListItem('achievements','${item.id}')">Remove</button></div>` : ''}
    </div>`).join('');
}
async function addAchievement(){
  const title = document.getElementById('achTitle').value.trim();
  const date = document.getElementById('achDate').value.trim();
  const desc = document.getElementById('achDesc').value.trim();
  const image = document.getElementById('achImg').value.trim();
  if(!title){ showToast('Please enter a title.'); return; }
  const list = await loadList('achievements', []);
  list.unshift({id:uid(), title, date: date || 'Recent', desc, image});
  const ok = await saveList('achievements', list);
  if(ok){
    document.getElementById('achTitle').value=''; document.getElementById('achDate').value=''; document.getElementById('achDesc').value=''; document.getElementById('achImg').value=''; document.getElementById('achImgFile').value=''; setPreview('achImgPreview','');
    showToast('✓ Saved! Achievement is now live for everyone.', 'success');
    renderAchievements();
  } else {
    showToast('✗ Not saved — please try again.', 'error');
  }
}

/* ---------- Gallery ---------- */
async function renderGallery(){
  const list = await loadList('gallery', []);
  const grid = document.getElementById('galGrid');
  if(list.length === 0 && !isAdmin){ grid.innerHTML = '<p style="color:var(--ink-soft);grid-column:1/-1;">No photos yet — the gallery will fill up soon.</p>'; return; }
  grid.innerHTML = list.map(item => `
    <div class="gal-item">
      <img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.caption||'School photo')}">
      <div class="cap">${escapeHtml(item.caption||'')}</div>
      ${isAdmin ? `<button class="del-btn" style="position:absolute;top:6px;right:6px;" onclick="window.deleteListItem('gallery','${item.id}')">&times;</button>` : ''}
    </div>`).join('');
}
async function addGalleryImage(){
  const url = document.getElementById('galUrl').value.trim();
  const caption = document.getElementById('galCap').value.trim();
  if(!url){ showToast('Please upload a photo first.', 'error'); return; }
  const list = await loadList('gallery', []);
  list.unshift({id:uid(), url, caption});
  const ok = await saveList('gallery', list);
  if(ok){
    document.getElementById('galUrl').value=''; document.getElementById('galCap').value=''; document.getElementById('galUrlFile').value=''; setPreview('galUrlPreview','');
    showToast('✓ Saved! Photo is now live for everyone.', 'success');
    renderGallery();
  } else {
    showToast('✗ Not saved — please try again.', 'error');
  }
}

/* ---------- Notices ---------- */
async function renderNotices(){
  const list = await loadList('notices', []);
  const wrap = document.getElementById('noticeList');
  if(list.length === 0 && !isAdmin){ wrap.innerHTML = '<p style="color:var(--ink-soft);">No upcoming events posted right now.</p>'; return; }
  const sorted = [...list].sort((a,b)=> new Date(b.date||0) - new Date(a.date||0));
  wrap.innerHTML = sorted.map(item => {
    const d = item.date ? new Date(item.date) : null;
    const day = d ? d.getDate() : '—'; const mon = d ? d.toLocaleString('en-US',{month:'short'}) : '';
    const isNew = d && (Date.now() - d.getTime() < 1000*60*60*24*14);
    return `<div class="notice-card ${isNew?'is-new':''}">
      <div class="notice-date"><div class="d">${day}</div><div class="m">${mon}</div></div>
      <div class="notice-body"><h4>${escapeHtml(item.title)}</h4><p>${escapeHtml(item.desc||'')}</p>
      ${isAdmin ? `<div class="card-admin-row"><button class="del-btn" onclick="window.deleteListItem('notices','${item.id}')">Remove</button></div>` : ''}</div>
      ${item.image ? `<img class="notice-img" src="${escapeHtml(item.image)}" alt="">` : '<span></span>'}
    </div>`;
  }).join('');
}
async function addNotice(){
  const title = document.getElementById('notTitle').value.trim();
  const date = document.getElementById('notDate').value;
  const desc = document.getElementById('notDesc').value.trim();
  const image = document.getElementById('notImg').value.trim();
  if(!title){ showToast('Please enter a title.'); return; }
  const list = await loadList('notices', []);
  list.unshift({id:uid(), title, date, desc, image});
  const ok = await saveList('notices', list);
  if(ok){
    document.getElementById('notTitle').value=''; document.getElementById('notDate').value=''; document.getElementById('notDesc').value=''; document.getElementById('notImg').value=''; document.getElementById('notImgFile').value=''; setPreview('notImgPreview','');
    showToast('✓ Saved! Notice is now live for everyone.', 'success');
    renderNotices();
  } else {
    showToast('✗ Not saved — please try again.', 'error');
  }
}

/* ---------- Shared delete for the four list-based sections ---------- */
async function deleteListItem(key, id){
  const fallback = key === 'programs' ? DEFAULT_PROGRAMS : [];
  const list = await loadList(key, fallback);
  const ok = await saveList(key, list.filter(i => i.id !== id));
  if(ok){ showToast('✓ Removed for everyone.', 'success'); }
  else { showToast('✗ Not saved — please try again.', 'error'); }
  renderAll();
}

/* ---------- Visitor queries (real Firestore collection) ---------- */
document.getElementById('enquiryForm').addEventListener('submit', async function(e){
  e.preventDefault();
  const name = document.getElementById('qName').value.trim();
  const email = document.getElementById('qEmail').value.trim();
  const phone = document.getElementById('qPhone').value.trim();
  const message = document.getElementById('qMsg').value.trim();
  if(!name || !email || !message) return;
  try{
    await addDoc(collection(db, 'messages'), { name, email, phone, message, date: new Date().toISOString() });
    this.reset();
    showToast("Thanks! Your question has been sent to the school.");
    refreshMessageBadge();
  }catch(err){
    console.error(err);
    showToast("Could not send — please try again in a moment.");
  }
});
async function refreshMessageBadge(){
  if(!isAdmin) return;
  try{
    const snap = await getDocs(collection(db, 'messages'));
    const badge = document.getElementById('msgBadge');
    if(snap.size > 0){ badge.style.display='flex'; badge.textContent = snap.size > 99 ? '99+' : snap.size; }
    else { badge.style.display='none'; }
  }catch(e){ /* not logged in yet or no permission */ }
}
async function openMessagesModal(){
  const body = document.getElementById('messagesBody');
  body.innerHTML = '<div class="msg-empty">Loading…</div>';
  document.getElementById('messagesOverlay').classList.add('open');
  try{
    const q = query(collection(db, 'messages'), orderBy('date', 'desc'));
    const snap = await getDocs(q);
    if(snap.empty){ body.innerHTML = '<div class="msg-empty">No questions from visitors yet.</div>'; return; }
    body.innerHTML = snap.docs.map(d => {
      const m = d.data();
      return `<div class="msg-item">
        <div class="meta">${new Date(m.date).toLocaleString()}</div>
        <div class="name">${escapeHtml(m.name)}</div>
        <div style="font-size:.82rem;color:var(--ink-soft);">${escapeHtml(m.email)}${m.phone ? ' · '+escapeHtml(m.phone) : ''}</div>
        <p style="margin:8px 0 0;">${escapeHtml(m.message)}</p>
        <div class="card-admin-row"><button class="del-btn" onclick="window.deleteQuery('${d.id}')">Delete</button></div>
      </div>`;
    }).join('');
  }catch(err){
    body.innerHTML = '<div class="msg-empty">Could not load messages. Make sure you are logged in as admin.</div>';
  }
}
async function deleteQuery(id){
  try{
    await deleteDoc(doc(db, 'messages', id));
    openMessagesModal();
    refreshMessageBadge();
    showToast('✓ Message deleted.', 'success');
  }catch(e){ showToast('✗ Could not delete message.', 'error'); }
}

/* ---------- Nav smooth scroll ---------- */
function scrollToSection(id, event){
  if(event) event.preventDefault();
  const el = document.getElementById(id);
  if(el) el.scrollIntoView({behavior:'smooth', block:'start'});
  document.getElementById('navLinks').classList.remove('open');
}
document.getElementById('hamburgerBtn').addEventListener('click', ()=>{ document.getElementById('navLinks').classList.toggle('open'); });
document.querySelectorAll('nav.links a').forEach(a=>{ a.addEventListener('click', ()=> document.getElementById('navLinks').classList.remove('open')); });
document.querySelectorAll('.modal-overlay').forEach(ov=>{ ov.addEventListener('click', e=>{ if(e.target===ov) ov.classList.remove('open'); }); });

function renderAll(){ renderPrograms(); renderAchievements(); renderGallery(); renderNotices(); }

/* ---------- Expose functions used by inline onclick= handlers in index.html ---------- */
window.scrollToSection = scrollToSection;
window.handleImageUpload = handleImageUpload;
window.openLogin = openLogin;
window.closeModal = closeModal;
window.attemptLogin = attemptLogin;
window.exitAdmin = exitAdmin;
window.openSettingsModal = openSettingsModal;
window.saveSettings = saveSettings;
window.addProgram = addProgram;
window.addAchievement = addAchievement;
window.addGalleryImage = addGalleryImage;
window.addNotice = addNotice;
window.deleteListItem = deleteListItem;
window.openMessagesModal = openMessagesModal;
window.deleteQuery = deleteQuery;

/* ---------- Init ---------- */
(async function init(){
  await loadSettings();
  renderAll();
})();
