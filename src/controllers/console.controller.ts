import express from "express";
import { StatusCodes } from "http-status-codes";
import {
  ConsoleRoleEnum,
  ConsoleStatusEnum,
  OrgStatusEnum,
  UserRoleEnum,
  UserStatusEnum,
} from "@prisma/client";
import { getClientByTenantId } from "../config/db.js";
import { compareEncryption, encrypt } from "../utils/encryption.js";
import {
  BadRequestError,
  InternalServerError,
  NotFoundError,
  SuccessResponse,
  UnAuthorizedError,
} from "../config/apiError.js";
import {
  avatarImgConsoleSchema,
  blockAndReassignAdministatorSchema,
  changeAdministatorSchema,
  changeOrganisationMemberRoleSchema,
  consoleLoginSchema,
  consolePasswordSchema,
  operatorSchema,
  operatorStatusSchema,
  operatorUpdateSchema,
} from "../schemas/consoleSchema.js";
import { createJwtToken } from "../utils/jwtHelper.js";
import { settings } from "../config/settings.js";
import { generateRandomPassword } from "../utils/generateRandomPassword.js";
import { EmailService } from "../services/email.services.js";
import { userStatuSchema } from "../schemas/userSchema.js";
import { uuidSchema } from "../schemas/commonSchema.js";
import { organisationStatuSchema } from "../schemas/organisationSchema.js";
import { ZodError } from "zod";
import { AwsUploadService } from "../services/aws.services.js";
import { cookieConfig } from "../utils/setCookies.js";
import { generateOTP } from "../utils/otpHelper.js";
import { OtpService } from "../services/userOtp.services.js";
import { verifyEmailOtpSchema } from "../schemas/authSchema.js";
import { selectUserFields } from "../utils/selectedFieldsOfUsers.js";

export const me = async (req: express.Request, res: express.Response) => {
  const prisma = await getClientByTenantId(req.tenantId);
  const user = await prisma.consoleUser.findUniqueOrThrow({
    where: {
      userId: req.userId,
      deletedAt: null,
    },
  });

  let errorMessage = "Your account is blocked, please contact your super admin";
  if (user.isVerified && user?.status === ConsoleStatusEnum.INACTIVE) {
    throw new BadRequestError(errorMessage);
  }
  const { password, ...infoWithoutPassword } = user;
  return new SuccessResponse(
    StatusCodes.OK,
    infoWithoutPassword,
    "Login details"
  ).send(res);
};

export const loginConsole = async (
  req: express.Request,
  res: express.Response
) => {
  const { email, password } = consoleLoginSchema.parse(req.body);
  const prisma = await getClientByTenantId(req.tenantId);
  const user = await prisma.consoleUser.findUnique({
    where: { email, deletedAt: null },
  });
  let errorMessage = "Your account is blocked, please contact your super admin";
  if (user?.isVerified && user?.status === ConsoleStatusEnum.INACTIVE) {
    throw new BadRequestError(errorMessage);
  }
  if (user && (await compareEncryption(password, user.password))) {
    const tokenPayload = {
      userId: user.userId,
      email: email,
      tenantId: req.tenantId ?? "root",
    };
    const token = createJwtToken(tokenPayload);
    const refreshToken = createJwtToken(tokenPayload, true);

    res.cookie(settings.jwt.tokenCookieKeyConsole, token, {
      ...cookieConfig,
      maxAge: cookieConfig.maxAgeToken,
    });

    res.cookie(settings.jwt.refreshTokenCookieKeyConsole, refreshToken, {
      ...cookieConfig,
      maxAge: cookieConfig.maxAgeRefreshToken,
    });
    const { password, ...infoWithoutPassword } = user;
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
      { user: infoWithoutPassword },
      "Login successfully"
    ).send(res);
  }
  throw new UnAuthorizedError("There is an error with your login/password");
};

