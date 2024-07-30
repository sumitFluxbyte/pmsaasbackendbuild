import { TaskDependenciesEnum, UserRoleEnum } from "@prisma/client";
import { getClientByTenantId } from "../config/db.js";
import { getDayAbbreviation } from "./getDatAbbreviation.js";
import { calculateDurationAndPercentage } from "./taskRecursion.js";
import { calculateProjectEndDate } from "./calculateProjectEndDate.js";
import { addDependenciesHelper } from "./handleDependencies.js";

function returnEndDate(
  nonWorkingDays: string[],
  durationFromCurrentDate?: number | null
) {
  const currentDate = new Date();
  let endDate = new Date(currentDate.getTime());
  if (
    durationFromCurrentDate !== null &&
    durationFromCurrentDate !== undefined
  ) {
    let remainingDays = durationFromCurrentDate;

    while (remainingDays > 0) {
      endDate.setDate(endDate.getDate() + 1);
      const dayOfWeek = endDate.getUTCDay();
      const dayAbbreviation = getDayAbbreviation(dayOfWeek).toUpperCase();
      if (!nonWorkingDays.includes(dayAbbreviation)) {
        remainingDays--;
      }
    }
  }
  return endDate;
}

const demoProjects = [
  {
    index: "1",
    projectName: "The ONE web application",
    startDate: null,
    startDateInWeek: 1,
    estimatedEndDateInWeek: 31,
    currency: "USD",
    type: "project",
    tasks: [
      {
        index: "1.1",
        taskName: "Initiation phase",
        type: "task",
        startDate: null,
        startDateInWeek: 1,
        estimatedEndDateInWeek: 1,
        duration: 3,
        isMilestone: false,
        subTask: [
          {
            index: "1.1.1",
            taskName: "Define project scope",
            startDate: null,
            isMilestone: false,
            startDateInWeek: 1,
            estimatedEndDateInWeek: 1,
            duration: 5,
          },
          {
            index: "1.1.2",
            taskName: "Conduct stakeholder interviews",
            isMilestone: false,
            startDate: 5,
            startDateInWeek: 2,
            estimatedEndDateInWeek: 2,
            duration: 2,
            dependencies: ["1.1.1"],
          },
          {
            index: "1.1.3",
            taskName: "Project proposal finalized",
            isMilestone: true,
            startDate: 7,
            startDateInWeek: 2,
            estimatedEndDateInWeek: 2,
            duration: 1,
          },
          {
            index: "1.1.4",
            taskName: "Conduct user research",
            isMilestone: false,
            startDate: 8,
            startDateInWeek: 2,
            estimatedEndDateInWeek: 2,
            duration: 5,
          },
          {
            index: "1.1.5",
            taskName: "Gather requirements",
            isMilestone: false,
            startDate: 8,
            startDateInWeek: 2,
            estimatedEndDateInWeek: 2,
            duration: 10,
          },
          {
            index: "1.1.6",
            taskName: "Requirements validated",
            isMilestone: true,
            startDate: 19,
            startDateInWeek: 2,
            estimatedEndDateInWeek: 2,
            duration: 1,
            dependencies: ["1.1.5"],
          },
          {
            index: "1.1.7",
            taskName: "Kickoff meeting",
            isMilestone: true,
            startDate: 20,
            startDateInWeek: 2,
            estimatedEndDateInWeek: 2,
            duration: 1,
          },
        ],
      },
      {
        index: "1.2",
        taskName: "Design",
        isMilestone: false,
        startDate: 21,
        startDateInWeek: 1,
        estimatedEndDateInWeek: 4,
        duration: null,
        subTask: [
          {
            index: "1.2.1",
            taskName: "High-level design including flow charts",
            isMilestone: false,
            startDate: 21,
            startDateInWeek: 1,
            estimatedEndDateInWeek: 2,
            duration: null,
          },
          {
            index: "1.2.2",
            taskName: "Design validation",
            isMilestone: true,
            startDate: 29,
            startDateInWeek: 2,
            estimatedEndDateInWeek: 3,
            duration: 1,
            dependencies: ["1.2.1"],
          },
          {
            index: "1.2.3",
            taskName: "Mockups development",
            isMilestone: false,
            startDateInWeek: 3,
            startDate: 30,
            estimatedEndDateInWeek: 4,
            duration: 20,
            dependencies: ["1.2.2"],
          },
          {
            index: "1.2.4",
            taskName: "Deliver final design",
            isMilestone: true,
            startDateInWeek: 3,
            startDate: 51,
            estimatedEndDateInWeek: 4,
            duration: 1,
            dependencies: ["1.2.3"],
          },
        ],
      },
      {
        index: "1.3",
        taskName: "Environment Setup",
        type: "task",
        isMilestone: false,
        startDate: 52,
        startDateInWeek: 5,
        estimatedEndDateInWeek: 10,
        duration: null,
        subTask: [
          {
            index: "1.3.1",
            taskName: "Staging environment",
            isMilestone: false,
            startDate: 52,
            startDateInWeek: 5,
            estimatedEndDateInWeek: 6,
            duration: 2,
          },
          {
            index: "1.3.2",
            taskName: "Production environment",
            isMilestone: false,
            startDate: 54,
            startDateInWeek: 6,
            estimatedEndDateInWeek: 9,
            duration: 2,
          },
          {
            index: "1.3.3",
            taskName: "QA environment",
            isMilestone: false,
            startDate: 56,
            startDateInWeek: 7,
            estimatedEndDateInWeek: 10,
            duration: 2,
          },
        ],
      },
      {
        index: "1.4",
        taskName: "Sprint 1",
        type: "task",
        isMilestone: false,
        startDate: 59,
        startDateInWeek: 1,
        estimatedEndDateInWeek: 1,
        duration: 3,
        subTask: [
          {
            index: "1.4.1",
            taskName: "Sprint 1 planning",
            isMilestone: false,
            startDate: 59,
            startDateInWeek: 1,
            estimatedEndDateInWeek: 1,
            duration: 1,
          },
          {
            index: "1.4.2",
            taskName: "Sprint 1 start",
            isMilestone: true,
            startDate: 59,
            startDateInWeek: 1,
            estimatedEndDateInWeek: 1,
            duration: 1,
            dependencies: ["1.4.1"],
          },
          {
            index: "1.4.3",
            taskName: "Sprint 1 period",
            isMilestone: false,
            startDate: 59,
            startDateInWeek: 1,
            estimatedEndDateInWeek: 1,
            duration: 10,
          },
          {
            index: "1.4.4",
            taskName: "Testing after sprint 1",
            isMilestone: false,
            startDateInWeek: 1,
            startDate: 69,
            estimatedEndDateInWeek: 1,
            duration: 2,
            dependencies: ["1.4.3"],
          },
          {
            index: "1.4.5",
            taskName: "Sprint 1 Stakeholder review",
            isMilestone: false,
            startDateInWeek: 1,
            startDate: 72,
            estimatedEndDateInWeek: 1,
            duration: 1,
            dependencies: ["1.4.4"],
          },
          {
            index: "1.4.6",
            taskName: "Sprint 1 Fix period",
            isMilestone: false,
            startDateInWeek: 1,
            estimatedEndDateInWeek: 1,
            duration: 2,
            startDate: 72,
            dependencies: ["1.4.5"],
          },
          {
            index: "1.4.7",
            taskName: "Deployment of Sprint 1 results",
            isMilestone: true,
            startDateInWeek: 1,
            estimatedEndDateInWeek: 1,
            duration: 1,
            startDate: 73,
            dependencies: ["1.4.6"],
          },
        ],
      },
      {
        index: "1.5",
        taskName: "Sprint 2",
        type: "task",
        isMilestone: false,
        startDateInWeek: 1,
        startDate: 74,
        estimatedEndDateInWeek: 1,
        duration: null,
        subTask: [
          {
            index: "1.5.1",
            taskName: "Backlog grooming",
            isMilestone: false,
            startDate: 74,
            startDateInWeek: 1,
            estimatedEndDateInWeek: 1,
            duration: 1,
          },
          {
            index: "1.5.2",
            taskName: "Sprint 1 retrospective",
            isMilestone: true,
            startDate: 74,
            startDateInWeek: 1,
            estimatedEndDateInWeek: 1,
            duration: 1,
          },
          {
            index: "1.5.3",
            taskName: "Sprint 2 planning",
            isMilestone: false,
            startDate: 74,
            startDateInWeek: 1,
            estimatedEndDateInWeek: 1,
            duration: 1,
            dependencies: ["1.5.1"],
          },
          {
            index: "1.5.4",
            taskName: "Sprint 2 start",
            isMilestone: true,
            startDate: 74,
            startDateInWeek: 1,
            estimatedEndDateInWeek: 1,
            duration: 1,
            dependencies: ["1.5.3"],
          },
          {
            index: "1.5.5",
            taskName: "Sprint 2 period",
            isMilestone: false,
            startDate: 74,
            startDateInWeek: 1,
            estimatedEndDateInWeek: 1,
            duration: 10,
          },
          {
            index: "1.5.6",
            taskName: "Testing after sprint 2",
            isMilestone: false,
            startDateInWeek: 1,
            startDate: 75,
            estimatedEndDateInWeek: 1,
            duration: 2,
            dependencies: ["1.5.5"],
          },
          {
            index: "1.5.7",
            taskName: "Sprint 2 Stakeholder review",
            isMilestone: false,
            startDate: 78,
            startDateInWeek: 1,
            estimatedEndDateInWeek: 1,
            duration: 1,
            dependencies: ["1.5.6"],
          },
          {
            index: "1.5.8",
            taskName: "Sprint 2 Fix period",
            isMilestone: false,
            startDate: 78,
            startDateInWeek: 1,
            estimatedEndDateInWeek: 1,
            duration: 2,
            dependencies: ["1.5.7"],
          },
          {
            index: "1.5.9",
            taskName: "Deployment of Sprint 2 results",
            isMilestone: true,
            startDate: 81,
            startDateInWeek: 1,
            estimatedEndDateInWeek: 1,
            duration: 1,
            dependencies: ["1.5.8"],
          },
        ],
      },
      {
        index: "1.6",
        taskName: "Backlog",
        type: "task",
        isMilestone: false,
        startDate: 82,
        startDateInWeek: 5,
        estimatedEndDateInWeek: 10,
        duration: null,
        subTask: [
          {
            index: "1.6.1",
            taskName: "Feature 1 developement",
            isMilestone: false,
            startDateInWeek: 5,
            startDate: 82,
            estimatedEndDateInWeek: 6,
            duration: 3,
          },
          {
            index: "1.6.1",
            taskName: "Feature 2 developement",
            isMilestone: false,
            startDateInWeek: 6,
            startDate: 86,
            estimatedEndDateInWeek: 9,
            duration: 3,
          },
          {
            index: "1.6.1",
            taskName: "Feature 3 developement",
            isMilestone: false,
            startDate: 90,
            startDateInWeek: 7,
            estimatedEndDateInWeek: 10,
            duration: 3,
          },
        ],
      },
    ],
  },
  {
    index: "2",
    projectName: "House building",
    startDate: null,
    startDateInWeek: 1,
    estimatedEndDateInWeek: 31,
    currency: "USD",
    type: "project",
    tasks: [
      {
        index: "2.1",
        taskName: "Project Initiation Phase",
        type: "task",
        isMilestone: false,
        startDate: 1,
        startDateInWeek: 5,
        estimatedEndDateInWeek: 10,
        duration: null,
        subTask: [
          {
            index: "2.1.1",
            taskName: "Define Project Scope and Objectives",
            isMilestone: false,
            startDateInWeek: 5,
            startDate: 1,
            estimatedEndDateInWeek: 6,
            duration: 1,
          },
          {
            index: "2.1.2",
            taskName: "Conduct Site Survey",
            isMilestone: false,
            startDateInWeek: 6,
            startDate: 1,
            estimatedEndDateInWeek: 9,
            duration: 2,
          },
          {
            index: "2.1.3",
            taskName: "Obtain Permits and Approvals",
            isMilestone: false,
            startDate: 3,
            startDateInWeek: 7,
            estimatedEndDateInWeek: 10,
            duration: 1,
          },
          {
            index: "2.1.4",
            taskName: "Permit approved",
            isMilestone: true,
            startDateInWeek: 6,
            startDate: 4,
            estimatedEndDateInWeek: 9,
            duration: 1,
          },
        ],
      },
      {
        index: "2.2",
        taskName: "Design Phase",
        isMilestone: false,
        startDateInWeek: 6,
        startDate: null,
        estimatedEndDateInWeek: 9,
        duration: 1,
        subTask: [
          {
            index: "2.2.1",
            taskName: "Architectural Design",
            isMilestone: false,
            startDate: 5,
            startDateInWeek: 7,
            estimatedEndDateInWeek: 10,
            duration: 3,
          },
          {
            index: "2.2.2",
            taskName: "Structural Design",
            isMilestone: false,
            startDate: 8,
            startDateInWeek: 7,
            estimatedEndDateInWeek: 10,
            duration: 2,
          },
          {
            index: "2.2.3",
            taskName: "Electrical and Plumbing Design",
            isMilestone: false,
            startDate: 10,
            startDateInWeek: 7,
            estimatedEndDateInWeek: 10,
            duration: 2,
          },
          {
            index: "2.2.4",
            taskName: "Plan approved",
            isMilestone: true,
            startDateInWeek: 6,
            startDate: 12,
            estimatedEndDateInWeek: 9,
            duration: 1,
          },
        ],
      },
      {
        index: "2.3",
        taskName: "Pre-Construction Phase",
        isMilestone: false,
        startDateInWeek: 6,
        startDate: null,
        estimatedEndDateInWeek: 9,
        duration: 1,
        subTask: [
          {
            index: "2.3.1",
            taskName: "Finalize Material and Equipment Procurement",
            isMilestone: false,
            startDate: 13,
            startDateInWeek: 7,
            estimatedEndDateInWeek: 10,
            duration: 1,
          },
          {
            index: "2.3.2",
            taskName: "Hire Contractors and Construction Crew",
            isMilestone: false,
            startDate: 14,
            startDateInWeek: 7,
            estimatedEndDateInWeek: 10,
            duration: 2,
          },
          {
            index: "2.3.3",
            taskName: "Prepare Construction Site",
            isMilestone: false,
            startDate: 16,
            startDateInWeek: 7,
            estimatedEndDateInWeek: 10,
            duration: 1,
          },
          {
            index: "2.3.4",
            taskName: "All inspection finished",
            isMilestone: true,
            startDateInWeek: 6,
            startDate: 17,
            estimatedEndDateInWeek: 9,
            duration: 1,
          },
        ],
      },
      {
        index: "2.4",
        taskName: "Construction Phase",
        isMilestone: false,
        startDateInWeek: 6,
        startDate: null,
        estimatedEndDateInWeek: 9,
        duration: 1,
        subTask: [
          {
            index: "2.4.1",
            taskName: "Foundation Construction",
            isMilestone: false,
            startDate: 18,
            startDateInWeek: 7,
            estimatedEndDateInWeek: 10,
            duration: 3,
          },
          {
            index: "2.4.2",
            taskName: "Framing and Roofing",
            isMilestone: false,
            startDate: 21,
            startDateInWeek: 7,
            estimatedEndDateInWeek: 10,
            duration: 2,
          },
          {
            index: "2.4.3",
            taskName: "Electrical and Plumbing Installation",
            isMilestone: false,
            startDate: 23,
            startDateInWeek: 7,
            estimatedEndDateInWeek: 10,
            duration: 2,
          },
          {
            index: "2.4.4",
            taskName: "Interior Finishing",
            isMilestone: false,
            startDate: 25,
            startDateInWeek: 7,
            estimatedEndDateInWeek: 10,
            duration: 2,
          },
          {
            index: "2.4.3",
            taskName: "Exterior Finishing",
            isMilestone: false,
            startDate: 27,
            startDateInWeek: 7,
            estimatedEndDateInWeek: 10,
            duration: 1,
          },
          {
            index: "2.4.4",
            taskName: "Substantial completion",
            isMilestone: true,
            startDateInWeek: 6,
            startDate: 29,
            estimatedEndDateInWeek: 9,
            duration: 1,
          },
        ],
      },
      {
        index: "2.5",
        taskName: "Post-Construction Phase",
        isMilestone: false,
        startDateInWeek: 6,
        startDate: null,
        estimatedEndDateInWeek: 9,
        duration: 1,
        subTask: [
          {
            index: "2.5.1",
            taskName: "Final Inspections and Quality Checks",
            isMilestone: false,
            startDate: 30,
            startDateInWeek: 7,
            estimatedEndDateInWeek: 10,
            duration: 2,
          },
          {
            index: "2.5.2",
            taskName: "Landscaping and Exterior Works",
            isMilestone: false,
            startDate: 32,
            startDateInWeek: 7,
            estimatedEndDateInWeek: 10,
            duration: 2,
          },
          {
            index: "2.5.3",
            taskName: "Clean-up",
            isMilestone: false,
            startDate: 34,
            startDateInWeek: 7,
            estimatedEndDateInWeek: 10,
            duration: 1,
          },
          {
            index: "2.5.4",
            taskName: "Client Walkthrough and Handover",
            isMilestone: true,
            startDateInWeek: 6,
            startDate: 34,
            estimatedEndDateInWeek: 9,
            duration: 1,
          },
        ],
      },
    ],
  },
];

