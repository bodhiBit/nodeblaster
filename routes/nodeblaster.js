/**
* Server side implementation for nodeblaster
*/

var PLAYER_START = [
  {col: 0.0, row: 0.0},
  {col: 1.0, row: 1.0},
  {col: 1.0, row: 0.0},
  {col: 0.0, row: 1.0},
  {col: 0.5, row: 0.5}
];

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
            socket.set("player", null);
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
  if (gameState.players.length >= PLAYER_START.length)
    return false;
  var num = 1;
  while (getSprite("player"+num))
    num++;
  var player = {
    id: "player"+num,
    type: "player",
    state: "idle",
    direction: "down",
    col: Math.round((gameState.cols-1)*PLAYER_START[num-1].col),
    row: Math.round((gameState.rows-1)*PLAYER_START[num-1].row),
    moveInterval: 1000,
    bombs: 1,
    blast: 2,
    detonator: false
  };
  for(var row=player.row-1;row<=player.row+1;row++) {
    for(var col=player.col-1;col<=player.col+1;col++) {
      if (getCellState(col, row) != "pillar")
        updateCell(col, row, "floor");
    }
  }
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
  if (action == "bomb") {
    placeBomb(player);
  } else {
    player.action = action;
    if (!player.moving) {
      runPlayer(player);
    }
  }
}

function createBattlefield(cols, rows, wallChance) {
  gameState.cols = cols;
  gameState.rows = rows;
  gameState.cellStates = [];
  sockets.emit("create battlefield", cols, rows);
  for (var col=0;col<cols;col++) {
    gameState.cellStates[col] = [];
    for (var row=0;row<rows;row++) {
      if (col%2==1 && row%2==1) {
        gameState.cellStates[col][row] = "pillar";
      } else {
        var chance = Math.random();
        if (chance < wallChance) {
          updateCell(col, row, "wall");
        } else {
          gameState.cellStates[col][row] = "floor";
        }
      }
    }
  }
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
  var powerup = 0;
  if (getCellState(col, row) == "pillar" || blast < 0) {
    return false;
  } else if (getCellState(col, row) == "wall") {
    blast = 0;
    powerup = Math.round(Math.random()*15);
  } else if (getCellState(col, row) == "bomb") {
    detonateBomb(getBomb(col, row));
  }
  var doomedPlayers = getPlayersAt(col, row);
  for(var i=0;i<doomedPlayers.length;i++) {
    killSprite(doomedPlayers[i].id);
  }
  var doomedMonsters = getMonstersAt(col, row);
  for(var i=0;i<doomedMonsters.length;i++) {
    killSprite(doomedMonsters[i].id);
  }
  var blastSpeed = 100;
  switch(direction) {
    case "up":
      updateCell(col, row, "explosion up end");
      if (blast > 0)
        setTimeout(function(){
          updateCell(col, row, "explosion up");
          detonateBomb(bomb, "up", blast-1, col, row-1);
        }, blastSpeed);
      break;
    case "down":
      updateCell(col, row, "explosion down end");
      if (blast > 0)
        setTimeout(function(){
          updateCell(col, row, "explosion down");
          detonateBomb(bomb, "down", blast-1, col, row+1);
        }, blastSpeed);
      break;
    case "left":
      updateCell(col, row, "explosion left end");
      if (blast > 0)
        setTimeout(function(){
          updateCell(col, row, "explosion left");
          detonateBomb(bomb, "left", blast-1, col-1, row);
        }, blastSpeed);
      break;
    case "right":
      updateCell(col, row, "explosion right end");
      if (blast > 0)
        setTimeout(function(){
          updateCell(col, row, "explosion right");
          detonateBomb(bomb, "right", blast-1, col+1, row);
        }, blastSpeed);
      break;
    default:
      updateCell(col, row, "explosion");
      setTimeout(function(){
        detonateBomb(bomb, "up", blast-1, col, row-1);
        detonateBomb(bomb, "down", blast-1, col, row+1);
        detonateBomb(bomb, "left", blast-1, col-1, row);
        detonateBomb(bomb, "right", blast-1, col+1, row);
      }, blastSpeed);
  }
  setTimeout(function(){
    switch(powerup) {
      case 1:
        updateCell(col, row, "powerup bomb");
        break;
      case 2:
        updateCell(col, row, "powerup flame");
        break;
      case 3:
        updateCell(col, row, "powerup speed");
        break;
      case 4:
        updateCell(col, row, "powerup detonator");
        break;
      default:
        updateCell(col, row, "floor");
    }
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

function getMonstersAt(col, row) {
  var monsters = [];
  for(var i=0;i<gameState.monsters.length;i++) {
    if (gameState.monsters[i].col == col && gameState.monsters[i].row == row) {
      monsters.push(gameState.monsters[i]);
    }
  }
  return monsters;
}

function getPlayersAt(col, row) {
  var players = [];
  for(var i=0;i<gameState.players.length;i++) {
    if (gameState.players[i].col == col && gameState.players[i].row == row) {
      players.push(gameState.players[i]);
    }
  }
  return players;
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

function placeBomb(player) {
  var col = player.col;
  var row = player.row;
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

function runPlayer(player) {
  player.moving = true;
  player.state = "move";
  var destCol = player.col;
  var destRow = player.row;
  if (["up", "down", "left", "right"].indexOf(player.action) > -1)
    player.direction = player.action;
  switch(player.action) {
    case "up":
      if (["wall", "pillar"].indexOf(getCellState(destCol, destRow-1))<0)
        destRow--;
      else
        player.moving = false;
      break;
    case "down":
      if (["wall", "pillar"].indexOf(getCellState(destCol, destRow+1))<0)
        destRow++;
      else
        player.moving = false;
      break;
    case "left":
      if (["wall", "pillar"].indexOf(getCellState(destCol-1, destRow))<0)
        destCol--;
      else
        player.moving = false;
      break;
    case "right":
      if (["wall", "pillar"].indexOf(getCellState(destCol+1, destRow))<0)
        destCol++;
      else
        player.moving = false;
      break;
    default:
      player.state = "idle";
      player.moving = false;
  }
  sendSprite({
    id: player.id,
    state: player.state,
    direction: player.direction,
    col: destCol,
    row: destRow,
    moveInterval: player.moveInterval
  });
  if (player.moving) {
    setTimeout(function(){
      player.col = destCol;
      player.row = destRow;
      var cellState = getCellState(player.col, player.row);
      if (cellState.indexOf("explosion")>-1) {
        killSprite(player.id);
      } else if (cellState == "powerup bomb") {
        player.bombs++;
      } else if (cellState == "powerup flame") {
        player.blast++;
      } else if (cellState == "powerup speed") {
        player.moveInterval/=2;
      } else if (cellState == "powerup detonator") {
        player.detonator = true;
      } else if (getMonstersAt(player.col, player.row).length>0) {
        killSprite(player.id);
      }
      if (cellState.indexOf("powerup")>-1) {
        updateCell(player.col, player.row, "floor");
      }
    }, player.moveInterval/2);
    setTimeout(function(){
      runPlayer(player);
    }, player.moveInterval);
  }
}

function sendSprite(sprite) {
  sockets.emit("update sprite", sprite);
}

function startGame() {
  createBattlefield(13, 11, .5);
}

function updateCell(col, row, state) {
  if (col < 0 || row < 0 || col >= gameState.cols || row >= gameState.rows)
    return false;
  gameState.cellStates[col][row] = state;
  sockets.emit("update cell", col, row, gameState.cellStates[col][row]);
}


