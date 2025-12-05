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

// Modal Elements (Timer)
const confirmModal = document.getElementById("confirmModal");
const timerModal = document.getElementById("timerModal");
const modalDeviceSelect = document.getElementById("modalDeviceSelect");
const modalTimeOn = document.getElementById("modalTimeOn");
const modalTimeOff = document.getElementById("modalTimeOff");
const activeTimerList = document.getElementById("activeTimerList");

// Modal Elements (Rename)
const nameModal = document.getElementById("nameModal");
const nameModalDeviceSelect = document.getElementById("nameModalDeviceSelect");
const nameModalInput = document.getElementById("nameModalInput");

// Initialize Elements
const gpioButtons = {};
const gpioLabels = {};
const gpioStatusText = {}; 

[...gpioList, "master"].forEach(key => {
  gpioButtons[key] = document.getElementById(key + "Btn");
});

gpioList.forEach(key => {
  gpioLabels[key] = document.getElementById("label_" + key);
  gpioStatusText[key] = document.getElementById("status_" + key);
});

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
    authMsg.textContent = "Login Failed: " + e.message;
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
  
  // 1. Listen for GPIO Status (Real-time updates from ESP32)
  [...gpioList, "master"].forEach((key) => {
    onValue(ref(db, "/" + key), (snapshot) => {
      let val = snapshot.val() || 0;
      let btn = gpioButtons[key];
      let txt = gpioStatusText[key];

      if(btn) {
        if(val === 1) {
            btn.classList.add("on");
            if(txt) txt.textContent = "ON";
        } else {
            btn.classList.remove("on");
            if(txt) txt.textContent = "OFF";
        }
      }
    });
  });

  // 2. Listen for Names
  gpioList.forEach(key => {
    onValue(ref(db, "/config/names/" + key), (snapshot) => {
      let name = snapshot.val();
      if(name) {
        if(gpioLabels[key]) gpioLabels[key].textContent = name;
        currentDeviceNames[key] = name;
        
        // Update Dropdowns
        let tOption = modalDeviceSelect.querySelector(`option[value="${key}"]`);
        if(tOption) tOption.textContent = name;
        
        let nOption = nameModalDeviceSelect.querySelector(`option[value="${key}"]`);
        if(nOption) nOption.textContent = name;
        
      } else {
        currentDeviceNames[key] = "Light " + key.replace("gpio", "");
      }
    });
  });

  // 3. LISTEN FOR TIMERS (Display active schedules)
  onValue(ref(db, "/timers"), (snapshot) => {
    activeTimerList.innerHTML = "";
    const timers = snapshot.val();
    
    if (timers) {
      Object.keys(timers).forEach(key => {
        let data = timers[key];
        let div = document.createElement("div");
        div.className = "timer-card-item";
        
        let devName = currentDeviceNames[key] || key;
        
        // Display Logic
        let schedule = "";
        if(data.on && data.off) schedule = `<i class="fas fa-power-off" style="color:green"></i> ON: ${data.on} <br> <i class="fas fa-power-off" style="color:red"></i> OFF: ${data.off}`;
        else if(data.on) schedule = `<i class="fas fa-power-off" style="color:green"></i> ON: ${data.on}`;
        else if(data.off) schedule = `<i class="fas fa-power-off" style="color:red"></i> OFF: ${data.off}`;
        
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
      activeTimerList.innerHTML = `<p style="text-align:center; color:#555; margin-top:20px;">No active timers set.</p>`;
    }
  });

  // 4. Button Logic (Toggle Switches)
  [...gpioList, "master"].forEach((key) => {
    let btn = document.getElementById(key + "Btn");
    if(btn) {
        btn.onclick = () => {
            let newState = btn.classList.contains("on") ? 0 : 1;
            
            if(key === "master") {
                 confirmModal.style.display = "flex";
            } else {
                 set(ref(db, "/" + key), newState);
            }
        };
    }
  });

  // Master Logic via Modal
  document.getElementById("cancelMasterBtn").onclick = () => {
    confirmModal.style.display = "none";
  };
  document.getElementById("confirmMasterBtn").onclick = () => {
    let isAnyOn = false;
    gpioList.forEach(g => {
       if(gpioButtons[g].classList.contains("on")) isAnyOn = true;
    });
    let target = isAnyOn ? 0 : 1;
    set(ref(db, "/master"), target);
    gpioList.forEach(g => set(ref(db, "/" + g), target));
    confirmModal.style.display = "none";
  };
}

// --- TIMER MODAL LOGIC (SAVE TO DB) ---
document.getElementById("openTimerModalBtn").onclick = () => {
    modalDeviceSelect.value = "";
    modalTimeOn.value = "";
    modalTimeOff.value = "";
    timerModal.style.display = "flex";
};

document.getElementById("cancelTimerBtn").onclick = () => {
    timerModal.style.display = "none";
};

document.getElementById("saveTimerBtn").onclick = () => {
    let selectedDevice = modalDeviceSelect.value;
    let tOn = modalTimeOn.value;   // Format: "HH:MM"
    let tOff = modalTimeOff.value; // Format: "HH:MM"

    if(!selectedDevice) {
        alert("Please select a device!");
        return;
    }
    
    // Save to Firebase. The ESP32 will read this path.
    if(tOn || tOff) {
        set(ref(db, "/timers/" + selectedDevice), {
            on: tOn || "",  // Save empty string if not set
            off: tOff || "" // Save empty string if not set
        })
        .then(() => {
            // Success
            timerModal.style.display = "none";
        })
        .catch((error) => {
            alert("Error saving timer: " + error.message);
        });
    } else {
        alert("Please set at least an ON or OFF time.");
    }
};

// --- RENAME MODAL LOGIC ---
document.getElementById("openNameModalBtn").onclick = () => {
    nameModalDeviceSelect.value = "";
    nameModalInput.value = "";
    nameModal.style.display = "flex";
};

document.getElementById("cancelNameModalBtn").onclick = () => {
    nameModal.style.display = "none";
};

nameModalDeviceSelect.onchange = (e) => {
    let key = e.target.value;
    if(currentDeviceNames[key]) {
        nameModalInput.value = currentDeviceNames[key];
    } else {
        nameModalInput.value = "";
    }
};

document.getElementById("saveNameModalBtn").onclick = () => {
    let selectedDevice = nameModalDeviceSelect.value;
    let newName = nameModalInput.value;

    if(!selectedDevice) {
        alert("Please select a device!");
        return;
    }
    if(newName.trim() === "") {
        alert("Please enter a name!");
        return;
    }

    set(ref(db, "/config/names/" + selectedDevice), newName);
    nameModal.style.display = "none";
};

// Global function for Delete Button
window.deleteTimer = function(key) {
  if(confirm("Delete schedule for this device?")) {
    remove(ref(db, "/timers/" + key));
  }
}
