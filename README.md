# Floor Attendance Manager

This project provides a real‑time, browser‑based attendance management system designed for floor‑level student accommodation tracking. It allows operators to record, review, and manage room‑wise attendance efficiently, with automated resets, activity logs, notifications, and responsive UI behavior.

---

## 🚀 Features

### **1. Real‑Time Attendance Updates**
- Uses Firebase Realtime Database for instant sync across all connected clients.
- Displays up‑to‑date student counts for each room.
- Total attendance automatically recalculates and visually updates.

### **2. Room‑Wise Attendance Controls**
- Each room supports input from **0 to 6 students**.
- Validation ensures incorrect values cannot be entered.
- Visual progress indicators reflect room occupancy.

### **3. Daily Auto‑Reset System**
- Automatic reset at **6:00 PM** if not already performed.
- Logs reset events into an activity log.
- Manual reset logic included (if triggered programmatically).

### **4. Attendance Input Time Window**
- Optional restriction to allow updates only between **7:00 PM – 9:00 PM**.
- Customized alert and warning notifications.

### **5. Activity Log Viewer**
- Displays historical update actions.
- Filterable by **date**, **user**, and **room number**.
- Helps administrators audit system usage.

### **6. Notifications System**
- Capacity alerts (80%, 95%, full).
- Attendance‑time‑window reminders.
- Success and error notifications for user actions.

### **7. Theme Support (Light/Dark)**
- Includes a toggle button and saves user preference.
- Full UI adapts dynamically.

### **8. Mobile‑Optimized Interface**
- Responsive layout for small screens.
- Larger inputs and simplified controls on mobile.

---

## 🧱 Project Structure

```
├── fas.html        # Main application UI and JS logic
├── styles.css      # Custom UI styles and overrides
├── README.md       # Project documentation (this file)
```

- **HTML file** contains UI layout, Firebase initialization, all interaction logic, and rendering.
- **CSS file** provides design, theme rules, animations, and responsive behavior.

---

## 🔧 Technologies Used

- **Firebase Realtime Database** – For real‑time sync and structured data.
- **TailwindCSS CDN** – Utility‑based responsive styling.
- **Vanilla JavaScript (ES Module)** – Logic for UI updates, CRUD, listeners.
- **HTML5 / CSS3** – Core UI.

---

## 🛠️ Setup Instructions

### **1. Clone or Download the Files**
Place the following files in the same directory:
- `fas.html`
- `styles.css`
- `README.md`

### **2. Configure Firebase**
The Firebase config block is already embedded in `fas.html`:
```js
const firebaseConfig = {
    apiKey: "...",
    authDomain: "...",
    databaseURL: "...",
    projectId: "...",
    storageBucket: "...",
    messagingSenderId: "...",
    appId: "...",
    measurementId: "..."
};
```
Update the values above if using a different Firebase project.

### **3. Run the System**
Simply open `fas.html` in any modern browser.
No local server is required.

---

## 📦 Database Structure
The system stores data using the following paths:

### **Attendance Data**
```
attendance/
  └── YYYY-MM-DD/
        └── room_402/ { room, present_count, updated_by, timestamp }
        └── room_403/ ...
        ...
```

### **Activity Logs**
```
activity_logs/
   └── <timestamp>/ { user, action, details, timestamp, date }
```

### **Email Reminders (Optional)**
```
email_reminders/
   └── <timestamp>/ { user, email, type, timestamp, date, message }
```

### **Reset Tracker**
```
reset_tracker/
   └── last_reset: <ISO timestamp>
```

---

## 🔐 User & Security Considerations
- The system currently assigns `system` as the default user unless authentication is added.
- For production usage, consider integrating Firebase Authentication.

---

## 📱 Responsive Behavior
- Automatic single‑column layout on small screens.
- Enlarged controls for touch devices.
- Reduced clutter for mobile view.

---

## 📝 Future Improvements
- User authentication & role permissions.
- Exportable attendance logs (CSV / PDF).
- Multi‑floor support.
- Push notifications for late submissions.

---

## 📄 License
This project is provided for educational and operational use. Licensing can be added as needed.
