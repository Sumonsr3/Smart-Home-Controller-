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

  const gpioButtons = {
    gpio1: document.getElementById("gpio1Btn"),
    gpio2: document.getElementById("gpio2Btn"),
    gpio3: document.getElementById("gpio3Btn")
  };

  const gpioLabels = {
    gpio1: document.getElementById("gpio1Status"),
    gpio2: document.getElementById("gpio2Status"),
    gpio3: document.getElementById("gpio3Status")
  };

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
    ["gpio1", "gpio2", "gpio3"].forEach((key) => {
      onValue(ref(db, "/" + key), (snapshot) => {
        let value = snapshot.val() ? 1 : 0;
        updateUI(key, value);
      });
    });

    // Button click
    Object.values(gpioButtons).forEach((btn) => {
      btn.onclick = () => {
        let gpio = btn.dataset.gpio;
        let newState = btn.classList.contains("on") ? 0 : 1;
        set(ref(db, "/" + gpio), newState);
      };
    });
  }

  // Update UI
  function updateUI(key, val) {
    let btn = gpioButtons[key];
    let lab = gpioLabels[key];

    if (val === 1) {
      btn.classList.add("on");
      lab.textContent = "Status: ON";
      lab.style.color = "#9effae";
    } else {
      btn.classList.remove("on");
      lab.textContent = "Status: OFF";
      lab.style.color = "#d1d1d1";
    }
  }


