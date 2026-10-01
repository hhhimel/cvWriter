/* CV Builder — app.js
   All logic runs client-side. Drafts in localStorage. DOCX via self-hosted lib. */

let previewTimer = null;
const DRAFT_KEY = 'cvbuilder_draft_v1';
const DRAFT_SAVE_MS = 800;

function esc(s){
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function joinList(arr){
  if(arr.length===0) return '';
  if(arr.length===1) return arr[0];
  if(arr.length===2) return arr[0] + ' and ' + arr[1];
  return arr.slice(0,-1).join(', ') + ', and ' + arr[arr.length-1];
}
function articleFor(text){
  const t = (text || '').trim();
  const vowelSoundAcronyms = ['MS','MA','MBA','MSC','LLB','LLM','SSC','HSC','MPHIL'];
  const firstWord = t.split(/\s+/)[0] || '';
  if(vowelSoundAcronyms.includes(firstWord.toUpperCase())) return 'an';
  return /^[aeiou]/i.test(t) ? 'an' : 'a';
}
function formatDate(iso){
  if(!iso) return iso;
  const d = new Date(iso + 'T00:00:00');
  if(isNaN(d)) return iso;
  return d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
}
function slugFileName(name){
  const base = (name || 'CV').trim().replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g,'');
  return (base || 'CV') + '.docx';
}
function fmtBytes(bytes){
  return bytes >= 1024*1024 ? (bytes/1024/1024).toFixed(2) + ' MB' : Math.round(bytes/1024) + ' KB';
}
function val(id){
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

document.getElementById('copyYear').textContent = new Date().getFullYear();

const HEADING_KEYS = ['objective','education','training','skills','experience','languages','itSkills','activities','personalInfo','references'];

const TEMPLATES = {
  fresher: {
    order: ['objective','education','skills','training','experience','activities','languages','itSkills','custom','personalInfo','references'],
    headings: {
      objective:'Career Objective', education:'Education', training:'Training and Workshop',
      skills:'Special Skills', experience:'Work Experience', languages:'Language Skills',
      itSkills:'IT / Technical Skills', activities:'Extra-Curricular Activities',
      personalInfo:'Personal Info', references:'References'
    },
    color: '#1c4532'
  },
  professional: {
    order: ['objective','experience','skills','education','training','languages','itSkills','activities','custom','personalInfo','references'],
    headings: {
      objective:'Professional Summary', education:'Education', training:'Certifications and Training',
      skills:'Core Skills', experience:'Professional Experience', languages:'Languages',
      itSkills:'Technical Skills', activities:'Additional Activities',
      personalInfo:'Personal Info', references:'References'
    },
    color: '#1F3A5F'
  },
  europass: {
    order: ['objective','personalInfo','experience','education','training','skills','languages','itSkills','activities','custom','references'],
    headings: {
      objective:'Personal Statement', education:'Education And Training', training:'Training And Workshop',
      skills:'Personal Skills', experience:'Work Experience', languages:'Language Skills',
      itSkills:'Digital Skills', activities:'Additional Information',
      personalInfo:'Personal Information', references:'References'
    },
    color: '#003399'
  },
  academic: {
    order: ['objective','education','experience','training','skills','languages','itSkills','activities','custom','personalInfo','references'],
    headings: {
      objective:'Research Interests', education:'Education', training:'Training and Certifications',
      skills:'Research Skills', experience:'Academic Experience', languages:'Languages',
      itSkills:'Technical Skills', activities:'Service and Activities',
      personalInfo:'Personal Information', references:'References'
    },
    color: '#4A1942'
  },
  minimal: {
    order: ['objective','experience','education','skills','languages','itSkills','training','activities','custom','personalInfo','references'],
    headings: {
      objective:'Summary', education:'Education', training:'Training',
      skills:'Skills', experience:'Experience', languages:'Languages',
      itSkills:'Tools', activities:'Activities',
      personalInfo:'Details', references:'References'
    },
    color: '#333333'
  }
};

const PROFICIENCY_OPTS = `
  <option value="">—</option>
  <option value="Beginner">Beginner</option>
  <option value="Intermediate">Intermediate</option>
  <option value="Advanced">Advanced</option>
  <option value="Expert">Expert</option>
`;

/* ========== Build section DOM ========== */
function sectionShell(key, title, bodyHtml, { editable = true, reorder = true } = {}){
  const num = '00';
  const drag = reorder ? `<button type="button" class="drag-handle" title="Drag to reorder" aria-label="Drag to reorder" draggable="false">⠿</button>` : '';
  const pen = editable ? `
    <input type="text" class="heading-input" id="heading_${key}" value="${esc(title)}" aria-label="Rename section heading">
    <button type="button" class="pen-btn" data-pen="${key}" title="Rename heading (or double-click title)" aria-label="Rename heading">✎</button>` : '';
  const collapse = reorder ? `<button type="button" class="collapse-btn" data-collapse="${key}" title="Collapse / expand" aria-label="Collapse section">▾</button>` : '';
  const hideBtn = reorder ? `<button type="button" class="section-hide-btn" data-hide-section="${key}" title="Hide section from CV (no blank space)" aria-label="Hide section">×</button>` : '';
  const moves = reorder ? `<div class="reorder-btns">
    <button type="button" class="move-btn" data-move="up" aria-label="Move up">▲</button>
    <button type="button" class="move-btn" data-move="down" aria-label="Move down">▼</button>
  </div>` : '';
  return `<div class="section" data-key="${key}" ${reorder ? 'draggable="true"' : ''}>
    <div class="section-head">
      ${drag}
      <span class="section-num">${num}</span>
      <div class="heading-inline">
        <span class="heading-display" id="display_${key}">${esc(title)}</span>
        ${pen}
      </div>
      ${collapse}
      ${hideBtn}
      ${moves}
    </div>
    <div class="section-body">${bodyHtml}</div>
  </div>`;
}

function buildSectionsHTML(){
  const parts = [];
  parts.push(sectionShell('objective', 'Career Objective', `
    <p class="hint">Short statement of what you're looking for. Double-click the title or use ✎ to rename.</p>
    <div class="field"><textarea id="objective" rows="3" placeholder="Looking forward to contribute to..."></textarea></div>
    <div class="row cols-2">
      <div class="field"><label for="targetRole">Target role (optional)</label><input type="text" id="targetRole" placeholder="e.g. Research Assistant"></div>
      <div class="field"><label for="shortBio">Short bio / key points (optional)</label><input type="text" id="shortBio" placeholder="e.g. Hardworking fresh graduate"></div>
    </div>
    <button type="button" class="add-btn" data-suggest="objective">💡 Suggest wording</button>
    <div class="suggest-box" id="suggest_objective" style="display:none;"></div>
  `));

  parts.push(sectionShell('education', 'Education', `
    <p class="hint">Most recent first. Use suggest for a sample degree line you can edit.</p>
    <div id="educationList"></div>
    <div class="toolbar-row">
      <button type="button" class="add-btn" data-add="education">+ Add education</button>
      <button type="button" class="add-btn" data-suggest="education">💡 Suggest sample</button>
    </div>
    <div class="suggest-box" id="suggest_education" style="display:none;"></div>
  `));

  parts.push(sectionShell('training', 'Training and Workshop', `
    <p class="hint">Short courses, workshops, certifications.</p>
    <div id="trainingList"></div>
    <div class="toolbar-row">
      <button type="button" class="add-btn" data-add="training">+ Add training</button>
      <button type="button" class="add-btn" data-suggest="training">💡 Suggest wording</button>
    </div>
    <div class="suggest-box" id="suggest_training" style="display:none;"></div>
  `));

  parts.push(sectionShell('skills', 'Special Skills', `
    <p class="hint">One skill per entry. Optional proficiency level.</p>
    <div id="skillsList"></div>
    <div class="toolbar-row">
      <button type="button" class="add-btn" data-add="skills">+ Add skill</button>
      <button type="button" class="add-btn" data-suggest="skills">💡 Suggest wording</button>
    </div>
    <div class="suggest-box" id="suggest_skills" style="display:none;"></div>
  `));

  parts.push(sectionShell('experience', 'Work Experience', `
    <p class="hint">Internships and jobs, most recent first. Suggest fills a sample internship you can edit.</p>
    <div id="experienceList"></div>
    <div class="toolbar-row">
      <button type="button" class="add-btn" data-add="experience">+ Add experience</button>
      <button type="button" class="add-btn" data-suggest="experience">💡 Suggest wording</button>
    </div>
    <div class="suggest-box" id="suggest_experience" style="display:none;"></div>
  `));

  parts.push(sectionShell('languages', 'Language Skills', `
    <div id="languageList"></div>
    <div class="toolbar-row">
      <button type="button" class="add-btn" data-add="language">+ Add language</button>
      <button type="button" class="add-btn" data-suggest="languages">💡 Suggest wording</button>
    </div>
    <div class="suggest-box" id="suggest_languages" style="display:none;"></div>
  `));

  parts.push(sectionShell('itSkills', 'IT / Technical Skills', `
    <p class="hint">One line per skill or tool.</p>
    <div class="field"><textarea id="itSkills" rows="3" placeholder="Microsoft Word, Excel, PowerPoint&#10;Basic data analysis"></textarea></div>
    <button type="button" class="add-btn" data-suggest="itSkills">💡 Suggest wording</button>
    <div class="suggest-box" id="suggest_itSkills" style="display:none;"></div>
  `));

  parts.push(sectionShell('activities', 'Extra-Curricular Activities', `
    <div id="activityList"></div>
    <div class="toolbar-row">
      <button type="button" class="add-btn" data-add="activity">+ Add activity</button>
      <button type="button" class="add-btn" data-suggest="activities">💡 Suggest wording</button>
    </div>
    <div class="suggest-box" id="suggest_activities" style="display:none;"></div>
  `));

  parts.push(sectionShell('custom', 'Custom Sections', `
    <p class="hint">Publications, Projects, Awards — each entry has its own title on the CV.</p>
    <div id="customList"></div>
    <div class="toolbar-row">
      <button type="button" class="add-btn" data-add="custom">+ Add custom section</button>
      <button type="button" class="add-btn" data-suggest="custom">💡 Suggest sample project</button>
    </div>
    <div class="suggest-box" id="suggest_custom" style="display:none;"></div>
  `, { editable: false }));

  parts.push(sectionShell('personalInfo', 'Personal Info', `
    <div class="row cols-3">
      <div class="field"><label for="dob">Date of Birth</label><input type="date" id="dob"></div>
      <div class="field"><label for="nationality">Nationality</label><input type="text" id="nationality" placeholder="Bangladeshi"></div>
      <div class="field"><label for="marital">Marital Status</label><input type="text" id="marital" placeholder="Single"></div>
    </div>
    <p class="hint">Blood Group, Religion, NID, parents' names, etc.</p>
    <div id="extraInfoList"></div>
    <div class="toolbar-row">
      <button type="button" class="add-btn" data-add="extraInfo">+ Add more information</button>
      <button type="button" class="add-btn" data-suggest="personalInfo">💡 Suggest fields</button>
    </div>
    <div class="suggest-box" id="suggest_personalInfo" style="display:none;"></div>
  `));

  parts.push(sectionShell('references', 'References', `
    <div class="checkbox-row">
      <input type="checkbox" id="refUponRequest">
      <label for="refUponRequest">Just show "References available upon request"</label>
    </div>
    <div id="referenceWrap">
      <p class="hint">Usually two people who can vouch for you.</p>
      <div id="referenceList"></div>
      <div class="toolbar-row">
        <button type="button" class="add-btn" data-add="reference">+ Add reference</button>
        <button type="button" class="add-btn" data-suggest="references">💡 Suggest wording</button>
      </div>
      <div class="suggest-box" id="suggest_references" style="display:none;"></div>
    </div>
  `));

  return parts.join('');
}

document.getElementById('sectionsContainer').innerHTML = buildSectionsHTML();

/* ========== Entry templates ========== */
const entryTemplates = {
  education: () => `
    <div class="row cols-2">
      <div class="field"><label>Degree / Exam</label><input type="text" data-k="degree" placeholder="e.g. BSc in Agriculture"></div>
      <div class="field"><label>Institution</label><input type="text" data-k="institution" placeholder="e.g. Sher-e-Bangla Agricultural University"></div>
    </div>
    <div class="row cols-2">
      <div class="field"><label>Result</label><input type="text" data-k="result" placeholder="e.g. CGPA 3.60 out of 4"></div>
      <div class="field"><label>Year</label><input type="text" data-k="year" placeholder="e.g. 2023"></div>
    </div>`,
  training: () => `
    <div class="field"><label>Training / Workshop</label><textarea rows="2" data-k="text" placeholder="e.g. Data analysis workshop organized by..."></textarea></div>`,
  skills: () => `
    <div class="row cols-2">
      <div class="field"><label>Skill</label><input type="text" data-k="text" placeholder="e.g. Team work"></div>
      <div class="field"><label>Proficiency</label><select data-k="level">${PROFICIENCY_OPTS}</select></div>
    </div>`,
  experience: () => `
    <div class="row cols-2">
      <div class="field"><label>Position</label><input type="text" data-k="position" placeholder="e.g. Research Intern"></div>
      <div class="field"><label>Duration</label><input type="text" data-k="duration" placeholder="e.g. Jan 2024 – Jun 2024"></div>
    </div>
    <div class="row cols-2">
      <div class="field"><label>Company / Organization</label><input type="text" data-k="company" placeholder="e.g. Sonali Bank PLC"></div>
      <div class="field"><label>Location</label><input type="text" data-k="location" placeholder="e.g. Dhaka"></div>
    </div>
    <div class="field"><label>Responsibilities</label><textarea rows="3" data-k="description" placeholder="One point per line"></textarea></div>`,
  language: () => `
    <div class="row cols-2">
      <div class="field"><label>Language</label><input type="text" data-k="language" placeholder="e.g. English"></div>
      <div class="field"><label>Proficiency</label><input type="text" data-k="proficiency" placeholder="e.g. Good working proficiency" list="langProfList"></div>
    </div>`,
  activity: () => `
    <div class="field"><label>Activity</label><textarea rows="2" data-k="text" placeholder="e.g. Volunteer at..."></textarea></div>`,
  reference: () => `
    <div class="row cols-2">
      <div class="field"><label>Name</label><input type="text" data-k="name" placeholder="e.g. Dr. Nahid Zeba"></div>
      <div class="field"><label>Designation</label><input type="text" data-k="designation" placeholder="e.g. Associate Professor"></div>
    </div>
    <div class="row cols-2">
      <div class="field"><label>Organization</label><input type="text" data-k="organization" placeholder="e.g. University name"></div>
      <div class="field"><label>Address</label><input type="text" data-k="address" placeholder="e.g. Dhaka-1207"></div>
    </div>
    <div class="row cols-2">
      <div class="field"><label>Phone</label><input type="text" data-k="phone" placeholder="+880 1XXX XXXXXX"></div>
      <div class="field"><label>Email</label><input type="text" data-k="email" placeholder="name@email.com"></div>
    </div>`,
  custom: () => `
    <div class="row cols-2">
      <div class="field"><label>Section title</label><input type="text" data-k="title" placeholder="e.g. Publications"></div>
      <div class="field"><label>Format</label>
        <select data-k="format">
          <option value="bullet">Bulleted list</option>
          <option value="paragraph">Paragraph</option>
        </select>
      </div>
    </div>
    <div class="field"><label>Content</label><textarea rows="3" data-k="content" placeholder="One point per line, or a short paragraph"></textarea></div>`,
  extraInfo: () => `
    <div class="row cols-2">
      <div class="field"><label>Label</label><input type="text" data-k="label" placeholder="e.g. Blood Group"></div>
      <div class="field"><label>Value</label><input type="text" data-k="value" placeholder="e.g. O+"></div>
    </div>`
};

function addEntry(kind, preset){
  const list = document.getElementById(kind + 'List');
  if(!list) return null;
  const wrap = document.createElement('div');
  wrap.className = 'entry';
  wrap.dataset.kind = kind;
  wrap.innerHTML = `<button type="button" class="entry-remove" aria-label="Remove">Remove ✕</button>` + entryTemplates[kind]();
  wrap.querySelector('.entry-remove').addEventListener('click', () => {
    wrap.remove();
    schedulePreviewUpdate();
    scheduleDraftSave();
    updateEmptyCollapse();
  });
  if(preset){
    Object.keys(preset).forEach(k=>{
      const el = wrap.querySelector(`[data-k="${k}"]`);
      if(el) el.value = preset[k];
    });
  }
  list.appendChild(wrap);
  schedulePreviewUpdate();
  scheduleDraftSave();
  updateEmptyCollapse();
  return wrap;
}

document.querySelectorAll('[data-add]').forEach(btn=>{
  btn.addEventListener('click', ()=> addEntry(btn.dataset.add));
});

/* datalist for language proficiency hints */
(function(){
  const dl = document.createElement('datalist');
  dl.id = 'langProfList';
  ['Native','Fluent','Good working proficiency','Basic','Elementary'].forEach(t=>{
    const o = document.createElement('option'); o.value = t; dl.appendChild(o);
  });
  document.body.appendChild(dl);
})();

/* ========== Heading editors (pen + double-click) ========== */
function syncHeadingDisplay(key){
  const input = document.getElementById('heading_' + key);
  const display = document.getElementById('display_' + key);
  if(input && display){
    display.textContent = input.value.trim() || key;
  }
}
function setHeadingEditing(key, editing){
  const btn = document.querySelector(`[data-pen="${key}"]`);
  const wrap = btn?.closest('.heading-inline');
  const input = document.getElementById('heading_' + key);
  if(!wrap || !input) return;
  if(editing){
    document.querySelectorAll('.heading-inline.editing').forEach(w=>{
      const k = w.querySelector('.pen-btn')?.dataset.pen;
      if(k && k !== key) setHeadingEditing(k, false);
    });
    wrap.classList.add('editing');
    if(btn) btn.setAttribute('aria-pressed', 'true');
    input.focus();
    input.select();
  } else {
    wrap.classList.remove('editing');
    if(btn) btn.setAttribute('aria-pressed', 'false');
    syncHeadingDisplay(key);
    schedulePreviewUpdate();
    scheduleDraftSave();
  }
}
function wireHeadingEditors(){
  HEADING_KEYS.forEach(key=>{
    const btn = document.querySelector(`[data-pen="${key}"]`);
    const input = document.getElementById('heading_' + key);
    const display = document.getElementById('display_' + key);
    if(!input) return;

    if(btn){
      btn.addEventListener('click', (e)=>{
        e.preventDefault();
        const wrap = btn.closest('.heading-inline');
        setHeadingEditing(key, !wrap.classList.contains('editing'));
      });
    }
    if(display){
      display.addEventListener('dblclick', ()=> setHeadingEditing(key, true));
    }
    input.addEventListener('keydown', (e)=>{
      if(e.key === 'Enter' || e.key === 'Escape'){
        e.preventDefault();
        setHeadingEditing(key, false);
      }
    });
    input.addEventListener('blur', ()=>{
      setTimeout(()=>{ if(document.activeElement !== input) setHeadingEditing(key, false); }, 120);
    });
    input.addEventListener('input', ()=>{
      syncHeadingDisplay(key);
      schedulePreviewUpdate();
      scheduleDraftSave();
    });
    syncHeadingDisplay(key);
  });
}

/* ========== Section reorder: buttons + drag-drop ========== */
const sectionsContainer = document.getElementById('sectionsContainer');

function renumberSections(){
  let n = 0;
  Array.from(sectionsContainer.children).forEach((el)=>{
    if(el.classList.contains('is-hidden-from-cv')) return;
    const numEl = el.querySelector('.section-num');
    if(numEl) numEl.textContent = String(n + 2).padStart(2, '0');
    n++;
  });
}
function updateMoveButtonsState(){
  const kids = Array.from(sectionsContainer.children).filter(el => !el.classList.contains('is-hidden-from-cv'));
  kids.forEach((el, i)=>{
    const up = el.querySelector('[data-move="up"]');
    const down = el.querySelector('[data-move="down"]');
    if(up) up.disabled = (i === 0);
    if(down) down.disabled = (i === kids.length - 1);
  });
}
function moveSection(sectionEl, dir){
  if(dir === 'up'){
    const prev = sectionEl.previousElementSibling;
    if(prev) sectionsContainer.insertBefore(sectionEl, prev);
  } else {
    const next = sectionEl.nextElementSibling;
    if(next) sectionsContainer.insertBefore(next, sectionEl);
  }
  renumberSections();
  updateMoveButtonsState();
  schedulePreviewUpdate();
  scheduleDraftSave();
}
sectionsContainer.querySelectorAll('.move-btn').forEach(btn=>{
  btn.addEventListener('click', ()=> moveSection(btn.closest('.section'), btn.dataset.move));
});

/* Drag and drop */
let dragSrc = null;
sectionsContainer.querySelectorAll('.section[draggable="true"]').forEach(sec=>{
  sec.addEventListener('dragstart', (e)=>{
    if(e.target.closest('input,textarea,select,button:not(.drag-handle)')){
      e.preventDefault();
      return;
    }
    dragSrc = sec;
    sec.classList.add('is-dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', sec.dataset.key);
  });
  sec.addEventListener('dragend', ()=>{
    sec.classList.remove('is-dragging');
    sectionsContainer.querySelectorAll('.drag-over').forEach(el=> el.classList.remove('drag-over'));
    dragSrc = null;
  });
  sec.addEventListener('dragover', (e)=>{
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if(dragSrc && dragSrc !== sec) sec.classList.add('drag-over');
  });
  sec.addEventListener('dragleave', ()=> sec.classList.remove('drag-over'));
  sec.addEventListener('drop', (e)=>{
    e.preventDefault();
    sec.classList.remove('drag-over');
    if(!dragSrc || dragSrc === sec) return;
    const kids = Array.from(sectionsContainer.children);
    const from = kids.indexOf(dragSrc);
    const to = kids.indexOf(sec);
    if(from < to) sectionsContainer.insertBefore(dragSrc, sec.nextSibling);
    else sectionsContainer.insertBefore(dragSrc, sec);
    renumberSections();
    updateMoveButtonsState();
    schedulePreviewUpdate();
    scheduleDraftSave();
  });
});
/* Only start drag from handle on some browsers — allow whole section but prevent form fields */
sectionsContainer.querySelectorAll('.drag-handle').forEach(h=>{
  h.addEventListener('mousedown', ()=> h.closest('.section').draggable = true);
});

function getSectionOrder(){
  return Array.from(sectionsContainer.children)
    .filter(el => el.dataset.key && !el.classList.contains('is-hidden-from-cv'))
    .map(el => el.dataset.key);
}
function getAllSectionKeys(){
  return Array.from(sectionsContainer.children).map(el => el.dataset.key).filter(Boolean);
}
function refreshHiddenSectionsBar(){
  const bar = document.getElementById('hiddenSectionsBar');
  const list = document.getElementById('hiddenSectionsList');
  if(!bar || !list) return;
  const hidden = Array.from(sectionsContainer.children).filter(el => el.classList.contains('is-hidden-from-cv'));
  if(!hidden.length){
    bar.hidden = true;
    list.innerHTML = '';
    return;
  }
  bar.hidden = false;
  list.innerHTML = hidden.map(el => {
    const key = el.dataset.key;
    const title = (document.getElementById('display_' + key)?.textContent
      || document.getElementById('heading_' + key)?.value
      || key);
    return `<button type="button" class="hs-chip" data-restore-section="${key}" title="Show this section again">+ ${esc(title)}</button>`;
  }).join('');
  list.querySelectorAll('[data-restore-section]').forEach(btn => {
    btn.addEventListener('click', () => {
      const el = sectionsContainer.querySelector(`[data-key="${btn.dataset.restoreSection}"]`);
      if(el){
        el.classList.remove('is-hidden-from-cv');
        delete el.dataset.hiddenFromCv;
      }
      renumberSections();
      updateMoveButtonsState();
      refreshHiddenSectionsBar();
      schedulePreviewUpdate();
      scheduleDraftSave();
    });
  });
}
function wireSectionHideButtons(){
  sectionsContainer.querySelectorAll('[data-hide-section]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const key = btn.dataset.hideSection;
      const el = sectionsContainer.querySelector(`[data-key="${key}"]`);
      if(!el) return;
      el.classList.add('is-hidden-from-cv');
      el.dataset.hiddenFromCv = '1';
      renumberSections();
      updateMoveButtonsState();
      refreshHiddenSectionsBar();
      schedulePreviewUpdate();
      scheduleDraftSave();
      if(typeof showToast === 'function') showToast('Section hidden — restore anytime from the bar below.');
    });
  });
}
function applyTemplateOrder(order){
  order.forEach(key=>{
    const el = sectionsContainer.querySelector(`[data-key="${key}"]`);
    if(el) sectionsContainer.appendChild(el);
  });
  renumberSections();
  updateMoveButtonsState();
}
function applyHeadings(headingsMap){
  HEADING_KEYS.forEach(k=>{
    const input = document.getElementById('heading_' + k);
    if(input && headingsMap[k] !== undefined){
      input.value = headingsMap[k];
      syncHeadingDisplay(k);
    }
  });
}
function applyTemplate(key){
  const cfg = TEMPLATES[key];
  if(!cfg) return;
  applyTemplateOrder(cfg.order);
  applyHeadings(cfg.headings);
  document.getElementById('accentColor').value = cfg.color;
  schedulePreviewUpdate();
  scheduleDraftSave();
}
document.querySelectorAll('input[name="template"]').forEach(r=>{
  r.addEventListener('change', ()=>{ if(r.checked) applyTemplate(r.value); });
});

