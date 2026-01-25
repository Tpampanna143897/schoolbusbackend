const mongoose = require("mongoose");
const Bus = require("../models/Bus");
const Student = require("../models/Student");

async function migrateData() {
    console.log("Starting Data Migration...");

    try {
        // Migration logic for Buses
        const buses = await Bus.find({});
        for (let bus of buses) {
            // Check if old fields exist (from the view_file calls earlier)
            // schema was: { busNumber, route, driver, status, ... }
            const oldRoute = bus.get("route");
            if (oldRoute && !bus.defaultRoute) {
                bus.defaultRoute = oldRoute;
                // Note: we remove fixed driver and fixed route in the new model definition
            }
            bus.isActive = true;
            await bus.save();
        }
        console.log(`Migrated ${buses.length} Buses.`);

        // Migration logic for Students
        const students = await Student.find({});
        for (let student of students) {
            // schema was: { name, class, parent, route, bus, ... }
            const oldRoute = student.get("route");
            const oldBus = student.get("bus");
            if (oldRoute && !student.assignedRoute) student.assignedRoute = oldRoute;
            if (oldBus && !student.assignedBus) student.assignedBus = oldBus;
            await student.save();
        }
        console.log(`Migrated ${students.length} Students.`);

        console.log("Migration Completed Successfully! 🚀");
    } catch (err) {
        console.error("Migration Failed:", err);
    }
}

module.exports = migrateData;