const taskForDependenciesMap = {
  "1.1": "Initiation phase",
  "1.1.1": "Define project scope",
  "1.1.2": "Conduct stakeholder interviews",
  "1.1.3": "Project proposal finalized",
  "1.1.4": "Conduct user research",
  "1.1.5": "Gather requirements",
  "1.1.6": "Requirements validated",
  "1.1.7": "Kickoff meeting",
  "1.2": "Design",
  "1.2.1": "High-level design including flow charts",
  "1.2.2": "Design validation",
  "1.2.3": "Mockups development",
  "1.2.4": "Deliver final design",
  "1.3": "Environment Setup",
  "1.3.1": "Staging environment",
  "1.3.2": "Production environment",
  "1.3.3": "QA environment",
  "1.4": "Sprint 1",
  "1.4.1": "Sprint 1 planning",
  "1.4.2": "Sprint 1 start",
  "1.4.3": "Sprint 1 period",
  "1.4.4": "Testing after sprint 1",
  "1.4.5": "Sprint 1 Stakeholder review",
  "1.4.6": "Sprint 1 Fix period",
  "1.4.7": "Deployment of Sprint 1 results",
  "1.5": "Sprint 2",
  "1.5.1": "Backlog grooming",
  "1.5.2": "Sprint 1 retrospective",
  "1.5.3": "Sprint 2 planning",
  "1.5.4": "Sprint 2 start",
  "1.5.5": "Sprint 2 period",
  "1.5.6": "Testing after sprint 2",
  "1.5.7": "Sprint 2 Stakeholder review",
  "1.5.8": "Sprint 2 Fix period",
  "1.5.9": "Deployment of Sprint 2 results",
  "1.6": "Backlog",
  "1.6.1": "Feature 1 development",
  "1.6.2": "Feature 2 development",
  "1.6.3": "Feature 3 development",
  "2.1": "Project Initiation Phase",
  "2.1.1": "Define Project Scope and Objectives",
  "2.1.2": "Conduct Site Survey",
  "2.1.3": "Obtain Permits and Approvals",
  "2.1.4": "Permit approved",
  "2.2": "Design Phase",
  "2.2.1": "Architectural Design",
  "2.2.2": "Structural Design",
  "2.2.3": "Electrical and Plumbing Design",
  "2.2.4": "Plan approved",
  "2.3": "Pre-Construction Phase",
  "2.3.1": "Finalize Material and Equipment Procurement",
  "2.3.2": "Hire Contractors and Construction Crew",
  "2.3.3": "Prepare Construction Site",
  "2.3.4": "All inspection finished",
  "2.4": "Construction Phase",
  "2.4.1": "Foundation Construction",
  "2.4.2": "Framing and Roofing",
  "2.4.3": "Electrical and Plumbing Installation",
  "2.4.4": "Interior Finishing",
  "2.4.5": "Exterior Finishing",
  "2.4.6": "Substantial completion",
  "2.5": "Post-Construction Phase",
  "2.5.1": "Final Inspections and Quality Checks",
  "2.5.2": "Landscaping and Exterior Works",
  "2.5.3": "Clean-up",
  "2.5.4": "Client Walkthrough and Handover",
} as const;
type TaskForDependenciesMap = typeof taskForDependenciesMap;
type TaskNumber = keyof TaskForDependenciesMap;

