<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>July One</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Lexend:wght@500;600;700&display=swap');
        body { font-family: 'Inter', sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
        .font-lexend { font-family: 'Lexend', sans-serif; }
    </style>
</head>
<body class="bg-slate-900">
    <div id="root"></div>

    <!-- Load React and libraries first -->
    <script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>
    <script src="https://unpkg.com/lucide-react@latest/dist/umd/lucide-react.js"></script>
    <script src="https://apis.google.com/js/api.js"></script>

    <!-- Load Firebase modules -->
    <script type="module">
        import { initializeApp } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-app.js";
        import { getFirestore, collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, query, where, writeBatch, orderBy, getDocs, setDoc } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js";
        import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js";
        
        window.firebase = {
            initializeApp,
            getFirestore, collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, query, where, writeBatch, orderBy, getDocs, setDoc,
            getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken
        };
    </script>

    <!-- Load Babel and then run the app script -->
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <script type="text/babel" data-presets="react">
        const { useState, useEffect, useMemo, useRef, useCallback } = React;
        const { Plus, Trash2, Edit, X, Users, UserPlus, GripVertical, CheckCircle, XCircle, ArrowRightCircle, ListPlus, CalendarDays, LogIn, LogOut, ChevronLeft, ChevronRight, MapPin, Bell, Repeat, Award } = LucideReact;

        // --- START: PASTE YOUR KEYS HERE ---
        const firebaseConfig = {
            apiKey: "AIzaSyCpQWaTBa9HqmwHKAaah6EcajM8ISjHAZo",
            authDomain: "julyone-9e0e4.firebaseapp.com",
            projectId: "julyone-9e0e4",
            storageBucket: "julyone-9e0e4.firebasestorage.app",
            messagingSenderId: "930528887543",
            appId: "1:930528887543:web:a8f59192db11ce189ec9f2"
        };
        const GOOGLE_API_KEY = "YOUR_GOOGLE_API_KEY";
        const GOOGLE_CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID";
        // --- END: PASTE YOUR KEYS HERE ---

        const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"];
        const SCOPES = "https://www.googleapis.com/auth/calendar.readonly";
        const appId = 'july-one-permanent-storage';

        // --- Initialize Firebase (only if keys are valid) ---
        const isFirebaseConfigValid = firebaseConfig && firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith("YOUR_");
        const app = isFirebaseConfigValid ? window.firebase.initializeApp(firebaseConfig) : null;
        const db = isFirebaseConfigValid ? window.firebase.getFirestore(app) : null;
        const auth = isFirebaseConfigValid ? window.firebase.getAuth(app) : null;
        const { collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, query, where, writeBatch, orderBy, getDocs, setDoc } = window.firebase;
        const { signInAnonymously, onAuthStateChanged, signInWithCustomToken } = window.firebase;

        // --- Style & PWA Components ---
        const PWAInstaller = () => {
            useEffect(() => {
                const manifest = {
                    short_name: "July One", name: "July One Calendar",
                    icons: [{ src: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmZmZmYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cmVjdCB4PSIyIiB5PSI3IiB3aWR0aD0iMjAiIGhlaWdodD0iMTQiIHJ4PSIyIiByeT0iMiIvPjxwb2x5bGluZSBwb2ludHM9IjE2IDIgMTYgNiA4IDYgOCA0Ii8+PGxpbmUgeDE9IjMiIHkxPSIxMSIgeDI9IjMiIHkyPSIxMyIvPjxsaW5lIHgxPSIyMSIgeTE9IjExIiB4Mj0iMjEiIHkyPSIxMyIvPjwvc3ZnPg==", type: "image/svg+xml", sizes: "192x192 512x512" }],
                    start_url: ".", display: "standalone", theme_color: "#4f46e5", background_color: "#111827"
                };
                const manifestBlob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
                const manifestURL = URL.createObjectURL(manifestBlob);
                const link = document.createElement('link');
                link.rel = 'manifest';
                link.href = manifestURL;
                document.head.appendChild(link);
                const swCode = `self.addEventListener('fetch', (event) => event.respondWith(fetch(event.request)));`;
                const swBlob = new Blob([swCode], { type: 'application/javascript' });
                const swURL = URL.createObjectURL(swBlob);
                if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.register(swURL).catch(error => console.log('Service Worker registration failed:', error));
                }
                return () => { document.head.removeChild(link); URL.revokeObjectURL(manifestURL); URL.revokeObjectURL(swURL); };
            }, []);
            return null;
        };

        // --- Helper Functions ---
        const formatDate = (date, options = { weekday: 'long', month: 'long', day: 'numeric' }) => new Intl.DateTimeFormat('en-US', options).format(date);
        const generateTimeSlots = () => {
            const slots = [];
            for (let i = 0; i < 24; i++) for (let j = 0; j < 60; j += 15) slots.push(`${String(i).padStart(2, '0')}:${String(j).padStart(2, '0')}`);
            return slots;
        };
        const timeToMinutes = (time) => {
            if (!time) return 0;
            const [hours, minutes] = time.split(':').map(Number);
            return hours * 60 + minutes;
        };

        // --- Hooks ---
        const useNotifications = () => {
            const [permission, setPermission] = useState(Notification.permission);
            const scheduledNotifications = useRef(new Map());
            const requestPermission = useCallback(() => { Notification.requestPermission().then(setPermission); }, []);
            const scheduleNotification = useCallback((event) => {
                if (permission !== 'granted' || !event.notification || event.notification === 'none') return;
                const now = new Date();
                const eventTime = new Date(`${event.date}T${event.startTime}`);
                const notificationTime = new Date(eventTime.getTime() - event.notification * 60000);
                if (notificationTime > now) {
                    const timeoutId = setTimeout(() => {
                        new Notification(`Reminder: ${event.title}`, { body: `Starts at ${event.startTime}${event.location ? ` at ${event.location}` : ''}`, icon: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmZmZmYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cmVjdCB4PSIyIiB5PSI3IiB3aWR0aD0iMjAiIGhlaWdodD0iMTQiIHJ4PSIyIiByeT0iMiIvPjxwb2x5bGluZSBwb2ludHM9IjE2IDIgMTYgNiA4IDYgOCA0Ii8+PGxpbmUgeDE9IjMiIHkxPSIxMSIgeDI9IjMiIHkyPSIxMyIvPjxsaW5lIHgxPSIyMSIgeTE9IjExIiB4Mj0iMjEiIHkyPSIxMyIvPjwvc3ZnPg==" });
                        scheduledNotifications.current.delete(event.id);
                    }, notificationTime.getTime() - now.getTime());
                    if (scheduledNotifications.current.has(event.id)) clearTimeout(scheduledNotifications.current.get(event.id));
                    scheduledNotifications.current.set(event.id, timeoutId);
                }
            }, [permission]);
            const cancelNotification = useCallback((eventId) => { if (scheduledNotifications.current.has(eventId)) { clearTimeout(scheduledNotifications.current.get(eventId)); scheduledNotifications.current.delete(eventId); } }, []);
            return { requestPermission, scheduleNotification, cancelNotification, permission };
        };

        const useGoogleCalendar = () => {
            const [gapi, setGapi] = useState(null);
            const [googleAuth, setGoogleAuth] = useState(null);
            const [isGoogleLoggedIn, setIsGoogleLoggedIn] = useState(false);
            const [isGapiReady, setIsGapiReady] = useState(false);
            useEffect(() => {
                if (GOOGLE_API_KEY.startsWith("YOUR_") || GOOGLE_CLIENT_ID.startsWith("YOUR_")) return;
                
                const initClient = () => {
                    window.gapi.client.init({ apiKey: GOOGLE_API_KEY, clientId: GOOGLE_CLIENT_ID, discoveryDocs: DISCOVERY_DOCS, scope: SCOPES, }).then(() => {
                        setGapi(window.gapi);
                        const authInstance = window.gapi.auth2.getAuthInstance();
                        setGoogleAuth(authInstance);
                        setIsGoogleLoggedIn(authInstance.isSignedIn.get());
                        authInstance.isSignedIn.listen(setIsGoogleLoggedIn);
                        setIsGapiReady(true);
                    }).catch(error => console.error("Error initializing Google API client. Check API Key/Client ID.", error));
                };
                
                if (window.gapi && window.gapi.load) {
                    window.gapi.load('client:auth2', initClient);
                }
            }, []);
            const handleGoogleLogin = () => googleAuth?.signIn();
            const handleGoogleLogout = () => googleAuth?.signOut();
            const fetchGoogleEvents = useCallback(async (startDate, endDate) => {
                if (!isGoogleLoggedIn || !gapi) return [];
                const response = await gapi.client.calendar.events.list({ 'calendarId': 'primary', 'timeMin': startDate.toISOString(), 'timeMax': endDate.toISOString(), 'showDeleted': false, 'singleEvents': true, 'orderBy': 'startTime' });
                return response.result.items.map(event => {
                    const start = event.start.dateTime || event.start.date;
                    const end = event.end.dateTime || event.end.date;
                    const startDate = new Date(start);
                    const endDate = new Date(end);
                    return { id: `gcal-${event.id}`, title: event.summary, startTime: `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`, endTime: `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`, date: startDate.toISOString().split('T')[0], isGoogleEvent: true, color: '#3b82f6' };
                });
            }, [isGoogleLoggedIn, gapi]);
            return { isGoogleLoggedIn, handleGoogleLogin, handleGoogleLogout, fetchGoogleEvents, isGapiReady };
        };

        // --- Components ---
        const Modal = ({ isOpen, onClose, title, children }) => {
            if (!isOpen) return null;
            return (<div className="fixed inset-0 bg-black/60 backdrop-blur-md flex justify-center items-center z-50 p-4" onClick={onClose}><div className="bg-slate-800/80 border border-slate-700 rounded-lg shadow-2xl p-6 w-full max-w-md transform transition-all" onClick={e => e.stopPropagation()}><div className="flex justify-between items-center mb-4"><h2 className="text-2xl font-bold font-lexend text-white">{title}</h2><button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><X size={24} /></button></div>{children}</div></div>);
        };
        const PresetManager = ({ isOpen, onClose, presets, onAddPreset, onDeletePreset }) => {
            const [newPresetTitle, setNewPresetTitle] = useState('');
            const [newPresetType, setNewPresetType] = useState('task');
            const handleAdd = () => { if (newPresetTitle.trim()) { onAddPreset({ title: newPresetTitle.trim(), type: newPresetType }); setNewPresetTitle(''); } };
            return (<Modal isOpen={isOpen} onClose={onClose} title="Manage Presets"><div className="flex space-x-2 mb-4"><input type="text" value={newPresetTitle} onChange={(e) => setNewPresetTitle(e.target.value)} placeholder="New preset title" className="flex-grow px-3 py-2 bg-slate-900 border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white" /><select value={newPresetType} onChange={(e) => setNewPresetType(e.target.value)} className="px-3 py-2 bg-slate-900 border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white"><option value="task">Task</option><option value="event">Event</option><option value="appointment">Appointment</option></select></div><button onClick={handleAdd} className="w-full px-4 py-2 mb-4 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700 flex items-center justify-center space-x-2 transition-colors"><ListPlus size={18} /><span>Add Preset</span></button><div className="space-y-2 max-h-60 overflow-y-auto pr-2">{presets.map(preset => (<div key={preset.id} className="flex justify-between items-center p-2 bg-slate-700/50 rounded-md"><span className="text-slate-200">{preset.title} <span className="text-xs text-slate-400">({preset.type})</span></span><button onClick={() => onDeletePreset(preset.id)} className="text-rose-500 hover:text-rose-400 transition-colors"><Trash2 size={16} /></button></div>))}</div></Modal>);
        };
        const MemberManager = ({ isOpen, onClose, members, onAddMember, onDeleteMember, onReorderMembers }) => {
            const [newMemberName, setNewMemberName] = useState('');
            const [localMembers, setLocalMembers] = useState([]);
            useEffect(() => { setLocalMembers(members); }, [members]);
            const dragItem = useRef(null);
            const dragOverItem = useRef(null);
            const handleAdd = () => { if (newMemberName.trim()) { onAddMember(newMemberName.trim()); setNewMemberName(''); } };
            const handleDragStart = (e, index) => { dragItem.current = index; };
            const handleDragEnter = (e, index) => { dragOverItem.current = index; const newMembers = [...localMembers]; const draggedItemContent = newMembers.splice(dragItem.current, 1)[0]; newMembers.splice(dragOverItem.current, 0, draggedItemContent); dragItem.current = index; setLocalMembers(newMembers); };
            const handleDragEnd = () => { onReorderMembers(localMembers); dragItem.current = null; dragOverItem.current = null; };
            return (<Modal isOpen={isOpen} onClose={onClose} title="Manage Members"><div className="flex space-x-2 mb-4"><input type="text" value={newMemberName} onChange={(e) => setNewMemberName(e.target.value)} placeholder="New member's name" className="flex-grow px-3 py-2 bg-slate-900 border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white" /><button onClick={handleAdd} className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700 flex items-center space-x-2 transition-colors"><UserPlus size={18} /><span>Add</span></button></div><div className="space-y-2 max-h-60 overflow-y-auto pr-2">{localMembers.map((member, index) => (<div key={member.id} className="flex justify-between items-center p-2 bg-slate-700/50 rounded-md cursor-grab active:cursor-grabbing" draggable onDragStart={(e) => handleDragStart(e, index)} onDragEnter={(e) => handleDragEnter(e, index)} onDragEnd={handleDragEnd} onDragOver={(e) => e.preventDefault()}><div className="flex items-center"><GripVertical className="mr-2 text-slate-400" size={16} /><span className="text-slate-200">{member.name}</span></div><button onClick={() => onDeleteMember(member.id)} className="text-rose-500 hover:text-rose-400 transition-colors"><Trash2 size={16} /></button></div>))}</div></Modal>);
        };
        const EventModal = ({ isOpen, onClose, onSave, event, selectedDate, selectedTime, members, memberId, presets, notifications }) => {
            const [title, setTitle] = useState('');
            const [type, setType] = useState('event');
            const [status, setStatus] = useState('scheduled');
            const [startTime, setStartTime] = useState('09:00');
            const [endTime, setEndTime] = useState('09:15');
            const [selectedMemberId, setSelectedMemberId] = useState('');
            const [isCustomTitle, setIsCustomTitle] = useState(false);
            const [color, setColor] = useState('#3b82f6');
            const [location, setLocation] = useState('');
            const [description, setDescription] = useState('');
            const [notification, setNotification] = useState('none');
            const [recurrence, setRecurrence] = useState('none');

            useEffect(() => {
                if (isOpen) {
                    const isPreset = event && presets.some(p => p.title === event.title);
                    setIsCustomTitle(!isPreset && !!event);
                    if (event) {
                        setTitle(event.title || ''); setType(event.type || 'event'); setStatus(event.status || 'scheduled'); setStartTime(event.startTime || '09:00'); setEndTime(event.endTime || '09:15'); setSelectedMemberId(event.memberId || ''); setColor(event.color || '#3b82f6'); setLocation(event.location || ''); setDescription(event.description || ''); setNotification(event.notification || 'none'); setRecurrence(event.recurrence || 'none');
                    } else {
                        setTitle(presets.length > 0 ? presets[0].id : 'custom'); setType(presets.length > 0 ? presets[0].type : 'event'); setStatus('scheduled'); setSelectedMemberId(memberId || (members.length > 0 ? members[0].id : '')); setColor('#3b82f6'); setLocation(''); setDescription(''); setNotification('none'); setRecurrence('none');
                        if (selectedTime) {
                            setStartTime(selectedTime);
                            const [h, m] = selectedTime.split(':');
                            const endMinutes = (parseInt(m, 10) + 15) % 60;
                            const endHour = parseInt(h, 10) + (parseInt(m, 10) + 15 >= 60 ? 1 : 0);
                            setEndTime(`${String(endHour).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`);
                        } else { setStartTime('09:00'); setEndTime('09:15'); }
                    }
                }
            }, [event, selectedTime, isOpen, memberId, members, presets]);
            
            const handleTitleChange = (e) => { const value = e.target.value; if (value === 'custom') { setIsCustomTitle(true); setTitle(''); } else { setIsCustomTitle(false); const selectedPreset = presets.find(p => p.id === value); if (selectedPreset) { setTitle(selectedPreset.title); setType(selectedPreset.type); } } };
            const handleSave = () => {
                if (notification !== 'none' && notifications.permission !== 'granted') {
                    notifications.requestPermission();
                }
                const finalTitle = isCustomTitle ? title : presets.find(p => p.title === title)?.title || title; if (!finalTitle.trim() || !selectedMemberId) { alert("Please enter a title and select a member."); return; } if (timeToMinutes(startTime) >= timeToMinutes(endTime)) { alert("End time must be after start time."); return; } 
                const eventId = event && !event.isGoogleEvent && !event.isInstance ? event.i
