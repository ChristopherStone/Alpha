$( document ).ready(function() {

//attach click event to the submit button,
    $("#submit").click(function () {
        //transmit username
        socket.emit('username', $('input').val());
        //create avatar on canvas
        createAvatar($('input').val());
        //remove the username input box
        $('#username').html('')
    });

//random hexcode for a colour
    function getRandomColor() {
        var letters = '0123456789ABCDEF'.split('');
        var color = '#';
        for (var i = 0; i < 6; i++) {
            color += letters[Math.round(Math.random() * 15)];
        }
        return color;
    }

//establish the socket
    var socket = io.connect();
    console.log("socket connected");
    //handle keydown event pass to function
    document.onkeydown = handleKeyDown;
    var stage = "";

    socket.on('initialize', function(){
        console.log('stage initialized');
        var stage = new createjs.Stage("GameCanvas");
        createjs.Ticker.addEventListener("tick", handleTick);
        createjs.Ticker.setFPS(40);
    });
//received after username submitted, loads from db query data for current level
    socket.on('loadLevel', function (data) {
        stage.removeAllChildren
        console.log(data);
        var background = new createjs.Shape();
        background.graphics.beginFill('#33CC33').drawRect(0, 0, 700, 300);
        stage.addChildAt(background, 0);
    });

    function createAvatar(name) {
        var container = new createjs.Container();
        container.x = 100;
        container.y = 100;
        container.name = name;
        container.setBounds(0, 0, 20, 20);

        var shape = new createjs.Shape();
        shape.graphics.beginFill(getRandomColor()).drawRect(0, 0, 20, 20);
        container.addChild(shape);

        var text = new createjs.Text();
        text.set({text: name});
        container.addChild(text);

        stage.addChild(container);
    }

    function createObject(item) {
        var container = new createjs.Container();
        container.x = item.x;
        container.y = item.y;
        container.name = item.name;
        container.setBounds(0, 0, item.width, item.height);

        var shape = new createjs.Shape();
        shape.graphics.beginFill('#000000').drawRect(0, 0, item.width, item.height);
        container.addChild(shape);

        stage.addChild(container);
    }

    function handleTick(event) {
        stage.update();
        //console.log(createjs.Ticker.getMeasuredFPS());
    }




//receive questions, write to page
    socket.on('question', function (data) {
        $('#question').html(data.question);
        $('#answers').html("");
        $.each(data.answers, function (key, value) {
            //data.answer.each(function(){
            $('#answers').append('<li><a href="#" class="pure-button pure-button-active">' + value + '</a></li>');
        });
    });

//wait for ready, attach click function to li items to send answer
    $("#answers").on("click", "li", function () {
        //console.log($(this).text());
        socket.emit('answer', {answer: $(this).text()});
        console.log('answer sent');
    });
    //});

//receive responses, write to page
    socket.on('response', function (data) {
        console.log('response received');
        $('#question').html(data.message);
        $('#answers').html("");
    });

    socket.on('scoreboard', function (data) {
        $('#scores').html("");
        console.log(data);
        for (var i = 0; i < data.length; i += 2) {
            $('#scores').append('<li>' + data[i] + ': ' + data[i + 1] + '</li>');
        }
    });
    socket.on('locations', function (data) {
        //foreach, check if player has object, create if not, update location if they do
        //console.log(data);
        data.forEach(function (player) {
            //console.log(player.nickname);
            if (stage.getChildByName(player.nickname)) {
                //console.log('found' + player.nickname);
                stage.getChildByName(player.nickname).x = player.x;
                stage.getChildByName(player.nickname).y = player.y;
            }
            else {
                if(player.nickname){
                    createAvatar(player.nickname);
                    stage.getChildByName(player.nickname).x = player.x;
                    stage.getChildByName(player.nickname).y = player.y;
                }


            }

        });
    });
    socket.on('removeAvatar', function (name) {
        //console.log('Remove Avatar');
        stage.removeChild(stage.getChildByName(name));
    });

    function handleKeyDown(e) {
        //console.log(e);
        if (e.keyCode == 87) {
            socket.emit("move", {direction: "up"});
        }
        if (e.keyCode == 65) {
            socket.emit("move", {direction: "left"});
        }
        if (e.keyCode == 83) {
            socket.emit("move", {direction: "down"});
        }
        if (e.keyCode == 68) {
            socket.emit("move", {direction: "right"});
        }
    }

    socket.on('contents', function (contents) {
        console.log(contents);
        contents.forEach(function (item) {
            //console.log(player.nickname);
            if (stage.getChildByName(item.name)) {
                stage.getChildByName(item.name).x = item.x;
                stage.getChildByName(item.name).y = item.y;
            }
            else {
                createObject(item);
            }

        });

    });
    socket.on('uncollide', function(){
        $('#question').html("");
        $('#answers').html("");
        $('#scores').html("");
    })
});


