import { Task, TaskDependenciesEnum, TaskStatusEnum } from "@prisma/client";
import { getClientByTenantId } from "../config/db.js";
import { getNextWorkingDay, taskEndDate } from "./calcualteTaskEndDate.js";
import {
  calculateDurationAndPercentage,
  updateSubtasksDependencies,
} from "./taskRecursion.js";
import { BadRequestError } from "../config/apiError.js";

export const dependenciesManage = async (
  tenantId: string,
  organisationId: string,
  taskId: string,
  endDateCurr: Date,
  userId: string
) => {
  const prisma = await getClientByTenantId(tenantId);
  const findTask = await prisma.task.findFirst({
    where: { taskId, deletedAt: null },
    include: {
      parent: true,
      subtasks: true,
      dependencies: {
        where: { deletedAt: null },
        include: {
          dependentOnTask: true,
        },
      },
    },
  });
  const endDate = await getNextWorkingDay(
    endDateCurr,
    tenantId,
    organisationId
  );

  if (findTask && findTask.dependencies.length > 0) {
    const taskUpdateDB = await prisma.task.update({
      where: { taskId: findTask.taskId },
      data: {
        startDate: new Date(endDate),
        updatedByUserId: userId,
      },
      include: {
        documentAttachments: true,
        assignedUsers: true,
        dependencies: {
          include: {
            dependentOnTask: true,
          },
        },
        project: true,
        parent: true,
        subtasks: true,
      },
    });
    const endDateOfOne = await taskEndDate(
      taskUpdateDB,
      tenantId,
      organisationId
    );
    for (let task of taskUpdateDB.subtasks) {
      await updateSubtasksDependencies(task.taskId, endDate, userId, tenantId);
    }
    if (taskUpdateDB.parent?.taskId) {
      await calculateDurationAndPercentage(
        taskUpdateDB.parent?.taskId,
        tenantId,
        organisationId
      );
    }
    if (taskUpdateDB.dependencies && taskUpdateDB.dependencies.length > 0) {
      for (let singleTask of taskUpdateDB.dependencies) {
        if (singleTask.dependentType === TaskDependenciesEnum.SUCCESSORS) {
          await dependenciesManage(
            tenantId,
            organisationId,
            singleTask.dependendentOnTaskId,
            new Date(endDateOfOne),
            userId
          );
        }
      }
    }
  }
  return;
};

