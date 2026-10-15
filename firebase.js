
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

// Replace these example values with your Firebase web app configuration.
const firebaseConfig = {
  apiKey: "AIzaSyCuwk9AXVI2_llXg9YkxhIstuYxtl4pqLA",
  authDomain: "taskflow-26194.firebaseapp.com",
  projectId: "taskflow-26194",
  storageBucket: "taskflow-26194.firebasestorage.app",
  messagingSenderId: "449900877268",
  appId: "1:449900877268:web:dbeaf91bed4d48787a7241",
  measurementId: "G-FE036C9D11"
};
// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Authentication and Firestore
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
