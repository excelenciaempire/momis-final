# 🤖 **AI INSTRUCTIONS FOR DATABASE EXECUTION**

## 📋 **TASK: Execute MOMi Database Upgrade**

**IMPORTANT:** The user has authorized database modifications. Execute the complete SQL upgrade to implement the new registration and admin system.

---

## 🎯 **OBJECTIVE:**
Execute the complete database upgrade script to transform MOMi from a guest-based system to a full registration-based system with separate admin authentication.

---

## 📝 **EXECUTION STEPS:**

### **Step 1: Backup Current Database**
Before making any changes, create a backup of critical tables:

```sql
-- Create backup tables
CREATE TABLE conversations_backup_$(date) AS SELECT * FROM conversations;
CREATE TABLE messages_backup_$(date) AS SELECT * FROM messages;
CREATE TABLE system_settings_backup_$(date) AS SELECT * FROM system_settings;
```

### **Step 2: Execute the Complete Upgrade**
Run the entire contents of `/home/runner/workspace/momi_project/EXECUTE_DATABASE_UPGRADE.sql`

**This script will:**
- ✅ Create `user_profiles` table for registration data
- ✅ Create admin authentication system (`admin_users`, `admin_sessions`, `admin_activity_log`)
- ✅ Remove guest user functionality
- ✅ Set up Row Level Security policies
- ✅ Create automated functions and triggers
- ✅ Insert system configuration

### **Step 3: Verify Execution Success**
After execution, run the verification queries at the end of the script to ensure all components were created successfully.

### **Step 4: Report Results**
Provide a summary of:
- Tables created/modified
- Functions created
- Policies applied
- Any errors encountered

---

## 🔧 **EXECUTION METHOD:**

Since you have access to the Supabase MCP, you should:

1. **Read the complete SQL file:**
   ```
   /home/runner/workspace/momi_project/EXECUTE_DATABASE_UPGRADE.sql
   ```

2. **Execute it against the Supabase database**
   - Use the MCP tools to run the SQL commands
   - Execute in phases if needed to handle any errors
   - Report progress and results

3. **Verify the upgrade was successful**
   - Run the verification queries
   - Check that all tables and functions exist
   - Confirm RLS policies are active

---

## ⚠️ **SAFETY MEASURES:**

- **Backup tables are created** before modifications
- **All changes are additive** (no data loss)
- **Guest functionality preserved** during transition
- **Rollback possible** if issues occur

---

## 🎯 **EXPECTED OUTCOME:**

After successful execution, the database will support:
- ✅ User registration with complete profile system
- ✅ Separate admin authentication
- ✅ Profile-aware chatbot responses
- ✅ Enhanced admin dashboard functionality
- ✅ Secure data management with RLS

---

## 📊 **SUCCESS CRITERIA:**

The upgrade is successful when:
1. All tables created without errors
2. All functions created and callable
3. RLS policies active and working
4. Verification queries return expected counts
5. No existing data lost or corrupted

---

## 🚀 **POST-EXECUTION:**

After successful database upgrade:
1. The new registration system will be ready to use
2. Admin can access enhanced user management
3. Chatbot can provide personalized responses
4. Full audit trail will be active

**Proceed with executing the database upgrade when ready.**