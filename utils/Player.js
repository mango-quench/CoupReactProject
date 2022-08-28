import { STARTING_COINS } from "./Game.js";

export class Player {
    constructor(name, status) {
        this.status = status;
        this.name = name;
        this.roles = [];
        this.coins = STARTING_COINS;
    }
    // Roles
    get influences() {
        return this.roles;
    }

    set influences(arr) {
        this.roles = arr;
    }

    addInfluences(influences) {
        this.roles.push(...influences);
    }

    removeInfluence(card) {
        this.roles[0] === card ? this.roles.shift() : this.roles.pop();
    }

    get retrieveCoins() {
        return this.coins;
    }

    updateCoins(amount) {
        this.coins += amount;
    }
}
