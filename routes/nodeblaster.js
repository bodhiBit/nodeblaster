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

var sockets;
module.exports = function(io) {
  sockets = io.sockets;
  
  sockets.on("connection", function(socket){
    brief(socket);
    
    socket.on("move", function(direction){
      gameState.players[0].state = "move";
      gameState.players[0].direction = direction;
      switch(direction) {
        case "up":
          gameState.players[0].row--;
          break;
        case "down":
          gameState.players[0].row++;
          break;
        case "left":
          gameState.players[0].col--;
          break;
        case "right":
          gameState.players[0].col++;
          break;
      }
      sockets.emit("update sprite", gameState.players[0]);
    });
    socket.on("stop", function(){
      gameState.players[0].state = "idle";
      sockets.emit("update sprite", gameState.players[0]);
    });
    socket.on("set bomb", function(){
      var col = gameState.players[0].col;
      var row = gameState.players[0].row;
      updateCell(col, row, "bomb");
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

function startGame() {
  createBattlefield(13, 11);
  createPlayers(2);
}

function updateCell(col, row, state) {
  if (col < 0 || row < 0 || col >= gameState.cols || row >= gameState.rows)
    return false;
  gameState.cellStates[col][row] = state;
  sockets.emit("update cell", col, row, gameState.cellStates[col][row]);
}

