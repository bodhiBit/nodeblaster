/**
* Server side implementation for nodeblaster
*/

var gameState = {
  cols: 0,
  rows: 0,
  cellStates: [],
  players: [],
  monsters: []
};
var nextControllerKey = Date.now();

var sockets;
module.exports = function(io) {
  sockets = io.sockets;
  
  sockets.on("connection", function(socket){
    brief(socket);
    
    socket.on("control", function(action){
      controlPlayer(getSprite("player1"), action);
    });
  });
  
  startGame();
}

function status(req, res) {
  res.send(gameState);
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

function createPlayers(count) {
  gameState.players = [];
  for (var i=1;i<=count;i++) {
    var player = {
      id: "player"+i,
      type: "player",
      state: "idle",
      direction: "down",
      col: i,
      row: 0,
      moveInterval: 1000
    };
    gameState.players.push(player);
    sockets.emit("create sprite", player);
  }
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
  }
  return removed;
}

function sendSprite(sprite) {
  sockets.emit("update sprite", sprite);
}

function startGame() {
  createBattlefield(13, 11);
  createPlayers(3);
}

function updateCell(col, row, state) {
  if (col < 0 || row < 0 || col >= gameState.cols || row >= gameState.rows)
    return false;
  gameState.cellStates[col][row] = state;
  sockets.emit("update cell", col, row, gameState.cellStates[col][row]);
}


