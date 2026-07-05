// app.js
const app = (() => {
    let currentUser = null;
    let userData = null;
    const ADMIN_EMAIL = 'luxcutweb@gmail.com';
    // ... el resto de tu código ...

    // ==========================================
    // UTILS & UI
    // ==========================================
    const $ = (id) => document.getElementById(id);
    
    window.addEventListener('load', () => {
        setTimeout(() => {
            $('loader').style.opacity = '0';
            setTimeout(() => $('loader').style.display = 'none', 500);
        }, 800);
        initApp();
    });

    const navigate = (sectionId) => {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        $(sectionId).classList.add('active');
        
        const btn = Array.from(document.querySelectorAll('.nav-btn')).find(b => b.getAttribute('onclick') === `app.navigate('${sectionId}')`);
        if(btn) btn.classList.add('active');
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        // Hide mobile menu if open
        const navLinks = $('nav-links');
        if(navLinks.classList.contains('show')) navLinks.classList.remove('show');
    };

    const showModal = (id) => { $(id).classList.remove('hidden'); };
    const hideModal = (id) => { $(id).classList.add('hidden'); };
    const toggleMenu = () => { $('nav-links').classList.toggle('show'); };

    // ==========================================
    // AUTH & USERS
    // ==========================================
    const initApp = () => {
        // Escuchar estado de auth
        auth.onAuthStateChanged(async (user) => {
            currentUser = user;
            const guestReq = document.querySelectorAll('.guest-req');
            const authReq = document.querySelectorAll('.auth-req');
            const adminReq = document.querySelectorAll('.admin-req');

            if (user) {
                // Usuario logueado
                guestReq.forEach(el => el.classList.add('hidden'));
                authReq.forEach(el => el.classList.remove('hidden'));
                
                // Obtener doc
                const doc = await db.collection('users').doc(user.uid).get();
                if(doc.exists) {
                    userData = doc.data();
                    renderProfile();
                }

                if (user.email === ADMIN_EMAIL) {
                    adminReq.forEach(el => el.classList.remove('hidden'));
                    // Hide client profile for admin
                    Array.from(authReq).forEach(el => {
                        if(el.getAttribute('onclick') === "app.navigate('profile')") el.classList.add('hidden');
                    });
                    loadAdminDashboard();
                } else {
                    adminReq.forEach(el => el.classList.add('hidden'));
                }
            } else {
                // Invitado
                userData = null;
                guestReq.forEach(el => el.classList.remove('hidden'));
                authReq.forEach(el => el.classList.add('hidden'));
                adminReq.forEach(el => el.classList.add('hidden'));
                navigate('home');
            }
        });

        // Load public data
        loadServices();
        loadPromotions();
        // Cargar galería de prueba (Simulada para diseño)
        renderGallery();
    };

    const register = async (e) => {
        e.preventDefault();
        const email = $('reg-email').value;
        const pass = $('reg-pass').value;
        const name = $('reg-name').value;
        const lname = $('reg-lname').value;
        
        try {
            const cred = await auth.createUserWithEmailAndPassword(email, pass);
            
            // Generar código único LUX000X (Búsqueda rápida)
            const usersSnap = await db.collection('users').orderBy('codeNum', 'desc').limit(1).get();
            let nextNum = 1;
            if(!usersSnap.empty) {
                nextNum = usersSnap.docs[0].data().codeNum + 1;
            }
            const codeStr = `LUX${String(nextNum).padStart(4, '0')}`;

            await db.collection('users').doc(cred.user.uid).set({
                uid: cred.user.uid,
                name: `${name} ${lname}`,
                email,
                phone: $('reg-phone').value,
                dob: $('reg-dob').value,
                photo: $('reg-photo').value || 'https://via.placeholder.com/150',
                codeNum: nextNum,
                code: codeStr,
                visits: 0,
                role: email === ADMIN_EMAIL ? 'admin' : 'client'
            });

            hideModal('register-modal');
            alert('¡Registro exitoso!');
            e.target.reset();
            navigate('profile');
        } catch (error) {
            alert('Error: ' + error.message);
        }
    };

    const login = async (e) => {
        e.preventDefault();
        try {
            await auth.signInWithEmailAndPassword($('login-email').value, $('login-pass').value);
            hideModal('login-modal');
            e.target.reset();
            if($('login-email').value === ADMIN_EMAIL) navigate('admin');
            else navigate('profile');
        } catch (error) {
            alert('Credenciales incorrectas');
        }
    };

    const logout = () => { auth.signOut(); };

    // ==========================================
    // PROFILE & LOYALTY SYSTEM
    // ==========================================
    const renderProfile = () => {
        if(!userData) return;
        $('prof-img').src = userData.photo;
        $('prof-name').innerText = userData.name;
        $('prof-email').innerText = userData.email;
        $('prof-code').innerText = userData.code;

        const visits = userData.visits || 0;
        $('loyalty-status').innerText = `Visitas totales: ${visits}`;
        
        const cycleVisits = visits % 6;
        const progressPercent = (cycleVisits / 6) * 100;
        $('loyalty-progress').style.width = `${progressPercent}%`;

        let stampsHTML = '';
        for(let i = 1; i <= 6; i++) {
            let cls = 'stamp';
            let icon = i;
            if (i <= cycleVisits) {
                cls += ' active';
                icon = '<i class="fas fa-check"></i>';
            }
            if (i === 3) cls += (i <= cycleVisits ? ' reward' : '');
            if (i === 6) cls += (i <= cycleVisits ? ' reward' : '');
            
            let label = i === 3 ? '20%' : (i === 6 ? 'GRATIS' : '');
            stampsHTML += `<div class="${cls}" title="${label}">${icon}</div>`;
        }
        $('stamps-grid').innerHTML = stampsHTML;

        let msg = 'Sigue sumando visitas para tu próxima recompensa.';
        if (cycleVisits === 3) msg = '¡Felicidades! Tienes 20% de descuento en tu próximo corte.';
        if (cycleVisits === 0 && visits > 0) msg = '¡Felicidades! 🎉 Has ganado un CORTE GRATIS.';
        $('reward-msg').innerText = msg;
    };

    // ==========================================
    // DATA FETCHING (Public)
    // ==========================================
    const loadServices = async () => {
        db.collection('services').onSnapshot(snap => {
            const grid = $('services-grid');
            const select = $('book-service');
            grid.innerHTML = ''; select.innerHTML = '<option value="">Selecciona un servicio...</option>';
            snap.forEach(doc => {
                const s = doc.data();
                // Render Cards
                grid.innerHTML += `
                    <div class="service-card glass hover-lift">
                        <div class="service-img" style="background-image: url('${s.img}')"></div>
                        <div class="service-info">
                            <div class="service-header">
                                <h3>${s.name}</h3>
                                <span class="service-price">S/ ${s.price}</span>
                            </div>
                            <p class="service-desc">${s.desc}</p>
                            <p class="text-sm color-gray mb-1"><i class="far fa-clock"></i> ${s.time}</p>
                            <button class="btn-outline w-100 mt-auto" onclick="app.navigate('bookings')">Reservar</button>
                        </div>
                    </div>`;
                // Render Booking Select Options
                select.innerHTML += `<option value="${s.name}">${s.name} - S/ ${s.price}</option>`;
            });
        });
    };

    const loadPromotions = async () => {
        db.collection('promotions').onSnapshot(snap => {
            const grid = $('promotions-grid');
            grid.innerHTML = '';
            snap.forEach(doc => {
                const p = doc.data();
                grid.innerHTML += `
                    <div class="feature-card glass hover-lift" style="border-color: var(--gold)">
                        <i class="fas fa-tag"></i>
                        <h3>${p.name}</h3>
                        <p>${p.desc}</p>
                        <h2 class="mt-2" style="color: var(--gold);">${p.discount}</h2>
                    </div>`;
            });
        });
    };

    const renderGallery = () => {
        // Simulación de imágenes para la UI, idealmente cargadas desde Firestore/Storage
        const urls = [
            'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=600&q=80',
            'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=600&q=80',
            'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=600&q=80',
            'https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=600&q=80',
            'https://images.unsplash.com/photo-1532710093739-9470ac1d4e5f?auto=format&fit=crop&w=600&q=80',
            'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?auto=format&fit=crop&w=600&q=80'
        ];
        $('gallery-grid').innerHTML = urls.map(url => `
            <div class="gallery-item glass">
                <img src="${url}" alt="Corte">
            </div>
        `).join('');
    };

    // ==========================================
    // BOOKINGS & WHATSAPP
    // ==========================================
    const submitBooking = async (e) => {
        e.preventDefault();
        if(!currentUser) {
            alert("Debes iniciar sesión para reservar.");
            showModal('login-modal');
            return;
        }
        
        const service = $('book-service').value;
        const date = $('book-date').value;
        const time = $('book-time').value;
        const notes = $('book-notes').value;

        const bookingData = {
            userId: currentUser.uid,
            userName: userData ? userData.name : 'Cliente',
            service, date, time, notes,
            status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            await db.collection('bookings').add(bookingData);
            
            // Generar Link de WhatsApp
            const phone = "51986757806"; // Reemplazar con el real
            let msg = `Hola LUXCUT 💈.%0A%0ASoy *${bookingData.userName}*.%0ADeseo agendar una cita:%0A%0A✂️ Servicio: ${service}%0A📅 Fecha: ${date}%0A⏰ Hora: ${time}`;
            if(notes) msg += `%0A📝 Nota: ${notes}`;
            
            window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
            e.target.reset();
            alert("Reserva registrada. Se abrirá WhatsApp para confirmar.");
        } catch (error) {
            alert("Error al reservar: " + error.message);
        }
    };

    // ==========================================
    // ADMIN PANEL LOGIC
    // ==========================================
    const switchAdminTab = (tabId) => {
        document.querySelectorAll('.admin-tab-content').forEach(el => el.classList.add('hidden'));
        document.querySelectorAll('.admin-tabs button').forEach(el => el.classList.remove('active'));
        $(tabId).classList.remove('hidden');
        event.target.classList.add('active');
    };

    const loadAdminDashboard = async () => {
        // Stats
        db.collection('users').onSnapshot(snap => $('stat-clients').innerText = snap.size);
        db.collection('bookings').onSnapshot(snap => $('stat-bookings').innerText = snap.size);
        renderAdminServices();
        renderAdminPromos();
    };

    const searchClient = async () => {
        const query = $('admin-search-client').value.trim().toUpperCase();
        if(!query) return;
        
        const resDiv = $('admin-client-result');
        resDiv.innerHTML = '<p>Buscando...</p>';

        try {
            // Buscar por código exacto (forma más rápida)
            let snap = await db.collection('users').where('code', '==', query).get();
            
            if(snap.empty) {
                // Si no, intentar por nombre o correo (en prod usar indexado como Algolia, aquí hacemos simple fallback)
                snap = await db.collection('users').where('email', '==', query.toLowerCase()).get();
            }

            if(snap.empty) {
                resDiv.innerHTML = '<p class="color-gray">Cliente no encontrado.</p>';
                return;
            }

            const client = snap.docs[0].data();
            const cid = snap.docs[0].id;

            resDiv.innerHTML = `
                <div class="list-item glass mt-1">
                    <div>
                        <h4>${client.name} <span class="prof-code" style="font-size:0.7rem">${client.code}</span></h4>
                        <p class="text-sm color-gray">Visitas actuales: ${client.visits}</p>
                    </div>
                    <button class="btn-solid" onclick="app.addVisit('${cid}', ${client.visits})">✅ Registrar Visita</button>
                </div>
            `;
        } catch (e) {
            resDiv.innerHTML = `<p>Error: ${e.message}</p>`;
        }
    };

    const addVisit = async (uid, currentVisits) => {
        if(!confirm('¿Registrar 1 visita a este cliente?')) return;
        try {
            await db.collection('users').doc(uid).update({ visits: currentVisits + 1 });
            alert('Visita registrada exitosamente.');
            $('admin-client-result').innerHTML = ''; // Limpiar búsqueda
            $('admin-search-client').value = '';
        } catch (e) {
            alert('Error: ' + e.message);
        }
    };

    // Admin CRUD: Services
    const addService = async (e) => {
        e.preventDefault();
        try {
            await db.collection('services').add({
                name: $('srv-name').value,
                desc: $('srv-desc').value,
                time: $('srv-time').value,
                price: parseFloat($('srv-price').value),
                img: $('srv-img').value
            });
            e.target.reset();
            alert('Servicio agregado');
        } catch(e) { alert(e.message); }
    };

    const renderAdminServices = () => {
        db.collection('services').onSnapshot(snap => {
            const list = $('admin-services-list');
            list.innerHTML = '';
            snap.forEach(doc => {
                const s = doc.data();
                list.innerHTML += `
                    <div class="list-item">
                        <div>
                            <strong>${s.name}</strong> - S/ ${s.price}
                        </div>
                        <button class="btn-outline" style="padding: 5px 10px; border-color: red; color: red;" onclick="app.deleteDoc('services', '${doc.id}')"><i class="fas fa-trash"></i></button>
                    </div>`;
            });
        });
    };

    // Admin CRUD: Promos
    const addPromo = async (e) => {
        e.preventDefault();
        try {
            await db.collection('promotions').add({
                name: $('pro-name').value,
                desc: $('pro-desc').value,
                discount: $('pro-discount').value
            });
            e.target.reset();
            alert('Promoción agregada');
        } catch(e) { alert(e.message); }
    };

    const renderAdminPromos = () => {
        db.collection('promotions').onSnapshot(snap => {
            const list = $('admin-promos-list');
            list.innerHTML = '';
            snap.forEach(doc => {
                const p = doc.data();
                list.innerHTML += `
                    <div class="list-item">
                        <div><strong>${p.name}</strong> - ${p.discount}</div>
                        <button class="btn-outline" style="padding: 5px 10px; border-color: red; color: red;" onclick="app.deleteDoc('promotions', '${doc.id}')"><i class="fas fa-trash"></i></button>
                    </div>`;
            });
        });
    };

    const deleteDoc = async (collection, id) => {
        if(confirm('¿Eliminar registro?')) {
            await db.collection(collection).doc(id).delete();
        }
    };

    // Exponer API Pública
    return {
        navigate, showModal, hideModal, toggleMenu,
        login, register, logout, submitBooking,
        switchAdminTab, searchClient, addVisit,
        addService, addPromo, deleteDoc
    };
})();

// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional

// firebase.js
// --- 1. CONFIGURACIÓN DE FIREBASE (Al principio de app.js) ---
const firebaseConfig = {
  apiKey: "AIzaSyC2WF-2hldF6QzG5ZJNY7egsErmd-RyiiE",
  authDomain: "luxcutweb-8c8d7.firebaseapp.com",
  projectId: "luxcutweb-8c8d7",
  storageBucket: "luxcutweb-8c8d7.firebasestorage.app",
  messagingSenderId: "1054388909755",
  appId: "1:1054388909755:web:e5b36947acefaf94a85b9e",
  measurementId: "G-4B31R2VXQQ"
};

firebase.initializeApp(firebaseConfig);

// Definimos las variables globales aquí mismo para que todo app.js las vea
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// --- 2. TU LÓGICA DE LA WEB (Aquí empieza tu código original) ---
const app = (() => {
    // ... todo tu código original aquí ...
})();
// Exportar servicios para usar en app.js
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
