import express from "express";
import { verifyJwtToken } from "../utils/jwtHelper.js";
import {
  BadRequestError,
  InternalServerError,
  UnAuthorizedError,
} from "../config/apiError.js";
import { settings } from "../config/settings.js";

export const authMiddleware = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  const origin = req.headers.origin;
  if (!origin) {
    throw new BadRequestError("Origin not found!!");
  }
  let token;
  if (origin == settings.digitalFrontendURL) {
    token = req.cookies[settings.jwt.tokenCookieKeyDigital];
  } else if (req.baseUrl === "/api/console") {
    token = req.cookies[settings.jwt.tokenCookieKeyConsole];
  } else {
    token = req.cookies[settings.jwt.tokenCookieKey];
  }
  if (!token) {
    throw new UnAuthorizedError();
  }
  try {
    const decoded = verifyJwtToken(token);
    req.userId = decoded.userId;
    req.tenantId = decoded.tenantId;
    next();
  } catch (error: unknown | any) {
    console.error(error);
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      throw new UnAuthorizedError();
    }
    throw new InternalServerError("Internal server error");
  }
};
