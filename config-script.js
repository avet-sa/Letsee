// Color palette
const COLOR_PALETTE = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
    '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52B788',
    '#E63946', '#A8DADC', '#457B9D', '#F1FAEE', '#E76F51',
    '#D4A5A5', '#9B59B6', '#3498DB', '#E74C3C', '#2ECC71'
];

// Default people with colors
const DEFAULT_PEOPLE = [
    { name: 'Avet', color: '#FF6B6B' },
    { name: 'Luiza', color: '#4ECDC4' },
    { name: 'Erik', color: '#45B7D1' },
    { name: 'Narek', color: '#FFA07A' },
    { name: 'Hayk', color: '#98D8C8' },
    { name: 'Seda', color: '#F7DC6F' },
    { name: 'Tigran', color: '#BB8FCE' },
    { name: 'Lusine', color: '#85C1E2' }
];

// Storage keys
const STORAGE_KEY_PEOPLE = 'letsee_people';
const STORAGE_KEY_THEME = 'letsee_theme';

// Initialize database on load
let dbInitialized = false;
async function ensureDB() {
    if (!dbInitialized) {
        await DB.init();
        dbInitialized = true;
    }
}

// Theme toggle
async function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    await DB.saveSetting(STORAGE_KEY_THEME, newTheme);
    updateThemeIcon(newTheme);
}

// Update theme icon
function updateThemeIcon(theme) {
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
        if (theme === 'dark') {
            themeBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
        } else {
            themeBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
        }
    }
}

// Load theme on startup
async function loadTheme() {
    const savedTheme = await DB.getSetting(STORAGE_KEY_THEME) || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

// Get people from database or use defaults
async function getPeople() {
    await ensureDB();
    let people = await DB.getPeople();
    if (!people || people.length === 0) {
        // Initialize with defaults
        await savePeople(DEFAULT_PEOPLE);
        return DEFAULT_PEOPLE;
    }
    return people;
}

// Save people to database
async function savePeople(people) {
    await ensureDB();
    await DB.savePeople(people);
}

// Render people list
async function renderPeople() {
    const people = await getPeople();
    const listContainer = document.getElementById('people-list');
    
    listContainer.innerHTML = people.map((person, index) => `
        <div class="person-item">
            <div class="person-info">
                <div class="person-color" style="background-color: ${person.color}" 
                     onclick="openColorPicker(${index})"></div>
                <span class="person-name">${person.name}</span>
            </div>
            <div class="person-actions">
                <button class="btn-remove" onclick="removePerson(${index})">Remove</button>
            </div>
        </div>
    `).join('');
}

// Add new person
async function addPerson() {
    const input = document.getElementById('new-person-name');
    const name = input.value.trim();
    
    if (!name) {
        alert('Please enter a name');
        return;
    }
    
    const people = await getPeople();
    
    // Check for duplicate
    if (people.some(p => p.name.toLowerCase() === name.toLowerCase())) {
        alert('This person already exists');
        return;
    }
    
    // Assign a random color from palette
    const unusedColors = COLOR_PALETTE.filter(
        color => !people.some(p => p.color === color)
    );
    const color = unusedColors.length > 0 
        ? unusedColors[0] 
        : COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)];
    
    people.push({ name, color });
    await savePeople(people);
    renderPeople();
    input.value = '';
}

// Remove person
async function removePerson(index) {
    if (!confirm('Are you sure you want to remove this person?')) {
        return;
    }
    
    const people = await getPeople();
    people.splice(index, 1);
    await savePeople(people);
    renderPeople();
}

// Color picker
let currentEditingIndex = null;

function openColorPicker(index) {
    currentEditingIndex = index;
    const modal = document.getElementById('color-picker-modal');
    const palette = document.getElementById('color-palette');
    
    palette.innerHTML = COLOR_PALETTE.map(color => `
        <div class="color-option" style="background-color: ${color}" 
             onclick="selectColor('${color}')"></div>
    `).join('');
    
    modal.classList.remove('hidden');
}

function closeColorPicker() {
    document.getElementById('color-picker-modal').classList.add('hidden');
    currentEditingIndex = null;
}

async function selectColor(color) {
    if (currentEditingIndex === null) return;
    
    const people = await getPeople();
    people[currentEditingIndex].color = color;
    await savePeople(people);
    renderPeople();
    closeColorPicker();
}

// Allow Enter key to add person
document.addEventListener('DOMContentLoaded', async () => {
    await ensureDB();
    await loadTheme();
    await renderPeople();
    
    const input = document.getElementById('new-person-name');
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addPerson();
        }
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        const isInputFocused = document.activeElement === input;
        
        // Alt + N: Add new person (focus input)
        if (e.altKey && e.key.toLowerCase() === 'n') {
            e.preventDefault();
            input.focus();
        }
        
        // Alt + K: Toggle theme
        if (e.altKey && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            toggleTheme();
        }
        
        // Escape: Clear input
        if (e.key === 'Escape' && isInputFocused) {
            input.value = '';
            input.blur();
        }
    });
    
    // Close modal on outside click
    document.getElementById('color-picker-modal').addEventListener('click', (e) => {
        if (e.target.id === 'color-picker-modal') {
            closeColorPicker();
        }
    });
});
