const fs = require('fs').promises;
const url = require('url');
const path = require('path');
const qs = require('querystring');

const app = require('express')();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const WEBROOT = path.join(__dirname, "public");
const E404 = path.join(__dirname,"error/404.html");
const E500 = path.join(__dirname,"error/500.html");
const PORT = 1000;
const EXTENTIONS = {
    ".html":"text/html",
    ".css":"text/css",
    ".js":"application/javascript",
    ".json":"application/json"
} ;

let randomColour = () => Math.floor(Math.random() * 16777215).toString(16);

let game=null;
let queue = [];
let names = [];
let ids = [];
let users = [];
class Game{

    constructor(set) {
        this._rounds = 0;
        this._turn = 0;
        this._deck = new Deck(set);
        this._players = shuffle(queue);
        this._played = [];
        this._trump = this._deck.drawCard();
    }
    get turn(){
        return this._turn;
    }

    get deck(){
        return this._deck;
    }

    get players(){
        return this._players;
    }

    get trump(){
        return this._trump;
    }
    get played() {
        return this._played;
    }
    get rounds() {
        return this._rounds;
    }

    set rounds(value) {
        this._rounds = value;
    }
    set played(ar){
        this._played = ar;
    }

    set turn(turn){
        this._turn = turn;
    }

    set trump(trump){
        this._trump = trump;
    }
    start(){
        let players = this.players;
        let deck = this.deck;
        for(let x=0;x<9;x++){
            players.forEach(function (d) {
                io.to(d.id).emit('addCard',deck.drawCard());
            });
        }
        this.trump = deck.drawCard();
    }

    endRound() {
            let trump = this.trump._type;
            let lead = this.played[0].card._type;
            let index =0;
            let winner = 0;
            this.played.forEach(function (d,x) {
                let value = 0;
                if(d.card._type===lead)
                    value =(isNaN(d.card._order))?d.card._order.charCodeAt(0):d.card._order;
                if(d.card._type===trump)
                    value = (isNaN(d.card._order))?d.card._order.charCodeAt(0):d.card._order*1000;
                if(value>winner) {
                    index = d.index;
                    winner = value;
                }
            });
            this.turn = index;
            this.players[index].tricks++;
            this.rounds++;
            log(` round, ${(game._played)}, ${game.players[index].name}`);
            this.played = [];
    }

    playCard(index,card){
        this.played.push({"index":index,"card":card});
        this.turn++;
        if(this.turn>this.players.length-1)
            this.turn = 0;
    }
}


class Deck{
    constructor(set) {
        let cards =[];
        set.type.forEach(function (t) {
            set.order.forEach(function (o) {
                cards.push(new Card(t,o));
            });
        });
        this._cards = shuffle(cards);
    }

    get cards(){
        return this._cards;
    }

    drawCard(){
        return this._cards.pop();
    }
}


class Card{
    constructor(type,order) {
        this._type = type;
        this._order=order;
    }
    get type(){
        return this._type;
    }
    get order(){
        return this._order;
    }
}

class Player {
    constructor(id,name) {
        this._id = id;
        this._name = name;
        this._tricks = [];
        this._color = `#${randomColour()}`;
    }
    get color() {
        return this._color;
    }
    get tricks() {
        return this._tricks;
    }
    set tricks(points){
        this._tricks = points;
    }

    get cards() {
        return this._cards;
    }
    get id() {
        return this._id;
    }
    get name() {
        return this._name;
    }
}

function log(log){
    let today = new Date();
    let logLine = `${today.toLocaleString()} ${log}\n`;
    fs.appendFile(path.join(__dirname,`logs/${today.getFullYear()}${(today.getMonth()<10)?"0"+today.getMonth():today.getMonth()}${(today.getDay()<10)?"0"+today.getDay():today.getDay()}.log`),logLine)
        .then(function () {
            console.log('Event logged');
        })
}

function shuffle(source){
    let array = Array.from(source);
    for(let x = 0;x<array.length;x++){
        let rand = Math.floor(Math.random()*array.length);
        let temp = array[x];
        array[x] = array[rand];
        array[rand] = temp;
    }
    return array
}

function joinQueue(player) {
    queue.push(player);
}

function leaveQueue(player) {
    if(queue.indexOf(player)!==-1)
        queue.splice(queue.indexOf(player),1);
}

http.listen(PORT,function () {
    console.log(`Server is listening on port ${PORT}`);
});

app.get('/',function (req,res) {
    res.sendFile(path.join(WEBROOT,"index.html"));
});

app.get('/*',function (req,res) {
    if(path.parse(req.url).base !== 'favicon.ico')
        res.sendFile(path.join(WEBROOT,path.parse(req.url).dir,path.parse(req.url).base));
});

