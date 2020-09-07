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

// define
const MODE = {
  pen: "pen",
  line: "line",
  box: "box",
  circle: "circle",
  sticky_note: "sticky-note",
  hand: "hand",
  rock: "rock",
};

const ACTION = {
  drawLine: "drawLine",
  deleteNote: "deleteNote",
  createNote: "createNote",
  changeNote: "changeNote",
};

(function () {
  const MENU_HEIGHT = 40;
  const PADDING = 30;
  const current = {
    id: "",
    x: 0,
    y: 0,
    color: "black",
    width: PEN_WIDTH,
    mode: MODE.pen,
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
  let editing = false;

  const actionHistory = [];
  let actionPointer = -1;
  function putAction(data) {
    if (actionHistory.length - 1 > actionPointer) {
      actionHistory.splice(actionPointer + 1);
    }
    actionHistory.push(data);
    actionPointer += 1;
  }
  function resetActionHistory() {
    actionHistory.splice(0);
    actionPointer = -1;
  }

  const canvas = document.getElementById("whiteboard");
  const context = canvas.getContext("2d");
  context.lineJoin = "round";
  context.lineCap = "round";

  const shapeLayer = document.getElementById("shape-layer");
  const shapeContext = shapeLayer.getContext("2d");
  shapeContext.lineJoin = "round";
  shapeContext.lineCap = "round";

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
  $(".line").click((e) => onSelect(e, MODE.line));
  $(".box").click((e) => onSelect(e, MODE.box));
  $(".circle").click((e) => onSelect(e, MODE.circle));
  $(".sticky-notes").click(onStickyNoteSelect);
  $(".hand").click(onHandSelect);
  $(".undo").click(onUndo);
  $(".redo").click(onRedo);
  $("#clear-button").click(onClearBoard);
  addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && !editing) {
      if (event.key === "z") {
        onUndo();
      } else if (event.key === "y") {
        onRedo();
      }
    }
  });

  const path = window.location.pathname;
  const boardId = path.slice(path.lastIndexOf("/") + 1);

  const socket = io("?boardId=" + boardId);
  socket.on("drawLine", drawLine);
  socket.on("updateNote", updateNote);
  socket.on("redraw", redraw);
  socket.on("hideNote", onHideNote);
  socket.on("clearBoard", () => {
    clearBoard();
    toastr.info("Someone cleared the board.", "Infomation");
  });
  socket.emit("load", null, (data) => {
    console.log("load", data);
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

  function redraw(data) {
    const { lineHist } = data;
    context.clearRect(
      0,
      0,
      context.canvas.clientWidth,
      context.canvas.clientHeight
    );
    for (const line of lineHist) {
      drawLine(line, false);
    }
  }

  function clearBoard() {
    context.clearRect(
      0,
      0,
      context.canvas.clientWidth,
      context.canvas.clientHeight
    );
    $(".clone-note").remove();
    resetActionHistory();
  }

  function onUndo() {
    if (actionPointer < 0) {
      toastr.info("You can't undo anymore.", "Infomation");
      return;
    }
    const action = actionHistory[actionPointer];
    actionPointer -= 1;
    if (action.act === ACTION.drawLine) {
      socket.emit("hideLine", { id: action.id, hidden: true });
    } else if (action.act === ACTION.deleteNote) {
      socket.emit("hideNote", { id: action.id, hidden: false });
    } else if (action.act === ACTION.createNote) {
      socket.emit("hideNote", { id: action.id, hidden: true });
    } else if (action.act === ACTION.changeNote) {
      updateNote(action.old, true);
    }
  }

  function onRedo() {
    if (actionPointer === actionHistory.length - 1) {
      toastr.info("You can't redo anymore.", "Infomation");
      return;
    }
    actionPointer += 1;
    const action = actionHistory[actionPointer];
    if (action.act === ACTION.drawLine) {
      socket.emit("hideLine", { id: action.id, hidden: false });
    } else if (action.act === ACTION.deleteNote) {
      socket.emit("hideNote", { id: action.id, hidden: true });
    } else if (action.act === ACTION.createNote) {
      socket.emit("hideNote", { id: action.id, hidden: false });
    } else if (action.act === ACTION.changeNote) {
      updateNote(action.new, true);
    }
  }

  function drawLine(data, drawing, emit) {
    if (data.hidden) return;

    const x0 = data.x0 - PADDING;
    const x1 = data.x1 - PADDING;
    const y0 = data.y0 - PADDING - MENU_HEIGHT;
    const y1 = data.y1 - PADDING - MENU_HEIGHT;
    if ([MODE.box, MODE.line, MODE.circle].includes(data.mode)) {
      const cxt = drawing ? shapeContext : context;
      shapeContext.clearRect(
        0,
        0,
        shapeContext.canvas.clientWidth,
        shapeContext.canvas.clientHeight
      );
      cxt.beginPath();
      if (data.mode === MODE.line) {
        cxt.moveTo(x0, y0);
        cxt.lineTo(x1, y1);
      } else if (data.mode === MODE.box) {
        cxt.rect(x0, y0, x1 - x0, y1 - y0);
      } else if (data.mode === MODE.circle) {
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

  let noteCache = {};
  function updateNote(data, emit) {
    const { id, x, y, w, h, msg, color, hidden } = data;
    let note = $(`#${id}`);
    if (!note.length) {
      note = $("#note-origin").clone();
      note.attr("id", id);
      note.removeClass("hidden");
      note.addClass("clone-note");
      note.mouseenter(() => {
        noteCache = getNoteInfo(note);
      });
      note.mouseleave(() => {
        const noteInfo = getNoteInfo(note);
        if (
          noteCache.x !== noteInfo.x ||
          noteCache.y !== noteInfo.y ||
          noteCache.w !== noteInfo.w ||
          noteCache.h !== noteInfo.h ||
          noteCache.msg !== noteInfo.msg
        ) {
          putAction({
            act: ACTION.changeNote,
            id,
            old: noteCache,
            new: noteInfo,
          });
        }
      });

      const textarea = note.find(".expanding");
      note.draggable({
        drag: () => limitter(() => emitNoteState(note), 100),
        stop: () => {
          textarea.focus();
          emitNoteState(note);
        },
      });
      textarea.focusin(() => {
        editing = true;
      });
      textarea.focusout(() => {
        editing = false;
      });

      const delButton = note.find(".delete-note");
      delButton.click(() => {
        deleteNote(id);
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
    textarea.css({ width: w, height: h });
    if (color) {
      textarea.css({ "background-color": color });
    }
    textarea.on("keyup mouseup touchend", () => {
      limitter(() => emitNoteState(note), 100);
    });

    if (hidden) {
      note.hide();
    } else {
      note.show();
    }

    if (emit) {
      socket.emit("updateNote", { id, x, y, w, h, msg, color, hidden });
    }
  }

  function getNoteInfo(note) {
    const id = note.attr("id");
    const x = parseInt(note.css("left"), 10);
    const y = parseInt(note.css("top"), 10);
    const textarea = note.find(".expanding");
    const w = parseInt(textarea.css("width"), 10);
    const h = parseInt(textarea.css("height"), 10);
    const msg = textarea.val();
    const hiden = note.css("display") === "block";
    return { id, x, y, w, h, msg, hiden };
  }

  function emitNoteState(note) {
    const { id, x, y, w, h, msg } = getNoteInfo(note);
    socket.emit("updateNote", { id, x, y, w, h, msg });
  }

  function deleteNote(id) {
    socket.emit("hideNote", { id, hidden: true });
    putAction({ act: ACTION.deleteNote, id });
  }

  function onHideNote(data) {
    if (data.hidden) {
      $(`#${data.id}`).hide();
    } else {
      $(`#${data.id}`).show();
    }
  }

  function saveCurrentPosition(e) {
    current.x = e.pageX || e.touches[0].pageX;
    current.y = e.pageY || e.touches[0].pageY;
  }

  function onMouseDown(e) {
    $(".note").css("pointer-events", "none");
    saveCurrentPosition(e);
    if ([MODE.pen, MODE.line, MODE.box, MODE.circle].includes(current.mode)) {
      drawing = true;
      handing = false;
      current.id = generateUniqueId();
    } else if (current.mode === MODE.hand) {
      handing = true;
      drawing = false;
      current.mode = MODE.rock;
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
          id: current.id,
        },
        false,
        true
      );
      putAction({ act: ACTION.drawLine, id: current.id });
    }
    if (handing) {
      handing = false;
      current.mode = MODE.hand;
      setCursor();
    }
  }

  function onMouseMove(e) {
    const x0 = current.x;
    const y0 = current.y;
    const x1 = e.pageX || e.touches[0].pageX;
    const y1 = e.pageY || e.touches[0].pageY;
    if (drawing) {
      const isPenMode = current.mode === MODE.pen;
      drawLine(
        {
          x0,
          y0,
          x1,
          y1,
          color: current.color,
          width: current.width,
          mode: current.mode,
          id: current.id,
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
    current.mode = MODE.pen;
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
    current.mode = MODE.sticky_note;
    setCursor();
  }

  function onHandSelect(e) {
    current.color = "black";
    current.mode = MODE.hand;
    setCursor();
  }

  function onNoteCreate() {
    const color = current.color === "hotpink" ? "pink" : "lightyellow";
    const id = "note-" + generateUniqueId();
    const x = current.x - PADDING - 40;
    const y = current.y - PADDING - MENU_HEIGHT + 5;
    const msg = signatureFormat($("#signature").val());
    const w = parseInt($("#note-origin").css("width"), 10);
    const h = parseInt($("#note-origin").css("height"), 10);
    updateNote({ id, x, y, w, h, msg, color, hidden: false }, true);
    putAction({ act: ACTION.createNote, id });
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
    if (mode === MODE.pen) {
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
    } else if (mode === MODE.line) {
      unicode = "\uf547";
      size = 24;
      tweakX = 35;
      tweakY = 15;
    } else if (mode === MODE.box) {
      unicode = "\uf0c8";
      size = 24;
      tweakX = 35;
      tweakY = 15;
      regular = true;
    } else if (mode === MODE.circle) {
      unicode = "\uf111";
      size = 24;
      tweakX = 35;
      tweakY = 15;
      regular = true;
    } else if (mode === MODE.sticky_note) {
      unicode = "\uf249";
      size = 24;
      tweakX = 25;
      tweakY = 25;
    } else if (mode === MODE.hand) {
      unicode = "\uf256";
      size = 24;
      tweakX = 25;
      tweakY = 25;
      regular = true;
    } else if (mode === MODE.rock) {
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

  function generateUniqueId() {
    const strong = 65535;
    return (
      new Date().getTime().toString(16) +
      "-" +
      Math.floor(strong * Math.random()).toString(16) +
      "-" +
      Math.floor(strong * Math.random()).toString(16) +
      "-" +
      Math.floor(strong * Math.random()).toString(16)
    );
  }
})();
