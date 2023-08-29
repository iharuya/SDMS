'use strict';
// custom/additional room info
module.exports = class Room {
	constructor(data) {
		this.id = undefined;
		this.owner = data.owner;
		this.ownerID = undefined
		this.width = data.width;
		this.height = data.height;
		this.bomb = data.bomb;
		this.created = new Date();
		this.status = 'waiting'; // /matched/ongame/ended
		this.player = undefined;
		this.playerID = undefined;
		this.ready = 0;
		this.number = 0;
	}
}