import express from "express";
import cors from "cors";
import userRoutes from "./routes/userRoutes.js";

const app = express();

// CORS — allow Vite dev server
app.use(
    cors({
        origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
        methods: ["GET", "POST", "PUT", "DELETE"],
        credentials: true,
    })
);

// Parse JSON bodies (express 5 built-in, no body-parser needed)
app.use(express.json({ limit: "10mb" })); // 10mb for base64 photos
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api", userRoutes);

// Root route
app.get("/", (req, res) => {
    res.json({
        app: "NetraSync API",
        version: "1.0.0",
        status: "running",
        endpoints: {
            health: "GET /api/health",
            register: "POST /api/register",
            users: "GET /api/users",
            user: "GET /api/users/:id",
            deleteUser: "DELETE /api/users/:id",
        },
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
});

const PORT = 5000;

app.listen(PORT, () => {
    console.log(`\n🚀 NetraSync API Server`);
    console.log(`   Local:   http://localhost:${PORT}`);
    console.log(`   Health:  http://localhost:${PORT}/api/health`);
    console.log(`   Docs:    http://localhost:${PORT}/\n`);
});