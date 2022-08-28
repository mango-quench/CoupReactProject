import {
    CHALLENGE,
    BLOCK,
    PASS,
    ASSASSINATE,
    STEAL,
    EXCHANGE,
    FOREIGN_AID,
    COUP,
    TAX,
    INCOME,
    BLOCKABLE,
    CHALLENGABLE,
    GUARANTEED,
    VALID_ACTION_CLAIMS,
    VALID_BLOCK_CLAIMS,
    BLOCK_ATTEMPT_MSG,
    ACTION_ATTEMPT_MSG,
    ACTION_SUCCESS_MSG,
    ACTION_FAIL_MSG,
    IDLE,
    ACTIVE,
    SUCCESS,
    FAIL,
    SERVER_MESSAGE,
} from "./constants.js";

import { Deck } from "./Deck.js";
import { ListNode } from "./ListNode.js";

export const STARTING_COINS = 2;
const STEAL_AMOUNT = 2;
const INCOME_AMOUNT = 1;
const FOREIGN_AID_AMOUNT = 2;
const TAX_AMOUNT = 3;
const FORCED_COUP_THRESHOLD = 10;

// GAME CLASS DEFINITION
export class Game {
    constructor(code) {
        this.code = code;
        this.idToSocket = new Map(); 
        this.state = IDLE;
        this.start = null;
        this.alive = new Map();
        this.dead = new Map();
        this.deck = new Deck();
        this.waitingOn = null;
        this.contestStack = null;
        this.stackActionsLeft = 0;
    }

    // DECK LOGIC
    dealCards() {
        for (const [socketId, player] of this.alive) {
            player.addInfluences([this.deck.draw(), this.deck.draw()]);
        }
    }

    swapRevealedCard(socketId) {
        const player = this.contestStack.slice(-1)[0].targetPlayer
        const card = this.contestStack.slice(-1)[0].influenceClaim;
        this.alive.get(player).removeInfluence(card);
        this.deck.add(card);
        this.deck.shuffle();
        this.alive.get(player).addInfluences([this.deck.draw()]);
    }

    // GAME RESET and TURN LOGIC

    nextTurn(callback) {
        // TODO: Remove nodes from list if player is dead
        this.start = this.start.next;
        while (this.dead.has(this.start.val)) {
            this.start = this.start.next;
        }
        callback();
    }

    generateTurnOrder() {
        const turnOrderArr = Array.from(this.alive.keys());
        for (let i = turnOrderArr.length - 1; i > 0; i--) {
            const randIndex = Math.floor(Math.random() * (i + 1));
            const temp = turnOrderArr[randIndex];
            turnOrderArr[randIndex] = turnOrderArr[i];
            turnOrderArr[i] = temp;
        }
        this.start = new ListNode(turnOrderArr[0]);
        let currNode = this.start;
        for (let i = 1; i < turnOrderArr.length; i++) {
            currNode.next = new ListNode(turnOrderArr[i]);
            currNode = currNode.next;
        }
        currNode.next = this.start;
    }

    resetTurn() {
        this.stackActionsLeft -= 1;
        console.log(this.stackActionsLeft);
        if (this.stackActionsLeft === 0) {
            this.contestStack = null;
            this.stackActionsLeft = 0;
            if (this.alive.size === 1) {
                const winnerName = [...this.alive.values()][0].name;
                this.broadcastAll("gameOver", null);
                this.broadcastAll(SERVER_MESSAGE, winnerName + " wins! Awaiting game restart...");
                this.state = IDLE;
            } else {
                this.nextTurn(() => {
                    this.notifyDisplayData();
                    this.notifyCurrTurn();
                    const turnMessage = `It's ${this.alive.get(this.start.val).name}'s turn.`;
                    this.broadcastAll(SERVER_MESSAGE, turnMessage);
                });
            }
        }
    }

    resetGame() {
        this.state = ACTIVE;
        this.deck = new Deck();
        this.waitingOn = null;
        this.contestStack = null;
        this.stackActionsLeft = 0;
        // Emptying graveyard into living room.
        const temp = new Map([...this.alive, ...this.dead]);
        this.alive = temp;
        this.dead = new Map();
        for (const [socketId, player] of this.alive) {
            player.influences = [];
            player.coins = STARTING_COINS;
        }
        this.generateTurnOrder();
        this.deck.shuffle();
        this.dealCards();
    }

