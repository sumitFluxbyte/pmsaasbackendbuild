import { StatusCodes } from "http-status-codes";
import { NotificationTypeEnum, ProjectStatusEnum, TaskStatusEnum, UserRoleEnum, UserStatusEnum, } from "@prisma/client";
import { getClientByTenantId } from "../config/db.js";
import { BadRequestError, SuccessResponse } from "../config/apiError.js";
import { addUserIntoProject, consumedBudgetSchema, createKanbanSchema, createProjectSchema, projectAssginedRole, projectIdSchema, projectJobTitleSchema, projectStatusSchema, updateKanbanSchema, updateProjectSchema, } from "../schemas/projectSchema.js";
import { uuidSchema } from "../schemas/commonSchema.js";
import { selectUserFields } from "../utils/selectedFieldsOfUsers.js";
import { calculateProjectDuration } from "../utils/calculateProjectDuration.js";
import { generateOTP } from "../utils/otpHelper.js";
import { ProjectStatusEnumValue, TaskStatusEnumValue, } from "../schemas/enums.js";
export const getProjects = async (req, res) => {
    if (!req.organisationId) {
        throw new BadRequestError("organisationId not found!");
    }
    const prisma = await getClientByTenantId(req.tenantId);
    let projects;
    let role = req.role;
    if (!role) {
        return new SuccessResponse(StatusCodes.OK, [], "get all project successfully").send(res);
    }
    if (role === UserRoleEnum.PROJECT_MANAGER) {
        projects = await prisma.project.findMany({
            where: {
                OR: [
                    {
                        organisationId: req.organisationId,
                        deletedAt: null,
                        assignedUsers: {
                            some: {
                                assginedToUserId: req.userId,
                            },
                        },
                    },
                    {
                        createdByUserId: req.userId,
                        deletedAt: null,
                    },
                ],
            },
            include: {
                tasks: true,
                createdByUser: {
                    select: {
                        firstName: true,
                        lastName: true,
                        email: true,
                        avatarImg: true,
                    },
                },
                organisation: {
                    include: {
                        userOrganisation: {
                            include: {
                                user: true,
                            },
                        },
                    },
                },
                assignedUsers: {
                    where: {
                        user: {
                            deletedAt: null,
                        },
                    },
                    include: {
                        user: {
                            include: {
                                userOrganisation: {
                                    where: { deletedAt: null },
                                    select: {
                                        role: true,
                                        userOrganisationId: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });
    }
    else if (role === UserRoleEnum.TEAM_MEMBER) {
        projects = await prisma.project.findMany({
            where: {
                organisationId: req.organisationId,
                deletedAt: null,
                assignedUsers: {
                    some: {
                        assginedToUserId: req.userId,
                    },
                },
            },
            include: {
                tasks: true,
                createdByUser: {
                    select: {
                        firstName: true,
                        lastName: true,
                        email: true,
                        avatarImg: true,
                    },
                },
                organisation: {
                    include: {
                        userOrganisation: {
                            include: {
                                user: true,
                            },
                        },
                    },
                },
                assignedUsers: {
                    where: {
                        user: {
                            deletedAt: null,
                        },
                    },
                    include: {
                        user: {
                            include: {
                                userOrganisation: {
                                    where: { deletedAt: null },
                                    select: {
                                        role: true,
                                        userOrganisationId: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });
    }
    else {
        projects = await prisma.project.findMany({
            where: {
                organisationId: req.organisationId,
                deletedAt: null,
            },
            include: {
                tasks: true,
                createdByUser: {
                    select: {
                        firstName: true,
                        lastName: true,
                        email: true,
                        avatarImg: true,
                    },
                },
                organisation: {
                    include: {
                        userOrganisation: {
                            include: {
                                user: true,
                            },
                        },
                    },
                },
                assignedUsers: {
                    where: {
                        user: {
                            deletedAt: null,
                        },
                    },
                    include: {
                        user: {
                            include: {
                                userOrganisation: {
                                    where: { deletedAt: null },
                                    select: {
                                        role: true,
                                        userOrganisationId: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });
    }
    // progressionPercentage for all projects
    const projectsWithProgression = [];
    for (const project of projects) {
        const progressionPercentage = await prisma.project.projectProgression(project.projectId, req.tenantId, req.organisationId);
        const actualDuration = project.tasks.length != 0 && project.actualEndDate
            ? await calculateProjectDuration(project.startDate, project.actualEndDate, req.tenantId, req.organisationId)
            : 0;
        const estimatedDuration = project.estimatedEndDate
            ? await calculateProjectDuration(project.startDate, project.estimatedEndDate, req.tenantId, req.organisationId)
            : null;
        const actualEndDate = project.tasks.length === 0 ? null : project.actualEndDate;
        const projectWithProgression = {
            ...project,
            progressionPercentage,
            actualDuration,
            estimatedDuration,
            actualEndDate,
        };
        projectsWithProgression.push(projectWithProgression);
    }
    return new SuccessResponse(StatusCodes.OK, projectsWithProgression, "get all project successfully").send(res);
};
export const getProjectById = async (req, res) => {
    if (!req.organisationId) {
        throw new BadRequestError("organisationId not found!");
    }
    const projectId = projectIdSchema.parse(req.params.projectId);
    const prisma = await getClientByTenantId(req.tenantId);
    const projects = await prisma.project.findFirstOrThrow({
        where: {
            organisationId: req.organisationId,
            projectId: projectId,
            deletedAt: null,
        },
        include: {
            tasks: {
                where: { deletedAt: null },
            },
            createdByUser: {
                select: selectUserFields,
            },
            assignedUsers: {
                where: {
                    user: {
                        deletedAt: null,
                        status: UserStatusEnum.ACTIVE,
                    },
                },
                include: {
                    user: {
                        include: {
                            userOrganisation: {
                                where: { deletedAt: null },
                                select: {
                                    role: true,
                                    jobTitle: true,
                                },
                            },
                        },
                    },
                },
            },
        },
    });
    const actualDuration = projects.tasks.length != 0 && projects.actualEndDate
        ? await calculateProjectDuration(projects.startDate, projects.actualEndDate, req.tenantId, req.organisationId)
        : 0;
    const progressionPercentage = await prisma.project.projectProgression(projectId, req.tenantId, req.organisationId);
    const estimatedDuration = projects.estimatedEndDate
        ? await calculateProjectDuration(projects.startDate, projects.estimatedEndDate, req.tenantId, req.organisationId)
        : null;
    const actualEndDate = projects.tasks.length === 0 ? null : projects.actualEndDate;
    const response = {
        ...projects,
        progressionPercentage,
        actualDuration,
        estimatedDuration,
        actualEndDate,
    };
    return new SuccessResponse(StatusCodes.OK, response, "project selected").send(res);
};
export const createProject = async (req, res) => {
    if (!req.organisationId) {
        throw new BadRequestError("organisationId not found!");
    }
    if (!req.userId) {
        throw new BadRequestError("userId not found!");
    }
    const { projectName, projectDescription, startDate, estimatedEndDate, estimatedBudget, defaultView, currency, } = createProjectSchema.parse(req.body);
    const prisma = await getClientByTenantId(req.tenantId);
    const findProject = await prisma.project.findFirst({
        where: {
            organisationId: req.organisationId,
            projectName,
        },
    });
    if (findProject) {
        throw new BadRequestError("A project with a similar name already exists!");
    }
    const project = await prisma.project.create({
        data: {
            organisationId: req.organisationId,
            projectName: projectName,
            projectDescription: projectDescription,
            startDate: startDate,
            estimatedEndDate: estimatedEndDate,
            actualEndDate: estimatedEndDate ? estimatedEndDate : null,
            status: ProjectStatusEnum.NOT_STARTED,
            estimatedBudget: estimatedBudget ? estimatedBudget : "0",
            defaultView: defaultView,
            createdByUserId: req.userId,
            updatedByUserId: req.userId,
            currency: currency,
            assignedUsers: {
                create: {
                    assginedToUserId: req.userId,
                    projectRole: UserRoleEnum.ADMINISTRATOR,
                },
            },
            kanbanColumns: {
                create: {
                    name: "Backlog",
                    percentage: null,
                    createdByUserId: req.userId,
                },
            },
        },
    });
    return new SuccessResponse(StatusCodes.CREATED, project, "project created successfully").send(res);
};
export const deleteProject = async (req, res) => {
    if (!req.organisationId) {
        throw new BadRequestError("organisationId not found!");
    }
    const projectId = projectIdSchema.parse(req.params.projectId);
    const prisma = await getClientByTenantId(req.tenantId);
    const findProject = await prisma.project.findFirstOrThrow({
        where: {
            projectId: projectId,
            organisationId: req.organisationId,
            deletedAt: null,
        },
        include: {
            tasks: true,
        },
    });
    const otpValue = generateOTP();
    const deletedProjects = await prisma.project.update({
        where: { projectId },
        data: {
            deletedAt: new Date(),
            projectName: `${findProject.projectName}_deleted_${otpValue}`,
            assignedUsers: {
                deleteMany: {
                    projectId,
                },
            },
        },
    });
    if (deletedProjects && findProject.tasks) {
        try {
            const taskDeletedUpdated = findProject.tasks.map(async (task) => {
                const updatedTask = await prisma.task.update({
                    where: { taskId: task.taskId },
                    data: {
                        deletedAt: new Date(),
                        taskName: `${task.taskName}_deleted_${otpValue}`,
                        assignedUsers: {
                            deleteMany: {
                                taskId: task.taskId,
                            },
                        },
                    },
                });
            });
            await Promise.all(taskDeletedUpdated);
        }
        catch (error) {
            console.error("Error while deleting task", error);
        }
    }
    return new SuccessResponse(StatusCodes.OK, null, "project deleted successfully").send(res);
};
export const updateProject = async (req, res) => {
    if (!req.organisationId) {
        throw new BadRequestError("organisationId not found!");
    }
    if (!req.userId) {
        throw new BadRequestError("userId not found!");
    }
    const projectUpdateValue = updateProjectSchema.parse(req.body);
    const projectId = projectIdSchema.parse(req.params.projectId);
    const prisma = await getClientByTenantId(req.tenantId);
    if (projectUpdateValue &&
        projectUpdateValue.status &&
        projectUpdateValue.status === ProjectStatusEnum.CLOSED) {
        const findTaskWithIncompleteTask = await prisma.task.count({
            where: {
                projectId: projectId,
                deletedAt: null,
                status: {
                    in: [TaskStatusEnum.NOT_STARTED, TaskStatusEnum.IN_PROGRESS],
                },
            },
        });
        if (findTaskWithIncompleteTask > 0) {
            throw new BadRequestError("Incomplete tasks exists!");
        }
    }
    let updateObj = { ...projectUpdateValue, updatedByUserId: req.userId };
    const projectUpdate = await prisma.project.update({
        where: { projectId },
        data: updateObj,
    });
    return new SuccessResponse(StatusCodes.OK, projectUpdate, "project updated successfully").send(res);
};
export const getKanbanColumnById = async (req, res) => {
    const projectId = uuidSchema.parse(req.params.projectId);
    const prisma = await getClientByTenantId(req.tenantId);
    const updatedKanban = await prisma.kanbanColumn.findMany({
        where: { projectId, deletedAt: null },
    });
    return new SuccessResponse(StatusCodes.OK, updatedKanban, "kanban column selected").send(res);
};
export const statusChangeProject = async (req, res) => {
    if (!req.organisationId) {
        throw new BadRequestError("organisationId not found!");
    }
    if (!req.userId) {
        throw new BadRequestError("userId not found!");
    }
    const { status } = projectStatusSchema.parse(req.body);
    const projectId = projectIdSchema.parse(req.params.projectId);
    const prisma = await getClientByTenantId(req.tenantId);
    const findProject = await prisma.project.findFirstOrThrow({
        where: {
            projectId: projectId,
            organisationId: req.organisationId,
            deletedAt: null,
        },
    });
    if (status === ProjectStatusEnum.CLOSED) {
        const findTaskWithIncompleteTask = await prisma.task.count({
            where: {
                projectId: projectId,
                deletedAt: null,
                status: {
                    in: [TaskStatusEnum.NOT_STARTED, TaskStatusEnum.IN_PROGRESS],
                },
            },
        });
        if (findTaskWithIncompleteTask > 0) {
            throw new BadRequestError("Incomplete tasks exists!");
        }
    }
    const updateProject = await prisma.project.update({
        where: { projectId: projectId },
        data: { status: status, updatedByUserId: req.userId },
    });
    return new SuccessResponse(StatusCodes.OK, updateProject, "project status change successfully").send(res);
};
export const createKanbanColumn = async (req, res) => {
    if (!req.userId) {
        throw new BadRequestError("userId not found!");
    }
    const projectId = uuidSchema.parse(req.params.projectId);
    const { name, percentage } = createKanbanSchema.parse(req.body);
    const prisma = await getClientByTenantId(req.tenantId);
    const kanbanColumn = await prisma.kanbanColumn.create({
        data: {
            projectId,
            name,
            percentage,
            createdByUserId: req.userId,
        },
    });
    return new SuccessResponse(StatusCodes.CREATED, kanbanColumn, "kanban column created successfully").send(res);
};
export const updatekanbanColumn = async (req, res) => {
    if (!req.userId) {
        throw new BadRequestError("userId not found!");
    }
    const kanbanColumnId = uuidSchema.parse(req.params.kanbanColumnId);
    const kanbanColumnUpdateValue = updateKanbanSchema.parse(req.body);
    const prisma = await getClientByTenantId(req.tenantId);
    let updateObj = { ...kanbanColumnUpdateValue, updatedByUserId: req.userId };
    const kanbanColumnUpdate = await prisma.kanbanColumn.update({
        where: { kanbanColumnId },
        data: updateObj,
    });
    return new SuccessResponse(StatusCodes.OK, kanbanColumnUpdate, "kanban column updated successfully").send(res);
};
export const deleteKanbanColumn = async (req, res) => {
    if (!req.userId) {
        throw new BadRequestError("userId not found!");
    }
    const kanbanColumnId = uuidSchema.parse(req.params.kanbanColumnId);
    const prisma = await getClientByTenantId(req.tenantId);
    await prisma.kanbanColumn.update({
        where: { kanbanColumnId },
        data: {
            deletedAt: new Date(),
        },
    });
    return new SuccessResponse(StatusCodes.OK, null, "kanban column deleted successfully").send(res);
};
export const addConsumedBudgetToProject = async (req, res) => {
    if (!req.userId) {
        throw new BadRequestError("userId not found!");
    }
    const projectId = uuidSchema.parse(req.params.projectId);
    const { consumedBudget } = consumedBudgetSchema.parse(req.body);
    const prisma = await getClientByTenantId(req.tenantId);
    const projectUpdate = await prisma.project.update({
        where: { projectId: projectId },
        data: {
            consumedBudget,
        },
    });
    return new SuccessResponse(StatusCodes.OK, projectUpdate, "consumed budget updated successfully").send(res);
};
export const deleteAssignedUserFromProject = async (req, res) => {
    if (!req.userId) {
        throw new BadRequestError("userId not found!!");
    }
    const projectAssignUsersId = uuidSchema.parse(req.params.projectAssignUsersId);
    const prisma = await getClientByTenantId(req.tenantId);
    const findUser = await prisma.projectAssignUsers.findFirstOrThrow({
        where: {
            projectAssignUsersId,
        },
    });
    const findAssignedTask = await prisma.task.findMany({
        where: {
            deletedAt: null,
            projectId: findUser.projectId,
            status: {
                notIn: [TaskStatusEnum.COMPLETED],
            },
            assignedUsers: {
                some: {
                    deletedAt: null,
                    assginedToUserId: findUser.assginedToUserId,
                },
            },
        },
    });
    if (findAssignedTask.length > 0) {
        throw new BadRequestError("There are ongoing task that assigned to user!");
    }
    await prisma.$transaction([
        prisma.projectAssignUsers.delete({
            where: {
                projectAssignUsersId,
            },
        }),
        prisma.taskAssignUsers.deleteMany({
            where: {
                assginedToUserId: findUser.assginedToUserId,
            },
        }),
    ]);
    return new SuccessResponse(StatusCodes.OK, null, "User removed successfully").send(res);
};
export const duplicateProjectAndAllItsTask = async (req, res) => {
    if (!req.userId) {
        throw new BadRequestError("UserId not found!!");
    }
    const projectId = uuidSchema.parse(req.params.projectId);
    const prisma = await getClientByTenantId(req.tenantId);
    const project = await prisma.project.findFirstOrThrow({
        where: { projectId, deletedAt: null },
        include: {
            tasks: {
                where: { parentTaskId: null },
                include: {
                    documentAttachments: true,
                    subtasks: {
                        include: {
                            subtasks: true,
                            documentAttachments: true,
                        },
                    },
                },
            },
        },
    });
    const generateUniqueProjectName = async (name) => {
        let newName = name;
        let counter = 1;
        while (true) {
            const existingProject = await prisma.project.findFirst({
                where: { projectName: newName },
            });
            if (!existingProject) {
                return newName;
            }
            newName = `${name}_${counter}`;
            counter++;
        }
    };
    const { tasks, projectId: _, ...infoWithoutProjectId } = project;
    const duplicatedProjectName = await generateUniqueProjectName(project.projectName);
    const duplicatedProject = await prisma.project.create({
        data: {
            ...infoWithoutProjectId,
            projectName: duplicatedProjectName,
            actualEndDate: infoWithoutProjectId.estimatedEndDate
                ? infoWithoutProjectId.estimatedEndDate
                : null,
            estimatedBudget: infoWithoutProjectId.estimatedBudget
                ? infoWithoutProjectId.estimatedBudget
                : "0",
            status: ProjectStatusEnumValue.NOT_STARTED,
            assignedUsers: {
                create: {
                    assginedToUserId: req.userId,
                    projectRole: UserRoleEnum.ADMINISTRATOR,
                },
            },
            kanbanColumns: {
                create: {
                    name: "Backlog",
                    percentage: null,
                    createdByUserId: req.userId,
                },
            },
        },
    });
    if (duplicatedProject && project.tasks.length > 0) {
        await Promise.all(project.tasks.map(async (task) => {
            const { taskId, subtasks, documentAttachments, ...taskWithoutId } = task;
            if (task && task.parentTaskId == null) {
                const taskOneInsert = await prisma.task.create({
                    data: {
                        ...taskWithoutId,
                        projectId: duplicatedProject.projectId,
                        taskName: `${task.taskName}_1`,
                        parentTaskId: null,
                        completionPecentage: 0,
                        status: TaskStatusEnumValue.NOT_STARTED,
                    },
                });
                if (taskOneInsert && task.documentAttachments.length > 0) {
                    for (const doc of documentAttachments) {
                        await prisma.taskAttachment.create({
                            data: {
                                taskId: taskOneInsert.taskId,
                                url: doc.url,
                                name: doc.name,
                                uploadedBy: doc.uploadedBy,
                            },
                        });
                    }
                }
                if (taskOneInsert && task.subtasks.length > 0) {
                    await Promise.all(task.subtasks.map(async (secondsubtask) => {
                        const { taskId, subtasks, documentAttachments, ...subtaskWithoutId } = secondsubtask;
                        const secondSubTaskInsert = await prisma.task.create({
                            data: {
                                ...subtaskWithoutId,
                                projectId: duplicatedProject.projectId,
                                taskName: `${secondsubtask.taskName}_1`,
                                parentTaskId: taskOneInsert.taskId,
                                completionPecentage: 0,
                                status: TaskStatusEnumValue.NOT_STARTED,
                            },
                        });
                        if (secondSubTaskInsert &&
                            secondsubtask.documentAttachments.length > 0) {
                            for (const doc of documentAttachments) {
                                await prisma.taskAttachment.create({
                                    data: {
                                        taskId: secondSubTaskInsert.taskId,
                                        url: doc.url,
                                        name: doc.name,
                                        uploadedBy: doc.uploadedBy,
                                    },
                                });
                            }
                        }
                        if (secondSubTaskInsert && secondsubtask.subtasks.length > 0) {
                            await Promise.all(secondsubtask.subtasks.map(async (thirdSubTask) => {
                                const { taskId, ...subtaskWithoutId } = thirdSubTask;
                                const thirdSubTaskInsert = await prisma.task.create({
                                    data: {
                                        ...subtaskWithoutId,
                                        projectId: duplicatedProject.projectId,
                                        taskName: `${thirdSubTask.taskName}_1`,
                                        parentTaskId: secondSubTaskInsert.taskId,
                                        completionPecentage: 0,
                                        status: TaskStatusEnumValue.NOT_STARTED,
                                    },
                                });
                                if (thirdSubTaskInsert &&
                                    secondsubtask.documentAttachments.length > 0) {
                                    for (const doc of documentAttachments) {
                                        await prisma.taskAttachment.create({
                                            data: {
                                                taskId: thirdSubTaskInsert.taskId,
                                                url: doc.url,
                                                name: doc.name,
                                                uploadedBy: doc.uploadedBy,
                                            },
                                        });
                                    }
                                }
                            }));
                        }
                    }));
                }
            }
        }));
    }
    return new SuccessResponse(StatusCodes.OK, duplicatedProject, "Project and tasks duplicated successfully.").send(res);
};
export const updateProjectRole = async (req, res) => {
    const projectAssignUsersId = uuidSchema.parse(req.params.projectAssignUsersId);
    const { role } = projectAssginedRole.parse(req.body);
    const prisma = await getClientByTenantId(req.tenantId);
    const updateRole = await prisma.projectAssignUsers.update({
        where: { projectAssignUsersId },
        data: {
            projectRole: role,
        },
    });
    return new SuccessResponse(StatusCodes.OK, updateRole, "Role updated successfully.").send(res);
};
export const userAssignIntoProject = async (req, res) => {
    if (!req.userId) {
        throw new BadRequestError("userId not found!!");
    }
    const prisma = await getClientByTenantId(req.tenantId);
    const projectId = uuidSchema.parse(req.params.projectId);
    const projectAssginedToUser = addUserIntoProject.parse(req.body);
    for (const { userId, userRoleForProject } of projectAssginedToUser) {
        const findProjectAssginedToUser = await prisma.projectAssignUsers.findFirst({
            where: {
                projectId,
                assginedToUserId: userId,
            },
        });
        if (!findProjectAssginedToUser) {
            const addMemberToProject = await prisma.projectAssignUsers.create({
                data: {
                    assginedToUserId: userId,
                    projectId: projectId,
                    projectRole: userRoleForProject,
                },
                include: {
                    user: {
                        select: {
                            email: true,
                        },
                    },
                    project: {
                        select: {
                            projectName: true,
                            projectId: true,
                        },
                    },
                },
            });
            //Send notification
            const message = `${addMemberToProject.project.projectName} assigned to you`;
            await prisma.notification.sendNotification(NotificationTypeEnum.PROJECT, message, userId, req.userId, projectId);
        }
    }
    return new SuccessResponse(StatusCodes.OK, null, "Project assgined successfully.").send(res);
};
export const updateProjectJobTitle = async (req, res) => {
    const projectAssignUsersId = uuidSchema.parse(req.params.projectAssignUsersId);
    const { projectJobTitle } = projectJobTitleSchema.parse(req.body);
    const prisma = await getClientByTenantId(req.tenantId);
    const updateRole = await prisma.projectAssignUsers.update({
        where: { projectAssignUsersId },
        data: {
            projectJobTitle: projectJobTitle,
        },
    });
    return new SuccessResponse(StatusCodes.OK, updateRole, "Job title updated successfully.").send(res);
};
