import express from "express";
import {
  OrgStatusEnum,
  UserProviderTypeEnum,
  UserRoleEnum,
  UserStatusEnum,
} from "@prisma/client";

import { getClientByTenantId } from "../config/db.js";
import { settings } from "../config/settings.js";
import { createJwtToken, verifyJwtToken } from "../utils/jwtHelper.js";
import { compareEncryption, encrypt } from "../utils/encryption.js";
import {
  BadRequestError,
  InternalServerError,
  NotFoundError,
  SuccessResponse,
  UnAuthorizedError,
} from "../config/apiError.js";
import { StatusCodes } from "http-status-codes";
import {
  authLoginSchema,
  authRefreshTokenSchema,
  authSignUpSchema,
  forgotPasswordSchema,
  resetPasswordTokenSchema,
  resetTokenSchema,
} from "../schemas/authSchema.js";
import { BrevoService } from "../services/brevo.services.js";
import { EmailService } from "../services/email.services.js";
import { generateRandomToken } from "../utils/generateRandomToken.js";
import { cookieConfig } from "../utils/setCookies.js";
import geo from "geoip-lite";
const { lookup } = geo;

export const signUp = async (req: express.Request, res: express.Response) => {
  const origin = req.headers.origin;
  if (!origin) throw new BadRequestError("Origin not found!!");
  const { firstName, lastName, email, password, language } =
    authSignUpSchema.parse(req.body);
  const hashedPassword = await encrypt(password);
  const prisma = await getClientByTenantId(req.tenantId);
  const findUserIfExists = await prisma.user.findUnique({
    where: { email, deletedAt: null },
  });
  let newCreatedUser;
  if (!findUserIfExists) {
    newCreatedUser = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        language,
        status: UserStatusEnum.ACTIVE,
        provider: {
          create: {
            idOrPassword: hashedPassword,
            providerType: UserProviderTypeEnum.EMAIL,
          },
        },
      },
    });
  } else {
    const findEmailProvider = await prisma.userProvider.findFirst({
      where: {
        userId: findUserIfExists.userId,
        providerType: { in: [UserProviderTypeEnum.EMAIL] },
        deletedAt: null,
      },
    });
    if (findEmailProvider) {
      throw new BadRequestError("User already exists with this email");
    } else {
      try {
        await prisma.userProvider.create({
          data: {
            providerType: UserProviderTypeEnum.EMAIL,
            userId: findUserIfExists.userId,
            idOrPassword: hashedPassword,
          },
        });
      } catch (error) {
        console.error(error);
      }
    }
  }

  const userId = findUserIfExists
    ? findUserIfExists.userId
    : newCreatedUser?.userId!;
  const user = findUserIfExists ? findUserIfExists : newCreatedUser;
  const tokenPayload = {
    userId,
    email: email,
    tenantId: req.tenantId ?? "root",
  };
  const token = createJwtToken(tokenPayload);
  const refreshToken = createJwtToken(tokenPayload, true);
  try {
    const expiresInMinutes = 10;
    await EmailService.sendOTPTemplate(
      email,
      userId,
      req.tenantId,
      expiresInMinutes
    );
  } catch (error) {
    console.error("Failed to send email", error);
  }

  // Brevo API call
  try {
    await BrevoService.createOrUpdateContact(email, firstName, lastName);
  } catch (error) {
    console.error(error);
  }

  const isDigitalFrontend = origin === settings.digitalFrontendURL;
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
  return new SuccessResponse(
    StatusCodes.CREATED,
    user,
    "Sign up successfully"
  ).send(res);
};

export const login = async (req: express.Request, res: express.Response) => {
  const origin = req.headers.origin;
  if (!origin) throw new BadRequestError("Origin not found!!");
  const { email, password } = authLoginSchema.parse(req.body);
  const prisma = await getClientByTenantId(req.tenantId);
  const user = await prisma.user.findUniqueOrThrow({
    where: { email, deletedAt: null },
    include: {
      userOrganisation: {
        where: { deletedAt: null },
        include: {
          organisation: {
            where: { deletedAt: null },
          },
        },
      },
      provider: true,
    },
  });
  let errorMessage =
    "Your account is blocked, please contact your administrator";
  if (
    user.isVerified &&
    user.userOrganisation[0]?.role === UserRoleEnum.ADMINISTRATOR
  ) {
    errorMessage =
      "Your account is blocked, please contact our support at support@projectchef.io";
  }
  if (user.isVerified && user?.status === UserStatusEnum.INACTIVE) {
    throw new BadRequestError(errorMessage);
  }
  if (
    user.userOrganisation.length > 0 &&
    user.userOrganisation[0]?.organisation?.status === OrgStatusEnum.DEACTIVE
  ) {
    throw new BadRequestError(errorMessage);
  }

  const findUserProvider = await prisma.userProvider.findFirst({
    where: { userId: user.userId, providerType: UserProviderTypeEnum.EMAIL },
  });
  if (
    user &&
    findUserProvider?.providerType == UserProviderTypeEnum.EMAIL &&
    (await compareEncryption(password, findUserProvider.idOrPassword))
  ) {
    const tokenPayload = {
      userId: user.userId,
      email: email,
      tenantId: req.tenantId ?? "root",
    };
    const token = createJwtToken(tokenPayload);
    const refreshToken = createJwtToken(tokenPayload, true);

    const isDigitalFrontend = origin === settings.digitalFrontendURL;
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
    const { provider, ...userWithoutProvider } = user;

    // Generate and save verify otp
    if (!user.isVerified) {
      const expiresInMinutes = 5;
      try {
        await EmailService.sendOTPTemplate(
          user.email,
          user.userId,
          req.tenantId,
          expiresInMinutes
        );
      } catch (error) {
        console.error("Failed to send otp email", error);
      }
    }
    return new SuccessResponse(
      StatusCodes.OK,
      { user: userWithoutProvider },
      "Login successfully"
    ).send(res);
  }
  throw new UnAuthorizedError("There is an error with your login/password");
};

