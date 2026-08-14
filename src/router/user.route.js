const express = require("express");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const User = require("../models/user");
const Student = require("../models/student");
const StudentAcademicHistory =
    require("../models/studentAcademicHistory");

const {
    getSessionState,
    getOrCreateSession
} = require("../services/academicSession.service");

const app = express.Router();

const {
    requireLogin,
    requireAdmin
} = require("../middleware/auth");


// ======================================================
// ENTRY PAGE
// ======================================================

app.get("/", (req, res) => {

    res.render("index");

});


// ======================================================
// LOGIN PAGE
// ======================================================

app.get("/login", (req, res) => {

    // Already logged in
    if (req.session && req.session.user) {

        if (
            req.session.user.role === "admin"
        ) {

            return res.redirect(
                "/admin/dashboard"
            );

        }

        return res.redirect(
            "/member/dashboard"
        );

    }


    res.render("login");

});


// ======================================================
// LOGIN
// ======================================================

app.post("/login", async (req, res) => {

    try {

        const email =
            String(
                req.body.email || ""
            )
                .trim()
                .toLowerCase();

        const password =
            String(
                req.body.password || ""
            );


        // ----------------------------------------------
        // VALIDATION
        // ----------------------------------------------

        if (
            !email ||
            !password
        ) {

            return res
                .status(400)
                .send(
                    "Email and password are required."
                );

        }


        // ----------------------------------------------
        // FIND USER
        // ----------------------------------------------

        const user =
            await User.findOne({
                email
            });


        if (!user) {

            return res
                .status(401)
                .send(
                    "Invalid email or password."
                );

        }


        // ----------------------------------------------
        // ACCOUNT STATUS
        // ----------------------------------------------

        if (
            user.isActive === false
        ) {

            return res
                .status(403)
                .send(
                    "Your account has been disabled."
                );

        }


        // ----------------------------------------------
        // PASSWORD
        // ----------------------------------------------

        const passwordMatch =
            await bcrypt.compare(
                password,
                user.password
            );


        if (!passwordMatch) {

            return res
                .status(401)
                .send(
                    "Invalid email or password."
                );

        }


        // ----------------------------------------------
        // REGENERATE SESSION
        // ----------------------------------------------
        // Prevent session fixation.

        req.session.regenerate(
            (sessionError) => {

                if (sessionError) {

                    console.error(
                        "Session regeneration error:",
                        sessionError
                    );

                    return res
                        .status(500)
                        .send(
                            "Unable to create secure session."
                        );

                }


                // --------------------------------------
                // SAVE USER IN SESSION
                // --------------------------------------

                req.session.user = {

                    id:
                        user._id.toString(),

                    name:
                        user.name,

                    email:
                        user.email,

                    role:
                        user.role

                };


                // --------------------------------------
                // SAVE SESSION
                // --------------------------------------

                req.session.save(
                    (saveError) => {

                        if (saveError) {

                            console.error(
                                "Session save error:",
                                saveError
                            );

                            return res
                                .status(500)
                                .send(
                                    "Unable to save session."
                                );

                        }


                        // ----------------------------------
                        // REDIRECT
                        // ----------------------------------

                        if (
                            user.role === "admin"
                        ) {

                            return res.redirect(
                                "/admin/dashboard"
                            );

                        }


                        return res.redirect(
                            "/member/dashboard"
                        );

                    }
                );

            }
        );

    } catch (error) {

        console.error(
            "Login Error:",
            error
        );

        return res
            .status(500)
            .send(
                "Server error."
            );

    }

});


// ======================================================
// SIGNUP / CREATE USER
// ======================================================
//
// FIRST USER:
// If database has zero users, signup is allowed.
// The first user MUST be admin.
//
// AFTER FIRST USER:
// Only an authenticated admin can create users.
//
// This allows you to create the first admin through
// Postman without leaving public signup open forever.
// ======================================================