io.on('connection',function (socket) {
    console.log(`New connection (${io.engine.clientsCount} connections)`);
    log(`${socket.id}, connection`);
    if(game!=null)
        socket.emit('game',game);

    else if(queue.length!==0){
        socket.emit('start');
        socket.emit('update',queue.length);
    }

    socket.on('registration',function (name) {
        users[socket.id] = new Player(socket.id,name);
        names[socket.id] = name;
        ids[name]= socket.id;
        socket.emit('registration',users[socket.id].name,users[socket.id].color);
        io.emit('system',`${name} has joined the conversation`);
        io.to(socket.id).emit('system',`You are ${name}`);
        log(`${names[socket.id]}, registration`);
    });

    socket.on('message',function (msg) {
        socket.broadcast.emit('message',users[socket.id].color,users[socket.id].name,msg);
        log(`${names[socket.id]}, message, length:${msg.length}`);
    });

    socket.on('private',function (r,msg) {
        let id= ids[r];
        if(id === socket.id){

            socket.emit('system',`Why are you sending a private message to yourself?`);
        }
        else{
            if(id!==undefined){
                io.to(id).emit('private',names[socket.id],"me",msg);
                socket.emit('private',"me",r,msg);
                log(`${names[socket.id]},private,${r}, length:${msg.length}`);
            }
            else{
                socket.emit('system',`${r} was not found, please try again`);
            }
        }
    });

    socket.on('start',function () {
        io.emit('system',`Game queue has been started by ${names[socket.id]}`);
        joinQueue(users[socket.id]);
        socket.emit('lead');
        socket.broadcast.emit('start');
        io.emit('update',queue.length);
        log(`${names[socket.id]}, start`);
    });

    socket.on('join',function () {
        if(queue.length<6){
            joinQueue(users[socket.id]);
            socket.emit('joined');
            io.emit('system',`${names[socket.id]} has joined the game queue`);
            io.emit('update',queue.length);
            log(`${names[socket.id]}, join`);
            if(queue.length>=2)
                io.to(queue[0].id).emit('ready');

        }
        else
            socket.emit('full');

    });

    socket.on('play',function () {
        let rand = Math.floor(1+Math.random()*5);
        fs.readFile(`sets/${rand}.json`,)
            .then(function (contents) {
                game = new Game(JSON.parse(contents));
                game.start();
                io.emit('system',`Game has been started`);
                io.emit('game',game);
                io.to(game.players[game.turn]._id).emit('turn',game.turn);
                io.emit('playing',game.turn);
                log(`${names[socket.id]}, play`);
            });
    });

    socket.on('playCard',function (card) {
        io.emit('playCard',game.turn+1,card);
        log(`${names[socket.id]}, playCard, ${(game._played)}`);
        io.emit('system',`${names[socket.id]} has played ${card._order} of ${card._type}`);
        game.playCard(game.players.indexOf(users[socket.id]),card);

        if (game.played.length === game.players.length) {
                game.endRound();
                io.emit('system',`${game.players[game.turn].name} has won the trick`);
                io.emit('round', game);

        }
        if(game.rounds===9){
            let index;
            let winner;
            let biggest = 0;
            game.players.forEach(function (d,i) {
                if(d.tricks>biggest){
                    biggest = d.tricks;
                    winner = d.name;
                    index = i;
                }
            });
            log(` winner, ${(game._played)}, ${game.players}, ${game.players[index].name}`);
            game = null;
            queue = [];
            io.emit('system',`The game has ended.`);
            io.emit('system',`The winner is : ${winner}`);
            io.emit('reset');
        }
        else{
            io.to(game.players[game.turn]._id).emit('turn', game.turn);
            io.emit('playing', game.turn);
        }
    });


    socket.on('leave',function () {
        let leader = queue[0];
        leaveQueue(users[socket.id]);
        io.emit('system',`${names[socket.id]} has left the game queue`);
        log(`${names[socket.id]}, leave`);
        if(queue.length===0){
            io.emit('system',`Game was cancelled`);
            log(`reset`);
            io.emit('reset');
        }
        else{
            if(queue[0]!==leader){
                io.to(queue[0].id).emit('lead');
                io.to(queue[0].id).emit('system',"You are now the queue leader");
                if(queue.length>=2)
                    io.to(queue[0].id).emit('ready');
            }
            socket.emit('start');
            io.emit('update',queue.length);
        }
    });

    socket.on('disconnect',function () {
        let leader = queue[0];
        leaveQueue(users[socket.id]);
        io.emit('system',`${names[socket.id]} has left the game queue`);
        log(`${names[socket.id]}, leave`);
        if(queue.length===0){
            io.emit('system',`Game was cancelled`);
            log(`reset`);
            io.emit('reset');
        }
        else{
            if(queue[0]!==leader){
                io.to(queue[0].id).emit('lead');
                io.to(queue[0].id).emit('system',"You are now the queue leader");
                if(queue.length>=2)
                    io.to(queue[0].id).emit('ready');
            }
            socket.emit('start');
            io.emit('update',queue.length);
        }
        io.emit('system',`${names[socket.id]} has left the conversation`);
        log(`${names[socket.id]}, disconnect`);
        console.log(`${names[socket.id]} has disconnected (${io.engine.clientsCount} connections)`);
        delete ids[names[socket.id]];
        delete names[socket.id];
    });
});
