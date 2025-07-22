import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, query, where, writeBatch, orderBy, getDocs, setDoc } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { Plus, Trash2, Edit, X, Users, UserPlus, GripVertical, CheckCircle, XCircle, ArrowRightCircle, ListPlus, CalendarDays, LogIn, LogOut, ChevronLeft, ChevronRight, MapPin, Bell, Repeat, Award, Settings } from 'lucide-react';

// --- START: API Key Configuration ---
// These are now read from your Netlify settings, not here.
const GOOGLE_API_KEY = process.env.REACT_APP_GOOGLE_API_KEY;
const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;

const firebaseConfig = {
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
    storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.REACT_APP_FIREBASE_APP_ID
};
// --- END: API Key Configuration ---

const appId = 'july-one-permanent-storage';

// --- Initialize Firebase ---
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

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
        if (!GOOGLE_API_KEY || !GOOGLE_CLIENT_ID) return;
        const script = document.createElement('script');
        script.src = 'https://apis.google.com/js/api.js';
        script.onload = () => window.gapi.load('client:auth2', initClient);
        document.body.appendChild(script);
        const initClient = () => {
            window.gapi.client.init({ apiKey: GOOGLE_API_KEY, clientId: GOOGLE_CLIENT_ID, discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"], scope: "https://www.googleapis.com/auth/calendar.readonly", }).then(() => {
                setGapi(window.gapi);
                const authInstance = window.gapi.auth2.getAuthInstance();
                setGoogleAuth(authInstance);
                setIsGoogleLoggedIn(authInstance.isSignedIn.get());
                authInstance.isSignedIn.listen(setIsGoogleLoggedIn);
                setIsGapiReady(true);
            }).catch(error => console.error("Error initializing Google API client. Check API Key/Client ID.", error));
        };
        return () => { if (script.parentNode) document.body.removeChild(script); };
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
        const eventId = event && !event.isGoogleEvent && !event.isInstance ? event.id : null;
        onSave({ id: eventId, title: finalTitle, type, status, date: selectedDate.toISOString().split('T')[0], startTime, endTime, memberId: selectedMemberId, color, location, description, notification, recurrence }); 
        onClose(); 
    };
    const timeOptions = generateTimeSlots().slice(0, -1).map(time => <option key={time} value={time}>{time}</option>);
    const selectClasses = "w-full p-2 bg-slate-900 border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white";
    
    return (<Modal isOpen={isOpen} onClose={onClose} title={event ? 'Edit Event' : 'Add Event'}>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
            <div><label className="block text-sm font-medium text-slate-300 mb-1">Member</label><select value={selectedMemberId} onChange={(e) => setSelectedMemberId(e.target.value)} className={selectClasses}><option value="" disabled>Select a member</option>{members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
            <div><label className="block text-sm font-medium text-slate-300 mb-1">Title</label><select onChange={handleTitleChange} value={isCustomTitle ? 'custom' : presets.find(p => p.title === title)?.id || 'custom'} className={`${selectClasses} mb-2`}>{presets.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}<option value="custom">-- Other (Custom) --</option></select>{isCustomTitle && <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full p-2 bg-slate-900 border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Custom title" />}</div>
            <div className="flex space-x-4">
                <div className="w-1/2"><label className="block text-sm font-medium text-slate-300 mb-1">Type</label><select value={type} onChange={(e) => setType(e.target.value)} className={selectClasses} disabled={!isCustomTitle}><option value="event">Event</option><option value="task">Task</option><option value="appointment">Appointment</option></select></div>
                <div className="w-1/2"><label className="block text-sm font-medium text-slate-300 mb-1">Status</label><select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClasses}><option value="scheduled">Scheduled</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option><option value="rescheduled">Rescheduled</option></select></div>
            </div>
            <div><label className="block text-sm font-medium text-slate-300 mb-1">Location</label><input type="text" value={location} onChange={(e) => setLocation(e.target.value)} className={selectClasses} placeholder="e.g., Home Office" /></div>
            <div><label className="block text-sm font-medium text-slate-300 mb-1">Description</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} className={selectClasses} rows="3" placeholder="Add notes or details..."></textarea></div>
            <div className="flex space-x-4">
                <div className="w-1/2"><label className="block text-sm font-medium text-slate-300 mb-1">Reminder</label><select value={notification} onChange={(e) => setNotification(e.target.value)} className={selectClasses}><option value="none">None</option><option value="5">5 minutes before</option><option value="15">15 minutes before</option><option value="30">30 minutes before</option></select></div>
                <div className="w-1/2"><label className="block text-sm font-medium text-slate-300 mb-1">Repeats</label><select value={recurrence} onChange={(e) => setRecurrence(e.target.value)} className={selectClasses}><option value="none">Does not repeat</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></div>
            </div>
            <div><label className="block text-sm font-medium text-slate-300 mb-1">Color</label><input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-full h-10 p-1 bg-slate-900 border border-slate-600 rounded-md cursor-pointer" /></div>
            <div className="flex items-center space-x-4">
                <div className="w-1/2"><label className="block text-sm font-medium text-slate-300 mb-1">Start Time</label><select value={startTime} onChange={(e) => setStartTime(e.target.value)} className={selectClasses}>{timeOptions}</select></div>
                <div className="w-1/2"><label className="block text-sm font-medium text-slate-300 mb-1">End Time</label><select value={endTime} onChange={(e) => setEndTime(e.target.value)} className={selectClasses}>{generateTimeSlots().map(time => <option key={time} value={time}>{time}</option>)}</select></div>
            </div>
        </div>
        <div className="mt-6 flex justify-end space-x-3"><button onClick={onClose} className="px-4 py-2 bg-slate-700 text-slate-200 font-semibold rounded-md hover:bg-slate-600 transition-colors">Cancel</button><button onClick={handleSave} className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700 transition-colors">Save Event</button></div>
    </Modal>);
};

