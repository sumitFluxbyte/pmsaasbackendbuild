import { Task, TaskStatusEnum } from "@prisma/client";
import { getClientByTenantId } from "../config/db.js";
import { getDayAbbreviation } from "./getDatAbbreviation.js";
import { isHoliday } from "./checkIsHoliday.js";
import { taskEndDate } from "./calcualteTaskEndDate.js";
import { calculationSubTaskProgression } from "./calculationSubTaskProgression.js";

export async function calculationTPI(
  task: Task & { subtasks: Task[] },
  tenantId: string,
  organisationId: string
): Promise<{
  tpiValue: number;
  tpiFlag: "Red" | "Orange" | "Green";
  plannedProgression: number;
}> {
  let { duration, startDate, status, milestoneIndicator } = task;
  const completionPecentage =
    (await calculationSubTaskProgression(task, tenantId, organisationId)) ?? 0;
  const currentDate = new Date();
  const taskStartDate = new Date(startDate);
  const removeTimeFromDate = (date: Date) => {
    const newDate = new Date(date);
    newDate.setUTCHours(0, 0, 0, 0);
    return newDate;
  };
  const currentDateWithoutTime = removeTimeFromDate(currentDate);
  const taskStartDateWithoutTime = removeTimeFromDate(taskStartDate);
  if (status === TaskStatusEnum.NOT_STARTED) {
    if (milestoneIndicator) {
      if (currentDateWithoutTime >= taskStartDateWithoutTime) {
        return {
          tpiFlag: "Red",
          plannedProgression: 100,
          tpiValue: 0,
        };
      } else {
        return {
          tpiFlag: "Green",
          plannedProgression: 100,
          tpiValue: 1,
        };
      }
    }
    if (
      !milestoneIndicator &&
      currentDateWithoutTime <= taskStartDateWithoutTime
    ) {
      return {
        tpiFlag: "Green",
        plannedProgression: 100,
        tpiValue: 1,
      };
    }
  }
  const endDate = await taskEndDate(task, tenantId, organisationId);
  const effectiveDate =
    currentDate > new Date(endDate) ? new Date(endDate) : currentDate;
  effectiveDate.setUTCHours(0, 0, 0, 0);
  taskStartDate.setUTCHours(0, 0, 0, 0);
  const remainingDuration = await excludeNonWorkingDays(
    effectiveDate,
    taskStartDate,
    tenantId,
    organisationId
  );
  const plannedProgress = (remainingDuration / duration) * 100;
  const tpi = Number(completionPecentage) / plannedProgress;
  let flag: "Red" | "Orange" | "Green";
  if (tpi < 0.8) {
    flag = "Red";
  } else if (tpi >= 0.8 && tpi < 0.95) {
    flag = "Orange";
  } else {
    flag = "Green";
  }
  return {
    tpiValue: tpi,
    tpiFlag: flag,
    plannedProgression: plannedProgress,
  };
}

export async function taskFlag(
  task: Task & { subtasks: Task[] },
  tenantId: string,
  organisationId: string
): Promise<{ flag: "Red" | "Orange" | "Green"; delay: number }> {
  const { milestoneIndicator } = task;
  const tpi = await calculationTPI(task, tenantId, organisationId);
  let delay = 100 - tpi.tpiValue * 100;
  if (tpi.tpiFlag == "Green") {
    delay = 0;
  }
  if (milestoneIndicator) {
    return { flag: tpi.tpiValue < 1 ? "Red" : "Green", delay: delay };
  } else {
    return { flag: tpi.tpiFlag, delay: delay };
  }
}

export const excludeNonWorkingDays = async (
  currentDate: Date,
  startDate: Date,
  tenantId: string,
  organisationId: string
) => {
  const prisma = await getClientByTenantId(tenantId);
  const orgDetails = await prisma.organisation.findFirst({
    where: {
      organisationId,
      deletedAt: null,
    },
    select: {
      nonWorkingDays: true,
      orgHolidays: true,
    },
  });

  const nonWorkingDays = (orgDetails?.nonWorkingDays as string[]) ?? [];
  const holidays = orgDetails?.orgHolidays ?? [];
  let remainingDuration = 0;
  for (
    let date = new Date(startDate);
    date <= currentDate;
    date.setDate(date.getDate() + 1)
  ) {
    const dayOfWeek = date.getDay();
    const dayAbbreviation = getDayAbbreviation(dayOfWeek);

    // Check if it's a working day (not a holiday and not in non-working days)
    if (
      !nonWorkingDays.includes(dayAbbreviation) &&
      !isHoliday(date, holidays)
    ) {
      remainingDuration++;
    }
  }
  return remainingDuration;
};