export const changePassword = async (
  req: express.Request,
  res: express.Response
) => {
  if (!req.userId) {
    throw new BadRequestError("userId not found!!");
  }
  const { oldPassword, password } = consolePasswordSchema.parse(req.body);
  const prisma = await getClientByTenantId(req.tenantId);
  const findConsoleUser = await prisma.consoleUser.findUniqueOrThrow({
    where: {
      userId: req.userId,
      deletedAt: null,
    },
  });
  const verifyPassword = await compareEncryption(
    oldPassword,
    findConsoleUser?.password
  );
  if (!verifyPassword) {
    throw new UnAuthorizedError("You entered an incorrect old password");
  }
  const hashedPassword = await encrypt(password);
  await prisma.consoleUser.update({
    data: {
      password: hashedPassword,
    },
    where: {
      userId: req.userId,
    },
  });
  const { password: _, ...withoutPassword } = findConsoleUser;
  return new SuccessResponse(
    StatusCodes.OK,
    withoutPassword,
    "Change password successfully"
  ).send(res);
};

export const createSuperAdmin = async (
  req: express.Request,
  res: express.Response
) => {
  const prisma = await getClientByTenantId("root");
  const { firstName, lastName, email, password } = req.body;
  const hashedPassword = await encrypt(password);
  await prisma.consoleUser.create({
    data: {
      firstName: firstName,
      lastName: lastName,
      email: email,
      password: hashedPassword,
      status: ConsoleStatusEnum.ACTIVE,
      role: ConsoleRoleEnum.SUPER_ADMIN,
      isVerified: true,
    },
  });
  return new SuccessResponse(
    StatusCodes.CREATED,
    null,
    "Super admin created successfully"
  ).send(res);
};

export const createOperator = async (
  req: express.Request,
  res: express.Response
) => {
  if (!req.userId) {
    throw new BadRequestError("userId not found!!");
  }
  const prisma = await getClientByTenantId(req.tenantId);
  const { email, firstName, lastName } = operatorSchema.parse(req.body);
  const randomPassword = generateRandomPassword();
  const hashedPassword = await encrypt(randomPassword);
  const findOperator = await prisma.consoleUser.findUnique({
    where: {
      email: email,
      deletedAt: null,
    },
  });
  if (findOperator) {
    throw new ZodError([
      {
        code: "invalid_string",
        message: "Operator already exists",
        path: ["email"],
        validation: "email",
      },
    ]);
  }
  const newUser = await prisma.consoleUser.create({
    data: {
      email: email,
      firstName: firstName,
      lastName: lastName,
      password: hashedPassword,
      status: ConsoleStatusEnum.INACTIVE,
      role: ConsoleRoleEnum.OPERATOR,
    },
  });
  try {
    await EmailService.sendInvitationInConsoleTemplate(
      newUser.email,
      randomPassword
    );
  } catch (error) {
    console.error("Failed to send email", error);
  }
  const { password, ...infoWithoutPassword } = newUser;
  return new SuccessResponse(
    StatusCodes.CREATED,
    infoWithoutPassword,
    "Operator created successfully"
  ).send(res);
};

export const updateOperator = async (
  req: express.Request,
  res: express.Response
) => {
  if (!req.userId) {
    throw new BadRequestError("userId not found!!");
  }
  const operatorDataToUpdate = operatorUpdateSchema.parse(req.body);
  const prisma = await getClientByTenantId(req.tenantId);
  const user = await prisma.consoleUser.update({
    data: {
      firstName: operatorDataToUpdate.firstName,
      lastName: operatorDataToUpdate.lastName,
      country: operatorDataToUpdate.country,
    },
    where: { userId: req.userId },
  });
  const { password, ...infoWithoutPassword } = user;
  return new SuccessResponse(
    StatusCodes.OK,
    infoWithoutPassword,
    "Profile updated"
  ).send(res);
};

export const changeOperatorStatus = async (
  req: express.Request,
  res: express.Response
) => {
  if (!req.userId) {
    throw new BadRequestError("userId not found!!");
  }
  const userId = uuidSchema.parse(req.params.userId);
  const prisma = await getClientByTenantId(req.tenantId);
  const statusValue = operatorStatusSchema.parse(req.body);
  const user = await prisma.consoleUser.update({
    data: {
      status: statusValue.status,
    },
    where: { userId: userId },
  });
  const { password, ...infoWithoutPassword } = user;
  return new SuccessResponse(
    StatusCodes.OK,
    infoWithoutPassword,
    "Operator status updated successfully"
  ).send(res);
};

