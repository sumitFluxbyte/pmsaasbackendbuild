import express from "express";
import { UserRoleEnum } from "@prisma/client";
import * as ProjectController from "../controllers/project.controller.js";
import { roleMiddleware } from "../middleware/role.middleware.js";
let router = express.Router();
router.put("/duplicate-project/:projectId", roleMiddleware([UserRoleEnum.ADMINISTRATOR, UserRoleEnum.PROJECT_MANAGER]), ProjectController.duplicateProjectAndAllItsTask);
router.get("/", roleMiddleware([
    UserRoleEnum.ADMINISTRATOR,
    UserRoleEnum.PROJECT_MANAGER,
    UserRoleEnum.TEAM_MEMBER,
]), ProjectController.getProjects);
router.put("/userAssignIntoProject/:projectId", roleMiddleware([
    UserRoleEnum.ADMINISTRATOR,
    UserRoleEnum.PROJECT_MANAGER,
    UserRoleEnum.TEAM_MEMBER,
]), ProjectController.userAssignIntoProject);
router.get("/kanban-column/:projectId", ProjectController.getKanbanColumnById);
router.post("/kanban-column/:projectId", ProjectController.createKanbanColumn);
router.put("/kanban-column/:kanbanColumnId", ProjectController.updatekanbanColumn);
router.delete("/kanban-column/:kanbanColumnId", ProjectController.deleteKanbanColumn);
router.get("/:projectId", roleMiddleware([
    UserRoleEnum.ADMINISTRATOR,
    UserRoleEnum.PROJECT_MANAGER,
    UserRoleEnum.TEAM_MEMBER,
]), ProjectController.getProjectById);
router.post("/", roleMiddleware([UserRoleEnum.ADMINISTRATOR, UserRoleEnum.PROJECT_MANAGER]), ProjectController.createProject);
router.delete("/:projectId", roleMiddleware([UserRoleEnum.ADMINISTRATOR, UserRoleEnum.PROJECT_MANAGER]), ProjectController.deleteProject);
router.put("/status/:projectId", roleMiddleware([UserRoleEnum.ADMINISTRATOR, UserRoleEnum.PROJECT_MANAGER]), ProjectController.statusChangeProject);
router.put("/:projectId", roleMiddleware([UserRoleEnum.ADMINISTRATOR, UserRoleEnum.PROJECT_MANAGER]), ProjectController.updateProject);
router.put("consumed-budget/:projectId", roleMiddleware([UserRoleEnum.ADMINISTRATOR, UserRoleEnum.PROJECT_MANAGER]), ProjectController.addConsumedBudgetToProject);
router.delete("/remove-assignee/:projectAssignUsersId", roleMiddleware([UserRoleEnum.ADMINISTRATOR, UserRoleEnum.PROJECT_MANAGER]), ProjectController.deleteAssignedUserFromProject);
router.put("/projectAssgined/role-update/:projectAssignUsersId", roleMiddleware([UserRoleEnum.ADMINISTRATOR, UserRoleEnum.PROJECT_MANAGER]), ProjectController.updateProjectRole);
router.put("/projectAssgined/job-title-update/:projectAssignUsersId", roleMiddleware([UserRoleEnum.ADMINISTRATOR, UserRoleEnum.PROJECT_MANAGER]), ProjectController.updateProjectJobTitle);
export default router;
