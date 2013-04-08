/**
 * Server side implementation for nodeblaster
 */
/*jslint indent: 2, node: true */
"use strict";

var PLAYER_START = [{
    col: 0.0,
    row: 0.0
  }, {
    col: 1.0,
    row: 1.0
  }, {
    col: 1.0,
    row: 0.0
  }, {
    col: 0.0,
    row: 1.0
  }, {
    col: 0.5,
    row: 0.5
  }
    ],
  MONSTER_START = [{
    col: 0.75,
    row: 0.75
  }, {
    col: 0.25,
    row: 0.25
  }, {
    col: 0.25,
    row: 0.75
  }, {
    col: 0.75,
    row: 0.25
  }
    ];

var gameState = {
  cols: 0,
  rows: 0,
  cellStates: [],
  players: [],
  monsters: [],
  bombs: []
};
var genocideTO;
var sockets;

/*global addMonster, addMonsters, addPlayer, brief, clearTimeout, controlPlayer,
  createBattlefield, detonateBomb, getBomb, getCellState, getMonstersAt,
  getPlayersAt, getSprite, killSprite, module, placeBomb, removeBomb,
  removeSprite, runMonster, runPlayer, sendSprite, setGenocide, setTimeout,
  startGame, updateCell */

module.exports = function (io) {
  sockets = io.sockets;

  sockets.on("connection", function (socket) {
    brief(socket);
    addPlayer(socket);

    socket.on("control", function (action) {
      socket.get("player", function (err, player) {
        if (player && !err) {
          if (player.state === "dead") {
            socket.set("player", null);
          } else {
            controlPlayer(player, action);
          }
        }
      });
    });
  });

  startGame();
};

function addMonster() {
  var num = 1,
    monster;
  while (getSprite("monster" + num)) {
    num += 1;
  }
  monster = {
    id: "monster" + num,
    type: "monster",
    state: "idle",
    direction: "down",
    col: Math.round((gameState.cols - 1) * MONSTER_START[0].col),
    row: Math.round((gameState.rows - 1) * MONSTER_START[0].row),
    moveInterval: 1000,
    bombs: 1,
    blast: 2,
    detonator: false
  };
  gameState.monsters.push(monster);
  sockets.emit("create sprite", monster);
  runMonster(monster);
  MONSTER_START.push(MONSTER_START.shift());
}

function addMonsters() {
  var i;
  for (i = 0; i < PLAYER_START.length * 2; i += 1) {
    addMonster();
  }
}

function addPlayer(socket) {
  var player, num, row, col;

  setGenocide();
  if (gameState.players.length >= PLAYER_START.length) {
    return false;
  }
  num = 1;
  while (getSprite("player" + num)) {
    num += 1;
  }
  player = {
    id: "player" + num,
    type: "player",
    state: "idle",
    direction: "down",
    col: Math.round((gameState.cols - 1) * PLAYER_START[num - 1].col),
    row: Math.round((gameState.rows - 1) * PLAYER_START[num - 1].row),
    moveInterval: 1000,
    bombs: 1,
    blast: 2,
    detonator: false
  };
  for (row = player.row - 1; row <= player.row + 1; row += 1) {
    for (col = player.col - 1; col <= player.col + 1; col += 1) {
      if (getCellState(col, row) !== "pillar") {
        updateCell(col, row, "floor");
      }
    }
  }
  gameState.players.push(player);
  socket.set("player", player);
  socket.emit("assign player", player.id);
  sockets.emit("create sprite", player);
  while (gameState.monsters.length > 2 * (PLAYER_START.length - gameState.players
    .length)) {
    killSprite(gameState.monsters[0].id);
  }
}

function brief(socket) {
  var row, col, i;

  socket.emit("create battlefield", gameState.cols, gameState.rows);
  for (row = 0; row < gameState.rows; row += 1) {
    for (col = 0; col < gameState.cols; col += 1) {
      if (col % 2 === 1 && row % 2 === 1) {
        if (gameState.cellStates[col][row] !== "pillar") {
          socket.emit("update cell", col, row, gameState.cellStates[col][row]);
        }
      } else {
        if (gameState.cellStates[col][row] !== "floor") {
          socket.emit("update cell", col, row, gameState.cellStates[col][row]);
        }
      }
    }
  }
  for (i = 0; i < gameState.players.length; i += 1) {
    socket.emit("create sprite", gameState.players[i]);
  }
  for (i = 0; i < gameState.monsters.length; i += 1) {
    socket.emit("create sprite", gameState.monsters[i]);
  }
}

