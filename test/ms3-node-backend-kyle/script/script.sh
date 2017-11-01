#!/bin/bash

npm install

./node_modules/pm2/bin/pm2 start app.js

sleep 3

./node_modules/mocha/bin/mocha

