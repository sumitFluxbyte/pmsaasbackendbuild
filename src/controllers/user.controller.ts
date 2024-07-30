import express from "express";
import { StatusCodes } from "http-status-codes";
import {
  OrgStatusEnum,
  UserStatusEnum,
  UserProviderTypeEnum,
  UserRoleEnum,
} from "@prisma/client";
import { getClientByTenantId } from "../config/db.js";
import {
  BadRequestError,
  InternalServerError,
  SuccessResponse,
  UnAuthorizedError,
} from "../config/apiError.js";
import {
  userUpdateSchema,
  userOrgSettingsUpdateSchema,
  avatarImgSchema,
  changePasswordSchema,
} from "../schemas/userSchema.js";
import { uuidSchema } from "../schemas/commonSchema.js";
import { verifyEmailOtpSchema } from "../schemas/authSchema.js";
import { EmailService } from "../services/email.services.js";
import { OtpService } from "../services/userOtp.services.js";
import { AwsUploadService } from "../services/aws.services.js";
import { compareEncryption, encrypt } from "../utils/encryption.js";

export const me = async (req: express.Request, res: express.Response) => {
  const prisma = await getClientByTenantId(req.tenantId);
  const user = await prisma.user.findUniqueOrThrow({
    where: { userId: req.userId, deletedAt: null },
    include: {
      userOrganisation: {
        where: { deletedAt: null },
        include: {
          organisation: {
            where: { deletedAt: null },
            include: { orgHolidays: true },
          },
        },
      },
      provider: { select: { providerType: true } },
    },
  });

  let errorMessage =
    "Your account is blocked, please contact your administrator";
  if (user.userOrganisation[0]?.role === UserRoleEnum.ADMINISTRATOR) {
    errorMessage =
      "Your account is blocked, please contact our support at support@projectchef.io";
  }

  if (user.isVerified && user?.status === UserStatusEnum.INACTIVE) {
    throw new BadRequestError(errorMessage);
  }

  if (user.userOrganisation.length > 0) {
    const organisation = user.userOrganisation[0]?.organisation;

    if (user.isVerified && organisation?.status === OrgStatusEnum.DEACTIVE) {
      throw new BadRequestError(errorMessage);
    }
  }

  return new SuccessResponse(StatusCodes.OK, user, "Login user details").send(
    res
  );
};

export const updateUserProfile = async (
  req: express.Request,
  res: express.Response
) => {
  const userDataToUpdate = userUpdateSchema.parse(req.body);
  const prisma = await getClientByTenantId(req.tenantId);

  const user = await prisma.user.update({
    data: {
      ...userDataToUpdate,
    },
    where: { userId: req.userId },
  });
  return new SuccessResponse(StatusCodes.OK, user, "User profile updated").send(
    res
  );
};

export const updateUserAvtarImg = async (
  req: express.Request,
  res: express.Response
) => {
  const files = avatarImgSchema.parse(req.files);
  const prisma = await getClientByTenantId(req.tenantId);
  const findUser = await prisma.user.findFirstOrThrow({
    where: { userId: req.userId, deletedAt: null },
  });
  const avatarImgURL = await AwsUploadService.uploadFileWithContent(
    `${findUser.userId}-${files?.avatarImg?.name}`,
    files?.avatarImg?.data,
    "user-profiles"
  );
  const user = await prisma.user.update({
    data: {
      avatarImg: avatarImgURL,
    },
    where: { userId: req.userId },
  });
  return new SuccessResponse(StatusCodes.OK, user, "User profile updated").send(
    res
  );
};

export const updateUserOrganisationSettings = async (
  req: express.Request,
  res: express.Response
) => {
  const userOrgSettingsData = userOrgSettingsUpdateSchema.parse(req.body);
  const userOrganisationId = uuidSchema.parse(req.params.userOrganisationId);
  const prisma = await getClientByTenantId(req.tenantId);
  await prisma.userOrganisation.update({
    data: {
      ...userOrgSettingsData,
    },
    where: { userOrganisationId, userId: req.userId },
  });
  return new SuccessResponse(
    StatusCodes.OK,
    null,
    "User organisation settings updated"
  ).send(res);
};

export const otpVerify = async (
  req: express.Request,
  res: express.Response
) => {
  const { otp } = verifyEmailOtpSchema.parse(req.body);
  const checkOtp = await OtpService.verifyOTP(otp, req.userId!, req.tenantId);
  if (!checkOtp) {
    throw new BadRequestError("Invalid OTP");
  }
  return new SuccessResponse(
    StatusCodes.OK,
    null,
    "OTP verified successfully"
  ).send(res);
};

export const resendOTP = async (
  req: express.Request,
  res: express.Response
) => {
  const prisma = await getClientByTenantId(req.tenantId);
  const user = await prisma.user.findFirstOrThrow({
    where: {
      userId: req.userId,
    },
  });
  const findOtp = await prisma.userOTP.findFirst({
    where: {
      userId: req.userId,
      createdAt: {
        gt: new Date(Date.now() - 60 * 1000),
      },
    },
  });
  if (findOtp) {
    throw new BadRequestError("Please try again after 1 minute");
  }
  const expiresInMinutes = 10;
  try {
    await EmailService.sendOTPTemplate(
      user.email,
      user.userId,
      req.tenantId,
      expiresInMinutes
    );
  } catch (error) {
    throw new InternalServerError();
  }
  return new SuccessResponse(
    StatusCodes.OK,
    null,
    "Resend OTP successfully"
  ).send(res);
};

export const changePassword = async (
  req: express.Request,
  res: express.Response
) => {
  const { oldPassword, password } = changePasswordSchema.parse(req.body);
  const prisma = await getClientByTenantId(req.tenantId);
  const findEmailProvider = await prisma.userProvider.findFirst({
    where: {
      userId: req.userId,
      deletedAt: null,
      providerType: UserProviderTypeEnum.EMAIL,
    },
  });
  if (!findEmailProvider) {
    throw new UnAuthorizedError();
  }

  const verifyPassword = await compareEncryption(
    oldPassword,
    findEmailProvider.idOrPassword
  );
  if (!verifyPassword) {
    throw new UnAuthorizedError("You entered an incorrect old password");
  }
  const hashedPassword = await encrypt(password);
  await prisma.userProvider.update({
    where: {
      userProviderId: findEmailProvider.userProviderId,
    },
    data: {
      idOrPassword: hashedPassword,
    },
  });
  return new SuccessResponse(
    StatusCodes.OK,
    null,
    "Change password successfully"
  ).send(res);
};
