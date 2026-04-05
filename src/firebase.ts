import { initializeApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getAuth, connectAuthEmulator, FacebookAuthProvider } from "firebase/auth";
import { getStorage, connectStorageEmulator } from "firebase/storage";

const USE_EMULATOR = import.meta.env.VITE_APP_USE_EMULATOR === 'true';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

if (USE_EMULATOR) {
  // Using 'localhost' instead of '127.0.0.1' to prevent origin mismatch in redirects
  console.log("🛠️ Emulator Mode: Using project " + firebaseConfig.projectId + " at localhost");
  console.log("🛠️ Auth Domain:", firebaseConfig.authDomain);
  
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectAuthEmulator(auth, 'http://localhost:9099');
  connectStorageEmulator(storage, 'localhost', 9199);
}

const facebookProvider = new FacebookAuthProvider();
facebookProvider.addScope('email');

export { db, auth, storage, facebookProvider };
