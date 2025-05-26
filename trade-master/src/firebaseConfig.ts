// Firebase configuration and initialization
import { initializeApp } from "firebase/app";

const firebaseConfig = {
  apiKey: "AIzaSyA1boJJrk6dNszwxHdytJEKIx6LEhPDCQg",
  authDomain: "trademaster-5505b.firebaseapp.com",
  projectId: "trademaster-5505b",
  storageBucket: "trademaster-5505b.appspot.com",
  messagingSenderId: "330295304755",
  appId: "1:330295304755:web:e1409d63079d3fd6a6f946",
  measurementId: "G-3T81BL34JX"
};

export const firebaseApp = initializeApp(firebaseConfig);
