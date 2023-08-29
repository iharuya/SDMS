'use strict';
// client-side room
class Room {
	constructor() {
		this.valid = false
		this.counter = 0;
		this.server = {} // サーバーからのデータを逐一ここに保存
	}
	make() {
		this.valid = true;
		this.counter++;
	}
	break() {
		this.valid = false
	}
}
export const myroom = new Room();