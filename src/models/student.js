const mongoose = require("mongoose");

const customFieldSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            trim: true
        },

        value: {
            type: String,
            trim: true
        }
    },
    {
        _id: false
    }
);

const studentSchema = new mongoose.Schema(
    {
        name: {
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

        // Current academic session for this student's active record.
        // Existing students automatically use 2026-27 unless updated.
        academicSession: {
            type: String,
            trim: true,
            default: "2026-27",
            match: /^\d{4}-\d{2}$/
        },

        schoolJoinSession: {
            type: String,
            required: true,
            trim: true
        },

        status: {
            type: String,
            enum: ["active", "deactive"],
            default: "active"
        },

        graduationSession: {
            type: String,
            trim: true,
            default: ""
        },

        serialNo: {
            type: String,
            trim: true,
            default: ""
        },

        uid: {
            type: String,
            trim: true,
            default: ""
        },

        aadhaar: {
            type: String,
            trim: true,
            default: ""
        },

        mobile: {
            type: String,
            trim: true,
            default: ""
        },

        fatherName: {
            type: String,
            required: true,
            trim: true
        },

        motherName: {
            type: String,
            required: true,
            trim: true
        },

        fatherAadhaar: {
            type: String,
            trim: true,
            default: ""
        },

        motherAadhaar: {
            type: String,
            trim: true,
            default: ""
        },

        submittedDocuments: {
            type: [String],
            default: []
        },

        customFields: {
            type: [customFieldSchema],
            default: []
        }
    },
    {
        timestamps: true
    }
);

studentSchema.index({ academicSession: 1, class: 1, status: 1 });
studentSchema.index({ name: 1 });
studentSchema.index({ uid: 1 });
studentSchema.index({ serialNo: 1 });

module.exports = mongoose.model("Student", studentSchema);
