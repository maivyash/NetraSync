/**
 * Utility functions for JWT authentication on the frontend
 */

/**
 * Get the stored JWT token
 */
export const getToken = () => {
    return localStorage.getItem("token");
};

/**
 * Get user info from localStorage
 */
export const getUserInfo = () => {
    return {
        userId: localStorage.getItem("userId"),
        userName: localStorage.getItem("userName"),
        userEmail: localStorage.getItem("userEmail"),
    };
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = () => {
    return !!getToken();
};

/**
 * Make an authenticated API call
 * Automatically includes the JWT token in Authorization header
 */
export const authenticatedFetch = (url, options = {}) => {
    const token = getToken();

    if (!token) {
        throw new Error("No authentication token found. Please login.");
    }

    const headers = {
        "Content-Type": "application/json",
        ...options.headers,
        Authorization: `Bearer ${token}`,
    };

    return fetch(url, {
        ...options,
        headers,
    });
};

/**
 * Logout user by clearing all stored data
 */
export const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userId");
    localStorage.removeItem("userName");
    localStorage.removeItem("userEmail");
};

/**
 * Check if token is about to expire (within 1 hour)
 */
export const isTokenExpiringSoon = () => {
    const token = getToken();
    if (!token) return false;

    try {
        // JWT tokens have 3 parts separated by dots
        const parts = token.split(".");
        if (parts.length !== 3) return false;

        // Decode the payload (second part)
        const payload = JSON.parse(atob(parts[1]));
        const expiryTime = payload.exp * 1000; // Convert to milliseconds
        const now = Date.now();
        const oneHourFromNow = now + 60 * 60 * 1000;

        return expiryTime < oneHourFromNow && expiryTime > now;
    } catch (error) {
        console.error("Error checking token expiry:", error);
        return false;
    }
};