updateMoveButtonsState();
renumberSections();

/* ========== Collapse empty sections ========== */
function sectionIsEmpty(key){
  const data = collectData();
  switch(key){
    case 'objective': return !data.objective;
    case 'education': return !data.education.length;
    case 'training': return !data.training.length;
    case 'skills': return !data.skills.length;
    case 'experience': return !data.experience.length;
    case 'languages': return !data.languages.length;
    case 'itSkills': return !data.itSkills;
    case 'activities': return !data.activities.length;
    case 'custom': return !data.custom.length;
    case 'personalInfo': return !(data.dob || data.nationality || data.marital || data.extraInfo.length);
    case 'references': return data.refUponRequest ? false : !data.references.length;
    default: return false;
  }
}
function updateEmptyCollapse(){
  const auto = document.getElementById('autoCollapseEmpty').checked;
  sectionsContainer.querySelectorAll('.section[data-key]').forEach(sec=>{
    const key = sec.dataset.key;
    const btn = sec.querySelector(`[data-collapse="${key}"]`);
    if(!auto){
      /* manual collapse only via button */
      return;
    }
    const empty = sectionIsEmpty(key);
    sec.classList.toggle('collapsed', empty);
    if(btn) btn.textContent = empty ? '▸' : '▾';
  });
}
document.getElementById('autoCollapseEmpty').addEventListener('change', ()=>{
  if(!document.getElementById('autoCollapseEmpty').checked){
    sectionsContainer.querySelectorAll('.section.collapsed').forEach(s=>{
      s.classList.remove('collapsed');
      const b = s.querySelector('.collapse-btn');
      if(b) b.textContent = '▾';
    });
  } else updateEmptyCollapse();
  scheduleDraftSave();
});
sectionsContainer.querySelectorAll('.collapse-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const sec = btn.closest('.section');
    sec.classList.toggle('collapsed');
    btn.textContent = sec.classList.contains('collapsed') ? '▸' : '▾';
  });
});