export const addDependenciesHelper = async (
  taskId: string,
  dependendentOnTaskId: string,
  tenantId: string,
  organisationId: string,
  userId: string,
  dependentType: TaskDependenciesEnum
) => {
  const prisma = await getClientByTenantId(tenantId);
  const latestTask = await prisma.task.findFirstOrThrow({
    where: { taskId: taskId, deletedAt: null },
    include: {
      subtasks: {
        where: { deletedAt: null },
        include: {
          subtasks: {
            where: { deletedAt: null },
            include: {
              subtasks: true,
            },
          },
        },
      },
      dependencies: {
        where: { deletedAt: null },
        include: {
          dependentOnTask: true,
        },
      },
    },
  });
  const dependencyOnTask = await prisma.task.findFirstOrThrow({
    where: { taskId: dependendentOnTaskId, deletedAt: null },
    include: {
      subtasks: {
        where: { deletedAt: null },
        include: {
          subtasks: {
            where: { deletedAt: null },
            include: {
              subtasks: true,
            },
          },
        },
      },
      dependencies: {
        where: { deletedAt: null },
        include: {
          dependentOnTask: true,
        },
      },
    },
  });
  if (
    dependentType == TaskDependenciesEnum.SUCCESSORS &&
    dependencyOnTask &&
    (dependencyOnTask.status == TaskStatusEnum.IN_PROGRESS ||
      dependencyOnTask.status == TaskStatusEnum.COMPLETED)
  ) {
    throw new BadRequestError(
      "You're unable to designate an ongoing or completed task as a successor in an end to start dependency."
    );
  }
  if (dependentType === TaskDependenciesEnum.PREDECESSORS) {
    await detectCycleInDependency(
      dependendentOnTaskId,
      tenantId,
      organisationId,
      taskId
    );
  } else {
    await detectCycleInDependency(
      taskId,
      tenantId,
      organisationId,
      dependendentOnTaskId
    );
  }
  const endDatePredecesssor = await taskEndDate(
    dependencyOnTask,
    tenantId,
    organisationId
  );
  const endDateDependentTask = await getNextWorkingDay(
    new Date(endDatePredecesssor),
    tenantId,
    organisationId
  );
  const getMaxEndDateOfSuccessforDependentTask = async (taskId: string) => {
    let maxdate: any | Date;
    // Get all dependencies of the latest task in one go
    const allDependenciesExisted = await prisma.task.findMany({
      where: {
        taskId,
        deletedAt: null,
      },
      include: {
        subtasks: {
          where: { deletedAt: null },
          include: {
            subtasks: {
              where: { deletedAt: null },
              include: {
                subtasks: true,
              },
            },
          },
        },
        dependencies: {
          where: { deletedAt: null },
          include: {
            dependentOnTask: true,
          },
        },
      },
    });
    const existedDependenciesEndDates = await Promise.all(
      allDependenciesExisted.map((task1) => {
        maxdate = task1.startDate;
        return taskEndDate(task1, tenantId, organisationId);
      })
    );
    for (const endDate1 of existedDependenciesEndDates) {
      if (maxdate && new Date(maxdate) < new Date(endDate1)) {
        maxdate = new Date(endDate1);
      }
    }
    return maxdate!;
  };
  const endDateSuccessorDependentTask = await getNextWorkingDay(
    new Date(await getMaxEndDateOfSuccessforDependentTask(latestTask.taskId)),
    tenantId,
    organisationId
  );
  let addDependencies1: any;
  let addDependencies2: any;
  if (dependentType == TaskDependenciesEnum.PREDECESSORS) {
    const [value1, value2] = await prisma.$transaction([
      prisma.taskDependencies.create({
        data: {
          dependentType: dependentType,
          dependentTaskId: taskId,
          dependendentOnTaskId: dependendentOnTaskId,
          dependenciesAddedBy: userId,
        },
        include: {
          dependentOnTask: {
            select: {
              taskName: true,
            },
          },
        },
      }),
      prisma.taskDependencies.create({
        data: {
          dependentType: TaskDependenciesEnum.SUCCESSORS,
          dependentTaskId: dependendentOnTaskId,
          dependendentOnTaskId: taskId,
          dependenciesAddedBy: userId,
        },
        include: {
          dependentOnTask: {
            select: {
              taskName: true,
            },
          },
        },
      }),
    ]);
    addDependencies1 = value1;
    addDependencies2 = value2;
    await helper(
      taskId,
      tenantId,
      organisationId,
      userId,
      endDateDependentTask
    );
  } else {
    const [value1, value2] = await prisma.$transaction([
      prisma.taskDependencies.create({
        data: {
          dependentType: dependentType,
          dependentTaskId: taskId,
          dependendentOnTaskId: dependendentOnTaskId,
          dependenciesAddedBy: userId,
        },
        include: {
          dependentOnTask: {
            select: {
              taskName: true,
            },
          },
        },
      }),
      prisma.taskDependencies.create({
        data: {
          dependentType: TaskDependenciesEnum.PREDECESSORS,
          dependentTaskId: dependendentOnTaskId,
          dependendentOnTaskId: taskId,
          dependenciesAddedBy: userId,
        },
        include: {
          dependentOnTask: {
            select: {
              taskName: true,
            },
          },
        },
      }),
    ]);
    addDependencies1 = value1;
    addDependencies2 = value2;
    await helper(
      dependendentOnTaskId,
      tenantId,
      organisationId,
      userId,
      endDateSuccessorDependentTask
    );
  }
  if (dependentType == TaskDependenciesEnum.SUCCESSORS) {
    const dependantTask = await prisma.task.findFirstOrThrow({
      where: { taskId: dependendentOnTaskId, deletedAt: null },
      include: {
        subtasks: {
          where: { deletedAt: null },
          include: {
            subtasks: {
              where: { deletedAt: null },
              include: {
                subtasks: true,
              },
            },
          },
        },
        dependencies: {
          where: { deletedAt: null },
          include: {
            dependentOnTask: true,
          },
        },
      },
    });
    const getMaxEndDate = async () => {
      let maxdate: Date | any;
      // Get all dependencies of the latest task in one go
      const allDependenciesExisted = await prisma.task.findMany({
        where: {
          taskId: {
            in: dependantTask.dependencies.map(
              (dep) => dep.dependentOnTask.taskId
            ),
          },
          dependencies: {
            some: {
              dependentType: TaskDependenciesEnum.SUCCESSORS,
            },
          },
          deletedAt: null,
        },
        include: {
          subtasks: {
            where: { deletedAt: null },
            include: {
              subtasks: {
                where: { deletedAt: null },
                include: {
                  subtasks: true,
                },
              },
            },
          },
          dependencies: {
            where: { deletedAt: null },
            include: {
              dependentOnTask: true,
            },
          },
        },
      });
      const existedDependenciesEndDates = await Promise.all(
        allDependenciesExisted.map((task) => {
          return taskEndDate(task, tenantId, organisationId);
        })
      );
      maxdate = dependantTask.startDate;
      for (const endDate of existedDependenciesEndDates) {
        if (maxdate && new Date(maxdate) < new Date(endDate)) {
          maxdate = new Date(endDate);
        }
      }
      return maxdate;
    };
    // const predecessorEndDateDependentTask = await getNextWorkingDay(
    //   new Date(await getMaxEndDate()),
    //   tenantId,
    //   organisationId
    // );
    await prisma.task.update({
      where: {
        taskId: dependendentOnTaskId,
      },
      data: {
        startDate: new Date(await getMaxEndDate()),
      },
    });
  }
  return [addDependencies1, addDependencies2];
};

