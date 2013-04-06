/**
 * Module dependencies.
 */
/*jslint indent: 2, node: true, nomen: true */
"use strict";

var express = require("express"),
  routes = require("./routes"),
  http = require("http"),
  path = require("path"),
  io = require("socket.io"),
  nodeblaster = require("./routes/nodeblaster.js");

var app = express();
var server = http.createServer(app);
var io = io.listen(server);

app.configure(function () {
  app.set("port", process.env.PORT || 3000);
  app.set("views", __dirname + "/views");
  app.set("view engine", "jade");
  app.use(express.favicon());
  app.use(express.logger("dev"));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(require("less-middleware")({ src: __dirname + "/public" }));
  app.use(express.static(path.join(__dirname, "public")));
  app.use(express.directory(path.join(__dirname, "public")));
});

app.configure("development", function () {
  app.use(express.errorHandler());
});

app.get("/", routes.index);
nodeblaster(io);

server.listen(app.get("port"), function () {
  console.log("Express server listening on port " + app.get("port"));
});
