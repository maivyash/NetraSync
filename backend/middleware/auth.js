import jwt from "jsonwebtoken";

/**
 * Middleware to verify JWT token from Authorization header
 * Extracts token from "Bearer <token>" format
 * Adds decoded user info to req.user
 */
export const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            success: false,
            error: "No token provided. Please login.",
        });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // { id, email, name }
        next();
    } catch (err) {
        console.error("Token verification error:", err.message);
        
        if (err.name === "TokenExpiredError") {
            return res.status(401).json({
                success: false,
                error: "Token has expired. Please login again.",
            });
        }

        res.status(401).json({
            success: false,
            error: "Invalid token. Please login again.",
        });
    }
};

/**
 * Generate JWT token
 */
export const generateToken = (userId, email, name) => {
    return jwt.sign(
        { id: userId, email, name },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE || "7d" }
    );
};