export const handleSubTaskUpdation = async (
  tenantId: string,
  organisationId: string,
  taskId: string,
  completionPecentage: boolean,
  currentTaskId: string,
  startDate?: Date
) => {
  const prisma = await getClientByTenantId(tenantId);
  const task = await prisma.task.findFirst({
    where: {
      taskId: taskId,
    },
    include: {
      dependencies: {
        include: {
          dependentOnTask: true,
        },
      },
      parent: true,
    },
  });
  const dependencyTaskNames = [];
  let hasDependencyError = false;
  let hasDateError = false;
  let dateErrorMessage = "";

  if (task && task.dependencies && task.dependencies.length > 0) {
    for (let obj of task.dependencies) {
      if (obj.dependentType === TaskDependenciesEnum.PREDECESSORS) {
        const dependencyTask = await prisma.task.findFirst({
          where: { taskId: obj.dependendentOnTaskId, deletedAt: null },
        });

        if (!dependencyTask) continue;
        if (
          completionPecentage &&
          dependencyTask.status !== TaskStatusEnum.COMPLETED
        ) {
          dependencyTaskNames.push(dependencyTask.taskName);
          hasDependencyError = true;
        }
        const endDateDependencyTask = new Date(
          await taskEndDate(dependencyTask, tenantId, organisationId)
        );
        if (startDate && endDateDependencyTask >= new Date(startDate)) {
          hasDateError = true;
          dateErrorMessage =
            currentTaskId === taskId
              ? `This task has an end to start dependency with ${dependencyTask.taskName}. Would you like to remove the dependency?`
              : `You can not set the start date for this task before the latest end date amoung it predecessor ${dependencyTask.taskName} ${endDateDependencyTask}?`;
        }
      }
    }
  }
  if (hasDependencyError) {
    throw new BadRequestError(
      `You can not change the progress percentage for this task since it has an incompleted predecessors ${dependencyTaskNames.join(
        ", "
      )}. Would you like to remove these dependencies?`
    );
  }

  if (hasDateError) {
    throw new BadRequestError(dateErrorMessage);
  }

  if (task && task.parent && task.parent.taskId) {
    await handleSubTaskUpdation(
      tenantId,
      organisationId,
      task.parent.taskId,
      completionPecentage,
      currentTaskId,
      startDate
    );
  }
};

