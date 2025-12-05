import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  getDatabase,
  ref,
  set,
  onValue
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAzOuFlqKueEdbPPH83moT9wFgidm8TVBM",
  authDomain: "smart-home-controller-b3004.firebaseapp.com",
  databaseURL: "https://smart-home-controller-b3004-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "smart-home-controller-b3004",
  storageBucket: "smart-home-controller-b3004.firebasestorage.app",
  messagingSenderId: "471259029586",
  appId: "1:471259029586:web:6f489f0e3b229593523f8b"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getDatabase(app);

// UI elements
const authBox = document.getElementById("authBox");
const controlBox = document.getElementById("controlBox");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const authMsg = document.getElementById("authMsg");
const badge = document.getElementById("statusBadge");

// List of all GPIO keys
const gpioList = ["gpio1", "gpio2", "gpio3", "gpio4", "gpio5", "gpio6"];

// Collect buttons and labels dynamically
const gpioButtons = {};
const gpioLabels = {};

// Fill the objects including Master
const allKeys = [...gpioList, "master"];

allKeys.forEach(key => {
  gpioButtons[key] = document.getElementById(key + "Btn");
  gpioLabels[key] = document.getElementById(key + "Status");
});

// Login
loginBtn.onclick = async () => {
  authMsg.textContent = "";
  try {
    await signInWithEmailAndPassword(
      auth,
      document.getElementById("emailField").value,
      document.getElementById("passwordField").value
    );
  } catch (e) {
    authMsg.textContent = e.message;
  }
};

logoutBtn.onclick = () => signOut(auth);

// Auth state monitor
onAuthStateChanged(auth, (user) => {
  if (user) {
    authBox.style.display = "none";
    controlBox.style.display = "block";
    badge.className = "status-badge online";
    badge.textContent = "Online";
    startListeners();
  } else {
    authBox.style.display = "block";
    controlBox.style.display = "none";
    badge.className = "status-badge offline";
    badge.textContent = "Offline";
  }
});

// Listen to DB
function startListeners() {
  // Loop through all GPIOs + Master to listen for changes
  allKeys.forEach((key) => {
    onValue(ref(db, "/" + key), (snapshot) => {
      let value = snapshot.val() ? 1 : 0;
      updateUI(key, value);
    });
  });

  // Handle Button Clicks
  Object.keys(gpioButtons).forEach((key) => {
    let btn = gpioButtons[key];
    
    btn.onclick = () => {
      let newState = btn.classList.contains("on") ? 0 : 1;

      if (key === "master") {
        // If Master is clicked, update Master AND all GPIOs
        let updates = {};
        updates["/master"] = newState;
        gpioList.forEach(gpio => {
          updates["/" + gpio] = newState;
        });
        
        // Use update() or set individually. Here we set individually for simplicity
        set(ref(db, "/master"), newState);
        gpioList.forEach(gpio => {
          set(ref(db, "/" + gpio), newState);
        });

      } else {
        // Normal GPIO click
        set(ref(db, "/" + key), newState);
      }
    };
  });
}

// Update UI
function updateUI(key, val) {
  let btn = gpioButtons[key];
  let lab = gpioLabels[key];

  if (!btn || !lab) return;

  if (val === 1) {
    btn.classList.add("on");
    lab.textContent = "Status: ON";
    lab.style.color = (key === 'master') ? "#333" : "#9effae"; // Dark text for master ON
  } else {
    btn.classList.remove("on");
    lab.textContent = "Status: OFF";
    lab.style.color = "#d1d1d1";
  }
}
