import { db } from './firebase-config.js';
import {
    collection, addDoc, updateDoc, doc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// --- State ---
let currentUser = null;
let currentClubId = null;
const NO_COVER_IMAGE = 'no_cover.png';
let searchResultsData = {};

// Profanity Filter (Bad words)
const BAD_WORDS = ['badword1', 'badword2', 'swear', 'curse']; 
function censorText(text) {
    let clean = text;
    BAD_WORDS.forEach(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        clean = clean.replace(regex, '***');
    });
    return clean;
}

// --- DOM Elements ---
// Nav & Views
const navTabs = document.querySelectorAll('.nav-tab');
const viewSections = document.querySelectorAll('.view-section');

// Auth
const authModal = document.getElementById('auth-modal');
const loginForm = document.getElementById('login-form');
const usernameInput = document.getElementById('username-input');
const userDisplay = document.getElementById('user-display');

// Search
const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');
const searchResultsContainer = document.getElementById('search-results');
const searchQueryDisplay = document.getElementById('search-query-display');
const loadingMsg = document.getElementById('loading-msg');

// Library
const wantToReadContainer = document.getElementById('library-want-to-read');
const readContainer = document.getElementById('library-read');
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Book Modal
const bookModal = document.getElementById('book-modal');
const closeBookModal = document.getElementById('close-book-modal');

// Clubs
const clubsGrid = document.getElementById('clubs-grid');
const btnCreateClub = document.getElementById('btn-create-club');
const activeClubView = document.getElementById('active-club-view');
const btnBackClubs = document.getElementById('btn-back-clubs');
const clubChatHistory = document.getElementById('club-chat-history');
const clubChatForm = document.getElementById('club-chat-form');
const clubInput = document.getElementById('club-input');
const activeClubHeader = document.getElementById('active-club-header');

// --- Initialization ---
function init() {
    checkAuth();
    setupNavigation();
    setupLibraryTabs();
    setupEventListeners();
    
    try {
        loadLibraryRealtime();
        loadClubsRealtime();
    } catch(e) { console.warn("Firebase not setup"); }
}

function checkAuth() {
    const saved = localStorage.getItem('lumina_username');
    if (saved) {
        currentUser = saved;
        userDisplay.textContent = currentUser;
        authModal.classList.remove('active');
    }
}

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    currentUser = censorText(usernameInput.value.trim());
    localStorage.setItem('lumina_username', currentUser);
    userDisplay.textContent = currentUser;
    authModal.classList.remove('active');
});

function setupNavigation() {
    document.getElementById('home-btn').addEventListener('click', () => switchTab('search-view'));
    navTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            navTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            switchTab(tab.dataset.target);
        });
    });
}

function switchTab(viewId) {
    viewSections.forEach(section => {
        section.classList.remove('active');
        if (section.id === viewId) section.classList.add('active');
    });
    // Hide active club if switching away
    if (viewId === 'clubs-view') {
        activeClubView.classList.add('hidden');
        clubsGrid.classList.remove('hidden');
    }
}

function setupLibraryTabs() {
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            tabButtons.forEach(t => t.classList.remove('active'));
            btn.classList.add('active');
            tabContents.forEach(content => {
                content.classList.remove('active');
                content.classList.add('hidden');
                if (content.id === `library-${tabId}`) {
                    content.classList.remove('hidden');
                    content.classList.add('active');
                }
            });
        });
    });
}

