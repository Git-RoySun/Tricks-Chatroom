const $$ = (el) => document.querySelector(el);
const chat = $$("#board");
const registration = $$("#registration");

let name;
let color;
let cards = [];
let turn = 0;

function addMessage(color,name, msg) {
    let el = document.createElement("p");
    el.innerHTML = `<span style="color: ${color}">${name}: </span>${msg}`;
    chat.appendChild(el);
    chat.scrollTop = chat.scrollHeight;
}

function privateMessage(sender, receiver, message) {
    let el = document.createElement("p");
    el.innerHTML = `From ${sender} to ${receiver}: ${message}`;
    el.classList.add('subtle');
    chat.appendChild(el);
    chat.scrollTop = chat.scrollHeight;
}

function systemMessage(msg){
    let el = document.createElement("p");
    el.innerHTML = msg;
    el.classList.add('subtle');
    chat.appendChild(el);
    chat.scrollTop = chat.scrollHeight;
}

$$("#register").addEventListener('submit', function (AAA) {
    AAA.preventDefault();
    let socket = io();

    socket.emit('registration', $$("#name").value);
    $$("#registration").style.display = "none";

    $$("#btn").addEventListener('click', function () {
        if ($$("#btn").classList.contains('valid')) {
            let action = $$("#btn").innerText;
            if (action === "Start") {
                socket.emit('start');
            } else if (action === "Play") {
                socket.emit('play');
            } else if (action === "Join") {
                socket.emit('join');
            }
        }
    });

    $$('#leave').addEventListener('click', function () {
        $$("#btn").classList.remove('invalid');
        $$("#btn").classList.add('valid');
        $$("#leave").style.display = "none";
        socket.emit('leave');
    });

    $$("#msg").addEventListener('submit', function (e) {
        e.preventDefault();
        console.log('message');
        let msg = $$("#message").value;
        if (msg.charAt(0) === '!') {
            let target = msg.substring(1, msg.indexOf(" "));
            socket.emit('private', target, msg.substring(msg.indexOf(" ")));
        } else {
            addMessage(color,name, msg);
            socket.emit('message', msg);
        }
        $$("#message").value = '';
    });

    socket.on('registration',function (_name,_color) {
        color = _color;
        name = _name;
    });

    socket.on('message', function (color,name, msg) {
        addMessage(color,name, msg);
    });

    socket.on('system',function (msg) {
        systemMessage(msg);
    });

    socket.on('private',function (s,r,msg) {
        privateMessage(s,r,msg);
    });

    socket.on('start', function () {
        $$("#btn").innerText = "Join";
    });

    socket.on('update', function (num) {
        $$("#waiting").innerText = `(${num}/6 players waiting)`;
    });

    socket.on('ready',function () {
        $$("#btn").classList.remove('invalid');
        $$("#btn").classList.add('valid');
    });

    socket.on('lead',function () {
        $$("#btn").innerText = "Play";
        $$("#btn").classList.remove('valid');
        $$("#btn").classList.add('invalid');
        $$("#leave").style.display = "inline-block";
    });

    socket.on('reset', function () {
        $$("#system").style.display = 'block';
        $$("#game").style.display = 'none';
        $$("#waiting").innerText = '';
        $$("#btn").innerText = "Start";
        $$("#btn").classList.remove('invalid');
        $$("#btn").classList.add('valid');
        $$("#leave").style.display = "none";
        for(let x=1;x<7;x++){
            $$(`#p${x}`).innerHTML = "<div class=\"name\"></div>";
        }
    });

    socket.on('joined',function () {
        $$("#btn").innerText = "Joined";
        $$("#btn").classList.remove('valid');
        $$("#btn").classList.add('invalid');
        $$("#leave").style.display = "inline-block";
    });

    socket.on('full',function () {
        $$("#btn").classList.remove('valid');
        $$("#btn").classList.add('invalid');
    });

    socket.on('game',function (game) {
        console.log('game started');
        $$("#system").style.display = 'none';
        $$("#game").style.display = 'block';
        $$(`#p${game._turn+1}`).classList.add('playing');
        $$("#txtTrump").innerText = `${(isNaN(game._trump._order))?(game._trump._order).toUpperCase():game._trump._order} of ${game._trump._type}`;
        game._players.forEach(function (d,index) {
            let el = $$(`#p${index+1}`);
            $$(`#p${index+1}`).style.display = 'block';
            el.querySelector('[class="name"]').innerHTML = `<h3>${(d._name===name)?"You":d._name}</h3>`;
        });
    });

    socket.on('addCard',function (card) {
        cards.push(card);
        let el = document.createElement('div');
        el.classList.add('card');
        el.innerText = `${(isNaN(card._order))?(card._order).toUpperCase():card._order} of ${card._type}`;
        el.addEventListener('click',function () {
            if($$("#hand").classList.contains('active')){
                $$("#hand").classList.remove('active');
                socket.emit('playCard',card);
                cards.splice(cards.indexOf(card),1);
                el.remove();
            }
        });
        $$('#hand').appendChild(el);
    });

    socket.on('turn',function () {
        systemMessage('It is you turn to play');
        $$('#hand').classList.add('active');
    });

    socket.on('playCard',function (index,card) {
        let el = document.createElement('section');
        el.classList.add('temporary');
        el.classList.add('card');
        el.innerText = `${(isNaN(card._order))?(card._order).toUpperCase():card._order} of ${card._type}`;
        el.style.marginTop="-100px";
        $$(`#p${index}`).appendChild(el);
        $$(`#p${index}`).classList.remove('playing');
    });

    socket.on('playing',function (index) {
        $$(`#p${index+1}`).classList.add('playing');
    });

    socket.on('round',function (game) {
        game._players.forEach(function (d,index) {
            let el = $$(`#p${index+1}`);
            if(el.classList.contains('playing'))
                el.classList.remove('playing');
            el.querySelector("section").remove();
        });
    });
});