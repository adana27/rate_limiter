
const mongoose = require("mongoose");

const rateLimitSchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        unique: true
    },

    count: {
        type: Number,
        default: 0
    },

    expiresAt: {
        type: Date,
        required: true
    }
});

// Automatically delete expired documents
rateLimitSchema.index(
    { expiresAt: 1 },
    { expireAfterSeconds: 0 }
);

module.exports = mongoose.model(
    "RateLimit",
    rateLimitSchema
);