function controlPlayer(player, action) {
  setGenocide();
  if (action === "bomb") {
    placeBomb(player);
  } else {
    player.action = action;
    if (!player.moving) {
      runPlayer(player);
    }
  }
}

function createBattlefield(cols, rows, wallChance) {
  var col, row, chance;

  gameState.cols = cols;
  gameState.rows = rows;
  gameState.cellStates = [];
  sockets.emit("create battlefield", cols, rows);
  for (col = 0; col < cols; col += 1) {
    gameState.cellStates[col] = [];
    for (row = 0; row < rows; row += 1) {
      if (col % 2 === 1 && row % 2 === 1) {
        gameState.cellStates[col][row] = "pillar";
      } else {
        chance = Math.random();
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
  var doomedPlayers, doomedMonsters, powerup = 0,
    i, blastSpeed = 100;

  if (!direction && getCellState(bomb.col, bomb.row) !== "bomb") {
    return false;
  }
  if (!direction) {
    col = bomb.col;
    row = bomb.row;
    blast = bomb.blast;
    removeBomb(col, row);
  }
  if (getCellState(col, row) === "pillar" || blast < 0) {
    return false;
  }
  if (getCellState(col, row) === "wall") {
    blast = 0;
    powerup = Math.round(Math.random() * 15);
  } else if (getCellState(col, row) === "bomb") {
    detonateBomb(getBomb(col, row));
  }
  doomedPlayers = getPlayersAt(col, row);
  for (i = 0; i < doomedPlayers.length; i += 1) {
    killSprite(doomedPlayers[i].id);
  }
  doomedMonsters = getMonstersAt(col, row);
  for (i = 0; i < doomedMonsters.length; i += 1) {
    killSprite(doomedMonsters[i].id);
  }
  switch (direction) {
  case "up":
    updateCell(col, row, "explosion up end");
    if (blast > 0) {
      setTimeout(function () {
        updateCell(col, row, "explosion up");
        detonateBomb(bomb, "up", blast - 1, col, row - 1);
      }, blastSpeed);
    }
    break;
  case "down":
    updateCell(col, row, "explosion down end");
    if (blast > 0) {
      setTimeout(function () {
        updateCell(col, row, "explosion down");
        detonateBomb(bomb, "down", blast - 1, col, row + 1);
      }, blastSpeed);
    }
    break;
  case "left":
    updateCell(col, row, "explosion left end");
    if (blast > 0) {
      setTimeout(function () {
        updateCell(col, row, "explosion left");
        detonateBomb(bomb, "left", blast - 1, col - 1, row);
      }, blastSpeed);
    }
    break;
  case "right":
    updateCell(col, row, "explosion right end");
    if (blast > 0) {
      setTimeout(function () {
        updateCell(col, row, "explosion right");
        detonateBomb(bomb, "right", blast - 1, col + 1, row);
      }, blastSpeed);
    }
    break;
  default:
    updateCell(col, row, "explosion");
    setTimeout(function () {
      detonateBomb(bomb, "up", blast - 1, col, row - 1);
      detonateBomb(bomb, "down", blast - 1, col, row + 1);
      detonateBomb(bomb, "left", blast - 1, col - 1, row);
      detonateBomb(bomb, "right", blast - 1, col + 1, row);
    }, blastSpeed);
  }
  setTimeout(function () {
    switch (powerup) {
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

function getBomb(col, row, remove) {
  var bomb = false,
    i = 0;
  while (i < gameState.bombs.length && !bomb) {
    if (gameState.bombs[i].col === col && gameState.bombs[i].row === row) {
      bomb = gameState.bombs[i];
      if (remove) {
        gameState.bombs.splice(i, 1);
        bomb.player.bombs += 1;
        updateCell(col, row, "floor");
      }
    }
    i += 1;
  }
  return bomb;
}

function getCellState(col, row) {
  if (col < 0 || row < 0 || col >= gameState.cols || row >= gameState.rows) {
    return "pillar";
  }
  return gameState.cellStates[col][row];
}

function getMonstersAt(col, row) {
  var i, monsters = [];

  for (i = 0; i < gameState.monsters.length; i += 1) {
    if (gameState.monsters[i].col === col && gameState.monsters[i].row === row) {
      monsters.push(gameState.monsters[i]);
    }
  }
  return monsters;
}

function getPlayersAt(col, row) {
  var i, players = [];

  for (i = 0; i < gameState.players.length; i += 1) {
    if (gameState.players[i].col === col && gameState.players[i].row === row) {
      players.push(gameState.players[i]);
    }
  }
  return players;
}

function getSprite(id, remove) {
  var spriteArray, sprite = false,
    i = 0;

  if (id.charAt(0) === "p") {
    spriteArray = gameState.players;
  } else if (id.charAt(0) === "m") {
    spriteArray = gameState.monsters;
  } else {
    return false;
  }
  while (i < spriteArray.length && !sprite) {
    if (spriteArray[i].id === id) {
      sprite = spriteArray[i];
      if (remove) {
        sprite.state = "dead";
        spriteArray.splice(i, 1);
        sockets.emit(remove + " sprite", id);
      }
    }
    i += 1;
  }
  return sprite;
}

function killSprite(id) {
  if (id.charAt(0) === "p") {
    setTimeout(function () {
      addMonster();
      addMonster();
    }, 5000);
  }
  return getSprite(id, "kill");
}

function placeBomb(player) {
  var i, col = player.col,
    row = player.row,
    bomb;

  if (getCellState(col, row) === "bomb") {
    return false;
  }
  if (player.bombs <= 0) {
    if (player.detonator) {
      for (i = 0; i < gameState.bombs.length; i += 1) {
        bomb = gameState.bombs[i];
        if (bomb.player === player) {
          detonateBomb(bomb);
          i -= 1;
        }
      }
    }
    return player.detonator;
  }
  bomb = {
    col: col,
    row: row,
    player: player,
    blast: player.blast
  };
  gameState.bombs.push(bomb);
  player.bombs -= 1;
  if (!player.detonator) {
    setTimeout(function () {
      detonateBomb(bomb);
    }, 5000);
  }
  updateCell(col, row, "bomb");
}

function removeBomb(col, row) {
  return getBomb(col, row, true);
}

function removeSprite(id) {
  return getSprite(id, "remove");
}

function runMonster(monster) {
  var destCol = monster.col,
    destRow = monster.row,
    options = ["up", "down", "left", "right"],
    obstructions = ["wall", "pillar", "bomb"],
    sprite;

  if (monster.state === "dead") {
    return false;
  }
  monster.moving = true;
  monster.state = "move";
  monster.action = options[Math.floor(Math.random() * options.length)];
  if (["up", "down", "left", "right"].indexOf(monster.action) > -1) {
    monster.direction = monster.action;
  }
  switch (monster.action) {
  case "up":
    if (obstructions.indexOf(getCellState(destCol, destRow - 1)) < 0) {
      destRow -= 1;
    } else {
      monster.moving = false;
    }
    break;
  case "down":
    if (obstructions.indexOf(getCellState(destCol, destRow + 1)) < 0) {
      destRow += 1;
    } else {
      monster.moving = false;
    }
    break;
  case "left":
    if (obstructions.indexOf(getCellState(destCol - 1, destRow)) < 0) {
      destCol -= 1;
    } else {
      monster.moving = false;
    }
    break;
  case "right":
    if (obstructions.indexOf(getCellState(destCol + 1, destRow)) < 0) {
      destCol += 1;
    } else {
      monster.moving = false;
    }
    break;
  default:
    monster.state = "idle";
    monster.moving = false;
  }
  sprite = {
    id: monster.id,
    state: monster.state,
    direction: monster.direction,
    moveInterval: monster.moveInterval
  };
  if (monster.col !== destCol || monster.row !== destRow) {
    sprite.col = destCol;
    sprite.row = destRow;
  }
  sendSprite(sprite);
  if (monster.moving) {
    setTimeout(function () {
      var i, cellState, doomedPlayers, player;

      monster.col = destCol;
      monster.row = destRow;
      cellState = getCellState(monster.col, monster.row);
      doomedPlayers = getPlayersAt(monster.col, monster.row);
      if (cellState.indexOf("explosion") > -1) {
        killSprite(monster.id);
      } else if (doomedPlayers.length > 0) {
        for (i = 0; i < doomedPlayers.length; i += 1) {
          player = doomedPlayers[i];
          killSprite(player.id);
        }
      }
    }, monster.moveInterval / 2);
    setTimeout(function () {
      runMonster(monster);
    }, monster.moveInterval);
  } else {
    setTimeout(function () {
      runMonster(monster);
    }, Math.random() * 1000);
  }
}

function runPlayer(player) {
  var destCol = player.col,
    destRow = player.row,
    obstructions = ["wall", "pillar", "bomb"],
    sprite;

  if (player.state === "dead") {
    return false;
  }
  player.moving = true;
  player.state = "move";
  if (["up", "down", "left", "right"].indexOf(player.action) > -1) {
    player.direction = player.action;
  }
  switch (player.action) {
  case "up":
    if (obstructions.indexOf(getCellState(destCol, destRow - 1)) < 0) {
      destRow -= 1;
    } else {
      player.moving = false;
    }
    break;
  case "down":
    if (obstructions.indexOf(getCellState(destCol, destRow + 1)) < 0) {
      destRow += 1;
    } else {
      player.moving = false;
    }
    break;
  case "left":
    if (obstructions.indexOf(getCellState(destCol - 1, destRow)) < 0) {
      destCol -= 1;
    } else {
      player.moving = false;
    }
    break;
  case "right":
    if (obstructions.indexOf(getCellState(destCol + 1, destRow)) < 0) {
      destCol += 1;
    } else {
      player.moving = false;
    }
    break;
  default:
    player.state = "idle";
    player.moving = false;
  }
  sprite = {
    id: player.id,
    state: player.state,
    direction: player.direction,
    moveInterval: player.moveInterval
  };
  if (player.col !== destCol || player.row !== destRow) {
    sprite.col = destCol;
    sprite.row = destRow;
  }
  sendSprite(sprite);
  if (player.moving) {
    setTimeout(function () {
      player.col = destCol;
      player.row = destRow;
      var cellState = getCellState(player.col, player.row);
      if (cellState.indexOf("explosion") > -1) {
        killSprite(player.id);
      } else if (cellState === "powerup bomb") {
        player.bombs += 1;
      } else if (cellState === "powerup flame") {
        player.blast += 1;
      } else if (cellState === "powerup speed") {
        player.moveInterval *= 2 / 3;
      } else if (cellState === "powerup detonator") {
        player.detonator = true;
        if (player.bombs > 1) {
          player.bombs -= 1;
        }
      } else if (getMonstersAt(player.col, player.row).length > 0) {
        killSprite(player.id);
      }
      if (cellState.indexOf("powerup") > -1) {
        updateCell(player.col, player.row, "floor");
      }
    }, player.moveInterval / 2);
    setTimeout(function () {
      runPlayer(player);
    }, player.moveInterval);
  }
}

function sendSprite(sprite) {
  sockets.emit("update sprite", sprite);
}

function setGenocide() {
  var i;

  clearTimeout(genocideTO);
  genocideTO = setTimeout(function () {
    for (i = gameState.players.length-1; i >= 0; i -= 1) {
      killSprite(gameState.players[i].id);
    }
  }, 60000);
}

function startGame() {
  createBattlefield(13, 11, 0.5);
  addMonsters();
}

function updateCell(col, row, state) {
  if (col < 0 || row < 0 || col >= gameState.cols || row >= gameState.rows) {
    return false;
  }
  gameState.cellStates[col][row] = state;
  sockets.emit("update cell", col, row, gameState.cellStates[col][row]);
}

