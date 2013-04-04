/**
* Server side implementation for nodeblaster
*/

var MAX_PLAYERS = 5;

var gameState = {
  cols: 0,
  rows: 0,
  cellStates: [],
  players: [],
  monsters: [],
  bombs: []
};

var sockets;
module.exports = function(io) {
  sockets = io.sockets;
  
  sockets.on("connection", function(socket){
    brief(socket);
    addPlayer(socket);
    
    socket.on("control", function(action){
      socket.get("player", function(err, player) {
        if (player && !err) {
          if (player.state == "dead") {
            socket.set("player", undefined);
          } else {
            controlPlayer(player, action);
          }
        }
      });
    });
    socket.on("disconnect", function(){
      socket.get("player", function(err, player) {
        if (player && !err) {
          killSprite(player.id);
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
    moveInterval: 1000,
    bombs: 1,
    blast: 2,
    detonator: false
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
      placeBomb(player, player.col, player.row);
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

function detonateBomb(bomb, direction, blast, col, row) {
  if (!direction && getCellState(bomb.col, bomb.row) != "bomb")
    return false;
  if (!direction) {
    var col = bomb.col;
    var row = bomb.row;
    var blast = bomb.blast;
    removeBomb(col, row);
  }
  if (getCellState(col, row) == "pillar" || blast < 0) {
    return false;
  } else if (getCellState(col, row) == "wall") {
    blast = 0;
  } else if (getCellState(col, row) == "bomb") {
    detonateBomb(getBomb(col, row));
  }
  for(var i=0;i<gameState.players.length;i++) {
    var player = gameState.players[i];
    if (player.col == col && player.row == row) {
      killSprite(player.id);
      i--;
    }
  }
  for(var i=0;i<gameState.monsters.length;i++) {
    var monster = gameState.monsters[i];
    if (monster.col == col && monster.row == row) {
      killSprite(monster.id);
      i--;
    }
  }
  switch(direction) {
    case "up":
      updateCell(col, row, "explosion up end");
      if (blast > 0)
        setTimeout(function(){
          updateCell(col, row, "explosion up");
          detonateBomb(bomb, "up", blast-1, col, row-1);
        }, 200);
      break;
    case "down":
      updateCell(col, row, "explosion down end");
      if (blast > 0)
        setTimeout(function(){
          updateCell(col, row, "explosion down");
          detonateBomb(bomb, "down", blast-1, col, row+1);
        }, 200);
      break;
    case "left":
      updateCell(col, row, "explosion left end");
      if (blast > 0)
        setTimeout(function(){
          updateCell(col, row, "explosion left");
          detonateBomb(bomb, "left", blast-1, col-1, row);
        }, 200);
      break;
    case "right":
      updateCell(col, row, "explosion right end");
      if (blast > 0)
        setTimeout(function(){
          updateCell(col, row, "explosion right");
          detonateBomb(bomb, "right", blast-1, col+1, row);
        }, 200);
      break;
    default:
      updateCell(col, row, "explosion");
      setTimeout(function(){
        detonateBomb(bomb, "up", blast-1, col, row-1);
        detonateBomb(bomb, "down", blast-1, col, row+1);
        detonateBomb(bomb, "left", blast-1, col-1, row);
        detonateBomb(bomb, "right", blast-1, col+1, row);
      }, 200);
  }
  setTimeout(function(){
    updateCell(col, row, "floor");
  }, 1000);
}

function getCellState(col, row) {
  if (col < 0 || row < 0 || col >= gameState.cols || row >= gameState.rows)
    return "pillar";
  return gameState.cellStates[col][row];
}

function getBomb(col, row, remove) {
  var bomb = false, i=0;
  while (i<gameState.bombs.length && !bomb) {
    if (gameState.bombs[i].col == col && gameState.bombs[i].row == row) {
      bomb = gameState.bombs[i];
      if (remove) {
        gameState.bombs.splice(i, 1);
        bomb.player.bombs++;
        updateCell(col, row, "floor");
      }
    }
    i++;
  }
  return bomb;
}

function getSprite(id, remove) {
  var spriteArray;
  if (id.charAt(0) == "p") {
    spriteArray = gameState.players;
  } else if (id.charAt(0) == "m") {
    spriteArray = gameState.monsters;
  } else return false;
  var sprite = false, i=0;
  while (i<spriteArray.length && !sprite) {
    if (spriteArray[i].id == id) {
      sprite = spriteArray[i];
      if (remove) {
        sprite.state = "dead";
        spriteArray.splice(i, 1);
        sockets.emit(remove+" sprite", id);
      }
    }
    i++;
  }
  return sprite;
}

function killSprite(id) {
  return getSprite(id, "kill");
}

function placeBomb(player, col, row) {
  if (getCellState(col, row) == "bomb")
    return false;
  if (player.bombs <= 0) {
    if (player.detonator) {
      for(var i=0;i<gameState.bombs.length;i++) {
        var bomb = gameState.bombs[i];
        if (bomb.player == player) {
          detonateBomb(bomb);
          i--;
        }
      }
    }
    return player.detonator;
  }
  var bomb = {
    col: col,
    row: row,
    player: player,
    blast: player.blast
  };
  gameState.bombs.push(bomb);
  player.bombs--;
  if (!player.detonator)
    setTimeout(function(){
      detonateBomb(bomb);
    }, 5000);
  updateCell(col, row, "bomb");
}

function removeBomb(col, row) {
  return getBomb(col, row, true);
}

function removeSprite(id) {
  return getSprite(id, "remove");
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


