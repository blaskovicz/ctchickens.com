// src/firebase.ts
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

/**
 * REPLACEMENT REQUIRED:
 * Copy your project configuration from the Firebase Console:
 * Project Settings > General > Your Apps > Web App (or Add App)
 */
const firebaseConfig = {
  // safe to commit, designed to be public; access locked down via iam
  apiKey: "AIzaSyDdXdVqGhyGCALDRdGs_6zJqth11RZtGsA",
  authDomain: "ct-chickens.firebaseapp.com",
  projectId: "ct-chickens",
  storageBucket: "ct-chickens.firebasestorage.app",
  messagingSenderId: "895923167454",
  appId: "1:895923167454:web:8f74845584f8885047224f",
  measurementId: "G-RP0KCK5QSC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
const db = getFirestore(app);

export { db };
