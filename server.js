import express, { static as Static } from 'express';
const app = express();
import http from 'http';
const httpServer = http.createServer(app);
import { Server } from 'socket.io';
const io = new Server(httpServer);
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 5000;
import { v4 as uuidv4 } from "uuid";
import { Game } from './utils/Game.js';
import { Player } from './utils/Player.js';
import { ASSASSINATE, COUP, SERVER_MESSAGE, GUEST, HOST, IDLE, ACTIVE } from "./utils/constants.js";

io.eio.pingTimeout = 120000; // 2 minutes
io.eio.pingInterval = 5000;  // 5 seconds

httpServer.listen(PORT, () => {
    console.log(`Listening on PORT: ${PORT}...`)
});

app.set("view engine", "ejs");
app.set('views', __dirname + "/public");
app.use(Static("./public/"));
app.get('/', (req, res) => {
    // res.render("landing.ejs")
    res.send({Page: 'LANDING_PAGE'})
});
app.get('/room', (req,res) => {
    // res.render("room.ejs")
    res.send({Page: 'HOST_ROOM_PAGE'})
})
app.get('/guest', (req,res) => {
    // res.render("guest.ejs")
    res.send({Page: 'GUEST_ROOM_PAGE'})
})
app.get('/js/landing.js', (req, res) => {
    res.sendFile(__dirname + "/src/js/landing.js")
})
app.get('/:lobby/js/client.js', (req, res) => {
    res.sendFile(__dirname + "/src/js/client.js")
})

var roomCodesMap = new Map(); 

// Game Object Methods
const roomGenerate = function(socket) {
    while (true) {
        const roomCodeLong = uuidv4();
        const codeCandidate = roomCodeLong.substring(roomCodeLong.length - 6);
        if (!(roomCodesMap.has(codeCandidate))) {
            roomCodesMap.set(codeCandidate, 
                {host: socket.id, game: new Game(codeCandidate)});
            return codeCandidate;
        }
    }
}

// Messaging Methods

const broadCastMessage = function(code, message) {
    io.to(code).emit(SERVER_MESSAGE, message);
}

io.on("connect", socket => {
    let roomCode;
    let roomData;
    let gameData;
    let playerData;

    socket.on("create", (promptName) => {
        if (!promptName) {
            socket.emit("reenter")
        } else {
            roomCode = roomGenerate(socket);
            roomData = roomCodesMap.get(roomCode);
            gameData = roomData.game
            playerData = new Player(promptName, HOST);
            gameData.socketIdMapAdd(socket)
            gameData.alivePlayerAdd(socket.id, playerData);
            socket.join(roomCode);
            io.to(roomCode).emit(SERVER_MESSAGE, {Host: playerData.name, Code: roomCode});
        }
    });
    
    socket.on("join", (promptName, promptCode) => {
        // TODO: Handle case where someone tries to join while game in progress.
        if (!(promptName && roomCodesMap.get(promptCode))) {
            socket.emit("reenter");
        } else {
            roomCode = promptCode;
            roomData = roomCodesMap.get(roomCode);
            gameData = roomData.game;
            if (gameData.state === IDLE) {
                playerData = new Player(promptName, GUEST);
                gameData.alivePlayerAdd(socket.id, playerData);
                gameData.socketIdMapAdd(socket);
                socket.join(roomCode);
                broadCastMessage(roomCode, {Guest: playerData.name, Code: roomCode});
            }
        }
    });

    socket.on("disconnect", () => {
        if (roomData && io.sockets.adapter.rooms.get(roomCode)) {
            if (gameData.state === ACTIVE && gameData.alive.has(socket.id) 
            || (gameData.state === IDLE && playerData.status === HOST)) {
                broadCastMessage(roomCode, playerData.name + " has disconnected. Restart the game.")
                io.socketsLeave(roomCode);
                roomCodesMap.delete(roomCode);

            } else if (gameData.dead.has(socket.id)) {
                gameData.socketIdMapUpdateDelete(socket);
                gameData.deadPlayerDelete(socket.id);
                broadCastMessage(roomCode, playerData.name + " has disconnected.")
            } else {
                gameData.socketIdMapUpdateDelete(socket);
                gameData.alivePlayerDelete(socket.id);
                broadCastMessage(roomCode, playerData.name + " has disconnected.")
            }
        }
    });

    socket.on("startGame", () => {
        // setting up game
        if (socket.id === roomData.host) {
            gameData.resetGame();
            if (gameData.alive.size < 2) {
                socket.emit("needMorePlayers", `At least two players are needed.`);
            } else {
                const turnMessage = `It's ${gameData.alive.get(gameData.start.val).name}'s turn.`
                gameData.broadcastAll(SERVER_MESSAGE, turnMessage);
                gameData.notifyCurrTurn();
                gameData.notifyDisplayData();
            }
        }
    });

    socket.on("reqActionObj", async (reqAction) => {
        gameData.playerTurnCheck(reqAction, (action) => {
            const currPlayer = gameData.alive.get(action.actingPlayer)
            if (action.actionEvent === ASSASSINATE) {
                if (currPlayer && currPlayer.retrieveCoins >= 3) {
                    console.log(`CP #1`)
                    gameData.contestStack = [action];
                    currPlayer.updateCoins(-3);
                    socket.emit("paymentReceived")
                    gameData.actionRoutingMiddleman();
                }

            } else if (action.actionEvent === COUP) {
                if (currPlayer && currPlayer.retrieveCoins >= 7) {
                    console.log(`CP #1`)
                    gameData.contestStack = [action];
                    currPlayer.updateCoins(-7);
                    socket.emit("paymentReceived")
                    gameData.actionRoutingMiddleman();  
                }
            } else if (currPlayer && currPlayer.retrieveCoins >= 10) {
                if (action.actionEvent === COUP) {
                    console.log(`CP #1`)
                    gameData.contestStack = [action];
                    gameData.actionRoutingMiddleman(); 
                } 
            } else {
                console.log(`CP #1`)
                gameData.contestStack = [action];
                gameData.actionRoutingMiddleman(); 
            }
        });
    });
});