export const deleteOperator = async (
  req: express.Request,
  res: express.Response
) => {
  if (!req.userId) {
    throw new BadRequestError("userId not found!!");
  }

  const userId = uuidSchema.parse(req.params.userId);
  const prisma = await getClientByTenantId(req.tenantId);
  const otpValue = generateOTP();
  const findOperator = await prisma.consoleUser.findFirstOrThrow({
    where: { userId, deletedAt: null },
  });
  await prisma.consoleUser.update({
    where: {
      userId: userId,
    },
    data: {
      deletedAt: new Date(),
      email: `${findOperator.email}_deleted_${otpValue}`,
    },
  });
  return new SuccessResponse(
    StatusCodes.OK,
    null,
    "Operator deleted successfully"
  ).send(res);
};

export const getAllOperator = async (
  req: express.Request,
  res: express.Response
) => {
  if (!req.userId) {
    throw new BadRequestError("userId not found!!");
  }
  const prisma = await getClientByTenantId(req.tenantId);
  const operators = await prisma.consoleUser.findMany({
    where: {
      role: {
        in: [ConsoleRoleEnum.OPERATOR],
      },
      deletedAt: null,
    },
    orderBy: {
      createdAt: "asc",
    },
  });
  return new SuccessResponse(
    StatusCodes.OK,
    operators,
    "Operators get successfully"
  ).send(res);
};

export const changeUserStatus = async (
  req: express.Request,
  res: express.Response
) => {
  if (!req.userId) {
    throw new BadRequestError("userId not found!!");
  }
  const userId = uuidSchema.parse(req.params.userId);
  const prisma = await getClientByTenantId(req.tenantId);
  const { organisationId, status } = userStatuSchema.parse(req.body);
  const findUser = await prisma.user.findFirstOrThrow({
    where: { userId, deletedAt: null },
    include: {
      userOrganisation: {
        where: { deletedAt: null },
        select: {
          role: true,
        },
      },
    },
  });
  if (findUser.userOrganisation[0]?.role === UserRoleEnum.ADMINISTRATOR) {
    const findAdministrator = await prisma.userOrganisation.findAdministrator(
      organisationId
    );
    if (findAdministrator.length > 0 && status === UserStatusEnum.ACTIVE) {
      throw new BadRequestError("Administrator already exists");
    }
  }

  if (findUser.status === status) {
    throw new BadRequestError(`User status is already  ${status}`);
  }
  const user = await prisma.user.update({
    data: {
      status: status,
    },
    where: { userId: userId },
  });
  return new SuccessResponse(
    StatusCodes.OK,
    user,
    "User status updated successfully"
  ).send(res);
};

export const changeOrganisationStatus = async (
  req: express.Request,
  res: express.Response
) => {
  if (!req.userId) {
    throw new BadRequestError("userId not found!!");
  }

  const organisationId = uuidSchema.parse(req.params.organisationId);
  const statusValue = organisationStatuSchema.parse(req.body);
  const prisma = await getClientByTenantId(req.tenantId);
  const updatedOrganisation = await prisma.organisation.update({
    where: {
      organisationId: organisationId,
    },
    data: {
      status: statusValue.status,
    },
  });
  let userStatus;
  if (statusValue.status === OrgStatusEnum.DEACTIVE) {
    userStatus = UserStatusEnum.INACTIVE;
  } else if (statusValue.status === UserStatusEnum.ACTIVE) {
    userStatus = UserStatusEnum.ACTIVE;
  }
  if (
    userStatus == UserStatusEnum.ACTIVE ||
    userStatus == UserStatusEnum.INACTIVE
  ) {
    await prisma.user.updateMany({
      where: {
        userOrganisation: {
          some: {
            organisationId: organisationId,
          },
        },
      },
      data: {
        status: userStatus,
      },
    });
  }
  return new SuccessResponse(
    StatusCodes.OK,
    updatedOrganisation,
    "Organisation status updated successfully"
  ).send(res);
};

export const changeUserOrganisationRole = async (
  req: express.Request,
  res: express.Response
) => {
  if (!req.userId) {
    throw new BadRequestError("userId not found!!");
  }
  const organisationId = uuidSchema.parse(req.params.organisationId);
  const { role, userOrganisationId } = changeOrganisationMemberRoleSchema.parse(
    req.body
  );
  const prisma = await getClientByTenantId(req.tenantId);
  const findAdministrator = await prisma.userOrganisation.findAdministrator(
    organisationId
  );

  if (findAdministrator.length > 0) {
    throw new BadRequestError("Administrator already exists");
  }
  const updatedOrganisation = await prisma.userOrganisation.update({
    where: { organisationId, userOrganisationId },
    data: {
      role,
    },
  });
  return new SuccessResponse(
    StatusCodes.OK,
    updatedOrganisation,
    "User role changed successfully"
  ).send(res);
};

