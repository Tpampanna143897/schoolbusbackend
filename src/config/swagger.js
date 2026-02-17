const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "Antigravity School Bus Tracking API",
            version: "1.0.0",
            description: "SaaS-grade API for real-time school bus tracking, attendance management, and fleet monitoring.",
            contact: {
                name: "Antigravity Support",
                url: "https://antigravity.io",
                email: "support@antigravity.io"
            },
        },
        servers: [
            {
                url: "https://schoolbusbackend-acx9.onrender.com/api",
                description: "Production Server"
            },
            {
                url: "http://localhost:5000/api",
                description: "Development Server"
            }
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT",
                },
            },
            schemas: {
                User: {
                    type: "object",
                    properties: {
                        _id: { type: "string" },
                        name: { type: "string" },
                        email: { type: "string" },
                        role: { type: "string", enum: ["ADMIN", "DRIVER", "PARENT", "STAFF"] },
                        assignedBus: { type: "string" },
                        assignedRoute: { type: "string" }
                    }
                },
                Bus: {
                    type: "object",
                    properties: {
                        _id: { type: "string" },
                        busNumber: { type: "string" },
                        status: { type: "string", enum: ["ONLINE", "OFFLINE"] },
                        isActive: { type: "boolean" },
                        speed: { type: "number" },
                        activeTrip: { type: "string" }
                    }
                },
                Trip: {
                    type: "object",
                    properties: {
                        _id: { type: "string" },
                        driverId: { type: "string" },
                        busId: { type: "string" },
                        routeId: { type: "string" },
                        type: { type: "string", enum: ["MORNING", "EVENING"] },
                        status: { type: "string", enum: ["STARTED", "STOPPED", "ENDED"] },
                        startedAt: { type: "string", format: "date-time" }
                    }
                },
                TrackingPoint: {
                    type: "object",
                    properties: {
                        lat: { type: "number" },
                        lng: { type: "number" },
                        speed: { type: "number" },
                        heading: { type: "number" },
                        timestamp: { type: "string", format: "date-time" }
                    }
                },
                SuccessResponse: {
                    type: "object",
                    properties: {
                        success: { type: "boolean", example: true },
                        message: { type: "string" },
                        data: { type: "object" }
                    }
                },
                ErrorResponse: {
                    type: "object",
                    properties: {
                        success: { type: "boolean", example: false },
                        message: { type: "string" }
                    }
                }
            }
        },
        security: [{ bearerAuth: [] }],
    },
    apis: ["./src/routes/*.js"], // Path to the API docs
};

const specs = swaggerJsdoc(options);

const swaggerSetup = (app) => {
    app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs, {
        swaggerOptions: {
            persistAuthorization: true,
        },
        customSiteTitle: "Antigravity API Docs"
    }));
};

module.exports = swaggerSetup;
