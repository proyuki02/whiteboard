"use strict";

// config
const PEN_WIDTH = 4;
const ERASER_WIDTH = 50;
const signatureFormat = (signature) => {
  return signature.length > 0 ? `(${signature})` : "";
};

(function () {
  const MENU_HEIGHT = 20;
  const PADDING = 10;

  const socket = io();
  const current = {
    x: 0,
    y: 0,
    color: "black",
    width: PEN_WIDTH,
    mode: "pen",
  };
  setCursor();
  setTimeout(setCursor(), 1000);
  let drawing = false;

  const canvas = document.getElementById("whiteboard");
  const context = canvas.getContext("2d");
  context.lineJoin = "round";
  context.lineCap = "round";

  canvas.addEventListener("mousedown", onMouseDown, false);
  canvas.addEventListener("mouseup", onMouseUp, false);
  canvas.addEventListener("mouseout", onMouseUp, false);
  canvas.addEventListener("mousemove", throttle(onMouseMove, 10), false);

  //Touch support for mobile devices
  canvas.addEventListener("touchstart", onMouseDown, false);
  canvas.addEventListener("touchend", onMouseUp, false);
  canvas.addEventListener("touchcancel", onMouseUp, false);
  canvas.addEventListener("touchmove", throttle(onMouseMove, 10), false);

  $(".colors").click(onPenSelect);
  $(".stickers").click(onStickerSelect);
  $("#clear-button").click(onClearBourd);

  socket.on("drawLine", drawLine);
  socket.on("updateNote", updateNote);
  socket.on("deleteNote", deleteNote);
  socket.on("reload", () => {
    window.location.reload();
  });
  socket.emit("load", null, (data) => {
    const { lineHist, noteList } = data;
    for (let line of lineHist) {
      drawLine(line);
    }
    for (let key of Object.keys(noteList)) {
      updateNote(noteList[key]);
    }
  });

  function drawLine(data, emit) {
    context.beginPath();
    context.moveTo(data.x0 - PADDING, data.y0 - PADDING - MENU_HEIGHT);
    context.lineTo(data.x1 - PADDING, data.y1 - PADDING - MENU_HEIGHT);
    context.strokeStyle = data.color;
    context.lineWidth = data.width;
    context.stroke();
    context.closePath();

    if (emit) {
      socket.emit("drawLine", data);
    }
  }

  function updateNote(data, emit) {
    const { id, x, y, w, h, msg, color } = data;
    let note = $(`#${id}`);
    if (!note.length) {
      note = $("#note-origin").clone();
      note.attr("id", id);
      note.removeClass("hidden");
      note.draggable({
        dragstart: () => emitNoteState(note),
        drag: () => emitNoteState(note),
        dragstop: () => emitNoteState(note),
      });

      const delButton = note.find(".delete-note");
      delButton.click(() => {
        deleteNote({ id }, true);
      });

      const textarea = note.find(".expanding");
      autosize(textarea);
      $("#sticky-note-container").append(note);
      if (emit) {
        setTimeout(() => {
          textarea.focus();
          const t = textarea.get(0);
          t.selectionStart = 0;
          t.selectionEnd = 0;
        }, 0);
      }
    }
    note.css({ left: x, top: y });
    const textarea = note.find(".expanding");
    textarea.val(msg);
    textarea.css({ "background-color": color, width: w, height: h });
    textarea.on("keyup mouseup mouseout mousemove touchend touchmove", () => {
      emitNoteState(note);
    });

    if (emit) {
      socket.emit("updateNote", { id, x, y, w, h, msg, color });
    }
  }

  function emitNoteState(note) {
    const id = note.attr("id");
    const x = note.css("left");
    const y = note.css("top");
    const textarea = note.find(".expanding");
    const w = textarea.css("width");
    const h = textarea.css("height");
    const msg = textarea.val();
    const color = textarea.css("background-color");
    socket.emit("updateNote", { id, x, y, w, h, msg, color });
  }

  function deleteNote(data, emit) {
    const { id } = data;
    const note = $(`#${id}`);
    if (note.length) {
      note.remove();
    }
    if (emit) {
      socket.emit("deleteNote", { id });
    }
  }

  function onMouseDown(e) {
    current.x = e.pageX || e.touches[0].pageX;
    current.y = e.pageY || e.touches[0].pageY;
    if (current.mode === "pen") {
      drawing = true;
      $(".note").css("pointer-events", "none");
    } else {
      onNoteCreate();
    }
  }

  function onMouseUp(e) {
    if (!drawing) {
      return;
    }
    drawing = false;
    $(".note").css("pointer-events", "auto");
    drawLine(
      {
        x0: current.x,
        y0: current.y,
        x1: e.pageX || e.touches[0].pageX,
        y1: e.pageY || e.touches[0].pageY,
        color: current.color,
        width: current.width,
      },
      true
    );
  }

  function onMouseMove(e) {
    if (!drawing) {
      return;
    }
    drawLine(
      {
        x0: current.x,
        y0: current.y,
        x1: e.pageX || e.touches[0].pageX,
        y1: e.pageY || e.touches[0].pageY,
        color: current.color,
        width: current.width,
      },
      true
    );
    current.x = e.pageX || e.touches[0].pageX;
    current.y = e.pageY || e.touches[0].pageY;
  }

  function onPenSelect(e) {
    const color = e.target.getAttribute("data-color");
    const eraser = color === "white";
    const width = eraser ? ERASER_WIDTH : PEN_WIDTH;
    current.color = color;
    current.width = width;
    current.mode = "pen";
    setCursor();
  }

  function onStickerSelect(e) {
    const color = e.target.getAttribute("data-color");
    current.color = color;
    current.mode = "sticker";
    setCursor();
  }

  function onNoteCreate() {
    const color = current.color === "hotpink" ? "pink" : "lightyellow";
    const id = "note-" + generateUuid();
    const x = current.x - 80;
    const y = current.y - 60;
    const msg = signatureFormat($("#signature").val());
    const w = $("#note-origin").css("width");
    const h = $("#note-origin").css("height");
    updateNote({ id, x, y, w, h, msg, color }, true);
  }

  function onClearBourd() {
    if (confirm("CLEAR the board. Are you okay?")) {
      socket.emit("onClearBourd", null, () => {
        window.location.reload();
      });
    }
  }

  // limit the number of events per second
  function throttle(callback, delay) {
    let previousCall = new Date().getTime();
    return function () {
      const time = new Date().getTime();
      if (time - previousCall >= delay) {
        previousCall = time;
        return callback.apply(null, arguments);
      }
    };
  }

  function setCursor() {
    const mode = current.mode;
    let color = current.color;
    let unicode, size, tweakX, tweakY;
    if (mode === "pen") {
      if (color === "white") {
        unicode = "\uf12d";
        size = 48;
        tweakX = 70;
        tweakY = 30;
        color = "black";
      } else {
        unicode = "\uf304";
        size = 24;
        tweakX = 25;
        tweakY = 25;
      }
    } else {
      unicode = "\uf249";
      size = 24;
      tweakX = 25;
      tweakY = 25;
    }

    const canvas = document.createElement("canvas");
    canvas.width = size * 2;
    canvas.height = size * 2;

    const context = canvas.getContext("2d");
    context.font = `900 ${size}px "Font Awesome 5 Free"`;
    context.fillStyle = color;
    context.fillText(unicode, canvas.width / 2, canvas.width / 2);

    $("#whiteboard").css(
      "cursor",
      `url(${canvas.toDataURL("image/png")}) ${tweakX} ${tweakY}, auto`
    );
  }

  const generateUuid = (
    $ = (a, b) => (Math.floor(Math.random() * a) + b).toString(16)
  ) =>
    "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx"
      .replace(/x/g, (_) => $(16, 0))
      .replace(/y/g, (_) => $(4, 8));
})();