const EventBlock = ({ event, onEdit, onDelete, onStatusChange }) => {
    const status = event.status || 'scheduled';
    const statusStyles = { scheduled: `bg-opacity-20`, completed: 'bg-opacity-10 border-opacity-40 opacity-70', cancelled: 'bg-opacity-10 border-opacity-40 opacity-60', rescheduled: 'bg-opacity-20 border-opacity-70 opacity-80' };
    const statusIcons = { completed: <CheckCircle className="text-emerald-400" size={12} />, cancelled: <XCircle className="text-rose-400" size={12} />, rescheduled: <ArrowRightCircle className="text-amber-400" size={12} /> };
    const start = timeToMinutes(event.startTime); const end = timeToMinutes(event.endTime); const top = (start / 15) * 1.5; const height = ((end - start) / 15) * 1.5;

    return (
        <div className={`absolute left-1 right-1 mx-auto p-1.5 rounded-md text-white flex flex-col justify-between border-l-4 overflow-hidden group transition-all duration-200 ${statusStyles[status]}`} style={{ top: `${top}rem`, height: `${height}rem`, minHeight: '1.5rem', backgroundColor: event.color, borderColor: event.color }}>
            <div>
                <p className={`font-semibold text-xs truncate flex items-center gap-1.5 ${status === 'cancelled' && 'line-through'}`}>{statusIcons[status]} {event.title}</p>
                <p className="text-[10px] text-slate-400">{event.startTime} - {event.endTime}</p>
                <div className="flex items-center gap-2 text-slate-400">
                    {event.location && <p className="text-[10px] truncate flex items-center gap-1"><MapPin size={10}/> {event.location}</p>}
                    {event.notification && event.notification !== 'none' && <Bell size={10} />}
                    {event.recurrence && event.recurrence !== 'none' && <Repeat size={10} />}
                </div>
            </div>
            <div className="flex items-center justify-end space-x-1 opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-1 right-1 bg-slate-900/50 backdrop-blur-sm rounded-full p-0.5">
                {event.isGoogleEvent ? (
                    <button onClick={() => onEdit(event)} title="Assign to Member" className="p-1 rounded-full text-slate-300 hover:bg-white/10"><LogIn size={14} /></button>
                ) : (
                    <>
                        {status !== 'completed' && <button onClick={() => onStatusChange(event.id, 'completed')} title="Complete" className="p-1 rounded-full text-emerald-400 hover:bg-white/10"><CheckCircle size={14} /></button>}
                        {status !== 'cancelled' && <button onClick={() => onStatusChange(event.id, 'cancelled')} title="Cancel" className="p-1 rounded-full text-rose-400 hover:bg-white/10"><XCircle size={14} /></button>}
                        {status !== 'rescheduled' && <button onClick={() => onStatusChange(event.id, 'rescheduled')} title="Reschedule" className="p-1 rounded-full text-amber-400 hover:bg-white/10"><ArrowRightCircle size={14} /></button>}
                        <button onClick={() => onEdit(event)} title="Edit" className="p-1 rounded-full text-slate-300 hover:bg-white/10"><Edit size={14} /></button>
                        <button onClick={() => onDelete(event.id)} title="Delete" className="p-1 rounded-full text-slate-300 hover:bg-white/10"><Trash2 size={14} /></button>
                    </>
                )}
            </div>
        </div>
    );
};

