import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
  getDatabase, ref, push, onValue, serverTimestamp, get, child, set, update
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBDo6UZCR44x2o0jCHilqI0_LimNuOrTso",
  authDomain: "oldbayhuffers.firebaseapp.com",
  databaseURL: "https://oldbayhuffers-default-rtdb.firebaseio.com",
  projectId: "oldbayhuffers",
  storageBucket: "oldbayhuffers.firebasestorage.app",
  messagingSenderId: "426339148612",
  appId: "1:426339148612:web:5cd0d527caa23b32016d11",
  measurementId: "G-DFHQ1WG2WP"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app); 
const dbRef = ref(db);

// Default PFP (Base64 encoded SVG)
const DEFAULT_PFP = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23999'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z'/%3E%3C/svg%3E";

// DOM Elements
const authScreen = document.getElementById('auth-screen');
const chatScreen = document.getElementById('chat-screen');
const usernameInput = document.getElementById('username'); 
const passwordInput = document.getElementById('password');
const authError = document.getElementById('auth-error');
const currentPfpImg = document.getElementById('current-pfp');
const currentUserSpan = document.getElementById('current-user');
const pfpUpload = document.getElementById('pfp-upload');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const messagesContainer = document.getElementById('messages-container');
const fileUpload = document.getElementById('file-upload');
const filePreview = document.getElementById('file-preview');
const filePreviewName = document.getElementById('file-preview-name');
const removeFileBtn = document.getElementById('remove-file-btn');
const chatError = document.getElementById('chat-error');

let unsubscribeMessages = null;
let currentActiveUser = null;
let currentUserPfp = DEFAULT_PFP;
let lastMessageTime = 0;
let attachedFileData = null;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// File to Base64 helper
const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result);
  reader.onerror = (error) => reject(error);
});

// Login Logic
async function logUserIn(username) {
  currentActiveUser = username;
  authScreen.classList.add('hidden');
  chatScreen.classList.remove('hidden');
  currentUserSpan.textContent = username;
  
  // Fetch user's PFP
  try {
    const snap = await get(child(dbRef, `users/${username}/pfp`));
    currentUserPfp = snap.exists() ? snap.val() : DEFAULT_PFP;
    currentPfpImg.src = currentUserPfp;
  } catch(e) {
    currentPfpImg.src = DEFAULT_PFP;
  }
  
  loadMessages();
}

const savedSession = localStorage.getItem('obh_session');
if (savedSession) {
  logUserIn(savedSession);
}

document.getElementById('login-btn').addEventListener('click', async (e) => {
  e.preventDefault();
  authError.textContent = 'Checking...';
  const username = usernameInput.value.trim().toLowerCase();
  const password = passwordInput.value;
  if (!username || !password) return (authError.textContent = "Enter both fields.");

  try {
    const snapshot = await get(child(dbRef, `users/${username}`));
    if (snapshot.exists() && snapshot.val().password === password) {
      localStorage.setItem('obh_session', username);
      authError.textContent = '';
      logUserIn(username);
    } else {
      authError.textContent = "Incorrect username or password.";
    }
  } catch (error) {
    authError.textContent = "Database error.";
  }
});

document.getElementById('signup-btn').addEventListener('click', async (e) => {
  e.preventDefault();
  authError.textContent = 'Checking...';
  const username = usernameInput.value.trim().toLowerCase();
  const password = passwordInput.value;
  if (username.length < 3 || password.length < 4) return (authError.textContent = "User>3 chars, Pass>4 chars.");

  try {
    const snapshot = await get(child(dbRef, `users/${username}`));
    if (snapshot.exists()) {
      authError.textContent = "Username taken.";
    } else {
      await set(ref(db, `users/${username}`), { password, pfp: DEFAULT_PFP, createdAt: serverTimestamp() });
      localStorage.setItem('obh_session', username);
      authError.textContent = '';
      logUserIn(username);
    }
  } catch (error) {
    authError.textContent = "Database error.";
  }
});

document.getElementById('logout-btn').addEventListener('click', () => {
  localStorage.removeItem('obh_session');
  currentActiveUser = null;
  authScreen.classList.remove('hidden');
  chatScreen.classList.add('hidden');
  if (unsubscribeMessages) unsubscribeMessages();
});

