/**
* Server side implementation for nodeblaster
*/

var MAX_PLAYERS = 5;

var gameState = {
  cols: 0,
  rows: 0,
  cellStates: [],
  players: [],
  monsters: []
};

var sockets;
module.exports = function(io) {
  sockets = io.sockets;
  
  sockets.on("connection", function(socket){
    brief(socket);
    addPlayer(socket);
    
    socket.on("control", function(action){
      socket.get("player", function(err, player) {
        if (player && !err)
          controlPlayer(player, action);
      });
    });
    socket.on("disconnect", function(){
      socket.get("player", function(err, player) {
        if (player && !err) {
          player.state = "dead";
          sendSprite(player);
          setTimeout(function(){
            removeSprite(player.id);
          }, 3000);
        }
      });
    });
  });
  
  startGame();
}

function addPlayer(socket) {
  if (gameState.players.length >= MAX_PLAYERS)
    return false;
  var num = 1;
  while (getSprite("player"+num))
    num++;
  var player = {
    id: "player"+num,
    type: "player",
    state: "idle",
    direction: "down",
    col: 0,
    row: gameState.players.length,
    moveInterval: 1000
  };
  gameState.players.push(player);
  socket.set("player", player);
  socket.emit("assign player", player.id);
  sockets.emit("create sprite", player);
}

function brief(socket) {
  socket.emit("create battlefield", gameState.cols, gameState.rows);
  for (var row=0;row<gameState.rows;row++) {
    for (var col=0;col<gameState.cols;col++) {
      if (col%2==1 && row%2==1) {
        if (gameState.cellStates[col][row] != "pillar")
          socket.emit("update cell", col, row, gameState.cellStates[col][row]);
      } else {
        if (gameState.cellStates[col][row] != "floor")
          socket.emit("update cell", col, row, gameState.cellStates[col][row]);
      }
    }
  }
  for (var i=0;i<gameState.players.length;i++) {
    socket.emit("create sprite", gameState.players[i]);
  }
  for (var i=0;i<gameState.monsters.length;i++) {
    socket.emit("create sprite", gameState.monsters[i]);
  }
}

function controlPlayer(player, action) {
  if (["up", "down", "left", "right"].indexOf(action) > -1) {
    player.state = "move";
    player.direction = action;
  }
  switch(action) {
    case "up":
      player.row--;
      break;
    case "down":
      player.row++;
      break;
    case "left":
      player.col--;
      break;
    case "right":
      player.col++;
      break;
    case "stop":
      player.state = "idle";
      break;
    case "bomb":
      updateCell(player.col, player.row, "bomb");
      break;
  }
  sendSprite(player);
}

function createBattlefield(cols, rows) {
  gameState.cols = cols;
  gameState.rows = rows;
  gameState.cellStates = [];
  for (var col=0;col<cols;col++) {
    gameState.cellStates[col] = [];
    for (var row=0;row<rows;row++) {
      if (col%2==1 && row%2==1) {
        gameState.cellStates[col][row] = "pillar";
      } else {
        gameState.cellStates[col][row] = "floor";
      }
    }
  }
  sockets.emit("create battlefield", gameState.cols, gameState.rows);
}

function getCellState(col, row) {
  if (col < 0 || row < 0 || col >= gameState.cols || row >= gameState.rows)
    return "pillar";
  return gameState.cellStates[col][row];
}

function getSprite(id) {
  var spriteArray;
  if (id.charAt(0) == "p") {
    spriteArray = gameState.players;
  } else if (id.charAt(0) == "m") {
    spriteArray = gameState.monsters;
  } else return false;
  var sprite = false, i=0;
  while (i<spriteArray.length && !sprite) {
    if (spriteArray[i].id == id)
      sprite = spriteArray[i];
    i++;
  }
  return sprite;
}

function removeSprite(id) {
  var spriteArray;
  if (id.charAt(0) == "p") {
    spriteArray = gameState.players;
  } else if (id.charAt(0) == "m") {
    spriteArray = gameState.monsters;
  } else return false;
  var removed = false, i=0;
  while (i<spriteArray.length && !removed) {
    if (spriteArray[i].id == id) {
      spriteArray.splice(i, 1);
      sockets.emit("remove sprite", id);
      removed = true;
    }
    i++;
  }
  return removed;
}

function sendSprite(sprite) {
  sockets.emit("update sprite", sprite);
}

function startGame() {
  createBattlefield(13, 11);
}

function updateCell(col, row, state) {
  if (col < 0 || row < 0 || col >= gameState.cols || row >= gameState.rows)
    return false;
  gameState.cellStates[col][row] = state;
  sockets.emit("update cell", col, row, gameState.cellStates[col][row]);
}


