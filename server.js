
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");

const RateLimit = require("./models/RateLimit");

const app = express();

app.use(express.json());

const LIMIT = 5;
const WINDOW = 60 * 1000;

// Rate limiter middleware
async function rateLimiter(req, res, next) {
    try {
        const userId = req.ip;
        const now = new Date();

        const key = `rate-limit:${userId}`;

        // Find an active counter or create a new one
        let record = await RateLimit.findOneAndUpdate(
            {
                key,
                expiresAt: { $gt: now }
            },
            {
                $inc: { count: 1 }
            },
            {
                new: true
            }
        );

        if (!record) {
            try {
                record = await RateLimit.create({
                    key,
                    count: 1,
                    expiresAt: new Date(
                        now.getTime() + WINDOW
                    )
                });
            } catch (error) {
                // Handle concurrent first requests
                if (error.code !== 11000) throw error;

                record = await RateLimit.findOneAndUpdate(
                    { key, expiresAt: { $gt: new Date() } },
                    { $inc: { count: 1 } },
                    { new: true }
                );

                if (!record) {
                    throw new Error("Unable to update rate limit");
                }
            }
        }

        const remaining = Math.max(
            0,
            LIMIT - record.count
        );

        const retryAfter = Math.max(
            1,
            Math.ceil(
                (record.expiresAt.getTime() - Date.now()) / 1000
            )
        );

        res.setHeader("X-RateLimit-Limit", LIMIT);
        res.setHeader("X-RateLimit-Remaining", remaining);

        if (record.count > LIMIT) {
            res.setHeader("Retry-After", retryAfter);

            return res.status(429).json({
                success: false,
                message: "Too many requests!",
                retryAfter
            });
        }

        next();

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
}

// Test API
app.get("/api/test", rateLimiter, (req, res) => {
    res.json({
        success: true,
        message: "Request allowed!"
    });
});

// Connect MongoDB and start server
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log("MongoDB connected successfully");

        app.listen(process.env.PORT || 3000, () => {
            console.log("Server running on port 3000");
        });
    })
    .catch(error => {
        console.error("MongoDB connection failed:", error);
    });
