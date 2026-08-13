const mongoose = require("mongoose");

const studentAcademicHistorySchema = new mongoose.Schema(
    {
        studentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Student",
            required: true,
            index: true
        },

        session: {
            type: String,
            required: true,
            trim: true
        },

        class: {
            type: Number,
            required: true,
            min: 1,
            max: 12
        },

        statusAtEnd: {
            type: String,
            enum: ["active", "deactive", "graduated"],
            default: "active"
        },

        recordedAt: {
            type: Date,
            default: Date.now
        }
    },
    {
        timestamps: true
    }
);

studentAcademicHistorySchema.index(
    { studentId: 1, session: 1 },
    { unique: true }
);

module.exports = mongoose.model(
    "StudentAcademicHistory",
    studentAcademicHistorySchema
);
