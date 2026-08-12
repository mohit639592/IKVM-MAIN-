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


module.exports = mongoose.model("Student", studentSchema);