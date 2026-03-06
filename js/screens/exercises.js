// ========================================
// Exercises Screen — Homework & Assignment Hub
// ========================================

import { registerScreen, getCurrentUser, getUserData, showToast, escapeHtml } from '../app.js';
import {
  getAssignments, updateUserSettings, submitAssignment,
  createNotification, uploadHomeworkFiles
} from '../data/firestore.js';

let fearTimeout = null;
let gratitudeTimeout = null;
let fearCountTimeout = null;

function escapeAttr(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function getEmbedUrl(url) {
  if (!url) return null;
  let m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  if (m) return `https://www.youtube.com/embed/${m[1]}`;
  m = url.match(/vimeo\.com\/(\d+)/);
  if (m) return `https://player.vimeo.com/video/${m[1]}`;
  return null;
}

function timeAgo(timestamp) {
  if (!timestamp?.seconds) return '';
  const diff = Date.now() / 1000 - timestamp.seconds;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function statusBadge(status) {
  const map = {
    pending: { label: 'To Do', cls: 'ex-badge-pending' },
    submitted: { label: 'Submitted', cls: 'ex-badge-submitted' },
    reviewed: { label: 'Reviewed', cls: 'ex-badge-reviewed' }
  };
  const s = map[status] || map.pending;
  return `<span class="ex-status-badge ${s.cls}">${s.label}</span>`;
}

function renderMediaPreview(url) {
  if (!url) return '';
  const embed = getEmbedUrl(url);
  if (embed) {
    return `<iframe src="${embed}" frameborder="0" allowfullscreen class="ex-media-frame"></iframe>`;
  }
  if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
    return `<img src="${escapeAttr(url)}" alt="Attachment" class="ex-media-img">`;
  }
  return `<a href="${escapeAttr(url)}" target="_blank" class="ex-file-link">View Attachment</a>`;
}

function renderFileList(files) {
  if (!files || files.length === 0) return '';
  return `
    <div class="ex-hw-files">
      <div class="ex-hw-submitted-label" style="margin-top:8px">Attached Files</div>
      ${files.map(f => {
        const isImage = f.type && f.type.startsWith('image/');
        return `
          <div class="ex-hw-file-item">
            ${isImage ? `<img src="${escapeAttr(f.url)}" alt="${escapeAttr(f.name)}" class="ex-hw-file-thumb">` : ''}
            <a href="${escapeAttr(f.url)}" target="_blank" class="ex-hw-file-name">${escapeAttr(f.name)}</a>
            <span class="ex-hw-file-size">${formatFileSize(f.size)}</span>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

// ---- Save helpers (fears/gratitudes) ----
function saveFears() {
  clearTimeout(fearTimeout);
  fearTimeout = setTimeout(() => {
    const user = getCurrentUser();
    if (!user) return;
    const fears = [];
    document.querySelectorAll('.fear-input').forEach((input, i) => {
      const val = input.value.trim();
      fears.push(val);
      // If fear text is cleared, reset its counter to 0
      if (!val) {
        const countInputs = document.querySelectorAll('.fear-count-input');
        if (countInputs[i] && parseInt(countInputs[i].value, 10) > 0) {
          countInputs[i].value = 0;
          saveFearCounts();
        }
      }
    });
    updateUserSettings(user.uid, 'settings.topFears', fears)
      .catch(err => console.error('Failed to save fears:', err));
  }, 800);
}

function saveFearCounts() {
  clearTimeout(fearCountTimeout);
  fearCountTimeout = setTimeout(() => {
    const user = getCurrentUser();
    if (!user) return;
    const counts = [];
    document.querySelectorAll('.fear-count-input').forEach(input => {
      counts.push(parseInt(input.value, 10) || 0);
    });
    updateUserSettings(user.uid, 'settings.fearCounts', counts)
      .catch(err => console.error('Failed to save fear counts:', err));
    updateFearTotal();
  }, 500);
}

function updateFearTotal() {
  const totalEl = document.getElementById('fear-total');
  if (!totalEl) return;
  let total = 0;
  document.querySelectorAll('.fear-count-input').forEach(input => {
    total += parseInt(input.value, 10) || 0;
  });
  totalEl.textContent = total;
  // Update the header badge too
  const badge = document.querySelector('.ex-fear-badge');
  if (badge) badge.textContent = total + ' Fears';
}

function saveGratitudes() {
  clearTimeout(gratitudeTimeout);
  gratitudeTimeout = setTimeout(() => {
    const user = getCurrentUser();
    if (!user) return;
    const gratitudes = [];
    document.querySelectorAll('.gratitude-input').forEach(input => {
      gratitudes.push(input.value.trim());
    });
    updateUserSettings(user.uid, 'settings.gratitudes', gratitudes)
      .catch(err => console.error('Failed to save gratitudes:', err));
  }, 800);
}

// ---- Render a single assignment card ----
function renderAssignmentCard(a) {
  const isPending = a.status === 'pending' || !a.status;
  const isSubmitted = a.status === 'submitted';
  const isReviewed = a.status === 'reviewed';
  const dueDateStr = a.dueDate || '';
  const isOverdue = dueDateStr && new Date(dueDateStr + 'T23:59:59') < new Date() && isPending;

  return `
    <div class="ex-hw-card ${isOverdue ? 'ex-hw-overdue' : ''}" data-id="${a.id}">
      <div class="ex-hw-top">
        <div class="ex-hw-type-badge ex-type-${a.type}">${a.type}</div>
        ${statusBadge(a.status || 'pending')}
      </div>
      <h4 class="ex-hw-title">${escapeAttr(a.title)}</h4>
      ${a.description ? `<p class="ex-hw-desc">${escapeAttr(a.description)}</p>` : ''}
      ${a.mediaUrl ? `<div class="ex-hw-media">${renderMediaPreview(a.mediaUrl)}</div>` : ''}
      <div class="ex-hw-meta">
        ${dueDateStr ? `<span class="ex-hw-due ${isOverdue ? 'ex-overdue-text' : ''}">Due: ${dueDateStr}</span>` : ''}
        <span class="ex-hw-time">${timeAgo(a.createdAt)}</span>
      </div>

      ${isPending ? `
        <div class="ex-hw-response-area">
          <textarea class="ex-hw-response" placeholder="Write your response here..." rows="3">${escapeAttr(a.response || '')}</textarea>
          <div class="ex-hw-upload-zone" data-id="${a.id}">
            <label class="ex-hw-upload-label">
              <span class="ex-hw-upload-icon">+</span> Attach Files
              <input type="file" class="ex-hw-file-input" multiple accept="image/*,.pdf,.pptx,.xlsx,.xls,.doc,.docx,.mp4,.mov" style="display:none">
            </label>
            <span class="ex-hw-upload-hint">Images, PDF, Word, Excel, PowerPoint, Video</span>
            <div class="ex-hw-file-list"></div>
          </div>
          <div class="ex-hw-actions">
            <button class="ex-hw-submit-btn" data-id="${a.id}" data-coach="${a.coachId || ''}">
              Submit to Coach
            </button>
          </div>
        </div>
      ` : ''}

      ${isSubmitted ? `
        <div class="ex-hw-submitted-info">
          <div class="ex-hw-submitted-label">Your Response</div>
          <div class="ex-hw-submitted-text">${escapeAttr(a.response || 'No written response')}</div>
          ${renderFileList(a.responseFiles)}
          <div class="ex-hw-submitted-time">Submitted ${timeAgo(a.submittedAt)}</div>
        </div>
      ` : ''}

      ${isReviewed ? `
        <div class="ex-hw-reviewed-info">
          <div class="ex-hw-submitted-label">Your Response</div>
          <div class="ex-hw-submitted-text">${escapeAttr(a.response || 'No written response')}</div>
          ${renderFileList(a.responseFiles)}
          ${a.coachNote ? `
            <div class="ex-hw-coach-note-label">Coach Feedback</div>
            <div class="ex-hw-coach-note">${escapeAttr(a.coachNote)}</div>
          ` : ''}
          <div class="ex-hw-submitted-time">Reviewed ${timeAgo(a.reviewedAt)}</div>
        </div>
      ` : ''}
    </div>
  `;
}

// ---- Main render ----
async function loadExercises() {
  const user = getCurrentUser();
  if (!user) return;

  const container = document.getElementById('exercises-list');
  const userData = getUserData();
  const fears = userData?.settings?.topFears || ['', '', '', ''];
  const fearCounts = userData?.settings?.fearCounts || [0, 0, 0, 0];
  const gratitudes = userData?.settings?.gratitudes || ['', '', '', '', '', ''];

  try {
    const assignments = await getAssignments(user.uid);

    // Split by status for summary
    const pending = assignments.filter(a => !a.status || a.status === 'pending');
    const submitted = assignments.filter(a => a.status === 'submitted');
    const reviewed = assignments.filter(a => a.status === 'reviewed');

    // Group assignments by type
    const taskAssigns = assignments.filter(a => a.type === 'task');
    const videoAssigns = assignments.filter(a => a.type === 'video');
    const visualAssigns = assignments.filter(a => a.type === 'visual');
    const mentalAssigns = assignments.filter(a => a.type === 'mental');

    let html = '';

    // Helper: get nearest due date for a group of assignments
    function getNextDueDate(assigns) {
      const pending = assigns.filter(a => a.dueDate && (!a.status || a.status === 'pending'));
      if (pending.length === 0) return 'Due Date';
      pending.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      return pending[0].dueDate;
    }

    // ---- 1. Task Assignments ----
    html += `
      <div class="ex-section">
        <div class="ex-section-header" data-toggle="task-section">
          <img src="assets/icons/exerciseicons/task assignments.png" alt="" class="ex-section-icon">
          <div class="ex-section-info">
            <h3 class="ex-section-title">TASK ASSIGNMENTS</h3>
          </div>
          <div class="ex-header-right">
            <span class="ex-pending-count">${getNextDueDate(taskAssigns)}</span>
            <span class="ex-toggle-arrow">&#9662;</span>
          </div>
        </div>
        <div class="ex-section-body" id="task-section">
          ${taskAssigns.length > 0
            ? taskAssigns.map(a => renderAssignmentCard(a)).join('')
            : '<div class="ex-empty-msg">No task assignments yet. Your coach will add them here.</div>'
          }
        </div>
      </div>
    `;

    // ---- 2. Videos to Listen To ----
    html += `
      <div class="ex-section">
        <div class="ex-section-header" data-toggle="video-section">
          <img src="assets/icons/exerciseicons/Videos to Listen To.png" alt="" class="ex-section-icon">
          <div class="ex-section-info">
            <h3 class="ex-section-title">VIDEOS TO LISTEN TO</h3>
          </div>
          <div class="ex-header-right">
            <span class="ex-pending-count">${getNextDueDate(videoAssigns)}</span>
            <span class="ex-toggle-arrow">&#9662;</span>
          </div>
        </div>
        <div class="ex-section-body" id="video-section">
          ${videoAssigns.length > 0
            ? videoAssigns.map(a => renderAssignmentCard(a)).join('')
            : '<div class="ex-empty-msg">No video assignments yet.</div>'
          }
        </div>
      </div>
    `;

    // ---- 3. Visuals to Create ----
    html += `
      <div class="ex-section">
        <div class="ex-section-header" data-toggle="visual-section">
          <img src="assets/icons/exerciseicons/Visuals to Create.png" alt="" class="ex-section-icon">
          <div class="ex-section-info">
            <h3 class="ex-section-title">VISUALS TO CREATE</h3>
          </div>
          <div class="ex-header-right">
            <span class="ex-pending-count">${getNextDueDate(visualAssigns)}</span>
            <span class="ex-toggle-arrow">&#9662;</span>
          </div>
        </div>
        <div class="ex-section-body" id="visual-section">
          ${visualAssigns.length > 0
            ? visualAssigns.map(a => renderAssignmentCard(a)).join('')
            : '<div class="ex-empty-msg">No visual assignments yet.</div>'
          }
        </div>
      </div>
    `;

    // ---- 4. Mental Exercises ----
    html += `
      <div class="ex-section">
        <div class="ex-section-header" data-toggle="mental-section">
          <img src="assets/icons/exerciseicons/Mentalexercises.png" alt="" class="ex-section-icon">
          <div class="ex-section-info">
            <h3 class="ex-section-title">MENTAL EXERCISES</h3>
          </div>
          <div class="ex-header-right">
            <span class="ex-pending-count">${getNextDueDate(mentalAssigns)}</span>
            <span class="ex-toggle-arrow">&#9662;</span>
          </div>
        </div>
        <div class="ex-section-body" id="mental-section">
          ${mentalAssigns.length > 0
            ? mentalAssigns.map(a => renderAssignmentCard(a)).join('')
            : '<div class="ex-empty-msg">No mental exercises yet.</div>'
          }
        </div>
      </div>
    `;

    // ---- 5. Your Most Consistent Fears ----
    const fearTotal = fearCounts.reduce((s, c) => s + c, 0);
    html += `
      <div class="ex-section">
        <div class="ex-section-header" data-toggle="fears-section">
          <img src="assets/icons/exerciseicons/Red Brain Exercising.jpg" alt="" class="ex-section-icon ex-section-icon-round">
          <div class="ex-section-info">
            <h3 class="ex-section-title">YOUR MOST CONSISTENT FEARS</h3>
          </div>
          <div class="ex-header-right">
            <span class="ex-fear-badge">${fearTotal} Fears</span>
            <span class="ex-toggle-arrow">&#9662;</span>
          </div>
        </div>
        <div class="ex-section-body" id="fears-section">
          ${fears.map((f, i) => `
            <div class="ex-fear-row">
              <input type="text" class="fear-input ex-fear-text" placeholder="Fear ${i + 1}" value="${escapeAttr(f)}" maxlength="100">
              <div class="ex-fear-counter">
                <button class="ex-counter-btn ex-counter-minus" data-idx="${i}">-</button>
                <input type="number" class="fear-count-input ex-counter-value" value="${fearCounts[i] || 0}" min="0" data-idx="${i}">
                <button class="ex-counter-btn ex-counter-plus" data-idx="${i}">+</button>
              </div>
            </div>
          `).join('')}
          <div class="ex-fear-total">
            Total fear occurrences: <strong id="fear-total">${fearTotal}</strong>
          </div>
        </div>
      </div>
    `;

    // ---- 6. Blessings / Gratitudes ----
    html += `
      <div class="ex-section">
        <div class="ex-section-header" data-toggle="blessings-section">
          <div>
            <h3 class="ex-section-title">What I Am Grateful For</h3>
            <p class="ex-section-sub">6 blessings to count</p>
          </div>
          <span class="ex-toggle-arrow">&#9662;</span>
        </div>
        <div class="ex-section-body" id="blessings-section">
          <div class="ex-gratitude-list">
            ${gratitudes.map((g, i) => `
              <input type="text" class="gratitude-input ex-gratitude-field" placeholder="Grateful ${i + 1}" value="${escapeAttr(g)}" maxlength="100">
            `).join('')}
          </div>
        </div>
      </div>
    `;

    // ---- Status summary bar (bottom) ----
    html += `
      <div class="ex-summary-bar">
        <div class="ex-summary-stat">
          <span class="ex-summary-num ex-num-pending">${pending.length}</span>
          <span class="ex-summary-label">To Do</span>
        </div>
        <div class="ex-summary-stat">
          <span class="ex-summary-num ex-num-submitted">${submitted.length}</span>
          <span class="ex-summary-label">Submitted</span>
        </div>
        <div class="ex-summary-stat">
          <span class="ex-summary-num ex-num-reviewed">${reviewed.length}</span>
          <span class="ex-summary-label">Reviewed</span>
        </div>
      </div>
    `;

    container.innerHTML = html;

    // ---- Attach listeners ----

    // Start all sections collapsed
    container.querySelectorAll('.ex-section-body').forEach(body => {
      body.classList.add('collapsed');
    });
    container.querySelectorAll('.ex-toggle-arrow').forEach(arrow => {
      arrow.textContent = '\u25B8';
    });

    // Section toggles
    container.querySelectorAll('.ex-section-header[data-toggle]').forEach(header => {
      header.addEventListener('click', () => {
        const targetId = header.dataset.toggle;
        const body = document.getElementById(targetId);
        const arrow = header.querySelector('.ex-toggle-arrow');
        if (body.classList.contains('collapsed')) {
          body.classList.remove('collapsed');
          arrow.textContent = '\u25BE';
        } else {
          body.classList.add('collapsed');
          arrow.textContent = '\u25B8';
        }
      });
    });

    // File input listeners — show selected files
    container.querySelectorAll('.ex-hw-file-input').forEach(input => {
      input.addEventListener('change', () => {
        const zone = input.closest('.ex-hw-upload-zone');
        const listEl = zone.querySelector('.ex-hw-file-list');
        const files = Array.from(input.files);
        if (files.length === 0) { listEl.innerHTML = ''; return; }
        listEl.innerHTML = files.map(f => `
          <div class="ex-hw-queued-file">
            <span class="ex-hw-queued-name">${escapeHtml(f.name)}</span>
            <span class="ex-hw-queued-size">${formatFileSize(f.size)}</span>
          </div>
        `).join('');
      });
    });

    // Submit buttons
    container.querySelectorAll('.ex-hw-submit-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const assignId = btn.dataset.id;
        const coachId = btn.dataset.coach;
        const card = btn.closest('.ex-hw-card');
        const textarea = card.querySelector('.ex-hw-response');
        const fileInput = card.querySelector('.ex-hw-file-input');
        const response = textarea ? textarea.value.trim() : '';
        const files = fileInput ? Array.from(fileInput.files) : [];

        if (!response && files.length === 0) {
          showToast('Please write a response or attach files before submitting');
          return;
        }

        btn.disabled = true;
        let uploadedFiles = [];

        // Upload files if any
        if (files.length > 0) {
          btn.textContent = `Uploading ${files.length} file${files.length > 1 ? 's' : ''}...`;
          try {
            uploadedFiles = await uploadHomeworkFiles(user.uid, assignId, files);
          } catch (err) {
            console.error('File upload failed:', err);
            showToast('File upload failed. Please try again.');
            btn.disabled = false;
            btn.textContent = 'Submit to Coach';
            return;
          }
        }

        btn.textContent = 'Submitting...';

        try {
          await submitAssignment(assignId, response, uploadedFiles);

          // Send notification to coach
          if (coachId) {
            const userData = getUserData();
            const fileNote = uploadedFiles.length > 0 ? ` (${uploadedFiles.length} file${uploadedFiles.length > 1 ? 's' : ''} attached)` : '';
            await createNotification({
              toUserId: coachId,
              fromUserId: user.uid,
              fromName: userData?.name || 'Client',
              type: 'submission',
              assignmentId: assignId,
              message: `${userData?.name || 'Your client'} submitted their homework${fileNote}`
            });
          }

          showToast('Homework submitted!', 'success');
          loadExercises(); // refresh
        } catch (err) {
          console.error('Failed to submit:', err);
          showToast('Failed to submit. Please try again.');
          btn.disabled = false;
          btn.textContent = 'Submit to Coach';
        }
      });
    });

    // Fear inputs
    container.querySelectorAll('.fear-input').forEach(input => {
      input.addEventListener('input', saveFears);
    });

    // Fear counters
    container.querySelectorAll('.ex-counter-plus').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        const input = container.querySelectorAll('.fear-count-input')[idx];
        input.value = (parseInt(input.value, 10) || 0) + 1;
        saveFearCounts();
      });
    });
    container.querySelectorAll('.ex-counter-minus').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        const input = container.querySelectorAll('.fear-count-input')[idx];
        const val = (parseInt(input.value, 10) || 0) - 1;
        input.value = Math.max(0, val);
        saveFearCounts();
      });
    });
    container.querySelectorAll('.fear-count-input').forEach(input => {
      input.addEventListener('input', saveFearCounts);
    });

    // Gratitude inputs
    container.querySelectorAll('.gratitude-input').forEach(input => {
      input.addEventListener('input', saveGratitudes);
    });

  } catch (err) {
    console.error('Failed to load exercises:', err);
    container.innerHTML = '<div class="empty-state">No exercises assigned yet.</div>';
  }
}

registerScreen('exercises', {
  init() {},
  enter() { loadExercises(); },
  leave() {}
});