export const detectCycleInDependency = async (
  taskId: string,
  tenantId: string,
  organisationId: string,
  givenTaskId: string
) => {
  const prisma = await getClientByTenantId(tenantId);
  const task = await prisma.task.findFirstOrThrow({
    where: { taskId: taskId, deletedAt: null },
    include: {
      dependencies: {
        where: { deletedAt: null },
      },
    },
  });

  if (task.dependencies && task.dependencies.length > 0) {
    for (let obj of task.dependencies) {
      if (obj.dependentType === TaskDependenciesEnum.PREDECESSORS) {
        if (obj.dependendentOnTaskId === givenTaskId) {
          throw new BadRequestError(
            "You can not create this dependency as it would lead to an endless loop. If B is successor of A, then A can not be successor of B"
          );
        } else {
          await detectCycleChild(
            obj.dependendentOnTaskId,
            tenantId,
            givenTaskId
          );
          await detectCycleInDependency(
            obj.dependendentOnTaskId,
            tenantId,
            organisationId,
            givenTaskId
          );
        }
      }
    }
  }
};

export const detectCycleChild = async (
  taskId: string,
  tenantId: string,
  givenId: string
) => {
  const prisma = await getClientByTenantId(tenantId);
  const checkSubtasksForCycle = async (task: Task | any) => {
    if (task.subtasks && task.subtasks.length > 0) {
      for (let sub of task.subtasks) {
        if (sub.taskId === givenId) {
          throw new BadRequestError(
            "You're unable to create this dependency as it would lead to an endless loop."
          );
        }
        await checkSubtasksForCycle(sub); // Recursive call
      }
    }
  };
  const task = await prisma.task.taskWithAllDetails(taskId);
  if (task) {
    await checkSubtasksForCycle(task);
  }
};

export const helper = async (
  taskId: string,
  tenantId: string,
  organisationId: string,
  userId: string,
  newStartDate: Date,
  canUpdateChild: boolean = true
) => {
  const prisma = await getClientByTenantId(tenantId);
  const task = canUpdateChild
    ? await prisma.task.update({
        where: { taskId: taskId, deletedAt: null },
        data: {
          startDate: new Date(newStartDate),
          updatedByUserId: userId,
        },
        include: {
          dependencies: {
            include: {
              dependentOnTask: true,
            },
          },
          parent: {
            where: { deletedAt: null },
          },
          subtasks: {
            where: { deletedAt: null },
          },
        },
      })
    : await prisma.task.findFirstOrThrow({
        where: { taskId: taskId, deletedAt: null },
        include: {
          dependencies: {
            include: {
              dependentOnTask: true,
            },
          },
          parent: {
            where: { deletedAt: null },
          },
          subtasks: {
            where: { deletedAt: null },
          },
        },
      });

  const calculatedTaskEndDate = await taskEndDate(
    task,
    tenantId,
    organisationId
  );

  if (task.dependencies) {
    for (let dependency of task.dependencies) {
      if (dependency.dependentType == TaskDependenciesEnum.SUCCESSORS) {
        const nextWorkingStartDate = await getNextWorkingDay(
          new Date(calculatedTaskEndDate),
          tenantId,
          organisationId
        );
        await helper(
          dependency.dependendentOnTaskId,
          tenantId,
          organisationId,
          userId,
          nextWorkingStartDate
        );
      }
    }
  }

  if (canUpdateChild && task.subtasks) {
    for (let subtask of task.subtasks) {
      await helper(
        subtask.taskId,
        tenantId,
        organisationId,
        userId,
        newStartDate
      );
    }
  }

  if (task.parent?.taskId) {
    await calculateDurationAndPercentage(
      task.parent.taskId,
      tenantId,
      organisationId
    );
    await helper(
      task.parent.taskId,
      tenantId,
      organisationId,
      userId,
      new Date(),
      false
    );
  }
};