export const getAllOrganisation = async (
  req: express.Request,
  res: express.Response
) => {
  if (!req.userId) {
    throw new BadRequestError("userId not found!!");
  }
  const prisma = await getClientByTenantId(req.tenantId);
  const organisations = await prisma.organisation.findMany({
    where: {
      deletedAt: null,
    },
    orderBy: {
      createdAt: "asc",
    },
    include: {
      userOrganisation: {
        where: { deletedAt: null },
        include: {
          user: {
            select: selectUserFields,
          },
        },
      },
    },
  });
  return new SuccessResponse(
    StatusCodes.OK,
    organisations,
    "Organisations fetched successfully"
  ).send(res);
};

export const organisationsUser = async (
  req: express.Request,
  res: express.Response
) => {
  if (!req.userId) {
    throw new BadRequestError("userId not found!!");
  }
  const organisationId = uuidSchema.parse(req.params.organisationId);
  const prisma = await getClientByTenantId(req.tenantId);
  let userOfOrg = await prisma.userOrganisation.findMany({
    where: { organisationId, deletedAt: null },
    include: {
      user: {
        select: selectUserFields,
      },
      organisation: true,
    },
  });
  // userOfOrg = userOfOrg.filter(
  //   (value) =>
  //     ( !
  //       value.role === UserRoleEnum.ADMINISTRATOR &&
  //       value.user?.status === UserStatusEnum.INACTIVE
  //     )
  // ); //dev_hitesh-12-06-2024
  return new SuccessResponse(
    StatusCodes.OK,
    userOfOrg,
    "Organisation's user fetched successfully"
  ).send(res);
};

export const deleteOrganisation = async (
  req: express.Request,
  res: express.Response
) => {
  if (!req.userId) {
    throw new BadRequestError("userId not found!!");
  }
  const organisationId = uuidSchema.parse(req.params.organisationId);
  const prisma = await getClientByTenantId(req.tenantId);
  const findOrg = await prisma.organisation.findFirstOrThrow({
    where: { organisationId },
  });
  const otpValue = generateOTP();
  await prisma.organisation.update({
    where: {
      organisationId,
    },
    include: {
      userOrganisation: true,
      projects: {
        include: {
          tasks: {
            include: {
              assignedUsers: true,
              comments: true,
              dependencies: true,
              documentAttachments: true,
              histories: true,
            },
          },
        },
      },
    },
    data: {
      deletedAt: new Date(),
      organisationName: `${findOrg.organisationName}_deleted_${otpValue}`,
      projects: {
        updateMany: {
          where: { organisationId },
          data: {
            deletedAt: new Date(),
          },
        },
      },
      userOrganisation: {
        updateMany: {
          where: { organisationId },
          data: {
            deletedAt: new Date(),
          },
        },
      },
    },
  });
  return new SuccessResponse(
    StatusCodes.OK,
    null,
    "Organisation deleted successfully"
  ).send(res);
};

export const updateConsoleUserAvtarImg = async (
  req: express.Request,
  res: express.Response
) => {
  const files = avatarImgConsoleSchema.parse(req.files);
  const prisma = await getClientByTenantId(req.tenantId);
  const findUser = await prisma.consoleUser.findFirst({
    where: { userId: req.userId, deletedAt: null },
  });
  if (!findUser) throw new NotFoundError("User not found");
  const avatarImgURL = await AwsUploadService.uploadFileWithContent(
    `${findUser.userId}-${files?.avatarImg?.name}`,
    files?.avatarImg?.data,
    "user-profiles"
  );
  const user = await prisma.consoleUser.update({
    data: {
      avatarImg: avatarImgURL,
    },
    where: { userId: req.userId },
  });
  return new SuccessResponse(StatusCodes.OK, user, "Profile updated").send(res);
};