/* ========== Refs / signature toggles ========== */
const refCheckbox = document.getElementById('refUponRequest');
const refWrap = document.getElementById('referenceWrap');
refCheckbox.addEventListener('change', ()=>{
  refWrap.style.display = refCheckbox.checked ? 'none' : '';
  schedulePreviewUpdate();
  scheduleDraftSave();
  updateEmptyCollapse();
});
const sigCheckbox = document.getElementById('includeSignature');
const sigWrap = document.getElementById('signatureWrap');
sigCheckbox.addEventListener('change', ()=>{
  sigWrap.style.display = sigCheckbox.checked ? '' : 'none';
  schedulePreviewUpdate();
  scheduleDraftSave();
});
const declCheckbox = document.getElementById('includeDeclaration');
const declWrap = document.getElementById('declarationWrap');
if(declCheckbox && declWrap){
  declCheckbox.addEventListener('change', ()=>{
    declWrap.style.display = declCheckbox.checked ? '' : 'none';
    schedulePreviewUpdate();
    scheduleDraftSave();
  });
}

/* ========== Image processing ========== */
function loadImage(dataUrl){
  return new Promise((resolve, reject)=>{
    const img = new Image();
    img.onload = ()=> resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}
function canvasToBlob(canvas, mime, quality){
  return new Promise(resolve => canvas.toBlob(resolve, mime, quality));
}
function blobToDataUrl(blob){
  return new Promise(resolve=>{
    const reader = new FileReader();
    reader.onload = ()=> resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}
function computeContainSize(sw, sh, maxW, maxH){
  let scale = 1;
  if(maxW) scale = Math.min(scale, maxW / sw);
  if(maxH) scale = Math.min(scale, maxH / sh);
  scale = Math.min(scale, 1);
  return { w: Math.max(1, Math.round(sw * scale)), h: Math.max(1, Math.round(sh * scale)) };
}
function toPixels(value, unit, dpi){
  const v = parseFloat(value);
  if(!v || v <= 0) return undefined;
  switch(unit){
    case 'px': return Math.round(v);
    case 'in': return Math.round(v * dpi);
    case 'cm': return Math.round((v / 2.54) * dpi);
    case 'mm': return Math.round((v / 25.4) * dpi);
    default: return Math.round(v);
  }
}
async function processImage(originalDataUrl, { maxW, maxH, targetBytes, format } = {}){
  const fmt = format === 'png' ? 'png' : 'jpeg';
  const mime = fmt === 'png' ? 'image/png' : 'image/jpeg';
  const img = await loadImage(originalDataUrl);
  let { w, h } = computeContainSize(img.width, img.height, maxW, maxH);
  let quality = 0.92;
  let blob = null;
  for(let attempt = 0; attempt < 14; attempt++){
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if(fmt === 'jpeg'){ ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, w, h); }
    ctx.drawImage(img, 0, 0, w, h);
    blob = await canvasToBlob(canvas, mime, fmt === 'jpeg' ? quality : undefined);
    if(!targetBytes || blob.size <= targetBytes || (w <= 60 || h <= 60)) break;
    if(fmt === 'jpeg' && quality > 0.42){ quality -= 0.1; }
    else { w = Math.max(60, Math.round(w * 0.85)); h = Math.max(60, Math.round(h * 0.85)); if(fmt==='jpeg') quality = 0.8; }
  }
  const dataUrl = await blobToDataUrl(blob);
  return { dataUrl, blob, width: w, height: h, bytes: blob.size, format: fmt };
}

const PHOTO_PRESETS = {
  us2x2: { unit:'in', w:2, h:2 },
  intl35x45: { unit:'mm', w:35, h:45 }
};

/* Simple crop: drag rectangle on canvas, portrait aspect ~ 3:4 */
let cropState = null;
function openCropModal(sourceDataUrl, onApply){
  const modal = document.getElementById('cropModal');
  const canvas = document.getElementById('cropCanvas');
  const ctx = canvas.getContext('2d');
  const img = new Image();
  img.onload = ()=>{
    const maxW = 480;
    const scale = Math.min(1, maxW / img.width);
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const aspect = 3/4; // width/height portrait
    let selW = canvas.width * 0.55;
    let selH = selW / aspect;
    if(selH > canvas.height * 0.9){ selH = canvas.height * 0.9; selW = selH * aspect; }
    cropState = {
      img, scale, onApply,
      sel: {
        x: (canvas.width - selW) / 2,
        y: (canvas.height - selH) / 2,
        w: selW, h: selH
      },
      dragging: false, startX:0, startY:0
    };
    drawCropOverlay();
  };
  img.src = sourceDataUrl;
  modal.style.display = 'flex';
}
function drawCropOverlay(){
  if(!cropState) return;
  const canvas = document.getElementById('cropCanvas');
  const ctx = canvas.getContext('2d');
  const { img, scale, sel } = cropState;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.clearRect(sel.x, sel.y, sel.w, sel.h);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.rect(0,0,canvas.width,canvas.height);
  ctx.rect(sel.x, sel.y, sel.w, sel.h);
  ctx.fill('evenodd');
  ctx.strokeStyle = '#1c4532';
  ctx.lineWidth = 2;
  ctx.strokeRect(sel.x, sel.y, sel.w, sel.h);
}
(function wireCrop(){
  const canvas = document.getElementById('cropCanvas');
  const aspect = 3/4;
  function pos(e){
    const r = canvas.getBoundingClientRect();
    const cx = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
    const cy = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
    return { x: cx * (canvas.width / r.width), y: cy * (canvas.height / r.height) };
  }
  function start(e){
    if(!cropState) return;
    e.preventDefault();
    const p = pos(e);
    cropState.dragging = true;
    cropState.startX = p.x;
    cropState.startY = p.y;
  }
  function move(e){
    if(!cropState || !cropState.dragging) return;
    e.preventDefault();
    const p = pos(e);
    let w = Math.abs(p.x - cropState.startX);
    let h = w / aspect;
    if(p.y < cropState.startY) h = -h;
    let x = Math.min(cropState.startX, cropState.startX + (p.x >= cropState.startX ? w : -w));
    let y = p.y >= cropState.startY ? cropState.startY : cropState.startY + h;
    if(h < 0){ h = -h; }
    w = Math.max(20, Math.min(w, canvas.width));
    h = w / aspect;
    if(x + w > canvas.width) x = canvas.width - w;
    if(y + h > canvas.height) y = canvas.height - h;
    x = Math.max(0, x); y = Math.max(0, y);
    cropState.sel = { x, y, w, h };
    drawCropOverlay();
  }
  function end(){ if(cropState) cropState.dragging = false; }
  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', move);
  canvas.addEventListener('mouseup', end);
  canvas.addEventListener('mouseleave', end);
  canvas.addEventListener('touchstart', start, {passive:false});
  canvas.addEventListener('touchmove', move, {passive:false});
  canvas.addEventListener('touchend', end);

  function close(){ document.getElementById('cropModal').style.display = 'none'; cropState = null; }
  document.getElementById('cropCloseBtn').addEventListener('click', close);
  document.getElementById('cropCancelBtn').addEventListener('click', close);
  document.getElementById('cropApplyBtn').addEventListener('click', async ()=>{
    if(!cropState) return;
    const { img, scale, sel, onApply } = cropState;
    const sx = sel.x / scale, sy = sel.y / scale, sw = sel.w / scale, sh = sel.h / scale;
    const out = document.createElement('canvas');
    out.width = Math.round(sw);
    out.height = Math.round(sh);
    out.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, out.width, out.height);
    const dataUrl = out.toDataURL('image/jpeg', 0.92);
    close();
    if(onApply) onApply(dataUrl);
  });
})();

function wireImageControl({ prefix, fileInputId, previewId, onResult, cropBtnId }){
  let originalDataUrl = null;
  let currentResult = null;

  const fileInput = document.getElementById(fileInputId);
  const preview = document.getElementById(previewId);
  const formatSel = document.getElementById(prefix + 'Format');
  const presetSel = document.getElementById(prefix + 'Preset');
  const customDims = document.getElementById(prefix + 'CustomDims');
  const customW = document.getElementById(prefix + 'CustomW');
  const customH = document.getElementById(prefix + 'CustomH');
  const customUnit = document.getElementById(prefix + 'CustomUnit');
  const dpiRow = document.getElementById(prefix + 'DpiRow');
  const dpiInput = document.getElementById(prefix + 'Dpi');
  const sizeValue = document.getElementById(prefix + 'SizeValue');
  const sizeUnit = document.getElementById(prefix + 'SizeUnit');
  const status = document.getElementById(prefix + 'ResizeStatus');
  const downloadBtn = document.getElementById(prefix + 'DownloadBtn');
  const cropBtn = cropBtnId ? document.getElementById(cropBtnId) : null;

  function updateVisibility(){
    const isCustom = presetSel.value === 'custom';
    customDims.style.display = isCustom ? '' : 'none';
    dpiRow.style.display = (isCustom && customUnit.value !== 'px') ? '' : 'none';
  }
  function computeMaxDims(){
    const value = presetSel.value;
    if(value === '') return {};
    if(value === 'custom'){
      const dpi = parseFloat(dpiInput.value) || 300;
      return { maxW: toPixels(customW.value, customUnit.value, dpi), maxH: toPixels(customH.value, customUnit.value, dpi) };
    }
    const preset = PHOTO_PRESETS[value];
    if(!preset) return {};
    return { maxW: toPixels(preset.w, preset.unit, 300), maxH: preset.h ? toPixels(preset.h, preset.unit, 300) : undefined };
  }
  function computeTargetBytes(){
    const v = parseFloat(sizeValue.value);
    if(!v || v <= 0) return null;
    return Math.round(v * (sizeUnit.value === 'MB' ? 1024*1024 : 1024));
  }

  function setHasImage(has){
    downloadBtn.disabled = !has;
    if(cropBtn) cropBtn.disabled = !has;
    const xBtn = document.getElementById(prefix + 'RemoveBtn');
    const editBtn = document.getElementById(prefix + 'CropBtn');
    if(xBtn) xBtn.hidden = !has;
    if(editBtn){ editBtn.hidden = !has; editBtn.disabled = !has; }
  }

  async function reprocess(){
    if(!originalDataUrl){
      setHasImage(false);
      onResult(null);
      return;
    }
    const { maxW, maxH } = computeMaxDims();
    const targetBytes = computeTargetBytes();
    const format = formatSel.value;
    status.textContent = 'Processing…';
    status.className = 'resize-status processing';
    try{
      const result = await processImage(originalDataUrl, { maxW, maxH, targetBytes, format });
      currentResult = result;
      preview.src = result.dataUrl;
      status.textContent = `${result.width}×${result.height} · ${fmtBytes(result.bytes)} · ${format.toUpperCase()}`;
      status.className = 'resize-status';
      setHasImage(true);
      onResult(result.dataUrl);
    }catch(e){
      status.textContent = 'Could not process image';
      status.className = 'resize-status';
      setHasImage(true);
      onResult(originalDataUrl);
    }
  }

  function clearImage(){
    originalDataUrl = null;
    currentResult = null;
    preview.removeAttribute('src');
    fileInput.value = '';
    status.textContent = '';
    setHasImage(false);
    onResult(null);
  }

  fileInput.addEventListener('change', (e)=>{
    const file = e.target.files[0];
    if(!file){
      clearImage();
      return;
    }
    formatSel.value = file.type.includes('png') ? 'png' : 'jpeg';
    const reader = new FileReader();
    reader.onload = ()=>{ originalDataUrl = reader.result; reprocess(); };
    reader.readAsDataURL(file);
  });
  presetSel.addEventListener('change', ()=>{ updateVisibility(); reprocess(); });
  customUnit.addEventListener('change', ()=>{ updateVisibility(); reprocess(); });
  [customW, customH, dpiInput, formatSel, sizeValue, sizeUnit].forEach(el=>{
    el.addEventListener('input', reprocess);
    el.addEventListener('change', reprocess);
  });
  downloadBtn.addEventListener('click', ()=>{
    if(!currentResult) return;
    const ext = currentResult.format === 'png' ? 'png' : 'jpg';
    const a = document.createElement('a');
    a.href = currentResult.dataUrl;
    a.download = `${prefix}_${currentResult.width}x${currentResult.height}.${ext}`;
    document.body.appendChild(a); a.click(); a.remove();
  });
  if(cropBtn){
    cropBtn.addEventListener('click', ()=>{
      if(!originalDataUrl) return;
      openCropModal(originalDataUrl, (cropped)=>{
        originalDataUrl = cropped;
        reprocess();
      });
    });
  }
  updateVisibility();
  return {
    getOriginal: ()=> originalDataUrl,
    setOriginal: (url)=>{
      originalDataUrl = url;
      if(url) reprocess();
      else clearImage();
    },
    getCurrent: ()=> currentResult?.dataUrl || null,
    clear: clearImage,
    openFilePicker: ()=> fileInput.click()
  };
}

let photoDataUrl = null;
const photoCtrl = wireImageControl({
  prefix:'photo', fileInputId:'photo', previewId:'photoPreview',
  cropBtnId: 'photoCropBtn',
  onResult:(url)=>{
    photoDataUrl = url;
    const xBtn = document.getElementById('photoRemoveBtn');
    const editBtn = document.getElementById('photoCropBtn');
    if(xBtn) xBtn.hidden = !url;
    if(editBtn){ editBtn.hidden = !url; editBtn.disabled = !url; }
    schedulePreviewUpdate();
    scheduleDraftSave();
  }
});
document.getElementById('photoRemoveBtn')?.addEventListener('click', ()=>{
  photoCtrl.clear();
  if(typeof showToast === 'function') showToast('Photo removed — choose a new file to retake.');
});

let signatureDataUrl = null;
const sigCtrl = wireImageControl({
  prefix:'sig', fileInputId:'signature', previewId:'sigPreview',
  onResult:(url)=>{
    signatureDataUrl = url;
    const xBtn = document.getElementById('sigRemoveBtn');
    if(xBtn) xBtn.hidden = !url;
    schedulePreviewUpdate();
    scheduleDraftSave();
  }
});
document.getElementById('sigRemoveBtn')?.addEventListener('click', ()=>{
  sigCtrl.clear();
  if(typeof showToast === 'function') showToast('Signature removed — upload again to retake.');
});

/* ========== Section wording suggestions (all sections) ========== */
function generateObjectiveSuggestions(data){
  const firstEdu = data.education[0];
  const degree = firstEdu ? firstEdu.degree : '';
  const institution = firstEdu ? firstEdu.institution : '';
  const degreeFull = [degree, institution].filter(Boolean).join(' from ');
  const skillsList = data.skills.slice(0,3).map(s=>s.text).filter(Boolean);
  const bio = (data.shortBio || '').trim();
  const role = (data.targetRole || '').trim();
  const suggestions = [];
  if(degreeFull || skillsList.length){
    let s = 'Motivated';
    s += degree ? ` graduate with ${articleFor(degree)} ${degreeFull}` : ' professional';
    if(skillsList.length) s += `${degree ? ' and' : ' with'} a strong foundation in ${joinList(skillsList)}`;
    s += role ? `, seeking to contribute as a ${role} in a growth-focused organization.` : ', seeking to contribute to a growth-focused organization.';
    suggestions.push(s);
  }
  if(skillsList.length){
    let s2 = `Detail-oriented individual skilled in ${joinList(skillsList)}, looking to apply these strengths`;
    s2 += role ? ` in a ${role} role` : ' in a challenging role';
    s2 += degree ? ` after completing ${articleFor(degree)} ${degreeFull}.` : '.';
    suggestions.push(s2);
  }
  if(bio){
    let s3 = bio;
    if(!/[.!?]$/.test(s3)) s3 += '.';
    s3 += role ? ` Looking forward to bringing these strengths to a ${role} position.` : ' Looking forward to contributing these strengths to a suitable role.';
    suggestions.push(s3);
  }
  if(suggestions.length === 0){
    suggestions.push('Motivated and detail-oriented fresh graduate seeking an entry-level opportunity to apply academic knowledge, learn quickly, and contribute to organizational goals.' + (role ? ` Interested in a ${role} position.` : ''));
    suggestions.push('Eager to begin a professional career where I can develop practical skills, work collaboratively, and grow with a forward-looking team.');
    suggestions.push('Hardworking recent graduate with a positive attitude, strong willingness to learn, and commitment to delivering quality work.');
  }
  return suggestions.slice(0,3);
}

/** Each item: { type:'text'|'entries'|'fill', label, apply() } shown as cards */
function getSectionSuggestions(sectionKey, data){
  const role = (data.targetRole || '').trim() || 'entry-level role';
  const degree = data.education[0]?.degree || '';
  const inst = data.education[0]?.institution || '';

  if(sectionKey === 'objective'){
    return generateObjectiveSuggestions(data).map(text => ({
      type: 'text', label: text, apply: () => { document.getElementById('objective').value = text; }
    }));
  }
  if(sectionKey === 'education'){
    return [{
      type: 'entries',
      label: 'Sample: Bachelor degree line (edit institution & result)',
      apply: () => {
        clearList('education');
        addEntry('education', { degree: degree || 'BSc in [Your Subject]', institution: inst || '[University Name]', result: 'CGPA 3.50 out of 4.00', year: '2024' });
        addEntry('education', { degree: 'HSC', institution: '[College Name]', result: 'GPA 4.80 out of 5.00', year: '2019' });
        addEntry('education', { degree: 'SSC', institution: '[School Name]', result: 'GPA 5.00 out of 5.00', year: '2017' });
      }
    },{
      type: 'entries',
      label: 'Sample: Masters + Bachelor only',
      apply: () => {
        clearList('education');
        addEntry('education', { degree: 'MS in [Subject]', institution: '[University]', result: 'CGPA 3.70 out of 4.00', year: '2025' });
        addEntry('education', { degree: 'BSc in [Subject]', institution: '[University]', result: 'CGPA 3.40 out of 4.00', year: '2023' });
      }
    }];
  }
  if(sectionKey === 'training'){
    const items = [
      'Completed a professional skills development workshop on communication and workplace readiness.',
      'Participated in a hands-on training program on basic data analysis and report writing.',
      'Attended a certificate course on Microsoft Office (Word, Excel, PowerPoint) organized by [Institute].',
      'Completed an online course on [Topic] with practical assignments and assessment.'
    ];
    return items.map(text => ({
      type: 'entries', label: text,
      apply: () => addEntry('training', { text })
    }));
  }
  if(sectionKey === 'skills'){
    const packs = [
      [{ text: 'Teamwork', level: 'Advanced' }, { text: 'Communication', level: 'Advanced' }, { text: 'Time management', level: 'Intermediate' }, { text: 'Problem solving', level: 'Intermediate' }],
      [{ text: 'Leadership', level: 'Intermediate' }, { text: 'Adaptability', level: 'Advanced' }, { text: 'Attention to detail', level: 'Advanced' }, { text: 'Critical thinking', level: 'Intermediate' }],
      [{ text: 'Research', level: 'Intermediate' }, { text: 'Presentation skills', level: 'Intermediate' }, { text: 'Customer service', level: 'Beginner' }]
    ];
    return packs.map((pack, i) => ({
      type: 'entries',
      label: pack.map(s => s.level ? `${s.text} (${s.level})` : s.text).join(' · '),
      apply: () => { clearList('skills'); pack.forEach(s => addEntry('skills', s)); }
    }));
  }
  if(sectionKey === 'experience'){
    return [{
      type: 'entries',
      label: 'Sample internship with responsibility bullets',
      apply: () => {
        clearList('experience');
        addEntry('experience', {
          position: 'Intern',
          duration: 'Jan 2024 – Mar 2024',
          company: '[Organization Name]',
          location: '[City]',
          description: 'Assisted the team with day-to-day operational tasks and documentation.\nPrepared reports and maintained organized records.\nSupported coordination of meetings and basic data entry.\nLearned workplace procedures and collaborated with senior staff.'
        });
      }
    },{
      type: 'entries',
      label: 'Sample: Research / academic assistant style',
      apply: () => {
        clearList('experience');
        addEntry('experience', {
          position: 'Research Assistant (Volunteer)',
          duration: '2023 – 2024',
          company: '[Department / Lab]',
          location: '[University]',
          description: 'Helped collect and organize research data.\nReviewed literature and summarized key findings.\nSupported preparation of presentations and simple analysis.'
        });
      }
    },{
      type: 'entries',
      label: 'No paid work yet — use campus / project experience',
      apply: () => {
        clearList('experience');
        addEntry('experience', {
          position: 'Project Member',
          duration: '2023',
          company: 'Academic project / student team',
          location: '[University]',
          description: 'Worked in a small team to plan and complete a course project on time.\nDivided tasks, documented progress, and presented results to faculty.\nImproved collaboration and problem-solving under deadlines.'
        });
      }
    }];
  }
  if(sectionKey === 'languages'){
    return [{
      type: 'entries',
      label: 'Bangla (Native) + English (Good working proficiency)',
      apply: () => {
        clearList('language');
        addEntry('language', { language: 'Bangla', proficiency: 'Native' });
        addEntry('language', { language: 'English', proficiency: 'Good working proficiency' });
      }
    },{
      type: 'entries',
      label: 'Bangla (Native) + English (Fluent) + Hindi (Basic)',
      apply: () => {
        clearList('language');
        addEntry('language', { language: 'Bangla', proficiency: 'Native' });
        addEntry('language', { language: 'English', proficiency: 'Fluent' });
        addEntry('language', { language: 'Hindi', proficiency: 'Basic' });
      }
    }];
  }
  if(sectionKey === 'itSkills'){
    const packs = [
      'Microsoft Word, Excel, PowerPoint\nGoogle Workspace (Docs, Sheets, Drive)\nEmail and internet research',
      'Microsoft Office Suite\nBasic data analysis in Excel\nCanva / basic presentation design',
      'Windows and common office software\nTyping and digital documentation\nVideo conferencing tools (Zoom, Google Meet)'
    ];
    return packs.map(text => ({
      type: 'text', label: text.replace(/\n/g, ' · '),
      apply: () => { document.getElementById('itSkills').value = text; }
    }));
  }
  if(sectionKey === 'activities'){
    const items = [
      'Active member of a student club; helped organize events and coordinate volunteers.',
      'Participated in university cultural / sports programs and team activities.',
      'Volunteered in community service initiatives (awareness campaigns, campus clean-up).',
      'Debating / public speaking practice through campus societies.'
    ];
    return items.map(text => ({
      type: 'entries', label: text,
      apply: () => addEntry('activity', { text })
    }));
  }
  if(sectionKey === 'custom'){
    return [{
      type: 'entries',
      label: 'Sample: Academic / personal project',
      apply: () => {
        addEntry('custom', {
          title: 'Projects',
          format: 'bullet',
          content: 'Course project: [Project title] — designed and documented a practical solution as part of academic coursework.\nTeam project: collaborated with peers to research, analyze, and present findings on [topic].'
        });
      }
    },{
      type: 'entries',
      label: 'Sample: Awards & achievements',
      apply: () => {
        addEntry('custom', {
          title: 'Awards and Achievements',
          format: 'bullet',
          content: 'Dean\'s list / merit scholarship (if applicable) — [Year].\nCertificate of appreciation for active participation in [event].'
        });
      }
    }];
  }
  if(sectionKey === 'personalInfo'){
    return [{
      type: 'fill',
      label: 'Set Nationality: Bangladeshi, Marital: Single + common extra fields',
      apply: () => {
        if(!val('nationality')) document.getElementById('nationality').value = 'Bangladeshi';
        if(!val('marital')) document.getElementById('marital').value = 'Single';
        clearList('extraInfo');
        addEntry('extraInfo', { label: 'Blood Group', value: '[e.g. O+]' });
        addEntry('extraInfo', { label: 'Religion', value: '[Optional]' });
        addEntry('extraInfo', { label: "Father's Name", value: '[Name]' });
        addEntry('extraInfo', { label: "Mother's Name", value: '[Name]' });
      }
    }];
  }
  if(sectionKey === 'references'){
    return [{
      type: 'fill',
      label: 'Use “References available upon request” (recommended for many freshers)',
      apply: () => {
        document.getElementById('refUponRequest').checked = true;
        document.getElementById('referenceWrap').style.display = 'none';
      }
    },{
      type: 'entries',
      label: 'Sample academic referee placeholders (replace with real contacts)',
      apply: () => {
        document.getElementById('refUponRequest').checked = false;
        document.getElementById('referenceWrap').style.display = '';
        clearList('reference');
        addEntry('reference', {
          name: '[Teacher / Supervisor Name]',
          designation: 'Associate Professor',
          organization: inst || '[University Name]',
          address: '[Department, City]',
          phone: '+880 1XXX XXXXXX',
          email: 'name@university.edu'
        });
        addEntry('reference', {
          name: '[Second Referee Name]',
          designation: 'Assistant Professor',
          organization: inst || '[University Name]',
          address: '[Department, City]',
          phone: '+880 1XXX XXXXXX',
          email: 'name2@university.edu'
        });
      }
    }];
  }
  return [];
}

function showSuggestions(sectionKey){
  const data = collectData();
  const items = getSectionSuggestions(sectionKey, data);
  const box = document.getElementById('suggest_' + sectionKey);
  if(!box) return;
  if(!items.length){
    box.innerHTML = '<p class="hint">No suggestions for this section.</p>';
    box.style.display = 'block';
    return;
  }
  box.innerHTML = items.map((it, i) =>
    `<div class="suggestion-card"><p>${esc(it.label)}</p><button type="button" class="add-btn use-suggestion" data-i="${i}">Use this</button></div>`
  ).join('') + `<p class="hint" style="margin-top:8px;">Rule-based wording from your inputs — edit after inserting. Not AI-generated.</p>`;
  box._items = items;
  box.style.display = 'block';
  box.querySelectorAll('.use-suggestion').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = box._items[parseInt(btn.dataset.i, 10)];
      if(item) item.apply();
      schedulePreviewUpdate();
      scheduleDraftSave();
      updateEmptyCollapse();
      if(typeof showToast === 'function') showToast('Suggestion applied — edit to match your real details.');
    });
  });
}

