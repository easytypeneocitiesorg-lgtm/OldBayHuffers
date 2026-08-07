import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
  getDatabase, ref, push, onValue, serverTimestamp, get, child, set, update, remove
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

const DEFAULT_PFP = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23999'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z'/%3E%3C/svg%3E";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// DOM Elements
const authScreen = document.getElementById('auth-screen');
const chatScreen = document.getElementById('chat-screen');
const usernameInput = document.getElementById('username'); 
const passwordInput = document.getElementById('password');
const authError = document.getElementById('auth-error');
const currentPfpImg = document.getElementById('current-pfp');
const currentUserSpan = document.getElementById('current-user');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const messagesContainer = document.getElementById('messages-container');
const fileUpload = document.getElementById('file-upload');
const filePreview = document.getElementById('file-preview');
const filePreviewName = document.getElementById('file-preview-name');
const chatError = document.getElementById('chat-error');
const typingIndicator = document.getElementById('typing-indicator');

// Signup Specific
const loginFields = document.getElementById('login-fields');
const ageGroup = document.getElementById('age-group');
const ageSelect = document.getElementById('age-select');
const loginBtn = document.getElementById('login-btn');
const signupBtn = document.getElementById('signup-btn');

let unsubscribeMessages = null;
let unsubscribeTyping = null;
let currentActiveUser = null;
let currentUserData = {};
let lastMessageTime = 0;
let attachedFileData = null;
let currentChannel = "main"; // "main" or "staff"
let typingTimeout = null;

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result);
  reader.onerror = (error) => reject(error);
});

async function logUserIn(username) {
  currentActiveUser = username;
  authScreen.classList.add('hidden');
  chatScreen.classList.remove('hidden');
  
  try {
    const snap = await get(child(dbRef, `users/${username}`));
    if(snap.exists()){
      currentUserData = snap.val();
      if(!currentUserData.pfp) currentUserData.pfp = DEFAULT_PFP;
    }
    
    currentPfpImg.src = currentUserData.pfp;
    currentUserSpan.innerHTML = username + (currentUserData.isStaff ? ' <span class="staff-badge">🛡️</span>' : '');
  } catch(e) {
    console.error(e);
  }
  
  switchChannel('main');
}

// Session check
const savedSession = localStorage.getItem('obh_session');
if (savedSession) {
  logUserIn(savedSession);
}

// Login
loginBtn.addEventListener('click', async (e) => {
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

// Signup logic (Two steps: Check username, then ask Age)
signupBtn.addEventListener('click', async (e) => {
  e.preventDefault();
  const username = usernameInput.value.trim().toLowerCase();
  const password = passwordInput.value;

  // Step 1: Validate and show Age dropdown
  if (ageGroup.classList.contains('hidden')) {
    if (username.length < 3 || password.length < 4) {
      authError.textContent = "Username > 3 chars, Password > 4 chars.";
      return;
    }
    authError.textContent = "Checking username...";
    try {
      const snapshot = await get(child(dbRef, `users/${username}`));
      if (snapshot.exists()) {
        authError.textContent = "Username is already taken.";
        return;
      }
      // Hide login fields, show age
      authError.textContent = "";
      loginFields.classList.add('hidden');
      loginBtn.classList.add('hidden');
      ageGroup.classList.remove('hidden');
      signupBtn.textContent = "Complete Account";
    } catch (e) {
      authError.textContent = "Database error.";
    }
  } 
  // Step 2: Finalize Creation
  else {
    authError.textContent = "Creating account...";
    const age = ageSelect.value;
    try {
      await set(ref(db, `users/${username}`), { 
        password, 
        pfp: DEFAULT_PFP, 
        age: age,
        isStaff: false,
        createdAt: serverTimestamp() 
      });
      localStorage.setItem('obh_session', username);
      authError.textContent = '';
      logUserIn(username);
      
      // Reset UI for next time
      loginFields.classList.remove('hidden');
      loginBtn.classList.remove('hidden');
      ageGroup.classList.add('hidden');
      signupBtn.textContent = "Create Account";
    } catch (error) {
      authError.textContent = "Database error.";
    }
  }
});

document.getElementById('logout-btn').addEventListener('click', () => {
  localStorage.removeItem('obh_session');
  currentActiveUser = null;
  currentUserData = {};
  authScreen.classList.remove('hidden');
  chatScreen.classList.add('hidden');
  if (unsubscribeMessages) unsubscribeMessages();
  if (unsubscribeTyping) unsubscribeTyping();
});

// PFP Upload
document.getElementById('pfp-upload').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file || !currentActiveUser) return;
  if (file.size > MAX_FILE_SIZE) return alert("PFP must be under 5MB.");
  
  try {
    const base64 = await fileToBase64(file);
    await update(ref(db, `users/${currentActiveUser}`), { pfp: base64 });
    currentUserData.pfp = base64;
    currentPfpImg.src = base64;
  } catch (err) { console.error(err); }
});

// Click Username to see Age
messagesContainer.addEventListener('click', async (e) => {
  if (e.target.classList.contains('message-author')) {
    const clickedUser = e.target.dataset.username;
    try {
      const snap = await get(child(dbRef, `users/${clickedUser}/age`));
      if(snap.exists()) {
        alert(`${clickedUser} is ${snap.val()} years old.`);
      } else {
        alert(`${clickedUser}'s age is not set.`);
      }
    } catch(err) { console.error(err); }
  }
});

