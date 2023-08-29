'use strict';
import { initiate } from './GameHandler.js';
import { myroom } from './myroom.js';
import { env, devlog, SDF, getDOM, elms, createNotice, createRoomCard, formatDate, SE, socket, level_templates, loadCompleted, loadStart, randTextGenerator, openGameConfig, closeGameConfig } from './utils.js';

SE.load();
SE.triedLoad(function() {
	if (SE.status === 'loaded') {
		console.log(`All sound effects loaded in ${new Date() - SE.initTime}ms`);
	} else {
		createNotice('音源の読み込みに失敗しました');
	}
});

socket.on('initial info', (data) => {
	devlog(data);
	updateUserNumber(data.users)
	data.rooms.forEach((room) => {
		createRoomCard(room);
	});
	getDOM('detail_userid').textContent = socket.id;
	loadCompleted();
});
socket.on('disconnect', () => {
	createNotice('通信が切断されました. リロードしてください', true);
})
socket.on('reconnect', () => {
	createNotice('通信が再開しました');
});
socket.on('log', (msg) => {
	createNotice(msg);
});

socket.on('users change', (num) => {
	updateUserNumber(num)
});
function updateUserNumber(num) {
	getDOM('detail_usernum').textContent = num
}

if (env === 'development') {
	SDF('lobby__title', 'click', function() {
		socket.emit('debug');
	});
}

SDF('allow_sound', 'click', function() { 
	SE.allowed = true;
	this.classList.remove('active');
	getDOM('forbit_sound').classList.add('active');
});
SDF('forbit_sound', 'click', function() {
	SE.allowed = false;
	this.classList.remove('active');
	getDOM('allow_sound').classList.add('active');
});
SDF('fail_img', 'click', () => SE.play('bomb'));
SDF('victory_img', 'click', () => SE.play('win'));

// user form
let username = localStorage.getItem('username');
if (username !== null) {
	getDOM('lobby__userform').classList.remove('active');
	getDOM('lobby__mainops').classList.add('active');
	login(username);
} else {
	// set random name in conf_use_name
	elms.f_username.value = randTextGenerator.getStrings('ja', 5);
	elms.f_username.addEventListener('click', function() {{this.value = ''}}, {once:true});
}
SDF('lobby__userform', 'submit', function(e) {
	e.preventDefault();
	e.stopPropagation();
	const name = elms.f_username.value;
	if (name.length < 2 || name.length > 10) {
		createNotice('名前は2文字以上10文字以内にしてください');
		elms.f_username.classList.add('warn')
	} else {
		username = name;
		localStorage.setItem('username', name);
		login(username);
		elms.f_username.classList.remove('warn')
		getDOM('lobby__userform').classList.remove('active');
		getDOM('lobby__mainops').classList.add('active');
	}
});
function login(name) {
	socket.emit('login', name)
	// new User()?
	getDOM('detail_username').textContent = name;
}

// main options (solo or multi)
SDF(solo_btn, 'click', function() {
	getDOM('lobby__mainops').classList.remove('active');
	openGameConfig('solo');
});
SDF(multi_btn, 'click', function() {
	getDOM('lobby__mainops').classList.remove('active');
	elms.rooms__wrap.classList.add('active');
});


// rooms
SDF('create__room', 'click', function() {
	elms.rooms__wrap.classList.remove('active');
	openGameConfig('multi');
})
SDF('room__back', 'click', function() {
	elms.rooms__wrap.classList.remove('active');
	elms.lobby__mainops.classList.add('active');
	resetMatchwait();
});

// create/destroy room
function createRoom(owner, width, height, bomb) {
	if (myroom.valid) {
		console.error("既にルームが作成されていて、消されていません");
		return;
	}

	const data = {owner: owner, width: width, height: height, bomb: bomb}
	myroom.make();
	socket.emit('create room', data);

	closeGameConfig('multi');
	elms.rooms__wrap.classList.remove('active');
	getDOM('matchwait').classList.add('active');
}

socket.on('created your room', (room) => {
	myroom.server = room;
	getDOM('matchwait__wait').classList.add('active');
	getDOM('matchwait__wait-rooname').textContent = room.owner;
});

SDF('matchwait__back', 'click', () => {
	socket.emit('destroy room', myroom.server.id);
	resetMatchwait()
	elms.rooms__wrap.classList.add('active');
});

socket.on('destroyed your room', (id) => {
	myroom.break();
	createNotice(`あなたのルームは削除されました`);
})

