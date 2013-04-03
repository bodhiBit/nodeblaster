var myPlayerId;

$(function(){
  implementInput();
  implementSocket();
});

function assignPlayer(id) {
  myPlayerId = id;
  pan("#"+myPlayerId);
}

function createBattlefield(width, height) {
  var html = '<table id="battlefield">';
  for (var row=0;row<height;row++) {
    html += '<tr>';
    for (var col=0;col<width;col++) {
      if (col%2==1 && row%2==1) {
        cellClass = "pillar";
      } else {
        cellClass = "floor";
      }
      html += '<td class="'+cellClass+'" id="cell_'+col+'_'+row+'"></td>';
    }
    html += '</tr>';
  }
  html += '</table>';
  $("#void").html(html);
}

function createSprite(properties) {
  if ($("#"+properties.id).size() == 0) {
    $("#void").append('<div class="idle down '+properties.type+'" id="'+properties.id+'"><img/></div>');
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

function implementInput() {
  var keyDown;
  var col = 0, row = 0;
  
  $(document).keydown(function(e){
    if (e.which == keyDown) return false;
    keyDown = e.which;
    
    switch(keyDown) {
      case 13: // Enter
        socket.emit("control", "bomb");
        break;
      case 32: // Space
        socket.emit("control", "bomb");
        break;
      case 37: // Left arrow
        socket.emit("control", "left");
        break;
      case 38: // Up arrow
        socket.emit("control", "up");
        break;
      case 39: // Right arrow
        socket.emit("control", "right");
        break;
      case 40: // Down arrow
        socket.emit("control", "down");
        break;
      case 65: // A
        socket.emit("control", "left");
        break;
      case 76: // L
        socket.emit("control", "down");
        break;
      case 79: // O
        socket.emit("control", "bomb");
        break;
      case 80: // P
        socket.emit("control", "up");
        break;
      case 83: // S
        socket.emit("control", "right");
        break;
      default:
        console.log("Key down: "+keyDown);
        return true;
    }
    return false;
  });
  $(document).keyup(function(e){
    keyDown = null;
    socket.emit("control", "stop");
  });
}

var socket;
function implementSocket() {
  socket = io.connect();
  socket.on('assign player', function(id) {
    assignPlayer(id);
  });
  socket.on('create battlefield', function(cols, rows) {
    createBattlefield(cols, rows);
  });
  socket.on('update cell', function(col, row, state) {
    updateCell(col, row, state);
  });
  socket.on('create sprite', function(properties) {
    createSprite(properties);
  });
  socket.on('update sprite', function(properties) {
    updateSprite(properties);
  });
  socket.on('remove sprite', function(id) {
    removeSprite(id);
  });
}

var panSelector = ".player";
function pan(selector) {
  if (selector != undefined)
    panSelector = selector;
  var x = 0, y = 0, count = 0;
  $(panSelector).each(function(i, el){
    x += ($(el).offset().left*2+$(el).width())/2;
    y += ($(el).offset().top*2+$(el).height())/2;
    count++;
  });
  if (count > 0) {
    x = x/count;
    y = y/count;
    $(window).scrollLeft(Math.round(x - $(window).width()/2));
    $(window).scrollTop(Math.round(y - $(window).height()/2));
  }
}
// setInterval(pan, 20);

function removeSprite(id) {
  $("#"+id).remove();
}

function updateCell(col, row, state) {
  $("#cell_"+col+"_"+row).removeClass("floor wall pillar bomb explosion up down"
    + " left right end powerup flame speed detonator").addClass(state);
}

function updateSprite(properties) {
  if (!properties.id)
    return false;
  var sprite = $("#"+properties.id);
  if (properties.state != undefined) {
    sprite.removeClass("idle move dead").addClass(properties.state);
    if (properties.state == "dead") {
      var bg_img = sprite.css('background-image').replace(/^url\((.+)\)/, '$1').replace(/["']/g, "");
      console.log("background image: "+bg_img);
      $("#"+properties.id+" img").attr("src", bg_img);
    }
  }
  if (properties.direction != undefined)
    sprite.removeClass("up down left right").addClass(properties.direction);
  if (properties.state == "move" && properties.col != undefined && properties.row != undefined) {
    var cell = $("#cell_"+properties.col+"_"+properties.row);
    if (cell.size() > 0) {
      sprite.animate({
        left: (cell.offset().left*2+cell.width()-sprite.width())/2,
        top: (cell.offset().top+cell.height()-sprite.height()),
        "z-index": (properties.row*100)
      }, properties.moveInterval || 1000, "linear");
      setTimeout(pan, properties.moveInterval || 1000);
    } else console.log("no cell!! #cell_"+properties.col+"_"+properties.row);
  }
}