    // PLAYER STATE LOGIC
    playerTurnCheck(action, callback) {
        if (this.start.val === action.actingPlayer) {callback(action);}
    }

    socketIdMapAdd(socket) {
        this.idToSocket.set(socket.id, socket);
    }

    socketIdMapUpdateDelete(socket) {
        this.idToSocket.delete(socket.id)
    }

    alivePlayerAdd(socketId, player) {
        this.alive.set(socketId, player);
    }

    // Only used in the lobby
    alivePlayerDelete(socketId) {
        this.alive.delete(socketId);
    }

    deadPlayerDelete(socketId) {
        this.dead.delete(socketId)
    }

    killPlayer(socketId) {
        this.dead.set(socketId, this.alive.get(socketId));
        this.alive.delete(socketId);
    }
    

    // STATE TRANSITIONS:
    // Player emits action to server -> actionRoutingMiddleman generates correct CPB (challenge/pass/block) combo ->
    //  -> CPBRouter initiates + moderates contest and decides if last action in stack succeeded or failed -> Contest results sent to actionApply
    //  -> actionApply determines success/failure of each event -> routes each event to its own method and initializes number of events in stack to process
    //  -> action-specific method completes -> resetTurn is called -> events count -= 1 and check if it's zero -> if not zero, nothing happens else ->
    //  -> round is reset and turn moves to next living player. 

    actionRoutingMiddleman() {
        const action = this.contestStack[0];
        const actor = this.alive.get(action.actingPlayer);
        console.log(`CP #2`, action.actionEvent);

        if (CHALLENGABLE.has(action.actionEvent) && BLOCKABLE.has(action.actionEvent)) {
            this.contestStack[0].influenceClaim = VALID_ACTION_CLAIMS[action.actionEvent][0];
            this.chooseTarget();
        } else if (CHALLENGABLE.has(action.actionEvent)) {
            const msg = `${actor.name} ${ACTION_ATTEMPT_MSG[action.actionEvent][0]}.`;
            this.broadcastAll(SERVER_MESSAGE, msg);
            this.contestStack[0].influenceClaim = VALID_ACTION_CLAIMS[action.actionEvent][0];
            this.challengePassBlockRouter({CHALLENGE: true, BLOCK: false, PASS: true});

        } else if (BLOCKABLE.has(action.actionEvent)) {
            const msg = `${actor.name} ${ACTION_ATTEMPT_MSG[action.actionEvent][0]}.`;
            this.broadcastAll(SERVER_MESSAGE, msg);
            this.challengePassBlockRouter({CHALLENGE: false, BLOCK: true, PASS: true});

        } else if (GUARANTEED.has(action.actionEvent)) {
            this.contestStack[0].eventStatus = SUCCESS;
            if (action.actionEvent === INCOME) {
                this.applyActions();
            } else if (action.actionEvent === COUP) {
                this.chooseTarget();
            }
        }
    }