function getTaskName(taskNumber: TaskNumber): string {
  return taskForDependenciesMap[taskNumber];
}

function isTaskNumber(key: string): key is TaskNumber {
  return key in taskForDependenciesMap;
}

export const createDemoProjectsCommon = async (
  tenantId: string,
  createdByUserId: string,
  organisationId: string
) => {
  const prisma = await getClientByTenantId(tenantId);
  if (demoProjects) {
    const projectCreationPromises = demoProjects.map(async (project) => {
      const findProject = await prisma.project.findFirst({
        where: {
          organisationId: organisationId,
          projectName: project.projectName,
          deletedAt: null,
        },
      });
      const findOrg = await prisma.organisation.findFirst({
        where: { organisationId, deletedAt: null },
      });
      if (!findProject && findOrg) {
        const nonWorkingDays = (findOrg?.nonWorkingDays as string[]) ?? [];
        const startDate = returnEndDate(nonWorkingDays, project.startDate);
        const createProject = await prisma.project.create({
          data: {
            organisationId: organisationId,
            projectName: project.projectName,
            startDate: startDate,
            currency: project.currency,
            createdByUserId: createdByUserId,
            estimatedBudget: "0",
            actualCost: "0",
            kanbanColumns: {
              create: {
                name: "Backlog",
                percentage: null,
                createdByUserId: createdByUserId,
              },
            },
            assignedUsers: {
              create: {
                assginedToUserId: createdByUserId,
                projectRole: UserRoleEnum.ADMINISTRATOR,
              },
            },
          },
          include: {
            kanbanColumns: true,
          },
        });

        if (createProject && project.tasks) {
          const taskCreationPromises = project.tasks.map(async (task) => {
            const startDateOne = returnEndDate(nonWorkingDays, task.startDate);
            const createParentTask = await prisma.task.create({
              data: {
                projectId: createProject.projectId,
                taskName: task.taskName,
                taskDescription: "",
                startDate: startDateOne,
                duration: task.duration ? task.duration : 1,
                parentTaskId: null,
                milestoneIndicator: task.isMilestone,
                createdByUserId: createdByUserId,
                completionPecentage: 0,
                kanbanColumnId: createProject.kanbanColumns.find(
                  (back) => back.name == "Backlog"
                )?.kanbanColumnId,
              },
              include: {
                parent: true,
                project: true,
              },
            });
            if (createParentTask.parent?.taskId) {
              await calculateDurationAndPercentage(
                createParentTask.parent.taskId,
                tenantId,
                organisationId
              );
            }
            const maxEndDateOne = await calculateProjectEndDate(
              createParentTask.projectId,
              tenantId,
              organisationId
            );
            if (maxEndDateOne) {
              await prisma.project.update({
                where: {
                  projectId: createParentTask.project.projectId,
                },
                data: {
                  actualEndDate: maxEndDateOne,
                },
              });
            }

            if (createParentTask && task.subTask) {
              await Promise.all(
                task.subTask.map(async (sub) => {
                  const startDateTwo = returnEndDate(
                    nonWorkingDays,
                    sub.startDate
                  );
                  const taskCreatedSub = await prisma.task.create({
                    data: {
                      projectId: createProject.projectId,
                      taskName: sub.taskName,
                      taskDescription: "",
                      startDate: startDateTwo,
                      duration: sub.duration ? sub.duration : 1,
                      parentTaskId: createParentTask.taskId,
                      milestoneIndicator: sub.isMilestone,
                      createdByUserId: createdByUserId,
                      completionPecentage: 0,
                      kanbanColumnId: createProject.kanbanColumns.find(
                        (back) => back.name == "Backlog"
                      )?.kanbanColumnId,
                    },
                    include: {
                      parent: true,
                      project: true,
                    },
                  });
                  if (taskCreatedSub.parent?.taskId) {
                    await calculateDurationAndPercentage(
                      taskCreatedSub.parent.taskId,
                      tenantId,
                      organisationId
                    );
                  }
                  const maxEndDate = await calculateProjectEndDate(
                    taskCreatedSub.projectId,
                    tenantId,
                    organisationId
                  );
                  if (maxEndDate) {
                    await prisma.project.update({
                      where: {
                        projectId: taskCreatedSub.project.projectId,
                      },
                      data: {
                        actualEndDate: maxEndDate,
                      },
                    });
                  }
                  //@ts-ignore
                  if (sub.dependencies && sub.dependencies?.length) {
                    //@ts-ignore

                    for (const taskNumber of sub.dependencies) {
                      if (isTaskNumber(taskNumber)) {
                        const taskName = getTaskName(taskNumber);
                        const findTask = await prisma.task.findFirst({
                          where: {
                            deletedAt: null,
                            taskName,
                            projectId: createProject.projectId,
                          },
                        });
                        if (findTask) {
                          const [addDependencies1, addDependencies2] =
                            await addDependenciesHelper(
                              taskCreatedSub.taskId,
                              findTask.taskId,
                              tenantId,
                              organisationId,
                              createdByUserId,
                              TaskDependenciesEnum.PREDECESSORS
                            );
                        }
                      }
                    }
                  }
                })
              );
            }
          });
          await Promise.all(taskCreationPromises);
        }
      }
    });

    await Promise.all(projectCreationPromises);
  }
  return;
};
