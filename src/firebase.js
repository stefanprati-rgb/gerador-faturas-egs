import { initializeApp } from 'firebase/app';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

// TODO: Preencha com suas chaves do Firebase Console
const firebaseConfig = {
    apiKey: "PREENCHA_AQUI",
    authDomain: "gerador-faturas-egs.firebaseapp.com",
    projectId: "gerador-faturas-egs",
    storageBucket: "gerador-faturas-egs.appspot.com",
    messagingSenderId: "PREENCHA_AQUI",
    appId: "PREENCHA_AQUI"
};

const app = initializeApp(firebaseConfig);
const functions = getFunctions(app);

// Conectar ao emulador em ambiente local
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    console.log('Utilizando emulador do Firebase Functions');
    connectFunctionsEmulator(functions, '127.0.0.1', 5001);
}

export { app, functions };
