import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, 
  onAuthStateChanged, signOut 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
  getDatabase, ref, push, onValue, serverTimestamp 
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
const auth = getAuth(app);
const db = getDatabase(app); 

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

// Helper function to turn username into a fake email for Firebase Auth
const formatUsernameForAuth = (username) => {
  const safeName = username.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${safeName}@obh.local`;
};

// Listen for Login State
onAuthStateChanged(auth, (user) => {
  if (user) {
    authScreen.classList.add('hidden');
    chatScreen.classList.remove('hidden');
    currentUserSpan.textContent = user.email.split('@')[0]; 
    loadMessages();
  } else {
    authScreen.classList.remove('hidden');
    chatScreen.classList.add('hidden');
    if (unsubscribeMessages) unsubscribeMessages();
  }
});

// Login
loginBtn.addEventListener('click', async (e) => {
  e.preventDefault();
  const fakeEmail = formatUsernameForAuth(usernameInput.value);
  try {
    await signInWithEmailAndPassword(auth, fakeEmail, passwordInput.value);
    authError.textContent = '';
  } catch (error) {
    authError.textContent = "Invalid username or password.";
  }
});

// Sign Up
signupBtn.addEventListener('click', async (e) => {
  e.preventDefault();
  const fakeEmail = formatUsernameForAuth(usernameInput.value);
  
  if (usernameInput.value.trim().length < 3) {
    authError.textContent = "Username must be at least 3 characters.";
    return;
  }

  try {
    await createUserWithEmailAndPassword(auth, fakeEmail, passwordInput.value);
    authError.textContent = '';
  } catch (error) {
    if (error.code === 'auth/email-already-in-use') {
      authError.textContent = "Username is already taken.";
    } else {
      authError.textContent = error.message;
    }
  }
});

// Logout
logoutBtn.addEventListener('click', () => {
  signOut(auth);
});

// Send Message
messageForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (text === "") return;

  const displayUsername = auth.currentUser.email.split('@')[0];

  try {
    // Push adds a unique ID automatically in Realtime Database
    await push(ref(db, "messages"), {
      text: text,
      uid: auth.currentUser.uid,
      username: displayUsername, 
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
    
    // Realtime DB uses push IDs which are chronologically ordered by default
    snapshot.forEach((childSnapshot) => {
      const data = childSnapshot.val();
      const messageDiv = document.createElement('div');
      messageDiv.classList.add('message');
      
      let timeString = 'Just now';
      if (data.createdAt) {
        // Realtime DB saves timestamps as numbers (milliseconds)
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