export const blockAndReassignAdministator = async (
  req: express.Request,
  res: express.Response
) => {
  if (!req.userId) {
    throw new BadRequestError("userId not found!!");
  }
  const { organisationId, userOrganisationBlockId, reassginAdministratorId } =
    blockAndReassignAdministatorSchema.parse(req.body);
  const prisma = await getClientByTenantId(req.tenantId);
  await prisma.$transaction(async (tx) => {
    const findUserOrg = await tx.userOrganisation.findFirstOrThrow({
      where: {
        userOrganisationId: reassginAdministratorId,
      },
      include: {
        user: {
          select: {
            status: true,
          },
        },
      },
    });
    const existingUser = await tx.userOrganisation.findFirst({
      where: {
        userId: userOrganisationBlockId,
      },
      include: {
        user: {
          select: {
            status: true,
          },
        },
      },
    });
    if (existingUser && existingUser.role == UserRoleEnum.ADMINISTRATOR) {
      // Update the user status to INACTIVE
      await tx.user.update({
        data: {
          status: UserStatusEnum.INACTIVE,
          projectAssignUsers: {
            updateMany: {
              where: {
                assginedToUserId: userOrganisationBlockId,
              },
              data: {
                projectRole: UserRoleEnum.TEAM_MEMBER,
              },
            },
          },
        },
        where: { userId: userOrganisationBlockId },
      });

      // Update the user role and status to ADMINISTRATOR and ACTIVE
      await tx.userOrganisation.update({
        where: { organisationId, userOrganisationId: reassginAdministratorId },
        data: {
          role: UserRoleEnum.ADMINISTRATOR,
          user: {
            update: {
              status: UserStatusEnum.ACTIVE,
              projectAssignUsers: {
                updateMany: {
                  where: { assginedToUserId: findUserOrg.userId },
                  data: {
                    projectRole: UserRoleEnum.ADMINISTRATOR,
                  },
                },
              },
            },
          },
        },
      });
    } else {
      if (
        findUserOrg.user?.status === UserStatusEnum.INACTIVE &&
        findUserOrg.role === UserRoleEnum.ADMINISTRATOR
      ) {
        throw new BadRequestError("Administrator can't be active again");
      }
      // Update the user status to INACTIVE
      await tx.user.update({
        data: {
          status: UserStatusEnum.INACTIVE,
        },
        where: { userId: userOrganisationBlockId },
      });
      // Update the user role and status to ADMINISTRATOR and ACTIVE
      await tx.userOrganisation.update({
        where: { organisationId, userOrganisationId: reassginAdministratorId },
        data: {
          role: UserRoleEnum.ADMINISTRATOR,
          user: {
            update: {
              status: UserStatusEnum.ACTIVE,
            },
          },
        },
      });
    }
  });

  return new SuccessResponse(
    StatusCodes.OK,
    null,
    "Administrator reassgined successfully"
  ).send(res);
};

export const otpVerifyConsole = async (
  req: express.Request,
  res: express.Response
) => {
  const { otp } = verifyEmailOtpSchema.parse(req.body);
  const checkOtp = await OtpService.verifyOTPForConsole(
    otp,
    req.userId!,
    req.tenantId
  );
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
  const user = await prisma.consoleUser.findFirst({
    where: {
      userId: req.userId,
      deletedAt: null,
    },
  });
  if (!user) {
    throw new NotFoundError("User not found");
  }
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

export const changeOrgAdministator = async (
  req: express.Request,
  res: express.Response
) => {
  if (!req.userId) {
    throw new BadRequestError("userId not found!!");
  }
  const prisma = await getClientByTenantId(req.tenantId);
  await prisma.$transaction(async (tx) => {
    const {
      organisationId,
      addUserAsAdministratorId,
      removeUserAsAdministartor,
    } = changeAdministatorSchema.parse(req.body);

    // Remove as ADMINISTRATOR
    await tx.userOrganisation.update({
      where: { organisationId, userOrganisationId: removeUserAsAdministartor },
      data: {
        role: UserRoleEnum.PROJECT_MANAGER,
      },
    });

    // Add as ADMINISTRATOR
    await tx.userOrganisation.update({
      where: { organisationId, userOrganisationId: addUserAsAdministratorId },
      data: {
        role: UserRoleEnum.ADMINISTRATOR,
      },
    });
  });

  return new SuccessResponse(
    StatusCodes.OK,
    null,
    "Administrator changed successfully"
  ).send(res);
};
