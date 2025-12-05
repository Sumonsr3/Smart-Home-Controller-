import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

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
// --- কনফিগারেশন শেষ ---

const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getDatabase(app);

// Elements
const authContainer = document.getElementById("authContainer");
const appContainer = document.getElementById("appContainer");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const authMsg = document.getElementById("authMsg");
const badge = document.getElementById("statusBadge");
const saveNamesBtn = document.getElementById("saveNamesBtn");
const saveTimerBtn = document.getElementById("saveTimerBtn");

const gpioList = ["gpio1", "gpio2", "gpio3", "gpio4", "gpio5", "gpio6"];
const gpioButtons = {};
const gpioLabels = {}; // For the device Name text (e.g. "Kitchen Light")

// Initialize Buttons and Label Elements
[...gpioList, "master"].forEach(key => {
  gpioButtons[key] = document.getElementById(key + "Btn");
});
gpioList.forEach(key => {
  gpioLabels[key] = document.getElementById("label_" + key);
});

// --- Auth Logic ---
loginBtn.onclick = async () => {
  authMsg.textContent = "Please wait...";
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

onAuthStateChanged(auth, (user) => {
  if (user) {
    authContainer.style.display = "none";
    appContainer.style.display = "block";
    badge.className = "status-badge online";
    badge.textContent = "Online";
    startApp();
  } else {
    authContainer.style.display = "flex";
    appContainer.style.display = "none";
    badge.className = "status-badge offline";
    badge.textContent = "Offline";
  }
});

function startApp() {
  
  // 1. Listen for GPIO Status (ON/OFF)
  [...gpioList, "master"].forEach((key) => {
    onValue(ref(db, "/" + key), (snapshot) => {
      let val = snapshot.val() || 0;
      let btn = gpioButtons[key];
      if(btn) {
        if(val === 1) btn.classList.add("on");
        else btn.classList.remove("on");
      }
    });
  });

  // 2. Listen for Device Names (Labels)
  gpioList.forEach(key => {
    onValue(ref(db, "/config/names/" + key), (snapshot) => {
      let name = snapshot.val();
      if(name) {
        // Update Home Page Label
        if(gpioLabels[key]) gpioLabels[key].textContent = name;
        // Update Settings Input
        let input = document.getElementById("edit_" + key);
        if(input) input.value = name;
      }
    });
  });

  // 3. Button Click Logic (Toggle)
  Object.keys(gpioButtons).forEach((key) => {
    let btn = gpioButtons[key];
    btn.onclick = () => {
      if (key === "master") {
        // Smart Master Logic: If any is ON, turn all OFF. Else turn all ON.
        let isAnyOn = false;
        gpioList.forEach(g => {
           if(gpioButtons[g].classList.contains("on")) isAnyOn = true;
        });
        let target = isAnyOn ? 0 : 1;
        set(ref(db, "/master"), target);
        gpioList.forEach(g => set(ref(db, "/" + g), target));
      } else {
        // Normal Toggle
        let newState = btn.classList.contains("on") ? 0 : 1;
        set(ref(db, "/" + key), newState);
      }
    };
  });
}

// --- SAVE NAMES (Settings Page) ---
saveNamesBtn.onclick = () => {
  gpioList.forEach(key => {
    let newName = document.getElementById("edit_" + key).value;
    if(newName) {
      set(ref(db, "/config/names/" + key), newName);
    }
  });
  alert("Names Saved!");
};

// --- SAVE TIMER (Timer Page) ---
saveTimerBtn.onclick = () => {
  let device = document.getElementById("timerDeviceSelect").value;
  let onTime = document.getElementById("timeOn").value;
  let offTime = document.getElementById("timeOff").value;

  if(device) {
    set(ref(db, "/timers/" + device), {
      on: onTime,
      off: offTime
    });
    alert("Timer saved for " + device);
  }
};
