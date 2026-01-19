require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");

const app = require("./src/app");
const connectDB = require("./src/config/db");

connectDB();

const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "*" }
});

global.io = io;

io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);
});

server.listen(process.env.PORT, () => {
    console.log(`Server running on port ${process.env.PORT}`);
});
