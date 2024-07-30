import express from "express";
import { User } from "@prisma/client";
import * as AuthController from "../controllers/auth.controller.js";
import passport from "passport";
import { settings } from "../config/settings.js";
import { createJwtToken } from "../utils/jwtHelper.js";
import { cookieConfig } from "../utils/setCookies.js";
import { BadRequestError } from "../config/apiError.js";

let router = express.Router();

router.get("/my-ip", AuthController.checkIp);
router.put("/reset-password/:token", AuthController.resetPassword);
router.post("/forgot-password", AuthController.forgotPassword);
router.post("/sign-up", AuthController.signUp);
router.post("/login", AuthController.login);
router.post("/logout", AuthController.logout);
router.get("/access-token", AuthController.getAccessToken);
router.post("/root-auth", AuthController.verifyRoot);

router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: `${settings.appURL}/login`,
    session: false,
  }),
  (req, res) => {
    const host = req.headers.host;
    if (!host) {
      throw new BadRequestError("Host not found!!");
    }
    const user = req.user as User;

    const tokenPayload = {
      userId: user.userId,
      email: user.email,
      tenantId: req.tenantId ?? "root",
    };
    const token = createJwtToken(tokenPayload);
    const refreshToken = createJwtToken(tokenPayload, true);
    const isDigitalFrontend = host === "digital-api.projectchef.io";
    const tokenCookieKey = isDigitalFrontend
      ? settings.jwt.tokenCookieKeyDigital
      : settings.jwt.tokenCookieKey;
    const refreshTokenCookieKey = isDigitalFrontend
      ? settings.jwt.refreshTokenCookieKeyDigital
      : settings.jwt.refreshTokenCookieKey;

    res.cookie(tokenCookieKey, token, {
      ...cookieConfig,
      maxAge: cookieConfig.maxAgeToken,
    });
    res.cookie(refreshTokenCookieKey, refreshToken, {
      ...cookieConfig,
      maxAge: cookieConfig.maxAgeRefreshToken,
    });

    res.redirect(`${settings.appURL}`);
  }
);

export default router;