app.post(
    "/signup",
    async (req, res) => {

        try {

            const name =
                String(
                    req.body.name || ""
                )
                    .trim();

            const email =
                String(
                    req.body.email || ""
                )
                    .trim()
                    .toLowerCase();

            const password =
                String(
                    req.body.password || ""
                );

            const requestedRole =
                String(
                    req.body.role || "member"
                )
                    .trim()
                    .toLowerCase();


            // ------------------------------------------
            // BASIC VALIDATION
            // ------------------------------------------

            if (
                !name ||
                !email ||
                !password
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Name, email and password are required."

                });

            }


            // ------------------------------------------
            // PASSWORD
            // ------------------------------------------

            if (
                password.length < 8
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Password must be at least 8 characters."

                });

            }


            // ------------------------------------------
            // CHECK USER COUNT
            // ------------------------------------------

            const userCount =
                await User.countDocuments();


            // ------------------------------------------
            // FIRST USER
            // ------------------------------------------

            if (
                userCount === 0
            ) {

                // First account MUST be admin.

                const hashedPassword =
                    await bcrypt.hash(
                        password,
                        12
                    );


                const firstAdmin =
                    await User.create({

                        name,

                        email,

                        password:
                            hashedPassword,

                        role: "admin",

                        isActive: true

                    });


                return res.status(201).json({

                    success: true,

                    message:
                        "First admin created successfully.",

                    user: {

                        id:
                            firstAdmin._id,

                        name:
                            firstAdmin.name,

                        email:
                            firstAdmin.email,

                        role:
                            firstAdmin.role

                    }

                });

            }


            // ------------------------------------------
            // AFTER FIRST USER
            // ------------------------------------------
            // Only admin can create another account.

            if (
                !req.session ||
                !req.session.user ||
                req.session.user.role !== "admin"
            ) {

                return res.status(403).json({

                    success: false,

                    message:
                        "Only an administrator can create new users."

                });

            }


            // ------------------------------------------
            // ROLE VALIDATION
            // ------------------------------------------

            if (
                requestedRole !== "admin" &&
                requestedRole !== "member"
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid user role."

                });

            }


            // ------------------------------------------
            // CHECK EXISTING USER
            // ------------------------------------------

            const existingUser =
                await User.findOne({
                    email
                });


            if (existingUser) {

                return res.status(409).json({

                    success: false,

                    message:
                        "User already exists."

                });

            }


            // ------------------------------------------
            // HASH PASSWORD
            // ------------------------------------------

            const hashedPassword =
                await bcrypt.hash(
                    password,
                    12
                );


            // ------------------------------------------
            // CREATE USER
            // ------------------------------------------

            const user =
                await User.create({

                    name,

                    email,

                    password:
                        hashedPassword,

                    role:
                        requestedRole,

                    isActive: true

                });


            // ------------------------------------------
            // RESPONSE
            // ------------------------------------------

            return res.status(201).json({

                success: true,

                message:
                    "User created successfully.",

                user: {

                    id:
                        user._id,

                    name:
                        user.name,

                    email:
                        user.email,

                    role:
                        user.role

                }

            });

        } catch (error) {

            console.error(
                "Signup Error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Server error."

            });

        }

    }
);


// ======================================================
// ADMIN DASHBOARD
// ======================================================

app.get(
    "/admin/dashboard",
    requireAdmin,
    async (req, res) => {

        try {

            const [
                totalStudents,
                activeStudents,
                deactiveStudents,
                activeUsers,
                recentStudents
            ] = await Promise.all([

                Student.countDocuments(),

                Student.countDocuments({
                    status: "active"
                }),

                Student.countDocuments({
                    status: "deactive"
                }),

                User.countDocuments({
                    isActive: true
                }),

                Student.find()
                    .select(
                        "name class fatherName status createdAt"
                    )
                    .sort({
                        createdAt: -1
                    })
                    .limit(5)
                    .lean()

            ]);


            const academicState = await getSessionState();

            res.render(
                "admin/dashboard",
                {

                    user:
                        req.session.user,

                    totalStudents,

                    activeStudents,

                    deactiveStudents,

                    activeUsers,

                    recentStudents,

                    academicState

                }
            );


        } catch (error) {

            console.error(
                "Dashboard Error:",
                error
            );

            return res
                .status(500)
                .send(
                    "Unable to load dashboard."
                );

        }

    }
);


// ======================================================
// STUDENTS PAGE
// ======================================================

