// ==========================================================================
// STATE MANAGEMENT & CONFIG
// ==========================================================================
const state = {
  donors: [],
  currentFilter: 'all',
  searchQuery: '',
  activeView: 'list-page',
  editingDonorId: null
};

// ==========================================================================
// DOM ELEMENTS
// ==========================================================================
const pages = {
  list: document.getElementById('list-page'),
  register: document.getElementById('register-page'),
  manage: document.getElementById('manage-page')
};

const navButtons = {
  list: [document.getElementById('nav-list'), document.getElementById('mob-nav-list')],
  register: [document.getElementById('nav-register'), document.getElementById('mob-nav-register')],
  manage: [document.getElementById('nav-manage'), document.getElementById('mob-nav-manage')]
};

const brandLogo = document.getElementById('brand-logo');
const menuToggle = document.getElementById('menu-toggle');
const mobileDrawer = document.getElementById('mobile-drawer');
const drawerOverlay = document.getElementById('drawer-overlay');

// Forms & Inputs
const registerForm = document.getElementById('register-donor-form');
const editForm = document.getElementById('edit-donor-form');
const searchInput = document.getElementById('search-input');
const manageSearchInput = document.getElementById('manage-search');
const bloodPillsContainer = document.getElementById('blood-pills-list');

// Stats Counters
const statTotal = document.getElementById('stat-total-donors');
const statEligible = document.getElementById('stat-eligible-donors');
const statResting = document.getElementById('stat-resting-donors');

// Grids & Tables
const donorsGrid = document.getElementById('donors-grid');
const manageTableBody = document.getElementById('manage-table-body');

// Modals & Backdrops
const editModal = document.getElementById('edit-modal');
const modalClose = document.getElementById('modal-close');
const editCancel = document.getElementById('edit-cancel');

// ==========================================================================
// INITIALIZATION
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  // Load Initial Donors Data
  fetchDonors();

  // Setup Event Listeners
  setupEventListeners();
});

// ==========================================================================
// EVENT LISTENERS SETUP
// ==========================================================================
function setupEventListeners() {
  // Brand Logo Click (goes to list page)
  brandLogo.addEventListener('click', (e) => {
    e.preventDefault();
    switchView('list-page');
  });

  // Desktop & Mobile Navigation Links
  Object.keys(navButtons).forEach(viewKey => {
    navButtons[viewKey].forEach(btn => {
      btn.addEventListener('click', () => {
        let targetView = 'list-page';
        if (viewKey === 'register') targetView = 'register-page';
        if (viewKey === 'manage') targetView = 'manage-page';
        
        switchView(targetView);
        closeMobileMenu();
      });
    });
  });

  // Mobile Menu Toggle
  menuToggle.addEventListener('click', toggleMobileMenu);
  drawerOverlay.addEventListener('click', closeMobileMenu);

  // Search Inputs
  searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value.toLowerCase().trim();
    renderDonorsGrid();
  });

  if (manageSearchInput) {
    manageSearchInput.addEventListener('input', (e) => {
      renderManageTable(e.target.value.toLowerCase().trim());
    });
  }

  // Blood Pills Filter
  bloodPillsContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('blood-pill')) {
      // Remove active from all pills
      document.querySelectorAll('.blood-pill').forEach(pill => pill.classList.remove('active'));
      
      // Add active to selected
      e.target.classList.add('active');
      state.currentFilter = e.target.dataset.group;
      renderDonorsGrid();
    }
  });

  // Print Button trigger
  const printBtn = document.getElementById('print-btn');
  if (printBtn) {
    printBtn.addEventListener('click', () => {
      window.print();
    });
  }

  // Forms Hook (rebind triggers on dynamic page updates)
  bindFormSubmissions();

  // Modal Closures
  modalClose.addEventListener('click', closeEditModal);
  editCancel.addEventListener('click', closeEditModal);
  editModal.addEventListener('click', (e) => {
    if (e.target === editModal) closeEditModal();
  });
}

