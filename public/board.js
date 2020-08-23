"use strict";

// config
const PEN_WIDTH = 4;
const ERASER_WIDTH = 50;
const signatureFormat = (signature) => {
  return signature.length > 0 ? `(${signature})` : "";
};
toastr.options = {
  closeButton: false,
  debug: false,
  newestOnTop: false,
  progressBar: true,
  positionClass: "toast-bottom-center",
  preventDuplicates: true,
  onclick: null,
  showDuration: "300",
  hideDuration: "1000",
  timeOut: "3000",
  extendedTimeOut: "1000",
  showEasing: "swing",
  hideEasing: "linear",
  showMethod: "fadeIn",
  hideMethod: "fadeOut",
};

(function () {
  const MENU_HEIGHT = 40;
  const PADDING = 30;
  const current = {
    x: 0,
    y: 0,
    color: "black",
    width: PEN_WIDTH,
    mode: "pen",
  };
  WebFont.load({
    custom: {
      families: ["Font Awesome 5 Free"],
    },
    active: function () {
      setCursor();
    },
  });
  let drawing = false;
  let handing = false;

  const canvas = document.getElementById("whiteboard");
  const context = canvas.getContext("2d");
  context.lineJoin = "round";
  context.lineCap = "round";

  const boxLayer = document.getElementById("box-layer");
  const boxContext = boxLayer.getContext("2d");
  boxContext.lineJoin = "round";
  boxContext.lineCap = "round";

  canvas.addEventListener("mousedown", onMouseDown, false);
  canvas.addEventListener("mouseup", onMouseUp, false);
  canvas.addEventListener("mouseout", onMouseUp, false);
  canvas.addEventListener("mousemove", throttle(onMouseMove, 10), false);

  //Touch support for mobile devices
  canvas.addEventListener("touchstart", onMouseDown, false);
  canvas.addEventListener("touchend", onMouseUp, false);
  canvas.addEventListener("touchcancel", onMouseUp, false);
  canvas.addEventListener("touchmove", throttle(onMouseMove, 10), false);

  $(".color").click(onPenSelect);
  $(".line").click((e) => onSelect(e, "line"));
  $(".box").click((e) => onSelect(e, "box"));
  $(".circle").click((e) => onSelect(e, "circle"));
  $(".sticky-notes").click(onStickyNoteSelect);
  $(".hand").click(onHandSelect);
  $("#clear-button").click(onClearBoard);

  const path = window.location.pathname;
  const boardId = path.slice(path.lastIndexOf("/") + 1);

  const socket = io("?boardId=" + boardId);
  socket.on("drawLine", drawLine);
  socket.on("updateNote", updateNote);
  socket.on("deleteNote", deleteNote);
  socket.on("clearBoard", () => {
    clearBoard();
    toastr.info("Someone cleared the board.", "Infomation");
  });
  socket.emit("load", null, (data) => {
    const { status, lineHist, noteList } = data;
    if (status === "NOT_FOUND") {
      $.confirm({
        theme: "supervan",
        icon: "fas fa-sad-tear",
        title: "NOT FOUND",
        content: "Sorry. The board was not found. Return to the top page.",
        buttons: {
          ok: function () {
            window.location.href = "/";
          },
        },
      });
    }
    for (let line of lineHist) {
      drawLine(line, false);
    }
    for (let key of Object.keys(noteList)) {
      updateNote(noteList[key]);
    }
  });

  function clearBoard() {
    context.clearRect(
      0,
      0,
      context.canvas.clientWidth,
      context.canvas.clientHeight
    );
    $(".clone-note").remove();
  }

  function drawLine(data, drawing, emit) {
    const x0 = data.x0 - PADDING;
    const x1 = data.x1 - PADDING;
    const y0 = data.y0 - PADDING - MENU_HEIGHT;
    const y1 = data.y1 - PADDING - MENU_HEIGHT;
    if (["box", "line", "circle"].includes(data.mode)) {
      const cxt = drawing ? boxContext : context;
      boxContext.clearRect(
        0,
        0,
        boxContext.canvas.clientWidth,
        boxContext.canvas.clientHeight
      );
      cxt.beginPath();
      if (data.mode === "line") {
        cxt.moveTo(x0, y0);
        cxt.lineTo(x1, y1);
      } else if (data.mode === "box") {
        cxt.rect(x0, y0, x1 - x0, y1 - y0);
      } else if (data.mode === "circle") {
        const harfW = (x1 - x0) / 2;
        const harfH = (y1 - y0) / 2;
        cxt.arc(
          x0 + harfW,
          y0 + harfH,
          Math.max(Math.abs(harfW), Math.abs(harfH)),
          0,
          2 * Math.PI
        );
      }
      cxt.strokeStyle = data.color;
      cxt.lineWidth = data.width;
      cxt.stroke();
      cxt.closePath();
    } else {
      context.beginPath();
      context.moveTo(data.x0 - PADDING, data.y0 - PADDING - MENU_HEIGHT);
      context.lineTo(data.x1 - PADDING, data.y1 - PADDING - MENU_HEIGHT);
      context.strokeStyle = data.color;
      context.lineWidth = data.width;
      context.stroke();
      context.closePath();
    }

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
      note.addClass("clone-note");

      const textarea = note.find(".expanding");
      note.draggable({
        drag: () => limitter(() => emitNoteState(note), 100),
        stop: () => {
          textarea.focus();
          emitNoteState(note);
        },
      });

      const delButton = note.find(".delete-note");
      delButton.click(() => {
        deleteNote({ id }, true);
      });

      setTimeout(() => autosize(textarea), 0);
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
    textarea.on("keyup mouseup touchend", () => {
      limitter(() => emitNoteState(note), 100);
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

  function saveCurrentPosition(e) {
    current.x = e.pageX || e.touches[0].pageX;
    current.y = e.pageY || e.touches[0].pageY;
  }

  function onMouseDown(e) {
    $(".note").css("pointer-events", "none");
    saveCurrentPosition(e);
    if (["pen", "line", "box", "circle"].includes(current.mode)) {
      drawing = true;
      handing = false;
    } else if (current.mode === "hand") {
      handing = true;
      drawing = false;
      current.mode = "rock";
      setCursor();
    } else {
      onNoteCreate();
    }
  }

  function onMouseUp(e) {
    $(".note").css("pointer-events", "auto");
    if (drawing) {
      drawing = false;
      drawLine(
        {
          x0: current.x,
          y0: current.y,
          x1: e.pageX || e.touches[0].pageX,
          y1: e.pageY || e.touches[0].pageY,
          color: current.color,
          width: current.width,
          mode: current.mode,
        },
        false,
        true
      );
    }
    if (handing) {
      handing = false;
      current.mode = "hand";
      setCursor();
    }
  }

  function onMouseMove(e) {
    const x0 = current.x;
    const y0 = current.y;
    const x1 = e.pageX || e.touches[0].pageX;
    const y1 = e.pageY || e.touches[0].pageY;
    if (drawing) {
      const isPenMode = current.mode === "pen";
      drawLine(
        {
          x0,
          y0,
          x1,
          y1,
          color: current.color,
          width: current.width,
          mode: current.mode,
        },
        true,
        isPenMode
      );
      if (isPenMode) {
        saveCurrentPosition(e);
      }
    }
    if (handing) {
      const orgX = $(window).scrollLeft();
      const orgY = $(window).scrollTop();
      const newX = orgX + x0 - x1;
      const newY = orgY + y0 - y1;
      $(window).scrollLeft(newX);
      $(window).scrollTop(newY);
    }
  }

  function onPenSelect(e) {
    const color = e.target.getAttribute("data-color");
    const eraser = color === "white";
    const width = eraser ? ERASER_WIDTH : PEN_WIDTH;
    current.color = color;
    current.width = width;
    current.mode = "pen";
    const shapeColor = eraser ? "black" : color;
    $(".shape").css("color", shapeColor);
    setCursor();
  }

  function onSelect(e, mode) {
    const width = PEN_WIDTH;
    if (current.color === "white") {
      current.color = "black";
    }
    current.width = width;
    current.mode = mode;
    setCursor();
  }

  function onStickyNoteSelect(e) {
    const color = e.target.getAttribute("data-color");
    current.color = color;
    current.mode = "sticky-note";
    setCursor();
  }

  function onHandSelect(e) {
    current.color = "black";
    current.mode = "hand";
    setCursor();
  }

  function onNoteCreate() {
    const color = current.color === "hotpink" ? "pink" : "lightyellow";
    const id = "note-" + generateUuid();
    const x = current.x - PADDING - 40;
    const y = current.y - PADDING - MENU_HEIGHT + 5;
    const msg = signatureFormat($("#signature").val());
    const w = $("#note-origin").css("width");
    const h = $("#note-origin").css("height");
    updateNote({ id, x, y, w, h, msg, color }, true);
  }

  function onClearBoard() {
    $.confirm({
      theme: "supervan",
      icon: "fas fa-trash",
      title: "CLEAR",
      content: "Clear the board. Are you okay?",
      buttons: {
        ok: function () {
          socket.emit("clearBoard", null, () => {
            clearBoard();
          });
        },
        cancel: function () {},
      },
    });
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

  let limitterTimer = null;
  function limitter(callback, delay) {
    if (!limitterTimer) {
      limitterTimer = setTimeout(() => {
        callback();
        limitterTimer = null;
      }, delay);
    }
  }

  function setCursor() {
    const mode = current.mode;
    let color = current.color;
    let unicode, size, tweakX, tweakY, regular;
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
    } else if (mode === "line") {
      unicode = "\uf547";
      size = 24;
      tweakX = 35;
      tweakY = 15;
    } else if (mode === "box") {
      unicode = "\uf0c8";
      size = 24;
      tweakX = 35;
      tweakY = 15;
      regular = true;
    } else if (mode === "circle") {
      unicode = "\uf111";
      size = 24;
      tweakX = 35;
      tweakY = 15;
      regular = true;
    } else if (mode === "sticky-note") {
      unicode = "\uf249";
      size = 24;
      tweakX = 25;
      tweakY = 25;
    } else if (mode === "hand") {
      unicode = "\uf256";
      size = 24;
      tweakX = 25;
      tweakY = 25;
      regular = true;
    } else if (mode === "rock") {
      unicode = "\uf255";
      size = 24;
      tweakX = 25;
      tweakY = 25;
      regular = true;
    }

    const canvas = document.createElement("canvas");
    canvas.width = size * 2;
    canvas.height = size * 2;

    const context = canvas.getContext("2d");
    const regularFont = regular ? "" : "900";
    context.font = `${regularFont} ${size}px "Font Awesome 5 Free"`;
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
