import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getDatabase, ref, set, onValue, remove } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

// --- কনফিগারেশন ---
const firebaseConfig = {
  apiKey: "AIzaSyAzOuFlqKueEdbPPH83moT9wFgidm8TVBM",
  authDomain: "smart-home-controller-b3004.firebaseapp.com",
  databaseURL: "https://smart-home-controller-b3004-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "smart-home-controller-b3004",
  storageBucket: "smart-home-controller-b3004.firebasestorage.app",
  messagingSenderId: "471259029586",
  appId: "1:471259029586:web:6f489f0e3b229593523f8b"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getDatabase(app);

// Global Vars
const gpioList = ["gpio1", "gpio2", "gpio3", "gpio4", "gpio5", "gpio6"];
let currentDeviceNames = {};

// UI Elements
const authContainer = document.getElementById("authContainer");
const appContainer = document.getElementById("appContainer");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const authMsg = document.getElementById("authMsg");
const badge = document.getElementById("statusBadge");

// Modal Elements
const confirmModal = document.getElementById("confirmModal");
const timerModal = document.getElementById("timerModal");
const modalDeviceSelect = document.getElementById("modalDeviceSelect");
const modalTimeOn = document.getElementById("modalTimeOn");
const modalTimeOff = document.getElementById("modalTimeOff");
const activeTimerList = document.getElementById("activeTimerList");

// --- Auth ---
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
  
  // 1. Listen for GPIO Status (UPDATED FOR NEW BUTTON)
  [...gpioList, "master"].forEach((key) => {
    onValue(ref(db, "/" + key), (snapshot) => {
      let val = snapshot.val() || 0;
      let btn = document.getElementById(key + "Btn");
      let txtSpan = document.getElementById("status_text_" + key);

      if(btn) {
        if(val === 1) {
            btn.classList.add("on"); // Make green
            if(txtSpan) txtSpan.textContent = "ON";
        } else {
            btn.classList.remove("on"); // Make grey
            if(txtSpan) txtSpan.textContent = "OFF";
        }
      }
    });
  });

  // 2. Listen for Names
  gpioList.forEach(key => {
    onValue(ref(db, "/config/names/" + key), (snapshot) => {
      let name = snapshot.val();
      if(name) {
        let label = document.getElementById("label_" + key);
        if(label) label.textContent = name;
        
        let input = document.getElementById("edit_" + key);
        if(input) input.value = name;
        
        currentDeviceNames[key] = name;
        
        let option = modalDeviceSelect.querySelector(`option[value="${key}"]`);
        if(option) option.textContent = name;
      } else {
        currentDeviceNames[key] = "Light " + key.replace("gpio", "");
      }
    });
  });

  // 3. LISTEN FOR TIMERS
  onValue(ref(db, "/timers"), (snapshot) => {
    activeTimerList.innerHTML = ""; 
    const timers = snapshot.val();
    
    if (timers) {
      Object.keys(timers).forEach(key => {
        let data = timers[key];
        let div = document.createElement("div");
        div.className = "timer-card-item";
        
        let devName = currentDeviceNames[key] || key;
        let schedule = "";
        if(data.on && data.off) schedule = `ON: ${data.on} <br> OFF: ${data.off}`;
        else if(data.on) schedule = `ON: ${data.on}`;
        else if(data.off) schedule = `OFF: ${data.off}`;
        
        div.innerHTML = `
          <div class="t-info">
            <span class="t-dev-name">${devName}</span>
            <div class="t-time-val">${schedule}</div>
          </div>
          <button class="btn-delete-timer" onclick="deleteTimer('${key}')">
            <i class="fas fa-trash"></i>
          </button>
        `;
        activeTimerList.appendChild(div);
      });
    } else {
      activeTimerList.innerHTML = `<p style="text-align:center; color:#555; margin-top:20px;">No active timers.</p>`;
    }
  });

  // 4. Button Logic (UPDATED)
  // Individual Buttons
  gpioList.forEach((key) => {
    const btn = document.getElementById(key + "Btn");
    if(btn) {
        btn.onclick = () => {
          let newState = btn.classList.contains("on") ? 0 : 1;
          set(ref(db, "/" + key), newState);
        };
    }
  });

  // Master Button Logic
  const masterBtn = document.getElementById("masterBtn");
  if(masterBtn) {
      masterBtn.onclick = () => {
        confirmModal.style.display = "flex";
      };
  }

  document.getElementById("cancelMasterBtn").onclick = () => {
    confirmModal.style.display = "none";
  };

  document.getElementById("confirmMasterBtn").onclick = () => {
    let isAnyOn = false;
    // Check if any button is ON visually
    gpioList.forEach(g => {
       let b = document.getElementById(g + "Btn");
       if(b && b.classList.contains("on")) isAnyOn = true;
    });
    
    let target = isAnyOn ? 0 : 1;
    set(ref(db, "/master"), target);
    gpioList.forEach(g => set(ref(db, "/" + g), target));
    confirmModal.style.display = "none";
  };
}

// --- TIMER MODAL LOGIC (With Safety Check) ---
const openTimerModalBtn = document.getElementById("openTimerModalBtn");

if (openTimerModalBtn) {
  openTimerModalBtn.addEventListener("click", () => {
    if(timerModal && modalDeviceSelect && modalTimeOn && modalTimeOff) {
        modalDeviceSelect.value = "";
        modalTimeOn.value = "";
        modalTimeOff.value = "";
        timerModal.style.display = "flex";
    } else {
        alert("Error: Modal elements missing.");
    }
  });
}

document.getElementById("cancelTimerBtn").onclick = () => {
    timerModal.style.display = "none";
};

document.getElementById("saveTimerBtn").onclick = () => {
    let selectedDevice = modalDeviceSelect.value;
    let tOn = modalTimeOn.value;
    let tOff = modalTimeOff.value;

    if(!selectedDevice) {
        alert("Please select a device!");
        return;
    }
    
    if(tOn || tOff) {
        set(ref(db, "/timers/" + selectedDevice), {
            on: tOn,
            off: tOff
        });
    }
    timerModal.style.display = "none";
};

window.deleteTimer = function(key) {
  if(confirm("Delete schedule for this device?")) {
    remove(ref(db, "/timers/" + key));
  }
}

// Save Names Logic
document.getElementById("saveNamesBtn").onclick = () => {
  gpioList.forEach(key => {
    let newName = document.getElementById("edit_" + key).value;
    if(newName) set(ref(db, "/config/names/" + key), newName);
  });
  alert("Names Saved!");
};