    challengePassBlockRouter(CPBParams) {
        console.log(`CP #4`);
        const contest = this.contestStack.slice(-1)[0];
        const playersExcludedFromContest = new Set([contest.actingPlayer]);
        this.waitingOn = new Set(this.alive.keys());
        if (CHALLENGABLE.has(contest.actionEvent) && BLOCKABLE.has(contest.actionEvent)) {
            playersExcludedFromContest.add(contest.targetPlayer);
            this.broadcastOne("contest", {CHALLENGE: true, BLOCK: true, PASS: true}, contest.targetPlayer);
        }
        this.broadcastAlive("contest", CPBParams, playersExcludedFromContest);
        
        this.alive.forEach((player, socketId) => {
            const socket = this.idToSocket.get(socketId);
            socket.once("reqContestObj", (contest) => {
                if (this.waitingOn.has(socket.id)) {
                    this.waitingOn.delete(socket.id);
                    switch(contest.actionEvent) {
                        case CHALLENGE:
                            this.broadcastAlive("hideContest", null);
                            contest.targetPlayer = this.contestStack.slice(-1)[0].actingPlayer;
                            contest.influenceClaim = this.contestStack.slice(-1)[0].influenceClaim;
                            const actor = this.alive.get(contest.actingPlayer).name;
                            const target = this.alive.get(contest.targetPlayer).name;
                            const challengeMessage = `${actor} CHALLENGED ${target}.`;
                            this.broadcastAlive('serverMessage', challengeMessage);
                            this.contestStack.push(contest);
                            this.revealCard();
                            break;
                        case PASS:
                            if (this.waitingOn.size === 1) {
                                this.contestStack[this.contestStack.length - 1].eventStatus = 1;
                                this.applyActions();
                            }
                            break;
                        case BLOCK:
                            this.broadcastAlive("hideContest", null);
                            socket.emit("chooseClaims", VALID_BLOCK_CLAIMS[this.contestStack[0].actionEvent]);
                            socket.once("claimChosen", (choice) => {
                                contest.influenceClaim = choice;
                                contest.targetPlayer = this.contestStack.slice(-1)[0].actingPlayer;
                                const actor = this.alive.get(contest.actingPlayer).name;
                                const target = this.alive.get(contest.targetPlayer).name;
                                const lastAction = this.contestStack.slice(-1)[0].actionEvent;
                                // Alerting Players that an attempt to block has been made.
                                let blockMsg = `${actor} ${BLOCK_ATTEMPT_MSG[lastAction][0]} ${target}'s ${BLOCK_ATTEMPT_MSG[lastAction][1]}`;
                                blockMsg += (lastAction === STEAL) ?  ` ${choice}.` :  `.`;
                                this.broadcastAll(SERVER_MESSAGE, blockMsg);
                                this.contestStack.push(contest);
                                this.challengePassBlockRouter({CHALLENGE: true, BLOCK: false, PASS: true});
                            });
                            break;
                    }
                }
            });
        });
    }

    applyActions() {
        this.stackActionsLeft = this.contestStack.length;
        let status = this.contestStack.slice(-1)[0].eventStatus % 2;
        for (let i = this.contestStack.length - 1; i >= 0; i--) {
            this.contestStack[i].eventStatus = status % 2;
            status++; 
        }
        this.contestStack.forEach((act) => {console.log(act)});

        for (let i = this.contestStack.length - 1; i >= 0; i--) {
            const event = this.contestStack[i];
            switch (event.actionEvent) {
                case INCOME:
                    this.incomeApply(event);
                    break;
                case FOREIGN_AID:
                    this.foreignAidApply(event);
                    break;
                case TAX:
                    this.taxApply(event);
                    break;
                case ASSASSINATE:
                    this.assassinateApply(event);
                    break;
                case STEAL:
                    this.stealApply(event);
                    break;
                case COUP:
                    this.influenceLoseApply(event.targetPlayer, null, () => {});
                    break;
                case EXCHANGE:
                    this.exchangeApply(event)
                    break;
                case CHALLENGE:
                    this.challengeApply(event);
                    break;
                case BLOCK:
                    this.resetTurn();
                    break;
            }
            if (event.actionEvent !== STEAL) {this.notifyResult(event);}
        }
    }

    challengeApply(event) {
        const firstAction = this.contestStack[0];

        if (firstAction.actionEvent === ASSASSINATE) {
            if (firstAction.eventStatus === SUCCESS) {
                this.influenceLoseApply(firstAction.targetPlayer, firstAction.targetPlayer, () => {
                    this.influenceLoseApply(firstAction.targetPlayer, null, () => {});
                })
            } else {
                if (event.eventStatus === SUCCESS) {
                    this.influenceLoseApply(firstAction.actingPlayer, null, () => {});
                } else {
                    this.influenceLoseApply(event.actingPlayer, null, () => {});
                }
            }
        } else {
            let loser;
            event.eventStatus === SUCCESS ? loser = event.targetPlayer : loser = event.actingPlayer;
            if (event.eventStatus !== SUCCESS) {this.swapRevealedCard(event.targetPlayer);} 
            this.influenceLoseApply(loser, null, () => {});
        }
    }

