/**
 * SubRoundStatus enum represents the status of a sub-round.
 * init - Initial state
 * wait_player - Waiting for player action
 * done - Completed
 */
export enum SubRoundStatus {
    Init = 'init',
    WaitPlayer = 'wait_player',
    Done = 'done',
    Surrendered = 'surrendered'
}

