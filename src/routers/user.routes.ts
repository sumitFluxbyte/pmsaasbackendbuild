import express from "express";
import * as UserController from "../controllers/user.controller.js";

let router = express.Router();

router.get("/me", UserController.me);
router.put("/", UserController.updateUserProfile);
router.put("/avatarImg-update", UserController.updateUserAvtarImg);
router.put(
  "/organisation/:userOrganisationId",
  UserController.updateUserOrganisationSettings
);
router.post("/verify-email", UserController.otpVerify);
router.post("/resend-otp", UserController.resendOTP);
router.put("/change-password", UserController.changePassword);

export default router;