socket.on('room added', (data) => {createRoomCard(data);});
socket.on('room removed', (id) => {
	try {
		getDOM(`roomcard__${id}`).remove();
	} catch (e) {
		devlog('なんらかの理由で既にないルームカードを消そうとしました');
		devlog(e);
	}
});

// join the room
// emit-join is defined in createRoomCard()
socket.on('room matched', (id) => {
	const card = getDOM(`roomcard__${id}`);
	const status = card.querySelector('.roomcard__status');
	status.textContent = 'マッチ完了';
	card.dataset.status = 'matched';
	card.querySelector('.roomcard__join').setAttribute('disabled', true);
})

socket.on('you got matched', (room) => {
	createNotice('マッチ成立！');
	myroom.server = room;
	const isOwner = room.ownerID === socket.id;
	const opponent = isOwner ? room.player : room.owner;

	getDOM('matchwait__done-opp').textContent = opponent;
	if (!isOwner) {
		elms.rooms__wrap.classList.remove('active');
		getDOM('matchwait').classList.add('active')
	}
	getDOM('matchwait__wait').classList.remove('active');
	getDOM('matchwait__done').classList.add('active');

	const time = getDOM('game_start_in');
	time.textContent = 5;
	let count = 4;
	const countdownID = setInterval(() => {
		time.textContent = count;
		count--;
		if (count < 0) {
			clearInterval(countdownID);
			readyMulti(room.id);
			resetMatchwait();
		}
	}, 1000);
	
});

function resetMatchwait() {
	getDOM('matchwait__done').classList.remove('active');
	getDOM('matchwait__wait').classList.remove('active');
	getDOM('matchwait').classList.remove('active');
}

// room start (ongame)
socket.on('room started', (id) => {
	const card = getDOM(`roomcard__${id}`);
	const status = card.querySelector('.roomcard__status');
	status.textContent = '対戦中';
	card.dataset.status = 'ongame';
	// card.querySelector('.roomcardobserve').setAttribute('disabled', false);
});

function readyMulti(id) {
	socket.emit('game ready', id);
}
socket.on('start your game', (room) => {
	myroom.server = room;
	initiate('multi', room.width, room.height, room.bomb, room);
});

// room ended
socket.on('room ended', (id) => {
	const card = getDOM(`roomcard__${id}`);
	const status = card.querySelector('.roomcard__status');
	status.textContent = '終了';
	card.dataset.status = 'ended';
})


// game form
setDefValue();
function setDefValue() {
	elms.f_width.value = localStorage.getItem('last_game_width') || 8;
	elms.f_height.value = localStorage.getItem('last_game_height') || 10;
	elms.f_bomb.value = localStorage.getItem('last_game_bomb_amount') || 20;
}
SDF('gconf', 'change', configValidation);
SDF('gconf', 'submit', function(e) {
	e.preventDefault();
	e.stopPropagation();
	const validation = configValidation();
	if (!validation.isOK) {
		validation.messages.forEach(msg => {
			createNotice(msg);
		});
		return;
	} 
	const j_width = parseInt(f_width.value);
	const j_height = parseInt(f_height.value);
	const j_bomb = parseInt(f_bomb.value);
	localStorage.setItem('last_game_width', j_width);
	localStorage.setItem('last_game_height', j_height);
	localStorage.setItem('last_game_bomb_amount', j_bomb);

	// solo or multi
	const type = elms.gconf.classList.contains('solo') ? 'solo' : 'multi';
	if (type === 'solo') {
		initiate('solo' ,j_width, j_height, j_bomb);
	} else if (type === 'multi') {
		createRoom(username, j_width, j_height, j_bomb);
	}
	
});

['low', 'medium', 'high', 'duper'].forEach(level => {
	SDF(`temp_${level}`, 'click', function() {
		setTemplate(level_templates[level])
	})
})
function setTemplate(array) {
	elms.f_width.value = array[0];
	elms.f_height.value = array[1];
	elms.f_bomb.value = array[2];
}

/**
 * validate 3 values (width, height, bombamount)
 * @returns {Object} .isOK (boolean)
 * @returns {Object} .messages (array)
 */
