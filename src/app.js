const express = require("express");
const path = require("path");
const session = require("express-session");
const helmet = require("helmet");
const MongoStore = require("connect-mongo").default;

const app = express();


// =====================================================
// ENVIRONMENT
// =====================================================

const isProduction =
    process.env.NODE_ENV === "production";


// =====================================================
// VALIDATE REQUIRED ENVIRONMENT VARIABLES
// =====================================================

if (!process.env.SESSION_SECRET) {

    throw new Error(
        "SESSION_SECRET is missing from environment variables."
    );

}

if (!process.env.MONGO_URI) {

    throw new Error(
        "MONGO_URI is missing from environment variables."
    );

}


// =====================================================
// RENDER PROXY
// =====================================================

if (isProduction) {

    app.set(
        "trust proxy",
        1
    );

}


// =====================================================
// SECURITY HEADERS
// =====================================================

app.use(
    helmet({
        contentSecurityPolicy: false
    })
);


// =====================================================
// HIDE EXPRESS
// =====================================================

app.disable(
    "x-powered-by"
);


// =====================================================
// BODY PARSER
// =====================================================

app.use(
    express.urlencoded({
        extended: true,
        limit: "1mb"
    })
);

app.use(
    express.json({
        limit: "1mb"
    })
);


// =====================================================
// SESSION
// =====================================================

app.use(
    session({

        name: "ikvm.sid",

        secret:
            process.env.SESSION_SECRET,

        resave: false,

        saveUninitialized: false,

        store:
            MongoStore.create({

                mongoUrl:
                    process.env.MONGO_URI,

                collectionName:
                    "sessions",

                ttl:
                    60 * 60 * 24

            }),

        cookie: {

            httpOnly: true,

            secure:
                isProduction,

            sameSite:
                "lax",

            maxAge:
                1000 *
                60 *
                60 *
                24

        }

    })
);


// =====================================================
// EJS
// =====================================================

app.set(
    "view engine",
    "ejs"
);

app.set(
    "views",
    path.join(
        __dirname,
        "views"
    )
);


// =====================================================
// ROUTES
// =====================================================

const userRoute =
    require("./router/user.route");

app.use(
    "/",
    userRoute
);


// =====================================================
// 404
// =====================================================

app.use(
    (req, res) => {

        if (
            req.path.startsWith("/api/")
        ) {

            return res.status(404).json({

                success: false,

                message:
                    "API endpoint not found."

            });

        }


        return res
            .status(404)
            .send(
                "Page not found."
            );

    }
);


// =====================================================
// ERROR HANDLER
// =====================================================

app.use(
    (err, req, res, next) => {

        console.error(
            "Application Error:",
            err
        );


        if (
            req.path.startsWith("/api/")
        ) {

            return res.status(500).json({

                success: false,

                message:
                    "Internal server error."

            });

        }


        return res
            .status(500)
            .send(
                "Something went wrong."
            );

    }
);


module.exports = app;