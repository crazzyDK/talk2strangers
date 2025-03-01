const WebSocket = require("ws");

require("dotenv").config();

const PORT = process.env.PORT || 5000;

const wss = new WebSocket.Server({ port: PORT });
let waitingUsers = []; // Queue of users waiting to connect
let activePairs = new Map(); // Stores active user pairs

wss.on("connection", (ws) => {
    console.log("New user connected");

    ws.on("message", (message) => {
        const data = JSON.parse(message);

        if (data.type === "find_match") {
            if (waitingUsers.length > 0) {
                // Pair the user with the first waiting user
                const matchedUser = waitingUsers.shift();

                activePairs.set(ws, matchedUser);
                activePairs.set(matchedUser, ws);

                // Notify both users that they are connected
                matchedUser.send(JSON.stringify({ type: "match_found" }));
                ws.send(JSON.stringify({ type: "match_found" }));
            } else {
                // No available users, add to waiting queue
                waitingUsers.push(ws);
            }
        } else if (data.type === "offer") {
            // Forward WebRTC offer to the connected user
            const partner = activePairs.get(ws);
            if (partner) partner.send(JSON.stringify({ type: "offer", offer: data.offer }));
        } else if (data.type === "answer") {
            // Forward WebRTC answer to the connected user
            const partner = activePairs.get(ws);
            if (partner) partner.send(JSON.stringify({ type: "answer", answer: data.answer }));
        } else if (data.type === "ice-candidate") {
            // Forward ICE candidate to the connected user
            const partner = activePairs.get(ws);
            if (partner) partner.send(JSON.stringify({ type: "ice-candidate", candidate: data.candidate }));
        }
    });

    ws.on("close", () => {
        console.log("User disconnected");

        // Remove from waiting list
        waitingUsers = waitingUsers.filter((user) => user !== ws);

        // Remove from active pairs
        const partner = activePairs.get(ws);
        if (partner) {
            partner.send(JSON.stringify({ type: "user_disconnected" }));
            activePairs.delete(partner);
        }
        activePairs.delete(ws);
    });
});

console.log(`WebSocket Server running on ${PORT}`);
