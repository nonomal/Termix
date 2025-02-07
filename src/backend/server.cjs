const http = require("http");
const socketIo = require("socket.io");
const SSHClient = require("ssh2").Client;

const server = http.createServer();
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});

io.on("connection", (socket) => {
    console.log("New socket connection established");

    let currentCols = 80;
    let currentRows = 24;
    let stream = null;

    socket.on("resize", ({ cols, rows }) => {
        console.log(`Terminal resized: cols=${cols}, rows=${rows}`);
        currentCols = cols;
        currentRows = rows;
        if (stream && stream.setWindow) {
            stream.setWindow(rows, cols, rows * 100, cols * 100);
            console.log(`SSH terminal resized to: cols=${cols}, rows=${rows}`);
        }
    });

    socket.on("connectToHost", (cols, rows, hostConfig) => {
        if (!hostConfig || !hostConfig.ip || !hostConfig.user || !hostConfig.password || !hostConfig.port) {
            console.error("Invalid hostConfig received:", hostConfig);
            return;
        }

        console.log("Received hostConfig:", hostConfig);
        const { ip, port, user, password } = hostConfig;

        if (!ip || !port || !user || !password) {
            socket.emit("data", "\r\n*** Missing required connection data ***\r\n");
            return;
        }

        console.log("Preparing to connect to host:", hostConfig);
        const conn = new SSHClient();

        conn
            .on("ready", function () {
                console.log("SSH connection established");
                socket.emit("data", "\r\n*** SSH CONNECTION ESTABLISHED ***\r\n");
                conn.shell(function (err, newStream) {
                    if (err) {
                        console.error("Error opening SSH shell:", err);
                        return socket.emit(
                            "data",
                            "\r\n*** SSH SHELL ERROR: " + err.message + " ***\r\n"
                        );
                    }
                    stream = newStream;

                    stream.setWindow(currentRows, currentCols, currentRows * 100, currentCols * 100);

                    socket.on("data", function (data) {
                        stream.write(data);
                    });

                    stream
                        .on("data", function (d) {
                            socket.emit("data", d.toString("binary"));
                        })
                        .on("close", function () {
                            console.log("SSH stream closed");
                            conn.end();
                        });
                });
            })
            .on("close", function () {
                console.log("SSH connection closed");
                socket.emit("data", "\r\n*** SSH CONNECTION CLOSED ***\r\n");
            })
            .on("error", function (err) {
                console.error("SSH connection error:", err);
                socket.emit(
                    "data",
                    "\r\n*** SSH CONNECTION ERROR: " + err.message + " ***\r\n"
                );
            })
            .connect({
                host: ip,
                port: port,
                username: user,
                password: password,
            });
    });

    socket.on("disconnect", () => {
        console.log("Client disconnected");
    });
});

server.listen(8081, () => {
    console.log("Server is running on port 8081");
});