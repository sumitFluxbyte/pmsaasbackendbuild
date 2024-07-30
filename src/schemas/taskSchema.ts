import { ZodError, z } from "zod";
import { TaskDependenciesEnumValue, TaskStatusEnumValue } from "./enums.js";

export const createTaskSchema = z.object({
  taskName: z.string().min(1),
  taskDescription: z.string().optional(),
  startDate: z.coerce.date(),
  duration: z.number().multipleOf(0.01),
  completionPecentage: z.number().multipleOf(0.01).optional(),
  kanbanColumnId: z.string().optional(),
});
export const updateTaskSchema = z.object({
  taskName: z.string().min(1).optional(),
  taskDescription: z.string().optional(),
  startDate: z.coerce.date().optional(),
  duration: z.number().multipleOf(0.01).optional(),
  completionPecentage: z.number().multipleOf(0.01).optional(),
  status: z.nativeEnum(TaskStatusEnumValue).optional(),
  ganttColor: z.string().optional(),
  kanbanColumnId: z.string().optional(),
});

export const assginedToUserIdSchema = z.object({
  assginedToUserId: z.string().uuid(),
});

export const taskStatusSchema = z.object({
  status: z.nativeEnum(TaskStatusEnumValue),
});

export const createCommentTaskSchema = z.object({
  commentText: z.string(),
  parentCommentId: z.string().uuid().optional(),
});

export const attachmentTaskSchema = z.any();

export const dependenciesTaskSchema = z
  .object({
    dependentType: z.nativeEnum(TaskDependenciesEnumValue),
    dependendentOnTaskId: z.string({ required_error: "Task required*" }).uuid(),
  })
  .refine((data) => {
    const { dependentType, dependendentOnTaskId } = data;
    if (
      (dependentType === TaskDependenciesEnumValue.SUCCESSORS ||
        dependentType === TaskDependenciesEnumValue.PREDECESSORS) &&
      !dependendentOnTaskId
    ) {
      throw new ZodError([
        {
          code: "invalid_string",
          message:
            "Dependant Task should not be null when dependentType provided",
          path: ["dependendentOnTaskId"],
          validation: "uuid",
        },
      ]);
    } else if (
      dependendentOnTaskId &&
      dependentType != TaskDependenciesEnumValue.PREDECESSORS &&
      dependentType != TaskDependenciesEnumValue.SUCCESSORS
    ) {
      throw new ZodError([
        {
          code: "invalid_string",
          message: `Dependant Task should be null when dependentType provided`,
          path: ["dependentType"],
          validation: "uuid",
        },
      ]);
    }
    return true;
  });

export const milestoneTaskSchema = z.object({
  milestoneIndicator: z.boolean(),
});

export const taskBulkDeleteSchema = z.object({
  taskIds: z.string().array()
})
export const taskBulkAssingSchema = z.object({
  taskIds: z.string().array()
})
