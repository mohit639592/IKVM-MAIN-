const requireLogin = (req, res, next) => {

    if (
        !req.session ||
        !req.session.user
    ) {

        // API request
        if (
            req.path.startsWith("/api/")
        ) {

            return res.status(401).json({

                success: false,

                message:
                    "Authentication required."

            });

        }


        // Normal browser page
        return res.redirect(
            "/login"
        );

    }


    next();

};


const requireAdmin = (req, res, next) => {

    // ------------------------------------------
    // NOT LOGGED IN
    // ------------------------------------------

    if (
        !req.session ||
        !req.session.user
    ) {

        // API
        if (
            req.path.startsWith("/api/")
        ) {

            return res.status(401).json({

                success: false,

                message:
                    "Authentication required."

            });

        }


        // Browser
        return res.redirect(
            "/login"
        );

    }


    // ------------------------------------------
    // CHECK ROLE
    // ------------------------------------------

    if (
        req.session.user.role !== "admin"
    ) {

        // API
        if (
            req.path.startsWith("/api/")
        ) {

            return res.status(403).json({

                success: false,

                message:
                    "Administrator access required."

            });

        }


        // Browser
        return res
            .status(403)
            .send(
                "Access denied."
            );

    }


    next();

};


module.exports = {

    requireLogin,

    requireAdmin

};