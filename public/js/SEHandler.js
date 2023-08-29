'use strict';
import { EventEmitter } from './EventEmitter.js';

export class SEHandler extends EventEmitter {
	constructor() {
		super();
		this.initTime = new Date();
		this.list = {
			bomb: new Audio("./sound/bomb.mp3"),
			cancel: new Audio("./sound/cancel.mp3"),
			dig: new Audio("./sound/dig.mp3"),
			flag: new Audio("./sound/flag.mp3"),
			unflag: new Audio("./sound/unflag.mp3"),
			select: new Audio("./sound/select.mp3"),
			bigdig: new Audio("./sound/bigdig.mp3"),
			tin: new Audio("./sound/tin.mp3"),
			win: new Audio("./sound/win.mp3"),
		}
		this.loadedAmount = 0;
		this.amount = Object.keys(this.list).length;
		this.allowed = false;
		this.status = "default";

	}

	load() {
		for (const name in this.list) {
			this.list[name].load();
			this.list[name].addEventListener('abort', this.errored.bind(this));
			this.list[name].addEventListener('error', this.errored.bind(this));
			this.list[name].addEventListener('stalled', this.errored.bind(this));
			this.list[name].addEventListener('canplaythrough', this.addLoaded.bind(this));
		}
	}

	addLoaded() {
		this.loadedAmount++;
		if (this.loadedAmount === this.amount) {
			this.emitTriedLoad('loaded');
		}
	}

	triedLoad(listener) {
		this.addEventListener("tried", listener);
	}
	emitTriedLoad(status) {
		// only once
		if (this.status !== 'default') return;

		this.status = status;
		this.emit("tried", "SE");
	}

	play(name) {
		if (this.allowed) {
			this.list[name].play();
		}
	}

	errored(e) {
		console.error(`failed load: ${e.path[0].currentSrc}`);
		console.log(e);
		this.emitTriedLoad('errored')
	}
}