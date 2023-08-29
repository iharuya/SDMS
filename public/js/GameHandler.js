'use strict';
import { devlog, socket, SDF, getDOM, wait, flatten, calcProgress, elms, SE, loadStart, loadCompleted, createNotice, openGameConfig, closeGameConfig } from './utils.js';
import { myroom } from './myroom.js';
import { MS } from './MS.js';

const game = new MS();

export async function initiate(type, width, height, bomb, room = {}) {
	// decide #g_field size
	// client window size (c_) = #screen 's height, not window.height
	elms.lobby.classList.remove('active');
	loadStart();
	await wait(1000);
	elms.g_wrap.classList.add('active');

	const c_width = elms.screen.clientWidth;
	const c_height = elms.screen.clientHeight;

	let style; // layoutstyle
	if (c_width < c_height) {
		// 画面が縦長の場合
		style = "A";
		if (c_width < 1024 && width > height) {
			// 画面の幅が狭く、ボードの幅が大きいときは反転
			createNotice('レイアウト調整のため指定した幅と高さが反転しました');
			[width, height] = [height, width];
		}
	} else if (width > height) {
		style = "B"; // 今のところAと同じ
	} else if (width <= height) {
		style = "C"; // 40%右がメニューになる
	} else {
		style = "A"; // とりあえず
	}
	// if (!style) {
	// 	createNotice('画面の条件が満たされていないため開始できませんでした');
	// 	return;
	// }

	elms.g_wrap.classList.add(`style_${style}`);
	elms.g_field.classList.add(`style_${style}`);
	elms.b_wrap.classList.add(`style_${style}`);
	elms.board.classList.add(`style_${style}`);
	elms.menu.classList.add(`style_${style}`);

	elms.g_wrap.classList.add(`type_${type}`);
	elms.g_field.classList.add(`type_${type}`);
	elms.b_wrap.classList.add(`type_${type}`);
	elms.board.classList.add(`type_${type}`);
	elms.menu.classList.add(`type_${type}`);

	const field_w = elms.g_field.clientWidth;
	const field_h = elms.g_field.clientHeight;
	const squareSize = Math.min(Math.floor(field_w/width), Math.floor((field_h-50)/height));

	elms.board.style.width = squareSize * width + 'px';
	elms.board.style.height = squareSize * height + 'px';
	elms.b_wrap.style.height = squareSize * height + 50 + 'px';

	game.onInit(function() {
		devlog(`playcount: ${this.playcount}`);
		loadCompleted();
		gamehandler(this);
	});
	
	game.init(width, height, bomb, squareSize, style, type, room);
}

function gamehandler(game) {
	const isMulti = game.type === 'multi';
	elms.b_status.textContent = `はじめの一手を待っています`;
	game.onGameStart(function() {
		if (isMulti) {
			const data = {
				id: game.room.id,
				board: game.boardArray,
				nums: game.numsArray,
				width: game.width, // デバイスによって相手は反転しているかも
				height: game.height
			}
			socket.emit('game firstdata', data);
		}
	});
	game.onSelect(function() {
		SE.play('select');
	});
	game.onCancelSelect(function() {
		SE.play('cancel');
	});
	game.onUnselect(function() {

	});
	game.onDig(function() {
		SE.play('dig');
	});
	game.onBigdigStart(function() {
		SE.play('bigdig');
	});
	// game.onBigdigEnd(function() {
	// 	console.log('end bigdig');
	// });
	game.onFlag(function() {
		SE.play('flag');
	});
	game.onUnflag(function() {
		SE.play('unflag');
	});
	game.onChange(function() {
		let id = 0;
		for (let y = 0; y < this.height; y++) {
			for (let x = 0; x < this.width; x++) {
				const square = getDOM(id)
				if (this.flaggedArray[y][x]) square.classList.add('flag');
				else square.classList.remove('flag');
	
				if (this.diggedArray[y][x]) square.classList.add('digged');
				// cannot undig
				id++;
			}
		}
		const flag_reminder = this.bombAmount - flatten(this.flaggedArray).filter(e => e).length;
		elms.h_flags.textContent = flag_reminder;

		const digged_amount = flatten(this.diggedArray).filter(e => e).length;
		const progress = calcProgress(this.size, this.bombAmount, digged_amount);
		elms.b_status.textContent = `完成度${progress}%`;

		if (isMulti) {
			const data = {
				id: game.room.id,
				board: game.boardArray,
				digged: game.diggedArray,
				flag: game.flaggedArray,
				flag_reminder: flag_reminder
			}
			socket.emit('board change', data);
		}
	});
	game.onGameEnd(function() {
		const restarts = document.querySelectorAll('.restart_btn');
		if (isMulti) {
			socket.emit('game ended', game.room.id);
			restarts.forEach(btn => {btn.classList.remove('active')});
		} else {
			restarts.forEach(btn => {btn.classList.add('active')});
		}
	});
	game.onGameFail(function() {
		SE.play('bomb');
		SE.play('tin');
		elms.board.classList.add('failed');
		elms.fail_result_time.textContent = this.lastTime;
		elms.b_status.textContent = `失敗（時刻：${this.lastTime}）`;;

		wait(500).then(() => {
			getDOM('fail_modal').classList.add('active');
		});
		if (isMulti) {
			const data = {
				id: this.room.id,
				time: this.lastTime,
			}
			socket.emit('game failed', data);
		}
	});
	game.onGameClear(function() {
		SE.play('win');
		elms.clear_result_time.textContent = this.lastTime;
		elms.b_status.textContent = `クリア（時刻：${this.lastTime}）`;
		wait(500).then(() => {
			getDOM('clear_modal').classList.add('active');
		});
		if (isMulti) {
			const data = {
				id: this.room.id,
				time: this.lastTime,
			}
			socket.emit('game cleared', data);
		}
	});
	game.onExit(function() {
		if (isMulti) {
			socket.emit('exit game', this.room.id);
			destryoOppBoard();
		}
	});
	game.onDestroy(function() {
		devlog("destroyed");
		devlog(this);
	});
}