// --- Search Flow ---
searchForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = searchInput.value.trim();
    if (!query) return;

    searchQueryDisplay.textContent = `results for "${query}"`;
    searchResultsContainer.innerHTML = '';
    loadingMsg.classList.remove('hidden');
    searchResultsData = {};

    try {
        const response = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=12`);
        const data = await response.json();
        
        loadingMsg.classList.add('hidden');

        if (data.docs.length === 0) {
            searchResultsContainer.innerHTML = `<p style="color: var(--text-muted)">No books found. Try a different search.</p>`;
        } else {
            const validDocs = data.docs.filter(d => d.title && d.key).slice(0, 12);
            
            searchResultsContainer.innerHTML = validDocs.map((doc, index) => {
                const cover = doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : NO_COVER_IMAGE;
                searchResultsData[doc.key] = {
                    id: doc.key,
                    title: doc.title,
                    author: doc.author_name ? doc.author_name.join(', ') : 'Unknown Author',
                    coverUrl: cover,
                    genres: doc.subject ? doc.subject.slice(0, 2) : ['General'],
                    ageRating: (doc.subject||[]).some(s=>s.toLowerCase().includes('juvenile')) ? 'Kids/YA' : 'General'
                };
                return `
                <div class="book-card" data-key="${doc.key}" style="animation: fadeIn 0.4s ease ${index * 0.05}s forwards; opacity: 0;">
                    <img src="${cover}" class="book-cover" onerror="this.src='${NO_COVER_IMAGE}'">
                    <div class="book-info">
                        <h3 class="book-title">${doc.title}</h3>
                        <p class="book-author">${searchResultsData[doc.key].author}</p>
                        <div class="book-tags">
                            <span class="tag age-rating">${searchResultsData[doc.key].ageRating}</span>
                            ${searchResultsData[doc.key].genres.map(g => `<span class="tag">${g}</span>`).join('')}
                        </div>
                        <div class="book-actions">
                            <button class="btn-save" data-action="search-save" data-key="${doc.key}">Save to Library</button>
                        </div>
                    </div>
                </div>`;
            }).join('');
        }
    } catch (e) {
        loadingMsg.classList.add('hidden');
        console.error(e);
        searchResultsContainer.innerHTML = `<p style="color: #ef4444;">Failed to fetch results. Connection error.</p>`;
    }
});

// --- Book Interactions ---
function setupEventListeners() {
    // Global delegation for dynamic content
    document.body.addEventListener('click', async (e) => {
        const target = e.target;
        
        // Search Save
        if (target.dataset.action === 'search-save') {
            e.stopPropagation();
            const book = searchResultsData[target.dataset.key];
            if(book) saveBook(book);
            target.textContent = "Saved!";
            target.disabled = true;
            return;
        }

        // Click on a Book Card -> Open Modal
        const card = target.closest('.book-card');
        if (card && !target.classList.contains('btn-save') && !target.classList.contains('btn-action') && !target.classList.contains('btn-delete')) {
            const key = card.dataset.key;
            if(key) openBookModal(key, card.querySelector('.book-title').textContent);
        }

        // Library actions
        if (target.dataset.action === 'mark-read') updateBookStatus(target.dataset.id, 'read');
        if (target.dataset.action === 'mark-want') updateBookStatus(target.dataset.id, 'want-to-read');
        if (target.dataset.action === 'delete') deleteLibraryBook(target.dataset.id);
        
        // Join Club
        if (target.dataset.action === 'join-club') {
            openClubChat(target.dataset.id, target.dataset.name);
        }
    });

    closeBookModal.addEventListener('click', () => bookModal.classList.remove('active'));
}

async function openBookModal(workKey, fallbackTitle) {
    bookModal.classList.add('active');
    document.getElementById('modal-title').textContent = fallbackTitle || "Loading...";
    document.getElementById('modal-author').textContent = "";
    document.getElementById('modal-desc').innerHTML = "";
    document.getElementById('modal-spinner').classList.remove('hidden');
    document.getElementById('modal-cover').src = NO_COVER_IMAGE;

    try {
        const response = await fetch(`https://openlibrary.org${workKey}.json`);
        const data = await response.json();
        
        document.getElementById('modal-title').textContent = data.title || fallbackTitle;
        document.getElementById('modal-spinner').classList.add('hidden');
        
        // Handle descriptions which can be strings or objects
        let desc = data.description || "No overview available for this book.";
        if (typeof desc === 'object') desc = desc.value;
        document.getElementById('modal-desc').innerHTML = desc.replace(/\n/g, '<br>');
        
        if (data.covers && data.covers.length > 0) {
            document.getElementById('modal-cover').src = `https://covers.openlibrary.org/b/id/${data.covers[0]}-L.jpg`;
        }

        document.getElementById('modal-link').href = `https://openlibrary.org${workKey}`;
    } catch (e) {
        document.getElementById('modal-spinner').classList.add('hidden');
        document.getElementById('modal-desc').textContent = "Failed to load book details.";
    }
}

// --- Firebase Library Operations ---
async function saveBook(bookObj) {
    try {
        await addDoc(collection(db, "books"), {
            ...bookObj,
            status: 'want-to-read',
            addedBy: currentUser,
            addedAt: serverTimestamp()
        });
    } catch (error) {
        console.error("Save error:", error);
    }
}

async function updateBookStatus(id, newStatus) {
    await updateDoc(doc(db, "books", id), { status: newStatus });
}
async function deleteLibraryBook(id) {
    if (confirm("Remove this book?")) await deleteDoc(doc(db, "books", id));
}

