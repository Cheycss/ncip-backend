# 🧪 Manual Backend Testing Guide

## Prerequisites
1. ✅ Server running on `http://localhost:3001`
2. ✅ Database connected
3. ✅ Email configuration in `.env`

---

## 🚀 Quick Tests

### 1. Health Check
```bash
curl http://localhost:3001/api/health
```
**Expected Response:**
```json
{
  "success": true,
  "message": "NCIP Backend Server is running",
  "timestamp": "2024-10-23T13:32:00.000Z"
}
```

---

## 📧 Email Verification Tests

### 2. Test Registration Email Verification

**Send Verification Code:**
```bash
curl -X POST http://localhost:3001/api/registration-auth/send-verification \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "firstName": "John"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Verification code sent to your email address",
  "email": "te***@example.com",
  "expiresIn": "15 minutes"
}
```

---

### 3. Test Login Email Verification

**Request Login Code (should fail with invalid credentials):**
```bash
curl -X POST http://localhost:3001/api/email-auth/request-verification \
  -H "Content-Type: application/json" \
  -d '{
    "email": "nonexistent@example.com",
    "password": "wrongpassword"
  }'
```

**Expected Response:**
```json
{
  "success": false,
  "message": "Invalid email or password"
}
```

---

### 4. Test Invalid Requests

**Missing Email:**
```bash
curl -X POST http://localhost:3001/api/registration-auth/send-verification \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected Response:**
```json
{
  "success": false,
  "message": "Email is required"
}
```

**Invalid Code Format:**
```bash
curl -X POST http://localhost:3001/api/registration-auth/verify-and-register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "code": "12345",
    "firstName": "Test",
    "lastName": "User",
    "password": "TestPass123!"
  }'
```

**Expected Response:**
```json
{
  "success": false,
  "message": "Verification code must be 6 digits"
}
```

---

## 🔧 Troubleshooting

### Common Issues:

1. **Server not running:**
   ```bash
   cd backend
   npm start
   ```

2. **Database connection error:**
   - Check MySQL is running
   - Verify `.env` database credentials
   - Run the verification_codes table migration

3. **Email service error:**
   - Add EMAIL_USER and EMAIL_PASS to `.env`
   - Set up Gmail App Password

4. **CORS errors:**
   - Server allows localhost:3000 and localhost:5173
   - Check frontend is running on correct port

---

## 📊 Success Indicators

✅ **All endpoints respond without 500 errors**
✅ **Proper error messages for invalid requests**
✅ **Email verification codes are generated**
✅ **Database operations work (no connection errors)**
✅ **CORS headers allow frontend requests**

---

## 🎯 Next Steps

Once backend tests pass:
1. Set up Gmail App Password
2. Test actual email sending
3. Create frontend components
4. Test full user flow
