import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
  getDatabase, ref, push, onValue, serverTimestamp, get, child, set 
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

// DOM Elements
const authScreen = document.getElementById('auth-screen');
const chatScreen = document.getElementById('chat-screen');
const usernameInput = document.getElementById('username'); 
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('login-btn');
const signupBtn = document.getElementById('signup-btn');
const authError = document.getElementById('auth-error');
const logoutBtn = document.getElementById('logout-btn');
const currentUserSpan = document.getElementById('current-user');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const messagesContainer = document.getElementById('messages-container');

let unsubscribeMessages = null;
let currentActiveUser = null;

// Helper to switch screens and load chat
function logUserIn(username) {
  currentActiveUser = username;
  authScreen.classList.add('hidden');
  chatScreen.classList.remove('hidden');
  currentUserSpan.textContent = username;
  loadMessages();
}

// Check if user is already logged in via Local Storage on page load
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

  if (username === "" || password === "") {
    authError.textContent = "Please enter both username and password.";
    return;
  }

  try {
    const snapshot = await get(child(dbRef, `users/${username}`));
    if (snapshot.exists()) {
      const userData = snapshot.val();
      if (userData.password === password) {
        // Password matches! Save session and log in
        localStorage.setItem('obh_session', username);
        authError.textContent = '';
        logUserIn(username);
      } else {
        authError.textContent = "Incorrect password.";
      }
    } else {
      authError.textContent = "User not found. Try creating an account.";
    }
  } catch (error) {
    authError.textContent = "Error connecting to database.";
    console.error(error);
  }
});

// Sign Up
signupBtn.addEventListener('click', async (e) => {
  e.preventDefault();
  authError.textContent = 'Checking...';

  const username = usernameInput.value.trim().toLowerCase();
  const password = passwordInput.value;
  
  if (username.length < 3) {
    authError.textContent = "Username must be at least 3 characters.";
    return;
  }
  if (password.length < 4) {
    authError.textContent = "Password must be at least 4 characters.";
    return;
  }

  try {
    const snapshot = await get(child(dbRef, `users/${username}`));
    if (snapshot.exists()) {
      authError.textContent = "Username is already taken.";
    } else {
      // Username is free, save it to the database
      await set(ref(db, `users/${username}`), {
        password: password,
        createdAt: serverTimestamp()
      });
      
      // Save session and log in
      localStorage.setItem('obh_session', username);
      authError.textContent = '';
      logUserIn(username);
    }
  } catch (error) {
    authError.textContent = "Error connecting to database.";
    console.error(error);
  }
});

// Logout
logoutBtn.addEventListener('click', () => {
  localStorage.removeItem('obh_session');
  currentActiveUser = null;
  authScreen.classList.remove('hidden');
  chatScreen.classList.add('hidden');
  if (unsubscribeMessages) unsubscribeMessages();
  usernameInput.value = '';
  passwordInput.value = '';
});

// Send Message
messageForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (text === "" || !currentActiveUser) return;

  try {
    await push(ref(db, "messages"), {
      text: text,
      username: currentActiveUser, 
      createdAt: serverTimestamp()
    });
    messageInput.value = '';
  } catch (error) {
    console.error("Error writing message: ", error);
  }
});

// Load and Listen to Messages
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
      
      messageDiv.innerHTML = `
        <div class="message-header">
          <span class="message-author">${data.username}</span>
          <span class="message-time">${timeString}</span>
        </div>
        <div class="message-text">${data.text}</div>
      `;
      
      messagesContainer.appendChild(messageDiv);
    });
    
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  });
}
