const mongoose = require("mongoose");

const academicSessionSchema = new mongoose.Schema(
    {
        key: {
            type: String,
            unique: true,
            default: "main",
            immutable: true
        },

        currentSession: {
            type: String,
            required: true,
            trim: true,
            match: /^\d{4}-\d{2}$/
        },

        nextSession: {
            type: String,
            required: true,
            trim: true,
            match: /^\d{4}-\d{2}$/
        },

        sessionStartDate: {
            type: Date,
            required: true
        },

        promotion: {
            sourceSession: {
                type: String,
                default: ""
            },

            targetSession: {
                type: String,
                default: ""
            },

            completedClasses: {
                type: [Number],
                default: []
            },

            startedAt: {
                type: Date,
                default: null
            },

            completedAt: {
                type: Date,
                default: null
            }
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("AcademicSession", academicSessionSchema);