function configValidation() {
	const isMulti = elms.gconf.classList.contains('multi');
	let result = {
		isOK: true,
		messages: []
	};

	const inputs = [f_width, f_height, f_bomb];
	const names = ['幅','高さ','爆弾の数'];
	for (let i = 0; i < inputs.length; i++) {
		const input = inputs[i];
		const val = parseInt(input.value);
		if (isNaN(val)) {
			result.isOK = false;
			result.messages.push('入力は全て半角数字にしてください');
			return result;
		}
	}
	// now they are all numbers
	const W = elms.f_width.value;
	const H = elms.f_height.value;
	const max = isMulti ? 36 : 50;

	[elms.f_width, elms.f_height].forEach((input, i) => {
		const val = input.value;
		if (val < 6 || val > max) {
			input.classList.add('warn');
			result.isOK = false;
			result.messages.push(`${names[i]}の大きさは6~${max}以内にしてください`);
		} else {
			input.classList.remove('warn');
		}
	});

	const bomb_validation = validateBomb();
	if(!bomb_validation.isOK) {
		elms.f_bomb.classList.add('warn');
		result.isOK = false;
		result.messages.push(bomb_validation.msg)
	} else {
		elms.f_bomb.classList.remove('warn');
	}

	const ratio = Math.max(W, H) / Math.min(W, H);
	if (ratio >= 2) {
		result.isOK = false;
		result.messages.push('幅と高さの差が大きすぎます');
	}

	return result;
}

function validateBomb() {
	let result = {
		isOK: true,
		msg: ''
	}
	const size = parseInt(elms.f_width.value) * parseInt(elms.f_height.value);
	const bomb_amout = parseInt(elms.f_bomb.value);
	const max = Math.round(size*0.8);
	const min = Math.round(size*0.1);
	if (!bomb_amout || max < bomb_amout || min > bomb_amout) {
		result.isOK = false;
		result.msg = `爆弾は${min}以上${max}以下にしてください`
		return result;
	}
	return result;
}

SDF('open_menu_btn', 'click', () => {
	elms.menu.classList.add('active');
});
SDF('close_menu_btn', 'click', () => {
	elms.menu.classList.remove('active');
});

SDF('widen_menu_btn', 'click', function() {
	const wrap = elms.g_wrap;
	const isWidend = wrap.classList.contains('menu_widened');
	if (isWidend) {
		wrap.classList.remove('menu_widened');
		this.dataset.display = '<|';
	} else {
		wrap.classList.add('menu_widened');
		this.dataset.display = '|>';
	}
});


// chat
SDF('open_chat_btn', 'click', () => {
	getDOM('chat__wrap').classList.add('active');
	getDOM('detail__wrap').classList.remove('active');
})
SDF('close_chat_btn', 'click', closeChat);
SDF('chat__wrap', 'click', closeChat);
SDF('chat', 'click', function(e) {e.stopPropagation()})

function closeChat() {
	getDOM('chat__wrap').classList.remove('active');

}
SDF('chat__control', 'submit', function(e) {
	e.preventDefault();
	e.stopPropagation();
	const msg = getDOM('chat__control-input').value;
	if (msg.length === 0) return;
	if (msg.length > 100) {
		createNotice('メッセージは100文字以内にしてください');
		return;
	}
	getDOM('chat__control-input').value = '';
	sendChat(msg);
})

function sendChat(msg) {
	socket.emit('chat msg', msg);
}

socket.on('user chat', (data) => {
	addChat(data)
})

// msg, sender, socketid, type
function addChat(data) {
	const tmp = getDOM('chat__tmp');
	const area = getDOM('chat__area');
	const clone = tmp.content.cloneNode(true);
	const item = clone.querySelector('.chat__item');
	item.dataset.sender = data.sender;
	if (data.socketid !== undefined) item.dataset.socketid = data.socketid;
	const type = data.type || 0;
	item.dataset.type = type;
	item.querySelector('.chat__item-msg').textContent = data.msg;
	item.querySelector('.chat__item-sender').textContent = data.sender;
	item.querySelector('.chat__item-time').textContent = formatDate(new Date(), 'hh:mm:ss');
	area.append(clone);

	area.scrollTop = area.scrollHeight;
}

// detail
SDF('open_detail_btn', 'click', () => {
	getDOM('detail__wrap').classList.add('active')
	getDOM('chat__wrap').classList.remove('active')
})
SDF('close_detail_btn', 'click', closeDetail)
SDF('detail__wrap', 'click', closeDetail)
SDF('detail', 'click', function(e) {e.stopPropagation()})
function closeDetail() {
	getDOM('detail__wrap').classList.remove('active');
}

SDF('user_reset_btn', 'click', function() {
	if (confirm('リセットして再度読み込みします')) {
		localStorage.removeItem('username')
		location.reload();
	} else {
		createNotice('リセットをキャンセルしました')
	}
})

// history accordion
const history = document.querySelectorAll('.history__item-head')
history.forEach((head) => {
	head.addEventListener('click', function() {
		this.parentNode.classList.toggle('active')
	})
	
})