export const getAccessToken = (req: express.Request, res: express.Response) => {
  const refreshTokenCookie = authRefreshTokenSchema.parse(
    req.cookies[settings.jwt.refreshTokenCookieKey]
  );

  const decoded = verifyJwtToken(refreshTokenCookie);
  const tokenPayload = {
    userId: decoded.userId,
    email: decoded.email,
    tenantId: decoded.tenantId,
  };
  const token = createJwtToken(tokenPayload);
  res.cookie(settings.jwt.tokenCookieKey, token, {
    ...cookieConfig,
    maxAge: cookieConfig.maxAgeToken,
  });

  const refreshToken = createJwtToken(tokenPayload, true);
  res.cookie(settings.jwt.refreshTokenCookieKey, refreshToken, {
    ...cookieConfig,
    maxAge: cookieConfig.maxAgeRefreshToken,
  });
  return new SuccessResponse(
    StatusCodes.OK,
    null,
    "Access token retrived successfully"
  ).send(res);
};

export const verifyRoot = (req: express.Request, res: express.Response) => {
  const username = req.body.username;
  const password = req.body.password;
  if (
    username == settings.user.username &&
    password == settings.user.password
  ) {
    return new SuccessResponse(StatusCodes.OK, null, "Ok").send(res);
  } else {
    throw new BadRequestError();
  }
};

export const forgotPassword = async (
  req: express.Request,
  res: express.Response
) => {
  const { email } = forgotPasswordSchema.parse(req.body);
  const token = generateRandomToken();

  const prisma = await getClientByTenantId(req.tenantId);
  const findUser = await prisma.user.findFirst({
    where: { email: email, deletedAt: null },
  });
  if (!findUser) throw new NotFoundError("User not found");

  const expiryTimeInMinutes = 10;
  const expirationTime = new Date(Date.now() + expiryTimeInMinutes * 60 * 1000);

  try {
    await EmailService.sendResetPasswordTemplate(email, token);
    await prisma.resetPassword.create({
      data: {
        isUsed: false,
        token: token,
        userId: findUser.userId,
        expiryTime: expirationTime,
      },
    });
  } catch (error) {
    throw new InternalServerError();
  }

  return new SuccessResponse(
    StatusCodes.OK,
    null,
    "Sent email successfully"
  ).send(res);
};

export const resetPassword = async (
  req: express.Request,
  res: express.Response
) => {
  const token = resetTokenSchema.parse(req.params.token);
  const { password } = resetPasswordTokenSchema.parse(req.body);

  const prisma = await getClientByTenantId(req.tenantId);
  let resetPasswordRecord = await prisma.resetPassword.findFirst({
    where: {
      token: token,
      deletedAt: null,
      expiryTime: {
        gt: new Date(),
      },
    },
  });
  if (!resetPasswordRecord) throw new BadRequestError("Invalid token");
  const hashedPassword = await encrypt(password);
  const findUserProvider = await prisma.userProvider.findFirst({
    where: {
      userId: resetPasswordRecord.userId,
      providerType: UserProviderTypeEnum.EMAIL,
    },
  });
  await prisma.$transaction([
    prisma.resetPassword.update({
      where: {
        resetPasswordId: resetPasswordRecord.resetPasswordId,
        userId: resetPasswordRecord.userId,
      },
      data: {
        isUsed: true,
      },
    }),
    prisma.userProvider.update({
      where: {
        userProviderId: findUserProvider?.userProviderId,
      },
      data: {
        idOrPassword: hashedPassword,
      },
    }),
  ]);
  return new SuccessResponse(
    StatusCodes.OK,
    null,
    "Reset password successfully"
  ).send(res);
};

export const logout = (req: express.Request, res: express.Response) => {
  const origin = req.headers.origin;
  if (!origin) throw new BadRequestError("Origin not found!!");

  const isDigitalFrontend = origin === settings.digitalFrontendURL;

  const tokenCookieKey = isDigitalFrontend
    ? settings.jwt.tokenCookieKeyDigital
    : settings.jwt.tokenCookieKey;
  const refreshTokenCookieKey = isDigitalFrontend
    ? settings.jwt.refreshTokenCookieKeyDigital
    : settings.jwt.refreshTokenCookieKey;

  res.clearCookie(tokenCookieKey, {
    ...cookieConfig,
    maxAge: 0,
  });
  res.clearCookie(refreshTokenCookieKey, {
    ...cookieConfig,
    maxAge: 0,
  });
  return new SuccessResponse(StatusCodes.OK, null, "Logout successfully").send(
    res
  );
};

export const checkIp = async (req: express.Request, res: express.Response) => {
  const ipAddress = req.headers["x-forwarded-for"] || req.headers["x-real-ip"];
  let ip;
  if (Array.isArray(ipAddress)) {
    ip = ipAddress[ipAddress.length - 1];
  } else {
    ip = ipAddress;
  }
  if (ip) {
    const geo = lookup(ip);
    return new SuccessResponse(
      StatusCodes.OK,
      { ...geo, ip: ip },
      "Ip fetch successfully"
    ).send(res);
  } else {
    throw new BadRequestError("Ip not found!!");
  }
};
