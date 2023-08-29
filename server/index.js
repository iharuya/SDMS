'use strict';
const version = require('../package.json').version;
const history = require('../history.json').reverse();
const env = process.env.NODE_ENV;
const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const Room = require('./room.js');
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.get('/', (req, res) => {
	res.render('index', {
		version: version,
		env: env,
		history: history
	});
});

let num_users = 0; // logged in users
let rooms = [];

io.on('connection', (socket) => {
	socket.isLoggedin = false;
	socket.myroom = undefined;

	socket.emit('initial info', {
		users: num_users,
		rooms: rooms,
		userid: socket.id
	});

	socket.on('login', (username) => {
		socket.isLoggedin = true;
		num_users++;
		socket.username = username;
		io.emit('users change', num_users);
	});

	socket.on('debug', () => {
		if (env === 'development') {
			console.log(rooms);
		}
	})

	// data -> owner, W, H, B
	socket.on('create room', (data) => {
		if (socket.myroom !== undefined) {
			log(socket, `既に部屋に所属しているのに作成しようとしました`);
			return;
		}
		const room = new Room(data);
		room.id = randomstr();
		room.ownerID = socket.id;
		room.number++;
		rooms.push(room);
		socket.myroom = room;
		socket.join(room.id);
		socket.emit('created your room', room);
		io.emit('room added', room);
	});

	socket.on('join room', (id) => {
		const room = findRoom(id);
		if (socket.myroom !== undefined) {
			log(socket, `既に部屋に所属しているのに別の場所に入ろうとしました`);
			return;
		}
		if (room.status !== 'waiting') {
			log(socket, `既に成立した部屋に入ろうとしました`);
			return;
		}
		room.status = 'matched';
		room.player = socket.username;
		room.playerID = socket.id;
		room.number++;
		socket.join(id);
		socket.myroom = room; // 作成者でなくてもmyroomはもつ
		io.in(id).emit('you got matched', room);
		io.emit('room matched', id);
	});

	socket.on('destroy room', (id) => {
		socket.myroom = undefined;
		socket.leave(id);
		destroyRoom(id);
		socket.emit('destroyed your room', id);
	});

	socket.on('game ready', (id) => {
		const room = findRoom(id);
		room.ready++;
		if (room.ready === 2) {
			room.status = 'ongame'
			io.in(id).emit('start your game', room);
			io.emit('room started', id);
		}
	});

	socket.on('game firstdata', (data) => {
		// const room = findRoom(data.id);
		socket.to(data.id).emit('opp firstdata', data);
	});
	socket.on('board change', (data) => {
		socket.to(data.id).emit('opp change', data);
	});
	socket.on('game ended', (id) => {
		io.emit('room ended', id);
		const room = findRoom(id);
		room.status = 'ended';
	})
	socket.on('game failed', (data) => {
		socket.to(data.id).emit('opp failed', data.time);
	});
	socket.on('game cleared', (data) => {
		socket.to(data.id).emit('opp cleared', data.time);
	});
	socket.on('exit game', (id) => {
		socket.leave(id);
		const room = findRoom(id);
		room.number--;
		socket.myroom = undefined;
		if (room.number === 0) {
			destroyRoom(id);
		} else {
			socket.to(id).emit('opp exited');
		}
	});

	// chat
	socket.on('chat msg', (msg) => {
		const data = {
			msg: msg,
			sender: socket.username,
			socketid: socket.id,
		}
		io.emit('user chat', data);
	});

	socket.on('disconnect', () => {
		if (socket.isLoggedin) {
			num_users--;
			io.emit('users change', num_users);
		}
		if (socket.myroom !== undefined) {
			const room = findRoom(socket.myroom.id);
			room.number--;
			if (room.number === 0) {
				destroyRoom(room.id);
			} else {
				io.emit('room ended', room.id);
				io.in(room.id).emit('opp exited');
			}
		}
	});
	
});

// 必ずroom.number === 0を確認してから実行
function destroyRoom(id) {
	rooms = rooms.filter((room) => {
		return room.id !== id;
	});
	io.emit('room removed', id);
	// io.in(id).emit('your room removed');
}

function findRoom(id) {
	return rooms.find(item => {
		return item.id === id;
	});
}

function log(socket, msg) {
	socket.emit('log', msg);
}

function randomstr() {
	return Math.random().toString(32).substring(2);
}

server.listen(PORT, () => {
	console.log(`Listening on ${PORT}`);
});