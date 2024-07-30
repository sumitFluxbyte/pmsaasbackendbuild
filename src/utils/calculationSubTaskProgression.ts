import { Task } from "@prisma/client";
import { settings } from "../config/settings.js";

export async function calculationSubTaskProgression(
  task: Task & { subtasks: Task[] },
  tenantId: string,
  organisationId: string
) {
  if (task.subtasks && task.subtasks.length > 0) {
    let completionPecentageOrDurationTask = 0;
    let averagesSumOfDurationTask = 0;
    for (const value of task.subtasks) {
      const percentage = await calculationSubTaskProgression(
        value as Task & { subtasks: Task[] },
        tenantId,
        organisationId
      );
      if (percentage && value.duration) {
        completionPecentageOrDurationTask +=
          Number(percentage) * (value.duration * settings.hours);
      }
      averagesSumOfDurationTask += value.duration * settings.hours * 100;
    }
    const finalPercentage =
      (completionPecentageOrDurationTask / averagesSumOfDurationTask) * 100;
    return Number(finalPercentage.toFixed(2));
  } else {
    const completionPercentage = task.completionPecentage;
    if (completionPercentage === null || isNaN(completionPercentage)) {
      return 0;
    } else {
      return Number(completionPercentage.toFixed(2));
    }
  }
}
