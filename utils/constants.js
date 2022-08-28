//influences
export const ASSASSIN = "ASSASSIN";
export const DUKE = "DUKE";
export const CONTESSA = "CONTESSA";
export const AMBASSADOR = "AMBASSADOR";
export const CAPTAIN = "CAPTAIN";

//player responses
export const CHALLENGE = "CHALLENGE";
export const BLOCK = "BLOCK";
export const PASS = "PASS";

//player actions
export const ASSASSINATE = "ASSASSINATE";
export const STEAL = "STEAL";
export const EXCHANGE = "EXCHANGE";
export const FOREIGN_AID = "FOREIGNAID";
export const COUP = "COUP";
export const TAX = "TAX";
export const INCOME = "INCOME";

export const IDLE = "idle";
export const ACTIVE = "active";
export const HOST = "host";
export const GUEST = "guest";
export const SERVER_MESSAGE = "serverMessage";

export const SUCCESS = 1;
export const UNKNOWN = -1;
export const FAIL = 0;

export const BLOCKABLE = new Set(
    [FOREIGN_AID,
    ASSASSINATE,
    STEAL]);

export const CHALLENGABLE = new Set(
    [TAX,
    EXCHANGE,
    ASSASSINATE,
    STEAL]);

export const GUARANTEED = new Set(
    [INCOME,
    COUP]);

export const VALID_ACTION_CLAIMS = {
    [STEAL]: [CAPTAIN],
    [ASSASSINATE]: [ASSASSIN],
    [TAX]: [DUKE],
    [EXCHANGE]: [AMBASSADOR],
};

export const VALID_BLOCK_CLAIMS = {
    [STEAL]: [AMBASSADOR, CAPTAIN],
    [ASSASSINATE]: [CONTESSA],
    [FOREIGN_AID]: [DUKE],
};

export const BLOCK_ATTEMPT_MSG = {
    [STEAL]: ["is trying to BLOCK", "STEAL attempt as"], 
    [FOREIGN_AID]: ["is trying to BLOCK", "FOREIGN AID attempt as DUKE"], 
    [ASSASSINATE]: ["is trying to BLOCK", "ASSASSINATION attempt as CONTESSA"],
};

export const ACTION_ATTEMPT_MSG = {
    [STEAL]: ["is trying to STEAL from"], 
    [FOREIGN_AID]: ["is trying to collect FOREIGN AID"],
    [ASSASSINATE]: ["is trying to ASSASSINATE"], 
    [TAX]: ["is trying to collect TAX"], 
    [EXCHANGE]: ["is trying to EXCHANGE influences"],
};

export const ACTION_SUCCESS_MSG = {
    [INCOME]: ["collected 1 coin from INCOME"],
    [STEAL]: ["STOLE", "coins from"], 
    [ASSASSINATE]: ["ASSASSINATED"], 
    [TAX]: ["collected 3 coins from TAX"], 
    [EXCHANGE]: ["is EXCHANGING influences"],
    [FOREIGN_AID]: ["collected 2 coins from FOREIGN AID"],
    [BLOCK]: ["successfully BLOCKED"], 
    [CHALLENGE]: ["successfully CHALLENGED"],
    [COUP]: ["successfully instigated a COUP against"],
    [INCOME]: ["collected 1 coin from INCOME"],
};

export const ACTION_FAIL_MSG = {
    [STEAL]: ["failed to STEAL from"], 
    [ASSASSINATE]: ["failed to ASSASSINATE"], 
    [TAX]: ["failed to collect TAX"], 
    [EXCHANGE]: ["failed to EXCHANGE influences"],
    [FOREIGN_AID]: ["failed to collect FOREIGN AID"],
    [BLOCK]: ["failed to BLOCK"],
    [CHALLENGE]: ["failed the CHALLENGE against"],
};
