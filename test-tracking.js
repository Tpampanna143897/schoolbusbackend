const io = require("socket.io-client");

// Simulates a driver sending location updates
const socket = io("http://localhost:5000");

const simulateTrip = (tripId, busId, driverId) => {
    socket.emit("join-trip", tripId);

    // Mock coordinates that approach a stop
    const updates = [
        { lat: 12.9716, lng: 77.5946, speed: 20 }, // Approach
        { lat: 12.9718, lng: 77.5948, speed: 10 }, // Entering stop radius
        { lat: 12.9718, lng: 77.5948, speed: 0 }, // Stopped at stop
    ];

    updates.forEach((pos, i) => {
        setTimeout(() => {
            console.log(`Sending Update ${i + 1}...`);
            socket.emit("driver-location-update", {
                tripId,
                busId,
                driverId,
                ...pos
            });
        }, i * 2000);
    });

    socket.on("stopArrived", (data) => {
        console.log("SUCCESS: Arrived at stop:", data.name);
    });

    socket.on("attendanceMarked", (data) => {
        console.log("SUCCESS: Attendance Marked:", data.studentCount, "students");
    });
};

socket.on("connect", () => {
    console.log("Simulator Connected");
    // Replace with actual IDs from your DB to test
    // simulateTrip("TRIP_ID", "BUS_ID", "DRIVER_ID");
});