    influenceLoseApply(socketId, nextVictimId, callback) {
        // This is never called on a player with no influences remaining.
        const player = this.alive.get(socketId);
        const socket = this.idToSocket.get(socketId);
        this.broadcastOne(SERVER_MESSAGE, "Choose an influence to discard:", socketId);
        this.broadcastOne("loseInfluence", player.influences, socketId);
            
        socket.once("influenceLost", (choice) => {
            this.broadcastAll(SERVER_MESSAGE, player.name + " lost " + choice)
            player.removeInfluence(choice)
            if (player.influences.length === 0) {
                this.killPlayer(socketId);
                this.broadcastAll(SERVER_MESSAGE, player.name + " has died.")
            }
            if (nextVictimId !== null) {
                this.alive.has(nextVictimId) ? callback() : this.resetTurn();
            }
            this.resetTurn()
        });
    }

    incomeApply(event) {
        this.alive.get(event.actingPlayer).updateCoins(INCOME_AMOUNT)
        this.resetTurn();
    }
    
    foreignAidApply(event) {
        if (event.eventStatus === SUCCESS) {
            this.alive.get(event.actingPlayer).updateCoins(FOREIGN_AID_AMOUNT);
        } 
        this.resetTurn();
    }

    taxApply(event) {
        if (event.eventStatus === SUCCESS) {
            this.alive.get(event.actingPlayer).updateCoins(TAX_AMOUNT)
        }
        this.resetTurn();
    }

    assassinateApply(event) {
        if (event.eventStatus === SUCCESS && this.contestStack.slice(-1)[0].actionEvent !== CHALLENGE) {
            this.influenceLoseApply(event.targetPlayer, null, () => {});
        } else if (event.eventStatus === FAIL) {
            this.resetTurn();
        }
    }

    stealApply(event) {
        const thief = this.alive.get(event.actingPlayer);
        const target = this.alive.get(event.targetPlayer);
        const stolenCoins = Math.min(target.retrieveCoins, STEAL_AMOUNT);
        let msg;
        if (event.eventStatus === SUCCESS) {
            target.updateCoins(-stolenCoins);
            thief.updateCoins(stolenCoins);
            msg = `${thief.name} ${ACTION_SUCCESS_MSG[event.actionEvent][0]} ${stolenCoins} ${ACTION_SUCCESS_MSG[event.actionEvent][1]} ${target.name}.`;
        } else {
            msg = `${thief.name} ${ACTION_FAIL_MSG[event.actionEvent]} ${target.name}.`;
        }
        this.broadcastAll(SERVER_MESSAGE, msg);
        this.resetTurn();
    }

    exchangeApply(event) {
        if (event.eventStatus === SUCCESS) {
            const player = event.actingPlayer;
            const influenceOptions = [...this.alive.get(player).influences];
            const influenceCount = influenceOptions.length;
            for (let i=0; i < influenceCount; i++) {
                influenceOptions.push(this.deck.draw());
            }
            this.broadcastOne("exchangeInfluences", influenceOptions, player);
            // Here we just compute the symmetric difference
            const socket = this.idToSocket.get(player);
            socket.once("influencesExchanged", (chosen) => {
                const goBackIntoDeck = this.multisetSubsetSymmetricDifference(influenceOptions, chosen);
                goBackIntoDeck.forEach((card) => {this.deck.add(card)});
                this.deck.shuffle();
                this.alive.get(player).influences = chosen;
                this.resetTurn();
            });
        } else {
            this.resetTurn();
        }
    }

    // CHOICES/TARGETING LOGIC

    multisetSubsetSymmetricDifference(arr0, arr1) {
        // Given two arrays with multiplicity, where arr1 is subset of arr0, returns difference of arr0 by arr1.  
        const finalDifference = [];
        const countsArr0 = new Map();
        arr0.forEach((elem) => {
            countsArr0.has(elem) ? countsArr0.set(elem, countsArr0.get(elem) + 1) : countsArr0.set(elem, 1);
        })
        arr1.forEach((elem) => {
            countsArr0.set(elem, countsArr0.get(elem) - 1);  
        });
        countsArr0.forEach((count, elem) => {
            for (let i=0; i<count; i++) {finalDifference.push(elem);}
        });
        return finalDifference;
    }

