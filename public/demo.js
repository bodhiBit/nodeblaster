/**
* demo.js
*/

$(function(){
  createBattlefield(13, 11);
  updateCell(2, 2, "wall");
  updateCell(1, 2, "wall");
  updateCell(0, 2, "wall");
  updateCell(2, 1, "wall");
  updateCell(2, 0, "wall");
  updateCell(4, 0, "powerup bomb");
  updateCell(5, 0, "powerup flame");
  updateCell(6, 0, "powerup speed");
  updateCell(7, 0, "powerup detonator");
  updateCell(8, 2, "explosion");
  updateCell(8, 3, "explosion down");
  updateCell(8, 4, "explosion down end");
  updateCell(8, 1, "explosion up");
  updateCell(8, 0, "explosion up end");
  updateCell(9, 2, "explosion right");
  updateCell(10, 2, "explosion right end");
  updateCell(7, 2, "explosion left");
  updateCell(6, 2, "explosion left end");
  updateCell(11, 0, "bomb");
  
  createSprite({
    id: "player1",
    type: "player",
    state: "move",
    direction: "down",
    row: 0,
    col: 0
  });
  createSprite({
    id: "player2",
    type: "player",
    state: "idle",
    direction: "up",
    row: 10,
    col: 12
  });
  createSprite({
    id: "player3",
    type: "player",
    state: "idle",
    direction: "left",
    row: 0,
    col: 12
  });
  createSprite({
    id: "player4",
    type: "player",
    state: "idle",
    direction: "right",
    row: 10,
    col: 0
  });
  createSprite({
    id: "player5",
    type: "player",
    state: "idle",
    direction: "down",
    row: 5,
    col: 6
  });
  createSprite({
    id: "monster0",
    type: "monster",
    state: "move",
    direction: "down",
    row: 4,
    col: 4
  });
  
  $(".player, .monster").click(function(e){
    updateSprite({
      id: $(this).attr("id"),
      state: "dead"
    });
  });
  $(".player").hover(function(e){
    updateSprite({
      id: $(this).attr("id"),
      state: "idle"
    });
  });
  $(".player, .monster").mouseleave(function(e){
    updateSprite({
      id: $(this).attr("id"),
      state: "move"
    });
  });
  
  $("#cell_5_5").hover(function(e){
    updateSprite({
      id: "player5",
      direction: "left"
    });
  });
  $("#cell_7_5").hover(function(e){
    updateSprite({
      id: "player5",
      direction: "right"
    });
  });
  $("#cell_6_4").hover(function(e){
    updateSprite({
      id: "player5",
      direction: "up"
    });
  });
  $("#cell_6_6").hover(function(e){
    updateSprite({
      id: "player5",
      direction: "down"
    });
  });
});