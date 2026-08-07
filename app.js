import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, 
  onAuthStateChanged, signOut 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
  getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// REPLACE THIS with your Firebase config object
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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements
const authScreen = document.getElementById('auth-screen');
const chatScreen = document.getElementById('chat-screen');
const emailInput = document.getElementById('email');
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

// Listen for Login State (This handles the persistent login)
onAuthStateChanged(auth, (user) => {
  if (user) {
    // User is logged in
    authScreen.classList.add('hidden');
    chatScreen.classList.remove('hidden');
    currentUserSpan.textContent = user.email.split('@')[0]; // Simple username
    loadMessages();
  } else {
    // User is logged out
    authScreen.classList.remove('hidden');
    chatScreen.classList.add('hidden');
    if (unsubscribeMessages) unsubscribeMessages();
  }
});

// Login
loginBtn.addEventListener('click', async (e) => {
  e.preventDefault();
  try {
    await signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
    authError.textContent = '';
  } catch (error) {
    authError.textContent = error.message;
  }
});

// Sign Up
signupBtn.addEventListener('click', async (e) => {
  e.preventDefault();
  try {
    await createUserWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
    authError.textContent = '';
  } catch (error) {
    authError.textContent = error.message;
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

  try {
    await addDoc(collection(db, "messages"), {
      text: text,
      uid: auth.currentUser.uid,
      email: auth.currentUser.email,
      createdAt: serverTimestamp()
    });
    messageInput.value = '';
  } catch (error) {
    console.error("Error writing message: ", error);
  }
});

// Load and Listen to Messages
function loadMessages() {
  const q = query(collection(db, "messages"), orderBy("createdAt", "asc"));
  
  unsubscribeMessages = onSnapshot(q, (snapshot) => {
    messagesContainer.innerHTML = ''; // Clear current messages
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      const messageDiv = document.createElement('div');
      messageDiv.classList.add('message');
      
      // Format time safely (serverTimestamp might be null briefly while saving)
      let timeString = 'Just now';
      if (data.createdAt) {
        timeString = data.createdAt.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      }
      
      messageDiv.innerHTML = `
        <div class="message-header">
          <span class="message-author">${data.email.split('@')[0]}</span>
          <span class="message-time">${timeString}</span>
        </div>
        <div class="message-text">${data.text}</div>
      `;
      
      messagesContainer.appendChild(messageDiv);
    });
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  });
}
