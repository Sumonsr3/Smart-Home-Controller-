import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getDatabase, ref, set, onValue, remove } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

// --- আপনার অরিজিনাল কনফিগারেশন (OLD CONFIG) ---
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
const authContainer = document.getElementById("authBox"); // ID updated to match new HTML
const appContainer = document.getElementById("mainContent"); // ID updated
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const authMsg = document.getElementById("authMsg");
const badge = document.getElementById("statusBadge");

// Modal Elements
const confirmModal = document.getElementById("customModal");
const timerModal = document.getElementById("timerModal");
const selectionModal = document.getElementById("selectionModal");

// --- Auth Functions ---
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

if(logoutBtn) {
    logoutBtn.onclick = () => signOut(auth);
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    authContainer.style.display = "none";
    appContainer.style.display = "block";
    document.getElementById("bottomNav").style.display = "flex"; // Show Nav
    badge.className = "status-badge online";
    badge.textContent = "Online";
    startApp();
  } else {
    authContainer.style.display = "flex";
    appContainer.style.display = "none";
    document.getElementById("bottomNav").style.display = "none"; // Hide Nav
    badge.className = "status-badge offline";
    badge.textContent = "Offline";
  }
});

function startApp() {
  
  // 1. Listen for GPIO Status
  [...gpioList, "master"].forEach((key) => {
    onValue(ref(db, "/" + key), (snapshot) => {
      let val = snapshot.val() || 0;
      let btn = document.getElementById(key + "Btn");
      
      // For Master Status Text
      if(key === "master") {
        let statusText = document.getElementById("masterStatus");
        if(statusText) statusText.textContent = (val === 1) ? "ALL ON" : "ALL OFF";
      }

      if(btn) {
        if(val === 1) {
            btn.classList.add("on"); // This triggers the Green CSS
        } else {
            btn.classList.remove("on"); // This triggers the Grey CSS
        }
      }
    });
  });

  // 2. Listen for Names
  gpioList.forEach(key => {
    onValue(ref(db, "/config/names/" + key), (snapshot) => {
      let name = snapshot.val();
      if(name) {
        let label = document.getElementById("name_" + key);
        if(label) label.textContent = name;
        currentDeviceNames[key] = name;
      } else {
        currentDeviceNames[key] = "Switch " + key.replace("gpio", "");
      }
    });
  });

  // 3. Button Click Logic (Simple Toggle)
  gpioList.forEach((key) => {
    const btn = document.getElementById(key + "Btn");
    if(btn) {
        btn.onclick = () => {
          let newState = btn.classList.contains("on") ? 0 : 1;
          set(ref(db, "/" + key), newState);
        };
    }
  });

  // 4. Master Button Logic
  const masterBtn = document.getElementById("masterBtn");
  if(masterBtn) {
      masterBtn.onclick = () => {
        // Show Confirmation
        showConfirm("Toggle All Devices?", () => {
            let isAnyOn = false;
            gpioList.forEach(g => {
               let b = document.getElementById(g + "Btn");
               if(b && b.classList.contains("on")) isAnyOn = true;
            });
            let target = isAnyOn ? 0 : 1;
            set(ref(db, "/master"), target);
            gpioList.forEach(g => set(ref(db, "/" + g), target));
        });
      };
  }
  
  // 5. Load Timers List
  onValue(ref(db, "/timers"), (snapshot) => {
    const listContainer = document.getElementById("scheduleListContainer");
    listContainer.innerHTML = ""; 
    const timers = snapshot.val();
    
    if (timers) {
      Object.keys(timers).forEach(key => {
        let data = timers[key];
        let devName = currentDeviceNames[key] || key;
        
        if(data.on) addTimerItemUI(listContainer, key, "On", data.on, devName);
        if(data.off) addTimerItemUI(listContainer, key, "Off", data.off, devName);
      });
    } else {
      listContainer.innerHTML = `<p style="text-align:center; opacity:0.5; margin-top:20px;">No active timers</p>`;
    }
  });
}

// --- HELPER FUNCTIONS ---