document.querySelectorAll('[data-suggest]').forEach(btn => {
  btn.addEventListener('click', () => showSuggestions(btn.dataset.suggest));
});

/** One-click fresher starter: fill empty sections with sensible defaults */
function applyStarterPack(){
  const data = collectData();
  // Objective
  if(!data.objective){
    const opts = generateObjectiveSuggestions(data);
    document.getElementById('objective').value = opts[0];
  }
  // Skills
  if(!data.skills.length){
    clearList('skills');
    ['Teamwork','Communication','Time management','Problem solving'].forEach((t,i) =>
      addEntry('skills', { text: t, level: i < 2 ? 'Advanced' : 'Intermediate' }));
  }
  // Training
  if(!data.training.length){
    clearList('training');
    addEntry('training', { text: 'Completed a professional skills / communication workshop (edit with real course name).' });
    addEntry('training', { text: 'Microsoft Office training — Word, Excel, and PowerPoint basics.' });
  }
  // Experience
  if(!data.experience.length){
    clearList('experience');
    addEntry('experience', {
      position: 'Intern / Project member',
      duration: '2024',
      company: '[Organization or university project]',
      location: '[City]',
      description: 'Supported day-to-day tasks and documentation.\nCollaborated with teammates to meet deadlines.\nPrepared simple reports and presentations.'
    });
  }
  // Languages
  if(!data.languages.length){
    clearList('language');
    addEntry('language', { language: 'Bangla', proficiency: 'Native' });
    addEntry('language', { language: 'English', proficiency: 'Good working proficiency' });
  }
  // IT
  if(!data.itSkills){
    document.getElementById('itSkills').value = 'Microsoft Word, Excel, PowerPoint\nGoogle Workspace (Docs, Sheets, Drive)\nEmail and internet research';
  }
  // Activities
  if(!data.activities.length){
    clearList('activity');
    addEntry('activity', { text: 'Participated in student club activities and campus events.' });
    addEntry('activity', { text: 'Volunteered in community or university service initiatives.' });
  }
  // Personal defaults
  if(!data.nationality) document.getElementById('nationality').value = 'Bangladeshi';
  if(!data.marital) document.getElementById('marital').value = 'Single';
  // References
  if(!data.refUponRequest && !data.references.some(r => r.name && !r.name.includes('['))){
    document.getElementById('refUponRequest').checked = true;
    document.getElementById('referenceWrap').style.display = 'none';
  }
  schedulePreviewUpdate();
  scheduleDraftSave();
  updateEmptyCollapse();
  if(typeof showToast === 'function') showToast('Starter content filled — replace [brackets] with your real details.');
}
document.getElementById('starterPackBtn')?.addEventListener('click', applyStarterPack);

