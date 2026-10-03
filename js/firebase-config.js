// js/firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Configuración centralizada de tu proyecto Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDYsXynvMotb8E21FomTS93oIaVQfLp2p8",
  authDomain: "tiendaabel-9acaa.firebaseapp.com",
  projectId: "tiendaabel-9acaa",
  storageBucket: "tiendaabel-9acaa.firebasestorage.app",
  messagingSenderId: "645130653473",
  appId: "1:645130653473:web:33e2f49bdb642ed784f860",
  measurementId: "G-1V5RBM83B3"
};

// Inicializar la App y Firestore
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);