function addTimerItemUI(container, key, action, time, name) {
    let color = action === "On" ? "#00e676" : "#ff1744";
    // Convert 24h to 12h
    let [H, M] = time.split(":"); 
    H = parseInt(H);
    let ampm = H >= 12 ? "PM" : "AM"; 
    H = H % 12; 
    H = H ? H : 12;
    let niceTime = (H < 10 ? "0" + H : H) + ":" + M + " " + ampm;

    container.innerHTML += `
    <div class="schedule-item">
        <div class="schedule-info">
            <b>${name}</b>
            <span>Will turn <span style="color:${color};font-weight:bold">${action.toUpperCase()}</span> at <b>${niceTime}</b></span>
        </div>
        <button onclick="window.deleteTimer('${key}', '${action}')" class="del-btn"><i class="fas fa-trash-alt"></i></button>
    </div>`;
}

// Global function to delete timer
window.deleteTimer = function(key, type) { // type = 'On' or 'Off'
    if(confirm("Delete this schedule?")) {
        // We only remove the specific field (on or off)
        remove(ref(db, `/timers/${key}/${type.toLowerCase()}`)); 
    }
}

// --- MODAL & SETTINGS LOGIC ---

// Simple Confirm Modal
function showConfirm(msg, callback) {
    const m = document.getElementById("customModal");
    document.getElementById("modalMessage").textContent = msg;
    m.classList.add("active");
    
    document.getElementById("btnConfirm").onclick = () => {
        callback();
        m.classList.remove("active");
    };
    document.getElementById("btnCancel").onclick = () => m.classList.remove("active");
}

// Timer Modal Setup
let tempTimer = { device: "gpio1", action: "on", hour: "12", minute: "00", ampm: "AM" };

window.openSelection = function(type) {
    const list = document.getElementById("selectionListContainer");
    list.innerHTML = "";
    document.getElementById("selectionModal").classList.add("active");
    document.getElementById("selectionTitle").textContent = "Select " + type;

    let items = [];
    if(type === 'device') {
        gpioList.forEach(g => items.push({val: g, txt: currentDeviceNames[g] || g}));
    } else if (type === 'action') {
        items = [{val:'on', txt:'Turn ON'}, {val:'off', txt:'Turn OFF'}];
    } else if (type === 'hour') {
        for(let i=1; i<=12; i++) items.push({val: (i<10?'0'+i:i), txt: (i<10?'0'+i:i)});
    } else if (type === 'minute') {
        for(let i=0; i<60; i+=5) items.push({val: (i<10?'0'+i:i), txt: (i<10?'0'+i:i)});
    } else if (type === 'ampm') {
        items = [{val:'AM', txt:'AM'}, {val:'PM', txt:'PM'}];
    }

    items.forEach(item => {
        let div = document.createElement("div");
        div.className = "select-item";
        div.textContent = item.txt;
        div.onclick = () => {
            if(type === 'device') { tempTimer.device = item.val; document.getElementById("displayDevice").textContent = item.txt; }
            if(type === 'action') { tempTimer.action = item.val; document.getElementById("displayAction").textContent = item.txt; }
            if(type === 'hour') { tempTimer.hour = item.val; document.getElementById("displayHour").textContent = item.txt; }
            if(type === 'minute') { tempTimer.minute = item.val; document.getElementById("displayMinute").textContent = item.txt; }
            if(type === 'ampm') { tempTimer.ampm = item.val; document.getElementById("displayAmPm").textContent = item.txt; }
            document.getElementById("selectionModal").classList.remove("active");
        };
        list.appendChild(div);
    });
}

window.addNewSchedule = function() {
    let h = parseInt(tempTimer.hour);
    if(tempTimer.ampm === "PM" && h < 12) h += 12;
    if(tempTimer.ampm === "AM" && h === 12) h = 0;
    
    let timeStr = (h < 10 ? "0"+h : h) + ":" + tempTimer.minute;
    
    // Save to DB: /timers/gpio1/on = "14:30"
    set(ref(db, `/timers/${tempTimer.device}/${tempTimer.action}`), timeStr);
    
    document.getElementById("timerModal").classList.remove("active");
    alert("Timer Saved!");
}

// Modal Close Logic
document.querySelectorAll(".close-icon").forEach(e => {
    e.onclick = function() { this.closest(".modal-overlay").classList.remove("active"); }
});

// Rename Logic
const openRenameBtn = document.getElementById("openRenameBtn");
if(openRenameBtn) openRenameBtn.onclick = () => document.getElementById("renameModal").classList.add("active");

window.saveNameManually = function(idx) {
    let key = "gpio" + idx;
    let val = document.getElementById("rename" + idx).value;
    if(val) {
        set(ref(db, "/config/names/" + key), val);
        alert("Saved!");
    }
}

// Close Modal helper
window.closeModal = function(id) { document.getElementById(id).classList.remove("active"); }
