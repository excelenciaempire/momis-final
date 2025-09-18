# MOMi Project Implementation Guide

## 🎯 **Complete System Architecture**

This implementation creates a **complete Supabase-only authentication system** with clear separation between regular users and admin access.

### **URL Structure:**
```
Registration/Login: https://yourdomain.com/
User Chat:         https://yourdomain.com/chat
Admin Dashboard:   https://yourdomain.com/admin/
```

### **Key Components:**
1. **Registration System** (`frontend_registration/`) - New user onboarding
2. **Admin System** - Separate admin authentication and management
3. **Enhanced Backend** - No guest users, full authentication required
4. **User Chat** - Profile-aware full-page chatbot
5. **Admin Dashboard** - Complete user and conversation management

---

## 🗄️ **Database Changes Required**

### **1. Run Database Schema Updates**

Execute these SQL files in your Supabase SQL editor:

```bash
# 1. Apply main schema changes
/database_schema.sql

# 2. Apply admin system schema
/database_schema_admin.sql
```

### **2. Key Schema Changes:**
- ✅ **Removed:** `guest_users` table completely
- ✅ **Added:** `user_profiles` table for extended user data
- ✅ **Added:** `admin_users`, `admin_sessions`, `admin_activity_log` tables
- ✅ **Updated:** `conversations` table to require user authentication
- ✅ **Enhanced:** Row Level Security (RLS) policies

---

## 🚀 **Backend Updates Required**

### **1. Install New Dependencies**

```bash
cd backend/
npm install bcrypt uuid
```

### **2. Update Environment Variables**

Add to your `.env` file:
```bash
# Admin system
ADMIN_INIT_KEY=your_secure_initialization_key_here
```

### **3. Update Backend Files**

The following files have been created/updated:
- ✅ `middleware/authAdmin.js` - Enhanced admin authentication
- ✅ `routes/adminAuth.js` - Admin login/logout/session management
- ✅ Backend now requires authentication for all chat operations

### **4. Mount Admin Auth Routes**

Add to your main `index.js`:
```javascript
const adminAuthRoutes = require('./routes/adminAuth');
app.use('/api/admin/auth', adminAuthRoutes);
```

---

## 🎨 **Frontend Structure**

### **Registration Application** (`frontend_registration/`)
```
src/
├── components/
│   └── RegistrationForm.jsx     # Complete 7-section form
├── pages/
│   ├── LandingPage.jsx         # Welcome page
│   ├── RegistrationPage.jsx    # User registration
│   ├── LoginPage.jsx           # User login
│   ├── ChatPage.jsx           # Full-page chat
│   └── TermsPage.jsx          # Terms & conditions
├── styles/
│   ├── global.css             # Global styles with purple theme
│   └── components.css         # Component-specific styles
└── utils/
    └── supabaseClient.js      # Supabase configuration
```

### **Key Features Implemented:**
- ✅ **Complete Registration Form** - All 7 sections as specified
- ✅ **Supabase Authentication** - No Clerk dependency
- ✅ **Responsive Design** - Works on all devices
- ✅ **Purple Theme** - Matches your brand colors
- ✅ **User Profile Storage** - All form data saved to database
- ✅ **Chat Integration** - Seamless redirect to full-page chat

---

## 🔧 **Admin Dashboard Updates**

### **New Admin Features:**
- ✅ **Separate Admin Login** - `https://yourdomain.com/admin/login`
- ✅ **User Management** - View all registered users with full profiles
- ✅ **Profile Viewer** - Click users to see complete registration data
- ✅ **Session Management** - Secure admin sessions with activity logging
- ✅ **Permissions System** - Granular access control

### **Admin Routes:**
```
/admin/login          # Admin login page
/admin/dashboard      # Main admin dashboard
/admin/users          # User management
/admin/conversations  # Conversation management
/admin/knowledge-base # Knowledge base management
```

---

## 🔐 **Security Enhancements**

### **User Authentication:**
- ✅ **Supabase Auth** - Built-in authentication system
- ✅ **Row Level Security** - Database-level access control
- ✅ **User Profiles** - Extended user data storage
- ✅ **Session Management** - Secure session handling

