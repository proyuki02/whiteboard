"use strict";

const RATE = 4;
function calc(position, y) {
  return (position - 30 - (y ? 40 : 0)) / RATE;
}
function drawLine(context, data) {
  if (data.mode === "box") {
    context.beginPath();
    context.rect(
      calc(data.x0),
      calc(data.y0, true),
      calc(data.x1) - calc(data.x0),
      calc(data.y1) - calc(data.y0)
    );
    context.strokeStyle = data.color;
    context.lineWidth = data.width / RATE;
    context.stroke();
    context.closePath();
  } else {
    context.beginPath();
    context.moveTo(calc(data.x0), calc(data.y0, true));
    context.lineTo(calc(data.x1), calc(data.y1, true));
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