    chooseTarget() {
        const action = this.contestStack[0];
        const socketId = action.actingPlayer;
        const targetablePlayers = [];
        this.alive.forEach((player, id) => {
            if (socketId !== id) {
                targetablePlayers.push({name: player.name, id: id});
            }
        });

        this.broadcastOne("chooseTarget", targetablePlayers, socketId);
        const socket = this.idToSocket.get(socketId);
        socket.once("targetChosen", (target) => {
            this.contestStack[0].targetPlayer = target;
            if (action.actionEvent === COUP) {
                this.applyActions();
            } else {
                const msg = `${this.alive.get(action.actingPlayer).name} ${ACTION_ATTEMPT_MSG[action.actionEvent]} ${this.alive.get(target).name}.`;
                this.broadcastAll(SERVER_MESSAGE, msg);
                this.challengePassBlockRouter({CHALLENGE: true, BLOCK: false, PASS: true});
            }
        })
    }

    revealCard() {
        const lastAction = this.contestStack[this.contestStack.length - 1];
        const target = lastAction.targetPlayer;
        const targetInfluenceChoices = this.alive.get(target).influences;
        const socket = this.idToSocket.get(target);
        this.broadcastOne("revealSelections", targetInfluenceChoices, target);
        this.broadcastOne(SERVER_MESSAGE, "You've been CHALLENGED! Choose a card to reveal.", target);
        socket.once("claimRevealed", (choice) => {
            this.broadcastAll(SERVER_MESSAGE, this.alive.get(target).name + " revealed " + choice + "!");
            lastAction.eventStatus = (choice === lastAction.influenceClaim) ? FAIL : SUCCESS;
            this.applyActions();
        });
    }
    // NOTIFYCATIONS
    notifyCurrTurn() {
        const forcedMove = {COUP: false};
        if (this.alive.get(this.start.val).retrieveCoins >= FORCED_COUP_THRESHOLD) {
            forcedMove.COUP = true;
        }
        this.idToSocket.get(this.start.val).emit("yourTurn", forcedMove);
    }
    
    broadcastAlive(event, obj, excludeSet=null) {
        this.alive.forEach((player, id) => {
            if (excludeSet === null || !(excludeSet.has(id))) {
                const socket = this.idToSocket.get(id);
                socket.emit(event, obj);
            }
        });
    }

    broadcastAll(event, obj, excludeSet=null) {
        this.idToSocket.forEach((socket, id) => {
            if (excludeSet === null || !(excludeSet.has(id))) {
                socket.emit(event, obj);
            }
        });
    }

    broadcastOne(event, obj, id) {
        this.idToSocket.get(id).emit(event, obj);
    }

    notifyDisplayData() {
        this.idToSocket.forEach((socket, socketId) => {
            const playerDataArr = [];
            this.alive.forEach((player, id) => {
                const playerData = {
                    name: player.name,
                    roles: null,
                    coins: player.retrieveCoins,
                };     
                if (id === socketId) {
                    playerData.roles = player.influences;
                }
                playerDataArr.push(playerData);
            });
            socket.emit("playerData", playerDataArr);
        })
    }

    notifyResult(actionObj) {
        const actor = this.alive.get(actionObj.actingPlayer).name;
        const target = this.alive.get(actionObj.targetPlayer ?? "")?.name ?? "";
        console.log(target);
        let message;
        if (actionObj.eventStatus === SUCCESS) {
            if (actionObj.targetPlayer !== null) {
                const target = this.alive.get(actionObj.targetPlayer).name;
                message = `${actor} ${ACTION_SUCCESS_MSG[actionObj.actionEvent]} ${target}.`;
            } else {
                message = `${actor} ${ACTION_SUCCESS_MSG[actionObj.actionEvent]}.`;
            }
        } else {
            if (actionObj.targetPlayer !== null) {
                const target = this.alive.get(actionObj.targetPlayer).name;
                message = `${actor} ${ACTION_FAIL_MSG[actionObj.actionEvent]} ${target}.`;
            } else {
                message = `${actor} ${ACTION_FAIL_MSG[actionObj.actionEvent]}.`;
            }
        }
        this.broadcastAll(SERVER_MESSAGE, message, null);
    }
}