app.get(
    "/admin/students",
    requireAdmin,
    async (req, res) => {

        try {

            const [
                totalStudents,
                activeStudents,
                deactiveStudents
            ] = await Promise.all([

                Student.countDocuments(),

                Student.countDocuments({
                    status: "active"
                }),

                Student.countDocuments({
                    status: "deactive"
                })

            ]);


            res.render(
                "admin/students",
                {

                    user:
                        req.session.user,

                    totalStudents,

                    activeStudents,

                    deactiveStudents

                }
            );


        } catch (error) {

            console.error(
                "Students Page Error:",
                error
            );


            res
                .status(500)
                .send(
                    "Unable to load students."
                );

        }

    }
);


// ======================================================
// ADD STUDENT PAGE
// ======================================================

app.get(
    "/admin/students/add",
    requireAdmin,
    async (req, res) => {

        try {
            const academicState = await getSessionState();

            res.render(
                "admin/add-student",
                {
                    user: req.session.user,
                    academicState
                }
            );
        } catch (error) {
            console.error("Add Student Page Error:", error);
            return res.status(500).send("Unable to load add student page.");
        }

    }
);


// ======================================================
// ADD STUDENT
// ======================================================

app.post(
    "/admin/students",
    requireAdmin,
    async (req, res) => {

        try {

            const {

                name,

                class: studentClass,

                academicSession,

                schoolJoinSession,

                status,

                serialNo,

                uid,

                aadhaar,

                mobile,

                fatherName,

                motherName,

                fatherAadhaar,

                motherAadhaar,

                documents,

                customFieldName,

                customFieldValue

            } = req.body;


            // ------------------------------------------
            // REQUIRED FIELDS
            // ------------------------------------------

            if (
                !name ||
                !studentClass ||
                !schoolJoinSession ||
                !status ||
                !fatherName ||
                !motherName
            ) {

                return res
                    .status(400)
                    .send(
                        "Required student information is missing."
                    );

            }


            // ------------------------------------------
            // ACADEMIC SESSION
            // ------------------------------------------

            const sessionConfig = await getOrCreateSession();
            const selectedAcademicSession = String(
                academicSession || sessionConfig.currentSession
            ).trim();

            if (!/^\d{4}-\d{2}$/.test(selectedAcademicSession)) {
                return res.status(400).send("Invalid academic session.");
            }

            // ------------------------------------------
            // CLASS VALIDATION
            // ------------------------------------------

            const classNumber =
                Number(studentClass);


            if (
                !Number.isInteger(
                    classNumber
                ) ||
                classNumber < 1 ||
                classNumber > 12
            ) {

                return res
                    .status(400)
                    .send(
                        "Invalid class."
                    );

            }


            // ------------------------------------------
            // STATUS VALIDATION
            // ------------------------------------------

            if (
                status !== "active" &&
                status !== "deactive"
            ) {

                return res
                    .status(400)
                    .send(
                        "Invalid student status."
                    );

            }


            // ------------------------------------------
            // DOCUMENTS
            // ------------------------------------------

            let submittedDocuments = [];


            if (
                Array.isArray(
                    documents
                )
            ) {

                submittedDocuments =
                    documents

                        .map(
                            document =>
                                String(
                                    document || ""
                                ).trim()
                        )

                        .filter(
                            document =>
                                document !== ""
                        );

            }

            else if (
                documents
            ) {

                submittedDocuments = [

                    String(
                        documents
                    ).trim()

                ];

            }


            // ------------------------------------------
            // CUSTOM FIELDS
            // ------------------------------------------

            let customFields = [];


            if (
                Array.isArray(
                    customFieldName
                ) &&
                Array.isArray(
                    customFieldValue
                )
            ) {

                for (
                    let i = 0;
                    i < customFieldName.length;
                    i++
                ) {

                    const fieldName =
                        String(
                            customFieldName[i] || ""
                        ).trim();


                    const fieldValue =
                        String(
                            customFieldValue[i] || ""
                        ).trim();


                    if (
                        fieldName &&
                        fieldValue
                    ) {

                        customFields.push({

                            name:
                                fieldName,

                            value:
                                fieldValue

                        });

                    }

                }

            }


            // ------------------------------------------
            // CREATE STUDENT
            // ------------------------------------------

            await Student.create({

                name:
                    String(
                        name
                    ).trim(),

                class:
                    classNumber,

                academicSession:
                    selectedAcademicSession,

                schoolJoinSession:
                    String(
                        schoolJoinSession
                    ).trim(),

                status,

                serialNo:
                    String(
                        serialNo || ""
                    ).trim(),

                uid:
                    String(
                        uid || ""
                    ).trim(),

                aadhaar:
                    String(
                        aadhaar || ""
                    ).trim(),

                mobile:
                    String(
                        mobile || ""
                    ).trim(),

                fatherName:
                    String(
                        fatherName
                    ).trim(),

                motherName:
                    String(
                        motherName
                    ).trim(),

                fatherAadhaar:
                    String(
                        fatherAadhaar || ""
                    ).trim(),

                motherAadhaar:
                    String(
                        motherAadhaar || ""
                    ).trim(),

                submittedDocuments,

                customFields

            });


            console.log(
                "Student added successfully"
            );


            // ------------------------------------------
            // REDIRECT
            // ------------------------------------------

            return res.redirect(
                "/admin/students"
            );


        } catch (error) {

            console.error(
                "Add Student Error:",
                error
            );


            return res
                .status(500)
                .send(
                    "Unable to add student."
                );

        }

    }
);