/* ========== Collect / restore data ========== */
function collectEntries(kind, keys){
  const out = [];
  document.querySelectorAll(`.entry[data-kind="${kind}"]`).forEach(entry=>{
    const item = {};
    let hasAny = false;
    keys.forEach(k=>{
      const el = entry.querySelector(`[data-k="${k}"]`);
      const v = el ? el.value.trim() : '';
      item[k] = v;
      if(v && k !== 'format' && k !== 'level') hasAny = true;
      if(k === 'level' && v) hasAny = true;
    });
    if(hasAny) out.push(item);
  });
  return out;
}
function collectHeadings(){
  const h = {};
  HEADING_KEYS.forEach(k=>{ h[k] = val('heading_' + k) || k; });
  return h;
}
function collectData(){
  return {
    version: 1,
    formatting: {
      fontFamily: document.getElementById('fontFamily').value,
      textSize: document.getElementById('textSize').value,
      accentColor: document.getElementById('accentColor').value,
      pageSize: document.getElementById('pageSize')?.value || 'a4',
      pageMargin: document.getElementById('pageMargin')?.value || 'one',
      paraSpace: document.getElementById('paraSpace')?.value || 'normal',
      bulletIndent: document.getElementById('bulletIndent')?.value || 'medium',
      nameBold: document.getElementById('nameBold')?.checked !== false,
      jobTitleBold: document.getElementById('jobTitleBold')?.checked !== false,
      companyItalic: document.getElementById('companyItalic')?.checked !== false,
      headingBold: document.getElementById('headingBold')?.checked !== false,
      headingUpper: document.getElementById('headingUpper')?.checked !== false,
      headingUnderline: document.getElementById('headingUnderline')?.checked !== false,
      bodyAlign: document.getElementById('bodyAlign')?.value || 'left',
      headingAlign: document.getElementById('headingAlign')?.value || 'left',
      bulletStyle: document.getElementById('bulletStyle')?.value || 'disc'
    },
    template: (document.querySelector('input[name="template"]:checked') || {}).value || 'fresher',
    autoCollapseEmpty: document.getElementById('autoCollapseEmpty').checked,
    headings: collectHeadings(),
    sectionOrder: getSectionOrder(),
    hiddenSections: Array.from(sectionsContainer.children)
      .filter(el => el.classList.contains('is-hidden-from-cv'))
      .map(el => el.dataset.key),
    photo: photoDataUrl,
    signature: signatureDataUrl,
    fullName: val('fullName'),
    address: val('address'),
    mobile: val('mobile'),
    email: val('email'),
    objective: val('objective'),
    targetRole: val('targetRole'),
    shortBio: val('shortBio'),
    education: collectEntries('education', ['degree','institution','result','year']),
    training: collectEntries('training', ['text']),
    skills: collectEntries('skills', ['text','level']),
    experience: collectEntries('experience', ['position','duration','company','location','description']),
    languages: collectEntries('language', ['language','proficiency']),
    itSkills: val('itSkills'),
    activities: collectEntries('activity', ['text']),
    custom: collectEntries('custom', ['title','format','content']),
    dob: val('dob'),
    nationality: val('nationality'),
    marital: val('marital'),
    extraInfo: collectEntries('extraInfo', ['label','value']),
    refUponRequest: refCheckbox.checked,
    references: refCheckbox.checked ? [] : collectEntries('reference', ['name','designation','organization','address','phone','email']),
    includeDeclaration: !!(document.getElementById('includeDeclaration')?.checked),
    declarationText: (document.getElementById('declarationText')?.value || '').trim(),
    includeSignature: sigCheckbox.checked
  };
}

function clearList(kind){
  const list = document.getElementById(kind + 'List');
  if(list) list.innerHTML = '';
}