const DayView = ({ members, events, onAdd, onEdit, onDelete, onStatusChange }) => {
    const timeSlots = useMemo(() => generateTimeSlots(), []);
    return (<div className="flex-grow flex bg-slate-800/50 rounded-lg shadow-inner overflow-auto border border-slate-700"><div className="w-16 flex-shrink-0"><div className="h-12 sticky top-0 bg-slate-800/50 z-10 backdrop-blur-sm"></div>{timeSlots.map(time => <div key={time} className="h-6 flex items-center justify-center border-r border-slate-700"><span className="text-xs text-slate-500">{time.endsWith(':00') ? time.substring(0, 2) : ''}</span></div>)}</div><div className="flex-grow flex divide-x divide-slate-700">{members.map(member => (<div key={member.id} className="flex-grow min-w-[200px]"><div className="h-12 sticky top-0 bg-slate-800/50 backdrop-blur-sm z-10 flex items-center justify-center border-b border-slate-700"><h3 className="font-bold text-lg text-white font-lexend">{member.name}</h3></div><div className="relative">{timeSlots.map(time => <div key={time} className="h-6 border-b border-slate-700/50 cursor-pointer hover:bg-indigo-500/10 group" onClick={() => onAdd(time, member.id)}><Plus size={14} className="mx-auto text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" /></div>)}{events.filter(e => e.memberId === member.id).map(event => <EventBlock key={event.id} event={event} onEdit={onEdit} onDelete={onDelete} onStatusChange={onStatusChange} />)}</div></div>))}</div></div>);
};

