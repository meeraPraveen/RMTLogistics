# Security Model: Auth0 as Gatekeeper

## 🎯 Overview

This application uses **Auth0 as a Gatekeeper** - a two-layer security approach that provides maximum control with minimal complexity.

## 🔒 Two-Layer Security

### Layer 1: Auth0 (Authentication Gatekeeper)
**Controls:** WHO can login
**Blocks:** Anyone not explicitly created in Auth0

```
Random person tries to login
    ↓
Auth0: Are you in our user database? ❌ BLOCKED
```

### Layer 2: PostgreSQL (Authorization)
**Controls:** WHAT authenticated users can do
**Stores:** Roles and permissions

```
Authenticated user accesses module
    ↓
PostgreSQL: What's your role? → Check permissions → ✅ Allow / ❌ Deny
```

## 🛡️ What This Protects Against

### ✅ Protected:
- **Unauthorized Access**: Users not in Auth0 cannot even login
- **SQL Injection**: Using parameterized queries
- **Token Tampering**: Auth0 validates JWT signatures
- **Brute Force**: Auth0 has built-in rate limiting
- **Role Escalation**: Permissions checked on every request
- **Session Hijacking**: Tokens expire and refresh

### ⚠️ Admin Must Manage:
- **Creating users in Auth0** (who can login)
- **Creating users in PostgreSQL** (what they can do)
- **Keeping both systems in sync**
- **Removing users from both places**

## 📊 Data Flow

### First Time User Login

```
1. Admin creates user in Auth0
   └─> Email: user@example.com
   └─> Connection: Google/Username-Password/etc.

2. Admin creates user in PostgreSQL
   └─> Auth0 ID: auth0|123456
   └─> Email: user@example.com
   └─> Role: Admin
   └─> Status: invited

3. User attempts login
   ├─> Auth0: ✅ User exists → Generate ID token
   └─> App receives token with user ID + email

4. App checks PostgreSQL
   ├─> User found with status='invited'
   ├─> Change status to 'active'
   └─> Load role: 'Admin'

5. App loads permissions for role 'Admin'
   └─> order_management: [read, write, update, delete]
   └─> inventory_management: [read, write, update, delete]
   └─> printing_software: [read, write, update, delete]

6. User accesses modules based on permissions ✅
```

### Subsequent Logins

```
1. User logs in → Auth0 validates → ID token issued
2. App receives token → Extract user ID
3. Database lookup → Role: 'Admin', Status: 'active'
4. Load permissions → Grant access ✅
```

### Unauthorized User Attempt

```
1. Random person tries to login
   └─> Email not in Auth0

2. Auth0 blocks login ❌
   └─> User never reaches your app
   └─> No database queries
   └─> Complete protection
```

### User in Auth0 but Not in Database

```
1. User logs in → Auth0 validates ✅
2. App checks database → User not found
3. App assigns default role: 'Artist'
   └─> Minimal/no module access
4. Admin gets warned in logs ⚠️
5. Admin adds user to database with proper role
```

## 🔐 Security Best Practices

### In Auth0:

1. **Enable Multi-Factor Authentication (MFA)**
   - Required for SuperAdmin accounts
   - Recommended for all users

2. **Set Strong Password Policies**
   - Minimum 12 characters
   - Require uppercase, lowercase, numbers, symbols
   - Password history to prevent reuse

3. **Configure Session Timeouts**
   - Idle timeout: 30 minutes
   - Absolute timeout: 8 hours

4. **Enable Anomaly Detection**
   - Brute force protection
   - Breached password detection

5. **Use Social Connections Wisely**
   - Google, Microsoft for trusted domains
   - Verify email domains match your organization

### In Your Application:

1. **Database Security**
   ```sql
   -- Use parameterized queries (already implemented)
   -- Never concatenate user input
   -- Regularly backup database
   ```

2. **Environment Variables**
   ```bash
   # Never commit .env files
   # Use strong database passwords
   # Rotate credentials regularly
   ```

3. **HTTPS Only** (Production)
   ```javascript
   // Enforce secure connections
   // Use secure cookies
   // Set HSTS headers
   ```

4. **Regular Audits**
   ```sql
   -- Check for inactive users
   SELECT * FROM users WHERE updated_at < NOW() - INTERVAL '90 days';

   -- Review SuperAdmin accounts
   SELECT * FROM users WHERE role = 'SuperAdmin';

   -- Check audit log
   SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 100;
   ```

## 🚨 Incident Response

### User Reports Unauthorized Access

1. **Immediate Actions:**
   ```sql
   -- Suspend the user
   UPDATE users SET status = 'suspended' WHERE email = 'user@example.com';
   ```

2. **In Auth0:**
   - Revoke user's refresh tokens
   - Reset password
   - Enable MFA

3. **Investigation:**
   ```sql
   -- Check audit log
   SELECT * FROM audit_log WHERE user_id = (
     SELECT id FROM users WHERE email = 'user@example.com'
   ) ORDER BY created_at DESC;
   ```

### Suspected Breach

1. **Lock down** - Suspend all non-SuperAdmin users
2. **Audit** - Review all recent changes
3. **Investigate** - Check Auth0 logs
4. **Rotate** - Change database credentials
5. **Notify** - Inform affected users
6. **Document** - Record incident and response

## 📈 Monitoring

### Regular Checks:

```sql
-- Users who logged in today
SELECT email, role, updated_at
FROM users
WHERE updated_at > CURRENT_DATE
ORDER BY updated_at DESC;

-- New users this week
SELECT email, role, created_at
FROM users
WHERE created_at > NOW() - INTERVAL '7 days';

-- Suspended users
SELECT email, role, updated_at
FROM users
WHERE status = 'suspended';

-- Permission changes
SELECT * FROM audit_log
WHERE action LIKE '%permission%'
ORDER BY created_at DESC
LIMIT 20;
```

### Auth0 Monitoring:

- Check **Logs** in Auth0 Dashboard daily
- Monitor failed login attempts
- Review IP addresses for suspicious activity
- Set up alerts for unusual behavior

## 🎓 Security Training

### For Admins:

- [ ] Understand the two-layer security model
- [ ] Know how to create users in both places
- [ ] Can suspend users immediately
- [ ] Understand the audit log
- [ ] Know incident response procedures
- [ ] Review this document quarterly

### For Users:

- Enable MFA on their accounts
- Use strong, unique passwords
- Report suspicious activity immediately
- Never share credentials
- Logout when done

## 📋 Compliance

### Data Protection:

- **User data** stored in PostgreSQL (encrypted at rest)
- **Passwords** never stored (handled by Auth0)
- **Audit trail** for all permission changes
- **Data retention** policy configurable

### GDPR/Privacy:

- Users can request data deletion
- Audit log shows all data access
- Email addresses are the only PII stored
- Can export user data on request

## 🔄 Regular Maintenance

### Weekly:
- Review new users
- Check for sync issues between Auth0 and DB
- Monitor failed logins

### Monthly:
- Audit SuperAdmin accounts
- Review permission changes
- Check for inactive users
- Test backup restoration

### Quarterly:
- Full security audit
- Update dependencies
- Review and update this document
- Test incident response procedures

## 📞 Emergency Contacts

In case of security incident:

1. **Disable all access**: Set `NODE_ENV=maintenance`
2. **Contact Auth0**: support@auth0.com
3. **Database admin**: [Your DBA contact]
4. **Security team**: [Your security contact]

---

**Remember:** Auth0 is your gatekeeper. If someone isn't in Auth0, they can't even try to login. Your database just decides what they can do once Auth0 lets them in.
