CoffeeChatter
=============

Messing around with Node.js, Socket.IO and Dust.js in order to organize office coffee brewing

Tech 
---- 
+ [Node.js](http://nodejs.org/) - server side rest 
+ [Dust.js](http://akdubya.github.io/dustjs/) - client side js templating 
+ [Socket.io](http://socket.io/) - server and client websocket impl 

Dev setup
------------------------
- Install node and add to your path
- Setup proxy for npm (optional): 

`npm config set proxy http://HOST:PORT` and `npm config set https-proxy http://HOST:PORT`
- Install some dependencies

`npm install dustjs-linkedin dustjs-helpers socket.io dust-compiler debug`
- Compile the dust templates: 

`node node_modules/dust-compiler/lib/dust-compiler.js -s src/dusts/ -d public/js/compiled/  --bootstrap`
- If you are developing the dust templates then you can leave the compiler in watch mode

`node node_modules/dust-compiler/lib/dust-compiler.js -s src/dusts/ -d public/js/compiled/`

NOTE: on Ubuntu you need to type "nodjs" instead of "node"

Running
-------
`mkdir -p public/js/compiled`

`node app.js`

open your web browser at http://HOST:7777/