// ======================================================
// STUDENT SEARCH API
// ======================================================

app.get(
    "/api/admin/students",
    requireAdmin,
    async (req, res) => {

        try {

            const {

                field = "name",

                value = "",

                status = "",

                page = 1

            } = req.query;


            // ------------------------------------------
            // LIMIT FILTER FIELDS
            // ------------------------------------------

            const allowedFields = [

                "name",

                "aadhaar",

                "fatherName",

                "motherName",

                "mobile",

                "uid",

                "serialNo",

                "class",

                "document",

                "schoolJoinSession",

                "status"

            ];


            if (
                !allowedFields.includes(
                    field
                )
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid filter."

                });

            }


            // ------------------------------------------
            // PAGE
            // ------------------------------------------

            const pageNumber =
                Math.max(
                    parseInt(page) || 1,
                    1
                );


            // ALWAYS 50
            const limit = 50;


            // ------------------------------------------
            // QUERY
            // ------------------------------------------

            const query = {};


            // ------------------------------------------
            // QUICK STATUS FILTER
            // ------------------------------------------

            if (
                status === "active" ||
                status === "deactive"
            ) {

                query.status =
                    status;

            }


            // ------------------------------------------
            // SEARCH
            // ------------------------------------------

            const searchValue =
                String(
                    value || ""
                ).trim();


            if (
                searchValue
            ) {


                // --------------------------------------
                // CLASS
                // --------------------------------------

                if (
                    field === "class"
                ) {

                    const classNumber =
                        Number(
                            searchValue
                        );


                    if (
                        !Number.isInteger(
                            classNumber
                        ) ||
                        classNumber < 1 ||
                        classNumber > 12
                    ) {

                        return res.json({

                            success: true,

                            students: [],

                            total: 0,

                            page:
                                pageNumber,

                            totalPages: 0

                        });

                    }


                    query.class =
                        classNumber;

                }


                // --------------------------------------
                // DOCUMENT
                // --------------------------------------

                else if (
                    field === "document"
                ) {

                    query.submittedDocuments = {

                        $regex:
                            escapeRegex(
                                searchValue
                            ),

                        $options: "i"

                    };

                }


                // --------------------------------------
                // STATUS
                // --------------------------------------

                else if (
                    field === "status"
                ) {

                    if (
                        searchValue ===
                            "active" ||
                        searchValue ===
                            "deactive"
                    ) {

                        query.status =
                            searchValue;

                    }

                }


                // --------------------------------------
                // NORMAL TEXT FIELDS
                // --------------------------------------

                else {

                    query[field] = {

                        $regex:
                            escapeRegex(
                                searchValue
                            ),

                        $options: "i"

                    };

                }

            }


            // ------------------------------------------
            // TOTAL
            // ------------------------------------------

            const total =
                await Student.countDocuments(
                    query
                );


            // ------------------------------------------
            // TOTAL PAGES
            // ------------------------------------------

            const totalPages =
                Math.ceil(
                    total / limit
                );


            // ------------------------------------------
            // GET STUDENTS
            // ------------------------------------------

            const students =
                await Student.find(
                    query
                )

                    .select(
                        "name class schoolJoinSession mobile fatherName uid status submittedDocuments"
                    )

                    .sort({
                        name: 1
                    })

                    .skip(
                        (pageNumber - 1) *
                        limit
                    )

                    .limit(
                        limit
                    )

                    .lean();


            // ------------------------------------------
            // RESPONSE
            // ------------------------------------------

            return res.json({

                success: true,

                students,

                total,

                page:
                    pageNumber,

                totalPages

            });


        } catch (error) {

            console.error(
                "Student Search Error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Unable to load students."

            });

        }

    }
);


