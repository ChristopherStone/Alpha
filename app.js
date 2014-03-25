
/**
 * Module dependencies.
 */

var express = require('express');
var routes = require('./routes');
var user = require('./routes/user');
var http = require('http');
var path = require('path');
var app = express();

//Mongo
var MongoClient = require('mongodb').MongoClient;

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
    app.use(express.errorHandler());
}

app.get('/', routes.index);
app.get('/users', user.list);

var server = http.createServer(app).listen(app.get('port'), function(){
    console.log('Express server listening on port ' + app.get('port'));
});

//setup Mongo connection
MongoClient.connect('mongodb://127.0.0.1:27017/Alpha', function(err, db) {
    if(err) throw err;
    var dblevels = db.collection('levels');
    var dbusers = db.collection('users')

//load rooms and contents into memory
        var levelData = []
        dblevels.find().toArray(function(err, results){
            levelData = results;
            //console.log(levelData);
        });

    
//Rooms and contents
    var rooms = {roomNum: 1, contents: [    {name: 'Treasure Chest', type: 'chest', width: 20, height: 20, x: 50, y: 200},
        {name: 'Score Chest', type: 'chest', width: 20, height: 20, x: 450, y: 100},
        {name: 'Stairs', type: 'stairs', width: 20, height: 20, x: 300, y: 200}
    ]
    };

//Start of multiple choice system
    var questionArray = [
        {question: "What colour is the sky?", answers: ['blue', 'green', 'red', 'white'], answer: "blue"},
        {question: "What colour is the ocean?", answers: ['blue', 'green', 'red', 'white'], answer: "blue"},
        {question: "What colour is the sun?", answers: ['blue', 'green', 'yellow', 'black'], answer: "yellow"},
        {question: "あ", answers: ['a', 'i', 'u', 'e', 'o'], answer: "a"}

    ];

//array answer shuffle function

    function shuffleArray(array) {

        for (var i = array.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var temp = array[i];
            array[i] = array[j];
            array[j] = temp;
        }
        return array;
    }
//end shuffle function

//return scoreboard
    function pullScoreboard() {
        var scoreboard = [];
        db.collection("users").find().toArray(function(err, results){
            //console.log(results.length);
            for (i=0; i < results.length; i++){
                //console.log(results[i]);
                scoreboard.push(results[i].nickname);
                scoreboard.push(results[i].score);
            }

            io.sockets.in('Score Chest').emit('scoreboard', scoreboard);
        });
    }
//end scoreboard
    function pushLocations(){
        var locations = [];
        io.sockets.clients().forEach(function (socket) {
            locations.push({nickname: socket.nickname, x: socket.x, y: socket.y})
        });
        io.sockets.emit('locations', locations);
    }

    function pushLevel(socket){
        //get level data from db from socket.level
        db.collection('levels').findOne({name: socket.level}, function(err, results){
            leveldata = results.color;
            socket.emit('loadLevel', leveldata)
            pushObjects(socket);
            pushLocations();
        });

        
    }

    function pushObjects(socket){
        //var objects = []
        dblevels.findOne({name: socket.level}, function(err, results){
            socket.emit('contents', results.contents);
        });
        
    }

    function checkCollision(object1, object2){
        //console.log('checking collision');
        //console.log(object1.width);
        //console.log(object2.width);
        if (object1.x < object2.x + object2.width  && object1.x + object1.width  > object2.x &&
            object1.y < object2.y + object2.height && object1.y + object1.height > object2.y) {
            // The objects are touching
            return true
        }
        else {return false}
    }

    function roomJoined(room, socket) {
        //console.log('Hello ' + room);
        if (room == 'Treasure Chest'){
            io.sockets.in(room).emit('question', currentQuestion );

        }
        if (room == 'Score Chest'){
            //console.log('pullingScoreboard');
            pullScoreboard();
        }
        if (room == 'Stairs'){
            if(socket.level == 'level 1'){
            socket.join('level 2');
            socket.level = 'level 2'
            pushLevel(socket);
            }
            else{
            socket.join('level 1');
            socket.level = 'level 1'
            pushLevel(socket);
            }
        }
    }

//setup socket.IO for communication
    var io = require('socket.io').listen(server);

    var currentQuestion = shuffleArray(questionArray)[0];
    shuffleArray(currentQuestion.answers);

    io.sockets.on('connection', function(socket) {
        //console.log('connected client');
        //pushLocations();
        //pushObjects(socket);

        socket.on('username', function(data) {
            // Setup socket information
            socket.emit('initialize');
            setTimeout(function(){
                pushLevel(socket);
                pushObjects(socket);
                pushLocations();
            }, 1000);

            socket.nickname = data;
            socket.x = 100;
            socket.y = 100;
            socket.width = 20;
            socket.height = 20;
            socket.collision = '';

            //read user score from DB(insert if not exists) and set as current score
            db.collection('users').findOne({nickname: socket.nickname}, function(err, results){
                if(results){
                    //console.log(results.score);
                    socket.score = results.score;
                    socket.level = results.level;
                }
                else {
                    db.collection('users').insert({nickname: socket.nickname, score: 0, level: 'level 1'}, function(err){});
                    socket.score = 0;
                    socket.level = 'level 1'
                }
            });
            //end database read/insert


            //socket.emit('question', currentQuestion );
        });
        //handle answers from clients and set new question once correct
        socket.on('answer', function(data) {
            //console.log(data.answer);
            //console.log(currentQuestion.answer);
            if(data.answer == currentQuestion.answer) {
                socket.score++;
                db.collection('users').update({nickname: socket.nickname}, {$set: {score: socket.score}}, function(){
                    pullScoreboard();
                });
                socket.emit('response', {message: 'You are Correct, new question in 3 seconds.'});
                socket.broadcast.emit('response', socket.nickname +  ' got it, new question in 3 seconds');

                setTimeout(function(){
                    //io.sockets.emit('response', "" );
                    currentQuestion = shuffleArray(questionArray)[0];
                    shuffleArray(currentQuestion.answers);
                    io.sockets.in('Treasure Chest').emit('question', currentQuestion );
                }, 3000);
            }

        });
        socket.on('move', function(dir){
            if(dir.direction=="down") {
                if(socket.y <= 280) {
                    socket.y += 20;
                }
            }
            if(dir.direction=="left") {
                if(socket.x >= 20) {
                    socket.x += -20;
                }
            }
            if(dir.direction=="up") {
                if(socket.y >= 20) {
                    socket.y += -20;
                }
            }
            if(dir.direction=="right") {
                if(socket.x <= 680) {
                    socket.x += 20;
                }
            }
            
            //console.log('detect collision');

            var socketLevelObjects = levelData.filter(function(obj){
                //console.log(obj.name);
                //console.log(socket.level);
                return (obj.name == socket.level);
            });
            //console.log(socketLevelObjects[0]);
            try {
                //console.log('trying');
                socketLevelObjects[0].contents.forEach(function(chest){
                    //console.log(chest);
                    if(checkCollision(socket, chest)){
                        //console.log(socket.collision);
                        if(socket.collision == '') {
                            //console.log(socket.nickname + " " + chest.name);
                            socket.collision = chest.name;
                            socket.join(chest.name);
                            roomJoined(chest.name, socket);
                        }

                    }
                    else{
                        if(socket.collision == chest.name) {
                            socket.collision = '';
                            socket.leave(chest.name);
                            socket.emit('uncollide', true);
                            //console.log('leaving' + socket.nickname + " " + chest.name);
                        }
                    }

                });
            }
            catch(err)
            {console.log('socket level probably not defined yet')} 






            pushLocations();
        });
        socket.on('disconnect', function() {
            db.collection('users').update({nickname: socket.nickname}, {$set: {score: socket.score}}, function(err, results){});
            socket.broadcast.emit('removeAvatar', socket.nickname);
        });

    });
});
//end multiple choice system