// PFP Upload
pfpUpload.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file || !currentActiveUser) return;
  if (file.size > MAX_FILE_SIZE) {
    alert("PFP must be under 5MB.");
    return;
  }
  try {
    const base64 = await fileToBase64(file);
    await update(ref(db, `users/${currentActiveUser}`), { pfp: base64 });
    currentUserPfp = base64;
    currentPfpImg.src = base64;
  } catch (err) {
    console.error("PFP upload error", err);
  }
});

// File Attachment handling
fileUpload.addEventListener('change', async (e) => {
  chatError.classList.add('hidden');
  const file = e.target.files[0];
  if (!file) return;
  
  if (file.size > MAX_FILE_SIZE) {
    chatError.textContent = "File exceeds 5MB limit.";
    chatError.classList.remove('hidden');
    fileUpload.value = "";
    return;
  }

  try {
    const base64 = await fileToBase64(file);
    attachedFileData = {
      name: file.name,
      type: file.type,
      data: base64
    };
    filePreviewName.textContent = file.name;
    filePreview.classList.remove('hidden');
  } catch (err) {
    console.error("File parsing error", err);
  }
});

removeFileBtn.addEventListener('click', () => {
  attachedFileData = null;
  fileUpload.value = "";
  filePreview.classList.add('hidden');
});

// Send Message (Anti-spam + Files)
messageForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  
  if (text === "" && !attachedFileData) return;
  
  // Anti-spam cooldown (1000 ms)
  const now = Date.now();
  if (now - lastMessageTime < 1000) {
    chatError.textContent = "Woah there, wait a second before sending another message!";
    chatError.classList.remove('hidden');
    return;
  }
  
  chatError.classList.add('hidden');
  lastMessageTime = now;

  const payload = {
    text: text,
    username: currentActiveUser,
    pfp: currentUserPfp,
    createdAt: serverTimestamp()
  };

  if (attachedFileData) {
    payload.file = attachedFileData;
  }

  // Clear inputs immediately for responsiveness
  messageInput.value = '';
  attachedFileData = null;
  fileUpload.value = "";
  filePreview.classList.add('hidden');

  try {
    await push(ref(db, "messages"), payload);
  } catch (error) {
    console.error("Error sending: ", error);
  }
});

// Load and Render Messages
function loadMessages() {
  const messagesRef = ref(db, "messages");
  
  unsubscribeMessages = onValue(messagesRef, (snapshot) => {
    messagesContainer.innerHTML = ''; 
    
    snapshot.forEach((childSnapshot) => {
      const data = childSnapshot.val();
      const messageDiv = document.createElement('div');
      messageDiv.classList.add('message');
      
      let timeString = 'Just now';
      if (data.createdAt) {
        timeString = new Date(data.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      }

      // Generate File HTML based on file type
      let fileHtml = "";
      if (data.file) {
        if (data.file.type.startsWith("image/")) {
          fileHtml = `<div class="attachment-container"><img src="${data.file.data}" alt="Image Attachment"></div>`;
        } else if (data.file.type.startsWith("video/")) {
          fileHtml = `<div class="attachment-container"><video controls src="${data.file.data}"></video></div>`;
        } else if (data.file.type.startsWith("audio/")) {
          fileHtml = `<div class="attachment-container"><audio controls src="${data.file.data}"></audio></div>`;
        } else {
          fileHtml = `<div class="attachment-container"><a href="${data.file.data}" download="${data.file.name}" class="download-link">Download ${data.file.name}</a></div>`;
        }
      }
      
      const pfpSrc = data.pfp || DEFAULT_PFP;

      messageDiv.innerHTML = `
        <img src="${pfpSrc}" class="msg-pfp" alt="PFP">
        <div class="msg-content">
          <div class="message-header">
            <span class="message-author">${data.username}</span>
            <span class="message-time">${timeString}</span>
          </div>
          <div class="message-text">${data.text}</div>
          ${fileHtml}
        </div>
      `;
      
      messagesContainer.appendChild(messageDiv);
    });
    
    // Auto-scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  });
}
