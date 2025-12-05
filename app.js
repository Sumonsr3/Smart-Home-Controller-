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
// --- কনফিগারেশন শেষ ---

// Firebase ইনিশিয়ালাইজেশন
const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getDatabase(app);

// HTML ইলিমেন্ট ধরা
const authBox = document.getElementById("authBox");
const controlBox = document.getElementById("controlBox");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const authMsg = document.getElementById("authMsg");
const badge = document.getElementById("statusBadge");

// ৬টি জিপিআইও এর লিস্ট
const gpioList = ["gpio1", "gpio2", "gpio3", "gpio4", "gpio5", "gpio6"];

// বাটন এবং স্ট্যাটাস টেক্সট রাখার অবজেক্ট
const gpioButtons = {};
const gpioLabels = {};

// সব কি (Key) একসাথে প্রসেস করা (1-6 + Master)
const allKeys = [...gpioList, "master"];

// বাটনগুলো খুঁজে বের করা
allKeys.forEach(key => {
  const btn = document.getElementById(key + "Btn");
  const lbl = document.getElementById(key + "Status");
  
  if (btn && lbl) {
    gpioButtons[key] = btn;
    gpioLabels[key] = lbl;
  } else {
    console.warn("Element not found for:", key);
  }
});

// লগিন ফাংশন
loginBtn.onclick = async () => {
  authMsg.textContent = "Logging in...";
  try {
    await signInWithEmailAndPassword(
      auth,
      document.getElementById("emailField").value,
      document.getElementById("passwordField").value
    );
  } catch (e) {
    authMsg.textContent = "Error: " + e.message;
  }
};

// লগআউট ফাংশন
logoutBtn.onclick = () => signOut(auth);

// অথেন্টিকেশন মনিটর
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

// ডাটাবেস লিসেনার এবং বাটন ক্লিক হ্যান্ডলার
function startListeners() {
  
  // ১. ডাটাবেস থেকে ডাটা রিড করা (রিয়েলটাইম)
  allKeys.forEach((key) => {
    onValue(ref(db, "/" + key), (snapshot) => {
      let value = snapshot.val();
      // যদি ডাটা না থাকে (null), তাহলে 0 ধরবো
      if (value === null) value = 0; 
      updateUI(key, value);
    });
  });

  // ২. বাটনে ক্লিক করলে ডাটাবেসে রাইট করা
  Object.keys(gpioButtons).forEach((key) => {
    let btn = gpioButtons[key];
    
    btn.onclick = () => {
      // বর্তমানে অন থাকলে অফ করবো, অফ থাকলে অন
      let newState = btn.classList.contains("on") ? 0 : 1;

      if (key === "master") {
        console.log("Master Switch Clicked:", newState);
        // মাস্টার সুইচ: নিজের এবং বাকি সবগুলোর ভ্যালু আপডেট করবে
        set(ref(db, "/master"), newState);
        
        gpioList.forEach(gpio => {
          set(ref(db, "/" + gpio), newState);
        });

      } else {
        console.log(key, "Clicked:", newState);
        // সাধারণ সুইচ: শুধু নিজের ভ্যালু আপডেট করবে
        set(ref(db, "/" + key), newState);
      }
    };
  });
}

// UI আপডেট ফাংশন
function updateUI(key, val) {
  let btn = gpioButtons[key];
  let lab = gpioLabels[key];

  if (!btn || !lab) return;

  if (val === 1) {
    btn.classList.add("on");
    lab.textContent = "Status: ON";
    // মাস্টারের জন্য টেক্সট কালার কালো, বাকিদের জন্য সবুজ
    lab.style.color = (key === 'master') ? "#ffea00" : "#9effae"; 
  } else {
    btn.classList.remove("on");
    lab.textContent = "Status: OFF";
    lab.style.color = "#d1d1d1";
  }
}
