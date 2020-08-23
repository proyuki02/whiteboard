"use strict";

const RATE = 4;
function calc(position, y) {
  return (position - 30 - (y ? 40 : 0)) / RATE;
}
function drawLine(context, data) {
  const x0 = calc(data.x0);
  const x1 = calc(data.x1);
  const y0 = calc(data.y0, true);
  const y1 = calc(data.y1, true);
  if (["box", "line", "circle"].includes(data.mode)) {
    context.beginPath();
    if (data.mode === "line") {
      context.moveTo(x0, y0);
      context.lineTo(x1, y1);
    } else if (data.mode === "box") {
      context.rect(x0, y0, x1 - x0, y1 - y0);
    } else if (data.mode === "circle") {
      const harfW = (x1 - x0) / 2;
      const harfH = (y1 - y0) / 2;
      context.arc(
        x0 + harfW,
        y0 + harfH,
        Math.max(Math.abs(harfW), Math.abs(harfH)),
        0,
        2 * Math.PI
      );
    }
    context.strokeStyle = data.color;
    context.lineWidth = data.width / RATE;
    context.stroke();
    context.closePath();
  } else {
    context.beginPath();
    context.moveTo(x0, y0);
    context.lineTo(x1, y1);
    context.strokeStyle = data.color;
    context.lineWidth = data.width / RATE;
    context.stroke();
    context.closePath();
  }
}

// config
(function () {
  const socket = io();
  const btn = $("#create-board-button");
  btn.click(() => {
    socket.emit("createBoard", null, (data) => {
      window.location.href = "/board/" + data.boardId;
    });
  });

  socket.emit("recentBoards", null, (boards) => {
    for (const board of boards) {
      console.log(board);
      const boardDiv = $("#board-origin").clone();
      boardDiv.attr("id", board.boardId);
      boardDiv
        .find(".created")
        .text(new Date(board.createdTimestamp).toLocaleString("ja"));
      boardDiv.find(".link").attr("href", "/board/" + board.boardId);

      const whiteboard = boardDiv.find(".whiteboard")[0];
      const context = whiteboard.getContext("2d");
      context.lineJoin = "round";
      context.lineCap = "round";
      for (const line of board.lineHist) {
        drawLine(context, line);
      }

      boardDiv.removeClass("hidden");
      $("#boards").append(boardDiv);
    }
  });
})();
