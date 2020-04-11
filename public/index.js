"use strict";

// config
(function () {
  const socket = io();
  const btn = $("#create-board-button");
  btn.click(() => {
    socket.emit("createBoard", null, (data) => {
      window.location.href = "/board/" + data.boardId;
    });
  });
})();
