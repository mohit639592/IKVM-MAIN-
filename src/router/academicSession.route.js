const express = require("express");
const { requireLogin, requireAdmin } = require("../middleware/auth");
const Student = require("../models/student");
const {
    validateSession,
    nextSession,
    getSessionState,
    getOrCreateSession,
    promoteClass
} = require("../services/academicSession.service");

const app = express.Router();

function parseDateOnly(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    if (month < 1 || month > 12 || day < 1 || day > 31) return null;

    const date = new Date(
        `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00+05:30`
    );

    if (Number.isNaN(date.getTime())) return null;

    // JavaScript normalizes invalid dates (for example, April 31 -> May 1),
    // so verify the actual calendar components in India time.
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(date);

    const actual = {};
    for (const part of parts) actual[part.type] = part.value;

    if (
        Number(actual.year) !== year ||
        Number(actual.month) !== month ||
        Number(actual.day) !== day
    ) {
        return null;
    }

    return date;
}

function formatDateForInput(date) {
    if (!date) return "";

    const d = new Date(date);
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(d);

    const map = {};
    for (const part of parts) {
        map[part.type] = part.value;
    }

    return `${map.year}-${map.month}-${map.day}`;
}


app.get(
    "/api/admin/academic-session/status",
    requireAdmin,
    async (req, res) => {
        try {
            const state = await getSessionState();

            return res.json({
                success: true,
                currentSession: state.sourceSession,
                nextSession: state.targetSession,
                displaySession: state.displaySession,
                promotionOpen: state.promotionOpen,
                promotionPending: state.promotionPending,
                completedClasses: state.completedClasses,
                pendingClasses: state.pendingClasses,
                completedCount: state.completedClasses.length,
                totalClasses: 12,
                sessionStartDate: state.config.sessionStartDate
            });
        } catch (error) {
            console.error("Academic Session Status Error:", error);
            return res.status(500).json({
                success: false,
                message: "Unable to load academic session status."
            });
        }
    }
);

app.get(
    "/admin/academic-session/settings",
    requireAdmin,
    async (req, res) => {
        try {
            const state = await getSessionState();

            return res.render("admin/academic-session-settings", {
                user: req.session.user,
                academicState: state,
                sessionStartDate: formatDateForInput(state.config.sessionStartDate),
                error: req.query.error || ""
            });
        } catch (error) {
            console.error("Academic Session Settings Error:", error);
            return res.status(500).send("Unable to load academic session settings.");
        }
    }
);

app.post(
    "/admin/academic-session/settings",
    requireAdmin,
    async (req, res) => {
        try {
            const currentSession = String(req.body.currentSession || "").trim();
            const sessionStartDate = parseDateOnly(req.body.sessionStartDate);

            validateSession(currentSession);

            if (!sessionStartDate) {
                return res.status(400).send("Invalid session start date.");
            }

            const config = await getOrCreateSession();
            const state = await getSessionState();

            // Never rewrite the session configuration while a live promotion
            // workflow is waiting for completion.
            if (state.promotionPending && currentSession !== config.currentSession) {
                return res.status(409).send(
                    "Complete the pending student promotion before changing the current session."
                );
            }

            // Once student records exist, the live session must advance through
            // the controlled promotion workflow. This prevents an administrator
            // from accidentally jumping 2026-27 -> 2028-29 and leaving students
            // attached to the wrong academic session. The initial session can
            // still be configured freely before students are entered.
            if (currentSession !== config.currentSession) {
                const studentCount = await Student.countDocuments();

                if (studentCount > 0) {
                    return res.status(409).send(
                        "The current session cannot be changed manually while student records exist. Use the Promotion Centre to advance the academic session."
                    );
                }
            }

            config.currentSession = currentSession;
            config.nextSession = nextSession(currentSession);
            config.sessionStartDate = sessionStartDate;

            // If the administrator deliberately changes the base session before
            // the next promotion window, clear only stale promotion metadata.
            if (!state.promotionPending) {
                config.promotion.sourceSession = "";
                config.promotion.targetSession = "";
                config.promotion.completedClasses = [];
                config.promotion.startedAt = null;
                config.promotion.completedAt = null;
            }

            await config.save();

            return res.redirect("/admin/academic-session/settings?saved=1");
        } catch (error) {
            console.error("Academic Session Settings Save Error:", error);
            return res.status(400).send(error.message || "Unable to save academic session settings.");
        }
    }
);

app.get(
    "/admin/academic-session/promotion",
    requireAdmin,
    async (req, res) => {
        try {
            const state = await getSessionState();
            const selectedClass = Number(req.query.class || 1);
            const validClass = Number.isInteger(selectedClass) && selectedClass >= 1 && selectedClass <= 12
                ? selectedClass
                : 1;

            let students = [];

            if (state.promotionOpen && !state.completedClasses.includes(validClass)) {
                students = await Student.find({
                    class: validClass,
                    status: "active",
                    $or: [
                        { academicSession: state.sourceSession },
                        { academicSession: { $exists: false } },
                        { academicSession: "" },
                        { academicSession: null }
                    ]
                })
                    .select("name class serialNo uid")
                    .sort({ name: 1 })
                    .lean();
            }

            return res.render("admin/academic-promotion", {
                user: req.session.user,
                academicState: state,
                selectedClass: validClass,
                students
            });
        } catch (error) {
            console.error("Promotion Page Error:", error);
            return res.status(500).send("Unable to load student promotion.");
        }
    }
);

app.get(
    "/api/admin/academic-session/promotion/preview",
    requireAdmin,
    async (req, res) => {
        try {
            const classNumber = Number(req.query.class);
            const state = await getSessionState();

            if (!Number.isInteger(classNumber) || classNumber < 1 || classNumber > 12) {
                return res.status(400).json({ success: false, message: "Invalid class." });
            }

            if (!state.promotionOpen) {
                return res.status(409).json({ success: false, message: "Promotion is not available yet." });
            }

            if (state.completedClasses.includes(classNumber)) {
                return res.json({
                    success: true,
                    alreadyCompleted: true,
                    students: [],
                    total: 0
                });
            }

            const students = await Student.find({
                class: classNumber,
                status: "active",
                $or: [
                    { academicSession: state.sourceSession },
                    { academicSession: { $exists: false } },
                    { academicSession: "" },
                    { academicSession: null }
                ]
            })
                .select("name class serialNo uid academicSession")
                .sort({ name: 1 })
                .lean();

            return res.json({
                success: true,
                alreadyCompleted: false,
                sourceSession: state.sourceSession,
                targetSession: state.targetSession,
                class: classNumber,
                newClass: classNumber < 12 ? classNumber + 1 : null,
                students,
                total: students.length
            });
        } catch (error) {
            console.error("Promotion Preview Error:", error);
            return res.status(500).json({
                success: false,
                message: "Unable to load promotion preview."
            });
        }
    }
);

app.post(
    "/admin/academic-session/promotion",
    requireAdmin,
    async (req, res) => {
        try {
            const classNumber = Number(req.body.classNumber);
            const confirmation = String(req.body.confirmation || "").trim().toUpperCase();

            const result = await promoteClass({
                classNumber,
                confirmation,
                adminId: req.session.user.id
            });

            const message = result.completed
                ? "Academic session transition completed successfully."
                : `Class ${result.classNumber} has been processed successfully.`;

            return res.redirect(
                `/admin/academic-session/promotion?success=${encodeURIComponent(message)}`
            );
        } catch (error) {
            console.error("Student Promotion Error:", error);
            return res.status(400).send(error.message || "Unable to complete promotion.");
        }
    }
);

module.exports = app;
