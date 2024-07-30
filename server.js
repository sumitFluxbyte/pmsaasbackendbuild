import "dotenv/config";
import express from "express";
import "express-async-errors";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import { settings } from "./config/settings.js";
import UserRoutes from "./routers/user.routes.js";
import AuthRoutes from "./routers/auth.routes.js";
import ConsoleRoutes from "./routers/console.routes.js";
import OrganisationRoutes from "./routers/organisation.routes.js";
import ProjectRoutes from "./routers/project.routes.js";
import TaskRoutes from "./routers/task.routes.js";
import DashboardRoutes from "./routers/dashboard.routes.js";
import NotificationRoutes from "./routers/notification.routes.js";
import { authMiddleware } from "./middleware/auth.middleware.js";
import { defualtHeaderMiddleware } from "./middleware/header.middleware.js";
import { ErrorHandlerMiddleware } from "./middleware/error.middleware.js";
import morgan from "morgan";
import passport from "passport";
import "./services/passport.services.js";
import fileUpload from "express-fileupload";
import http from "http";
import { RegisterSocketServices } from "./services/socket.services.js";
import { CronService } from "./services/cron.services.js";
import geo from "geoip-lite";
const { lookup } = geo;
const app = express();
const server = http.createServer(app);
RegisterSocketServices.register(server); // Socket
// File-upload
app.use(fileUpload());
// Morgan
app.use(morgan(":method \x1b[32m:url\x1b[0m :status \x1b[36m(:response-time ms)\x1b[0m - \x1b[35m:res[content-length] :res[compressed-size] \x1b[0m"));
// CORS configuration
app.use(cors({
    origin: true,
    credentials: true,
}));
app.use(passport.initialize());
//Cookie
app.use(cookieParser());
// Helmet configuration
app.use(helmet());
// JSON data handling
app.use(express.json());
app.set("json spaces", 2);
app.set('trust proxy', true);
app.use(defualtHeaderMiddleware);
const getClientIp = (req) => {
    const ipAddress = req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || req.connection.remoteAddress;
    if (Array.isArray(ipAddress)) {
        return ipAddress[ipAddress.length - 1];
    }
    else {
        return ipAddress;
    }
};
app.use("/api/ip", (req, res) => {
    const clientIp = getClientIp(req);
    const geo = lookup(clientIp ?? "");
    res.send({ data: geo });
});
app.use("/api/auth", AuthRoutes);
app.use("/api/console", ConsoleRoutes);
app.use("/api/user", authMiddleware, UserRoutes);
app.use("/api/organisation", authMiddleware, OrganisationRoutes);
app.use("/api/project", authMiddleware, ProjectRoutes);
app.use("/api/task", authMiddleware, TaskRoutes);
app.use("/api/dashboard", authMiddleware, DashboardRoutes);
app.use("/api/notification", authMiddleware, NotificationRoutes);
app.get("/", async (req, res) => {
    return res.status(200).send({ ok: true });
});
// Catch-all route should be placed after all other routes and middleware
app.use("*", (req, res) => {
    return res.status(404).send({ error: "Route not found" });
});
// Send notification and Email if Due date today
CronService.sendNotificationAndEmailToTaskDueDate();
// Error handling middleware
app.use(ErrorHandlerMiddleware.handler);
server.listen(settings.port, () => console.log(`Server is listening on port ${settings.port}!`));
