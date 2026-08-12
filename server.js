require("dotenv").config();

const app = require("./src/app");
const connectDB = require("./src/database/db");

const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";

const startServer = async () => {

    try {

        await connectDB();

        const server = app.listen(
            PORT,
            HOST,
            () => {

                console.log(
                    `Server running on port ${PORT}`
                );

            }
        );


        // Graceful shutdown
        const shutdown = async (signal) => {

            console.log(
                `${signal} received. Shutting down...`
            );

            server.close(() => {

                console.log(
                    "HTTP server closed."
                );

                process.exit(0);

            });

        };


        process.on(
            "SIGTERM",
            () => shutdown("SIGTERM")
        );

        process.on(
            "SIGINT",
            () => shutdown("SIGINT")
        );


    } catch (error) {

        console.error(
            "Failed to start server:",
            error.message
        );

        process.exit(1);

    }

};


startServer();