const express = require("express");
const app = express();
const http = require("http").Server(app);
const io = require("socket.io")(http);
const PORT = process.env.PORT || 3000;
app.use(express.static(__dirname + "/public"));

const Redis = require("ioredis");
const REDIS_PREFIX = process.env.REDIS_PREFIX || "whiteboard-";
const { REDIS_URL } = process.env;
let redis;
if (REDIS_URL) {
  console.log(`connect to ${REDIS_URL}. prefix=${REDIS_PREFIX}`);
  redis = new Redis(REDIS_URL);
}

let lineHist = [];
let noteList = {};

async function saveLine() {
  redis && redis.set(REDIS_PREFIX + "lineHist", JSON.stringify(lineHist));
}
async function saveNote() {
  redis && redis.set(REDIS_PREFIX + "noteList", JSON.stringify(noteList));
}
async function load() {
  if (redis) {
    lineHist = JSON.parse(await redis.get(REDIS_PREFIX + "lineHist"));
    noteList = JSON.parse(await redis.get(REDIS_PREFIX + "noteList"));
    if (!lineHist) {
      lineHist = [];
    }
    if (!noteList) {
      noteList = {};
    }
  }
}
load();

function onConnection(socket) {
  socket.on("load", (data, ack) => {
    ack({ lineHist, noteList });
  });

  socket.on("drawLine", (data) => {
    lineHist.push(data);
    socket.broadcast.emit("drawLine", data);
    saveLine();
  });

  socket.on("updateNote", (data) => {
    noteList[data.id] = data;
    socket.broadcast.emit("updateNote", data);
    saveNote();
  });

  socket.on("deleteNote", (data) => {
    delete noteList[data.id];
    socket.broadcast.emit("deleteNote", data);
    saveNote();
  });

  socket.on("onClearBourd", (data, ack) => {
    lineHist = [];
    noteList = {};
    ack({ status: "OK" });
    saveLine();
    saveNote();
    socket.broadcast.emit("reload");
  });
}
io.on("connection", onConnection);

http.listen(PORT, () => console.log("listening on port " + PORT));