function applyData(data, { skipPhoto = false } = {}){
  if(!data) return;
  if(data.formatting){
    const f = data.formatting;
    if(f.fontFamily) document.getElementById('fontFamily').value = f.fontFamily;
    if(f.textSize) document.getElementById('textSize').value = f.textSize;
    if(f.accentColor) document.getElementById('accentColor').value = f.accentColor;
    const setSel = (id, v) => { const el = document.getElementById(id); if(el && v != null) el.value = v; };
    const setChk = (id, v) => { const el = document.getElementById(id); if(el && v != null) el.checked = !!v; };
    setSel('pageSize', f.pageSize);
    setSel('pageMargin', f.pageMargin);
    setSel('paraSpace', f.paraSpace);
    setSel('bulletIndent', f.bulletIndent);
    setChk('nameBold', f.nameBold);
    setChk('jobTitleBold', f.jobTitleBold);
    setChk('companyItalic', f.companyItalic);
    setChk('headingBold', f.headingBold);
    setChk('headingUpper', f.headingUpper);
    setChk('headingUnderline', f.headingUnderline);
    setSel('bodyAlign', f.bodyAlign);
    setSel('headingAlign', f.headingAlign);
    setSel('bulletStyle', f.bulletStyle);
  }
  if(data.template){
    const r = document.querySelector(`input[name="template"][value="${data.template}"]`);
    if(r) r.checked = true;
  }
  if(typeof data.autoCollapseEmpty === 'boolean') document.getElementById('autoCollapseEmpty').checked = data.autoCollapseEmpty;
  if(data.headings) applyHeadings(data.headings);
  if(data.sectionOrder || data.hiddenSections){
    const full = [];
    (data.sectionOrder || []).forEach(k => { if(!full.includes(k)) full.push(k); });
    (data.hiddenSections || []).forEach(k => { if(!full.includes(k)) full.push(k); });
    // keep any missing keys from DOM at end
    getAllSectionKeys().forEach(k => { if(!full.includes(k)) full.push(k); });
    if(full.length) applyTemplateOrder(full);
  }
  // clear then re-hide
  sectionsContainer.querySelectorAll('.section').forEach(el => {
    el.classList.remove('is-hidden-from-cv');
    delete el.dataset.hiddenFromCv;
  });
  (data.hiddenSections || []).forEach(key => {
    const el = sectionsContainer.querySelector(`[data-key="${key}"]`);
    if(el){ el.classList.add('is-hidden-from-cv'); el.dataset.hiddenFromCv = '1'; }
  });
  refreshHiddenSectionsBar();

  ['fullName','address','mobile','email','objective','targetRole','shortBio','itSkills','nationality','marital','dob'].forEach(id=>{
    if(data[id] !== undefined){
      const el = document.getElementById(id);
      if(el) el.value = data[id] || '';
    }
  });

  refCheckbox.checked = !!data.refUponRequest;
  refWrap.style.display = refCheckbox.checked ? 'none' : '';
  sigCheckbox.checked = data.includeSignature !== false;
  sigWrap.style.display = sigCheckbox.checked ? '' : 'none';
  const declCb = document.getElementById('includeDeclaration');
  const declW = document.getElementById('declarationWrap');
  const declT = document.getElementById('declarationText');
  if(declCb){
    declCb.checked = data.includeDeclaration !== false;
    if(declW) declW.style.display = declCb.checked ? '' : 'none';
  }
  if(declT && data.declarationText != null) declT.value = data.declarationText;


  const entryMaps = {
    education: ['degree','institution','result','year'],
    training: ['text'],
    skills: ['text','level'],
    experience: ['position','duration','company','location','description'],
    language: ['language','proficiency'],
    activity: ['text'],
    reference: ['name','designation','organization','address','phone','email'],
    custom: ['title','format','content'],
    extraInfo: ['label','value']
  };
  // map collect key -> list kind
  const listKinds = {
    education: 'education', training: 'training', skills: 'skills', experience: 'experience',
    languages: 'language', activities: 'activity', references: 'reference', custom: 'custom', extraInfo: 'extraInfo'
  };
  Object.keys(listKinds).forEach(dataKey=>{
    const kind = listKinds[dataKey];
    clearList(kind);
    const arr = data[dataKey] || [];
    if(arr.length === 0 && ['education','training','skills','experience','language','activity','reference'].includes(kind)){
      addEntry(kind);
      if(kind === 'reference') addEntry(kind);
    } else {
      arr.forEach(item => addEntry(kind, item));
    }
  });

  if(!skipPhoto){
    if(data.photo){ photoDataUrl = data.photo; photoCtrl.setOriginal(data.photo); document.getElementById('photoPreview').src = data.photo; }
    if(data.signature){ signatureDataUrl = data.signature; sigCtrl.setOriginal(data.signature); document.getElementById('sigPreview').src = data.signature; }
  }

  renumberSections();
  updateMoveButtonsState();
  schedulePreviewUpdate();
  updateEmptyCollapse();
}

/* ========== localStorage draft ========== */
let draftTimer = null;
function scheduleDraftSave(){
  clearTimeout(draftTimer);
  draftTimer = setTimeout(saveDraft, DRAFT_SAVE_MS);
}
function saveDraft(){
  try{
    const data = collectData();
    localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
    const el = document.getElementById('draftStatus');
    if(el) el.innerHTML = 'Draft saved <strong>locally</strong> · ' + new Date().toLocaleTimeString();
  }catch(e){
    console.warn('Draft save failed', e);
  }
}
function loadDraft(){
  try{
    const raw = localStorage.getItem(DRAFT_KEY);
    if(!raw) return false;
    const data = JSON.parse(raw);
    applyData(data);
    document.getElementById('draftStatus').innerHTML = 'Restored <strong>saved draft</strong> from this browser.';
    return true;
  }catch(e){
    console.warn('Draft load failed', e);
    return false;
  }
}
function clearDraft(){
  localStorage.removeItem(DRAFT_KEY);
  document.getElementById('draftStatus').textContent = 'Draft cleared. Form unchanged until you edit.';
}
document.getElementById('clearDraftBtn').addEventListener('click', ()=>{
  if(confirm('Clear the saved draft from this browser? The form on screen stays until you reload.')) clearDraft();
});

