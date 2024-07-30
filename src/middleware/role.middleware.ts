import express from "express";
import { getClientByTenantId } from "../config/db.js";
import { UserRoleEnum } from "@prisma/client";
import { BadRequestError, UnAuthorizedError } from "../config/apiError.js";

export const roleMiddleware = (allowedRoles: string[]) => {
  return async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    if (!req.userId) {
      throw new BadRequestError("userId not found!!");
    }
    const prisma = await getClientByTenantId(req.tenantId);
    const userRoles = await prisma.user.getUserRoles(req.userId);
    const newRole = await prisma.user.getUserRoleBasedOnProject(req.userId);

    let rolesToCheck: UserRoleEnum[] = [];

    if (userRoles !== null) {
      rolesToCheck.push(
        ...(userRoles.filter((role) => role !== null) as UserRoleEnum[])
      );
    }
    if (newRole !== null) {
      rolesToCheck.push(
        ...(newRole.filter((role) => role !== null) as UserRoleEnum[])
      );
    }

    const hasAccess = allowedRoles.some((role) =>
      rolesToCheck.includes(role as UserRoleEnum)
    );
    if (!newRole && !hasAccess) {
      throw new UnAuthorizedError();
    }
    req.role = rolesToCheck[0]; //User role
    next();
  };
};

export const taskUpdateOrDelete = async (
  taskId: string,
  role: string,
  userId: string,
  tenantId: string
) => {
  const prisma = await getClientByTenantId(tenantId);
  const findtask = await prisma.task.findFirstOrThrow({
    where: {
      taskId,
      deletedAt: null,
    },
    include: {
      documentAttachments: true,
      assignedUsers: true,
      subtasks: true,
      dependencies: {
        where: { deletedAt: null },
        include: {
          dependentOnTask: true,
        },
      },
    },
  });
  const isCreatedByuser = findtask.createdByUserId === userId;
  const isAssignedUserToTask = findtask.assignedUsers.some(
    (assignedUser) => assignedUser.assginedToUserId == userId
  );
  const hasAccessIf =
    isUserAdminOrPm(role) || isCreatedByuser || isAssignedUserToTask;

  return { hasAccessIf, findtask };
};

export const commentEditorDelete = async (
  commentId: string,
  role: string,
  userId: string,
  tenantId: string
) => {
  const prisma = await getClientByTenantId(tenantId);
  const findComment = await prisma.comments.findFirstOrThrow({
    where: { commentId, deletedAt: null },
    include: {
      commentByUser: true,
    },
  });
  const isCreatedByuser = findComment.commentByUserId === userId;

  const hasAccessIf = isUserAdminOrPm(role) || isCreatedByuser;
  return { hasAccessIf, findComment };
};

export const attachmentAddOrRemove = async (
  taskId: string,
  role: string,
  userId: string,
  tenantId: string,
  type: "Add" | "Delete"
) => {
  const prisma = await getClientByTenantId(tenantId);
  if (type === "Add") {
    const findTask = await prisma.task.getTaskById(taskId);
    const isAssignedToTask = findTask.assignedUsers.some(
      (assignedUser) => assignedUser.assginedToUserId === userId
    );
    const isAttachmentAuthor = findTask.createdByUserId === userId;
    const hasAccessIf =
      isUserAdminOrPm(role) || isAssignedToTask || isAttachmentAuthor;
    return { hasAccessIf, findTask };
  } else {
    const findAttchment = await prisma.taskAttachment.findFirstOrThrow({
      where: { attachmentId: taskId, deletedAt: null },
      include: {
        task: {
          include: {
            assignedUsers: {
              where: { deletedAt: null },
              include: {
                user: true,
              },
            },
          },
        },
      },
    });
    const isAttachmentAuthor = findAttchment.uploadedBy === userId;
    const hasAccessIf = isUserAdminOrPm || isAttachmentAuthor;
    return { hasAccessIf, findAttchment };
  }
};

export const dependenciesAddOrRemove = async (
  taskId: string,
  role: string,
  userId: string,
  tenantId: string,
  type: "Add" | "Delete"
) => {
  const prisma = await getClientByTenantId(tenantId);
  if (type === "Add") {
    const findTask = await prisma.task.getTaskById(taskId);
    const isAssignedToTask = findTask.assignedUsers.some(
      (assignedUser) => assignedUser.assginedToUserId === userId
    );
    const isDependenciesAuthor = findTask.createdByUserId === userId;
    const hasAccessIf =
      isUserAdminOrPm(role) || isAssignedToTask || isDependenciesAuthor;
    return { hasAccessIf, findTask };
  } else {
    const dependencies = await prisma.taskDependencies.findFirstOrThrow({
      where: {
        taskDependenciesId: taskId,
        deletedAt: null,
      },
    });
    const isDependenciesAuthor = dependencies.dependenciesAddedBy === userId;
    const hasAccessIf = isUserAdminOrPm || isDependenciesAuthor;
    return { hasAccessIf, dependencies };
  }
};

const isUserAdminOrPm = (role: string): boolean => {
  const allowedRoles: UserRoleEnum[] = [
    UserRoleEnum.ADMINISTRATOR,
    UserRoleEnum.PROJECT_MANAGER,
  ];
  return allowedRoles.includes(role as UserRoleEnum);
};
