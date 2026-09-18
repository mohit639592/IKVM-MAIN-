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
            trim: true,
            match: /^\d{4}-\d{2}$/
        },

        class: {
            type: Number,
            required: true,
            min: 1,
            max: 12
        },

        statusAtEnd: {
            type: String,
            enum: [
                "active",
                "completed",
                "graduated",
                "deactive"
            ],
            default: "completed"
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


// One student cannot have two history records
// for the same academic session.
studentAcademicHistorySchema.index(
    {
        studentId: 1,
        session: 1
    },
    {
        unique: true
    }
);


// Useful for loading history quickly.
studentAcademicHistorySchema.index({
    studentId: 1,
    session: -1
});


module.exports =
    mongoose.model(
        "StudentAcademicHistory",
        studentAcademicHistorySchema
    );