function loadLibraryRealtime() {
    onSnapshot(collection(db, "books"), (snapshot) => {
        const books = [];
        snapshot.forEach(doc => books.push({ dbId: doc.id, ...doc.data() }));
        
        const wantToRead = books.filter(b => b.status === 'want-to-read');
        const read = books.filter(b => b.status === 'read');

        wantToReadContainer.innerHTML = wantToRead.length ? wantToRead.map(b => generateLibraryCard(b)).join('') : '<p>No books here.</p>';
        readContainer.innerHTML = read.length ? read.map(b => generateLibraryCard(b)).join('') : '<p>No books here.</p>';
    });
}

function generateLibraryCard(book) {
    const isRead = book.status === 'read';
    return `
        <div class="book-card" data-key="${book.id}">
            <img src="${book.coverUrl}" class="book-cover" onerror="this.src='${NO_COVER_IMAGE}'">
            <div class="book-info">
                <h3 class="book-title">${book.title}</h3>
                <p class="book-author">${book.author}</p>
                <div class="book-tags">
                    <span class="tag age-rating">${book.ageRating || 'General'}</span>
                    ${(book.genres || []).map(g => `<span class="tag">${g}</span>`).join('')}
                </div>
                <div class="book-actions">
                    ${!isRead 
                        ? `<button class="btn-action read" data-id="${book.dbId}" data-action="mark-read">Mark as Read</button>` 
                        : `<button class="btn-action want-read" data-id="${book.dbId}" data-action="mark-want">Move to Want</button>`}
                    <button class="btn-delete" data-id="${book.dbId}" data-action="delete">✕</button>
                </div>
            </div>
        </div>`;
}

// --- Clubs & Chat ---
btnCreateClub.addEventListener('click', async () => {
    const name = prompt("Enter club name:");
    if (!name) return;
    try {
        await addDoc(collection(db, "clubs"), { name: censorText(name), createdBy: currentUser, createdAt: serverTimestamp() });
    } catch(e) { alert("Failed to create club. Check rules."); }
});

function loadClubsRealtime() {
    const q = query(collection(db, "clubs"), orderBy("createdAt", "desc"));
    onSnapshot(q, (snapshot) => {
        let html = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            html += `
            <div class="club-card glass">
                <h3>${data.name}</h3>
                <p class="club-meta">Created by ${data.createdBy}</p>
                <button class="btn-primary" style="margin-top:auto;" data-action="join-club" data-id="${doc.id}" data-name="${data.name}">Enter Club Chat</button>
            </div>`;
        });
        clubsGrid.innerHTML = html || "<p>No clubs yet. Create one!</p>";
    });
}

let chatUnsubscribe = null;
function openClubChat(clubId, clubName) {
    clubsGrid.classList.add('hidden');
    activeClubView.classList.remove('hidden');
    activeClubHeader.textContent = `Club Chat: ${clubName}`;
    currentClubId = clubId;
    
    if (chatUnsubscribe) chatUnsubscribe();
    
    const q = query(collection(db, `clubs/${clubId}/messages`), orderBy("timestamp", "asc"));
    chatUnsubscribe = onSnapshot(q, (snapshot) => {
        clubChatHistory.innerHTML = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            const isMe = data.sender === currentUser;
            appendMessage(isMe ? 'user-message' : 'bot-message', censorText(data.text), clubChatHistory);
            // Replace bot avatar with sender name
            const lastMsg = clubChatHistory.lastChild;
            if(!isMe) {
                lastMsg.innerHTML = `<div><div style="font-size: 0.7rem; color: var(--accent-3); margin-bottom:0.2rem;">${data.sender}</div><div class="bubble">${censorText(data.text)}</div></div>`;
            }
        });
    });
}

btnBackClubs.addEventListener('click', () => {
    clubsGrid.classList.remove('hidden');
    activeClubView.classList.add('hidden');
    if (chatUnsubscribe) chatUnsubscribe();
    currentClubId = null;
});

clubChatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentClubId) return;
    const text = clubInput.value.trim();
    if (!text) return;
    clubInput.value = '';
    
    try {
        await addDoc(collection(db, `clubs/${currentClubId}/messages`), {
            text: censorText(text), // censor locally before saving
            sender: currentUser,
            timestamp: serverTimestamp()
        });
    } catch(e) { console.error("Chat error:", e); }
});

init();