socket.on('opp firstdata', (data) => {
	const isOwner = game.room.ownerID === socket.id;
	const oppname = isOwner ? game.room.player : game.room.owner;
	elms.opp_name.textContent = oppname;
	elms.opp_status.textContent = 'まだ一手も打っていません';
	elms.opp_width.textContent = data.width;
	elms.opp_height.textContent = data.height;
	game.opp_width = data.width;
	game.opp_height = data.height;

	createOppBoard(data);
	elms.opp_waiting.classList.remove('active');
	elms.opp.classList.add('active');
});
socket.on('opp change', (data) => {
	devlog('opponent changed board↓');
	devlog(data);
	updateOppBoard(data);
});
socket.on('opp failed', (time) => {
	createNotice('相手が爆発しました', true);
	elms.opp_board.classList.add('failed');
	elms.opp_status.textContent = `失敗（時刻：${time}）`;
	SE.play('bomb');
	SE.play('tin');
});
socket.on('opp cleared', (time) => {
	createNotice('相手がクリアしました', true);
	elms.opp_board.classList.add('cleared');
	elms.opp_status.textContent = `クリア（時刻：${time}）`;
	SE.play('win');
});
socket.on('opp exited', () => {
	createNotice('相手が退出しました', true);
	elms.opp_board.classList.add('exited');
	elms.opp_status.textContent = '退出';
});


function createOppBoard(data) {
	const W = data.width;
	const H = data.height;
	const field_w = elms.screen.clientWidth;
	const field_h = elms.screen.clientHeight;
	const squareSize = Math.min(Math.floor(field_w/W), Math.floor((field_h-50)/H));

	elms.opp_board.style.width = squareSize * W + 'px';
	elms.opp_board.style.height = squareSize * H + 'px';
	elms.opp_head.style.width = squareSize * W + 'px';
	elms.opp_wrap.style.width = squareSize * W + 'px';
	elms.opp_wrap.style.height = squareSize * H + 50 + 'px';

	let id = 0;
	for (let y = 0; y < H; y++) {
		for (let x = 0; x < W; x++) {
			const square = document.createElement('div');
			square.dataset.y = y;
			square.dataset.x = x;

			square.style.width = squareSize + 'px';
			square.style.height = squareSize + 'px';
			square.style.lineHeight = squareSize + 'px';
			square.style.fontSize = squareSize / 2 + 10 + 'px';

			square.classList.add('square');
			const className = data.board[y][x] ? 'bomb' : 'valid';
			square.classList.add(className);
			square.setAttribute('id', `opp_${id}`);

			const total = data.nums[y][x]
			if (total === 0) {
				square.classList.add('zero');
			}
			square.setAttribute('data-num', total);
	
			elms.opp_board.appendChild(square);
			id++;
		}
	}
	elms.opp_flags.textContent = game.bombAmount;
}

function updateOppBoard(data) {
	let id = 0;
	for (let y = 0; y < game.opp_height; y++) {
		for (let x = 0; x < game.opp_width; x++) {
			const square = getDOM(`opp_${id}`);
			if (data.flag[y][x]) square.classList.add('flag');
			else square.classList.remove('flag');

			if (data.digged[y][x]) square.classList.add('digged');
			// cannot undig
			id++;
		}
	}
	elms.opp_flags.textContent = data.flag_reminder;
	const digged_amount = flatten(data.digged).filter(e => e).length;
	const progress = calcProgress(game.size, game.bombAmount, digged_amount);
	elms.opp_status.textContent = `完成度${progress}%`;
}

function destryoOppBoard() {
	elms.opp_board.classList.remove('failed');
	elms.opp_board.classList.remove('cleared');
	elms.opp_board.classList.remove('exited');

	while(elms.opp_board.firstChild) {
		const child = elms.opp_board.firstChild;
		elms.opp_board.removeChild(child);
	}
	elms.opp_flags.textContent = 0;
	elms.opp_status.textContent = '';
	elms.opp_name.textContent = '';
	elms.opp_width.textContent = '';
	elms.opp_height.textContent = '';
}


SDF('exit_btn', 'click', exit)
function exit() {
	const isMulti = game.type === 'multi';
	game.exit();
	if (isMulti) {
		myroom.break();
		closeGameConfig('multi');
	} else {
		closeGameConfig('solo');
	}
	
	elms.g_wrap.classList.remove('active');
	elms.menu.classList.remove('active');
	elms.lobby.classList.add('active');
}

document.querySelectorAll('.close_result_modal').forEach(elm => {
	elm.addEventListener('click', () => {
		getDOM('clear_modal').classList.remove('active');
		getDOM('fail_modal').classList.remove('active');
	});
});

// only showed when solo
document.querySelectorAll('.restart_btn').forEach(elm => {
	elm.addEventListener('click', function() {
		getDOM('clear_modal').classList.remove('active');
		getDOM('fail_modal').classList.remove('active');
		getDOM('loading__wrap').classList.remove('slideout');
		const width = game.width;
		const height = game.height;
		const bombAmount = game.bombAmount;
		game.onDestroy(() => {
			initiate('solo', width, height, bombAmount)
		});
		game.exit();
	})
});
