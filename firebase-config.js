import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// TODO: Replace this placeholder config with your actual Firebase configuration
// From Firebase Console > Project Settings > General > Your apps (Web) > SDK setup and configuration
const firebaseConfig = {
  apiKey: "AIzaSyDo5zNEKhiG7Asii6A1-sZ2dV4OsoilnPk",
  authDomain: "lumina--book-tracker.firebaseapp.com",
  projectId: "lumina--book-tracker",
  storageBucket: "lumina--book-tracker.firebasestorage.app",
  messagingSenderId: "613537443543",
  appId: "1:613537443543:web:9cdefd59d403b2371b4a92"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);
