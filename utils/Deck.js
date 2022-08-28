// DECK CLASS DEFINITION
import { ASSASSIN, DUKE, CONTESSA, AMBASSADOR, CAPTAIN } from "./constants.js";
export class Deck {
    constructor() {
        this.deck = [
            DUKE, DUKE, DUKE, 
            ASSASSIN, ASSASSIN, ASSASSIN, 
            CONTESSA, CONTESSA, CONTESSA, 
            AMBASSADOR, AMBASSADOR, AMBASSADOR, 
            CAPTAIN, CAPTAIN, CAPTAIN];
    }

    shuffle() {
        // https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle
        for (let i = this.deck.length - 1; i > 0; i--) {
            const randIndex = Math.floor(Math.random()*(i+1));
            const temp = this.deck[randIndex];
            this.deck[randIndex] = this.deck[i];
            this.deck[i] = temp;
        }
    }
    
    draw() {
        return this.deck.pop();
    }
    
    add(card) {
        this.deck.push(card);
    }
}
