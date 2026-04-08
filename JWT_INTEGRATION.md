# JWT Authentication Integration Guide

## Overview
JWT (JSON Web Tokens) has been integrated into your NetraSync application for secure login and protected routes.

## What Changed

### Backend Updates
1. **Dependencies Added**
   - `jsonwebtoken`: Token generation and verification
   - `bcryptjs`: (Installed for future password hashing improvements)

2. **New Files**
   - `backend/middleware/auth.js`: JWT middleware and utilities
     - `verifyToken`: Middleware to verify JWT tokens
     - `generateToken`: Function to generate new JWT tokens

3. **Modified Files**
   - `backend/.env`: Added `JWT_SECRET` and `JWT_EXPIRE` configuration
   - `backend/routes/userRoutes.js`: 
     - Login endpoint now returns a JWT token
     - Protected routes (GET /api/users, GET /api/users/:id) now use `verifyToken` middleware

### Frontend Updates
1. **New Files**
   - `src/utils/auth.js`: Authentication utility functions
     - `getToken()`: Retrieve stored JWT token
     - `getUserInfo()`: Get stored user information
     - `isAuthenticated()`: Check if user is logged in
     - `authenticatedFetch()`: Make API calls with JWT token
     - `logout()`: Clear all authentication data
     - `isTokenExpiringSoon()`: Check token expiration status

   - `src/components/ProtectedRoute.jsx`: Route protection component
     - Redirects unauthenticated users to login page

2. **Modified Files**
   - `src/App.jsx`: 
     - Dashboard and game pages wrapped with `<ProtectedRoute>`
   - `src/pages/Login.jsx`:
     - Stores JWT token in localStorage after successful login
   - `src/components/dashboard/ProfileModal.jsx`:
     - Logout now clears all authentication data including JWT token

## How to Use

### 1. User Login Flow
```
1. User enters email and password in Login form
2. Frontend sends credentials to POST /api/login  
3. Backend verifies credentials and returns JWT token
4. Frontend stores token, userId, userName, userEmail in localStorage
5. User is redirected to dashboard
```

### 2. Making Authenticated API Calls

#### Option A: Using the `authenticatedFetch` utility
```javascript
import { authenticatedFetch } from "../utils/auth";

const response = await authenticatedFetch("/api/users");
const data = await response.json();
```

#### Option B: Manual fetch with token
```javascript
import { getToken } from "../utils/auth";

const token = getToken();
const response = await fetch("/api/users", {
  headers: {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json"
  }
});
```

### 3. Protected Routes
```javascript
// In App.jsx, wrap protected pages with ProtectedRoute
<Route path="/dashboard" element={
  <ProtectedRoute>
    <Dashboard />
  </ProtectedRoute>
} />
```

If a user tries to access a protected route without being logged in, they'll be redirected to the login page.

### 4. Logout
```javascript
import { logout } from "../utils/auth";

logout(); // Clears all auth data
navigate("/login"); // Redirect to login
```

## Token Structure

### JWT Token Contains
- `id`: User ID
- `email`: User email
- `name`: User name
- `exp`: Expiration time (default: 7 days)
- `iat`: Issued at time

### How To Verify Token on Backend
```javascript
import { verifyToken } from "../middleware/auth.js";

// Add middleware to routes that need authorization
router.get("/protected-route", verifyToken, async (req, res) => {
  // req.user contains: { id, email, name }
  const userId = req.user.id;
  // ... rest of implementation
});
```

## Environment Configuration

### Backend (.env)
```
JWT_SECRET=your_ultra_secret_jwt_key_change_this_in_production_12345678
JWT_EXPIRE=7d
```

**Important**: 
- Change `JWT_SECRET` to a strong, random string in production
- Never commit real secrets to version control
- Use environment variables for all sensitive configuration

## API Endpoints

### Public Endpoints
- `POST /api/register` - Register new user
- `POST /api/login` - Login and get JWT token
- `POST /api/auth/send-otp` - Send OTP for password reset
- `POST /api/auth/verify-otp` - Verify OTP
- `POST /api/auth/reset-password` - Reset password

### Protected Endpoints (Require JWT Token)
- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get single user by ID

To make requests to protected endpoints, include the token in the Authorization header:
```
Authorization: Bearer <your_jwt_token_here>
```

## Security Best Practices

1. **Token Storage**
   - Currently stored in localStorage (convenient but not most secure)
   - For production, consider: httpOnly cookies, or encrypted localStorage
   - Do NOT store sensitive data in localStorage beyond the token

2. **HTTPS**
   - Always use HTTPS in production to prevent token interception

3. **Token Rotation**
   - Implement refresh tokens for enhanced security (future enhancement)
   - Current implementation uses 7-day expiration

4. **CORS**
   - Backend is configured to accept requests from localhost:5173
   - Update for production domains

## Testing JWT Integration

### 1. Test Login with Token
```bash
curl -X POST http://localhost:5000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password"}'
```

Response will include `token` field.

### 2. Test Protected Route with Token
```bash
curl -X GET http://localhost:5000/api/users \
  -H "Authorization: Bearer <token_from_login>"
```

### 3. Test Without Token (Should Fail)
```bash
curl -X GET http://localhost:5000/api/users
```

Should return 401 Unauthorized.

## Troubleshooting

### "No token provided" Error
- User is not logged in or token is not in localStorage
- Check browser DevTools > Application > Local Storage

### "Invalid token" Error
- Token is malformed or tampered with
- Try logging out and logging back in

### "Token has expired" Error
- JWT token has reached its expiration time (default: 7 days)
- User needs to log in again to get a new token

### CORS Issues
- Ensure backend is allowing requests from your frontend URL
- Check `cors()` configuration in backend/server.js

## Future Enhancements

1. **Refresh Tokens**
   - Implement short-lived access tokens with refresh tokens
   - Better security without forcing frequent re-login

2. **Password Hashing**
   - Replace SHA256 with bcrypt for better security

3. **Two-Factor Authentication (2FA)**
   - Add email/SMS verification for additional security

4. **Token Blacklist**
   - Invalidate tokens on logout (currently relies on expiration)

5. **Role-Based Access Control (RBAC)**
   - Add different user roles (admin, therapist, patient)
   - Implement role-based route protection
