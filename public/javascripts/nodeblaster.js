/**
 * Client side implementation for nodeblaster
 */
(function(){
  "use strict";

  var myPlayerId;
  var panSelector = ".player", panEnd = Date.now();
  var socket;
  var signupHtml, winnerHtml;

  $(function () {
    signupHtml = '<div id="signupWindow">' + $("#signupWindow").html() + '</div>';
    $("#signupWindow").remove();
    winnerHtml = '<div id="winnerWindow">' + $("#winnerWindow").html() + '</div>';
    $("#winnerWindow").remove();
    implementInput();
    implementSocket();
    setInterval(pan, 20);
  });

  function assignPlayer(id) {
    myPlayerId = id;
    if (id) {
      pan("#" + myPlayerId);
    } else {
      pan(".player");
    }
  }

  function createBattlefield(width, height) {
    var html = '<table id="battlefield">',
      col,
      row,
      cellClass;
    for (row = 0; row < height; row += 1) {
      html += '<tr>';
      for (col = 0; col < width; col += 1) {
        if (col % 2 == 1 && row % 2 === 1) {
          cellClass = "pillar";
        } else {
          cellClass = "floor";
        }
        html += '<td class="' + cellClass + '" id="cell_' + col + '_' + row +
          '"></td>';
      }
      html += '</tr>';
    }
    html += '</table>';
    $("#void").html(html);
    panEnd = Date.now() + 1000;
  }

  function createSprite(properties) {
    var parent, bg_img;

    if ($("#" + properties.id).size() === 0) {
      if ($("#playerList").size() > 0) {
        $("#playerList").append('<li><span class="floor" id="cell_' + properties.col + '_' +
          properties.row + '"></span><span></span></li>');
        $("#playerList span:last").text(properties.name);
        parent = "#cell_" + properties.col + '_' + properties.row;
      } else {
        parent = "#void";
      }
      $(parent).append('<div class="dead down ' + properties.type + '" id="' +
        properties.id + '"><img/></div>');
      bg_img = $("#" + properties.id).css("background-image").replace(
        /^url\(([\w\W]+)\)/,
        "$1"
      ).replace(/["']/g, "");
      $("#" + properties.id + " img").attr("src", bg_img);
      updateSprite({
        id: properties.id,
        state: "move",
        row: properties.row,
        col: properties.col,
        moveInterval: 100
      });
    }
    return updateSprite(properties);
  }

  function displaySignupWindow() {
    $("#void").html(signupHtml);
    $("#signupForm").submit(function (e) {
      $("#signupForm input").attr("disabled", "disabled");
      signUp($("#nameTxt").val());
      return false;
    });
    $("#nameTxt").val(localStorage.getItem("playerName"));
    $("#nameTxt").focus();
  }

  function displayWinnerWindow(winner) {
    $("#void").html(winnerHtml);
    if (winner) {
      $("#winnerWindow h1").text(winner.name + " has won the game! ^_^");
      createSprite(winner);
    } else {
      $("#winnerWindow h1").text("OMG! Everyone died! x_X");
    }
  }

  function implementInput() {
    var keyDown;

    $(document).keydown(function (e) {
      if ($("#signupForm").size() > 0 && !$("#signupForm input").attr("disabled")) {
        return true;
      }
      if (e.which === keyDown) {
        return false;
      }
      keyDown = e.which;

      switch (keyDown) {
      case 13:
        // Enter
        socket.emit("control", "bomb");
        break;
      case 32:
        // Space
        socket.emit("control", "bomb");
        break;
      case 37:
        // Left arrow
        socket.emit("control", "left");
        break;
      case 38:
        // Up arrow
        socket.emit("control", "up");
        break;
      case 39:
        // Right arrow
        socket.emit("control", "right");
        break;
      case 40:
        // Down arrow
        socket.emit("control", "down");
        break;
      case 65:
        // A
        socket.emit("control", "left");
        break;
      case 72:
        // H
        socket.emit("control", "left");
        break;
      case 73:
        // I
        socket.emit("control", "up");
        break;
      case 74:
        // J
        socket.emit("control", "down");
        break;
      case 75:
        // K
        socket.emit("control", "up");
        break;
      case 76:
        // L
        socket.emit("control", "right");
        break;
      case 83:
        // S
        socket.emit("control", "right");
        break;
      case 85:
        // U
        socket.emit("control", "bomb");
        break;
      default:
        console.log("Key down: " + keyDown);
        return true;
      }
      return false;
    });
    $(document).keyup(function (e) {
      if (e.which !== keyDown) {
        return false;
      }
      keyDown = null;
      socket.emit("control", "stop");
    });
  }

  function implementSocket() {
    socket = io.connect();
    socket.on("display signupWindow", function () {
      displaySignupWindow();
    });
    socket.on("display winnerWindow", function (winner) {
      displayWinnerWindow(winner);
    });
    socket.on("assign player", function (id) {
      assignPlayer(id);
    });
    socket.on("create battlefield", function (cols, rows) {
      createBattlefield(cols, rows);
    });
    socket.on("update cell", function (col, row, state) {
      updateCell(col, row, state);
    });
    socket.on("create sprite", function (properties) {
      if ($("#winnerWindow").size() === 0) {
        createSprite(properties);
      }
    });
    socket.on("kill sprite", function (id) {
      killSprite(id);
    });
    socket.on("update sprite", function (properties) {
      updateSprite(properties);
    });
    socket.on("remove sprite", function (id) {
      removeSprite(id);
    });
  }

  function killSprite(id) {
    updateSprite({
      id: id,
      state: "dead"
    });
    setTimeout(function () {
      removeSprite(id);
    }, 3000);
  }

  function pan(selector) {
    if (selector !== undefined) {
      panSelector = selector;
    }
    if (panEnd < Date.now()) {
      return false;
    }
    var x = 0,
      y = 0,
      count = 0;
    $(panSelector).each(function (i, el) {
      x += ($(el).offset().left * 2 + $(el).width()) / 2;
      y += ($(el).offset().top * 2 + $(el).height()) / 2;
      count += 1;
    });
    if (count > 0) {
      x = x / count;
      y = y / count;
      $(window).scrollLeft(Math.round(x - $(window).width() / 2));
      $(window).scrollTop(Math.round(y - $(window).height() / 2));
    }
  }

  function removeSprite(id) {
    $("#" + id).remove();
    if (myPlayerId === id) {
      assignPlayer(null);
    }
  }

  function signUp(name) {
    localStorage.setItem("playerName", name);
    socket.emit("sign up", name);
  }

  function updateCell(col, row, state) {
    $("#cell_" + col + "_" + row).removeClass(
      "floor wall pillar bomb explosion up down" +
        " left right end powerup flame speed detonator"
    ).addClass(state);
  }

  function updateSprite(properties) {
    var sprite, img, cell;

    if (!properties.id) {
      return false;
    }
    sprite = $("#" + properties.id);
    if (properties.state !== undefined) {
      if (properties.state === "dead") {
        img = $("#" + properties.id + " img").attr("src");
        $("#" + properties.id + " img").removeAttr("src", "");
        $("#" + properties.id + " img").attr("src", img);
      }
      sprite.removeClass("idle move dead").addClass(properties.state);
    }
    if (properties.direction !== undefined) {
      sprite.removeClass("up down left right").addClass(properties.direction);
    }
    if (properties.state === "move" && properties.col !== undefined &&
        properties.row !== undefined) {
      cell = $("#cell_" + properties.col + "_" + properties.row);
      if (cell.size() > 0) {
        sprite.animate({
          left: (cell.offset().left * 2 + cell.width() - sprite.width()) / 2,
          top: (cell.offset().top + cell.height() - sprite.height()),
          "z-index": (properties.row * 100)
        }, properties.moveInterval || 1000, "linear");
        // setTimeout(pan, properties.moveInterval || 1000);
        if (properties.id.charAt(0) === "p") {
          panEnd = Date.now() + (properties.moveInterval || 1000);
        }
      } else {
        console.log("no cell!! #cell_" + properties.col + "_" + properties.row);
      }
    }
  }

}());