/* ========== JSON export / import ========== */
document.getElementById('exportJsonBtn').addEventListener('click', ()=>{
  const data = collectData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = slugFileName(data.fullName).replace(/\.docx$/, '') + '_cv_data.json';
  document.body.appendChild(a); a.click(); a.remove();
});
document.getElementById('importJsonInput').addEventListener('change', (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    try{
      const data = JSON.parse(reader.result);
      applyData(data);
      saveDraft();
      document.getElementById('status').textContent = 'JSON imported.';
      document.getElementById('status').className = 'status ok';
    }catch(err){
      document.getElementById('status').textContent = 'Could not parse JSON file.';
      document.getElementById('status').className = 'status err';
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});

/* ========== DOCX ========== */
/* Half-points for docx: 22 = 11 pt, 24 = 12 pt */
const SIZE_MAP = {
  pt10: { name: 26, heading: 20, body: 20 },  // 10 pt body
  pt11: { name: 28, heading: 22, body: 22 },  // 11 pt — Calibri professional standard
  pt12: { name: 32, heading: 24, body: 24 },  // 12 pt — Times academic standard
  // legacy aliases from older drafts
  compact: { name: 26, heading: 20, body: 20 },
  standard: { name: 28, heading: 22, body: 22 },
  comfortable: { name: 32, heading: 24, body: 24 }
};
const PRINT_PX = {
  pt10: { name: 18, heading: 11.5, body: 10 },
  pt11: { name: 20, heading: 12.5, body: 11 },
  pt12: { name: 22, heading: 13.5, body: 12 },
  compact: { name: 18, heading: 11.5, body: 10 },
  standard: { name: 20, heading: 12.5, body: 11 },
  comfortable: { name: 22, heading: 13.5, body: 12 }
};
/* Page size in twips (1 inch = 1440, 1 mm ≈ 56.7) */
const PAGE_SIZE_TWIP = {
  a4:     { width: 11906, height: 16838 },  // 210×297 mm
  letter: { width: 12240, height: 15840 }   // 8.5×11 in
};
/* Standard formal margins: 0.5 in and 1 in */
const MARGIN_TWIP = {
  half: 720,   // 0.5 inch
  one: 1440,   // 1 inch
  // legacy
  narrow: 720,
  normal: 1440,
  wide: 1440
};
const MARGIN_IN = { half: 0.5, one: 1, narrow: 0.5, normal: 1, wide: 1 };
const MARGIN_MM = { half: 12.7, one: 25.4, narrow: 12.7, normal: 25.4, wide: 25.4 };
const PARA_SPACE = {
  tight:   { before: 90,  afterHead: 40, afterBody: 16, afterPlain: 20, lineH: 1.25 },
  normal:  { before: 140, afterHead: 60, afterBody: 24, afterPlain: 36, lineH: 1.35 },
  relaxed: { before: 200, afterHead: 80, afterBody: 40, afterPlain: 52, lineH: 1.5 }
};
const INDENT_IN = { small: 0.18, medium: 0.28, large: 0.4 };

const NUMBERING_REF = 'bullets';
let THEME = null;

function buildTheme(formatting){
  const para = PARA_SPACE[formatting.paraSpace] || PARA_SPACE.normal;
  const indentIn = INDENT_IN[formatting.bulletIndent] || INDENT_IN.medium;
  const marginKey = formatting.pageMargin || 'one';
  const pageKey = formatting.pageSize || 'a4';
  return {
    font: formatting.fontFamily,
    color: (formatting.accentColor || '#1c4532').replace('#','').toUpperCase(),
    sizes: SIZE_MAP[formatting.textSize] || SIZE_MAP.pt11,
    para,
    indentIn,
    pageSize: PAGE_SIZE_TWIP[pageKey] || PAGE_SIZE_TWIP.a4,
    pageSizeKey: pageKey,
    marginTwip: MARGIN_TWIP[marginKey] || MARGIN_TWIP.one,
    marginIn: MARGIN_IN[marginKey] || 1,
    marginMm: MARGIN_MM[marginKey] || 25.4,
    nameBold: formatting.nameBold !== false,
    jobTitleBold: formatting.jobTitleBold !== false,
    companyItalic: formatting.companyItalic !== false,
    headingBold: formatting.headingBold !== false,
    headingUpper: formatting.headingUpper !== false,
    headingUnderline: formatting.headingUnderline !== false,
    bodyAlign: formatting.bodyAlign || 'left',
    headingAlign: formatting.headingAlign || 'left',
    bulletStyle: formatting.bulletStyle || 'disc'
  };
}

function heading(text){
  const { Paragraph, TextRun, BorderStyle } = docx;
  const label = THEME.headingUpper ? String(text).toUpperCase() : String(text);
  const border = THEME.headingUnderline
    ? { bottom: { style: BorderStyle.SINGLE, size: 4, color: THEME.color, space: 1 } }
    : undefined;
  const headAlign = THEME.headingAlign === 'center' ? docx.AlignmentType.CENTER : docx.AlignmentType.LEFT;
  return new Paragraph({
    spacing: { before: THEME.para.before, after: THEME.para.afterHead },
    border,
    alignment: headAlign,
    children: [ new TextRun({
      text: label,
      bold: THEME.headingBold,
      size: THEME.sizes.heading,
      color: THEME.color,
      font: THEME.font
    }) ]
  });
}
function bullet(text, opts={}){
  const { Paragraph, TextRun } = docx;
  const style = THEME.bulletStyle || 'disc';
  if(style === 'none'){
    return new Paragraph({
      spacing: { after: THEME.para.afterBody },
      indent: { left: docx.convertInchesToTwip(THEME.indentIn) },
      children: [ new TextRun({
        text,
        size: THEME.sizes.body,
        bold: !!opts.bold,
        italics: !!opts.italics,
        font: THEME.font
      }) ]
    });
  }
  return new Paragraph({
    numbering: { reference: NUMBERING_REF, level: 0 },
    spacing: { after: THEME.para.afterBody },
    children: [ new TextRun({
      text,
      size: THEME.sizes.body,
      bold: !!opts.bold,
      italics: !!opts.italics,
      font: THEME.font
    }) ]
  });
}
function bodyAlignType(){
  const a = THEME.bodyAlign || 'left';
  if(a === 'center') return docx.AlignmentType.CENTER;
  if(a === 'justify') return docx.AlignmentType.BOTH;
  return docx.AlignmentType.LEFT;
}
function plain(text, opts={}){
  const { Paragraph, TextRun } = docx;
  const after = opts.after !== undefined ? opts.after : THEME.para.afterPlain;
  return new Paragraph({
    spacing: { after },
    alignment: opts.align !== undefined ? opts.align : bodyAlignType(),
    children: [ new TextRun({
      text,
      size: opts.size || THEME.sizes.body,
      bold: !!opts.bold,
      italics: !!opts.italics,
      font: THEME.font
    }) ]
  });
}
async function dataUrlToImage(dataUrl, box){
  const res = await fetch(dataUrl);
  const buf = await res.arrayBuffer();
  return new docx.ImageRun({ data: buf, transformation: box, type: dataUrl.includes('image/png') ? 'png' : 'jpg' });
}

const DOCX_SECTION_RENDERERS = {
  objective: (data, push) => {
    if(!data.objective) return;
    push(heading(data.headings.objective));
    push(plain(data.objective));
  },
  education: (data, push) => {
    if(!data.education.length) return;
    push(heading(data.headings.education));
    data.education.forEach(e=>{
      push(bullet([e.degree, e.institution, e.result, e.year].filter(Boolean).join(', ')));
    });
  },
  training: (data, push) => {
    if(!data.training.length) return;
    push(heading(data.headings.training));
    data.training.forEach(t=> push(bullet(t.text)));
  },
  skills: (data, push) => {
    if(!data.skills.length) return;
    push(heading(data.headings.skills));
    data.skills.forEach(s=>{
      const line = s.level ? `${s.text} (${s.level})` : s.text;
      push(bullet(line));
    });
  },
  experience: (data, push) => {
    if(!data.experience.length) return;
    push(heading(data.headings.experience));
    data.experience.forEach(w=>{
      const titleLine = [w.position, w.duration].filter(Boolean).join('   —   ');
      if(titleLine) push(plain(titleLine, { bold: THEME.jobTitleBold, after: Math.round(THEME.para.afterPlain * 0.55) }));
      const companyLine = [w.company, w.location].filter(Boolean).join(', ');
      if(companyLine) push(plain(companyLine, { italics: THEME.companyItalic, after: THEME.para.afterBody }));
      if(w.description) w.description.split('\n').map(s=>s.trim()).filter(Boolean).forEach(line=> push(bullet(line)));
    });
  },
  languages: (data, push) => {
    if(!data.languages.length) return;
    push(heading(data.headings.languages));
    data.languages.forEach(l=> push(bullet([l.language, l.proficiency].filter(Boolean).join(' — '))));
  },
  itSkills: (data, push) => {
    if(!data.itSkills) return;
    push(heading(data.headings.itSkills));
    data.itSkills.split('\n').map(s=>s.trim()).filter(Boolean).forEach(line=> push(bullet(line)));
  },
  activities: (data, push) => {
    if(!data.activities.length) return;
    push(heading(data.headings.activities));
    data.activities.forEach(a=> push(bullet(a.text)));
  },
  custom: (data, push) => {
    data.custom.forEach(c=>{
      if(!c.title && !c.content) return;
      push(heading(c.title || 'Additional Information'));
      if(c.format === 'paragraph') push(plain(c.content));
      else (c.content || '').split('\n').map(s=>s.trim()).filter(Boolean).forEach(line=> push(bullet(line)));
    });
  },
  personalInfo: (data, push) => {
    const hasFixed = data.dob || data.nationality || data.marital;
    if(!hasFixed && !data.extraInfo.length) return;
    push(heading(data.headings.personalInfo));
    if(data.dob) push(plain('Date of Birth: ' + formatDate(data.dob)));
    if(data.nationality) push(plain('Nationality: ' + data.nationality));
    if(data.marital) push(plain('Marital Status: ' + data.marital));
    data.extraInfo.forEach(f=>{
      if(f.label || f.value) push(plain([f.label, f.value].filter(Boolean).join(': ')));
    });
  },
  references: (data, push) => {
    if(data.refUponRequest){
      push(heading(data.headings.references));
      push(plain('Available upon request.'));
      return;
    }
    if(!data.references.length) return;
    push(heading(data.headings.references));
    data.references.forEach((r,i)=>{
      if(r.name) push(plain(r.name, {bold:true, after:20}));
      if(r.designation) push(plain(r.designation, {after:20}));
      if(r.organization) push(plain(r.organization, {after:20}));
      if(r.address) push(plain(r.address, {after:20}));
      if(r.phone) push(plain('Phone: ' + r.phone, {after:20}));
      if(r.email) push(plain('Email: ' + r.email, {after:20}));
      if(i < data.references.length-1) push(plain('', {after:48}));
    });
  }
};

async function buildDocx(data){
  if(typeof docx === 'undefined'){
    throw new Error('Word library failed to load. Check that lib/docx.umd.js is present, then reload.');
  }
  THEME = buildTheme(data.formatting);
  const children = [];
  const push = (p) => children.push(p);

  // Header: contact left, photo top-right
  const headerParas = [];
  if(data.fullName) headerParas.push(plain(data.fullName, { bold: THEME.nameBold, size: THEME.sizes.name, after: Math.round(THEME.para.afterPlain * 1.1) }));
  if(data.address) headerParas.push(plain('Address: ' + data.address, { after:30 }));
  if(data.mobile) headerParas.push(plain('Mobile: ' + data.mobile, { after:30 }));
  if(data.email) headerParas.push(plain('Email: ' + data.email, { after:30 }));
  if(headerParas.length === 0) headerParas.push(new docx.Paragraph({ children: [] }));

  if(data.photo){
    try{
      const img = await dataUrlToImage(data.photo, { width: 92, height: 118 });
      const noBorder = {
        top: { style: docx.BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        bottom: { style: docx.BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        left: { style: docx.BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        right: { style: docx.BorderStyle.NONE, size: 0, color: 'FFFFFF' }
      };
      children.push(new docx.Table({
        width: { size: 100, type: docx.WidthType.PERCENTAGE },
        columnWidths: [7500, 2000],
        rows: [
          new docx.TableRow({
            children: [
              new docx.TableCell({
                width: { size: 7500, type: docx.WidthType.DXA },
                borders: noBorder,
                children: headerParas
              }),
              new docx.TableCell({
                width: { size: 2000, type: docx.WidthType.DXA },
                borders: noBorder,
                verticalAlign: docx.VerticalAlign.TOP,
                children: [
                  new docx.Paragraph({
                    alignment: docx.AlignmentType.RIGHT,
                    children: [img],
                    spacing: { after: 60 }
                  })
                ]
              })
            ]
          })
        ]
      }));
    }catch(e){
      headerParas.forEach(push);
    }
  } else {
    headerParas.forEach(push);
  }

  data.sectionOrder.forEach(key=>{
    const renderer = DOCX_SECTION_RENDERERS[key];
    if(renderer) renderer(data, push);
  });

  // Declaration (formal) then signature — left-aligned
  if(data.includeDeclaration && data.declarationText){
    push(new docx.Paragraph({
      spacing: { before: 240, after: 80 },
      children: [ new docx.TextRun({
        text: data.declarationText,
        size: THEME.sizes.body,
        font: THEME.font
      }) ]
    }));
  }
  if(data.includeSignature && (data.fullName || data.signature)){
    if(data.signature){
      try{
        const img = await dataUrlToImage(data.signature, { width: 120, height: 48 });
        push(new docx.Paragraph({
          alignment: docx.AlignmentType.LEFT,
          children: [img],
          spacing: { before: data.includeDeclaration && data.declarationText ? 120 : 240, after: 40 }
        }));
      }catch(e){}
    }
    if(data.fullName){
      push(new docx.Paragraph({
        alignment: docx.AlignmentType.LEFT,
        spacing: { before: data.signature ? 0 : (data.includeDeclaration && data.declarationText ? 120 : 240), after: 0 },
        children: [ new docx.TextRun({ text: '(' + data.fullName + ')', size: THEME.sizes.body, font: THEME.font }) ]
      }));
    }
  }

  // Avoid trailing empty content that can force a second blank page
  const doc = new docx.Document({
    numbering: {
      config: [{
        reference: NUMBERING_REF,
        levels: [{ level: 0, format: docx.LevelFormat.BULLET, text: (THEME.bulletStyle === 'dash' ? '–' : '•'), alignment: docx.AlignmentType.LEFT,
          style: { paragraph: { indent: {
            left: docx.convertInchesToTwip(THEME.indentIn),
            hanging: docx.convertInchesToTwip(Math.min(0.2, THEME.indentIn * 0.6))
          } } } }]
      }]
    },
    sections: [{
      properties: {
        page: {
          size: { width: THEME.pageSize.width, height: THEME.pageSize.height },
          margin: {
            top: THEME.marginTwip,
            bottom: THEME.marginTwip,
            left: THEME.marginTwip,
            right: THEME.marginTwip
          }
        }
      },
      children
    }]
  });
  return docx.Packer.toBlob(doc);
}

/* ========== Live preview ========== */
function buildPrintHTML(data){
  const theme = buildTheme(data.formatting);
  const px = PRINT_PX[data.formatting.textSize] || PRINT_PX.standard;
  const font = theme.font;
  const color = '#' + theme.color;
  const pad = theme.marginMm;
  const lh = theme.para.lineH;
  const headWeight = theme.headingBold ? 700 : 400;
  const headTransform = theme.headingUpper ? 'uppercase' : 'none';
  const headBorder = theme.headingUnderline ? `border-bottom:1.5px solid ${color};padding-bottom:3px;` : '';
  const headMargin = `${Math.round(theme.para.before / 20)}px 0 ${Math.round(theme.para.afterHead / 20)}px`;
  const indentPx = Math.round(theme.indentIn * 96);
  const headAlignCss = theme.headingAlign === 'center' ? 'text-align:center;' : 'text-align:left;';
  const bodyAlignCss = theme.bodyAlign === 'center' ? 'text-align:center;' : (theme.bodyAlign === 'justify' ? 'text-align:justify;' : 'text-align:left;');
  const bulletChar = theme.bulletStyle === 'dash' ? '–' : (theme.bulletStyle === 'none' ? '' : '•');
  const sectionHeading = (title) => `<div style="font-weight:${headWeight};text-transform:${headTransform};font-size:${px.heading}pt;color:${color};${headBorder}margin:${headMargin};${headAlignCss}">${esc(title)}</div>`;
  const bulletLine = (text) => {
    const prefix = bulletChar ? `${bulletChar}&nbsp; ` : '';
    return `<div style="margin:0 0 ${Math.max(2, theme.para.afterBody / 12)}px 0;padding-left:${indentPx}px;${bodyAlignCss}">${prefix}${esc(text)}</div>`;
  };
  const bodyBlock = (text) => `<div style="${bodyAlignCss}">${esc(text)}</div>`;

  const PRINT_RENDERERS = {
    objective: (d) => !d.objective ? '' : sectionHeading(d.headings.objective) + bodyBlock(d.objective),
    education: (d) => !d.education.length ? '' : sectionHeading(d.headings.education) + d.education.map(e=>bulletLine([e.degree,e.institution,e.result,e.year].filter(Boolean).join(', '))).join(''),
    training: (d) => !d.training.length ? '' : sectionHeading(d.headings.training) + d.training.map(t=>bulletLine(t.text)).join(''),
    skills: (d) => !d.skills.length ? '' : sectionHeading(d.headings.skills) + d.skills.map(s=>bulletLine(s.level ? `${s.text} (${s.level})` : s.text)).join(''),
    experience: (d) => {
      if(!d.experience.length) return '';
      let h = sectionHeading(d.headings.experience);
      d.experience.forEach(w=>{
        const titleLine = [w.position, w.duration].filter(Boolean).map(esc).join('&nbsp;&nbsp;—&nbsp;&nbsp;');
        if(titleLine) h += `<div style="font-weight:${theme.jobTitleBold ? 700 : 400};margin-top:6px;">${titleLine}</div>`;
        const companyLine = [w.company, w.location].filter(Boolean).map(esc).join(', ');
        if(companyLine) h += `<div style="font-style:${theme.companyItalic ? 'italic' : 'normal'};margin-bottom:4px;">${companyLine}</div>`;
        if(w.description) w.description.split('\n').map(s=>s.trim()).filter(Boolean).forEach(line=> h += bulletLine(line));
      });
      return h;
    },
    languages: (d) => !d.languages.length ? '' : sectionHeading(d.headings.languages) + d.languages.map(l=>bulletLine([l.language,l.proficiency].filter(Boolean).join(' — '))).join(''),
    itSkills: (d) => !d.itSkills ? '' : sectionHeading(d.headings.itSkills) + d.itSkills.split('\n').map(s=>s.trim()).filter(Boolean).map(bulletLine).join(''),
    activities: (d) => !d.activities.length ? '' : sectionHeading(d.headings.activities) + d.activities.map(a=>bulletLine(a.text)).join(''),
    custom: (d) => {
      let h = '';
      d.custom.forEach(c=>{
        if(!c.title && !c.content) return;
        h += sectionHeading(c.title || 'Additional Information');
        if(c.format === 'paragraph') h += `<div>${esc(c.content)}</div>`;
        else (c.content||'').split('\n').map(s=>s.trim()).filter(Boolean).forEach(line=> h += bulletLine(line));
      });
      return h;
    },
    personalInfo: (d) => {
      if(!(d.dob || d.nationality || d.marital || d.extraInfo.length)) return '';
      let h = sectionHeading(d.headings.personalInfo);
      if(d.dob) h += `<div>Date of Birth: ${esc(formatDate(d.dob))}</div>`;
      if(d.nationality) h += `<div>Nationality: ${esc(d.nationality)}</div>`;
      if(d.marital) h += `<div>Marital Status: ${esc(d.marital)}</div>`;
      d.extraInfo.forEach(f=>{ if(f.label || f.value) h += `<div>${esc([f.label,f.value].filter(Boolean).join(': '))}</div>`; });
      return h;
    },
    references: (d) => {
      if(d.refUponRequest) return sectionHeading(d.headings.references) + `<div>Available upon request.</div>`;
      if(!d.references.length) return '';
      let h = sectionHeading(d.headings.references);
      d.references.forEach(r=>{
        if(r.name) h += `<div style="font-weight:700;">${esc(r.name)}</div>`;
        if(r.designation) h += `<div>${esc(r.designation)}</div>`;
        if(r.organization) h += `<div>${esc(r.organization)}</div>`;
        if(r.address) h += `<div>${esc(r.address)}</div>`;
        if(r.phone) h += `<div>Phone: ${esc(r.phone)}</div>`;
        if(r.email) h += `<div>Email: ${esc(r.email)}</div>`;
        h += `<div style="height:8px;"></div>`;
      });
      return h;
    }
  };

  let h = `<div style="font-family:'${font}',sans-serif;color:#111;max-width:100%;margin:0;padding:0;font-size:${px.body}pt;line-height:${lh};">`;
  {
    let contact = '';
    if(data.fullName) contact += `<div style="font-weight:${theme.nameBold ? 700 : 400};font-size:${px.name}pt;margin-bottom:4px;">${esc(data.fullName)}</div>`;
    if(data.address) contact += `<div>Address: ${esc(data.address)}</div>`;
    if(data.mobile) contact += `<div>Mobile: ${esc(data.mobile)}</div>`;
    if(data.email) contact += `<div>Email: ${esc(data.email)}</div>`;
    if(data.photo){
      h += `<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:10px;">`;
      h += `<div style="flex:1;min-width:0;">${contact}</div>`;
      h += `<img src="${data.photo}" style="width:92px;height:118px;object-fit:cover;flex-shrink:0;border-radius:2px;" alt="">`;
      h += `</div>`;
    } else {
      h += contact ? contact + `<div style="margin-bottom:6px;"></div>` : '';
    }
  }

  const sectionsHtml = data.sectionOrder.map(key => (PRINT_RENDERERS[key] ? PRINT_RENDERERS[key](data) : '')).join('');
  if(!data.photo && !data.fullName && !data.address && !data.mobile && !data.email && !sectionsHtml.trim()){
    h += `<div style="color:#999;font-style:italic;">Start filling in the form to see your CV take shape here…</div>`;
  } else h += sectionsHtml;

  if(data.includeDeclaration && data.declarationText){
    h += `<div style="margin-top:18px;">${esc(data.declarationText)}</div>`;
  }
  if(data.includeSignature && (data.fullName || data.signature)){
    h += `<div style="margin-top:14px;text-align:left;">`;
    if(data.signature) h += `<img src="${data.signature}" style="width:130px;height:55px;object-fit:contain;display:block;">`;
    if(data.fullName) h += `<div>(${esc(data.fullName)})</div>`;
    h += `</div>`;
  }
  h += `</div>`;
  return h;
}

function schedulePreviewUpdate(){
  clearTimeout(previewTimer);
  previewTimer = setTimeout(()=>{
    renderPreview();
    updateEmptyCollapse();
  }, 180);
}
function renderPreview(){
  document.getElementById('livePreview').innerHTML = buildPrintHTML(collectData());
}

const cvForm = document.getElementById('cvForm');
cvForm.addEventListener('input', ()=>{ schedulePreviewUpdate(); scheduleDraftSave(); });
cvForm.addEventListener('change', ()=>{ schedulePreviewUpdate(); scheduleDraftSave(); });

/* ========== Init ========== */
wireHeadingEditors();
wireSectionHideButtons();
refreshHiddenSectionsBar();

const hadDraft = loadDraft();
if(!hadDraft){
  ['education','training','skills','experience','language','activity','reference'].forEach(k=> addEntry(k));
  addEntry('reference');
  applyTemplate('fresher');
}
renderPreview();
updateEmptyCollapse();

cvForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  await downloadOrShareDocx({ share: false });
});


/* ========== Clean print window (device print queue / Save as PDF) ========== */
function openDevicePrint({ preferPdfHint } = {}){
  renderPreview();
  const data = collectData();
  const bodyHtml = buildPrintHTML(data);
  const w = window.open('', '_blank', 'noopener,noreferrer');
  if(!w){
    if(typeof showToast === 'function') showToast('Allow pop-ups for Print / PDF.');
    return;
  }
  const th = buildTheme(data.formatting);
  const mm = th.marginMm || 25.4;
  const pageCss = th.pageSizeKey === 'letter' ? 'letter' : 'A4';
  const title = esc(data.fullName || 'CV');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<style>
  @page { size: ${pageCss}; margin: ${mm}mm; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
</style></head><body>${bodyHtml}</body></html>`);
  w.document.close();
  setTimeout(() => {
    try {
      w.focus();
      w.print(); // device print dialog — user can choose printer or "Save as PDF"
    } catch(e) {}
  }, 280);
  const status = document.getElementById('status');
  if(status){
    status.textContent = preferPdfHint
      ? 'Print dialog open — choose “Save as PDF” to download a PDF.'
      : 'Print dialog open — pick a printer or Save as PDF.';
    status.className = 'status ok';
  }
}

document.getElementById('printBtn')?.addEventListener('click', ()=> openDevicePrint({ preferPdfHint: false }));
document.getElementById('downloadPdfBtn')?.addEventListener('click', ()=> openDevicePrint({ preferPdfHint: true }));

/* ========== Download Word (Save As) / Share (system sheet) ========== */
async function buildDocxBlob(){
  const data = collectData();
  const blob = await buildDocx(data);
  return { blob, data, filename: slugFileName(data.fullName) };
}

function triggerSaveAs(blob, filename){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=> URL.revokeObjectURL(url), 4000);
}

async function downloadOrShareDocx({ share }){
  const btn = document.getElementById(share ? 'shareDocxBtn' : 'generateBtn');
  const status = document.getElementById('status');
  if(btn) btn.disabled = true;
  if(status){ status.textContent = share ? 'Preparing share…' : 'Building Word file…'; status.className = 'status'; }
  try{
    const { blob, data, filename } = await buildDocxBlob();
    const mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if(share){
      const file = new File([blob], filename, { type: mime });
      // 1) System share sheet with file
      if(navigator.share && navigator.canShare && navigator.canShare({ files: [file] })){
        try{
          await navigator.share({ files: [file], title: (data.fullName || 'CV') + ' — CV', text: 'CV' });
          if(status){ status.textContent = 'Shared via device.'; status.className = 'status ok'; }
          return;
        }catch(e){
          if(e && e.name === 'AbortError'){
            if(status){ status.textContent = 'Share cancelled.'; status.className = 'status'; }
            return;
          }
        }
      }
      // 2) Fallback: try ClipboardItem file (limited support)
      try{
        if(navigator.clipboard && window.ClipboardItem){
          await navigator.clipboard.write([new ClipboardItem({ [mime]: blob })]);
          if(status){ status.textContent = 'Copied file to clipboard (if supported).'; status.className = 'status ok'; }
          if(typeof showToast === 'function') showToast('Copied — paste where supported, or use Download Word.');
          return;
        }
      }catch(e){ /* clipboard file not supported */ }
      // 3) Final fallback: Save As download
      triggerSaveAs(blob, filename);
      if(status){ status.textContent = 'Share unavailable — file downloaded instead.'; status.className = 'status ok'; }
      if(typeof showToast === 'function') showToast('Opened Save As — share the downloaded file.');
      return;
    }
    // Download Word → browser Save As
    triggerSaveAs(blob, filename);
    if(status){ status.textContent = 'Save As opened for Word (.docx).'; status.className = 'status ok'; }
  }catch(err){
    console.error(err);
    if(status){
      status.textContent = err && err.message ? err.message : 'Could not build the file.';
      status.className = 'status err';
    }
  }finally{
    if(btn) btn.disabled = false;
  }
}

document.getElementById('shareDocxBtn')?.addEventListener('click', ()=> downloadOrShareDocx({ share: true }));

/* Mobile / optional preview */
(function wirePreviewToggle(){
  const col = document.getElementById('previewCol');
  const openBtn = document.getElementById('togglePreviewBtn');
  const closeBtn = document.getElementById('closePreviewBtn');
  function setOpen(on){
    if(!col) return;
    col.classList.toggle('is-open', on);
    if(on){
      renderPreview();
      col.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
  openBtn?.addEventListener('click', ()=> setOpen(!col.classList.contains('is-open')));
  closeBtn?.addEventListener('click', ()=> setOpen(false));
})();


/* ========== PWA install + toast ========== */
function showToast(msg, ms = 2800){
  const t = document.getElementById('toast');
  if(!t) return;
  t.textContent = msg;
  t.hidden = false;
  requestAnimationFrame(() => t.classList.add('show'));
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => { t.hidden = true; }, 280);
  }, ms);
}

let deferredInstallPrompt = null;
const installBtn = document.getElementById('installBtn');
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  if(installBtn) installBtn.hidden = false;
});
window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  if(installBtn) installBtn.hidden = true;
  showToast('CV Builder installed — open it from your home screen anytime.');
});
if(installBtn){
  installBtn.addEventListener('click', async () => {
    if(!deferredInstallPrompt){
      showToast('On iPhone: Share → Add to Home Screen. On desktop: use the install icon in the address bar.');
      return;
    }
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installBtn.hidden = true;
    if(outcome === 'accepted') showToast('Installing…');
  });
}

/* Standalone mode: hide install if already installed */
if(window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone){
  if(installBtn) installBtn.hidden = true;
}

/* Suggest formal body size when font changes */
document.getElementById('fontFamily')?.addEventListener('change', (e)=>{
  const sizeEl = document.getElementById('textSize');
  if(!sizeEl) return;
  if(e.target.value === 'Times New Roman' && (sizeEl.value === 'pt11' || sizeEl.value === 'standard')){
    sizeEl.value = 'pt12';
  } else if(e.target.value === 'Calibri' && (sizeEl.value === 'pt12' || sizeEl.value === 'comfortable')){
    sizeEl.value = 'pt11';
  }
  schedulePreviewUpdate();
  scheduleDraftSave();
});
