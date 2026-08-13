const AcademicSession = require("../models/academicSession");
const Student = require("../models/student");
const StudentAcademicHistory = require("../models/studentAcademicHistory");

const SESSION_RE = /^(\d{4})-(\d{2})$/;

function validateSession(value) {
    if (!SESSION_RE.test(value)) {
        throw new Error("Invalid academic session. Use YYYY-YY format.");
    }
}

function nextSession(session) {
    validateSession(session);
    const match = session.match(SESSION_RE);
    const startYear = Number(match[1]);
    return `${startYear + 1}-${String((startYear + 2) % 100).padStart(2, "0")}`;
}

function isPromotionWindowOpen(config, now = new Date()) {
    return now >= new Date(config.sessionStartDate);
}

async function getOrCreateSession() {
    let config = await AcademicSession.findOne({ key: "main" });

    if (config) return config;

    config = await AcademicSession.create({
        key: "main",
        currentSession: "2026-27",
        nextSession: "2027-28",
        sessionStartDate: new Date("2027-04-01T00:00:00+05:30"),
        promotion: {
            sourceSession: "",
            targetSession: "",
            completedClasses: []
        }
    });

    return config;
}

async function getSessionState() {
    const config = await getOrCreateSession();
    const promotionOpen = isPromotionWindowOpen(config);
    const completedClasses = Array.isArray(config.promotion?.completedClasses)
        ? config.promotion.completedClasses.map(Number)
        : [];

    const sourceSession = config.currentSession;
    const targetSession = config.nextSession;

    const pendingClasses = [];
    for (let classNumber = 1; classNumber <= 12; classNumber++) {
        if (!completedClasses.includes(classNumber)) {
            pendingClasses.push(classNumber);
        }
    }

    const promotionPending = promotionOpen && pendingClasses.length > 0;

    return {
        config,
        promotionOpen,
        promotionPending,
        sourceSession,
        targetSession,
        completedClasses,
        pendingClasses,
        displaySession: promotionOpen ? targetSession : sourceSession
    };
}

async function promoteClass({ classNumber, confirmation, adminId }) {
    const classNumberInt = Number(classNumber);

    if (!Number.isInteger(classNumberInt) || classNumberInt < 1 || classNumberInt > 12) {
        throw new Error("Invalid class selected.");
    }

    if (confirmation !== "PROMOTE") {
        throw new Error("Promotion confirmation is required.");
    }

    const state = await getSessionState();

    if (!state.promotionOpen) {
        throw new Error("The new academic session has not started yet.");
    }

    if (state.completedClasses.includes(classNumberInt)) {
        throw new Error("This class has already been processed.");
    }

    if (state.config.promotion.targetSession && state.config.promotion.targetSession !== state.targetSession) {
        throw new Error("Promotion state is inconsistent. Please review Academic Session settings.");
    }

    const sourceSession = state.sourceSession;
    const targetSession = state.targetSession;

    const students = await Student.find({
        class: classNumberInt,
        status: "active",
        $or: [
            { academicSession: sourceSession },
            { academicSession: { $exists: false } },
            { academicSession: "" },
            { academicSession: null }
        ]
    }).select("_id name class academicSession status").lean();

    const now = new Date();

    // Class 12 is intentionally not promoted to Class 13.
    if (classNumberInt === 12) {
        for (const student of students) {
            await StudentAcademicHistory.updateOne(
                {
                    studentId: student._id,
                    session: sourceSession
                },
                {
                    $setOnInsert: {
                        studentId: student._id,
                        session: sourceSession,
                        class: 12,
                        statusAtEnd: "graduated",
                        recordedAt: now
                    }
                },
                { upsert: true }
            );

            await Student.updateOne(
                {
                    _id: student._id,
                    class: 12,
                    status: "active"
                },
                {
                    $set: {
                        academicSession: targetSession,
                        status: "deactive",
                        graduationSession: targetSession
                    }
                }
            );
        }
    } else {
        for (const student of students) {
            const historyResult = await StudentAcademicHistory.updateOne(
                {
                    studentId: student._id,
                    session: sourceSession
                },
                {
                    $setOnInsert: {
                        studentId: student._id,
                        session: sourceSession,
                        class: classNumberInt,
                        statusAtEnd: "active",
                        recordedAt: now
                    }
                },
                { upsert: true }
            );

            // Only move the student if the history record was successfully
            // created for this source session, or the student is still in the
            // expected source class/session. This prevents double promotion.
            await Student.updateOne(
                {
                    _id: student._id,
                    class: classNumberInt,
                    status: "active",
                    $or: [
                        { academicSession: sourceSession },
                        { academicSession: { $exists: false } },
                        { academicSession: "" },
                        { academicSession: null }
                    ]
                },
                {
                    $set: {
                        class: classNumberInt + 1,
                        academicSession: targetSession
                    }
                }
            );
        }
    }

    const freshConfig = await AcademicSession.findOne({ key: "main" });

    if (!freshConfig) {
        throw new Error("Academic session configuration not found after promotion.");
    }

    const completed = new Set(
        (freshConfig.promotion.completedClasses || []).map(Number)
    );
    completed.add(classNumberInt);

    const completedClasses = Array.from(completed).sort((a, b) => a - b);

    freshConfig.promotion.sourceSession = sourceSession;
    freshConfig.promotion.targetSession = targetSession;
    freshConfig.promotion.completedClasses = completedClasses;
    freshConfig.promotion.startedAt = freshConfig.promotion.startedAt || now;

    if (completedClasses.length === 12) {
        freshConfig.currentSession = targetSession;
        freshConfig.nextSession = nextSession(targetSession);
        freshConfig.sessionStartDate = new Date(
            new Date(freshConfig.sessionStartDate).setFullYear(
                new Date(freshConfig.sessionStartDate).getFullYear() + 1
            )
        );
        freshConfig.promotion.completedAt = now;
        freshConfig.promotion.sourceSession = "";
        freshConfig.promotion.targetSession = "";
        freshConfig.promotion.completedClasses = [];
        freshConfig.promotion.startedAt = null;
    }

    await freshConfig.save();

    return {
        classNumber: classNumberInt,
        studentCount: students.length,
        targetSession,
        completed: completedClasses.length === 12,
        completedClasses
    };
}

module.exports = {
    validateSession,
    nextSession,
    getOrCreateSession,
    getSessionState,
    promoteClass
};