// Channel Switching & Staff Verification
document.querySelectorAll('.channel').forEach(el => {
  el.addEventListener('click', async () => {
    const targetChannel = el.dataset.channel;
    if(targetChannel === currentChannel) return;

    if(targetChannel === 'staff' && !currentUserData.isStaff) {
      const code = prompt("Enter an admin code to unlock Staff Chat:");
      if(!code) return;

      try {
        // Read codes.txt
        const res = await fetch('codes.txt');
        if(!res.ok) throw new Error("Could not load codes file.");
        const text = await res.text();
        const validCodes = text.split('\n').map(c => c.trim()).filter(c => c !== "");

        if(validCodes.includes(code)) {
          // Check if code was already claimed in database
          const claimCheck = await get(child(dbRef, `used_codes/${code}`));
          if(claimCheck.exists()) {
            alert("This code has already been used!");
            return;
          }
          
          // Claim code and grant staff
          await set(ref(db, `used_codes/${code}`), currentActiveUser);
          await update(ref(db, `users/${currentActiveUser}`), { isStaff: true });
          currentUserData.isStaff = true;
          currentUserSpan.innerHTML = currentActiveUser + ' <span class="staff-badge">🛡️</span>';
          alert("Access Granted! You are now Staff.");
        } else {
          alert("Invalid code.");
          return;
        }
      } catch(err) {
        alert("Error verifying code.");
        console.error(err);
        return;
      }
    }

    switchChannel(targetChannel);
  });
});

function switchChannel(channelName) {
  currentChannel = channelName;
  document.querySelectorAll('.channel').forEach(c => c.classList.remove('active'));
  document.querySelector(`.channel[data-channel="${channelName}"]`).classList.add('active');
  document.getElementById('current-channel-title').textContent = channelName === 'main' ? "# main-chat" : "# staff-chat";
  
  if (unsubscribeMessages) unsubscribeMessages();
  if (unsubscribeTyping) unsubscribeTyping();
  
  loadMessages();
  listenToTyping();
}

// Typing Indicator Logic
messageInput.addEventListener('input', () => {
  if (!currentActiveUser) return;
  set(ref(db, `typing/${currentChannel}/${currentActiveUser}`), true);
  
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    remove(ref(db, `typing/${currentChannel}/${currentActiveUser}`));
  }, 1000);
});

function listenToTyping() {
  unsubscribeTyping = onValue(ref(db, `typing/${currentChannel}`), (snapshot) => {
    const typers = [];
    snapshot.forEach((childSnap) => {
      if (childSnap.key !== currentActiveUser && childSnap.val() === true) {
        typers.push(childSnap.key);
      }
    });

    if (typers.length > 0) {
      typingIndicator.textContent = typers.join(', ') + (typers.length > 1 ? " are typing..." : " is typing...");
      typingIndicator.classList.remove('hidden');
    } else {
      typingIndicator.classList.add('hidden');
    }
  });
}

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
    attachedFileData = { name: file.name, type: file.type, data: base64 };
    filePreviewName.textContent = file.name;
    filePreview.classList.remove('hidden');
  } catch (err) { console.error(err); }
});

document.getElementById('remove-file-btn').addEventListener('click', () => {
  attachedFileData = null;
  fileUpload.value = "";
  filePreview.classList.add('hidden');
});

// Send Message
messageForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (text === "" && !attachedFileData) return;
  
  const now = Date.now();
  if (now - lastMessageTime < 1000) {
    chatError.textContent = "Wait a second before sending another message!";
    chatError.classList.remove('hidden');
    return;
  }
  
  chatError.classList.add('hidden');
  lastMessageTime = now;

  const payload = {
    text: text,
    username: currentActiveUser,
    pfp: currentUserData.pfp,
    isStaff: currentUserData.isStaff || false,
    createdAt: serverTimestamp()
  };

  if (attachedFileData) payload.file = attachedFileData;

  messageInput.value = '';
  attachedFileData = null;
  fileUpload.value = "";
  filePreview.classList.add('hidden');
  
  // Clear typing status instantly on send
  remove(ref(db, `typing/${currentChannel}/${currentActiveUser}`));

  try {
    await push(ref(db, `messages_${currentChannel}`), payload);
  } catch (error) { console.error(error); }
});

// Load Messages
function loadMessages() {
  const messagesRef = ref(db, `messages_${currentChannel}`);
  
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

      let fileHtml = "";
      if (data.file) {
        if (data.file.type.startsWith("image/")) {
          fileHtml = `<div class="attachment-container"><img src="${data.file.data}"></div>`;
        } else if (data.file.type.startsWith("video/")) {
          fileHtml = `<div class="attachment-container"><video controls src="${data.file.data}"></video></div>`;
        } else if (data.file.type.startsWith("audio/")) {
          fileHtml = `<div class="attachment-container"><audio controls src="${data.file.data}"></audio></div>`;
        } else {
          fileHtml = `<div class="attachment-container"><a href="${data.file.data}" download="${data.file.name}" class="download-link">Download ${data.file.name}</a></div>`;
        }
      }
      
      const badge = data.isStaff ? ' <span class="staff-badge" title="Staff Member">🛡️</span>' : '';

      messageDiv.innerHTML = `
        <img src="${data.pfp || DEFAULT_PFP}" class="msg-pfp" alt="PFP">
        <div class="msg-content">
          <div class="message-header">
            <span class="message-author" data-username="${data.username}">${data.username}</span>${badge}
            <span class="message-time">${timeString}</span>
          </div>
          <div class="message-text">${data.text}</div>
          ${fileHtml}
        </div>
      `;
      
      messagesContainer.appendChild(messageDiv);
    });
    
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  });
}