const MonthView = ({ events, selectedDate, setSelectedDate, onAdd, behaviorLogs }) => {
    const firstDayOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const lastDayOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
    const firstDayOfWeek = firstDayOfMonth.getDay();
    const daysInMonth = lastDayOfMonth.getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), i + 1));
    const paddingDays = Array.from({ length: firstDayOfWeek }, () => null);
    const calendarDays = [...paddingDays, ...days];
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const getDailyBehaviorEmoji = (day) => {
        if (!day) return null;
        const logsForDay = behaviorLogs.filter(log => new Date(log.timestamp).toDateString() === day.toDateString());
        if (logsForDay.length === 0) return null;

        const goodChoices = logsForDay.filter(l => l.choice === 'good').length;
        const badChoices = logsForDay.filter(l => l.choice === 'bad').length;

        if (goodChoices > badChoices) return '😊';
        if (badChoices > goodChoices) return '😔';
        return '😐';
    };

    return (
        <div className="flex-grow flex flex-col bg-slate-800/50 rounded-lg shadow-inner border border-slate-700">
            <div className="grid grid-cols-7 flex-shrink-0">
                {weekDays.map(day => <div key={day} className="text-center py-2 border-b border-slate-700 font-bold text-sm text-slate-300">{day}</div>)}
            </div>
            <div className="grid grid-cols-7 grid-rows-5 flex-grow">
                {calendarDays.map((day, index) => {
                    const isToday = day && new Date().toDateString() === day.toDateString();
                    const dailyEmoji = getDailyBehaviorEmoji(day);
                    return (
                        <div key={index} className={`border-b border-r border-slate-700 p-1.5 flex flex-col group relative ${day ? 'hover:bg-slate-700/50 transition-colors' : 'bg-slate-800/50'}`} onClick={() => day && setSelectedDate(day)}>
                            {day && (
                                <>
                                    <div className="flex justify-between items-start">
                                        <span className={`font-semibold text-sm ${isToday ? 'text-white font-bold bg-indigo-600 rounded-full w-6 h-6 flex items-center justify-center' : 'text-slate-400'}`}>{day.getDate()}</span>
                                        {dailyEmoji && <span className="text-lg">{dailyEmoji}</span>}
                                    </div>
                                    <div className="mt-1 space-y-1 overflow-y-auto">
                                        {events.filter(e => e.date === day.toISOString().split('T')[0]).map(e => (
                                            <div key={e.id} className="text-xs px-1.5 py-0.5 rounded-md text-white truncate" style={{ backgroundColor: e.color }}>{e.title}</div>
                                        ))}
                                    </div>
                                    <button onClick={(evt) => { evt.stopPropagation(); onAdd(null, null, day); }} className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110 active:scale-95"><Plus size={16} /></button>
                                </>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    );
};

const BehaviorLogModal = ({ isOpen, onClose, onSave, selectedDate }) => {
    const [behavior, setBehavior] = useState('listening');
    const [choice, setChoice] = useState('good');
    const [situation, setSituation] = useState('');
    const [response, setResponse] = useState('');
    const [outcome, setOutcome] = useState('');
    const [time, setTime] = useState(new Date().toTimeString().slice(0, 5));

    const behaviors = [
        { key: 'listening', label: 'Not Listening / Following Directions' },
        { key: 'ignoring', label: 'Ignoring Adults' },
        { key: 'attitude', label: 'Talking Back / Attitude' },
        { key: 'bossy', label: 'Demanding / Bossy' },
        { key: 'yelling', label: 'Yelling / Screaming' },
        { key: 'running', label: 'Running Indoors' },
    ];
    const selectClasses = "w-full p-2 bg-slate-900 border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white";

    const handleSave = () => {
        const logDateTime = new Date(selectedDate.toDateString() + ' ' + time);
        onSave({
            behavior,
            choice,
            situation,
            response,
            outcome,
            timestamp: logDateTime.toISOString(),
        });
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Log New Behavior">
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                <div><label className="block text-sm font-medium text-slate-300 mb-1">Time of Incident</label><input type="time" value={time} onChange={e => setTime(e.target.value)} className={selectClasses} /></div>
                <div><label className="block text-sm font-medium text-slate-300 mb-1">Behavior</label><select value={behavior} onChange={e => setBehavior(e.target.value)} className={selectClasses}>{behaviors.map(b => <option key={b.key} value={b.key}>{b.label}</option>)}</select></div>
                <div><label className="block text-sm font-medium text-slate-300 mb-1">Choice</label><div className="flex space-x-4">
                    <button onClick={() => setChoice('good')} className={`flex-1 p-2 rounded-md text-2xl ${choice === 'good' ? 'bg-green-500/30' : 'bg-slate-700'}`}>😇</button>
                    <button onClick={() => setChoice('bad')} className={`flex-1 p-2 rounded-md text-2xl ${choice === 'bad' ? 'bg-red-500/30' : 'bg-slate-700'}`}>👿</button>
                </div></div>
                <div><label className="block text-sm font-medium text-slate-300 mb-1">What was the situation?</label><textarea value={situation} onChange={e => setSituation(e.target.value)} className={selectClasses} rows="3"></textarea></div>
                <div><label className="block text-sm font-medium text-slate-300 mb-1">How I responded (consequence)</label><textarea value={response} onChange={e => setResponse(e.target.value)} className={selectClasses} rows="3"></textarea></div>
                <div><label className="block text-sm font-medium text-slate-300 mb-1">How Sydney handled it</label><textarea value={outcome} onChange={e => setOutcome(e.target.value)} className={selectClasses} rows="3"></textarea></div>
            </div>
            <div className="mt-6 flex justify-end"><button onClick={handleSave} className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700 transition-colors">Log Behavior</button></div>
        </Modal>
    );
};

const BehaviorView = ({ behaviorLogs, onLog, selectedDate, allLogs }) => {
    const [isLogModalOpen, setIsLogModalOpen] = useState(false);
    
    const dailyLogs = behaviorLogs.filter(log => new Date(log.timestamp).toDateString() === selectedDate.toDateString());

    const getCounts = (logs) => {
        return logs.reduce((acc, log) => {
            if (log.choice === 'good') acc.good++;
            if (log.choice === 'bad') acc.bad++;
            return acc;
        }, { good: 0, bad: 0 });
    };

    const today = new Date();
    const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const dailyCounts = getCounts(dailyLogs);
    const weeklyCounts = getCounts(allLogs.filter(log => new Date(log.timestamp) >= startOfWeek));
    const monthlyCounts = getCounts(allLogs.filter(log => new Date(log.timestamp) >= startOfMonth));
    
    return (
        <div className="flex-grow flex flex-col lg:flex-row gap-4">
            <BehaviorLogModal isOpen={isLogModalOpen} onClose={() => setIsLogModalOpen(false)} onSave={onLog} selectedDate={selectedDate} />
            <div className="lg:w-2/3 flex flex-col bg-slate-800/50 rounded-lg shadow-inner border border-slate-700 p-4">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-lexend font-bold text-white">Behavior Log for {formatDate(selectedDate, {month: 'long', day: 'numeric'})}</h2>
                    <button onClick={() => setIsLogModalOpen(true)} className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white font-bold rounded-md hover:bg-indigo-700 transition-colors"><Plus size={20} /><span>Log Behavior</span></button>
                </div>
                <div className="flex-grow space-y-3 overflow-y-auto pr-2">
                    {dailyLogs.length > 0 ? dailyLogs.map(log => (
                        <div key={log.id} className="bg-slate-700/50 p-3 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="font-bold text-lg">{log.behavior.charAt(0).toUpperCase() + log.behavior.slice(1)} <span className="text-2xl">{log.choice === 'good' ? '😇' : '👿'}</span></h3>
                                <span className="text-xs text-slate-400">{new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            </div>
                            <div className="text-sm space-y-1 text-slate-300">
                                <p><strong className="text-slate-400">Situation:</strong> {log.situation}</p>
                                <p><strong className="text-slate-400">Response:</strong> {log.response}</p>
                                <p><strong className="text-slate-400">Outcome:</strong> {log.outcome}</p>
                            </div>
                        </div>
                    )) : <p className="text-center text-slate-400 mt-8">No behaviors logged for this day.</p>}
                </div>
            </div>
            <div className="lg:w-1/3 flex flex-col gap-4">
                <div className="bg-slate-800/50 rounded-lg shadow-inner border border-slate-700 p-4">
                    <h3 className="text-xl font-lexend font-bold text-center mb-2">📊 Report Card</h3>
                    <div className="space-y-2">
                        <div className="flex justify-between items-center"><span>Today:</span><div className="flex gap-2"><span>😇 {dailyCounts.good}</span><span>👿 {dailyCounts.bad}</span></div></div>
                        <div className="flex justify-between items-center"><span>This Week:</span><div className="flex gap-2"><span>😇 {weeklyCounts.good}</span><span>👿 {weeklyCounts.bad}</span></div></div>
                        <div className="flex justify-between items-center"><span>This Month:</span><div className="flex gap-2"><span>😇 {monthlyCounts.good}</span><span>👿 {monthlyCounts.bad}</span></div></div>
                    </div>
                </div>
                <div className="bg-slate-800/50 rounded-lg shadow-inner border border-slate-700 p-4">
                    <h3 className="text-xl font-lexend font-bold text-center mb-2">🏆 Rewards</h3>
                    <p className="text-sm text-center text-slate-400">Track rewards earned here.</p>
                </div>
            </div>
        </div>
    );
};

const Header = ({ selectedDate, setSelectedDate, view, setView, onAdd, onManageMembers, onManagePresets, googleAuth }) => {
    const handlePrev = () => setSelectedDate(d => new Date(d.getFullYear(), d.getMonth() + (view === 'month' ? -1 : 0), d.getDate() + (view !== 'month' ? -1 : 0)));
    const handleNext = () => setSelectedDate(d => new Date(d.getFullYear(), d.getMonth() + (view === 'month' ? 1 : 0), d.getDate() + (view !== 'month' ? 1 : 0)));
    return (
        <header className="p-4 flex flex-col sm:flex-row justify-between items-center bg-slate-900/70 backdrop-blur-md border-b border-slate-700 flex-shrink-0 sticky top-0 z-20">
            <div className="flex items-center space-x-4 mb-4 sm:mb-0">
                <div className="flex items-center space-x-2 text-indigo-400"><CalendarDays size={28} /><h1 className="text-3xl font-bold font-lexend text-white">July One</h1></div>
                <div className="flex items-center space-x-2 bg-slate-800 border border-slate-700 rounded-md p-1">
                    <button onClick={handlePrev} className="p-2 rounded-md hover:bg-slate-700 transition-colors"><ChevronLeft size={20}/></button>
                    <button onClick={() => setSelectedDate(new Date())} className="px-3 py-1.5 rounded-md text-sm font-semibold border border-slate-600 hover:bg-slate-700 transition-colors">Today</button>
                    <button onClick={handleNext} className="p-2 rounded-md hover:bg-slate-700 transition-colors"><ChevronRight size={20}/></button>
                </div>
                <h2 className="text-xl font-semibold text-slate-300">{formatDate(selectedDate, { month: 'long', year: 'numeric', ...(view !== 'month' && { day: 'numeric', weekday: 'long' }) })}</h2>
            </div>
            <div className="flex items-center space-x-3">
                 <div className="p-1 bg-slate-800 border border-slate-700 rounded-md flex space-x-1">
                    <button onClick={() => setView('month')} className={`px-3 py-1.5 text-sm font-semibold rounded ${view === 'month' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-700'}`}>Month</button>
                    <button onClick={() => setView('day')} className={`px-3 py-1.5 text-sm font-semibold rounded ${view === 'day' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-700'}`}>Day</button>
                    <button onClick={() => setView('chart')} className={`px-3 py-1.5 text-sm font-semibold rounded ${view === 'chart' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-700'}`}>Behavior</button>
                 </div>
                 {googleAuth.isGapiReady && (<>{googleAuth.isGoogleLoggedIn ? <button onClick={googleAuth.handleGoogleLogout} className="flex items-center space-x-2 px-3 py-2 bg-rose-600 text-white font-semibold rounded-md hover:bg-rose-700 transition-colors"><LogOut size={18} /><span>Disconnect</span></button> : <button onClick={googleAuth.handleGoogleLogin} className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition-colors"><LogIn size={18} /><span>Sync Google</span></button>}</>)}
                 <button onClick={onManagePresets} className="flex items-center space-x-2 px-3 py-2 bg-slate-700 text-slate-200 font-semibold rounded-md hover:bg-slate-600 transition-colors"><ListPlus size={18} /><span>Presets</span></button>
                 <button onClick={onManageMembers} className="flex items-center space-x-2 px-3 py-2 bg-slate-700 text-slate-200 font-semibold rounded-md hover:bg-slate-600 transition-colors"><Users size={18} /><span>Members</span></button>
                 <button onClick={() => onAdd(null, null)} className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white font-bold rounded-md hover:bg-indigo-700 transition-colors"><Plus size={20} /><span>Add Event</span></button>
            </div>
        </header>
    );
};

function App() {
    const [userId, setUserId] = useState(null);
    const [members, setMembers] = useState([]);
    const [presets, setPresets] = useState([]);
    const [events, setEvents] = useState([]);
    const [googleEvents, setGoogleEvents] = useState([]);
    const [behaviorLogs, setBehaviorLogs] = useState([]);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [view, setView] = useState('month');
    const [isEventModalOpen, setIsEventModalOpen] = useState(false);
    const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
    const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState(null);
    const [selectedTime, setSelectedTime] = useState(null);
    const [selectedMemberId, setSelectedMemberId] = useState(null);
    const [modalDate, setModalDate] = useState(new Date());
    const [isLoading, setIsLoading] = useState(true);

    const notifications = useNotifications();
    const googleAuth = useGoogleCalendar();

    const membersCollectionPath = userId ? `artifacts/${appId}/users/${userId}/members` : null;
    const eventsCollectionPath = userId ? `artifacts/${appId}/users/${userId}/events` : null;
    const presetsCollectionPath = userId ? `artifacts/${appId}/users/${userId}/presets` : null;
    const behaviorLogsPath = userId ? `artifacts/${appId}/users/${userId}/behaviorLogs` : null;

    useEffect(() => { onAuthStateChanged(auth, async (user) => { if (user) { setUserId(user.uid); } else { try { if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) { await signInWithCustomToken(auth, __initial_auth_token); } else { await signInAnonymously(auth); } } catch (error) { console.error("Error signing in:", error); } } }); }, []);

    useEffect(() => {
        if (!userId || !membersCollectionPath || !presetsCollectionPath) return;
        
        const unsubMembers = onSnapshot(query(collection(db, membersCollectionPath), orderBy("order")), snapshot => {
            setMembers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setIsLoading(false);
        }, error => console.error("Firestore Error (members):", error));
        
        const unsubPresets = onSnapshot(query(collection(db, presetsCollectionPath), orderBy("title")), snapshot => setPresets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))), error => console.error("Firestore Error (presets):", error));
        
        return () => { unsubMembers(); unsubPresets(); };
    }, [userId, membersCollectionPath, presetsCollectionPath]);

    const getRecurringEvents = (baseEvents, viewStartDate, viewEndDate) => {
        const recurringInstances = [];
        baseEvents.forEach(event => {
            if (event.recurrence && event.recurrence !== 'none') {
                let currentDate = new Date(event.date + 'T00:00:00');
                while (currentDate <= viewEndDate) {
                    if (currentDate >= viewStartDate) {
                        recurringInstances.push({ ...event, id: `${event.id}-${currentDate.toISOString().split('T')[0]}`, date: currentDate.toISOString().split('T')[0], isInstance: true, });
                    }
                    if (event.recurrence === 'daily') currentDate.setDate(currentDate.getDate() + 1);
                    else if (event.recurrence === 'weekly') currentDate.setDate(currentDate.getDate() + 7);
                    else if (event.recurrence === 'monthly') currentDate.setMonth(currentDate.getMonth() + 1);
                    else break; 
                }
            }
        });
        return recurringInstances;
    };


    useEffect(() => {
        if (!userId || !eventsCollectionPath || !behaviorLogsPath) return;
        
        const viewStartDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
        const viewEndDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);

        const qEvents = query(collection(db, eventsCollectionPath), where("date", "<=", viewEndDate.toISOString().split('T')[0]));
        const unsubscribeEvents = onSnapshot(qEvents, snapshot => {
            const fetchedEvents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const recurringInstances = getRecurringEvents(fetchedEvents, viewStartDate, viewEndDate);
            const nonRecurring = fetchedEvents.filter(e => !e.recurrence || e.recurrence === 'none');
            const combined = [...nonRecurring, ...recurringInstances].filter(e => new Date(e.date) >= viewStartDate && new Date(e.date) <= viewEndDate);
            setEvents(combined);
            combined.forEach(notifications.scheduleNotification);
        }, error => console.error("Firestore Error (events):", error));
        
        if (googleAuth.isGoogleLoggedIn) {
            googleAuth.fetchGoogleEvents(viewStartDate, viewEndDate).then(setGoogleEvents);
        } else {
            setGoogleEvents([]);
        }
        
        const qBehavior = query(collection(db, behaviorLogsPath), orderBy("timestamp", "desc"));
        const unsubscribeBehavior = onSnapshot(qBehavior, snapshot => {
            setBehaviorLogs(snapshot.docs.map(doc => ({id: doc.id, ...doc.data()})));
        });

        return () => { unsubscribeEvents(); unsubscribeBehavior(); };
    }, [userId, selectedDate, googleAuth.isGoogleLoggedIn]);

    const handleAddEvent = (time, memberId, dateForModal = selectedDate) => { setEditingEvent(null); setSelectedTime(time); setSelectedMemberId(memberId); setModalDate(dateForModal); setIsEventModalOpen(true); };
    const handleEditEvent = (event) => { setEditingEvent(event); setSelectedTime(null); setSelectedMemberId(null); setModalDate(new Date(event.date)); setIsEventModalOpen(true); };
    const handleDeleteEvent = async (eventId) => { if (!eventsCollectionPath) return; if (window.confirm("Delete this event permanently?")) { await deleteDoc(doc(db, eventsCollectionPath, eventId)); notifications.cancelNotification(eventId); } };
    const handleStatusChange = async (eventId, status) => { if (!eventsCollectionPath) return; await updateDoc(doc(db, eventsCollectionPath, eventId), { status }); };
    const handleSaveEvent = async (eventData) => { if (!eventsCollectionPath) return; try { if (eventData.id) { const { id, ...data } = eventData; await updateDoc(doc(db, eventsCollectionPath, id), data); notifications.scheduleNotification({id, ...data}); } else { const newDoc = await addDoc(collection(db, eventsCollectionPath), { ...eventData, createdAt: new Date() }); notifications.scheduleNotification({id: newDoc.id, ...eventData}); } } catch (error) { console.error("Error saving event: ", error); } };
    const handleAddMember = async (name) => { if (!membersCollectionPath) return; await addDoc(collection(db, membersCollectionPath), { name, createdAt: new Date(), order: members.length }); };
    const handleDeleteMember = async (memberId) => { if (!membersCollectionPath) return; if (window.confirm("Delete this member?")) await deleteDoc(doc(db, membersCollectionPath, memberId)); };
    const handleReorderMembers = async (reorderedMembers) => { if (!membersCollectionPath) return; const batch = writeBatch(db); reorderedMembers.forEach((member, index) => batch.update(doc(db, membersCollectionPath, member.id), { order: index })); await batch.commit(); };
    const handleAddPreset = async (preset) => { if (!presetsCollectionPath) return; await addDoc(collection(db, presetsCollectionPath), { ...preset, createdAt: new Date() }); };
    const handleDeletePreset = async (presetId) => { if (!presetsCollectionPath) return; await deleteDoc(doc(db, presetsCollectionPath, presetId)); };
    const handleLogBehavior = async (logData) => { if (!behaviorLogsPath) return; await addDoc(collection(db, behaviorLogsPath), logData); };

    const membersWithGoogle = useMemo(() => {
        if (googleAuth.isGoogleLoggedIn) {
            return [{ id: 'gcal', name: 'Google' }, ...members];
        }
        return members;
    }, [members, googleAuth.isGoogleLoggedIn]);

    const allEvents = useMemo(() => {
        const googleEventsWithMemberId = googleEvents.map(e => ({ ...e, memberId: 'gcal' }));
        return [...events, ...googleEventsWithMemberId];
    }, [events, googleEvents]);
    
    const dailyEvents = allEvents.filter(e => e.date === selectedDate.toISOString().split('T')[0]);

    if (isLoading) return <div className="flex items-center justify-center h-screen bg-slate-900 text-white">Loading Your Schedule...</div>;

    return (
        <div className="h-screen w-screen bg-gradient-to-br from-slate-900 to-indigo-900/50 text-slate-200 flex flex-col">
            <StyleInjector />
            <PWAInstaller />
            <Header selectedDate={selectedDate} setSelectedDate={setSelectedDate} view={view} setView={setView} onAdd={handleAddEvent} onManageMembers={() => setIsMemberModalOpen(true)} onManagePresets={() => setIsPresetModalOpen(true)} googleAuth={googleAuth} />
            <main className="flex-grow p-4 overflow-hidden flex flex-col">
                <div className="flex-grow flex flex-col">
                    {view === 'day' ? <DayView members={membersWithGoogle} events={dailyEvents} onAdd={handleAddEvent} onEdit={handleEditEvent} onDelete={handleDeleteEvent} onStatusChange={handleStatusChange} /> : 
                     view === 'month' ? <MonthView events={allEvents} selectedDate={selectedDate} setSelectedDate={setSelectedDate} onAdd={handleAddEvent} behaviorLogs={behaviorLogs} /> :
                     <BehaviorView behaviorLogs={behaviorLogs} onLog={handleLogBehavior} selectedDate={selectedDate} allLogs={behaviorLogs}/>}
                </div>
            </main>
            <EventModal isOpen={isEventModalOpen} onClose={() => setIsEventModalOpen(false)} onSave={handleSaveEvent} event={editingEvent} selectedDate={modalDate} selectedTime={selectedTime} members={members} memberId={selectedMemberId} presets={presets} notifications={notifications} />
            <MemberManager isOpen={isMemberModalOpen} onClose={() => setIsMemberModalOpen(false)} members={members} onAddMember={handleAddMember} onDeleteMember={handleDeleteMember} onReorderMembers={handleReorderMembers} />
            <PresetManager isOpen={isPresetModalOpen} onClose={() => setIsPresetModalOpen(false)} presets={presets} onAddPreset={handleAddPreset} onDeletePreset={handleDeletePreset} />
        </div>
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
