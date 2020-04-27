const express = require("express");
const app = express();
const http = require("http").Server(app);
const io = require("socket.io")(http);
const { v1: uuidv1 } = require("uuid");
const PORT = process.env.PORT || 3000;
app.use(express.static(__dirname + "/public"));
app.get("/board/*", (req, res, next) => {
  res.sendFile(__dirname + "/public/board.html");
});

const Redis = require("ioredis");
const REDIS_PREFIX = process.env.REDIS_PREFIX || "whiteboard-";
const REDIS_TTL_SEC = process.env.REDIS_TTL_SEC || 30 * 24 * 60 * 60; // default: 30 days
const { REDIS_URL } = process.env;
let redis;
if (REDIS_URL) {
  console.log(
    `connect to ${REDIS_URL}. prefix=${REDIS_PREFIX} ttl=${REDIS_TTL_SEC}`
  );
  redis = new Redis(REDIS_URL);
}

const boards = {};

const saveLimitter = {};
async function saveBoard(boardId) {
  if (!redis || saveLimitter[boardId]) return;

  saveLimitter[boardId] = setTimeout(() => {
    redis.set(
      REDIS_PREFIX + "board-" + boardId,
      JSON.stringify(boards[boardId]),
      "ex",
      REDIS_TTL_SEC
    );
    delete saveLimitter[boardId];
    console.log("saveBoard", { boardId });
  }, 3000);
}
async function load() {
  if (redis) {
    const prefix = REDIS_PREFIX + "board-";
    const keys = await redis.keys(prefix + "*");
    for (const key of keys) {
      const boardId = key.replace(prefix, "");
      boards[boardId] = JSON.parse(await redis.get(key));
      console.log("load", { boardId });
    }
  }
}
load();

function onConnection(socket) {
  const { boardId } = socket.handshake.query;
  let lineHist = [];
  let noteList = {};
  if (boardId && boards[boardId]) {
    lineHist = boards[boardId].lineHist;
    noteList = boards[boardId].noteList;
  }
  socket.join(boardId);
  console.log("onConnection", { id: socket.id, boardId });

  socket.on("createBoard", (data, ack) => {
    const boardId = uuidv1();
    boards[boardId] = { lineHist: [], noteList: {} };
    ack({ boardId });
    saveBoard(boardId);
  });

  socket.on("load", (data, ack) => {
    if (!boardId || !boards[boardId]) {
      ack({ status: "NOT_FOUND" });
    }
    ack({ status: "OK", ...boards[boardId] });
  });

  socket.on("drawLine", (data) => {
    lineHist.push(data);
    socket.broadcast.to(boardId).emit("drawLine", data);
    saveBoard(boardId);
  });

  socket.on("updateNote", (data) => {
    noteList[data.id] = data;
    socket.broadcast.to(boardId).emit("updateNote", data);
    saveBoard(boardId);
  });

  socket.on("deleteNote", (data) => {
    delete noteList[data.id];
    socket.broadcast.to(boardId).emit("deleteNote", data);
    saveBoard(boardId);
  });

  socket.on("clearBoard", (data, ack) => {
    boards[boardId] = { lineHist: [], noteList: {} };
    ack({ status: "OK" });
    socket.broadcast.to(boardId).emit("clearBoard");
    saveBoard(boardId);
  });
}
io.on("connection", onConnection);

http.listen(PORT, () => console.log("listening on port " + PORT));