### **Admin Authentication:**
- ✅ **Separate Admin System** - Independent from user auth
- ✅ **Encrypted Passwords** - bcrypt hashing
- ✅ **Session Tokens** - Secure session management
- ✅ **Activity Logging** - Full audit trail
- ✅ **Account Locking** - Protection against brute force

---

## 📊 **User Profile System**

### **Registration Data Stored:**
```javascript
{
  // Basic info
  first_name: "Jane",
  last_name: "Doe",
  email: "jane@example.com",

  // Family info
  family_roles: ["mom_young_children", "currently_pregnant"],
  children_count: 2,
  children_ages: ["0-2", "expecting"],

  // Wellness goals
  main_concerns: ["food", "resilience", "movement"],
  main_concerns_other: "Custom concern",

  // Preferences
  dietary_preferences: ["dairy_free", "gluten_free"],
  dietary_preferences_other: "Custom dietary need",
  personalized_support: true,

  // Metadata
  registration_metadata: {
    registration_date: "2024-01-15T...",
    registration_source: "web_form",
    form_version: "1.0"
  },

  // Chatbot memory
  chatbot_memory: {} // For personalized conversations
}
```

---

## 🚢 **Deployment Steps**

### **1. Database Setup**
1. Run both SQL schema files in Supabase
2. Verify all tables are created
3. Check RLS policies are active

### **2. Backend Deployment**
1. Update environment variables
2. Install new dependencies (`bcrypt`, `uuid`)
3. Mount admin auth routes
4. Deploy backend updates

### **3. Frontend Deployment**
1. Build registration app: `cd frontend_registration && npm run build`
2. Deploy registration app to your domain root
3. Update chat widget to require authentication
4. Update admin dashboard with new user management

### **4. Admin Setup**
1. Use the `/api/admin/auth/initialize` endpoint to create first admin
2. Set up admin credentials
3. Test admin login and user management

### **5. DNS Configuration**
```
yourdomain.com         → Registration app
yourdomain.com/chat    → Authenticated chat
yourdomain.com/admin/  → Admin dashboard
```

---

## ✅ **Testing Checklist**

### **User Flow:**
- [ ] User visits landing page
- [ ] User can register with complete form
- [ ] Email verification works
- [ ] User can log in
- [ ] User redirected to full-page chat
- [ ] Chat remembers user profile
- [ ] User can log out

### **Admin Flow:**
- [ ] Admin can log in at `/admin/login`
- [ ] Admin dashboard shows user stats
- [ ] Admin can view user profiles
- [ ] Admin can see conversations
- [ ] Admin can delete users/conversations
- [ ] Admin activity is logged

### **Security:**
- [ ] Guest access is disabled
- [ ] All chat requires authentication
- [ ] Admin routes are protected
- [ ] User data is private (RLS)
- [ ] Sessions expire properly

---

## 🎯 **Key Benefits Achieved**

### **For Users:**
- ✅ **Personalized Experience** - Chat knows their profile and preferences
- ✅ **Secure Data** - All information encrypted and protected
- ✅ **Complete Registration** - All 7 sections of data captured
- ✅ **Seamless Flow** - Register → Chat with profile memory
- ✅ **Mobile Responsive** - Works perfectly on all devices

### **For Admins:**
- ✅ **Complete User Management** - View all user profiles and data
- ✅ **Conversation Oversight** - Monitor all user interactions
- ✅ **Data Control** - Delete users and data for GDPR compliance
- ✅ **Security Audit** - Full activity logging for compliance
- ✅ **Separate Access** - Admin system independent from users

### **For Development:**
- ✅ **Supabase Only** - No external dependencies like Clerk
- ✅ **Scalable Architecture** - Proper separation of concerns
- ✅ **Maintainable Code** - Clear structure and documentation
- ✅ **Type Safety** - Proper form validation and error handling

---

## 🔄 **Migration from Current System**

### **1. Data Migration**
- Existing guest conversations can be backed up before migration
- User data will be preserved and enhanced
- Admin system is new and separate

### **2. Widget Updates**
- Current floating widget can remain for existing embeds
- New full-page chat for registered users
- Admin dashboard gets enhanced user management

### **3. Gradual Rollout**
- Deploy registration system first
- Update backend for authentication
- Migrate admin dashboard
- Update chat widget last

---

This implementation provides a **complete, secure, and scalable** user registration and management system with clear separation between user and admin access, all built on Supabase without external dependencies.