function bindFormSubmissions() {
  const regForm = document.getElementById('register-donor-form');
  if (regForm) {
    regForm.removeEventListener('submit', handleRegisterSubmit);
    regForm.addEventListener('submit', handleRegisterSubmit);
  }
  const edForm = document.getElementById('edit-donor-form');
  if (edForm) {
    edForm.removeEventListener('submit', handleEditSubmit);
    edForm.addEventListener('submit', handleEditSubmit);
  }
}

// ==========================================================================
// VIEW ROUTING
// ==========================================================================
function switchView(targetViewId) {
  state.activeView = targetViewId;

  // Update Nav Active Styles
  Object.keys(navButtons).forEach(viewKey => {
    let matchesTarget = false;
    if (viewKey === 'list' && targetViewId === 'list-page') matchesTarget = true;
    if (viewKey === 'register' && targetViewId === 'register-page') matchesTarget = true;
    if (viewKey === 'manage' && targetViewId === 'manage-page') matchesTarget = true;

    navButtons[viewKey].forEach(btn => {
      if (matchesTarget) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  });

  // Toggle Page Sections
  Object.values(pages).forEach(page => {
    page.classList.remove('active');
  });

  const activePage = document.getElementById(targetViewId);
  if (activePage) {
    activePage.classList.add('active');
  }

  // Trigger Renders directly
  if (targetViewId === 'list-page') renderDonorsGrid();
  if (targetViewId === 'manage-page') renderManageTable();
  
  bindFormSubmissions();
}

// ==========================================================================
// DYNAMIC NAVIGATION MENU (MOBILE DRAWER)
// ==========================================================================
function toggleMobileMenu() {
  menuToggle.classList.toggle('active');
  mobileDrawer.classList.toggle('active');
  drawerOverlay.classList.toggle('active');
}

function closeMobileMenu() {
  menuToggle.classList.remove('active');
  mobileDrawer.classList.remove('active');
  drawerOverlay.classList.remove('active');
}

// ==========================================================================
// DATA API INTERACTION
// ==========================================================================
async function fetchDonors() {
  try {
    const res = await fetch('/api/donors');
    if (!res.ok) throw new Error('Failed to fetch donors list.');
    state.donors = await res.json();
    
    // Sort donors: Active/Eligible first, then alphabetical name
    state.donors.sort((a, b) => {
      const elA = calculateEligibility(a.lastDonated).eligible ? 1 : 0;
      const elB = calculateEligibility(b.lastDonated).eligible ? 1 : 0;
      if (elA !== elB) return elB - elA; // 1s (eligible) before 0s (resting)
      return a.name.localeCompare(b.name);
    });

    updateCounters();
    
    if (state.activeView === 'list-page') renderDonorsGrid();
    if (state.activeView === 'manage-page') renderManageTable();
  } catch (error) {
    console.error(error);
    showToast(error.message, 'error');
  }
}

// ==========================================================================
// COMPUTATIONS: ELIGIBILITY & COOLDOWN (6 Months)
// ==========================================================================
function calculateEligibility(lastDonatedIsoString) {
  if (!lastDonatedIsoString) {
    return { eligible: true, text: 'Eligible', daysRemaining: 0 };
  }

  const lastDonated = new Date(lastDonatedIsoString);
  const currentDate = new Date();
  
  // Create eligibility limit: exactly 6 months (approx 180 days) post donation
  const eligibleDate = new Date(lastDonated);
  eligibleDate.setMonth(eligibleDate.getMonth() + 6);

  if (currentDate >= eligibleDate) {
    return { eligible: true, text: 'Eligible', daysRemaining: 0 };
  }

  // Calculate cooldown period
  const diffTime = eligibleDate - currentDate;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  // Calculate relative months remaining
  const diffMonths = Math.ceil(diffDays / 30);
  const dayText = diffDays === 1 ? '1 day' : `${diffDays} days`;

  return {
    eligible: false,
    text: `Resting (${dayText} remaining)`,
    daysRemaining: diffDays,
    monthsRemaining: diffMonths,
    eligibleDateString: eligibleDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  };
}

// ==========================================================================
// RENDER MODULES
// ==========================================================================
function updateCounters() {
  let total = state.donors.length;
  let eligible = 0;
  let resting = 0;

  state.donors.forEach(donor => {
    if (calculateEligibility(donor.lastDonated).eligible) {
      eligible++;
    } else {
      resting++;
    }
  });

  // Animate values incrementing
  animateCounter(statTotal, total);
  animateCounter(statEligible, eligible);
  animateCounter(statResting, resting);
}

function animateCounter(element, targetValue) {
  if (!element) return;
  const startValue = parseInt(element.textContent) || 0;
  if (startValue === targetValue) {
    element.textContent = targetValue;
    return;
  }
  
  const duration = 800; // ms
  const stepTime = 30; // ms
  const steps = duration / stepTime;
  const increment = (targetValue - startValue) / steps;
  
  let current = startValue;
  let stepCount = 0;

  const timer = setInterval(() => {
    current += increment;
    stepCount++;
    
    if (stepCount >= steps) {
      clearInterval(timer);
      element.textContent = targetValue;
    } else {
      element.textContent = Math.round(current);
    }
  }, stepTime);
}

// Renders the Grid on the public page
function renderDonorsGrid() {
  if (!donorsGrid) return;
  donorsGrid.innerHTML = '';

  // Filter donor list based on Search and Blood Group Filter
  const filtered = state.donors.filter(donor => {
    const matchesSearch = donor.name.toLowerCase().includes(state.searchQuery) || 
                          donor.phone.includes(state.searchQuery);
    const matchesBlood = state.currentFilter === 'all' || donor.bloodGroup === state.currentFilter;
    return matchesSearch && matchesBlood;
  });

  if (filtered.length === 0) {
    donorsGrid.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/>
        </svg>
        <h3>No matching donors found</h3>
        <p>Try resetting the search query or selecting a different blood group pill.</p>
      </div>
    `;
    return;
  }

  // Set page attribute for printing list details (prints the active blood group filter)
  const listPage = document.getElementById('list-page');
  if (listPage) {
    listPage.setAttribute('data-active-filter', state.currentFilter);
  }

  filtered.forEach(donor => {
    const eligibility = calculateEligibility(donor.lastDonated);
    const card = document.createElement('div');
    card.className = 'donor-card';
    
    card.innerHTML = `
      <div class="donor-card-header">
        <span class="donor-group-badge">${escapeHtml(donor.bloodGroup)}</span>
        <span class="status-badge ${eligibility.eligible ? 'eligible' : 'resting'}">
          ${eligibility.eligible ? 'Eligible' : 'Resting'}
        </span>
      </div>
      <div class="donor-card-body">
        <h2>${escapeHtml(donor.name)}</h2>
        <p>
          <svg class="phone-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
          </svg>
          ${escapeHtml(donor.phone)}
        </p>
        ${donor.unitNo ? `
          <p style="margin-top: 6px;">
            <svg class="phone-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
            Unit: <strong>${escapeHtml(donor.unitNo)}</strong>
          </p>
        ` : ''}
      </div>
      <div class="donor-card-footer">
        ${eligibility.eligible 
          ? 'Ready to donate immediately.' 
          : `Resting. Available on <strong>${eligibility.eligibleDateString}</strong>.`
        }
      </div>
      <div class="card-action-row" style="display: flex; gap: 8px; margin-top: 12px; width: 100%;">
        <a href="tel:${donor.phone}" class="card-call-btn" style="flex: 1; margin: 0; justify-content: center;">
          <svg style="width:16px;height:16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15.05 5A5 5 0 0 1 19 8.95M15.05 1A9 9 0 0 1 23 8.94m-1 7.98v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          <span>Call</span>
        </a>
        <button class="btn-table btn-delete card-delete-btn" style="flex: 1; justify-content: center; height: 38px; font-size: 0.9rem; padding: 0;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
          <span>Delete</span>
        </button>
      </div>
    `;

    // Bind card action events
    card.querySelector('.card-delete-btn').addEventListener('click', () => confirmDeleteDonor(donor));

    donorsGrid.appendChild(card);
  });
}

// Renders the Directory list table on the Manage page
function renderManageTable(searchQuery = '') {
  const tableBody = document.getElementById('manage-table-body');
  if (!tableBody) return;
  tableBody.innerHTML = '';

  const filtered = state.donors.filter(donor => {
    return donor.name.toLowerCase().includes(searchQuery) || 
           donor.phone.includes(searchQuery);
  });

  if (filtered.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 40px; color: var(--text-muted);">
          No registered donors found matching the query.
        </td>
      </tr>
    `;
    return;
  }

  filtered.forEach(donor => {
    const eligibility = calculateEligibility(donor.lastDonated);
    const row = document.createElement('tr');

    row.innerHTML = `
      <td class="blood-cell" data-label="Blood">
        <span class="table-blood-badge">${escapeHtml(donor.bloodGroup)}</span>
      </td>
      <td class="donor-name" data-label="Donor Name">${escapeHtml(donor.name)}</td>
      <td class="phone-cell" data-label="Phone">${escapeHtml(donor.phone)}</td>
      <td data-label="Unit">${escapeHtml(donor.unitNo || '-')}</td>
      <td data-label="Eligibility Status">
        <span class="status-badge ${eligibility.eligible ? 'eligible' : 'resting'}">
          ${eligibility.text}
        </span>
      </td>
      <td class="actions-col" data-label="Actions">
        <div class="action-buttons">
          <button class="btn-table btn-donate" data-id="${donor.id}" ${!eligibility.eligible ? 'disabled' : ''} title="Mark as Donated (6 Month Cooldown)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
            <span>Donated</span>
          </button>
          <button class="btn-table btn-edit" data-id="${donor.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            <span>Edit</span>
          </button>
          <button class="btn-table btn-delete" data-id="${donor.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              <line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
            </svg>
            <span>Delete</span>
          </button>
        </div>
      </td>
    `;

    // Hook events inside elements manually to preserve references
    row.querySelector('.btn-donate').addEventListener('click', () => logDonation(donor.id));
    row.querySelector('.btn-edit').addEventListener('click', () => openEditModal(donor));
    row.querySelector('.btn-delete').addEventListener('click', () => confirmDeleteDonor(donor));

    tableBody.appendChild(row);
  });
}

// ==========================================================================
// BACKEND MUTATIONS: POST, PUT, DELETE, DONATE
// ==========================================================================
async function handleRegisterSubmit(e) {
  e.preventDefault();
  
  const nameInput = document.getElementById('reg-name');
  const phoneInput = document.getElementById('reg-phone');
  const unitInput = document.getElementById('reg-unit');
  const bloodGroupRadio = document.querySelector('input[name="reg-blood"]:checked');

  if (!nameInput || !phoneInput || !bloodGroupRadio) return;

  // Client side validation
  let hasError = false;
  
  if (!nameInput.value || nameInput.value.trim().length === 0) {
    nameInput.closest('.form-group').classList.add('has-error');
    hasError = true;
  } else {
    nameInput.closest('.form-group').classList.remove('has-error');
  }

  if (!phoneInput.value || phoneInput.value.trim().length === 0) {
    phoneInput.closest('.form-group').classList.add('has-error');
    hasError = true;
  } else {
    phoneInput.closest('.form-group').classList.remove('has-error');
  }

  if (hasError) return;

  const payload = {
    name: nameInput.value,
    phone: phoneInput.value,
    bloodGroup: bloodGroupRadio.value,
    unitNo: unitInput ? unitInput.value.trim() : ''
  };

  try {
    const res = await fetch('/api/donors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Failed to register donor.');
    }

    showToast(`Donor ${payload.name} registered successfully.`, 'success');
    
    // Reset Form
    registerForm.reset();
    
    // Fetch and navigate to list
    await fetchDonors();
    switchView('list-page');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function handleEditSubmit(e) {
  e.preventDefault();

  const id = document.getElementById('edit-id').value;
  const nameInput = document.getElementById('edit-name');
  const phoneInput = document.getElementById('edit-phone');
  const unitInput = document.getElementById('edit-unit');
  const bloodGroupRadio = document.querySelector('input[name="edit-blood"]:checked');

  if (!nameInput || !phoneInput || !bloodGroupRadio) return;

  let hasError = false;
  if (!nameInput.value.trim()) {
    nameInput.closest('.form-group').classList.add('has-error');
    hasError = true;
  } else {
    nameInput.closest('.form-group').classList.remove('has-error');
  }

  if (!phoneInput.value.trim()) {
    phoneInput.closest('.form-group').classList.add('has-error');
    hasError = true;
  } else {
    phoneInput.closest('.form-group').classList.remove('has-error');
  }

  if (hasError) return;

  const payload = {
    name: nameInput.value,
    phone: phoneInput.value,
    bloodGroup: bloodGroupRadio.value,
    unitNo: unitInput ? unitInput.value.trim() : ''
  };

  try {
    const res = await fetch(`/api/donors/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Failed to update donor.');
    }

    showToast('Donor profile updated successfully.', 'success');
    closeEditModal();
    fetchDonors();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function logDonation(id) {
  try {
    const res = await fetch(`/api/donors/${id}/donate`, {
      method: 'POST'
    });

    if (!res.ok) throw new Error('Could not record donation timestamp.');
    
    showToast('Donation recorded. Donor is now in a 6-month resting period.', 'success');
    fetchDonors();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function confirmDeleteDonor(donor) {
  if (confirm(`Are you absolutely sure you want to delete ${donor.name}'s registry record?`)) {
    try {
      const res = await fetch(`/api/donors/${donor.id}`, {
        method: 'DELETE'
      });

      if (!res.ok) throw new Error('Deletion request failed.');

      showToast(`${donor.name}'s profile deleted.`, 'success');
      fetchDonors();
    } catch (error) {
      showToast(error.message, 'error');
    }
  }
}

// ==========================================================================
// DIALOG MODAL CONTROLLER
// ==========================================================================
function openEditModal(donor) {
  state.editingDonorId = donor.id;
  document.getElementById('edit-id').value = donor.id;
  document.getElementById('edit-name').value = donor.name;
  document.getElementById('edit-phone').value = donor.phone;
  document.getElementById('edit-unit').value = donor.unitNo || "";

  // Check the corresponding blood group radio button
  const radios = document.getElementsByName('edit-blood');
  for (let radio of radios) {
    if (radio.value === donor.bloodGroup) {
      radio.checked = true;
      break;
    }
  }

  // Clear validation styling
  document.querySelectorAll('.modal-form .form-group').forEach(fg => fg.classList.remove('has-error'));

  editModal.classList.add('active');
  document.body.style.overflow = 'hidden'; // Lock body scrolling
}

function closeEditModal() {
  editModal.classList.remove('active');
  document.body.style.overflow = '';
  state.editingDonorId = null;
}

// ==========================================================================
// TOAST ALERTS SYSTEM
// ==========================================================================
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  toast.innerHTML = `
    <div class="toast-content">${escapeHtml(message)}</div>
    <button class="toast-close">&times;</button>
  `;

  container.appendChild(toast);

  // Close trigger
  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => removeToast(toast));

  // Auto remove toast after 4 seconds
  setTimeout(() => {
    removeToast(toast);
  }, 4000);
}

function removeToast(toast) {
  toast.classList.add('fade-out');
  toast.addEventListener('animationend', () => {
    toast.remove();
  });
}

// ==========================================================================
// UTILITIES
// ==========================================================================
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
