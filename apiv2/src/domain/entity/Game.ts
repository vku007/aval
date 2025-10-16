import { Round } from "./Round.js";


export class Game {
    constructor(
        public readonly id: string,
        public readonly type: string, // how many rounds, for example
        public readonly usersIds: string[],
        public rounds: Round[],
        public isFinished: boolean

    ) {}
}