// =====================================================
// ADD STUDENT ACADEMIC HISTORY
// =====================================================

app.post(
    "/admin/students/details/:id/history/add",
    requireAdmin,
    async (req, res) => {

        try {

            const studentId =
                req.params.id;

            const {
                session,
                class: classValue,
                statusAtEnd
            } = req.body;


            // ==========================================
            // VALIDATE SESSION
            // ==========================================

            if (
                !session ||
                !/^\d{4}-\d{2}$/.test(
                    session.trim()
                )
            ) {

                return res
                    .status(400)
                    .send(
                        "Invalid academic session. Use YYYY-YY format."
                    );

            }


            // ==========================================
            // VALIDATE CLASS
            // ==========================================

            const studentClass =
                Number(classValue);


            if (
                !Number.isInteger(
                    studentClass
                ) ||
                studentClass < 1 ||
                studentClass > 12
            ) {

                return res
                    .status(400)
                    .send(
                        "Invalid class."
                    );

            }


            // ==========================================
            // CHECK STUDENT
            // ==========================================

            const student =
                await Student.findById(
                    studentId
                );


            if (!student) {

                return res
                    .status(404)
                    .send(
                        "Student not found."
                    );

            }


            // ==========================================
            // CHECK DUPLICATE HISTORY
            // ==========================================

            const existing =
                await StudentAcademicHistory.findOne({

                    studentId:
                        student._id,

                    session:
                        session.trim()

                });


            if (existing) {

                return res
                    .status(400)
                    .send(
                        `Academic history for ${session} already exists for this student.`
                    );

            }


            // ==========================================
            // SAVE HISTORY
            // ==========================================

            await StudentAcademicHistory.create({

                studentId:
                    student._id,

                session:
                    session.trim(),

                class:
                    studentClass,

                statusAtEnd:
                    statusAtEnd ||
                    "completed",

                recordedAt:
                    new Date()

            });


            // ==========================================
            // RETURN TO STUDENT DETAILS
            // ==========================================

            return res.redirect(
                `/admin/students/details/${student._id}`
            );


        } catch (error) {

            console.error(
                "ADD STUDENT HISTORY ERROR:",
                error
            );


            // ==========================================
            // DUPLICATE KEY PROTECTION
            // ==========================================

            if (
                error.code === 11000
            ) {

                return res
                    .status(400)
                    .send(
                        "Academic history for this session already exists."
                    );

            }


            return res
                .status(500)
                .send(
                    "Unable to add academic history."
                );

        }

    }
);

// ======================================================
// ESCAPE REGEX
// ======================================================

function escapeRegex(value) {

    return String(
        value
    ).replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
    );

}


// ======================================================
// STUDENT DETAILS
// ======================================================

app.get(
    "/admin/students/details/:id",
    requireAdmin,
    async (req, res) => {

        try {

            // ------------------------------------------
            // OBJECT ID VALIDATION
            // ------------------------------------------

            if (
                !mongoose.Types.ObjectId.isValid(
                    req.params.id
                )
            ) {

                return res
                    .status(400)
                    .send(
                        "Invalid student ID."
                    );

            }


            const student =
                await Student.findById(
                    req.params.id
                ).lean();


            if (!student) {

                return res
                    .status(404)
                    .send(
                        "Student not found."
                    );

            }


            const academicHistory = await StudentAcademicHistory.find({
                studentId: student._id
            })
                .sort({ session: -1, class: 1 })
                .lean();

            const academicState = await getSessionState();

            res.render(
                "admin/student-details",
                {

                    user:
                        req.session.user,

                    student,

                    academicHistory,

                    academicState

                }
            );


        } catch (error) {

            console.error(
                "Student Details Error:",
                error
            );


            return res
                .status(500)
                .send(
                    "Unable to load student details."
                );

        }

    }
);


