@echo off
echo This application requires node.js
echo Download it for free from http://nodejs.org/
echo ---
npm install && start http://%COMPUTERNAME%:3000/ && node app.js || start http://nodejs.org/
pause
