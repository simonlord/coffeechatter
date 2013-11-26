CoffeeChatter
=============

Messing around with Node.js, Socket.IO and Dust.js in order to organize office coffee brewing

Tech 
---- 
+Node.js - server side rest 
+Dust.js - client side js templating 
+Socket.io - server and client websocket impl 

Dev setup (Not complete)
------------------------
- Install node and add to your path
- npm install dustjs-linkedin 
- npm install dustjs-helpers
- npm install socket.io
- npm install dust-compiler
- npm install debug
- Compile the dust templates: 

node node_modules/dust-compiler/lib/dust-compiler.js -s src/dusts/ -d public/js/compiled/  --bootstrap

- If you are developing the dust templates then you can leave the compiler in watch mode

node node_modules/dust-compiler/lib/dust-compiler.js -s src/dusts/ -d public/js/compiled/


Running
-------
node app.js

open your web browser at http://HOST:7777/