// ======================================================
// STUDENT UPDATE PAGE
// ======================================================

app.get(
    "/admin/students/update/:id",
    requireAdmin,
    async (req, res) => {

        try {

            // ------------------------------------------
            // OBJECT ID VALIDATION
            // ------------------------------------------

            if (
                !mongoose.Types.ObjectId.isValid(
                    req.params.id
                )
            ) {

                return res
                    .status(400)
                    .send(
                        "Invalid student ID."
                    );

            }


            const student =
                await Student.findById(
                    req.params.id
                ).lean();


            if (!student) {

                return res
                    .status(404)
                    .send(
                        "Student not found."
                    );

            }


            const academicState = await getSessionState();

            res.render(
                "admin/student-update",
                {

                    user:
                        req.session.user,

                    student,

                    academicState

                }
            );


        } catch (error) {

            console.error(
                "Student Update Page Error:",
                error
            );


            return res
                .status(500)
                .send(
                    "Unable to load student update page."
                );

        }

    }
);


// ======================================================
// UPDATE STUDENT
// ======================================================

// ======================================================
// UPDATE STUDENT
// ======================================================

app.post(
    "/admin/students/update/:id",
    requireAdmin,
    async (req, res) => {

        try {

            // ------------------------------------------
            // OBJECT ID VALIDATION
            // ------------------------------------------

            if (
                !mongoose.Types.ObjectId.isValid(
                    req.params.id
                )
            ) {

                return res
                    .status(400)
                    .send(
                        "Invalid student ID."
                    );

            }


            // ------------------------------------------
            // GET EXISTING STUDENT
            // ------------------------------------------

            const existingStudent =
                await Student.findById(
                    req.params.id
                );

            if (!existingStudent) {

                return res
                    .status(404)
                    .send(
                        "Student not found."
                    );

            }


            // ------------------------------------------
            // GET FORM DATA
            // ------------------------------------------

            const {
                name,
                studentClass,
                academicSession,
                aadhaar,
                mobile,
                fatherName,
                motherName,
                fatherAadhaar,
                motherAadhaar,
                serialNo,
                uid,
                schoolJoinSession,
                status
            } = req.body;


            // ------------------------------------------
            // REQUIRED FIELDS
            // ------------------------------------------

            if (
                !name ||
                !studentClass ||
                !fatherName ||
                !motherName ||
                !status
            ) {

                return res
                    .status(400)
                    .send(
                        "Required student information is missing."
                    );

            }


            // ------------------------------------------
            // ACADEMIC SESSION
            // ------------------------------------------

            const selectedAcademicSession =
                String(
                    academicSession ||
                    existingStudent.academicSession ||
                    ""
                ).trim();


            if (
                !/^\d{4}-\d{2}$/.test(
                    selectedAcademicSession
                )
            ) {

                return res
                    .status(400)
                    .send(
                        "Invalid academic session."
                    );

            }


            // ------------------------------------------
            // CLASS VALIDATION
            // ------------------------------------------

            const classNumber =
                Number(
                    studentClass
                );


            if (
                !Number.isInteger(
                    classNumber
                ) ||
                classNumber < 1 ||
                classNumber > 12
            ) {

                return res
                    .status(400)
                    .send(
                        "Invalid class."
                    );

            }


            // ------------------------------------------
            // STATUS VALIDATION
            // ------------------------------------------

            if (
                status !== "active" &&
                status !== "deactive"
            ) {

                return res
                    .status(400)
                    .send(
                        "Invalid student status."
                    );

            }


            // ------------------------------------------
            // SCHOOL JOIN SESSION
            // ------------------------------------------

            const selectedSchoolJoinSession =
                schoolJoinSession
                    ? String(
                        schoolJoinSession
                    ).trim()
                    : existingStudent.schoolJoinSession;


            // ------------------------------------------
            // DOCUMENTS
            // ------------------------------------------

            let submittedDocuments = [];


            if (
                req.body.documents
            ) {

                if (
                    Array.isArray(
                        req.body.documents
                    )
                ) {

                    submittedDocuments =
                        req.body.documents
                            .map(
                                function(document) {

                                    return String(
                                        document || ""
                                    ).trim();

                                }
                            )
                            .filter(
                                function(document) {

                                    return (
                                        document !== ""
                                    );

                                }
                            );

                }

                else {

                    submittedDocuments = [
                        String(
                            req.body.documents
                        ).trim()
                    ];

                }

            }

            else {

                submittedDocuments =
                    existingStudent.submittedDocuments ||
                    [];

            }


            // ------------------------------------------
            // CUSTOM FIELDS
            // ------------------------------------------

            // ------------------------------------------
// CUSTOM FIELDS / ADDITIONAL INFORMATION
// ------------------------------------------

let customFields = [];

let customNames =
    req.body.customFieldName;

let customValues =
    req.body.customFieldValue;


// ------------------------------------------
// NORMALIZE SINGLE VALUE TO ARRAY
// ------------------------------------------

if (
    !Array.isArray(customNames)
) {

    customNames =
        customNames !== undefined
            ? [customNames]
            : [];

}


if (
    !Array.isArray(customValues)
) {

    customValues =
        customValues !== undefined
            ? [customValues]
            : [];

}


// ------------------------------------------
// BUILD CUSTOM FIELDS
// ------------------------------------------

const customFieldCount =
    Math.max(
        customNames.length,
        customValues.length
    );


for (
    let i = 0;
    i < customFieldCount;
    i++
) {

    const fieldName =
        String(
            customNames[i] || ""
        ).trim();


    const fieldValue =
        String(
            customValues[i] || ""
        ).trim();


    if (
        fieldName &&
        fieldValue
    ) {

        customFields.push({

            name:
                fieldName,

            value:
                fieldValue

        });

    }

}


// ------------------------------------------
// KEEP EXISTING DATA ONLY IF NO CUSTOM
// FIELDS WERE SUBMITTED AT ALL
// ------------------------------------------

if (
    customFieldCount === 0
) {

    customFields =
        existingStudent.customFields ||
        [];

}

            // ------------------------------------------
            // UPDATE STUDENT
            // ------------------------------------------

            existingStudent.name =
                String(
                    name
                ).trim();


            existingStudent.class =
                classNumber;


            existingStudent.academicSession =
                selectedAcademicSession;


            existingStudent.schoolJoinSession =
                selectedSchoolJoinSession;


            existingStudent.aadhaar =
                aadhaar
                    ? String(
                        aadhaar
                    ).trim()
                    : "";


            existingStudent.mobile =
                mobile
                    ? String(
                        mobile
                    ).trim()
                    : "";


            existingStudent.fatherName =
                String(
                    fatherName
                ).trim();


            existingStudent.motherName =
                String(
                    motherName
                ).trim();


            existingStudent.fatherAadhaar =
                fatherAadhaar
                    ? String(
                        fatherAadhaar
                    ).trim()
                    : "";


            existingStudent.motherAadhaar =
                motherAadhaar
                    ? String(
                        motherAadhaar
                    ).trim()
                    : "";


            existingStudent.serialNo =
                serialNo
                    ? String(
                        serialNo
                    ).trim()
                    : existingStudent.serialNo;


            existingStudent.uid =
                uid
                    ? String(
                        uid
                    ).trim()
                    : existingStudent.uid;


            existingStudent.status =
                status;


            existingStudent.submittedDocuments =
                submittedDocuments;


            existingStudent.customFields =
                customFields;


            // ------------------------------------------
            // SAVE
            // ------------------------------------------

            await existingStudent.save();


            // ------------------------------------------
            // SUCCESS
            // ------------------------------------------

            return res.redirect(
                "/admin/students/details/" +
                existingStudent._id
            );


        }

        catch (error) {

            console.error(
                "Student Update Error:",
                error
            );


            return res
                .status(500)
                .send(
                    "Unable to update student."
                );

        }

    }
);


// ======================================================
// EXPORT
// ======================================================

module.exports = app;